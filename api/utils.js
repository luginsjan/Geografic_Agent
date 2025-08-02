// Utility functions for AigentID management

/**
 * Generates a unique AigentID
 * Format: AIG-YYYYMMDD-HHMMSS-XXXXX (where XXXXX is a random 5-character string)
 * @returns {string} Unique AigentID
 */
function generateAigentID() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
                 (now.getMonth() + 1).toString().padStart(2, '0') +
                 now.getDate().toString().padStart(2, '0');
  const timeStr = now.getHours().toString().padStart(2, '0') +
                 now.getMinutes().toString().padStart(2, '0') +
                 now.getSeconds().toString().padStart(2, '0');
  
  // Generate random 5-character string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomStr = '';
  for (let i = 0; i < 5; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `AIG-${dateStr}-${timeStr}-${randomStr}`;
}

/**
 * Validates if a string is a valid AigentID format
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid format
 */
function isValidAigentID(id) {
  if (!id || typeof id !== 'string') return false;
  
  // Check format: AIG-YYYYMMDD-HHMMSS-XXXXX
  const pattern = /^AIG-\d{8}-\d{6}-[A-Z0-9]{5}$/;
  return pattern.test(id);
}

/**
 * Extracts AigentID from request body or headers
 * @param {Object} req - The request object
 * @returns {string|null} The AigentID if found, null otherwise
 */
function extractAigentID(req) {
  // Check in request body first
  if (req.body && req.body.AigentID) {
    return req.body.AigentID;
  }
  
  // Check in headers as fallback
  if (req.headers && req.headers['x-aigent-id']) {
    return req.headers['x-aigent-id'];
  }
  
  return null;
}

module.exports = {
  generateAigentID,
  isValidAigentID,
  extractAigentID
}; 