import React, { useState, useEffect, useCallback } from 'react';
import DashboardStatsCards from '../components/admin/DashboardStatsCards';
import ComplaintFilters from '../components/admin/ComplaintFilters';
import ComplaintManagementTable from '../components/admin/ComplaintManagementTable';
import AdminComplaintDetails from '../components/admin/AdminComplaintDetails';
import ComplaintStatusUpdate from '../components/admin/ComplaintStatusUpdate';
import ComplaintAssignmentModal from '../components/admin/ComplaintAssignmentModal';
import DepartmentManagement from '../components/admin/DepartmentManagement';
import OfficerManagement from '../components/admin/OfficerManagement';
import NotificationManagement from '../components/admin/NotificationManagement';
import FeedbackManagement from '../components/admin/FeedbackManagement';
import SlaManagement from '../components/admin/SlaManagement';
import AdminComplaintMap from '../components/map/AdminComplaintMap';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import NotificationCenter from '../components/notifications/NotificationCenter';
import AdminResolutionReviewTab from '../components/resolution/AdminResolutionReviewTab';
import WardManagement from '../components/ward/WardManagement';
import MunicipalOverviewTab from '../components/ward/MunicipalOverviewTab';
import ComplaintTransferModal from '../components/ward/ComplaintTransferModal';
import {
  getAdminStatsApi,
  getAdminComplaintsApi,
  getAdminComplaintDetailsApi,
  getAdminDepartmentsApi,
  getAdminOfficersApi
} from '../services/api';

/**
 * AdminDashboard Page
 * Main municipal operations command center for complaint triage, AI review, and resolution tracking
 */
