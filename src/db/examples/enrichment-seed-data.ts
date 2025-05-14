import { db } from "@/db";
import {
  contentSourceTable,
  gameEnrichmentTable,
  enrichmentTagTable,
  enrichmentToTagTable,
} from "@/db/schema";

/**
 * Seed script for enriched game data
 * This file contains functions to insert test data for the enrichment tables
 */

/**
 * Insert initial content sources
 */
export async function seedContentSources() {
  const sources = [
    {
      name: "YouTube",
      description: "Video content from YouTube",
      baseUrl: "https://www.youtube.com",
      apiEndpoint: "https://www.googleapis.com/youtube/v3",
    },
    {
      name: "Twitter",
      description: "Social media content from Twitter/X",
      baseUrl: "https://twitter.com",
      apiEndpoint: "https://api.twitter.com/2",
    },
    {
      name: "Reddit",
      description: "Community discussions from Reddit",
      baseUrl: "https://www.reddit.com",
      apiEndpoint: "https://oauth.reddit.com/api/v1",
    },
    {
      name: "Twitch",
      description: "Streaming content from Twitch",
      baseUrl: "https://www.twitch.tv",
      apiEndpoint: "https://api.twitch.tv/helix",
    },
    {
      name: "Steam Community",
      description: "Community content from Steam",
      baseUrl: "https://steamcommunity.com",
      apiEndpoint: "https://api.steampowered.com",
    },
    {
      name: "IndieFindr Original",
      description: "Original content created by IndieFindr",
      baseUrl: "https://indiefindr.com",
      apiEndpoint: null,
    },
  ];

  // Insert sources one by one to handle conflicts
  for (const source of sources) {
    await db
      .insert(contentSourceTable)
      .values(source)
      .onConflictDoNothing({ target: [contentSourceTable.name] });
  }

  // Return the inserted sources for reference
  return db.select().from(contentSourceTable);
}

/**
 * Insert initial enrichment tags
 */
export async function seedEnrichmentTags() {
  const tags = [
    // Content type categories
    { name: "Review", category: "content_type", description: "Game reviews" },
    { name: "Gameplay", category: "content_type", description: "Gameplay footage" },
    { name: "Tutorial", category: "content_type", description: "Game tutorials and guides" },
    { name: "Interview", category: "content_type", description: "Developer interviews" },
    { name: "Trailer", category: "content_type", description: "Game trailers" },
    { name: "Livestream", category: "content_type", description: "Live gameplay streams" },
    { name: "Podcast", category: "content_type", description: "Audio discussions" },
    
    // Mood categories
    { name: "Funny", category: "mood", description: "Humorous content" },
    { name: "Informative", category: "mood", description: "Educational content" },
    { name: "Exciting", category: "mood", description: "Action-packed content" },
    { name: "Relaxing", category: "mood", description: "Calm, peaceful content" },
    { name: "Scary", category: "mood", description: "Horror or suspenseful content" },
    
    // Quality categories
    { name: "High Quality", category: "quality", description: "Exceptionally well-made content" },
    { name: "Official", category: "quality", description: "Content from official sources" },
    { name: "Community Favorite", category: "quality", description: "Popular within the community" },
    { name: "Hidden Gem", category: "quality", description: "Underrated but excellent content" },
  ];

  // Insert tags one by one to handle conflicts
  for (const tag of tags) {
    await db
      .insert(enrichmentTagTable)
      .values(tag)
      .onConflictDoNothing({ target: [enrichmentTagTable.name] });
  }

  // Return the inserted tags for reference
  return db.select().from(enrichmentTagTable);
}

/**
 * Insert sample enriched content for a game
 * @param gameId The ID of the game to add enriched content for
 */
