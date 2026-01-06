/**
 * Check if we're in development mode
 * This works on both server and client
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

export const IS_DEV = process.env.NODE_ENV === "development";
