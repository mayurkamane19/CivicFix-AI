import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * CivicFix AI - Duplicate Complaint Detection Service
 * Implements lightweight, explainable text token Jaccard similarity and
 * Haversine spatial proximity matching.
 */

export const DEFAULT_CONFIG = {
  HIGH_CONFIDENCE_THRESHOLD: 0.80,
  MEDIUM_CONFIDENCE_THRESHOLD: 0.60,
  PROXIMITY_THRESHOLD_METERS: 300, // 300 meters proximity threshold
  MAX_SPATIAL_CUTOFF_METERS: 1000, // 1 km cutoff
  MAX_CANDIDATE_DAYS: 30, // Look back 30 days
  MAX_CANDIDATE_LIMIT: 50 // Limit comparison pool
};

// Common functional English stop words to filter out
export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'aren', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both',
  'but', 'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its',
  'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn', 'we', 'were', 'weren', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'near', 'nearby'
]);

// Canonical municipal synonym mappings to handle common phrasing variations
export const SYNONYMS = {
  big: 'large',
  huge: 'large',
  giant: 'large',
  deep: 'deep',
  trash: 'garbage',
  waste: 'garbage',
  litter: 'garbage',
  dumpster: 'garbage',
  bin: 'container',
  can: 'container',
  cans: 'container',
  bins: 'container',
  containers: 'container',
  hole: 'pothole',
  holes: 'pothole',
  potholes: 'pothole',
  leak: 'leakage',
  leaking: 'leakage',
  leaks: 'leakage',
  broken: 'damaged',
  damage: 'damaged',
  damaging: 'damaged',
  street: 'road',
  avenue: 'road',
  ave: 'road',
  blvd: 'road',
  boulevard: 'road',
  hwy: 'highway',
  overflow: 'overflowing',
  overflows: 'overflowing',
  spill: 'spilling',
  spills: 'spilling'
};

/**
 * Tokenizes, lowercases, cleans punctuation, applies stemming/synonyms, and removes stop words
 * @param {string} text
 * @returns {Set<string>}
 */
export const tokenizeAndNormalize = (text) => {
  if (!text || typeof text !== 'string') return new Set();

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return new Set();

  const rawWords = cleaned
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  const tokens = new Set();
  for (const w of rawWords) {
    let s = w;
    // Basic suffix stripping
    if (s.endsWith('ing') && s.length > 5) {
      s = s.slice(0, -3);
    }
    if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) {
      s = s.slice(0, -1);
    }

    const mapped = SYNONYMS[s] || SYNONYMS[w] || s;
    tokens.add(mapped);
  }

  return tokens;
};

/**
 * Computes token-based Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|
 * @param {Set<string>} tokensA
 * @param {Set<string>} tokensB
 * @returns {number} Value between 0.0 and 1.0
 */
export const calculateJaccardSimilarity = (tokensA, tokensB) => {
  if (!tokensA || !tokensB || tokensA.size === 0 || tokensB.size === 0) {
    return 0.0;
  }

  // Guard: if both token sets are tiny (< 2 tokens), require exact match to avoid spurious matches
  if (tokensA.size === 1 && tokensB.size === 1) {
    const valA = Array.from(tokensA)[0];
    const valB = Array.from(tokensB)[0];
    return valA === valB ? 1.0 : 0.0;
  }

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  if (unionCount === 0) return 0.0;

  return Math.round((intersectionCount / unionCount) * 1000) / 1000;
};

/**
 * Computes text similarity combining normalized title and description
 * @param {object} complaintA { title, description }
 * @param {object} complaintB { title, description }
 * @returns {number}
 */
export const calculateTextSimilarity = (complaintA, complaintB) => {
  const titleTokensA = tokenizeAndNormalize(complaintA.title || '');
  const titleTokensB = tokenizeAndNormalize(complaintB.title || '');
  const titleScore = calculateJaccardSimilarity(titleTokensA, titleTokensB);

  const descTokensA = tokenizeAndNormalize(complaintA.description || '');
  const descTokensB = tokenizeAndNormalize(complaintB.description || '');
  const descScore = calculateJaccardSimilarity(descTokensA, descTokensB);

  // If one field has substantial match while other is short, give prominence to the stronger match
  let combinedTextScore;
  if (titleTokensA.size > 0 && descTokensA.size > 0 && titleTokensB.size > 0 && descTokensB.size > 0) {
    combinedTextScore = (titleScore * 0.45) + (descScore * 0.55);
  } else if (titleTokensA.size > 0 && titleTokensB.size > 0) {
    combinedTextScore = titleScore;
  } else {
    combinedTextScore = descScore;
  }

  return Math.round(combinedTextScore * 1000) / 1000;
};

