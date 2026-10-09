/**
 * Safely escapes untrusted user input before using it in a regular expression
 * to prevent ReDoS (Regular Expression Denial of Service) and RegExp syntax errors.
 *
 * @param {string} str - Untrusted string to escape
 * @returns {string} - Escaped string safe for RegExp constructor
 */
export function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a safe case-insensitive RegExp that matches exact whole string.
 *
 * @param {string} str - Exact match pattern
 * @returns {RegExp}
 */
export function safeExactRegex(str) {
  return new RegExp(`^${escapeRegex(str.trim())}$`, 'i');
}

/**
 * Creates a safe case-insensitive RegExp that matches substring anywhere.
 *
 * @param {string} str - Substring match pattern
 * @returns {RegExp}
 */
export function safeSubstringRegex(str) {
  return new RegExp(escapeRegex(str.trim()), 'i');
}
