import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  createSpatialClusters,
  createMarkerIcon,
  createClusterIcon,
} from '../components/map/clusteringUtils';
import ComplaintMapPopup from '../components/map/ComplaintMapPopup';
import MapLegend from '../components/map/MapLegend';
import { getPublicMapComplaintsApi } from '../services/api';

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
          <strong>{cluster.count} Issues in this Area</strong>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
            Click or zoom in to inspect specific reports.
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function PublicComplaintMapPage({ onNavigateTrack, onNavigateReport }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tileError, setTileError] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    category: '',
  });

  const [zoom, setZoom] = useState(12);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Default New Delhi

  const fetchPublicComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPublicMapComplaintsApi(filters);
      if (res.data?.success) {
        const fetched = res.data.data?.complaints || [];
        setComplaints(fetched);

        if (fetched.length > 0 && fetched[0].latitude && fetched[0].longitude) {
          setMapCenter([fetched[0].latitude, fetched[0].longitude]);
        }
      } else {
        setError(res.data?.message || 'Failed to load public map');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load public map');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPublicComplaints();
  }, [fetchPublicComplaints]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clusters = useMemo(() => {
    return createSpatialClusters(complaints, zoom);
  }, [complaints, zoom]);

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
    <div className="public-map-page-container">
      {/* Header and Privacy Notice */}
      <div className="public-map-header">
        <div className="section-container">
          <span className="section-kicker">SMART CITY GIS VISUALIZATION</span>
          <h1 className="public-map-title">Public Issue Transparency Map</h1>
          <p className="public-map-subtitle">
            Explore reported civic infrastructure issues across the municipality. All public reports feature approximate coordinates to safeguard citizen privacy.
          </p>

          <div className="privacy-banner">
            <span className="privacy-icon">🛡️</span>
            <div>
              <strong>Location Privacy Guarantee:</strong> Public coordinates are rounded to ~100 meters (~0.001°). Exact residential coordinates, citizen contact info, and internal officer notes are completely omitted from public feeds.
            </div>
          </div>
        </div>
      </div>

      <div className="section-container" style={{ paddingBottom: '3rem' }}>
        {/* Controls Toolbar */}
        <div className="gis-toolbar-card">
          <div className="gis-header-row">
            <div className="gis-stats-bar" style={{ margin: 0 }}>
              <span className="gis-stat-pill stat-total">
                Public Issues: <strong>{stats.total}</strong>
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

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={fetchPublicComplaints}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : '↻ Refresh Map'}
              </button>
              {onNavigateReport && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onNavigateReport}
                >
                  + Report New Issue
                </button>
              )}
            </div>
          </div>

          <div className="gis-filters-grid" style={{ marginTop: '0.75rem' }}>
            <div className="gis-filter-item">
              <label>Status Filter</label>
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
              <label>Category Filter</label>
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

            <div className="gis-filter-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setFilters({ status: '', category: '' })}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Map View Canvas */}
        <div className="gis-map-wrapper">
          {loading && (
            <div className="gis-map-overlay-loading">
              <div className="spinner"></div>
              <span>Loading public civic issue map...</span>
            </div>
          )}

          {error && (
            <div className="gis-map-alert error">
              <p><strong>Notice:</strong> {error}</p>
            </div>
          )}

          {tileError && (
            <div className="gis-map-alert warning">
              <p>
                Map tile imagery is currently unreachable. Marker locations and complaint popups remain active.
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
                  key={`complaint-${complaint._id || complaint.id || complaint.complaintId}`}
                  position={[complaint.latitude, complaint.longitude]}
                  icon={createMarkerIcon(complaint.status)}
                >
                  <Popup>
                    <ComplaintMapPopup
                      complaint={complaint}
                      isPublic={true}
                      onTrackIssue={onNavigateTrack}
                    />
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          <MapLegend />

          {complaints.length === 0 && !loading && (
            <div className="gis-empty-overlay">
              <p>No civic issues with valid coordinates found matching selected filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
