import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { getDatabaseStatus } from '../config/db.js';
import {
  parseDateRange,
  calculatePercentageChange,
  calculateResolutionRate,
  calculateMedian,
  formatDurationHours,
  sanitizeCsvValue
} from '../utils/analyticsUtils.js';

/**
 * Helper to ensure database is available
 */
const ensureDbConnected = () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }
};

/**
 * Extracts resolution duration in hours for a resolved complaint.
 * Calculation methodology: Uses the first transition to 'Resolved' in statusHistory,
 * or falls back to updatedAt if statusHistory is empty.
 * Returns null if complaint is not resolved or duration is invalid.
 * @param {object} complaint
 * @returns {number|null} Duration in hours
 */
const getComplaintResolutionHours = (complaint) => {
  if (!complaint || complaint.status !== 'Resolved') return null;

  const createdAt = new Date(complaint.createdAt);
  if (isNaN(createdAt.getTime())) return null;

  let resolvedAt = null;

  if (Array.isArray(complaint.statusHistory) && complaint.statusHistory.length > 0) {
    const resolvedEntry = complaint.statusHistory.find((entry) => entry.newStatus === 'Resolved');
    if (resolvedEntry && resolvedEntry.changedAt) {
      const dt = new Date(resolvedEntry.changedAt);
      if (!isNaN(dt.getTime())) {
        resolvedAt = dt;
      }
    }
  }

  if (!resolvedAt && complaint.updatedAt) {
    const dt = new Date(complaint.updatedAt);
    if (!isNaN(dt.getTime())) {
      resolvedAt = dt;
    }
  }

  if (!resolvedAt) return null;

  const diffMs = resolvedAt.getTime() - createdAt.getTime();
  if (diffMs < 0) return 0; // Guard against negative clock skew

  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
};

