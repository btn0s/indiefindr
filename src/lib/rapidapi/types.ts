// Type definitions for the response from games-details.p.rapidapi.com

export interface RapidApiSystemRequirements {
  min: string[];
  recomm: string[];
}

export interface RapidApiSysReq {
  window?: RapidApiSystemRequirements;
  mac_os?: RapidApiSystemRequirements;
  linux?: RapidApiSystemRequirements;
}

export interface RapidApiMedia {
  screenshot: string[];
  videos: string[]; // URLs to video files (e.g., webm)
  // Add other potential media types like header images if they appear
}

export interface RapidApiDevDetails {
  developer_name: string[];
  publisher: string[];
  franchise: string[]; // Or null/undefined if it can be absent
}

export interface RapidApiExternalLink {
  name: string; // e.g., "website", "X", "Instagram"
  link: string; // The actual URL
}

// ADDED: Interface for pricing objects
export interface RapidApiPricing {
  name: string; // e.g., "Play Counter-Strike 2", "Buy Prime Status Upgrade"
  price: string; // e.g., "Free To Play", "$14.99"
}

// The main data structure nested under "data"
export interface RapidApiGameData {
  name: string;
  desc: string;
  release_date: string; // Can be a year ("2025") or potentially a full date
  pricing: RapidApiPricing[];
  external_links: RapidApiExternalLink[];
  tags: string[]; // Corresponds to genres/tags on Steam
  lang: string[];
  dev_details: RapidApiDevDetails;
  media: RapidApiMedia;
  sys_req: RapidApiSysReq;
  about_game: string;
  // Add any other fields observed in responses, e.g., game_header_image_full, game_capsule_image_full if they exist at this level
}

// The top-level API response structure
export interface RapidApiResponse {
  status: number;
  message: string;
  data: RapidApiGameData | null; // Data can potentially be null for non-existent IDs
}

// Basic placeholder for review data - Structure needs verification
export interface RapidApiReview {
  // Assuming some common review fields - adjust based on actual API response
  title?: string;
  author?: string;
  date?: string;
  review_text?: string;
  rating?: string; // e.g., "Recommended", "Not Recommended"
  // Add other fields as discovered (e.g., playtime, helpful votes)
}

export interface RapidApiReviewsResponse {
  status: number;
  message: string;
  data?: {
    reviews: RapidApiReview[];
    limit?: string;
    offset?: string;
  };
}
