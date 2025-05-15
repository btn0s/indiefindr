import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to generate game URL slugs
export const getGameUrl = (id: number, title: string | null): string => {
  const slug = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove invalid chars
        .replace(/\s+/g, "-")       // Replace spaces with hyphens
        .replace(/-+/g, "-")        // Replace multiple hyphens with single
        .substring(0, 75)        // Limit slug length
    : "unknown";
  return `/${id}/${slug}`;
};

// Helper function to ensure a URL uses HTTPS
export const ensureHttps = (url: string | undefined | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

import { redirect } from "next/navigation";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string
) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}
