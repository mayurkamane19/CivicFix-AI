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
 * @param {boolean|object} preferencesOrEnabled
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateNotificationPreferencesApi = async (preferencesOrEnabled) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const payload = typeof preferencesOrEnabled === 'boolean'
      ? { emailNotificationsEnabled: preferencesOrEnabled }
      : (typeof preferencesOrEnabled === 'object' ? preferencesOrEnabled : {});

    const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
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
 * Retrieves paginated in-app notifications for the authenticated user
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, pagination?: object, unreadCount?: number, error?: string}>}
 */
export const getUserNotificationsApi = async ({
  page = 1,
  limit = 20,
  status = 'all',
  category = 'all',
  search = ''
} = {}) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (status && status !== 'all') queryParams.append('status', status);
    if (category && category !== 'all') queryParams.append('category', category);
    if (search && search.trim()) queryParams.append('search', search.trim());

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/notifications${query}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch notifications' };
    }

    return {
      success: true,
      data: data.data?.notifications || [],
      pagination: data.data?.pagination || null,
      unreadCount: data.data?.unreadCount || 0
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching notifications' };
  }
};

/**
 * Retrieves unread notification count for the authenticated user (for polling badge)
 * @returns {Promise<{success: boolean, data?: {unreadCount: number}, error?: string}>}
 */
export const getUnreadCountApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch unread count' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching unread count' };
  }
};

/**
 * Marks a notification as read
 * @param {string} notificationId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const markNotificationReadApi = async (notificationId) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to mark notification as read' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error updating notification' };
  }
};

/**
 * Marks all notifications as read for current user
 * @returns {Promise<{success: boolean, data?: {count: number}, error?: string}>}
 */
export const markAllNotificationsReadApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to mark all as read' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error marking all as read' };
  }
};

/**
 * Dismisses/archives a notification for current user
 * @param {string} notificationId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const deleteNotificationApi = async (notificationId) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to delete notification' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error deleting notification' };
  }
};

/**
 * Clears (archives) all read notifications for current user
 * @returns {Promise<{success: boolean, data?: {count: number}, error?: string}>}
 */
export const clearReadNotificationsApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to clear read notifications' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error clearing notifications' };
  }
};

/**
 * Broadcasts system announcement (Admin only)
 * @param {object} payload
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const broadcastAnnouncementApi = async (payload) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Administrator authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/announcement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to broadcast announcement' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error broadcasting announcement' };
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

/**
 * ============================================================================
 * Mini Phase 16: Citizen Feedback & Rating APIs
 * ============================================================================
 */

/**
 * Citizen: POST /api/feedback/:complaintId
 * Submits citizen rating (1-5) and optional comment for a resolved complaint
 * @param {string} complaintId
 * @param {{rating: number, comment?: string}} payload
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const submitFeedbackApi = async (complaintId, { rating, comment = '' } = {}) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required to submit feedback' };
    }

    const response = await fetch(`${API_BASE_URL}/api/feedback/${encodeURIComponent(complaintId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rating, comment })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to submit feedback' };
    }
    return { success: true, data: data.feedback };
  } catch (error) {
    return { success: false, error: error.message || 'Network error submitting feedback' };
  }
};

/**
 * Citizen / Admin: GET /api/feedback/complaint/:complaintId
 * Retrieves feedback for a specific complaint
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object|null, error?: string}>}
 */
