import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  validateImageBuffer
} from './uploadService.js';
import {
  isGeminiConfigured,
  analyzeComplaintText
} from './geminiService.js';
import { analyzeComplaintImage } from './imageAnalysisService.js';
import { findPotentialDuplicates } from './duplicateDetectionService.js';
import { notifyComplaintSubmitted } from './notificationService.js';

export const ALLOWED_CATEGORIES = [
  'Road Damage',
  'Garbage',
  'Water Leakage',
  'Streetlight',
  'Drainage',
  'Other'
];

/**
 * Generates a clean, human-readable unique Complaint ID
 * Format: CFX-YYYYMMDD-XXXX (e.g. CFX-20261115-7482)
 * @returns {string}
 */
export const generateComplaintId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CFX-${dateStr}-${randomSuffix}`;
};

/**
 * Validates and creates a new citizen or guest complaint
 * @param {object} complaintData
 * @returns {Promise<object>} Safe public complaint representation
 */
export const createComplaint = async ({
  title,
  description,
  category,
  address,
  latitude,
  longitude,
  file,
  imageUrl,
  citizenEmail = null,
  emailNotificationsEnabled = false,
  reportedBy = null,
  aiClient = null,
  imageAiClient = null
}) => {
  // 1. Validate Title
  if (!title || typeof title !== 'string' || title.trim() === '') {
    const error = new Error('Complaint title is required');
    error.statusCode = 400;
    throw error;
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 3 || trimmedTitle.length > 150) {
    const error = new Error('Complaint title must be between 3 and 150 characters long');
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate Description
  if (!description || typeof description !== 'string' || description.trim() === '') {
    const error = new Error('Complaint description is required');
    error.statusCode = 400;
    throw error;
  }
  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
    const error = new Error('Complaint description must be between 10 and 2000 characters long');
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate Category
  if (!category || typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category.trim())) {
    const error = new Error(
      `Invalid category. Supported categories: ${ALLOWED_CATEGORIES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }
  const trimmedCategory = category.trim();

  // 4. Validate Address
  if (!address || typeof address !== 'string' || address.trim() === '') {
    const error = new Error('Complete incident address is required');
    error.statusCode = 400;
    throw error;
  }
  const trimmedAddress = address.trim();
  if (trimmedAddress.length < 3 || trimmedAddress.length > 300) {
    const error = new Error('Address must be between 3 and 300 characters long');
    error.statusCode = 400;
    throw error;
  }

  // 5. Validate Optional Coordinates (Latitude & Longitude)
  let parsedLat = null;
  let parsedLng = null;

  if (latitude !== undefined && latitude !== null && latitude !== '') {
    const numLat = Number(latitude);
    if (isNaN(numLat) || numLat < -90 || numLat > 90) {
      const error = new Error('Latitude must be a valid number between -90 and 90');
      error.statusCode = 400;
      throw error;
    }
    parsedLat = numLat;
  }

  if (longitude !== undefined && longitude !== null && longitude !== '') {
    const numLng = Number(longitude);
    if (isNaN(numLng) || numLng < -180 || numLng > 180) {
      const error = new Error('Longitude must be a valid number between -180 and 180');
      error.statusCode = 400;
      throw error;
    }
    parsedLng = numLng;
  }

  // 6. Validate Citizen Email & Notification Consent (Optional)
  let sanitizedCitizenEmail = null;
  let consentEnabled = false;

  if (citizenEmail && typeof citizenEmail === 'string' && citizenEmail.trim() !== '') {
    const trimmedEmail = citizenEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      const error = new Error('Please provide a valid citizen email address');
      error.statusCode = 400;
      throw error;
    }
    sanitizedCitizenEmail = trimmedEmail;
    consentEnabled = Boolean(emailNotificationsEnabled);
  }

  // 7. Handle Image Upload (Optional)
  let resolvedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  let resolvedImagePublicId = '';

  if (file && file.buffer) {
    // Validate image buffer signature (magic bytes)
    const { isValid } = validateImageBuffer(file.buffer);
    if (!isValid) {
      const error = new Error('Invalid image file format. Supported formats: JPEG, PNG, WebP.');
      error.statusCode = 400;
      throw error;
    }

    // Upload to Cloudinary
    const uploadResult = await uploadImageToCloudinary(file.buffer, file.originalname);
    resolvedImageUrl = uploadResult.secure_url;
    resolvedImagePublicId = uploadResult.public_id;
  }

  // 7. Database Health Check (with Cloudinary Rollback if DB unavailable)
  if (getDatabaseStatus() !== 'connected') {
    if (resolvedImagePublicId) {
      await deleteImageFromCloudinary(resolvedImagePublicId);
    }
    const error = new Error(
      'Database service is currently unavailable. Please verify MongoDB connection.'
    );
    error.statusCode = 503;
    throw error;
  }

  try {
    // 8. Generate Unique Complaint ID
    let complaintId = generateComplaintId();
    let existing = await Complaint.findOne({ complaintId });
    while (existing) {
      complaintId = generateComplaintId();
      existing = await Complaint.findOne({ complaintId });
    }

    // 9. Create and Persist Complaint Document
    // Temporary Guest Submission: reportedBy defaults to null until full auth binding is connected
    const complaint = new Complaint({
      complaintId,
      title: trimmedTitle,
      description: trimmedDescription,
      category: trimmedCategory,
      location: {
        address: trimmedAddress,
        latitude: parsedLat,
        longitude: parsedLng
      },
      imageUrl: resolvedImageUrl,
      imagePublicId: resolvedImagePublicId,
      status: 'Pending',
      reportedBy: reportedBy || null,
      citizenEmail: sanitizedCitizenEmail,
      emailNotificationsEnabled: consentEnabled
    });

    await complaint.save();

    // 10. Execute Google Gemini AI Analysis (Non-blocking fallback to preserve complaint on AI failure)
    if (isGeminiConfigured() || aiClient) {
      try {
        const aiResult = await analyzeComplaintText(
          {
            title: trimmedTitle,
            description: trimmedDescription,
            category: trimmedCategory
          },
          { client: aiClient }
        );

        if (aiResult.success && aiResult.data) {
          complaint.aiAnalysis = {
            status: 'Completed',
            suggestedCategory: aiResult.data.suggestedCategory,
            severity: aiResult.data.severity,
            summary: aiResult.data.summary,
            recommendedDepartment: aiResult.data.recommendedDepartment,
            suggestedAction: aiResult.data.suggestedAction,
            analyzedAt: new Date(),
            errorMessage: null
          };
          await complaint.save();
        } else {
          complaint.aiAnalysis = {
            status: 'Failed',
            suggestedCategory: null,
            severity: null,
            summary: '',
            recommendedDepartment: '',
            suggestedAction: '',
            analyzedAt: null,
            errorMessage: aiResult.error || 'AI analysis temporarily unavailable'
          };
          await complaint.save();
        }
      } catch (aiErr) {
        complaint.aiAnalysis = {
          status: 'Failed',
          suggestedCategory: null,
          severity: null,
          summary: '',
          recommendedDepartment: '',
          suggestedAction: '',
          analyzedAt: null,
          errorMessage: 'AI analysis service is temporarily unavailable.'
        };
        try {
          await complaint.save();
        } catch {
          // Ignore fallback save failure
        }
      }
    }

    // 10b. Execute Google Gemini Multimodal Image Analysis (if image file was uploaded)
    if (file && file.buffer) {
      if (isGeminiConfigured() || imageAiClient) {
        try {
          const imgAiResult = await analyzeComplaintImage(
            file.buffer,
            file.mimetype || 'image/jpeg',
            {
              optionalDescription: trimmedDescription,
              client: imageAiClient
            }
          );

          if (imgAiResult.success && imgAiResult.data) {
            complaint.imageAnalysis = {
              status: 'Completed',
              possibleIssueType: imgAiResult.data.possibleIssueType,
              shortDescription: imgAiResult.data.shortDescription,
              suggestedCategory: imgAiResult.data.suggestedCategory,
              suggestedSeverity: imgAiResult.data.suggestedSeverity,
              confidence: imgAiResult.data.confidence,
              isUnclearOrUnsuitable: imgAiResult.data.isUnclearOrUnsuitable,
              unsuitableReason: imgAiResult.data.unsuitableReason,
              analyzedAt: new Date(),
              errorMessage: null
            };
            await complaint.save();
          } else {
            complaint.imageAnalysis = {
              status: 'Failed',
              possibleIssueType: null,
              shortDescription: '',
              suggestedCategory: null,
              suggestedSeverity: null,
              confidence: null,
              isUnclearOrUnsuitable: false,
              unsuitableReason: null,
              analyzedAt: null,
              errorMessage: imgAiResult.error || 'AI image analysis failed'
            };
            await complaint.save();
          }
        } catch (imgAiErr) {
          complaint.imageAnalysis = {
            status: 'Failed',
            possibleIssueType: null,
            shortDescription: '',
            suggestedCategory: null,
            suggestedSeverity: null,
            confidence: null,
            isUnclearOrUnsuitable: false,
            unsuitableReason: null,
            analyzedAt: null,
            errorMessage: 'AI image analysis service is temporarily unavailable.'
          };
          try {
            await complaint.save();
          } catch {
            // Ignore fallback save failure
          }
        }
      } else {
        // Image was uploaded but Gemini is unconfigured
        complaint.imageAnalysis = {
          status: 'Failed',
          possibleIssueType: null,
          shortDescription: '',
          suggestedCategory: null,
          suggestedSeverity: null,
          confidence: null,
          isUnclearOrUnsuitable: false,
          unsuitableReason: null,
          analyzedAt: null,
          errorMessage: 'Google Gemini API is not configured. Please set GEMINI_API_KEY in backend/.env'
        };
        try {
          await complaint.save();
        } catch {
          // Ignore fallback save failure
        }
      }
    }

    // 11. Execute Duplicate Detection (Advisory only - never blocks or rejects complaint)
    try {
      const duplicateResult = await findPotentialDuplicates(complaint);
      complaint.duplicateCheck = duplicateResult;
      await complaint.save();
    } catch (dupErr) {
      complaint.duplicateCheck = {
        status: 'Failed',
        isPotentialDuplicate: false,
        confidence: null,
        similarityScore: 0,
        matchedComplaintIds: [],
        matchedComplaints: [],
        checkedAt: new Date(),
        errorMessage: 'Duplicate detection service is temporarily unavailable.'
      };
      try {
        await complaint.save();
      } catch {
        // Ignore fallback save failure
      }
    }

    // 12. Send Complaint Submission Email Notification (Non-blocking: respects citizen consent)
    try {
      await notifyComplaintSubmitted(complaint);
    } catch (notifyErr) {
      console.warn(`[Complaint Creation] Notification warning for ${complaint.complaintId}:`, notifyErr.message);
    }

    return complaint.toPublicJSON();
  } catch (err) {
    // Rollback uploaded image if database persistence fails
    if (resolvedImagePublicId) {
      await deleteImageFromCloudinary(resolvedImagePublicId);
    }
    throw err;
  }
};