/**
 * Calculates geographic distance in meters between two lat/lng coordinates
 * using the Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} Distance in meters or null if invalid coordinates
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return null;
  }

  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);

  if (
    isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2) ||
    numLat1 < -90 || numLat1 > 90 || numLat2 < -90 || numLat2 > 90 ||
    numLon1 < -180 || numLon1 > 180 || numLon2 < -180 || numLon2 > 180
  ) {
    return null;
  }

  const R = 6371000; // Mean Earth radius in meters
  const dLat = (numLat2 - numLat1) * (Math.PI / 180);
  const dLon = (numLon2 - numLon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(numLat1 * (Math.PI / 180)) *
      Math.cos(numLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Computes location similarity based on GPS coordinates or address tokens
 * @param {object} locA { address, latitude, longitude }
 * @param {object} locB { address, latitude, longitude }
 * @param {number} proximityThresholdMeters
 * @param {number} maxSpatialCutoffMeters
 * @returns {{hasCoordinates: boolean, distanceMeters: number|null, locationScore: number}}
 */
export const calculateLocationSimilarity = (
  locA = {},
  locB = {},
  proximityThresholdMeters = DEFAULT_CONFIG.PROXIMITY_THRESHOLD_METERS,
  maxSpatialCutoffMeters = DEFAULT_CONFIG.MAX_SPATIAL_CUTOFF_METERS
) => {
  const latA = locA.latitude ?? locA?.location?.latitude;
  const lonA = locA.longitude ?? locA?.location?.longitude;
  const latB = locB.latitude ?? locB?.location?.latitude;
  const lonB = locB.longitude ?? locB?.location?.longitude;

  const distance = calculateHaversineDistance(latA, lonA, latB, lonB);

  if (distance !== null) {
    let locationScore = 0.0;
    if (distance <= proximityThresholdMeters) {
      // Scale from 1.0 (exact match at 0m) to 0.70 at proximity threshold (300m)
      locationScore = 1.0 - (distance / (proximityThresholdMeters * 3.33));
    } else if (distance <= maxSpatialCutoffMeters) {
      // Linear falloff from 0.70 at 300m down to 0.0 at 1000m
      const excess = distance - proximityThresholdMeters;
      const window = maxSpatialCutoffMeters - proximityThresholdMeters;
      locationScore = Math.max(0.0, 0.70 * (1.0 - excess / window));
    } else {
      // > 1000m considered completely different geographic locations
      locationScore = 0.0;
    }

    return {
      hasCoordinates: true,
      distanceMeters: distance,
      locationScore: Math.round(locationScore * 1000) / 1000
    };
  }

  // Fallback to Address Token Similarity
  const addrA = locA.address || locA?.location?.address || '';
  const addrB = locB.address || locB?.location?.address || '';

  const tokensA = tokenizeAndNormalize(addrA);
  const tokensB = tokenizeAndNormalize(addrB);
  const addressScore = calculateJaccardSimilarity(tokensA, tokensB);

  return {
    hasCoordinates: false,
    distanceMeters: null,
    locationScore: addressScore
  };
};

/**
 * Checks category compatibility between two complaints
 * @param {string} catA
 * @param {string} catB
 * @returns {boolean}
 */
export const areCategoriesCompatible = (catA, catB) => {
  if (!catA || !catB) return false;
  return catA.trim().toLowerCase() === catB.trim().toLowerCase();
};

/**
 * Calculates combined similarity score and confidence level between two complaints
 * @param {object} complaintA
 * @param {object} complaintB
 * @param {object} configOptions
 * @returns {{isCompatible: boolean, totalScore: number, textScore: number, locationScore: number, distanceMeters: number|null, confidence: string|null}}
 */
export const calculateComplaintSimilarity = (complaintA, complaintB, configOptions = {}) => {
  const config = { ...DEFAULT_CONFIG, ...configOptions };

  // 1. Category Compatibility Check
  const catA = complaintA.category || '';
  const catB = complaintB.category || '';
  if (!areCategoriesCompatible(catA, catB)) {
    return {
      isCompatible: false,
      totalScore: 0.0,
      textScore: 0.0,
      locationScore: 0.0,
      distanceMeters: null,
      confidence: null
    };
  }

  // 2. Text Similarity
  const textScore = calculateTextSimilarity(complaintA, complaintB);

  // 3. Location Similarity
  const locResult = calculateLocationSimilarity(
    complaintA.location || complaintA,
    complaintB.location || complaintB,
    config.PROXIMITY_THRESHOLD_METERS,
    config.MAX_SPATIAL_CUTOFF_METERS
  );

  // 4. Combined Score Weighting
  let totalScore = 0.0;
  if (locResult.hasCoordinates) {
    if (locResult.distanceMeters !== null && locResult.distanceMeters > config.MAX_SPATIAL_CUTOFF_METERS) {
      // If complaints are at completely different locations (>1km), strictly reject as duplicate
      totalScore = 0.0;
    } else {
      // In immediate vicinity, GPS proximity carries 40% weight, text carries 60%
      totalScore = (textScore * 0.60) + (locResult.locationScore * 0.40);
    }
  } else if (complaintA.address || complaintA.location?.address) {
    // Address text carries 30% weight, complaint text carries 70%
    totalScore = (textScore * 0.70) + (locResult.locationScore * 0.30);
  } else {
    // Text only with slight penalty for lack of spatial corroboration
    totalScore = textScore * 0.85;
  }

  totalScore = Math.round(totalScore * 1000) / 1000;

  // 5. Confidence Evaluation
  let confidence = null;
  if (totalScore >= config.HIGH_CONFIDENCE_THRESHOLD) {
    confidence = 'High';
  } else if (totalScore >= config.MEDIUM_CONFIDENCE_THRESHOLD) {
    confidence = 'Medium';
  } else {
    confidence = 'Low';
  }

  return {
    isCompatible: true,
    totalScore,
    textScore,
    locationScore: locResult.locationScore,
    distanceMeters: locResult.distanceMeters,
    confidence
  };
};