/**
 * 1. Overview Analytics & KPI Summary Cards
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsOverview = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  // Build match query for current period
  const matchCurrent = {};
  if (dateInfo.startDate && dateInfo.endDate) {
    matchCurrent.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  // Build match query for previous equivalent period
  const matchPrev = {};
  if (dateInfo.prevStartDate && dateInfo.prevEndDate) {
    matchPrev.createdAt = { $gte: dateInfo.prevStartDate, $lte: dateInfo.prevEndDate };
  }

  // Execute aggregations for current and prior periods in parallel
  const [
    currentStats,
    prevStats,
    resolvedComplaintsRaw
  ] = await Promise.all([
    Complaint.aggregate([
      { $match: matchCurrent },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          highCritical: {
            $sum: {
              $cond: [
                { $in: ['$aiAnalysis.severity', ['High', 'Critical']] },
                1,
                0
              ]
            }
          },
          duplicates: {
            $sum: {
              $cond: [{ $eq: ['$duplicateCheck.isPotentialDuplicate', true] }, 1, 0]
            }
          }
        }
      }
    ]),
    dateInfo.prevStartDate
      ? Complaint.aggregate([
          { $match: matchPrev },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
              inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
              resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
              highCritical: {
                $sum: {
                  $cond: [
                    { $in: ['$aiAnalysis.severity', ['High', 'Critical']] },
                    1,
                    0
                  ]
                }
              },
              duplicates: {
                $sum: {
                  $cond: [{ $eq: ['$duplicateCheck.isPotentialDuplicate', true] }, 1, 0]
                }
              }
            }
          }
        ])
      : Promise.resolve([]),
    Complaint.find({
      ...matchCurrent,
      status: 'Resolved'
    }).select('createdAt updatedAt status statusHistory')
  ]);

  const curr = currentStats[0] || {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    highCritical: 0,
    duplicates: 0
  };

  const prev = prevStats[0] || {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    highCritical: 0,
    duplicates: 0
  };

  // Resolution duration metrics for resolved tickets
  const resolutionDurations = [];
  for (const c of resolvedComplaintsRaw) {
    const hours = getComplaintResolutionHours(c);
    if (hours !== null) {
      resolutionDurations.push(hours);
    }
  }

  const avgResolutionHours =
    resolutionDurations.length > 0
      ? Math.round(
          (resolutionDurations.reduce((sum, h) => sum + h, 0) / resolutionDurations.length) * 10
        ) / 10
      : 0;

  const medianResolutionHours = calculateMedian(resolutionDurations);

  const currentResolutionRate = calculateResolutionRate(curr.resolved, curr.total);
  const prevResolutionRate = calculateResolutionRate(prev.resolved, prev.total);

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    kpis: {
      totalComplaints: {
        value: curr.total,
        prevValue: prev.total,
        changePercent: calculatePercentageChange(curr.total, prev.total),
        label: 'Total Complaints'
      },
      pendingComplaints: {
        value: curr.pending,
        prevValue: prev.pending,
        changePercent: calculatePercentageChange(curr.pending, prev.pending),
        label: 'Pending Triage'
      },
      inProgressComplaints: {
        value: curr.inProgress,
        prevValue: prev.inProgress,
        changePercent: calculatePercentageChange(curr.inProgress, prev.inProgress),
        label: 'In Progress'
      },
      resolvedComplaints: {
        value: curr.resolved,
        prevValue: prev.resolved,
        changePercent: calculatePercentageChange(curr.resolved, prev.resolved),
        label: 'Resolved Issues'
      },
      resolutionRate: {
        value: currentResolutionRate,
        prevValue: prevResolutionRate,
        changePercent: calculatePercentageChange(currentResolutionRate, prevResolutionRate),
        unit: '%',
        label: 'Resolution Rate'
      },
      avgResolutionTime: {
        value: avgResolutionHours,
        medianValue: medianResolutionHours,
        formatted: formatDurationHours(avgResolutionHours),
        medianFormatted: formatDurationHours(medianResolutionHours),
        resolvedSampleCount: resolutionDurations.length,
        unit: 'hours',
        label: 'Avg Resolution Time'
      },
      highCriticalSeverity: {
        value: curr.highCritical,
        prevValue: prev.highCritical,
        changePercent: calculatePercentageChange(curr.highCritical, prev.highCritical),
        label: 'High / Critical Severity'
      },
      potentialDuplicates: {
        value: curr.duplicates,
        prevValue: prev.duplicates,
        changePercent: calculatePercentageChange(curr.duplicates, prev.duplicates),
        label: 'Potential Duplicates'
      }
    },
    statusDistribution: [
      {
        status: 'Pending',
        count: curr.pending,
        percentage: curr.total > 0 ? Math.round((curr.pending / curr.total) * 1000) / 10 : 0
      },
      {
        status: 'In Progress',
        count: curr.inProgress,
        percentage: curr.total > 0 ? Math.round((curr.inProgress / curr.total) * 1000) / 10 : 0
      },
      {
        status: 'Resolved',
        count: curr.resolved,
        percentage: curr.total > 0 ? Math.round((curr.resolved / curr.total) * 1000) / 10 : 0
      }
    ]
  };
};

/**
 * 2. Complaint Trend Analytics
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsTrends = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = {};
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const requestedInterval = queryParams.interval === 'monthly' ? 'monthly' : 'daily';
  const dateFormat = requestedInterval === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

  const trendsRaw = await Complaint.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        submitted: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Convert to keyed map for gap filling
  const trendMap = new Map();
  for (const item of trendsRaw) {
    trendMap.set(item._id, {
      date: item._id,
      submitted: item.submitted,
      pending: item.pending,
      inProgress: item.inProgress,
      resolved: item.resolved
    });
  }

  // If date bounds are available and interval is daily (for up to 90 days), fill in missing dates
  const filledTrends = [];
  if (
    dateInfo.startDate &&
    dateInfo.endDate &&
    requestedInterval === 'daily' &&
    dateInfo.endDate.getTime() - dateInfo.startDate.getTime() <= 90 * 24 * 60 * 60 * 1000
  ) {
    const cur = new Date(dateInfo.startDate);
    while (cur <= dateInfo.endDate) {
      const dateStr = cur.toISOString().split('T')[0];
      if (trendMap.has(dateStr)) {
        filledTrends.push(trendMap.get(dateStr));
      } else {
        filledTrends.push({
          date: dateStr,
          submitted: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    // Return sorted aggregation results directly
    for (const item of trendsRaw) {
      filledTrends.push({
        date: item._id,
        submitted: item.submitted,
        pending: item.pending,
        inProgress: item.inProgress,
        resolved: item.resolved
      });
    }
  }

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    interval: requestedInterval,
    trends: filledTrends,
    totalDataPoints: filledTrends.length
  };
};

/**
 * 3. Complaint Category Analytics
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsCategories = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = {};
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const [categoriesRaw, totalComplaintsCount] = await Promise.all([
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          highCritical: {
            $sum: {
              $cond: [
                { $in: ['$aiAnalysis.severity', ['High', 'Critical']] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]),
    Complaint.countDocuments(matchStage)
  ]);

  const categories = categoriesRaw.map((cat) => {
    const count = cat.count || 0;
    const resolved = cat.resolved || 0;
    const percentage = totalComplaintsCount > 0 ? Math.round((count / totalComplaintsCount) * 1000) / 10 : 0;
    const resolutionRate = count > 0 ? Math.round((resolved / count) * 1000) / 10 : 0;

    return {
      category: cat._id || 'Other',
      count,
      percentage,
      pending: cat.pending || 0,
      inProgress: cat.inProgress || 0,
      resolved,
      highCritical: cat.highCritical || 0,
      resolutionRate
    };
  });

  const mostReported = categories.length > 0 ? categories[0].category : null;

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    totalComplaints: totalComplaintsCount,
    mostReportedCategory: mostReported,
    categories
  };
};

/**
 * 4. Department Performance Analytics
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsDepartments = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = {};
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  // Load all departments from collection to ensure departments with 0 complaints are present
  const [allDepartments, departmentStatsRaw, totalComplaintsCount, resolvedWithDeptRaw] = await Promise.all([
    Department.find({}).lean(),
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$assignedDepartment',
          assignedDepartmentName: { $first: '$assignedDepartmentName' },
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
        }
      }
    ]),
    Complaint.countDocuments(matchStage),
    Complaint.find({
      ...matchStage,
      status: 'Resolved'
    }).select('assignedDepartment createdAt updatedAt status statusHistory')
  ]);

  // Calculate resolution times mapped by assignedDepartment id string
  const deptResolutionMap = new Map();
  for (const c of resolvedWithDeptRaw) {
    const deptKey = c.assignedDepartment ? c.assignedDepartment.toString() : 'unassigned';
    const hours = getComplaintResolutionHours(c);
    if (hours !== null) {
      if (!deptResolutionMap.has(deptKey)) {
        deptResolutionMap.set(deptKey, []);
      }
      deptResolutionMap.get(deptKey).push(hours);
    }
  }

  // Map of stats by department id
  const statsMap = new Map();
  let unassignedItem = {
    departmentId: null,
    departmentName: 'Unassigned',
    departmentCode: 'N/A',
    isActive: true,
    totalAssigned: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    resolutionRate: 0,
    avgResolutionHours: 0,
    workloadShare: 0
  };

  for (const item of departmentStatsRaw) {
    if (!item._id) {
      const times = deptResolutionMap.get('unassigned') || [];
      const avgHours =
        times.length > 0
          ? Math.round((times.reduce((s, h) => s + h, 0) / times.length) * 10) / 10
          : 0;

      unassignedItem = {
        departmentId: null,
        departmentName: 'Unassigned',
        departmentCode: 'N/A',
        isActive: true,
        totalAssigned: item.total,
        pending: item.pending,
        inProgress: item.inProgress,
        resolved: item.resolved,
        resolutionRate: calculateResolutionRate(item.resolved, item.total),
        avgResolutionHours: avgHours,
        workloadShare:
          totalComplaintsCount > 0
            ? Math.round((item.total / totalComplaintsCount) * 1000) / 10
            : 0
      };
    } else {
      statsMap.set(item._id.toString(), item);
    }
  }

  const departments = allDepartments.map((dept) => {
    const deptIdStr = dept._id.toString();
    const stat = statsMap.get(deptIdStr) || {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0
    };

    const times = deptResolutionMap.get(deptIdStr) || [];
    const avgHours =
      times.length > 0
        ? Math.round((times.reduce((s, h) => s + h, 0) / times.length) * 10) / 10
        : 0;

    const total = stat.total || 0;
    const resolved = stat.resolved || 0;
    const resolutionRate = calculateResolutionRate(resolved, total);
    const workloadShare =
      totalComplaintsCount > 0 ? Math.round((total / totalComplaintsCount) * 1000) / 10 : 0;

    return {
      departmentId: deptIdStr,
      departmentName: dept.name,
      departmentCode: dept.code,
      isActive: dept.isActive,
      totalAssigned: total,
      pending: stat.pending || 0,
      inProgress: stat.inProgress || 0,
      resolved,
      resolutionRate,
      avgResolutionHours: avgHours,
      workloadShare
    };
  });

  // Sort departments by total assigned descending
  departments.sort((a, b) => b.totalAssigned - a.totalAssigned);

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    totalComplaints: totalComplaintsCount,
    departments,
    unassigned: unassignedItem
  };
};

/**
 * 5. Officer Performance Analytics (Admin View)
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsOfficers = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = { assignedOfficer: { $ne: null } };
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  // Load all officers from User collection
  const [allOfficers, officerStatsRaw, resolvedOfficersRaw] = await Promise.all([
    User.find({ role: 'officer' })
      .populate('department', 'name code')
      .select('-password')
      .lean(),
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$assignedOfficer',
          officerName: { $first: '$assignedOfficerName' },
          totalAssigned: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
        }
      }
    ]),
    Complaint.find({
      ...matchStage,
      status: 'Resolved'
    }).select('assignedOfficer createdAt updatedAt status statusHistory')
  ]);

  // Compute resolution time per officer
  const officerResolutionMap = new Map();
  for (const c of resolvedOfficersRaw) {
    if (c.assignedOfficer) {
      const key = c.assignedOfficer.toString();
      const hours = getComplaintResolutionHours(c);
      if (hours !== null) {
        if (!officerResolutionMap.has(key)) {
          officerResolutionMap.set(key, []);
        }
        officerResolutionMap.get(key).push(hours);
      }
    }
  }

  const statsMap = new Map();
  for (const item of officerStatsRaw) {
    if (item._id) {
      statsMap.set(item._id.toString(), item);
    }
  }

  const officers = allOfficers.map((off) => {
    const offIdStr = off._id.toString();
    const stat = statsMap.get(offIdStr) || {
      totalAssigned: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0
    };

    const times = officerResolutionMap.get(offIdStr) || [];
    const avgHours =
      times.length > 0
        ? Math.round((times.reduce((s, h) => s + h, 0) / times.length) * 10) / 10
        : 0;

    const total = stat.totalAssigned || 0;
    const resolved = stat.resolved || 0;

    return {
      officerId: offIdStr,
      officerName: off.name,
      officerEmail: off.email,
      departmentName: off.department?.name || 'Unassigned',
      departmentCode: off.department?.code || 'N/A',
      totalAssigned: total,
      pending: stat.pending || 0,
      inProgress: stat.inProgress || 0,
      resolved,
      resolutionRate: calculateResolutionRate(resolved, total),
      avgResolutionHours: avgHours
    };
  });

  officers.sort((a, b) => b.totalAssigned - a.totalAssigned);

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    totalOfficers: allOfficers.length,
    officers
  };
};

/**
 * 6. Resolution Time Analytics
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsResolution = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = { status: 'Resolved' };
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const resolvedComplaints = await Complaint.find(matchStage)
    .select('complaintId category assignedDepartmentName createdAt updatedAt status statusHistory')
    .lean();

  const durations = [];
  const durationBrackets = {
    under24Hours: 0,
    oneToThreeDays: 0,
    threeToSevenDays: 0,
    overSevenDays: 0
  };

  const categoryTimesMap = new Map();
  const departmentTimesMap = new Map();

  for (const c of resolvedComplaints) {
    const hours = getComplaintResolutionHours(c);
    if (hours !== null) {
      durations.push(hours);

      // Bracket placement
      if (hours < 24) {
        durationBrackets.under24Hours++;
      } else if (hours <= 72) {
        durationBrackets.oneToThreeDays++;
      } else if (hours <= 168) {
        durationBrackets.threeToSevenDays++;
      } else {
        durationBrackets.overSevenDays++;
      }

      // Group by category
      const cat = c.category || 'Other';
      if (!categoryTimesMap.has(cat)) categoryTimesMap.set(cat, []);
      categoryTimesMap.get(cat).push(hours);

      // Group by department
      const dept = c.assignedDepartmentName || 'Unassigned';
      if (!departmentTimesMap.has(dept)) departmentTimesMap.set(dept, []);
      departmentTimesMap.get(dept).push(hours);
    }
  }

  const totalResolved = durations.length;
  const avgHours =
    totalResolved > 0
      ? Math.round((durations.reduce((s, h) => s + h, 0) / totalResolved) * 10) / 10
      : 0;

  const medianHours = calculateMedian(durations);
  const minHours = totalResolved > 0 ? Math.min(...durations) : 0;
  const maxHours = totalResolved > 0 ? Math.max(...durations) : 0;

  // Category resolution breakdown
  const categoryResolution = [];
  for (const [cat, times] of categoryTimesMap.entries()) {
    const avg = Math.round((times.reduce((s, h) => s + h, 0) / times.length) * 10) / 10;
    categoryResolution.push({
      category: cat,
      count: times.length,
      avgHours: avg,
      medianHours: calculateMedian(times),
      formatted: formatDurationHours(avg)
    });
  }
  categoryResolution.sort((a, b) => a.avgHours - b.avgHours);

  // Department resolution breakdown
  const departmentResolution = [];
  for (const [dept, times] of departmentTimesMap.entries()) {
    const avg = Math.round((times.reduce((s, h) => s + h, 0) / times.length) * 10) / 10;
    departmentResolution.push({
      departmentName: dept,
      count: times.length,
      avgHours: avg,
      medianHours: calculateMedian(times),
      formatted: formatDurationHours(avg)
    });
  }
  departmentResolution.sort((a, b) => a.avgHours - b.avgHours);

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    methodology:
      "Calculated from complaint creation (createdAt) to the first recorded transition to 'Resolved' in status history (or updatedAt if history is absent). Unresolved tickets are strictly excluded.",
    summary: {
      totalResolved,
      avgHours,
      avgFormatted: formatDurationHours(avgHours),
      medianHours,
      medianFormatted: formatDurationHours(medianHours),
      minHours,
      minFormatted: formatDurationHours(minHours),
      maxHours,
      maxFormatted: formatDurationHours(maxHours)
    },
    durationBrackets: {
      under24Hours: {
        count: durationBrackets.under24Hours,
        percentage:
          totalResolved > 0
            ? Math.round((durationBrackets.under24Hours / totalResolved) * 1000) / 10
            : 0,
        label: '< 24 Hours'
      },
      oneToThreeDays: {
        count: durationBrackets.oneToThreeDays,
        percentage:
          totalResolved > 0
            ? Math.round((durationBrackets.oneToThreeDays / totalResolved) * 1000) / 10
            : 0,
        label: '1 – 3 Days'
      },
      threeToSevenDays: {
        count: durationBrackets.threeToSevenDays,
        percentage:
          totalResolved > 0
            ? Math.round((durationBrackets.threeToSevenDays / totalResolved) * 1000) / 10
            : 0,
        label: '3 – 7 Days'
      },
      overSevenDays: {
        count: durationBrackets.overSevenDays,
        percentage:
          totalResolved > 0
            ? Math.round((durationBrackets.overSevenDays / totalResolved) * 1000) / 10
            : 0,
        label: '> 7 Days'
      }
    },
    categoryResolution,
    departmentResolution
  };
};

/**
 * 7. AI Severity Analytics
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsSeverity = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = {};
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const [severityBreakdownRaw, categorySeverityRaw, totalCount] = await Promise.all([
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$aiAnalysis.severity',
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            category: '$category',
            severity: '$aiAnalysis.severity'
          },
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.countDocuments(matchStage)
  ]);

  let low = 0;
  let medium = 0;
  let high = 0;
  let critical = 0;
  let unanalyzed = 0;

  for (const item of severityBreakdownRaw) {
    if (item._id === 'Low') low = item.count;
    else if (item._id === 'Medium') medium = item.count;
    else if (item._id === 'High') high = item.count;
    else if (item._id === 'Critical') critical = item.count;
    else unanalyzed += item.count;
  }

  const totalAnalyzed = low + medium + high + critical;
  const analysisCoverageRate =
    totalCount > 0 ? Math.round((totalAnalyzed / totalCount) * 1000) / 10 : 0;

  // Category vs Severity Matrix
  const matrixMap = new Map();
  for (const item of categorySeverityRaw) {
    const cat = item._id.category || 'Other';
    const sev = item._id.severity || 'Unanalyzed';
    if (!matrixMap.has(cat)) {
      matrixMap.set(cat, {
        category: cat,
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0,
        Unanalyzed: 0,
        total: 0
      });
    }
    const entry = matrixMap.get(cat);
    if (sev === 'Low') entry.Low += item.count;
    else if (sev === 'Medium') entry.Medium += item.count;
    else if (sev === 'High') entry.High += item.count;
    else if (sev === 'Critical') entry.Critical += item.count;
    else entry.Unanalyzed += item.count;
    entry.total += item.count;
  }

  const categoryMatrix = Array.from(matrixMap.values()).sort((a, b) => b.total - a.total);

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    totalComplaints: totalCount,
    analyzedComplaints: totalAnalyzed,
    analysisCoverageRate,
    severityDistribution: {
      Critical: {
        count: critical,
        percentage: totalCount > 0 ? Math.round((critical / totalCount) * 1000) / 10 : 0,
        color: '#ef4444'
      },
      High: {
        count: high,
        percentage: totalCount > 0 ? Math.round((high / totalCount) * 1000) / 10 : 0,
        color: '#f97316'
      },
      Medium: {
        count: medium,
        percentage: totalCount > 0 ? Math.round((medium / totalCount) * 1000) / 10 : 0,
        color: '#f59e0b'
      },
      Low: {
        count: low,
        percentage: totalCount > 0 ? Math.round((low / totalCount) * 1000) / 10 : 0,
        color: '#10b981'
      },
      Unanalyzed: {
        count: unanalyzed,
        percentage: totalCount > 0 ? Math.round((unanalyzed / totalCount) * 1000) / 10 : 0,
        color: '#6b7280'
      }
    },
    categoryMatrix
  };
};

/**
 * 8. Geographic Area Analytics
 * Reuses Phase 12 location coordinates; aggregates coordinates into ~1km privacy-preserved clusters.
 * Citizen names, phone numbers, and exact residential coordinates are strictly stripped.
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getAnalyticsGeography = async (queryParams = {}) => {
  ensureDbConnected();
  const dateInfo = parseDateRange(queryParams);

  const matchStage = {
    'location.latitude': { $ne: null, $gte: -90, $lte: 90 },
    'location.longitude': { $ne: null, $gte: -180, $lte: 180 }
  };

  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const [geocodedClustersRaw, totalGeocoded, totalAll] = await Promise.all([
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          // Group by 2-decimal coordinates (~1.1 km neighborhood cluster)
          _id: {
            lat: { $round: ['$location.latitude', 2] },
            lng: { $round: ['$location.longitude', 2] }
          },
          count: { $sum: 1 },
          sampleAddress: { $first: '$location.address' },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          categories: { $push: '$category' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 25 }
    ]),
    Complaint.countDocuments(matchStage),
    Complaint.countDocuments(
      dateInfo.startDate && dateInfo.endDate
        ? { createdAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate } }
        : {}
    )
  ]);

  const clusters = geocodedClustersRaw.map((cluster, idx) => {
    // Determine top category in cluster
    const catCounts = {};
    for (const cat of cluster.categories || []) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    let topCat = 'Various';
    let maxCount = 0;
    for (const [c, cnt] of Object.entries(catCounts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        topCat = c;
      }
    }

    return {
      clusterId: `cluster-${idx + 1}`,
      approxLatitude: cluster._id.lat,
      approxLongitude: cluster._id.lng,
      sampleAddress: cluster.sampleAddress || 'Municipal Ward / Sector',
      complaintCount: cluster.count,
      pending: cluster.pending,
      inProgress: cluster.inProgress,
      resolved: cluster.resolved,
      topCategory: topCat,
      resolutionRate: calculateResolutionRate(cluster.resolved, cluster.count)
    };
  });

  return {
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    privacyNotice:
      'Coordinates are aggregated to 2 decimal places (~1.1 km precision) to protect citizen privacy.',
    totalComplaints: totalAll,
    geocodedComplaints: totalGeocoded,
    unlocatedComplaints: Math.max(0, totalAll - totalGeocoded),
    areaClusters: clusters
  };
};

/**
 * 9. Officer-Scoped Analytics Overview
 * Strictly bound to the authenticated field officer's own assigned tasks.
 * @param {string} officerId
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
export const getOfficerAnalyticsOverview = async (officerId, queryParams = {}) => {
  ensureDbConnected();

  if (!officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid officer identity is required');
    error.statusCode = 400;
    throw error;
  }

  const officerObjectId = new mongoose.Types.ObjectId(officerId);
  const dateInfo = parseDateRange(queryParams);

  const matchStage = { assignedOfficer: officerObjectId };
  if (dateInfo.startDate && dateInfo.endDate) {
    matchStage.createdAt = { $gte: dateInfo.startDate, $lte: dateInfo.endDate };
  }

  const [officerUser, statusCountsRaw, categoryCountsRaw, resolvedTicketsRaw] = await Promise.all([
    User.findById(officerObjectId).populate('department', 'name code').select('-password').lean(),
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]),
    Complaint.find({
      ...matchStage,
      status: 'Resolved'
    }).select('createdAt updatedAt status statusHistory')
  ]);

  let pending = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const item of statusCountsRaw) {
    if (item._id === 'Pending') pending = item.count;
    else if (item._id === 'In Progress') inProgress = item.count;
    else if (item._id === 'Resolved') resolved = item.count;
  }

  const totalAssigned = pending + inProgress + resolved;
  const resolutionRate = calculateResolutionRate(resolved, totalAssigned);

  // Compute officer's resolution durations
  const durations = [];
  for (const t of resolvedTicketsRaw) {
    const h = getComplaintResolutionHours(t);
    if (h !== null) durations.push(h);
  }

  const avgResolutionHours =
    durations.length > 0
      ? Math.round((durations.reduce((s, h) => s + h, 0) / durations.length) * 10) / 10
      : 0;

  const categories = categoryCountsRaw.map((c) => ({
    category: c._id || 'Other',
    count: c.count,
    percentage: totalAssigned > 0 ? Math.round((c.count / totalAssigned) * 1000) / 10 : 0
  }));

  return {
    officer: {
      id: officerUser?._id ? officerUser._id.toString() : officerId,
      name: officerUser?.name || 'Field Officer',
      email: officerUser?.email,
      departmentName: officerUser?.department?.name || 'Assigned Department',
      departmentCode: officerUser?.department?.code || 'N/A'
    },
    dateRange: {
      range: dateInfo.range,
      label: dateInfo.label,
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate
    },
    metrics: {
      totalAssigned,
      pending,
      inProgress,
      resolved,
      resolutionRate,
      avgResolutionHours,
      formattedAvgResolutionTime: formatDurationHours(avgResolutionHours),
      medianResolutionHours: calculateMedian(durations)
    },
    assignedCategories: categories
  };
};

/**
 * 10. Admin CSV Analytics Export with Formula Injection Defense
 * @param {object} queryParams
 * @returns {Promise<{ filename: string, csvContent: string }>}
 */