export const AdminDashboard = ({ currentUser, onNavigateHome, onNavigateLogin }) => {
  // Access Guard: Ensure user is logged in and possesses 'admin' role
  const isAdmin = currentUser && currentUser.role === 'admin';

  // Navigation Tabs: 'overview' | 'complaints' | 'departments' | 'officers'
  const [activeTab, setActiveTab] = useState('overview');

  // Stats State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Departments & Officers List for Filters
  const [departmentsList, setDepartmentsList] = useState([]);
  const [officersList, setOfficersList] = useState([]);

  // Complaints Registry State
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);

  // Modals State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [complaintToTransfer, setComplaintToTransfer] = useState(null);

  // Notification / Feedback State
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Load active departments and officers for filters
  useEffect(() => {
    if (!isAdmin) return;
    const loadDeptsAndOfficers = async () => {
      const [deptRes, officerRes] = await Promise.all([
        getAdminDepartmentsApi(),
        getAdminOfficersApi()
      ]);
      if (deptRes.success) {
        setDepartmentsList(deptRes.data);
      }
      if (officerRes.success) {
        setOfficersList(officerRes.data);
      }
    };
    loadDeptsAndOfficers();
  }, [isAdmin]);

  // 1. Fetch Dashboard Statistics
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    const result = await getAdminStatsApi();
    setStatsLoading(false);

    if (result.success && result.data) {
      setStats(result.data);
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'Failed to fetch admin dashboard statistics'
      });
    }
  }, [isAdmin]);

  // 2. Fetch Complaints Registry
  const fetchComplaints = useCallback(async () => {
    if (!isAdmin) return;
    setComplaintsLoading(true);

    const result = await getAdminComplaintsApi({
      search,
      category,
      status,
      severity,
      department: departmentFilter,
      sortBy,
      page: currentPage,
      limit: pageLimit
    });

    setComplaintsLoading(false);

    if (result.success) {
      setComplaints(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'Failed to fetch complaints list'
      });
    }
  }, [isAdmin, search, category, status, severity, departmentFilter, sortBy, currentPage, pageLimit]);

  // Initial Load on mount
  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchComplaints();
    }
  }, [isAdmin, fetchStats, fetchComplaints]);

  // Filter Reset Handler
  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setStatus('all');
    setSeverity('all');
    setDepartmentFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Card Quick-Filter Handler
  const handleCardFilter = (filterType, filterValue) => {
    if (filterType === 'status') {
      setStatus(filterValue);
      setSeverity('all');
    } else if (filterType === 'severity') {
      setSeverity(filterValue);
      setStatus('all');
    }
    setActiveTab('complaints');
    setCurrentPage(1);
  };

  // View Details Handler (handles complaint object or ID from map)
  const handleViewDetails = async (complaintSummaryOrId) => {
    const compId = typeof complaintSummaryOrId === 'string'
      ? complaintSummaryOrId
      : (complaintSummaryOrId?.complaintId || complaintSummaryOrId?._id);

    if (typeof complaintSummaryOrId === 'object' && complaintSummaryOrId) {
      setSelectedComplaint(complaintSummaryOrId);
    }
    setDetailsModalOpen(true);

    if (compId) {
      // Fetch full fresh details from backend
      const fullResult = await getAdminComplaintDetailsApi(compId);
      if (fullResult.success && fullResult.data) {
        setSelectedComplaint(fullResult.data);
      }
    }
  };

  // Open Status Update Modal
  const handleOpenStatusModal = (complaint) => {
    setSelectedComplaint(complaint);
    setStatusModalOpen(true);
  };

  // Open Assignment Modal
  const handleOpenAssignModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAssignModalOpen(true);
  };

  // Open Inter-Ward Transfer Modal
  const handleOpenTransferModal = (complaint) => {
    setComplaintToTransfer(complaint);
    setTransferModalOpen(true);
  };

  // Transfer Success Callback
  const handleTransferSuccess = (transferResult) => {
    setFeedback({
      type: 'success',
      message: `Jurisdiction transfer confirmed: Ticket ${transferResult.complaintId} transferred to ${transferResult.destinationWard.name}. SLA deadline preserved.`
    });
    fetchComplaints();
    fetchStats();
    setTimeout(() => setFeedback(null), 5000);
  };

  // Assignment Success Callback
  const handleAssignmentSuccess = (updatedComplaint) => {
    setFeedback({
      type: 'success',
      message: `Work order dispatched: Ticket ${updatedComplaint.complaintId} assigned to ${updatedComplaint.assignedDepartmentName || 'Department'}.`
    });

    setComplaints((prev) =>
      prev.map((c) =>
        c.complaintId === updatedComplaint.complaintId ? updatedComplaint : c
      )
    );

    if (selectedComplaint?.complaintId === updatedComplaint.complaintId) {
      setSelectedComplaint(updatedComplaint);
    }

    fetchStats();
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Status Updated Success Callback
  const handleStatusUpdated = (updatedComplaint) => {
    setFeedback({
      type: 'success',
      message: `Ticket ${updatedComplaint.complaintId} status successfully updated to '${updatedComplaint.status}'.`
    });

    // Update in-memory complaint list
    setComplaints((prev) =>
      prev.map((c) =>
        c.complaintId === updatedComplaint.complaintId ? updatedComplaint : c
      )
    );

    if (selectedComplaint?.complaintId === updatedComplaint.complaintId) {
      setSelectedComplaint(updatedComplaint);
    }

    // Refresh overall dashboard stats
    fetchStats();

    // Auto-dismiss alert after 5 seconds
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Refresh All Data
  const handleRefreshAll = () => {
    fetchStats();
    fetchComplaints();
    setFeedback({
      type: 'success',
      message: 'Dashboard and complaints registry refreshed.'
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Access Denied Screen for non-admin users
  if (!isAdmin) {
    return (
      <div className="admin-access-denied-page">
        <div className="access-denied-card">
          <div className="denied-icon">🛡️</div>
          <h2>Administrator Access Required</h2>
          <p>
            You must be logged in with a certified <strong>Municipal Administrator</strong> account to access the CivicFix operations dashboard.
          </p>
          <div className="denied-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNavigateLogin}
            >
              Sign In as Administrator
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNavigateHome}
            >
              Return to Citizen Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      {/* Admin Top Header */}
      <header className="admin-header">
        <div className="admin-header-container">
          <div className="admin-header-main">
            <div className="admin-brand-group">
              <span className="admin-badge-pill">MUNICIPAL OPERATIONS</span>
              <h1 className="admin-dashboard-title">CivicFix AI Command Center</h1>
              <p className="admin-dashboard-subtitle">
                Public hazard triage, automated AI analysis, and municipal resolution pipeline.
              </p>
            </div>

            <div className="admin-header-actions">
              <NotificationCenter currentUser={currentUser} />
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={handleRefreshAll}
                disabled={statsLoading || complaintsLoading}
                title="Refresh dashboard metrics and complaints"
              >
                🔄 Refresh Data
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={onNavigateHome}
              >
                Public Home
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className={`admin-feedback-banner feedback-${feedback.type}`}>
              <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{feedback.message}</span>
              <button
                type="button"
                className="banner-close-btn"
                onClick={() => setFeedback(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* Tabs Navigation */}
          <nav className="admin-tabs-nav">
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Metrics &amp; Overview
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📈 Advanced Analytics
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'complaints' ? 'active' : ''}`}
              onClick={() => setActiveTab('complaints')}
            >
              📋 Complaint Registry ({pagination.total})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
              onClick={() => setActiveTab('departments')}
            >
              🏢 Departments
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'officers' ? 'active' : ''}`}
              onClick={() => setActiveTab('officers')}
            >
              👷 Field Officers
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              🗺️ GIS Map
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              📬 Notifications
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => setActiveTab('feedback')}
            >
              ⭐ Citizen Feedback
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'sla' ? 'active' : ''}`}
              onClick={() => setActiveTab('sla')}
            >
              ⏱️ SLA &amp; Escalations
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'wards' ? 'active' : ''}`}
              onClick={() => setActiveTab('wards')}
            >
              🏛️ Multi-Ward Command
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === 'resolutions' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolutions')}
            >
              📷 Resolution Verification
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="admin-main-container">
        {/* TAB 1: METRICS & OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="admin-overview-section">
            {/* KPI Cards */}
            <DashboardStatsCards
              stats={stats}
              loading={statsLoading}
              onSelectFilter={handleCardFilter}
            />

            {/* Middle Grid: Category Breakdown & Recent Submissions */}
            <div className="overview-two-col-grid">
              {/* Category Breakdown Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Incidents by Municipal Category</h3>
                  <span className="admin-card-subtitle">Active distribution</span>
                </div>
                <div className="category-bars-list">
                  {stats?.categoriesBreakdown && Object.keys(stats.categoriesBreakdown).length > 0 ? (
                    Object.entries(stats.categoriesBreakdown).map(([catName, count]) => {
                      const total = stats.totalComplaints || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={catName} className="category-bar-item">
                          <div className="category-bar-label">
                            <span className="cat-name">{catName}</span>
                            <span className="cat-count">
                              <strong>{count}</strong> ({pct}%)
                            </span>
                          </div>
                          <div className="category-progress-track">
                            <div
                              className="category-progress-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-subtext">No category data registered yet.</p>
                  )}
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Recent Submissions</h3>
                  <button
                    type="button"
                    className="link-action-btn"
                    onClick={() => setActiveTab('complaints')}
                  >
                    View All →
                  </button>
                </div>
                <div className="recent-complaints-list">
                  {stats?.recentComplaints && stats.recentComplaints.length > 0 ? (
                    stats.recentComplaints.map((rc) => (
                      <div
                        key={rc.complaintId}
                        className="recent-complaint-row"
                        onClick={() => handleViewDetails(rc)}
                        title="Click to view details"
                      >
                        <div className="recent-row-left">
                          <span className="ticket-code-small">{rc.complaintId}</span>
                          <span className="recent-title">{rc.title}</span>
                          <span className="recent-cat">{rc.category}</span>
                        </div>
                        <div className="recent-row-right">
                          <span className={`status-badge-mini ${rc.status === 'Resolved' ? 'badge-resolved' : rc.status === 'In Progress' ? 'badge-in-progress' : 'badge-pending'}`}>
                            {rc.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-subtext">No recent submissions recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ADVANCED MUNICIPAL ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="admin-analytics-section">
            <AnalyticsDashboard />
          </div>
        )}

        {/* TAB 2: COMPLAINT REGISTRY & MANAGEMENT */}
        {activeTab === 'complaints' && (
          <div className="admin-complaints-section">
            {/* Filters */}
            <ComplaintFilters
              search={search}
              onSearchChange={(val) => {
                setSearch(val);
                setCurrentPage(1);
              }}
              category={category}
              onCategoryChange={(val) => {
                setCategory(val);
                setCurrentPage(1);
              }}
              status={status}
              onStatusChange={(val) => {
                setStatus(val);
                setCurrentPage(1);
              }}
              severity={severity}
              onSeverityChange={(val) => {
                setSeverity(val);
                setCurrentPage(1);
              }}
              department={departmentFilter}
              onDepartmentChange={(val) => {
                setDepartmentFilter(val);
                setCurrentPage(1);
              }}
              departments={departmentsList}
              sortBy={sortBy}
              onSortByChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
              onResetFilters={handleResetFilters}
              totalResults={pagination.total}
            />

            {/* Complaints Management Table */}
            <ComplaintManagementTable
              complaints={complaints}
              loading={complaintsLoading}
              pagination={pagination}
              onViewDetails={handleViewDetails}
              onOpenStatusModal={handleOpenStatusModal}
              onOpenAssignModal={handleOpenAssignModal}
              onOpenTransferModal={handleOpenTransferModal}
              onPageChange={(p) => setCurrentPage(p)}
              onLimitChange={(lim) => {
                setPageLimit(lim);
                setCurrentPage(1);
              }}
            />
          </div>
        )}

        {/* TAB 3: DEPARTMENTS MANAGEMENT */}
        {activeTab === 'departments' && (
          <div className="admin-departments-section">
            <DepartmentManagement />
          </div>
        )}

        {/* TAB 4: FIELD OFFICERS MANAGEMENT */}
        {activeTab === 'officers' && (
          <div className="admin-officers-section">
            <OfficerManagement />
          </div>
        )}

        {/* TAB 5: GIS MAP VISUALIZATION */}
        {activeTab === 'map' && (
          <div className="admin-map-section">
            <AdminComplaintMap
              departments={departmentsList}
              officers={officersList}
              onViewDetails={handleViewDetails}
            />
          </div>
        )}

        {/* TAB 6: EMAIL NOTIFICATIONS OUTBOX */}
        {activeTab === 'notifications' && (
          <div className="admin-notifications-section">
            <NotificationManagement />
          </div>
        )}

        {/* TAB 7: CITIZEN FEEDBACK & RESOLUTION RATINGS */}
        {activeTab === 'feedback' && (
          <div className="admin-feedback-section">
            <FeedbackManagement />
          </div>
        )}

        {/* TAB 8: SLA & ESCALATION MANAGEMENT */}
        {activeTab === 'sla' && (
          <div className="admin-sla-section">
            <SlaManagement onViewDetails={handleViewDetails} />
          </div>
        )}

        {/* TAB 9: RESOLUTION VERIFICATION & DISPUTES */}
        {activeTab === 'resolutions' && (
          <div className="admin-resolutions-section">
            <AdminResolutionReviewTab />
          </div>
        )}

        {/* TAB 10: MULTI-WARD MUNICIPAL GOVERNANCE (PHASE 22) */}
        {activeTab === 'wards' && (
          <div className="admin-wards-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <MunicipalOverviewTab onSelectWard={(wardId) => console.log('Selected ward:', wardId)} />
            <WardManagement onSelectWardForDetails={(wardId) => console.log('Selected ward for details:', wardId)} />
          </div>
        )}
      </main>

      {/* Modals */}
      <AdminComplaintDetails
        complaint={selectedComplaint}
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedComplaint(null);
        }}
        onOpenStatusModal={(c) => {
          setDetailsModalOpen(false);
          handleOpenStatusModal(c);
        }}
        onOpenAssignModal={(c) => {
          setDetailsModalOpen(false);
          handleOpenAssignModal(c);
        }}
        onOpenTransferModal={(c) => {
          setDetailsModalOpen(false);
          handleOpenTransferModal(c);
        }}
      />

      <ComplaintStatusUpdate
        complaint={selectedComplaint}
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
        }}
        onStatusUpdated={handleStatusUpdated}
      />

      <ComplaintAssignmentModal
        complaint={selectedComplaint}
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
        }}
        onAssignmentSuccess={handleAssignmentSuccess}
      />

      {transferModalOpen && complaintToTransfer && (
        <ComplaintTransferModal
          complaint={complaintToTransfer}
          isOpen={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false);
            setComplaintToTransfer(null);
          }}
          onTransferSuccess={handleTransferSuccess}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