export const getComplaintFeedbackApi = async (complaintId) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required to retrieve feedback' };
    }

    const response = await fetch(`${API_BASE_URL}/api/feedback/complaint/${encodeURIComponent(complaintId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch complaint feedback' };
    }
    return { success: true, data: data.feedback };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching complaint feedback' };
  }
};

/**
 * Citizen: GET /api/feedback/my
 * Retrieves all feedback submitted by the authenticated citizen
 * @returns {Promise<{success: boolean, data?: Array<object>, count?: number, error?: string}>}
 */
export const getMyFeedbackApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Authentication required to retrieve feedback history' };
    }

    const response = await fetch(`${API_BASE_URL}/api/feedback/my`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch citizen feedback history' };
    }
    return { success: true, data: data.feedbacks, count: data.count };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching feedback history' };
  }
};

/**
 * Admin: GET /api/admin/feedback
 * Retrieves paginated, filtered feedback records for administrative audit.
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {number|string} [options.rating='']
 * @param {string} [options.search='']
 * @returns {Promise<{success: boolean, data?: Array<object>, pagination?: object, error?: string}>}
 */
export const getAdminFeedbackApi = async ({
  page = 1,
  limit = 10,
  rating = '',
  search = ''
} = {}) => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Administrator authentication token required' };
    }

    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (rating && rating !== 'all') queryParams.append('rating', rating);
    if (search && search.trim()) queryParams.append('search', search.trim());

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/feedback${qs}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch admin feedback records' };
    }

    return {
      success: true,
      data: data.data?.feedbacks || [],
      pagination: data.data?.pagination || {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching admin feedback' };
  }
};

/**
 * Admin: GET /api/admin/feedback/stats
 * Retrieves aggregated satisfaction metrics and rating distribution for admin dashboard.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getAdminFeedbackStatsApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) {
      return { success: false, error: 'Unauthorized: Administrator authentication token required' };
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/feedback/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch admin feedback statistics' };
    }

    return {
      success: true,
      data: data.data?.stats || data.data
    };
  } catch (error) {
    return { success: false, error: error.message || 'Network error fetching feedback statistics' };
  }
};

/**
 * Admin: GET /api/admin/sla/config
 */
export const getAdminSlaConfigApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/sla/config`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch SLA configuration' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching SLA configuration' };
  }
};

/**
 * Admin: PUT /api/admin/sla/config
 */
export const updateAdminSlaConfigApi = async (configPayload) => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/sla/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(configPayload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to update SLA configuration' };
    }
    return { success: true, data: data.data?.config || data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating SLA configuration' };
  }
};

/**
 * Admin: GET /api/admin/sla/overview
 */
export const getAdminSlaOverviewApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/sla/overview`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch SLA overview metrics' };
    }
    return { success: true, data: data.data?.stats || data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching SLA overview' };
  }
};

/**
 * Admin: GET /api/admin/sla/overdue
 */
export const getAdminOverdueComplaintsApi = async ({
  department = '',
  priority = '',
  search = '',
  page = 1,
  limit = 10
} = {}) => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (department && department !== 'all') params.append('department', department);
    if (priority && priority !== 'all') params.append('priority', priority);
    if (search && search.trim()) params.append('search', search.trim());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/admin/sla/overdue${qs}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch overdue complaints' };
    }
    return {
      success: true,
      data: data.data?.complaints || [],
      pagination: data.data?.pagination || { total: 0, page: 1, totalPages: 1 }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching overdue complaints' };
  }
};

/**
 * Admin: GET /api/admin/escalations
 */
export const getAdminEscalationsApi = async ({
  level = '',
  department = '',
  complaintId = '',
  page = 1,
  limit = 15
} = {}) => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (level && level !== 'all') params.append('level', level);
    if (department && department !== 'all') params.append('department', department);
    if (complaintId && complaintId.trim()) params.append('complaintId', complaintId.trim());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/admin/escalations${qs}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch escalation logs' };
    }
    return {
      success: true,
      data: data.data?.escalations || [],
      pagination: data.data?.pagination || { total: 0, page: 1, totalPages: 1 }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching escalation logs' };
  }
};

export const getAdminEscalationLogsApi = getAdminEscalationsApi;

/**
 * Admin: GET /api/admin/escalations/:complaintId
 */
export const getComplaintEscalationHistoryApi = async (complaintId) => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/escalations/${encodeURIComponent(complaintId)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch complaint escalation history' };
    }
    return { success: true, data: data.data?.escalations || [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching complaint escalation history' };
  }
};

/**
 * Admin: POST /api/admin/escalations/:complaintId/manual
 */
export const manualEscalateComplaintApi = async (complaintId, { reason }) => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/escalations/${encodeURIComponent(complaintId)}/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to manually escalate complaint' };
    }
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error manually escalating complaint' };
  }
};

/**
 * Admin: POST /api/admin/sla/evaluate
 */
export const triggerSlaEvaluationApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Administrator authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/admin/sla/evaluate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to trigger SLA evaluation' };
    }
    return { success: true, data: data.data?.summary || data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error triggering SLA evaluation' };
  }
};

/**
 * Officer: GET /api/officer/sla
 */
export const getOfficerSlaOverviewApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Officer authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/officer/sla`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer SLA overview' };
    }
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching officer SLA overview' };
  }
};

