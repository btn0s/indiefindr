// src/utils/date-utils.ts

/**
 * Format a date as a relative time string (e.g., "2h ago", "3d ago")
 * @param dateInput Date to format as string, Date object, or null
 * @returns Formatted relative time string or fallback message
 */
export const formatTimeAgo = (dateInput?: string | Date | null): string => {
  if (!dateInput) return "Date not available";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30.44); // Average days in month
  const years = Math.round(days / 365.25); // Account for leap years

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`; // Up to 4 weeks
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};

/**
 * Get user initials for avatar fallback
 * @param name User name or null
 * @returns First letter of name or default fallback
 */
export const getUserInitials = (name?: string | null): string => {
  if (!name) return "IF"; // Return "IF" for IndieFindr when no name is available
  return name.charAt(0).toUpperCase();
};

