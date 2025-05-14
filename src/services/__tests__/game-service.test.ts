// src/services/__tests__/game-service.test.ts
import { GameServiceImpl } from "../game-service";
import type { RawGameData } from "@/types/game-models";
import type { SteamRawData } from "@/types/steam";

describe("GameService", () => {
  const gameService = new GameServiceImpl();

  // Sample raw game data for testing
  const sampleRawData: SteamRawData = {
    screenshots: [
      {
        id: 1,
        path_thumbnail: "http://example.com/thumbnail.jpg",
        path_full: "http://example.com/full.jpg",
      },
    ],
    movies: [
      {
        id: 1,
        name: "Trailer",
        thumbnail: "http://example.com/movie-thumb.jpg",
        webm: {
          480: "http://example.com/movie-480.webm",
          max: "http://example.com/movie-max.webm",
        },
        mp4: {
          480: "http://example.com/movie-480.mp4",
          max: "http://example.com/movie-max.mp4",
        },
        highlight: true,
      },
    ],
    developers: ["Developer Studio"],
    publishers: ["Publisher Inc"],
    release_date: {
      date: "2023-01-01",
      coming_soon: false,
    },
    capsule_image: "http://example.com/capsule.jpg",
    background: "http://example.com/background.jpg",
  };

  const sampleGameData: RawGameData = {
    id: 123,
    platform: "steam",
    externalId: "456",
    title: "Test Game",
    developer: "Developer Studio",
    descriptionShort: "A short description",
    descriptionDetailed: "A detailed description",
    genres: ["Action", "Adventure"],
    tags: ["Indie", "Singleplayer"],
    rawData: sampleRawData,
    steamAppid: "456",
    createdAt: "2023-01-01T00:00:00Z",
    foundBy: "user-123",
    foundByUsername: "testuser",
    foundByAvatarUrl: "http://example.com/avatar.jpg",
  };

  describe("toGameCardViewModel", () => {
    it("should transform raw game data to game card view model", () => {
      const result = gameService.toGameCardViewModel(sampleGameData);

      expect(result).toEqual({
        id: 123,
        title: "Test Game",
        description: "A short description",
        steamAppId: "456",
        tags: ["Indie", "Singleplayer"],
        imageUrl: expect.any(String),
        platformUrls: {
          steam: "https://store.steampowered.com/app/456",
        },
        foundBy: {
          username: "testuser",
          avatarUrl: "https://example.com/avatar.jpg",
          timestamp: "2023-01-01T00:00:00Z",
        },
        mediaPreview: {
          type: "video",
          url: "https://example.com/movie-max.mp4",
          thumbnailUrl: "https://example.com/movie-thumb.jpg",
        },
      });
    });

    it("should handle missing data gracefully", () => {
      const incompleteData: RawGameData = {
        ...sampleGameData,
        title: null,
        descriptionShort: null,
        tags: null,
        rawData: null,
        foundByUsername: null,
        foundByAvatarUrl: null,
      };

      const result = gameService.toGameCardViewModel(incompleteData);

      expect(result).toEqual({
        id: 123,
        title: null,
        description: null,
        steamAppId: "456",
        tags: null,
        imageUrl: expect.any(String),
        platformUrls: {
          steam: "https://store.steampowered.com/app/456",
        },
        foundBy: {
          username: "IndieFindr",
          avatarUrl: null,
          timestamp: "2023-01-01T00:00:00Z",
        },
        mediaPreview: {
          type: "image",
          url: expect.any(String),
        },
      });
    });
  });

  describe("toGameProfileViewModel", () => {
    it("should transform raw game data to game profile view model", () => {
      const result = gameService.toGameProfileViewModel(sampleGameData);

      expect(result).toEqual({
        id: 123,
        title: "Test Game",
        description: "A short description",
        detailedDescription: "A detailed description",
        steamAppId: "456",
        tags: ["Indie", "Singleplayer"],
        imageUrl: expect.any(String),
        platformUrls: {
          steam: "https://store.steampowered.com/app/456",
        },
        developers: ["Developer Studio"],
        publishers: ["Publisher Inc"],
        releaseDate: "2023-01-01",
        isComingSoon: false,
        genres: ["Action", "Adventure"],
        media: {
          screenshots: [
            {
              id: 1,
              thumbnailUrl: "https://example.com/thumbnail.jpg",
              fullUrl: "https://example.com/full.jpg",
            },
          ],
          videos: [
            {
              id: 1,
              name: "Trailer",
              thumbnailUrl: "https://example.com/movie-thumb.jpg",
              webmUrl: "https://example.com/movie-max.webm",
              mp4Url: "https://example.com/movie-max.mp4",
            },
          ],
        },
        foundBy: {
          username: "testuser",
          avatarUrl: "https://example.com/avatar.jpg",
          timestamp: "2023-01-01T00:00:00Z",
        },
      });
    });
  });

  describe("getBestImageUrl", () => {
    it("should return the best available image URL", () => {
      const result = gameService.getBestImageUrl(sampleGameData);
      expect(result).toMatch(/^https:\/\//);
    });

    it("should return null when no image is available", () => {
      const noImageData: RawGameData = {
        ...sampleGameData,
        steamAppid: null,
        rawData: null,
      };
      const result = gameService.getBestImageUrl(noImageData);
      expect(result).toBeNull();
    });
  });

  describe("getMediaPreview", () => {
    it("should prioritize videos over images", () => {
      const result = gameService.getMediaPreview(sampleGameData);
      expect(result).toEqual({
        type: "video",
        url: "https://example.com/movie-max.mp4",
        thumbnailUrl: "https://example.com/movie-thumb.jpg",
      });
    });

    it("should fall back to screenshots when no video is available", () => {
      const noVideoData: RawGameData = {
        ...sampleGameData,
        rawData: {
          ...sampleRawData,
          movies: undefined,
        },
      };
      const result = gameService.getMediaPreview(noVideoData);
      expect(result).toEqual({
        type: "image",
        url: "https://example.com/full.jpg",
      });
    });

    it("should fall back to header image when no screenshots are available", () => {
      const noScreenshotsData: RawGameData = {
        ...sampleGameData,
        rawData: {
          ...sampleRawData,
          movies: undefined,
          screenshots: undefined,
        },
      };
      const result = gameService.getMediaPreview(noScreenshotsData);
      expect(result).toEqual({
        type: "image",
        url: expect.stringContaining("header.jpg"),
      });
    });

    it("should return 'none' type when no media is available", () => {
      const noMediaData: RawGameData = {
        ...sampleGameData,
        steamAppid: null,
        rawData: null,
      };
      const result = gameService.getMediaPreview(noMediaData);
      expect(result).toEqual({
        type: "none",
        url: null,
      });
    });
  });
});

