/**
 * Phase 25: GIS Geofencing & Point-in-Polygon Engine
 * CivicFix AI - Municipal Ward Boundary Spatial Analysis
 */

/**
 * Validates GeoJSON geometry structure and coordinates
 * @param {object} geometry - GeoJSON geometry { type: 'Polygon' | 'MultiPolygon', coordinates: [...] }
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateGeoJSONGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    return { isValid: false, error: 'Geometry must be an object' };
  }

  const { type, coordinates } = geometry;
  if (!['Polygon', 'MultiPolygon'].includes(type)) {
    return { isValid: false, error: `Unsupported geometry type: ${type}. Expected Polygon or MultiPolygon.` };
  }

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { isValid: false, error: 'Coordinates must be a non-empty array' };
  }

  const validateRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) {
      return 'Linear ring must contain at least 3 coordinate pairs';
    }
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) {
        return 'Coordinate must be an array of [longitude, latitude]';
      }
      const [lng, lat] = pt;
      if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
        return `Invalid longitude: ${lng}. Must be between -180 and 180.`;
      }
      if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
        return `Invalid latitude: ${lat}. Must be between -90 and 90.`;
      }
    }
    return null;
  };

  if (type === 'Polygon') {
    for (const ring of coordinates) {
      const err = validateRing(ring);
      if (err) return { isValid: false, error: err };
    }
  } else if (type === 'MultiPolygon') {
    for (const poly of coordinates) {
      if (!Array.isArray(poly) || poly.length === 0) {
        return { isValid: false, error: 'MultiPolygon must contain arrays of polygon rings' };
      }
      for (const ring of poly) {
        const err = validateRing(ring);
        if (err) return { isValid: false, error: err };
      }
    }
  }

  return { isValid: true };
}

/**
 * Tests whether a point [lng, lat] is inside a single linear ring using ray-casting.
 * @param {number} lng - Point longitude
 * @param {number} lat - Point latitude
 * @param {Array<Array<number>>} ring - Array of [lng, lat] coordinate pairs
 * @returns {boolean}
 */
export function isPointInPolygonRing(lng, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    // Check if point is on an edge/vertex
    if ((lat === yi && lng === xi) || (lat === yj && lng === xj)) {
      return true;
    }

    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if point is inside a GeoJSON Polygon (accounting for outer boundary and interior holes)
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {Array<Array<Array<number>>>} coordinates - GeoJSON Polygon coordinates
 * @returns {boolean}
 */
export function isPointInPolygon(lng, lat, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  
  // Outer boundary is the first ring
  const outerRing = coordinates[0];
  if (!isPointInPolygonRing(lng, lat, outerRing)) {
    return false;
  }

  // If point is inside any holes (inner rings), it is NOT in the polygon
  for (let h = 1; h < coordinates.length; h++) {
    const holeRing = coordinates[h];
    if (isPointInPolygonRing(lng, lat, holeRing)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if point is inside a GeoJSON MultiPolygon
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {Array<Array<Array<Array<number>>>>} coordinates - MultiPolygon coordinates
 * @returns {boolean}
 */
export function isPointInMultiPolygon(lng, lat, coordinates) {
  if (!Array.isArray(coordinates)) return false;
  for (const polygon of coordinates) {
    if (isPointInPolygon(lng, lat, polygon)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a point [lng, lat] is inside any GeoJSON geometry object
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {object} boundaries - Boundary object with type and coordinates
 * @returns {boolean}
 */
export function isPointInGeoJSON(lng, lat, boundaries) {
  if (!boundaries || !boundaries.type || !boundaries.coordinates) return false;

  if (boundaries.type === 'Polygon') {
    return isPointInPolygon(lng, lat, boundaries.coordinates);
  }
  if (boundaries.type === 'MultiPolygon') {
    return isPointInMultiPolygon(lng, lat, boundaries.coordinates);
  }
  return false;
}

/**
 * Determines the correct municipal ward for a given GPS coordinate pair.
 * Handles single match, outside-all-wards, overlapping boundaries, and invalid coordinates safely.
 * 
 * @param {number} latitude
 * @param {number} longitude
 * @param {Array<object>} wards - Array of Ward documents or plain objects with boundaries
 * @returns {{
 *   matchedWard: object | null,
 *   status: 'MATCHED' | 'OUTSIDE_BOUNDARIES' | 'OVERLAPPING_MATCH' | 'INVALID_COORDINATES',
 *   allMatches: Array<object>,
 *   message: string
 * }}
 */
export function detectWardForCoordinates(latitude, longitude, wards = []) {
  const numLat = Number(latitude);
  const numLng = Number(longitude);

  if (isNaN(numLat) || numLat < -90 || numLat > 90 || isNaN(numLng) || numLng < -180 || numLng > 180) {
    return {
      matchedWard: null,
      status: 'INVALID_COORDINATES',
      allMatches: [],
      message: `Coordinates [lat: ${latitude}, lng: ${longitude}] are out of standard geospatial range.`
    };
  }

  if (!Array.isArray(wards) || wards.length === 0) {
    return {
      matchedWard: null,
      status: 'OUTSIDE_BOUNDARIES',
      allMatches: [],
      message: 'No municipal wards configured for spatial matching.'
    };
  }

  const matchingWards = [];

  for (const ward of wards) {
    // Only check active wards with defined boundaries
    if (ward.isActive === false) continue;
    if (!ward.boundaries || !['Polygon', 'MultiPolygon'].includes(ward.boundaries.type)) continue;

    if (isPointInGeoJSON(numLng, numLat, ward.boundaries)) {
      matchingWards.push(ward);
    }
  }

  if (matchingWards.length === 1) {
    const selected = matchingWards[0];
    return {
      matchedWard: selected,
      status: 'MATCHED',
      allMatches: matchingWards,
      message: `Location successfully mapped to Ward ${selected.name} (${selected.code || selected.number}).`
    };
  }

  if (matchingWards.length > 1) {
    // Safely select the first match while reporting overlapping condition
    const selected = matchingWards[0];
    return {
      matchedWard: selected,
      status: 'OVERLAPPING_MATCH',
      allMatches: matchingWards,
      message: `Location overlaps ${matchingWards.length} wards (${matchingWards.map(w => w.name).join(', ')}). Defaulted to ${selected.name}.`
    };
  }

  return {
    matchedWard: null,
    status: 'OUTSIDE_BOUNDARIES',
    allMatches: [],
    message: `Coordinates [${numLat}, ${numLng}] fall outside all configured municipal ward boundaries.`
  };
}

export default {
  validateGeoJSONGeometry,
  isPointInPolygonRing,
  isPointInPolygon,
  isPointInMultiPolygon,
  isPointInGeoJSON,
  detectWardForCoordinates
};
