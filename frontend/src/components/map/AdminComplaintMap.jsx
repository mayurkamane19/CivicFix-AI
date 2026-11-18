import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  createSpatialClusters,
  createMarkerIcon,
  createClusterIcon,
} from './clusteringUtils';
import ComplaintMapPopup from './ComplaintMapPopup';
import MapLegend from './MapLegend';
import { getAdminMapComplaintsApi } from '../../services/api';

// Map controller to track zoom and provide programmatic navigation
function MapController({ onZoomChange, center, zoom }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

// Subcomponent for interactive cluster marker
function ClusterMarkerItem({ cluster }) {
  const map = useMap();

  const handleClick = () => {
    map.setView([cluster.latitude, cluster.longitude], Math.min(map.getZoom() + 2, 18), {
      animate: true,
    });
  };

  return (
    <Marker
      position={[cluster.latitude, cluster.longitude]}
      icon={createClusterIcon(cluster.count)}
      eventHandlers={{ click: handleClick }}
    >
      <Popup>
        <div style={{ textAlign: 'center', padding: '6px' }}>
          <strong>{cluster.count} Complaints Cluster</strong>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
            Click marker or zoom in to inspect individual reports.
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function AdminComplaintMap({
  departments = [],
  officers = [],
  onViewDetails,
}) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tileError, setTileError] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    severity: '',
    department: '',
    officer: '',
    startDate: '',
    endDate: '',
  });

  // Map state
  const [zoom, setZoom] = useState(12);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Default New Delhi

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminMapComplaintsApi(filters);
      if (res.data?.success) {
        const fetched = res.data.data?.complaints || [];
        setComplaints(fetched);

        // Auto-center map on first complaint with coordinates if available
        if (fetched.length > 0 && fetched[0].latitude && fetched[0].longitude) {
          setMapCenter([fetched[0].latitude, fetched[0].longitude]);
        }
      } else {
        setError(res.data?.message || 'Failed to load map data');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch map data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      category: '',
      severity: '',
      department: '',
      officer: '',
      startDate: '',
      endDate: '',
    });
  };

  // Group into clusters based on current zoom
  const clusters = useMemo(() => {
    return createSpatialClusters(complaints, zoom);
  }, [complaints, zoom]);

  // Statistics
  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    complaints.forEach((c) => {
      const s = c.status?.toLowerCase();
      if (s === 'resolved') resolved++;
      else if (s === 'in progress' || s === 'in-progress') inProgress++;
      else pending++;
    });
    return { total: complaints.length, pending, inProgress, resolved };
  }, [complaints]);

  return (
    <div className="gis-map-module">
      {/* Header and Filter Toolbar */}
      <div className="gis-toolbar-card">
        <div className="gis-header-row">
          <div>
            <h3 className="gis-title">Smart City GIS Complaint Heatmap &amp; Distribution</h3>
            <p className="gis-subtitle">
              Interactive geospatial visualization with real-time clustering, status indicators, and department routing.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={fetchComplaints}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Map'}
          </button>
        </div>

        {/* Filters Grid */}
        <div className="gis-filters-grid">
          <div className="gis-filter-item">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="gis-select"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="gis-filter-item">
            <label>Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="gis-select"
            >
              <option value="">All Categories</option>
              <option value="Roads">Roads &amp; Footpaths</option>
              <option value="Sanitation">Sanitation &amp; Garbage</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Electricity">Electricity &amp; Streetlights</option>
              <option value="Traffic">Traffic &amp; Parking</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="gis-filter-item">
            <label>AI Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="gis-select"
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="gis-filter-item">
            <label>Department</label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="gis-select"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="gis-filter-item">
            <label>Assigned Officer</label>
            <select
              value={filters.officer}
              onChange={(e) => handleFilterChange('officer', e.target.value)}
              className="gis-select"
            >
              <option value="">All Officers</option>
              {officers.map((off) => (
                <option key={off._id} value={off._id}>
                  {off.name} ({off.role})
                </option>
              ))}
            </select>
          </div>

          <div className="gis-filter-item">
            <label>Date From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="gis-input"
            />
          </div>

          <div className="gis-filter-item">
            <label>Date To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="gis-input"
            />
          </div>

          <div className="gis-filter-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="gis-stats-bar">
          <span className="gis-stat-pill stat-total">
            Total Mapped: <strong>{stats.total}</strong>
          </span>
          <span className="gis-stat-pill stat-pending">
            Pending: <strong>{stats.pending}</strong>
          </span>
          <span className="gis-stat-pill stat-inprogress">
            In Progress: <strong>{stats.inProgress}</strong>
          </span>
          <span className="gis-stat-pill stat-resolved">
            Resolved: <strong>{stats.resolved}</strong>
          </span>
        </div>
      </div>

      {/* Map Container View */}
      <div className="gis-map-wrapper">
        {loading && (
          <div className="gis-map-overlay-loading">
            <div className="spinner"></div>
            <span>Loading geospatial complaint markers...</span>
          </div>
        )}

        {error && (
          <div className="gis-map-alert error">
            <p><strong>Error loading map data:</strong> {error}</p>
          </div>
        )}

        {tileError && (
          <div className="gis-map-alert warning">
            <p>
              Map tile imagery is currently unreachable. Marker positions and data remain fully active and interactive.
            </p>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={zoom}
          scrollWheelZoom={true}
          className="leaflet-map-canvas"
        >
          <MapController
            onZoomChange={setZoom}
            center={mapCenter}
            zoom={zoom}
          />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{
              tileerror: () => setTileError(true),
              tileload: () => setTileError(false),
            }}
          />

          {/* Render Clusters and Individual Markers */}
          {clusters.map((cluster) => {
            if (cluster.isCluster) {
              return (
                <ClusterMarkerItem
                  key={`cluster-${cluster.id}-${cluster.count}`}
                  cluster={cluster}
                />
              );
            }

            const complaint = cluster.complaint;
            if (!complaint) return null;

            return (
              <Marker
                key={`complaint-${complaint._id || complaint.id}`}
                position={[complaint.latitude, complaint.longitude]}
                icon={createMarkerIcon(complaint.status)}
              >
                <Popup>
                  <ComplaintMapPopup
                    complaint={complaint}
                    isPublic={false}
                    onViewDetails={onViewDetails}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <MapLegend />

        {complaints.length === 0 && !loading && (
          <div className="gis-empty-overlay">
            <p>No complaints with valid geographic coordinates found matching selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
