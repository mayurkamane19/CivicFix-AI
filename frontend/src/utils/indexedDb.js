/**
 * CivicFix AI - IndexedDB Offline Draft Storage Manager
 * Stores and manages offline complaint drafts isolated by citizen account.
 * Security: NEVER stores passwords, JWT tokens, or credentials.
 */

const DB_NAME = 'CivicFixOfflineDB';
const DB_VERSION = 1;
const STORE_DRAFTS = 'complaint_drafts';

/**
 * Initializes and returns the IndexedDB instance
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        const store = db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
        store.createIndex('userEmail', 'userEmail', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a new or updated complaint draft
 * @param {object} draftData
 * @param {string} userEmail - isolates draft to logged-in user
 */
export async function saveDraft(draftData, userEmail = 'guest') {
  const db = await openDB();

  const id = draftData.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const record = {
    id,
    userEmail: userEmail || 'guest',
    title: draftData.title || '',
    category: draftData.category || '',
    description: draftData.description || '',
    severity: draftData.severity || 'Medium',
    address: draftData.address || '',
    latitude: draftData.latitude || null,
    longitude: draftData.longitude || null,
    photoData: draftData.photoData || null, // Base64 data URL
    photoName: draftData.photoName || null,
    status: 'draft',
    createdAt: draftData.createdAt || now,
    updatedAt: now,
    lastError: null
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const req = store.put(record);

    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all drafts belonging to a specific user
 * @param {string} userEmail
 * @returns {Promise<Array>}
 */
export async function getDraftsByUser(userEmail = 'guest') {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const index = store.index('userEmail');
    const req = index.getAll(userEmail || 'guest');

    req.onsuccess = () => {
      // Sort newest updated first
      const results = (req.result || []).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Gets a single draft by ID
 * @param {string} id
 */
export async function getDraftById(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a draft by ID
 * @param {string} id
 */
export async function deleteDraft(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Counts saved drafts for a user
 * @param {string} userEmail
 */
export async function getDraftCount(userEmail = 'guest') {
  const drafts = await getDraftsByUser(userEmail);
  return drafts.length;
}

/**
 * Clears drafts when citizen explicitly logs out
 * @param {string} userEmail
 */
export async function clearUserDrafts(userEmail) {
  if (!userEmail) return;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    const index = store.index('userEmail');
    const req = index.openKeyCursor(userEmail);

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve(true);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export default {
  saveDraft,
  getDraftsByUser,
  getDraftById,
  deleteDraft,
  getDraftCount,
  clearUserDrafts
};
