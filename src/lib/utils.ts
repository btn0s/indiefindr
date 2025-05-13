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
  return `/games/${id}/${slug}`;
};
