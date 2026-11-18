/**
 * CivicFix AI - Frontend API Service
 * Centralizes all HTTP communication with the backend service.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'civicfix_token';
const USER_KEY = 'civicfix_user';

/**
 * Token and Session Storage Helpers
 */
export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to access localStorage:', err);
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.error('Failed to access localStorage:', err);
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
};

/**
 * Checks the health status of the CivicFix AI backend service.
 * @param {number} timeoutMs - Max time in ms before aborting the request (default: 5000ms)
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const checkHealth = async (timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    clearTimeout(timeoutId);
    let errorMessage = error.message;

    if (error.name === 'AbortError') {
      errorMessage = 'Backend connection timed out (server unreachable)';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = 'Unable to reach backend server. Ensure backend is running on ' + API_BASE_URL;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Fetches the root endpoint of the CivicFix AI backend.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getRoot = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Registers a new citizen user account
 * @param {{name: string, email: string, password: string}} credentials
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const registerApi = async ({ name, email, password }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Registration failed with status ${response.status}`
      };
    }

    // Save token and user info upon successful registration
    if (data.data?.token) {
      setStoredToken(data.data.token);
      setStoredUser(data.data.user);
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error during registration'
    };
  }
};

/**
 * Authenticates user credentials and retrieves JWT
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const loginApi = async ({ email, password }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Login failed with status ${response.status}`
      };
    }

    // Save token and user info upon successful login
    if (data.data?.token) {
      setStoredToken(data.data.token);
      setStoredUser(data.data.user);
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error during login'
    };
  }
};

/**
 * Fetches the currently authenticated user's profile
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getMeApi = async () => {
  const token = getStoredToken();

  if (!token) {
    return {
      success: false,
      error: 'No active session token found'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        clearSession();
      }
      return {
        success: false,
        error: data.message || 'Failed to authenticate user session'
      };
    }

    setStoredUser(data.data);

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to retrieve profile'
    };
  }
};

/**
 * Submits a new public complaint report (Supports JSON and multipart/form-data with image)
 * @param {object|FormData} complaintData - Form fields or FormData instance
 * @param {File|Blob|null} [imageFile] - Optional image file attachment
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const submitComplaintApi = async (complaintData, imageFile = null) => {
  try {
    const token = getStoredToken();
    const headers = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let body;

    if (complaintData instanceof FormData) {
      // Direct FormData provided
      body = complaintData;
    } else if (imageFile) {
      // Build FormData with fields and image file
      const formData = new FormData();
      Object.entries(complaintData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });
      formData.append('image', imageFile);
      body = formData;
    } else {
      // Standard JSON payload
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(complaintData);
    }

    const response = await fetch(`${API_BASE_URL}/api/complaints`, {
      method: 'POST',
      headers,
      body
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Complaint submission failed (${response.status})`
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error during complaint submission'
    };
  }
};

/**
 * Tracks a complaint status by unique Complaint ID
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const trackComplaintApi = async (complaintId) => {
  try {
    if (!complaintId || !complaintId.trim()) {
      return {
        success: false,
        error: 'Please enter a complaint ID to track'
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/api/complaints/track/${encodeURIComponent(complaintId.trim())}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to find complaint ${complaintId}`
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while tracking complaint'
    };
  }
};

/**
 * Triggers or retrieves Google Gemini AI analysis for a complaint
 * @param {string} complaintId
 * @param {boolean} [force=false]
 * @returns {Promise<{success: boolean, data?: object, message?: string, cached?: boolean, error?: string}>}
 */
export const analyzeComplaintApi = async (complaintId, force = false) => {
  try {
    if (!complaintId || !complaintId.trim()) {
      return {
        success: false,
        error: 'Please enter a valid complaint ID'
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/api/complaints/${encodeURIComponent(complaintId.trim())}/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ force })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `AI analysis failed (${response.status})`
      };
    }

    return {
      success: true,
      data: data.data,
      message: data.message,
      cached: Boolean(data.cached)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while requesting AI analysis'
    };
  }
};

/**
 * Triggers or retrieves duplicate complaint detection results
 * @param {string} complaintId
 * @param {boolean} [force=false]
 * @returns {Promise<{success: boolean, data?: object, message?: string, cached?: boolean, error?: string}>}
 */
export const checkDuplicatesApi = async (complaintId, force = false) => {
  try {
    if (!complaintId || !complaintId.trim()) {
      return {
        success: false,
        error: 'Please enter a valid complaint ID'
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/api/complaints/${encodeURIComponent(complaintId.trim())}/check-duplicates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ force })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Duplicate detection failed (${response.status})`
      };
    }

    return {
      success: true,
      data: data.data,
      message: data.message,
      cached: Boolean(data.cached)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while checking for duplicates'
    };
  }
};

/**
 * Retrieves aggregate statistics for municipal admin dashboard
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const getAdminStatsApi = async () => {
  const token = getStoredToken();
  if (!token) {
    return {
      success: false,
      error: 'Unauthorized: Administrator authentication token required'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to fetch admin stats (${response.status})`
      };
    }

    return {
      success: true,
      data: data.stats || data.data?.stats,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while fetching dashboard statistics'
    };
  }
};

