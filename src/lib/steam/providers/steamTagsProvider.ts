/**
 * Provider interface for fetching game tags
 */
export interface TagsProvider {
  fetchTags(appId: number): Promise<Record<string, number>>;
}

/**
 * Steam Store tags provider (initial implementation)
 * Extracts tags from Steam Store page categories and genres
 */
export class SteamStoreTagsProvider implements TagsProvider {
  async fetchTags(appId: number): Promise<Record<string, number>> {
    // For now, we'll rely on tags extracted from store data
    // This is a placeholder that can be enhanced with:
    // - HTML scraping of store page tags
    // - SteamSpy API integration
    // - Community tag APIs
    
    // Return empty for now - tags will come from store data
    return {};
  }
}

/**
 * Default tags provider instance
 */
export const defaultTagsProvider: TagsProvider = new SteamStoreTagsProvider();
