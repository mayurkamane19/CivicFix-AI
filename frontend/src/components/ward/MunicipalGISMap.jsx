import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getWardsApi, getAdminMapComplaintsApi } from '../../services/api';
import './ward.css';

// Fix default leaflet marker icon assets for Webpack/Vite bundles
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const getStatusColor = (status) => {
  switch (status) {
    case 'Pending': return '#f59e0b';
    case 'In Progress': return '#3b82f6';
    case 'Resolved': return '#10b981';
    case 'Reopened': return '#ef4444';
    default: return '#6b7280';
  }
};

const createColoredMarker = (status) => {
  const color = getStatusColor(status);
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 13, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

/**
 * MunicipalGISMap
 * Interactive geospatial map rendering complaints across municipal administrative wards
 */
export const MunicipalGISMap = ({ onTransferComplaint, onViewDetails }) => {
  const [wards, setWards] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [complaints, setComplaints] = useState([]);
  const [mapCenter, setMapCenter] = useState([18.5204, 73.8567]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load wards for selector
  useEffect(() => {
    const fetchWards = async () => {
      const res = await getWardsApi({ limit: 100 });
      if (res.success && res.data) {
        setWards(res.data);
      }
    };
    fetchWards();
  }, []);

  // Fetch complaints
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await getAdminMapComplaintsApi({
      ward: selectedWardId,
      category: categoryFilter === 'all' ? '' : categoryFilter,
      status: statusFilter === 'all' ? '' : statusFilter,
      limit: 500
    });
    setLoading(false);

    if (res.success && res.data) {
      setComplaints(res.data);
    } else {
      setError(res.error || 'Failed to load map data');
    }
  }, [selectedWardId, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // When selected ward changes, pan map to ward center if available
  useEffect(() => {
    if (selectedWardId) {
      const ward = wards.find((w) => w.id === selectedWardId);
      if (ward && ward.center?.latitude && ward.center?.longitude) {
        setMapCenter([ward.center.latitude, ward.center.longitude]);
      }
    }
  }, [selectedWardId, wards]);

  const selectedWardObj = useMemo(() => {
    return wards.find((w) => w.id === selectedWardId);
  }, [selectedWardId, wards]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Control Card Overlay */}
      <div className="ward-filter-toolbar" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              Municipal Ward Focus
            </label>
            <select
              className="ward-filter-select"
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
            >
              <option value="">All Municipal Wards (City-Wide)</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name} ({w.zone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              Issue Category
            </label>
            <select
              className="ward-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Road Damage">Road Damage</option>
              <option value="Garbage">Garbage</option>
              <option value="Water Leakage">Water Leakage</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Drainage">Drainage</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              Resolution Status
            </label>
            <select
              className="ward-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
            </select>
          </div>

          <div style={{ marginTop: '1.1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Showing <strong>{complaints.length}</strong> geolocated incidents
          </div>
        </div>

        <button type="button" className="btn btn-secondary btn-small" onClick={fetchComplaints}>
          🔄 Refresh Map
        </button>
      </div>

      {error && <div className="alert-error" style={{ padding: '0.75rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>{error}</div>}

      {/* Ward Geographic Notice */}
      {selectedWardObj && (
        <div style={{ padding: '0.65rem 1rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.825rem', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            📍 <strong>{selectedWardObj.name} ({selectedWardObj.code})</strong> — {selectedWardObj.zone} · Population: {selectedWardObj.population?.toLocaleString() || 'N/A'} · Area: {selectedWardObj.areaKm2 ? `${selectedWardObj.areaKm2} km²` : 'N/A'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {selectedWardObj.boundaries?.type !== 'None' ? 'GeoJSON boundaries active' : 'Standard centroid coordinates (polygon pending survey)'}
          </span>
        </div>
      )}

      {/* Leaflet Map */}
      <div className="municipal-gis-container">
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeMapView center={mapCenter} zoom={13} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {complaints.map((c) => (
            <Marker
              key={c.complaintId}
              position={[c.latitude, c.longitude]}
              icon={createColoredMarker(c.status)}
            >
              <Popup>
                <div style={{ minWidth: '220px', padding: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    {c.complaintId} · {c.category}
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block', margin: '3px 0' }}>
                    {c.title}
                  </strong>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
                    {c.address}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span className="ward-code-badge">{c.wardCode || 'Unassigned'}</span>
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                      Status: {c.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {onViewDetails && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => onViewDetails(c.complaintId)}
                      >
                        Details
                      </button>
                    )}
                    {onTransferComplaint && (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => onTransferComplaint(c)}
                      >
                        Transfer Ward
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MunicipalGISMap;