/**
 * Finds potential duplicate complaints from MongoDB or an injected candidate array
 * @param {object} targetComplaint
 * @param {object} options
 * @param {Array|null} [options.candidateComplaints=null] For isolated unit testing
 * @returns {Promise<object>}
 */
export const findPotentialDuplicates = async (
  targetComplaint,
  {
    threshold = DEFAULT_CONFIG.MEDIUM_CONFIDENCE_THRESHOLD,
    highThreshold = DEFAULT_CONFIG.HIGH_CONFIDENCE_THRESHOLD,
    maxDays = DEFAULT_CONFIG.MAX_CANDIDATE_DAYS,
    limit = DEFAULT_CONFIG.MAX_CANDIDATE_LIMIT,
    candidateComplaints = null
  } = {}
) => {
  if (!targetComplaint) {
    return {
      status: 'Failed',
      isPotentialDuplicate: false,
      confidence: null,
      similarityScore: 0,
      matchedComplaintIds: [],
      matchedComplaints: [],
      checkedAt: new Date(),
      errorMessage: 'Invalid target complaint provided for duplicate detection'
    };
  }

  let candidates = candidateComplaints;

  // If no injected candidate list, fetch bounded candidates from MongoDB
  if (!candidates) {
    if (getDatabaseStatus() !== 'connected') {
      return {
        status: 'Failed',
        isPotentialDuplicate: false,
        confidence: null,
        similarityScore: 0,
        matchedComplaintIds: [],
        matchedComplaints: [],
        checkedAt: new Date(),
        errorMessage: 'Database unavailable for duplicate comparison'
      };
    }

    try {
      const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
      candidates = await Complaint.find({
        category: targetComplaint.category,
        complaintId: { $ne: targetComplaint.complaintId },
        createdAt: { $gte: cutoffDate }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {
      return {
        status: 'Failed',
        isPotentialDuplicate: false,
        confidence: null,
        similarityScore: 0,
        matchedComplaintIds: [],
        matchedComplaints: [],
        checkedAt: new Date(),
        errorMessage: err.message || 'Error querying candidate complaints'
      };
    }
  }

  const matches = [];

  for (const candidate of candidates) {
    // Strictly exclude self comparison
    if (
      candidate.complaintId &&
      targetComplaint.complaintId &&
      candidate.complaintId === targetComplaint.complaintId
    ) {
      continue;
    }

    const similarity = calculateComplaintSimilarity(targetComplaint, candidate, {
      HIGH_CONFIDENCE_THRESHOLD: highThreshold,
      MEDIUM_CONFIDENCE_THRESHOLD: threshold
    });

    if (similarity.isCompatible && similarity.totalScore >= threshold) {
      matches.push({
        complaintId: candidate.complaintId,
        title: candidate.title || '',
        category: candidate.category || targetComplaint.category,
        status: candidate.status || 'Pending',
        similarityScore: similarity.totalScore,
        confidence: similarity.confidence || 'Medium',
        distanceMeters: similarity.distanceMeters,
        createdAt: candidate.createdAt || candidate.submissionDate || null
      });
    }
  }

  // Sort matches descending by highest similarity score
  matches.sort((a, b) => b.similarityScore - a.similarityScore);

  if (matches.length > 0) {
    const topMatch = matches[0];
    return {
      status: 'Completed',
      isPotentialDuplicate: true,
      confidence: topMatch.confidence,
      similarityScore: topMatch.similarityScore,
      matchedComplaintIds: matches.map((m) => m.complaintId),
      matchedComplaints: matches,
      checkedAt: new Date(),
      errorMessage: null
    };
  }

  return {
    status: 'Completed',
    isPotentialDuplicate: false,
    confidence: null,
    similarityScore: 0,
    matchedComplaintIds: [],
    matchedComplaints: [],
    checkedAt: new Date(),
    errorMessage: null
  };
};

export default {
  DEFAULT_CONFIG,
  STOP_WORDS,
  SYNONYMS,
  tokenizeAndNormalize,
  calculateJaccardSimilarity,
  calculateTextSimilarity,
  calculateHaversineDistance,
  calculateLocationSimilarity,
  areCategoriesCompatible,
  calculateComplaintSimilarity,
  findPotentialDuplicates
};