export async function seedGameEnrichment(gameId: number) {
  // First, get the content sources
  const sources = await db.select().from(contentSourceTable);
  if (sources.length === 0) {
    throw new Error("No content sources found. Run seedContentSources first.");
  }

  // Map sources by name for easier access
  const sourceMap = sources.reduce((acc, source) => {
    acc[source.name] = source.id;
    return acc;
  }, {} as Record<string, number>);

  // Sample enriched content
  const enrichedContent = [
    {
      gameId,
      sourceId: sourceMap["YouTube"],
      contentType: "video",
      title: "Game Review: An Honest Look",
      description: "A detailed review of the gameplay, graphics, and story.",
      url: "https://www.youtube.com/watch?v=example1",
      thumbnailUrl: "https://i.ytimg.com/vi/example1/maxresdefault.jpg",
      authorName: "GameReviewer",
      authorUrl: "https://www.youtube.com/c/GameReviewer",
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      metadata: { duration: "15:42", views: 45000, likes: 3200 },
      relevanceScore: 95,
      isVerified: true,
      isFeatured: true,
    },
    {
      gameId,
      sourceId: sourceMap["YouTube"],
      contentType: "video",
      title: "Gameplay Walkthrough - Part 1",
      description: "First part of a complete gameplay walkthrough.",
      url: "https://www.youtube.com/watch?v=example2",
      thumbnailUrl: "https://i.ytimg.com/vi/example2/maxresdefault.jpg",
      authorName: "GameplayExpert",
      authorUrl: "https://www.youtube.com/c/GameplayExpert",
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      metadata: { duration: "28:15", views: 32000, likes: 1800 },
      relevanceScore: 85,
      isVerified: true,
      isFeatured: false,
    },
    {
      gameId,
      sourceId: sourceMap["Twitter"],
      contentType: "social_post",
      title: "Developer Announcement",
      description: "Exciting news about upcoming features!",
      url: "https://twitter.com/GameDev/status/123456789",
      authorName: "Game Developer",
      authorUrl: "https://twitter.com/GameDev",
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      metadata: { likes: 1200, retweets: 450, replies: 120 },
      relevanceScore: 90,
      isVerified: true,
      isFeatured: true,
    },
    {
      gameId,
      sourceId: sourceMap["Reddit"],
      contentType: "discussion",
      title: "Hidden Features You Might Have Missed",
      description: "Community-compiled list of lesser-known game features.",
      url: "https://www.reddit.com/r/GameName/comments/abc123",
      authorName: "u/GameExplorer",
      authorUrl: "https://www.reddit.com/user/GameExplorer",
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      metadata: { upvotes: 2500, comments: 320, awards: 5 },
      relevanceScore: 88,
      isVerified: false,
      isFeatured: false,
    },
    {
      gameId,
      sourceId: sourceMap["Twitch"],
      contentType: "livestream",
      title: "Speedrun Attempt - World Record Pace!",
      description: "Attempting to break the current world record.",
      url: "https://www.twitch.tv/videos/123456789",
      thumbnailUrl: "https://static-cdn.jtvnw.net/s3_vods/123456789/thumbnail.jpg",
      authorName: "SpeedRunner",
      authorUrl: "https://www.twitch.tv/SpeedRunner",
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      metadata: { duration: "1:45:30", viewers: 12000, category: "Speedrunning" },
      relevanceScore: 92,
      isVerified: true,
      isFeatured: true,
    },
    {
      gameId,
      sourceId: sourceMap["IndieFindr Original"],
      contentType: "article",
      title: "Developer Interview: Behind the Scenes",
      description: "An exclusive interview with the lead developer.",
      url: "https://indiefindr.com/articles/developer-interview-game-name",
      thumbnailUrl: "https://indiefindr.com/images/interviews/game-name.jpg",
      authorName: "IndieFindr Staff",
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      metadata: { readTime: "8 minutes", category: "Interviews" },
      relevanceScore: 98,
      isVerified: true,
      isFeatured: true,
    },
  ];

  // Insert enriched content
  const insertedContent = [];
  for (const content of enrichedContent) {
    const result = await db
      .insert(gameEnrichmentTable)
      .values(content)
      .returning();
    insertedContent.push(result[0]);
  }

  // Get tags for assigning to content
  const tags = await db.select().from(enrichmentTagTable);
  if (tags.length === 0) {
    throw new Error("No tags found. Run seedEnrichmentTags first.");
  }

  // Map tags by name for easier access
  const tagMap = tags.reduce((acc, tag) => {
    acc[tag.name] = tag.id;
    return acc;
  }, {} as Record<string, number>);

  // Assign tags to content
  const tagAssignments = [
    { contentIndex: 0, tagNames: ["Review", "Informative", "High Quality"] },
    { contentIndex: 1, tagNames: ["Gameplay", "Tutorial"] },
    { contentIndex: 2, tagNames: ["Official", "Exciting"] },
    { contentIndex: 3, tagNames: ["Informative", "Community Favorite"] },
    { contentIndex: 4, tagNames: ["Livestream", "Exciting", "High Quality"] },
    { contentIndex: 5, tagNames: ["Interview", "Official", "Informative"] },
  ];

  for (const assignment of tagAssignments) {
    const enrichmentId = insertedContent[assignment.contentIndex].id;
    for (const tagName of assignment.tagNames) {
      const tagId = tagMap[tagName];
      if (tagId) {
        await db
          .insert(enrichmentToTagTable)
          .values({ enrichmentId, tagId })
          .onConflictDoNothing();
      }
    }
  }

  return insertedContent;
}

/**
 * Main function to seed all enrichment data
 * @param gameId The ID of the game to add enriched content for
 */
export async function seedAllEnrichmentData(gameId: number) {
  console.log("Seeding content sources...");
  const sources = await seedContentSources();
  console.log(`Seeded ${sources.length} content sources`);

  console.log("Seeding enrichment tags...");
  const tags = await seedEnrichmentTags();
  console.log(`Seeded ${tags.length} enrichment tags`);

  console.log(`Seeding enriched content for game ID ${gameId}...`);
  const content = await seedGameEnrichment(gameId);
  console.log(`Seeded ${content.length} enriched content items`);

  return {
    sources,
    tags,
    content,
  };
}

