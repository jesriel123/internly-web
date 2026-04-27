/**
 * Shared Configuration Utilities
 * 
 * Centralizes configuration logic that's duplicated across web and mobile.
 * This file can be copied to the mobile project to maintain consistency.
 */

/**
 * Validates and sanitizes HTTP/HTTPS redirect URLs
 * @param {string} rawValue - Raw URL value from environment or user input
 * @param {string} fallback - Fallback URL if validation fails
 * @returns {string} Validated URL or fallback
 */
export function sanitizeHttpRedirectUrl(rawValue, fallback) {
  const cleaned = String(rawValue || '').trim();
  if (!cleaned) return fallback;

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`[CONFIG] Invalid protocol: ${parsed.protocol}, using fallback`);
      return fallback;
    }
    return parsed.toString();
  } catch (error) {
    console.warn(`[CONFIG] Invalid URL: ${cleaned}, using fallback`);
    return fallback;
  }
}

/**
 * Creates a timeout error with consistent messaging
 * @param {string} label - Operation label
 * @param {number} ms - Timeout duration in milliseconds
 * @returns {Error} Timeout error
 */
export function createTimeoutError(label, ms) {
  return new Error(
    `${label} timed out after ${Math.round(ms / 1000)}s. Please try again.`
  );
}

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {string} label - Operation label for error messages
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects on timeout
 */
export async function withTimeout(promise, label, ms = 12000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(createTimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validates environment variables are present
 * @param {Object} vars - Object with variable names as keys and values
 * @param {string} context - Context for error message (e.g., 'Web', 'Mobile')
 * @throws {Error} If any required variable is missing
 */
export function validateEnvVars(vars, context = 'Application') {
  const missing = Object.entries(vars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `${context} is missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Gets the current environment (development, staging, production)
 * @param {string} nodeEnv - NODE_ENV or equivalent
 * @param {string} url - Current URL or base URL
 * @returns {string} Environment name
 */
export function getEnvironment(nodeEnv, url) {
  if (nodeEnv === 'production') {
    if (url?.includes('vercel.app') || url?.includes('expo.dev')) {
      return 'staging';
    }
    return 'production';
  }
  return 'development';
}

/**
 * Configuration constants
 */
export const CONFIG = {
  AUTH_TIMEOUT_MS: 12000,
  REQUEST_TIMEOUT_MS: 30000,
  PASSWORD_RESET_PROD_URL: 'https://internly-web.vercel.app/reset-password',
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  CACHE_DURATION_SECONDS: 3600,
};

/**
 * Formats file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validates file type and size
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateFile(file, options = {}) {
  const {
    maxSizeMB = CONFIG.MAX_FILE_SIZE_MB,
    allowedTypes = CONFIG.ALLOWED_IMAGE_TYPES,
  } = options;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum of ${maxSizeMB}MB`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}
