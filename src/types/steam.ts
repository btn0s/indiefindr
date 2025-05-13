// src/types/steam.ts

// Define types for the rawData structure from Steam API

export interface Screenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

export interface Movie {
  id: number;
  name: string;
  thumbnail: string;
  webm: {
    480: string;
    max: string;
  };
  mp4: {
    480: string;
    max: string;
  };
  highlight: boolean;
}

export interface ReleaseDate {
  date: string;
  coming_soon: boolean;
}

// Interface for the nested rawData JSON field
export interface SteamRawData {
  screenshots?: Screenshot[];
  movies?: Movie[];
  developers?: string[];
  publishers?: string[];
  release_date?: ReleaseDate;
  // Add other potential fields from Steam API if needed
  [key: string]: any;
}

// Define a unified media item type for carousels or galleries
export type MediaItem = {
  type: "image" | "video";
  data: Screenshot | Movie;
};