/**
 * Retrieves public tracking details for a specific complaint by ID
 * @param {string} rawComplaintId
 * @returns {Promise<object>} Public tracking details
 */
export const getComplaintByTrackId = async (rawComplaintId) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();

  // Database Health Check
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error(
      'Database service is currently unavailable. Please verify MongoDB connection.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Query complaint with populated assignment names
  const complaint = await Complaint.findOne({ complaintId: trimmedId })
    .populate('assignedDepartment', 'name code')
    .populate('assignedOfficer', 'name');

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  return complaint.toPublicJSON();
};

// Rate limiting map for analyze requests (complaintId -> timestamp)
const recentAnalysisRequests = new Map();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds between manual re-analyses on the same ticket

/**
 * Triggers or retrieves AI analysis for an existing complaint
 * @param {string} rawComplaintId
 * @param {object} options
 * @param {boolean} [options.force=false]
 * @returns {Promise<object>}
 */
export const analyzeComplaintById = async (rawComplaintId, { force = false } = {}) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();

  // Rate limiting check to prevent abuse
  const now = Date.now();
  const lastCallTime = recentAnalysisRequests.get(trimmedId);
  if (lastCallTime && now - lastCallTime < RATE_LIMIT_WINDOW_MS) {
    const error = new Error('Analysis request in progress or requested too recently. Please wait a few seconds.');
    error.statusCode = 429;
    throw error;
  }
  recentAnalysisRequests.set(trimmedId, now);

  // Database Health Check
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error(
      'Database service is currently unavailable. Please verify MongoDB connection.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Find complaint
  const complaint = await Complaint.findOne({ complaintId: trimmedId });
  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  // Repeated analysis protection: return existing if completed and not forced
  if (complaint.aiAnalysis?.status === 'Completed' && !force) {
    return {
      message: 'Analysis already completed for this complaint',
      data: complaint.toPublicJSON(),
      cached: true
    };
  }

  // Check if Gemini is configured
  if (!isGeminiConfigured()) {
    complaint.aiAnalysis = {
      status: 'Failed',
      suggestedCategory: null,
      severity: null,
      summary: '',
      recommendedDepartment: '',
      suggestedAction: '',
      analyzedAt: null,
      errorMessage: 'Google Gemini API is not configured.'
    };
    await complaint.save();

    const error = new Error('Google Gemini API is not configured. Please set GEMINI_API_KEY in backend/.env');
    error.statusCode = 503;
    throw error;
  }

  // Execute Gemini AI analysis
  const aiResult = await analyzeComplaintText({
    title: complaint.title,
    description: complaint.description,
    category: complaint.category
  });

  if (aiResult.success && aiResult.data) {
    complaint.aiAnalysis = {
      status: 'Completed',
      suggestedCategory: aiResult.data.suggestedCategory,
      severity: aiResult.data.severity,
      summary: aiResult.data.summary,
      recommendedDepartment: aiResult.data.recommendedDepartment,
      suggestedAction: aiResult.data.suggestedAction,
      analyzedAt: new Date(),
      errorMessage: null
    };
    await complaint.save();

    return {
      message: 'Complaint analyzed successfully by Google Gemini AI',
      data: complaint.toPublicJSON(),
      cached: false
    };
  } else {
    complaint.aiAnalysis = {
      status: 'Failed',
      suggestedCategory: null,
      severity: null,
      summary: '',
      recommendedDepartment: '',
      suggestedAction: '',
      analyzedAt: null,
      errorMessage: aiResult.error || 'AI analysis temporarily unavailable'
    };
    await complaint.save();

    const error = new Error(aiResult.error || 'Failed to complete AI analysis');
    error.statusCode = 502;
    throw error;
  }
};