/**
 * Retrieves filtered, searched, and paginated complaints for municipal admin management
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, pagination?: object, message?: string, error?: string}>}
 */
export const getAdminComplaintsApi = async ({
  search = '',
  category = '',
  status = '',
  severity = '',
  sortBy = 'newest',
  page = 1,
  limit = 10
} = {}) => {
  const token = getStoredToken();
  if (!token) {
    return {
      success: false,
      error: 'Unauthorized: Administrator authentication token required'
    };
  }

  const queryParams = new URLSearchParams();
  if (search && search.trim()) queryParams.append('search', search.trim());
  if (category && category !== 'all') queryParams.append('category', category);
  if (status && status !== 'all') queryParams.append('status', status);
  if (severity && severity !== 'all') queryParams.append('severity', severity);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (page) queryParams.append('page', String(page));
  if (limit) queryParams.append('limit', String(limit));

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to fetch complaints list (${response.status})`
      };
    }

    return {
      success: true,
      data: data.data || [],
      pagination: data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while fetching complaints list'
    };
  }
};

/**
 * Retrieves full details of a specific complaint for admin inspection
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const getAdminComplaintDetailsApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) {
    return {
      success: false,
      error: 'Unauthorized: Administrator authentication token required'
    };
  }

  if (!complaintId || !complaintId.trim()) {
    return {
      success: false,
      error: 'Valid complaint ID is required'
    };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints/${encodeURIComponent(complaintId.trim())}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to fetch complaint details (${response.status})`
      };
    }

    return {
      success: true,
      data: data.complaint || data.data?.complaint,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while fetching complaint details'
    };
  }
};

/**
 * Updates the resolution status of a complaint by administrator with an optional note
 * @param {string} complaintId
 * @param {string} status ('Pending' | 'In Progress' | 'Resolved')
 * @param {string} [note='']
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const updateComplaintStatusApi = async (complaintId, status, note = '') => {
  const token = getStoredToken();
  if (!token) {
    return {
      success: false,
      error: 'Unauthorized: Administrator authentication token required'
    };
  }

  if (!complaintId || !complaintId.trim()) {
    return {
      success: false,
      error: 'Valid complaint ID is required'
    };
  }

  if (!status || !['Pending', 'In Progress', 'Resolved'].includes(status.trim())) {
    return {
      success: false,
      error: 'Status must be one of: Pending, In Progress, Resolved'
    };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints/${encodeURIComponent(complaintId.trim())}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: status.trim(),
          note: note ? String(note).trim() : undefined
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to update status (${response.status})`
      };
    }

    return {
      success: true,
      data: data.complaint || data.data?.complaint,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while updating complaint status'
    };
  }
};

/**
 * Retrieves the full audit history and status transition log for a complaint
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const getAdminComplaintHistoryApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) {
    return {
      success: false,
      error: 'Unauthorized: Administrator authentication token required'
    };
  }

  if (!complaintId || !complaintId.trim()) {
    return {
      success: false,
      error: 'Valid complaint ID is required'
    };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints/${encodeURIComponent(complaintId.trim())}/history`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `Failed to fetch status history (${response.status})`
      };
    }

    return {
      success: true,
      data: data.history || data.data?.history,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error while fetching complaint status history'
    };
  }
};

/**
 * Retrieves all municipal departments (Admin Only)
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getAdminDepartmentsApi = async () => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/departments`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch departments' };
    }

    return { success: true, data: data.data?.departments || [] };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching departments' };
  }
};

/**
 * Creates a new municipal department (Admin Only)
 * @param {object} departmentData
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const createAdminDepartmentApi = async ({ name, code, description }) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, code, description })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to create department' };
    }

    return { success: true, data: data.data?.department, message: data.message };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while creating department' };
  }
};

/**
 * Updates an existing municipal department (Admin Only)
 * @param {string} departmentId
 * @param {object} updates
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateAdminDepartmentApi = async (departmentId, updates) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/departments/${departmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to update department' };
    }

    return { success: true, data: data.data?.department, message: data.message };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while updating department' };
  }
};

/**
 * Retrieves all field officers (Admin Only)
 * @param {string} [departmentId]
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getAdminOfficersApi = async (departmentId = '') => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/officers${query}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officers' };
    }

    return { success: true, data: data.data?.officers || [] };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching officers' };
  }
};

/**
 * Assigns a complaint to a department and field officer (Admin Only)
 * @param {string} complaintId
 * @param {object} assignmentData
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const assignComplaintApi = async (complaintId, { departmentId, officerId = null, note = '' }) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints/${encodeURIComponent(complaintId.trim())}/assignment`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ departmentId, officerId, note })
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to assign complaint' };
    }

    return { success: true, data: data.data?.complaint, message: data.message };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while assigning complaint' };
  }
};

/**
 * Retrieves chronological assignment history for a complaint (Admin Only)
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getComplaintAssignmentHistoryApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/complaints/${encodeURIComponent(complaintId.trim())}/assignment-history`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch assignment history' };
    }

    return { success: true, data: data.data?.history || data.history };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching assignment history' };
  }
};

/**
 * Retrieves dashboard KPI statistics for the authenticated field officer (Officer Only)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getOfficerStatsApi = async () => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Officer authentication token required' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/officer/dashboard/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer dashboard stats' };
    }

    return { success: true, data: data.data?.stats };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching officer stats' };
  }
};

/**
 * Retrieves complaints assigned to the authenticated field officer (Officer Only)
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, pagination?: object, error?: string}>}
 */
