import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import {
  ALLOWED_CATEGORIES,
  ALLOWED_SEVERITY_LEVELS,
  DEFAULT_GEMINI_MODEL,
  isGeminiConfigured,
  normalizeCategory,
  normalizeSeverity
} from './geminiService.js';
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  validateImageBuffer
} from './uploadService.js';

/**
 * Validates the image input (buffer, MIME type, size, magic bytes)
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {{isValid: boolean, error?: string, mimeType?: string, format?: string}}
 */
export const validateImageInput = (imageBuffer, mimeType) => {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return {
      isValid: false,
      error: 'Image buffer is required and cannot be empty'
    };
  }

  if (imageBuffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: 'Image size exceeds maximum limit of 5MB'
    };
  }

  const normalizedMime = (mimeType || '').toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      isValid: false,
      error: `Unsupported MIME type: '${mimeType}'. Supported types: image/jpeg, image/png, image/webp`
    };
  }

  // Verify magic byte signature to guard against extension-spoofed binaries
  const { isValid, format } = validateImageBuffer(imageBuffer);
  if (!isValid) {
    return {
      isValid: false,
      error: 'Corrupted or invalid image data. Header signature does not match allowed image formats.'
    };
  }

  return {
    isValid: true,
    mimeType: normalizedMime,
    format
  };
};

/**
 * Builds the multimodal analysis prompt for Gemini vision model
 * @param {string} [optionalDescription='']
 * @returns {string}
 */