// Rate limiting map for duplicate check requests (complaintId -> timestamp)
const recentDuplicateRequests = new Map();
const DUPLICATE_RATE_LIMIT_MS = 5000; // 5 seconds between manual re-checks on the same ticket

/**
 * Triggers or retrieves duplicate detection for an existing complaint
 * @param {string} rawComplaintId
 * @param {object} options
 * @param {boolean} [options.force=false]
 * @returns {Promise<object>}
 */
export const checkDuplicatesById = async (rawComplaintId, { force = false } = {}) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();

  // Rate limiting check
  const now = Date.now();
  const lastCallTime = recentDuplicateRequests.get(trimmedId);
  if (lastCallTime && now - lastCallTime < DUPLICATE_RATE_LIMIT_MS) {
    const error = new Error('Duplicate check in progress or requested too recently. Please wait a few seconds.');
    error.statusCode = 429;
    throw error;
  }
  recentDuplicateRequests.set(trimmedId, now);

  // Database Health Check
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error(
      'Database service is currently unavailable. Please verify MongoDB connection.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Find complaint
  const complaint = await Complaint.findOne({ complaintId: trimmedId });
  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  // Repeated check protection: return existing if completed recently (< 5 mins) and not forced
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (
    complaint.duplicateCheck?.status === 'Completed' &&
    complaint.duplicateCheck?.checkedAt &&
    complaint.duplicateCheck.checkedAt > fiveMinutesAgo &&
    !force
  ) {
    return {
      message: 'Duplicate check recently completed for this complaint',
      data: complaint.toPublicJSON(),
      cached: true
    };
  }

  // Execute Duplicate Detection
  try {
    const duplicateResult = await findPotentialDuplicates(complaint);
    complaint.duplicateCheck = duplicateResult;
    await complaint.save();

    return {
      message: duplicateResult.isPotentialDuplicate
        ? `Found ${duplicateResult.matchedComplaints.length} potential duplicate complaint(s)`
        : 'No similar complaints found',
      data: complaint.toPublicJSON(),
      cached: false
    };
  } catch (err) {
    complaint.duplicateCheck = {
      status: 'Failed',
      isPotentialDuplicate: false,
      confidence: null,
      similarityScore: 0,
      matchedComplaintIds: [],
      matchedComplaints: [],
      checkedAt: new Date(),
      errorMessage: err.message || 'Duplicate detection failed'
    };
    await complaint.save();

    const error = new Error(err.message || 'Failed to complete duplicate detection');
    error.statusCode = 500;
    throw error;
  }
};

export default {
  ALLOWED_CATEGORIES,
  generateComplaintId,
  createComplaint,
  getComplaintByTrackId,
  analyzeComplaintById,
  checkDuplicatesById
};