export const getOfficerComplaintsApi = async ({
  status = '',
  search = '',
  sortBy = 'newest',
  page = 1,
  limit = 10
} = {}) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Officer authentication token required' };
  }

  try {
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (search) queryParams.append('search', search);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);

    const response = await fetch(`${API_BASE_URL}/api/officer/complaints?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch assigned complaints' };
    }

    return {
      success: true,
      data: data.data || [],
      pagination: data.pagination
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching assigned complaints' };
  }
};

/**
 * Retrieves details for a complaint assigned to the authenticated field officer (Officer Only)
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getOfficerComplaintDetailsApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Officer authentication token required' };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(complaintId.trim())}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch complaint details' };
    }

    return { success: true, data: data.data?.complaint };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching complaint details' };
  }
};

/**
 * Updates status of an assigned complaint ('In Progress' or 'Resolved') by the field officer
 * @param {string} complaintId
 * @param {string} status
 * @param {string} [note]
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateOfficerComplaintStatusApi = async (complaintId, status, note = '') => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Officer authentication token required' };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(complaintId.trim())}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, note })
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to update complaint status' };
    }

    return { success: true, data: data.data?.complaint, message: data.message };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while updating complaint status' };
  }
};

/**
 * Retrieves geographic complaints for municipal admin interactive map
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getAdminMapComplaintsApi = async ({
  category = '',
  status = '',
  severity = '',
  department = '',
  officer = '',
  startDate = '',
  endDate = '',
  limit = 500
} = {}) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Admin authentication token required' };
  }

  try {
    const queryParams = new URLSearchParams();
    if (category && category !== 'all') queryParams.append('category', category);
    if (status && status !== 'all') queryParams.append('status', status);
    if (severity && severity !== 'all') queryParams.append('severity', severity);
    if (department && department !== 'all') queryParams.append('department', department);
    if (officer && officer !== 'all') queryParams.append('officer', officer);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (limit) queryParams.append('limit', limit);

    const response = await fetch(`${API_BASE_URL}/api/admin/map/complaints?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch admin map complaints' };
    }

    return {
      success: true,
      data: data.data?.complaints || []
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching map complaints' };
  }
};

/**
 * Retrieves geographic complaints assigned to authenticated field officer
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getOfficerMapComplaintsApi = async ({
  status = '',
  category = '',
  limit = 250
} = {}) => {
  const token = getStoredToken();
  if (!token) {
    return { success: false, error: 'Unauthorized: Officer authentication token required' };
  }

  try {
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (category && category !== 'all') queryParams.append('category', category);
    if (limit) queryParams.append('limit', limit);

    const response = await fetch(`${API_BASE_URL}/api/officer/map/complaints?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer map complaints' };
    }

    return {
      success: true,
      data: data.data?.complaints || []
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching officer map complaints' };
  }
};

/**
 * Retrieves public-safe complaint markers with location approximation (Public / Citizens)
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getPublicMapComplaintsApi = async ({
  category = '',
  status = '',
  limit = 100
} = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (category && category !== 'all') queryParams.append('category', category);
    if (status && status !== 'all') queryParams.append('status', status);
    if (limit) queryParams.append('limit', limit);

    const response = await fetch(`${API_BASE_URL}/api/complaints/map?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch public map markers' };
    }

    return {
      success: true,
      data: data.data?.complaints || []
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error while fetching public map markers' };
  }
};

/**
 * Retrieves the current authenticated user's notification preferences
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getNotificationPreferencesApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch preferences' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching notification preferences' };
  }
};

/**
 * Updates the current authenticated user's notification preferences
 * @param {boolean} emailNotificationsEnabled
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateNotificationPreferencesApi = async (emailNotificationsEnabled) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ emailNotificationsEnabled })
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to update preferences' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error updating notification preferences' };
  }
};

/**
 * Retrieves paginated notification audit logs (Admin Only)
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getAdminNotificationsApi = async ({
  status = '',
  eventType = '',
  complaintId = '',
  page = 1,
  limit = 20
} = {}) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Administrator authentication required' };
    }

    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (eventType && eventType !== 'all') queryParams.append('eventType', eventType);
    if (complaintId) queryParams.append('complaintId', complaintId);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/admin/notifications${query}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch notification logs' };
    }

    return {
      success: true,
      data: data.data?.notifications || [],
      pagination: data.data?.pagination || null
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching notification logs' };
  }
};

/**
 * ============================================================================
 * Phase 14: Advanced Analytics APIs
 * ============================================================================
 */

