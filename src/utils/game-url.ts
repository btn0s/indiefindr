export const getGameUrl = (id: number, title: string | null): string => {
  const slug = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except space and hyphen
        .trim() // Trim leading/trailing spaces that might result from replacements
        .replace(/\s+/g, "-") // Replace spaces with hyphens
    : "unknown";
  return `/${id}/${slug}`;
};
