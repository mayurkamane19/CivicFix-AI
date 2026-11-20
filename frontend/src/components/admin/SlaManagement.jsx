import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminSlaOverviewApi,
  getAdminSlaConfigApi,
  updateAdminSlaConfigApi,
  getAdminOverdueComplaintsApi,
  getAdminEscalationsApi,
  manualEscalateComplaintApi,
  triggerSlaEvaluationApi
} from '../../services/api';

export const SlaManagement = ({ onViewDetails }) => {
  // Navigation Sub-tab: 'overview' | 'config' | 'escalations'
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Overview Metrics State
  const [metrics, setMetrics] = useState({
    totalActive: 0,
    withinSla: 0,
    approaching: 0,
    overdue: 0,
    escalated: 0,
    complianceRate: 100,
    resolvedWithin: 0,
    resolvedAfter: 0
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Overdue Queue State
  const [overdueComplaints, setOverdueComplaints] = useState([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overduePage, setOverduePage] = useState(1);
  const [overduePagination, setOverduePagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [deptFilter, setDeptFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchId, setSearchId] = useState('');

  // SLA Configurations State
  const [slaConfigs, setSlaConfigs] = useState({ global: null, departments: [] });
  const [configLoading, setConfigLoading] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState('global');
  const [editingTargets, setEditingTargets] = useState({ Critical: 4, High: 24, Medium: 72, Low: 120 });
  const [editingThresholds, setEditingThresholds] = useState({
    level1WarningPercent: 75,
    level2OverduePercent: 100,
    level3CriticalPercent: 150
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(null);
  const [configError, setConfigError] = useState(null);

  // Escalation Audit Logs State
  const [escalationLogs, setEscalationLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [logLevelFilter, setLogLevelFilter] = useState('all');

  // Manual Escalation Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualTargetId, setManualTargetId] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState(null);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState(null);

  // 1. Fetch SLA Metrics
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    const res = await getAdminSlaOverviewApi();
    setMetricsLoading(false);
    if (res.success && res.data) {
      setMetrics(res.data);
    }
  }, []);

  // 2. Fetch Overdue & Approaching Queue
  const fetchOverdue = useCallback(async () => {
    setOverdueLoading(true);
    const res = await getAdminOverdueComplaintsApi({
      department: deptFilter,
      priority: priorityFilter,
      search: searchId,
      page: overduePage,
      limit: 10
    });
    setOverdueLoading(false);
    if (res.success) {
      setOverdueComplaints(res.data || []);
      if (res.pagination) setOverduePagination(res.pagination);
    }
  }, [deptFilter, priorityFilter, searchId, overduePage]);

  // 3. Fetch Configurations
  const fetchConfigs = useCallback(async () => {
    setConfigLoading(true);
    const res = await getAdminSlaConfigApi();
    setConfigLoading(false);
    if (res.success && res.data) {
      setSlaConfigs(res.data);
      if (res.data.global?.priorityTargets) {
        setEditingTargets(res.data.global.priorityTargets);
      }
      if (res.data.global?.escalationThresholds) {
        setEditingThresholds(res.data.global.escalationThresholds);
      }
    }
  }, []);

  // 4. Fetch Escalation Logs
  const fetchEscalations = useCallback(async () => {
    setLogsLoading(true);
    const res = await getAdminEscalationsApi({
      level: logLevelFilter,
      page: logsPage,
      limit: 15
    });
    setLogsLoading(false);
    if (res.success) {
      setEscalationLogs(res.data || []);
      if (res.pagination) setLogsPagination(res.pagination);
    }
  }, [logLevelFilter, logsPage]);

  useEffect(() => {
    fetchMetrics();
    fetchOverdue();
  }, [fetchMetrics, fetchOverdue]);

  useEffect(() => {
    if (activeSubTab === 'config') fetchConfigs();
    if (activeSubTab === 'escalations') fetchEscalations();
  }, [activeSubTab, fetchConfigs, fetchEscalations]);

  // Handle Department Switch in Config Tab
  const handleConfigDeptChange = (deptId) => {
    setSelectedDeptId(deptId);
    setConfigSuccess(null);
    setConfigError(null);

    if (deptId === 'global') {
      if (slaConfigs.global) {
        setEditingTargets(slaConfigs.global.priorityTargets);
        setEditingThresholds(slaConfigs.global.escalationThresholds);
      }
    } else {
      const custom = (slaConfigs.departments || []).find((d) => d.department === deptId);
      if (custom) {
        setEditingTargets(custom.priorityTargets);
        setEditingThresholds(custom.escalationThresholds);
      } else if (slaConfigs.global) {
        setEditingTargets(slaConfigs.global.priorityTargets);
        setEditingThresholds(slaConfigs.global.escalationThresholds);
      }
    }
  };

  // Save Configuration Handler
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(null);
    setConfigError(null);

    const payload = {
      departmentId: selectedDeptId === 'global' ? null : selectedDeptId,
      priorityTargets: editingTargets,
      escalationThresholds: editingThresholds,
      isEnabled: true
    };

    const res = await updateAdminSlaConfigApi(payload);
    setSavingConfig(false);

    if (res.success) {
      setConfigSuccess('SLA policy updated successfully.');
      fetchConfigs();
    } else {
      setConfigError(res.error || 'Failed to save configuration');
    }
  };

  // Trigger Immediate SLA Evaluation
  const handleTriggerEvaluation = async () => {
    setFeedback({ type: 'info', message: 'Running immediate SLA monitoring evaluation...' });
    const res = await triggerSlaEvaluationApi();
    if (res.success) {
      const s = res.data?.summary || res.data;
      setFeedback({
        type: 'success',
        message: `SLA Evaluation Complete: ${s?.evaluatedCount || 0} evaluated, ${s?.overdueCount || 0} overdue, ${s?.escalatedLevel1 || 0} L1, ${s?.escalatedLevel2 || 0} L2, ${s?.escalatedLevel3 || 0} L3 escalations triggered.`
      });
      fetchMetrics();
      fetchOverdue();
    } else {
      setFeedback({ type: 'error', message: res.error || 'SLA evaluation failed' });
    }
  };

  // Manual Escalation Submit
  const handleManualEscalate = async (e) => {
    e.preventDefault();
    if (!manualTargetId.trim()) {
      setManualError('Complaint ticket ID is required');
      return;
    }
    if (!manualReason.trim() || manualReason.trim().length < 5) {
      setManualError('A mandatory justification reason (at least 5 characters) is required');
      return;
    }

    setManualSubmitting(true);
    setManualError(null);

    const res = await manualEscalateComplaintApi(manualTargetId.trim(), {
      reason: manualReason.trim()
    });
    setManualSubmitting(false);

    if (res.success) {
      setManualModalOpen(false);
      setManualTargetId('');
      setManualReason('');
      setFeedback({
        type: 'success',
        message: `Complaint #${manualTargetId} successfully escalated manually.`
      });
      fetchMetrics();
      fetchOverdue();
    } else {
      setManualError(res.error || 'Failed to manually escalate complaint');
    }
  };

  return (
    <div className="sla-management-container" role="region" aria-label="SLA and Escalation System">
      {/* Header */}
      <div className="sla-header">
        <div>
          <h2 className="sla-title">SLA &amp; Automated Escalation System</h2>
          <p className="sla-subtitle">
            Monitor resolution deadlines, configure department targets, and inspect multi-level escalations.
          </p>
        </div>
        <div className="sla-actions">
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={handleTriggerEvaluation}
            title="Trigger an immediate evaluation pass over all active complaints"
          >
            ⚡ Run SLA Check
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => setManualModalOpen(true)}
            title="Manually elevate an urgent incident"
          >
            ⚠️ Manual Escalation
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`alert-box alert-${feedback.type}`} style={{ marginBottom: '1.25rem' }}>
          <span>{feedback.type === 'success' ? '✓' : '⚠️'} {feedback.message}</span>
          <button type="button" className="banner-close-btn" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="sla-kpi-grid">
        <div className="admin-card sla-kpi-card">
          <span className="sla-kpi-label">Active SLA Tickets</span>
          <span className="sla-kpi-val">{metricsLoading ? '...' : metrics.totalActive}</span>
          <span className="sla-kpi-sub">{metrics.withinSla} on schedule</span>
        </div>

        <div className="admin-card sla-kpi-card">
          <span className="sla-kpi-label">Approaching Deadline</span>
          <span className="sla-kpi-val" style={{ color: '#d97706' }}>
            {metricsLoading ? '...' : metrics.approaching}
          </span>
          <span className="sla-kpi-sub">Within warning threshold</span>
        </div>

        <div className="admin-card sla-kpi-card">
          <span className="sla-kpi-label">Overdue Tickets</span>
          <span className="sla-kpi-val" style={{ color: '#dc2626' }}>
            {metricsLoading ? '...' : metrics.overdue}
          </span>
          <span className="sla-kpi-sub">Breached SLA deadline</span>
        </div>

        <div className="admin-card sla-kpi-card">
          <span className="sla-kpi-label">Escalated Tickets</span>
          <span className="sla-kpi-val" style={{ color: '#b91c1c' }}>
            {metricsLoading ? '...' : metrics.escalated}
          </span>
          <span className="sla-kpi-sub">Levels 1, 2, or 3</span>
        </div>

        <div className="admin-card sla-kpi-card">
          <span className="sla-kpi-label">SLA Compliance Rate</span>
          <span className="sla-kpi-val" style={{ color: '#16a34a' }}>
            {metricsLoading ? '...' : `${metrics.complianceRate}%`}
          </span>
          <span className="sla-kpi-sub">Historical resolution compliance</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="sla-subtabs-nav">
        <button
          type="button"
          className={`sla-subtab-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          🚨 Overdue &amp; Approaching Queue ({overduePagination.total})
        </button>
        <button
          type="button"
          className={`sla-subtab-btn ${activeSubTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('config')}
        >
          ⚙️ Department SLA Targets
        </button>
        <button
          type="button"
          className={`sla-subtab-btn ${activeSubTab === 'escalations' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('escalations')}
        >
          📜 Escalation Audit Logs
        </button>
      </div>

      {/* SUBTAB 1: OVERDUE QUEUE */}
      {activeSubTab === 'overview' && (
        <div className="admin-card sla-table-card">
          {/* Filters */}
          <div className="sla-filters-row">
            <div className="filter-group">
              <label>Search Ticket ID</label>
              <input
                type="text"
                className="filter-input"
                placeholder="CFX-202611..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Priority</label>
              <select
                className="filter-select"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setOverduePage(1);
                }}
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => {
                setSearchId('');
                setPriorityFilter('all');
                setDeptFilter('all');
                setOverduePage(1);
              }}
              style={{ alignSelf: 'flex-end' }}
            >
              Reset Filters
            </button>
          </div>

          {/* Table */}
          {overdueLoading ? (
            <div className="sla-loading-state">
              <span>Checking SLA status queue...</span>
            </div>
          ) : overdueComplaints.length === 0 ? (
            <div className="sla-empty-state">
              <span style={{ fontSize: '2rem' }}>🎉</span>
              <h4>No Overdue or Approaching Incidents</h4>
              <p>All active complaints are currently within their standard resolution targets.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Issue Title</th>
                    <th>Priority</th>
                    <th>Department</th>
                    <th>SLA Status</th>
                    <th>Overdue / Remaining</th>
                    <th>Escalation Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueComplaints.map((c) => (
                    <tr key={c.complaintId}>
                      <td><span className="complaint-id-tag">{c.complaintId}</span></td>
                      <td>
                        <strong>{c.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.category}</div>
                      </td>
                      <td>
                        <span className={`priority-badge badge-${(c.sla?.priority || 'Medium').toLowerCase()}`}>
                          {c.sla?.priority || 'Medium'}
                        </span>
                      </td>
                      <td>{c.assignedDepartmentName || 'Unassigned'}</td>
                      <td>
                        <span className={`sla-status-pill pill-${(c.sla?.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {c.sla?.status || 'Within SLA'}
                        </span>
                      </td>
                      <td>
                        {c.sla?.status === 'Overdue' ? (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            +{c.sla?.overdueHours}h overdue
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>
                            {c.sla?.remainingHours}h remaining
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`esc-level-badge level-${c.sla?.currentEscalationLevel || 0}`}>
                          Level {c.sla?.currentEscalationLevel || 0}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {onViewDetails && (
                            <button
                              type="button"
                              className="btn btn-outline btn-small"
                              onClick={() => onViewDetails(c)}
                            >
                              Inspect
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => {
                              setManualTargetId(c.complaintId);
                              setManualModalOpen(true);
                            }}
                          >
                            Escalate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: CONFIGURATION EDITOR */}
      {activeSubTab === 'config' && (
        <div className="admin-card sla-config-card">
          <div className="config-header-row">
            <div>
              <h3>SLA Target Resolution Configurations</h3>
              <p>Configure expected hours to resolve civic complaints by priority level.</p>
            </div>
            <div className="dept-select-wrapper">
              <label>Select Department:</label>
              <select
                className="filter-select"
                value={selectedDeptId}
                onChange={(e) => handleConfigDeptChange(e.target.value)}
              >
                <option value="global">Global Default (All Departments Fallback)</option>
                {(slaConfigs.departments || []).map((d) => (
                  <option key={d.department} value={d.department}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {configSuccess && <div className="alert-box alert-success">{configSuccess}</div>}
          {configError && <div className="alert-box alert-error">{configError}</div>}

          <form onSubmit={handleSaveConfig} className="sla-config-form">
            <h4 style={{ margin: '1rem 0 0.5rem 0' }}>Resolution Deadline Targets (Hours)</h4>
            <div className="targets-grid">
              <div className="target-input-card">
                <label>🔥 Critical Priority</label>
                <input
                  type="number"
                  min="1"
                  className="filter-input"
                  value={editingTargets.Critical}
                  onChange={(e) => setEditingTargets({ ...editingTargets, Critical: e.target.value })}
                  required
                />
                <span className="input-hint">Target resolution window in hours</span>
              </div>

              <div className="target-input-card">
                <label>⚡ High Priority</label>
                <input
                  type="number"
                  min="1"
                  className="filter-input"
                  value={editingTargets.High}
                  onChange={(e) => setEditingTargets({ ...editingTargets, High: e.target.value })}
                  required
                />
                <span className="input-hint">Target resolution window in hours</span>
              </div>

              <div className="target-input-card">
                <label>📋 Medium Priority</label>
                <input
                  type="number"
                  min="1"
                  className="filter-input"
                  value={editingTargets.Medium}
                  onChange={(e) => setEditingTargets({ ...editingTargets, Medium: e.target.value })}
                  required
                />
                <span className="input-hint">Target resolution window in hours</span>
              </div>

              <div className="target-input-card">
                <label>🌱 Low Priority</label>
                <input
                  type="number"
                  min="1"
                  className="filter-input"
                  value={editingTargets.Low}
                  onChange={(e) => setEditingTargets({ ...editingTargets, Low: e.target.value })}
                  required
                />
                <span className="input-hint">Target resolution window in hours</span>
              </div>
            </div>

            <h4 style={{ margin: '1.5rem 0 0.5rem 0' }}>Automated Escalation Thresholds</h4>
            <div className="targets-grid">
              <div className="target-input-card">
                <label>Level 1: Warning Trigger (% of deadline elapsed)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  className="filter-input"
                  value={editingThresholds.level1WarningPercent}
                  onChange={(e) => setEditingThresholds({ ...editingThresholds, level1WarningPercent: e.target.value })}
                  required
                />
                <span className="input-hint">Default: 75% elapsed (triggers supervisor warning)</span>
              </div>

              <div className="target-input-card">
                <label>Level 2: Breach Trigger (% of deadline elapsed)</label>
                <input
                  type="number"
                  min="100"
                  className="filter-input"
                  value={editingThresholds.level2OverduePercent}
                  onChange={(e) => setEditingThresholds({ ...editingThresholds, level2OverduePercent: e.target.value })}
                  required
                />
                <span className="input-hint">Default: 100% elapsed (escalates to department head)</span>
              </div>

              <div className="target-input-card">
                <label>Level 3: Critical Breach (% of deadline elapsed)</label>
                <input
                  type="number"
                  min="110"
                  className="filter-input"
                  value={editingThresholds.level3CriticalPercent}
                  onChange={(e) => setEditingThresholds({ ...editingThresholds, level3CriticalPercent: e.target.value })}
                  required
                />
                <span className="input-hint">Default: 150% elapsed (escalates to municipal admin)</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={savingConfig}>
                {savingConfig ? 'Saving SLA Settings...' : 'Save SLA Targets'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 3: ESCALATIONS AUDIT TRAIL */}
      {activeSubTab === 'escalations' && (
        <div className="admin-card sla-table-card">
          <div className="sla-filters-row">
            <div className="filter-group">
              <label>Filter by Escalation Level</label>
              <select
                className="filter-select"
                value={logLevelFilter}
                onChange={(e) => {
                  setLogLevelFilter(e.target.value);
                  setLogsPage(1);
                }}
              >
                <option value="all">All Escalation Levels</option>
                <option value="1">Level 1 (Supervisor Warning)</option>
                <option value="2">Level 2 (Department Head Breach)</option>
                <option value="3">Level 3 (Municipal Admin Critical)</option>
              </select>
            </div>
          </div>

          {logsLoading ? (
            <div className="sla-loading-state">
              <span>Loading escalation audit records...</span>
            </div>
          ) : escalationLogs.length === 0 ? (
            <div className="sla-empty-state">
              <span>📜</span>
              <h4>No Escalation Events Recorded</h4>
              <p>Escalations will appear here as incidents breach configured threshold criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Complaint ID</th>
                    <th>Level Transition</th>
                    <th>Trigger Type</th>
                    <th>Reason / Justification</th>
                    <th>Department</th>
                    <th>Escalated By</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {escalationLogs.map((log) => (
                    <tr key={log.id || log.escalatedAt}>
                      <td><span className="complaint-id-tag">{log.complaintId}</span></td>
                      <td>
                        <span className={`esc-level-badge level-${log.newLevel}`}>
                          L{log.previousLevel} &rarr; Level {log.newLevel}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {log.triggerType === 'MANUAL_ADMIN' ? '👤 Manual' : '🤖 Automated'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#334155' }}>
                          {log.triggerReason}
                        </span>
                      </td>
                      <td>{log.departmentName}</td>
                      <td>{log.escalatedByName}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(log.escalatedAt).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Escalation Modal */}
      {manualModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>⚠️ Manual Complaint Escalation</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setManualModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualEscalate} className="modal-body">
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Elevate complaint priority and dispatch immediate supervisory notices. A mandatory audit justification is required.
              </p>

              {manualError && <div className="alert-box alert-error">{manualError}</div>}

              <div style={{ marginBottom: '1rem' }}>
                <label className="filter-field-label">Complaint Ticket ID *</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="e.g. CFX-20261119-7001"
                  value={manualTargetId}
                  onChange={(e) => setManualTargetId(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="filter-field-label">Mandatory Justification / Reason *</label>
                <textarea
                  className="feedback-textarea"
                  rows="3"
                  placeholder="Explain why this complaint requires immediate elevated administrative handling..."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setManualModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={manualSubmitting}
                >
                  {manualSubmitting ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaManagement;