export const buildImageAnalysisPrompt = (optionalDescription = '') => {
  return `You are CivicFix AI, an expert municipal civil engineer and public hazard image analyst.
Analyze the attached photograph of a public issue reported by a citizen.

${optionalDescription ? `Citizen's Context / Description: "${optionalDescription}"\n` : ''}

CRITICAL RULES:
1. Base your analysis STRICTLY on the visible evidence in the photograph.
2. Determine if the image actually depicts a municipal/civic public issue (e.g. pothole, broken road, overflowing garbage, water leak, broken streetlight, clogged drain, fallen tree/debris).
3. If the image is blurry, corrupted, indoors, a personal selfie, a pet, or completely unrelated to civic infrastructure, set "isUnclearOrUnsuitable": true and specify "unsuitableReason".
4. If the image DOES depict a civic issue, set "isUnclearOrUnsuitable": false.
5. Provide your analysis in pure JSON matching this exact schema:

{
  "isUnclearOrUnsuitable": false,
  "unsuitableReason": null,
  "possibleIssueType": "Short specific issue name (e.g. Pothole, Road Crack, Overflowing Dumpster, Water Pipe Burst, Broken Streetlight Pole, Clogged Storm Drain)",
  "shortDescription": "1-2 sentence factual description of what is visible in the image.",
  "suggestedCategory": "One of: Road Damage, Garbage, Water Leakage, Streetlight, Drainage, Other",
  "suggestedSeverity": "One of: Low, Medium, High, Critical",
  "confidence": "One of: High, Medium, Low"
}

Severity Guidelines:
- Low: Minor surface flaw, light cosmetic debris, no hazard to pedestrians or traffic.
- Medium: Standard defect causing inconvenience (e.g. normal pothole on local street, non-functional street lamp).
- High: Serious obstacle, major pothole, sanitation hazard, or deep drainage overflow.
- Critical: Imminent danger to life or property (e.g. deep sinkhole, flooded thoroughfare, exposed energized wires).

Respond ONLY with valid JSON. No conversational preamble or trailing remarks.`;
};

/**
 * Validates, normalizes and sanitizes raw AI output object from image analysis
 * @param {object|string} rawOutput
 * @returns {{isUnclearOrUnsuitable: boolean, unsuitableReason: string|null, possibleIssueType: string, shortDescription: string, suggestedCategory: string, suggestedSeverity: string, confidence: string}}
 */
export const validateAndSanitizeImageAnalysisOutput = (rawOutput) => {
  let parsed = rawOutput;

  if (typeof rawOutput === 'string') {
    let cleaned = rawOutput.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('AI image analysis response is not valid JSON');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI image analysis output must be a structured JSON object');
  }

  const isUnclearOrUnsuitable = Boolean(parsed.isUnclearOrUnsuitable);
  const unsuitableReason = isUnclearOrUnsuitable
    ? (typeof parsed.unsuitableReason === 'string' && parsed.unsuitableReason.trim()
        ? parsed.unsuitableReason.trim().substring(0, 300)
        : 'Image is unclear, unreadable, or does not depict a public civic infrastructure issue.')
    : null;

  const possibleIssueType =
    typeof parsed.possibleIssueType === 'string' && parsed.possibleIssueType.trim()
      ? parsed.possibleIssueType.trim().substring(0, 100)
      : (isUnclearOrUnsuitable ? 'Unclear / Non-Civic Image' : 'Public Infrastructure Issue');

  const shortDescription =
    typeof parsed.shortDescription === 'string' && parsed.shortDescription.trim()
      ? parsed.shortDescription.trim().substring(0, 500)
      : (isUnclearOrUnsuitable
          ? 'Image could not be reliably classified as a public infrastructure hazard.'
          : 'Visual evidence of public issue requiring municipal review.');

  const suggestedCategory = isUnclearOrUnsuitable
    ? 'Other'
    : normalizeCategory(parsed.suggestedCategory, 'Other');

  const suggestedSeverity = isUnclearOrUnsuitable
    ? 'Low'
    : normalizeSeverity(parsed.suggestedSeverity);

  let confidence = 'Medium';
  if (typeof parsed.confidence === 'string') {
    const confLower = parsed.confidence.toLowerCase().trim();
    if (confLower === 'high') confidence = 'High';
    else if (confLower === 'low') confidence = 'Low';
    else if (confLower === 'medium') confidence = 'Medium';
  }

  return {
    isUnclearOrUnsuitable,
    unsuitableReason,
    possibleIssueType,
    shortDescription,
    suggestedCategory,
    suggestedSeverity,
    confidence
  };
};

/**
 * Analyzes a public issue image buffer using Google Gemini multimodal vision capabilities.
 * @param {Buffer} imageBuffer - Raw image buffer
 * @param {string} mimeType - Image MIME type ('image/jpeg', 'image/png', 'image/webp')
 * @param {object} [options]
 * @param {string} [options.optionalDescription=''] - Optional citizen issue description for context
 * @param {number} [options.timeoutMs=20000] - Request timeout in milliseconds
 * @param {object|null} [options.client=null] - Injected client for unit testing (avoids live API calls)
 * @returns {Promise<{success: boolean, data?: object, error?: string, model?: string}>}
 */
export const analyzeComplaintImage = async (
  imageBuffer,
  mimeType,
  { optionalDescription = '', timeoutMs = 20000, client = null } = {}
) => {
  // 1. Strict validation of image buffer and MIME type
  const validation = validateImageInput(imageBuffer, mimeType);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      data: null
    };
  }

  // 2. Guard against missing Gemini credentials
  if (!isGeminiConfigured() && !client) {
    return {
      success: false,
      error: 'Google Gemini API is not configured. Please set GEMINI_API_KEY in backend/.env',
      data: null
    };
  }

  const prompt = buildImageAnalysisPrompt(optionalDescription);
  const base64Data = imageBuffer.toString('base64');

  try {
    const ai = client || new GoogleGenAI({ apiKey: config.gemini.apiKey });

    const contents = [
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: validation.mimeType
        }
      }
    ];

    const generatePromise = ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`AI image analysis timed out after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const responseText = response.text ? response.text : String(response);

    const validatedData = validateAndSanitizeImageAnalysisOutput(responseText);

    return {
      success: true,
      data: validatedData,
      model: DEFAULT_GEMINI_MODEL
    };
  } catch (error) {
    const errMsg = (error.message || '').toLowerCase();

    // Check invalid JSON output from model
    if (errMsg.includes('not valid json') || errMsg.includes('structured json')) {
      return {
        success: false,
        error: 'AI image analysis produced invalid response format.',
        data: null
      };
    }

    // Check quota limit
    if (
      errMsg.includes('quota') ||
      errMsg.includes('resource_exhausted') ||
      errMsg.includes('429')
    ) {
      return {
        success: false,
        error: 'Google Gemini API quota limit reached. Image analysis cannot be completed right now.',
        data: null
      };
    }

    // Check authentication / API key invalid
    if (
      errMsg.includes('api_key_invalid') ||
      errMsg.includes('invalid api key') ||
      errMsg.includes('403') ||
      errMsg.includes('401')
    ) {
      return {
        success: false,
        error: 'Google Gemini API authentication failed. Please verify API key.',
        data: null
      };
    }

    // Check timeout
    if (error.name === 'TimeoutError' || errMsg.includes('timeout')) {
      return {
        success: false,
        error: 'Google Gemini image analysis timed out. The service may be experiencing high latency.',
        data: null
      };
    }

    // Generic safe error fallback
    return {
      success: false,
      error: 'AI image analysis service is temporarily unavailable.',
      data: null
    };
  }
};

export default {
  validateImageInput,
  buildImageAnalysisPrompt,
  validateAndSanitizeImageAnalysisOutput,
  analyzeComplaintImage
};
