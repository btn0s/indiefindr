export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  // other relevant fetch/axios config options
}

// Placeholder for a more robust API client
// This could be a wrapper around fetch, or a library like Axios.
export const ApiClient = {
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    console.log(`ApiClient: GET request to ${endpoint}`, config);
    // Simulate an API call
    await new Promise((resolve) => setTimeout(resolve, 200));

    // For mock purposes, you might want to return specific data based on the endpoint
    // if (endpoint.includes('steam/gameDetails')) {
    //   return { data: { name: "Mock Game from Steam" } } as T;
    // }

    // Return a generic mock response or throw an error if unhandled
    // This needs to be cast to T, which can be problematic if T is complex.
    // A more robust mock would involve a switch or mapping for endpoints.
    return Promise.resolve({
      message: `Mock GET response for ${endpoint}`,
    } as T);
  },

  async post<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    console.log(
      `ApiClient: POST request to ${endpoint} with data:`,
      data,
      config
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    return Promise.resolve({
      message: `Mock POST response for ${endpoint}`,
    } as T);
  },

  // Example of nested clients as per blueprint, can be expanded later
  steam: {
    async getGameDetails(appId: string): Promise<any> {
      // Replace 'any' with a specific type later
      console.log(`ApiClient.steam: Fetching game details for appId: ${appId}`);
      // This would internally use the main get/post methods
      // return ApiClient.get(`/steam/games/${appId}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        steam_appid: appId,
        name: `Mock Steam Game ${appId}` /* other mock details */,
      };
    },
  },

  enrichment: {
    async getYouTubeContent(gameTitle: string): Promise<any[]> {
      // Replace 'any[]' with specific type
      console.log(
        `ApiClient.enrichment: Fetching YouTube content for game: ${gameTitle}`
      );
      // return ApiClient.get(`/youtube/search?query=${encodeURIComponent(gameTitle)}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return [
        {
          title: `Cool Video about ${gameTitle}`,
          url: "https://youtube.com/example",
        },
      ];
    },
    async getSocialMentions(gameId: string): Promise<any[]> {
      // Replace 'any[]' with specific type
      console.log(
        `ApiClient.enrichment: Fetching social mentions for gameId: ${gameId}`
      );
      // return ApiClient.get(`/social/mentions/${gameId}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return [{ platform: "twitter", text: "Great game!" }];
    },
  },
};
