/**
 * Checks if a string is numeric (contains only digits)
 * @param str The string to check
 * @returns True if the string is numeric, false otherwise
 */
export function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

