import React, { useState } from 'react';
import MunicipalOverviewTab from '../components/ward/MunicipalOverviewTab';
import WardManagement from '../components/ward/WardManagement';
import MunicipalGISMap from '../components/ward/MunicipalGISMap';
import WardAnalyticsTab from '../components/ward/WardAnalyticsTab';
import ComplaintTransferModal from '../components/ward/ComplaintTransferModal';
import NotificationCenter from '../components/notifications/NotificationCenter';
import '../components/ward/ward.css';

/**
 * MunicipalDashboard Page
 * Central administrative hub for multi-ward municipal governance, complaint triage, and GIS operations
 */
export const MunicipalDashboard = ({ currentUser, onNavigateHome, onNavigateLogin }) => {
  const isAuthorized = currentUser && (currentUser.role === 'admin' || currentUser.role === 'ward_admin');

  // Sub-tabs: 'overview' | 'wards' | 'gis' | 'analytics'
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWardForDetails, setSelectedWardForDetails] = useState(null);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [complaintToTransfer, setComplaintToTransfer] = useState(null);
  const [feedback, setFeedback] = useState(null);

  if (!isAuthorized) {
    return (
      <div className="admin-access-denied-page" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', background: '#ffffff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2.5rem' }}>🛡️</div>
          <h2>Municipal Authorization Required</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Access to the Multi-Ward Municipal Command Center is restricted to certified <strong>Municipal Administrators</strong> and <strong>Ward Administrators</strong>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={onNavigateLogin}>
              Sign In as Administrator
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNavigateHome}>
              Public Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenTransfer = (complaint) => {
    setComplaintToTransfer(complaint);
    setTransferModalOpen(true);
  };

  const handleTransferSuccess = (transferResult) => {
    setFeedback({
      type: 'success',
      message: `Ticket ${transferResult.complaintId} transferred to ${transferResult.destinationWard.name}. SLA deadline preserved.`
    });
    setTimeout(() => setFeedback(null), 6000);
  };

  const handleSelectWardFromOverview = (wardId) => {
    setSelectedWardForDetails(wardId);
    setActiveTab('analytics');
  };

  return (
    <div className="municipal-dashboard-container">
      {/* Header */}
      <header className="municipal-header">
        <div className="municipal-title-group">
          <h1>🏛️ City Municipal Multi-Ward Administration</h1>
          <p className="municipal-subtitle">
            Centralized Ward Governance, Cross-Jurisdiction Triage &amp; Spatial Operations Command
          </p>
        </div>

        <div className="municipal-header-actions">
          {currentUser && <NotificationCenter currentUser={currentUser} />}
          <button type="button" className="btn btn-secondary btn-small" onClick={onNavigateHome}>
            Public Portal
          </button>
        </div>
      </header>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>✓ {feedback.message}</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            onClick={() => setFeedback(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="municipal-tabs-nav">
        <button
          type="button"
          className={`municipal-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Multi-Ward Command &amp; KPIs
        </button>
        <button
          type="button"
          className={`municipal-tab-btn ${activeTab === 'wards' ? 'active' : ''}`}
          onClick={() => setActiveTab('wards')}
        >
          🏛️ Ward Directory &amp; Officers
        </button>
        <button
          type="button"
          className={`municipal-tab-btn ${activeTab === 'gis' ? 'active' : ''}`}
          onClick={() => setActiveTab('gis')}
        >
          🗺️ Municipal GIS Spatial Map
        </button>
        <button
          type="button"
          className={`municipal-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Ward Analytical Reports &amp; CSV
        </button>
      </nav>

      {/* Active Tab Panel */}
      <main style={{ marginTop: '0.5rem' }}>
        {activeTab === 'overview' && (
          <MunicipalOverviewTab onSelectWard={handleSelectWardFromOverview} />
        )}

        {activeTab === 'wards' && (
          <WardManagement onSelectWardForDetails={handleSelectWardFromOverview} />
        )}

        {activeTab === 'gis' && (
          <MunicipalGISMap
            onTransferComplaint={handleOpenTransfer}
            onViewDetails={(complaintId) => {
              // Can open details or filter
              console.log('Inspecting ticket on map:', complaintId);
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <WardAnalyticsTab initialWardId={selectedWardForDetails} />
        )}
      </main>

      {/* Inter-Ward Complaint Transfer Modal */}
      {transferModalOpen && complaintToTransfer && (
        <ComplaintTransferModal
          complaint={complaintToTransfer}
          isOpen={transferModalOpen}
          onClose={() => { setTransferModalOpen(false); setComplaintToTransfer(null); }}
          onTransferSuccess={handleTransferSuccess}
        />
      )}
    </div>
  );
};

export default MunicipalDashboard;
