/**
 * Simple logger utility for consistent logging across the application
 */
export const logger = {
  /**
   * Log debug information
   * @param message The message to log
   * @param meta Additional metadata to log
   */
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${message}`, meta ? meta : '');
    }
  },

  /**
   * Log informational messages
   * @param message The message to log
   * @param meta Additional metadata to log
   */
  info: (message: string, meta?: any) => {
    console.info(`[INFO] ${message}`, meta ? meta : '');
  },

  /**
   * Log warning messages
   * @param message The message to log
   * @param meta Additional metadata to log
   */
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? meta : '');
  },

  /**
   * Log error messages
   * @param message The message to log
   * @param meta Additional metadata to log
   */
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] ${message}`, meta ? meta : '');
  }
};

