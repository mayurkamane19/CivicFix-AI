import L from 'leaflet';

/**
 * CivicFix AI - Lightweight GIS Spatial Marker Clustering Engine
 * 
 * Groups proximate geographic coordinates into cluster aggregates based on current map zoom level.
 * When zooming in, clusters decompose smoothly into individual complaint markers.
 */

/**
 * Cluster points into markers and aggregate clusters
 * @param {Array<object>} complaints - List of complaints with valid latitude and longitude
 * @param {number} zoom - Current Leaflet zoom level (e.g. 1 to 18)
 * @param {number} [radiusPixels=55] - Cluster pixel radius threshold
 * @returns {Array<object>} Array of cluster objects and individual marker objects
 */
export const createSpatialClusters = (complaints, zoom, radiusPixels = 55) => {
  if (!Array.isArray(complaints) || complaints.length === 0) {
    return [];
  }

  // Filter out any invalid coordinates defensively
  const validPoints = complaints.filter(
    (c) =>
      c.latitude !== null &&
      c.latitude !== undefined &&
      !isNaN(Number(c.latitude)) &&
      c.longitude !== null &&
      c.longitude !== undefined &&
      !isNaN(Number(c.longitude))
  );

  if (validPoints.length <= 1 || zoom >= 16) {
    // At high zoom levels (street/block level), render all individual markers directly
    return validPoints.map((c) => ({
      type: 'marker',
      isCluster: false,
      id: c.complaintId || c._id || String(Math.random()),
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      complaint: c
    }));
  }

  // Calculate degree grid step size according to zoom level
  // Web Mercator approximation: 360 degrees / 2^zoom
  const cellDeg = (360 / Math.pow(2, Math.max(1, zoom))) * (radiusPixels / 256);

  const grid = new Map();

  for (const c of validPoints) {
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);

    const cellX = Math.floor(lng / cellDeg);
    const cellY = Math.floor(lat / cellDeg);
    const cellKey = `${cellX}:${cellY}`;

    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey).push(c);
  }

  const results = [];

  for (const [cellKey, items] of grid.entries()) {
    if (items.length === 1) {
      const single = items[0];
      results.push({
        type: 'marker',
        isCluster: false,
        id: single.complaintId || single._id || cellKey,
        latitude: Number(single.latitude),
        longitude: Number(single.longitude),
        complaint: single
      });
    } else {
      // Aggregate cluster: compute centroid
      const totalLat = items.reduce((acc, curr) => acc + Number(curr.latitude), 0);
      const totalLng = items.reduce((acc, curr) => acc + Number(curr.longitude), 0);
      const avgLat = totalLat / items.length;
      const avgLng = totalLng / items.length;

      // Extract status breakdown
      let pendingCount = 0;
      let inProgressCount = 0;
      let resolvedCount = 0;

      for (const item of items) {
        if (item.status === 'Resolved') resolvedCount++;
        else if (item.status === 'In Progress') inProgressCount++;
        else pendingCount++;
      }

      results.push({
        type: 'cluster',
        isCluster: true,
        id: `cluster-${cellKey}`,
        latitude: avgLat,
        longitude: avgLng,
        count: items.length,
        statusBreakdown: {
          pending: pendingCount,
          inProgress: inProgressCount,
          resolved: resolvedCount
        },
        items
      });
    }
  }

  return results;
};

/**
 * Returns marker SVG color based on complaint status
 * @param {string} status - 'Pending' | 'In Progress' | 'Resolved'
 * @returns {string} Hex color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'Resolved':
      return '#10b981'; // Emerald Green
    case 'In Progress':
      return '#2563eb'; // Royal Blue
    default:
      return '#f59e0b'; // Amber Orange
  }
};

/**
 * Creates Leaflet divIcon for a single complaint marker
 * @param {string} status - 'Pending' | 'In Progress' | 'Resolved'
 * @returns {L.DivIcon}
 */
export const createMarkerIcon = (status) => {
  const color = getStatusColor(status);
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div class="map-pin-inner">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="#ffffff" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

/**
 * Creates Leaflet divIcon for a cluster marker showing number of items
 * @param {number} count - Aggregate number of complaints in cluster
 * @returns {L.DivIcon}
 */
export const createClusterIcon = (count) => {
  return L.divIcon({
    className: 'custom-cluster-icon',
    html: `
      <div class="cluster-badge">
        <span>${count}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};