/**
 * Officer: GET /api/officer/escalations
 */
export const getOfficerEscalationsApi = async () => {
  try {
    const token = getStoredToken();
    if (!token) return { success: false, error: 'Officer authorization required' };

    const res = await fetch(`${API_BASE_URL}/api/officer/escalations`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer escalations' };
    }
    return { success: true, data: data.data?.escalations || [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching officer escalations' };
  }
};

/**
 * Phase 19: Officer Workspace & Priority Queue API
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getOfficerWorkspaceApi = async (params = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const res = await fetch(`${API_BASE_URL}/api/officer/workspace?${qs.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer workspace' };
    }
    return {
      success: true,
      data: {
        metrics: data.metrics,
        complaints: data.complaints,
        pagination: data.pagination
      }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching officer workspace' };
  }
};

/**
 * Phase 19: Upload Resolution Evidence Photos
 * @param {string} complaintId
 * @param {FormData} formData
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const uploadResolutionEvidenceApi = async (complaintId, formData) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(complaintId)}/resolution/evidence`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to upload resolution evidence' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error uploading resolution evidence' };
  }
};

/**
 * Phase 19: Submit Officer Resolution Evidence and Mark Resolved
 * @param {string} complaintId
 * @param {FormData|object} payload
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const submitOfficerResolutionApi = async (complaintId, payload) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const isFormData = payload instanceof FormData;
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(complaintId)}/resolution/submit`, {
      method: 'POST',
      headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to submit officer resolution' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error submitting officer resolution' };
  }
};

/**
 * Phase 19: Fetch Resolution Details (for citizen verification or admin inspection)
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getComplaintResolutionApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/complaints/${encodeURIComponent(complaintId)}/resolution`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch resolution details' };
    }
    return { success: true, data: data.resolution || data.data?.resolution };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching resolution details' };
  }
};

/**
 * Phase 19: Citizen Verifies and Confirms Resolution
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const verifyResolutionApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/complaints/${encodeURIComponent(complaintId)}/resolution/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to verify resolution' };
    }
    return { success: true, message: data.message, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error verifying resolution' };
  }
};

/**
 * Phase 19: Citizen Rejects Resolution and Reopens Complaint
 * @param {string} complaintId
 * @param {FormData|object} payload
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const rejectResolutionApi = async (complaintId, payload) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const isFormData = payload instanceof FormData;
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE_URL}/api/complaints/${encodeURIComponent(complaintId)}/resolution/reject`, {
      method: 'POST',
      headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to contest resolution' };
    }
    return { success: true, message: data.message, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error contesting resolution' };
  }
};

/**
 * Phase 19: Admin Resolutions List
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getAdminResolutionsApi = async (params = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const res = await fetch(`${API_BASE_URL}/api/admin/resolutions?${qs.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch administrative resolutions' };
    }
    return {
      success: true,
      data: {
        resolutions: data.resolutions || [],
        pagination: data.pagination
      }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching resolutions list' };
  }
};

/**
 * Phase 19: Admin Resolution Overview Stats
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getAdminResolutionStatsApi = async () => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/resolutions/stats`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch resolution stats' };
    }
    return { success: true, data: data.stats || data.data?.stats };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching resolution stats' };
  }
};

/**
 * Phase 19: Admin Resolution Details
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getAdminResolutionDetailsApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/resolutions/${encodeURIComponent(complaintId)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch resolution details' };
    }
    return { success: true, data: data.resolution || data.data?.resolution };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching resolution details' };
  }
};

/**
 * Phase 19: Admin Review Disputed Resolution
 * @param {string} complaintId
 * @param {object} reviewData
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const reviewAdminResolutionApi = async (complaintId, reviewData) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/resolutions/${encodeURIComponent(complaintId)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(reviewData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to review resolution' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error reviewing resolution' };
  }
};

/**
 * Phase 19: Field Officer Performance Analytics
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getOfficerPerformanceAnalyticsApi = async (params = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const res = await fetch(`${API_BASE_URL}/api/admin/analytics/officers/performance?${qs.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch officer performance analytics' };
    }
    return { success: true, data: data.analytics || data.data?.analytics || [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching officer performance analytics' };
  }
};

/**
 * Phase 20: Citizen Dashboard Statistics & Recent Activity
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getCitizenDashboardApi = async () => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/complaints/my/dashboard`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch citizen dashboard' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching citizen dashboard' };
  }
};

/**
 * Phase 20: Citizen My Complaints List with Search, Filter & Pagination
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: array, pagination?: object, error?: string}>}
 */
export const getMyCitizenComplaintsApi = async (params = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const res = await fetch(`${API_BASE_URL}/api/complaints/my/complaints?${qs.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch complaints' };
    }
    return {
      success: true,
      data: Array.isArray(data.data) ? data.data : (data.complaints || []),
      pagination: data.pagination || { total: 0, page: 1, pages: 1, limit: 10 }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching complaints' };
  }
};

/**
 * Phase 20: Citizen Authenticated Complaint Details (Anti-IDOR)
 * @param {string} complaintId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getMyCitizenComplaintDetailsApi = async (complaintId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/complaints/my/${encodeURIComponent(complaintId)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch complaint details' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching complaint details' };
  }
};

/**
 * Phase 20: Citizen Profile Update (name, phone, notificationPreferences)
 * @param {object} profileData
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateMyProfileApi = async (profileData) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No active session token found' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to update profile' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating profile' };
  }
};

/**
 * Phase 21: Get VAPID Public Key for Web Push Subscriptions
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getPushPublicKeyApi = async () => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/push/public-key`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to fetch public key' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching VAPID key' };
  }
};

/**
 * Phase 21: Register Web Push Subscription
 * @param {object} subscriptionJSON
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const subscribePushApi = async (subscriptionJSON) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to register push subscription' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error subscribing to push' };
  }
};

/**
 * Phase 21: Unsubscribe Web Push Subscription
 * @param {string} endpoint
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const unsubscribePushApi = async (endpoint) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ endpoint })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to unsubscribe from push' };
    }
    return { success: true, data: data.data || data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error unsubscribing from push' };
  }
};

/**
 * Phase 22: Create Municipal Ward
 * @param {object} wardData
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const createWardApi = async (wardData) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(wardData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to create ward' };
    }
    return { success: true, data: data.data?.ward || data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error creating ward' };
  }
};

/**
 * Phase 22: Get Wards List
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: Array, pagination?: object, error?: string}>}
 */
export const getWardsApi = async ({ search = '', zone = '', isActive = '', page = 1, limit = 10 } = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (zone && zone !== 'all') query.append('zone', zone);
    if (isActive !== '' && isActive !== 'all') query.append('isActive', isActive);
    query.append('page', page);
    query.append('limit', limit);

    const res = await fetch(`${API_BASE_URL}/api/wards?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to retrieve wards' };
    }
    return { success: true, data: data.data || [], pagination: data.pagination };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching wards' };
  }
};

/**
 * Phase 22: Get Ward Details by ID
 * @param {string} wardId
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getWardDetailsApi = async (wardId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to retrieve ward details' };
    }
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching ward details' };
  }
};

/**
 * Phase 22: Update Ward
 * @param {string} wardId
 * @param {object} updates
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const updateWardApi = async (wardId, updates) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to update ward' };
    }
    return { success: true, data: data.data?.ward || data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating ward' };
  }
};

/**
 * Phase 22: Toggle Ward Status (Activate / Deactivate)
 * @param {string} wardId
 * @param {boolean} isActive
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const toggleWardStatusApi = async (wardId, isActive) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ isActive })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to toggle ward status' };
    }
    return { success: true, data: data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error toggling ward status' };
  }
};

/**
 * Phase 22: Delete Ward
 * @param {string} wardId
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export const deleteWardApi = async (wardId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to delete ward' };
    }
    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error deleting ward' };
  }
};

/**
 * Phase 22: Get Ward Officers
 * @param {string} wardId
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getWardOfficersApi = async (wardId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/officers`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to retrieve ward officers' };
    }
    return { success: true, data: data.data?.officers || [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching ward officers' };
  }
};

/**
 * Phase 22: Assign Officers to Ward
 * @param {string} wardId
 * @param {Array<string>} officerIds
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const assignWardOfficersApi = async (wardId, officerIds) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/officers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ officerIds })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to assign officers' };
    }
    return { success: true, data: data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error assigning officers' };
  }
};

/**
 * Phase 22: Remove Officer from Ward
 * @param {string} wardId
 * @param {string} officerId
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export const removeWardOfficerApi = async (wardId, officerId) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/officers/${officerId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to remove officer' };
    }
    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error removing officer' };
  }
};

/**
 * Phase 22: Assign Departments to Ward
 * @param {string} wardId
 * @param {Array<string>} departmentIds
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const assignWardDepartmentsApi = async (wardId, departmentIds) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ departmentIds })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to assign departments' };
    }
    return { success: true, data: data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error assigning departments' };
  }
};

/**
 * Phase 22: Inter-Ward Complaint Transfer
 * @param {string} complaintId
 * @param {object} data - { destinationWardId, destinationDepartmentId, reason }
 * @returns {Promise<{success: boolean, data?: object, message?: string, error?: string}>}
 */
export const transferComplaintWardApi = async (complaintId, { destinationWardId, destinationDepartmentId, reason }) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/complaints/${complaintId}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ destinationWardId, destinationDepartmentId, reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to transfer complaint between wards' };
    }
    return { success: true, data: data.data, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error transferring complaint' };
  }
};

