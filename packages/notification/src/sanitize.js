/**
 * Input sanitization utilities for notification content.
 * Prevents injection attacks and enforces safe length limits.
 */

/** Maximum title length in characters. */
export const MAX_TITLE_LENGTH = 256;

/** Maximum message/body length in characters. */
export const MAX_MESSAGE_LENGTH = 1024;

/**
 * Strip control characters (C0/C1) except newline and tab.
 * Removes null bytes, backspace, escape sequences, etc.
 * @param {string} input
 * @returns {string}
 */
export function stripControlChars(input) {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Sanitize a string for use in OS notifications.
 * - Converts to string
 * - Strips control characters
 * - Trims whitespace
 * - Truncates to maxLength
 * @param {unknown} input
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitize(input, maxLength) {
  if (input == null) return '';
  const str = typeof input === 'string' ? input : String(input);
  const cleaned = stripControlChars(str).trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 1) + '\u2026'; // ellipsis
}

/**
 * Sanitize a title string.
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeTitle(input) {
  return sanitize(input, MAX_TITLE_LENGTH);
}

/**
 * Sanitize a message/body string.
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeMessage(input) {
  return sanitize(input, MAX_MESSAGE_LENGTH);
}