export const exportAnalyticsCsv = async (queryParams = {}) => {
  ensureDbConnected();
  const exportType = String(queryParams.type || 'overview').toLowerCase();
  const dateInfo = parseDateRange(queryParams);

  const timestamp = new Date().toISOString().split('T')[0];
  let filename = `civicfix-analytics-${exportType}-${timestamp}.csv`;
  let csvRows = [];

  if (exportType === 'categories') {
    const data = await getAnalyticsCategories(queryParams);
    csvRows.push(['Category', 'Total Complaints', 'Percentage', 'Pending', 'In Progress', 'Resolved', 'High/Critical Severity', 'Resolution Rate (%)']);
    for (const c of data.categories) {
      csvRows.push([
        c.category,
        c.count,
        `${c.percentage}%`,
        c.pending,
        c.inProgress,
        c.resolved,
        c.highCritical,
        `${c.resolutionRate}%`
      ]);
    }
  } else if (exportType === 'departments') {
    const data = await getAnalyticsDepartments(queryParams);
    csvRows.push(['Department Name', 'Code', 'Status', 'Total Assigned', 'Pending', 'In Progress', 'Resolved', 'Resolution Rate (%)', 'Avg Resolution Time (hrs)', 'Workload Share (%)']);
    for (const d of data.departments) {
      csvRows.push([
        d.departmentName,
        d.departmentCode,
        d.isActive ? 'Active' : 'Inactive',
        d.totalAssigned,
        d.pending,
        d.inProgress,
        d.resolved,
        `${d.resolutionRate}%`,
        d.avgResolutionHours,
        `${d.workloadShare}%`
      ]);
    }
    if (data.unassigned && data.unassigned.totalAssigned > 0) {
      csvRows.push([
        data.unassigned.departmentName,
        data.unassigned.departmentCode,
        'N/A',
        data.unassigned.totalAssigned,
        data.unassigned.pending,
        data.unassigned.inProgress,
        data.unassigned.resolved,
        `${data.unassigned.resolutionRate}%`,
        data.unassigned.avgResolutionHours,
        `${data.unassigned.workloadShare}%`
      ]);
    }
  } else if (exportType === 'trends') {
    const data = await getAnalyticsTrends(queryParams);
    csvRows.push(['Date', 'Submissions', 'Pending', 'In Progress', 'Resolved']);
    for (const t of data.trends) {
      csvRows.push([t.date, t.submitted, t.pending, t.inProgress, t.resolved]);
    }
  } else if (exportType === 'resolution') {
    const data = await getAnalyticsResolution(queryParams);
    csvRows.push(['Metric', 'Value']);
    csvRows.push(['Total Resolved Complaints', data.summary.totalResolved]);
    csvRows.push(['Average Resolution Time (hrs)', data.summary.avgHours]);
    csvRows.push(['Median Resolution Time (hrs)', data.summary.medianHours]);
    csvRows.push(['Fastest Resolution Time (hrs)', data.summary.minHours]);
    csvRows.push(['Longest Resolution Time (hrs)', data.summary.maxHours]);
    csvRows.push([]);
    csvRows.push(['Duration Bracket', 'Complaints Count', 'Percentage (%)']);
    csvRows.push(['< 24 Hours', data.durationBrackets.under24Hours.count, `${data.durationBrackets.under24Hours.percentage}%`]);
    csvRows.push(['1 - 3 Days', data.durationBrackets.oneToThreeDays.count, `${data.durationBrackets.oneToThreeDays.percentage}%`]);
    csvRows.push(['3 - 7 Days', data.durationBrackets.threeToSevenDays.count, `${data.durationBrackets.threeToSevenDays.percentage}%`]);
    csvRows.push(['> 7 Days', data.durationBrackets.overSevenDays.count, `${data.durationBrackets.overSevenDays.percentage}%`]);
  } else {
    // Default: 'overview'
    const data = await getAnalyticsOverview(queryParams);
    csvRows.push(['Metric', 'Value', 'Previous Period Baseline', 'Period-over-Period Change']);
    csvRows.push(['Date Range Filter', data.dateRange.label, 'Previous Equivalent Period', '']);
    csvRows.push(['Total Complaints', data.kpis.totalComplaints.value, data.kpis.totalComplaints.prevValue, data.kpis.totalComplaints.changePercent !== null ? `${data.kpis.totalComplaints.changePercent}%` : 'N/A']);
    csvRows.push(['Pending Triage', data.kpis.pendingComplaints.value, data.kpis.pendingComplaints.prevValue, data.kpis.pendingComplaints.changePercent !== null ? `${data.kpis.pendingComplaints.changePercent}%` : 'N/A']);
    csvRows.push(['In Progress', data.kpis.inProgressComplaints.value, data.kpis.inProgressComplaints.prevValue, data.kpis.inProgressComplaints.changePercent !== null ? `${data.kpis.inProgressComplaints.changePercent}%` : 'N/A']);
    csvRows.push(['Resolved Issues', data.kpis.resolvedComplaints.value, data.kpis.resolvedComplaints.prevValue, data.kpis.resolvedComplaints.changePercent !== null ? `${data.kpis.resolvedComplaints.changePercent}%` : 'N/A']);
    csvRows.push(['Resolution Rate (%)', `${data.kpis.resolutionRate.value}%`, `${data.kpis.resolutionRate.prevValue}%`, data.kpis.resolutionRate.changePercent !== null ? `${data.kpis.resolutionRate.changePercent}%` : 'N/A']);
    csvRows.push(['Avg Resolution Time (hrs)', data.kpis.avgResolutionTime.value, 'N/A', '']);
    csvRows.push(['Median Resolution Time (hrs)', data.kpis.avgResolutionTime.medianValue, 'N/A', '']);
    csvRows.push(['High/Critical Severity', data.kpis.highCriticalSeverity.value, data.kpis.highCriticalSeverity.prevValue, data.kpis.highCriticalSeverity.changePercent !== null ? `${data.kpis.highCriticalSeverity.changePercent}%` : 'N/A']);
    csvRows.push(['Potential Duplicates', data.kpis.potentialDuplicates.value, data.kpis.potentialDuplicates.prevValue, data.kpis.potentialDuplicates.changePercent !== null ? `${data.kpis.potentialDuplicates.changePercent}%` : 'N/A']);
  }

  // Convert array of rows into sanitized CSV lines
  const sanitizedLines = csvRows.map((row) =>
    row.map((cell) => sanitizeCsvValue(cell)).join(',')
  );

  return {
    filename,
    csvContent: sanitizedLines.join('\r\n')
  };
};