/**
 * Phase 22: Get Municipal Multi-Ward Overview & KPIs
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getMunicipalOverviewApi = async () => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/wards/overview`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to retrieve municipal overview' };
    }
    return { success: true, data: data.data?.stats || data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching municipal overview' };
  }
};

/**
 * Phase 22: Get Ward Analytics
 * @param {string} wardId
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getWardAnalyticsApi = async (wardId, { startDate = '', endDate = '' } = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Authorization required' };

  try {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);

    const res = await fetch(`${API_BASE_URL}/api/wards/${wardId}/analytics?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to retrieve ward analytics' };
    }
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching ward analytics' };
  }
};

/**
 * Phase 22: Export Municipal Complaints CSV
 * @param {object} params
 * @returns {Promise<{success: boolean, blob?: Blob, filename?: string, error?: string}>}
 */
export const exportMunicipalWardCsvApi = async ({ wardId = '', startDate = '', endDate = '' } = {}) => {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'Administrator authorization required' };

  try {
    const query = new URLSearchParams();
    if (wardId && wardId !== 'all') query.append('wardId', wardId);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);

    const res = await fetch(`${API_BASE_URL}/api/wards/analytics/export?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      return { success: false, error: 'Failed to download municipal CSV report' };
    }

    const blob = await res.blob();
    const filename = `civicfix_municipal_report_${new Date().toISOString().slice(0, 10)}.csv`;
    return { success: true, blob, filename };
  } catch (err) {
    return { success: false, error: err.message || 'Network error downloading CSV report' };
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
  getUserNotificationsApi,
  getUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
  clearReadNotificationsApi,
  broadcastAnnouncementApi,
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
  submitFeedbackApi,
  getComplaintFeedbackApi,
  getMyFeedbackApi,
  getAdminFeedbackApi,
  getAdminFeedbackStatsApi,
  getAdminSlaConfigApi,
  updateAdminSlaConfigApi,
  getAdminSlaOverviewApi,
  getAdminOverdueComplaintsApi,
  getAdminEscalationsApi,
  getAdminEscalationLogsApi,
  getComplaintEscalationHistoryApi,
  manualEscalateComplaintApi,
  triggerSlaEvaluationApi,
  getOfficerSlaOverviewApi,
  getOfficerEscalationsApi,
  getOfficerWorkspaceApi,
  uploadResolutionEvidenceApi,
  submitOfficerResolutionApi,
  getComplaintResolutionApi,
  verifyResolutionApi,
  rejectResolutionApi,
  getAdminResolutionsApi,
  getAdminResolutionStatsApi,
  getAdminResolutionDetailsApi,
  reviewAdminResolutionApi,
  getOfficerPerformanceAnalyticsApi,
  getCitizenDashboardApi,
  getMyCitizenComplaintsApi,
  getMyCitizenComplaintDetailsApi,
  updateMyProfileApi,
  getPushPublicKeyApi,
  subscribePushApi,
  unsubscribePushApi,
  createWardApi,
  getWardsApi,
  getWardDetailsApi,
  updateWardApi,
  toggleWardStatusApi,
  deleteWardApi,
  getWardOfficersApi,
  assignWardOfficersApi,
  removeWardOfficerApi,
  assignWardDepartmentsApi,
  transferComplaintWardApi,
  getMunicipalOverviewApi,
  getWardAnalyticsApi,
  exportMunicipalWardCsvApi,
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  clearSession
};
