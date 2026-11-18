import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  createSpatialClusters,
  createMarkerIcon,
  createClusterIcon,
} from './clusteringUtils';
import ComplaintMapPopup from './ComplaintMapPopup';
import MapLegend from './MapLegend';
import { getOfficerMapComplaintsApi } from '../../services/api';

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
          <strong>{cluster.count} Assigned Tasks</strong>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
            Click marker to zoom in.
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function OfficerComplaintMap({ onSelectComplaint }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tileError, setTileError] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    category: '',
  });

  const [zoom, setZoom] = useState(12);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);

  const fetchAssignedComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOfficerMapComplaintsApi(filters);
      if (res.data?.success) {
        const fetched = res.data.data?.complaints || [];
        setComplaints(fetched);

        if (fetched.length > 0 && fetched[0].latitude && fetched[0].longitude) {
          setMapCenter([fetched[0].latitude, fetched[0].longitude]);
        }
      } else {
        setError(res.data?.message || 'Failed to load assigned map tasks');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch field tasks');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAssignedComplaints();
  }, [fetchAssignedComplaints]);

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
    <div className="gis-map-module">
      <div className="gis-toolbar-card">
        <div className="gis-header-row">
          <div>
            <h3 className="gis-title">Field Officer Geographic Workload</h3>
            <p className="gis-subtitle">
              Visual overview of your assigned municipal tickets, inspection locations, and field routes.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={fetchAssignedComplaints}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh My Map'}
          </button>
        </div>

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

        <div className="gis-stats-bar">
          <span className="gis-stat-pill stat-total">
            My Assigned Mapped: <strong>{stats.total}</strong>
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

      <div className="gis-map-wrapper">
        {loading && (
          <div className="gis-map-overlay-loading">
            <div className="spinner"></div>
            <span>Loading assigned geographic tasks...</span>
          </div>
        )}

        {error && (
          <div className="gis-map-alert error">
            <p><strong>Error loading map:</strong> {error}</p>
          </div>
        )}

        {tileError && (
          <div className="gis-map-alert warning">
            <p>
              Map tile imagery is currently unreachable. Your task coordinates and interaction remain active.
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
                key={`complaint-${complaint._id || complaint.id}`}
                position={[complaint.latitude, complaint.longitude]}
                icon={createMarkerIcon(complaint.status)}
              >
                <Popup>
                  <ComplaintMapPopup
                    complaint={complaint}
                    isPublic={false}
                    onViewDetails={() => onSelectComplaint && onSelectComplaint(complaint)}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <MapLegend />

        {complaints.length === 0 && !loading && (
          <div className="gis-empty-overlay">
            <p>No assigned tasks with geographic coordinates matching current criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