/**
 * Builds query string from analytics filter options
 */
const buildAnalyticsQueryString = (options = {}) => {
  const params = new URLSearchParams();
  if (options.range) params.append('range', options.range);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.interval) params.append('interval', options.interval);
  if (options.type) params.append('type', options.type);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

/**
 * Admin: GET /api/admin/analytics/overview
 */
export const getAdminAnalyticsOverviewApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/overview${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch analytics overview' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching analytics overview' };
  }
};

/**
 * Admin: GET /api/admin/analytics/trends
 */
export const getAdminAnalyticsTrendsApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/trends${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch complaint trends' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching complaint trends' };
  }
};

/**
 * Admin: GET /api/admin/analytics/categories
 */
export const getAdminAnalyticsCategoriesApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/categories${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch category analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching category analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/departments
 */
export const getAdminAnalyticsDepartmentsApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/departments${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch department performance analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching department analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/officers
 */
export const getAdminAnalyticsOfficersApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/officers${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch officer analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching officer analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/resolution
 */
export const getAdminAnalyticsResolutionApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/resolution${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch resolution analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching resolution analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/severity
 */
export const getAdminAnalyticsSeverityApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/severity${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch AI severity analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching AI severity analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/geography
 */
export const getAdminAnalyticsGeographyApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/geography${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch geographic analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching geographic analytics' };
  }
};

/**
 * Admin: GET /api/admin/analytics/export
 * Downloads sanitized CSV analytics export
 */
export const downloadAdminAnalyticsCsvApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/admin/analytics/export${qs}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to download analytics CSV export' };
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    let filename = 'civicfix-analytics.csv';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    // Trigger browser file download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename };
  } catch (error) {
    return { success: false, error: error.message || 'Network error downloading CSV export' };
  }
};

/**
 * Officer: GET /api/officer/analytics/overview
 * Scoped strictly to authenticated officer
 */
export const getOfficerAnalyticsOverviewApi = async (options = {}) => {
  try {
    const token = getStoredToken();
    const qs = buildAnalyticsQueryString(options);
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/officer/analytics/overview${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch officer analytics' };
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching officer analytics' };
  }
};

export default {
  API_BASE_URL,
  checkHealth,
  getRoot,
  registerApi,
  loginApi,
  getMeApi,
  submitComplaintApi,
  trackComplaintApi,
  analyzeComplaintApi,
  checkDuplicatesApi,
  getAdminStatsApi,
  getAdminComplaintsApi,
  getAdminComplaintDetailsApi,
  getAdminComplaintHistoryApi,
  updateComplaintStatusApi,
  getAdminDepartmentsApi,
  createAdminDepartmentApi,
  updateAdminDepartmentApi,
  getAdminOfficersApi,
  assignComplaintApi,
  getComplaintAssignmentHistoryApi,
  getOfficerStatsApi,
  getOfficerComplaintsApi,
  getOfficerComplaintDetailsApi,
  updateOfficerComplaintStatusApi,
  getAdminMapComplaintsApi,
  getOfficerMapComplaintsApi,
  getPublicMapComplaintsApi,
  getNotificationPreferencesApi,
  updateNotificationPreferencesApi,
  getAdminNotificationsApi,
  getAdminAnalyticsOverviewApi,
  getAdminAnalyticsTrendsApi,
  getAdminAnalyticsCategoriesApi,
  getAdminAnalyticsDepartmentsApi,
  getAdminAnalyticsOfficersApi,
  getAdminAnalyticsResolutionApi,
  getAdminAnalyticsSeverityApi,
  getAdminAnalyticsGeographyApi,
  downloadAdminAnalyticsCsvApi,
  getOfficerAnalyticsOverviewApi,
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  clearSession
};
