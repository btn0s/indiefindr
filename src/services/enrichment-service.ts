import { EnrichmentRepository } from "@/lib/repositories/enrichment-repository";
// Import the class, not the interface, if we intend to instantiate it.
// Or, if game-repository is supposed to export an instance, that should be imported.
import { DrizzleGameRepository } from "@/lib/repositories/game-repository";

// src/services/enrichment-service.ts

// Instantiate the repository. Ideally, this would be handled by a dependency injection system
// or a singleton pattern if appropriate for the application architecture.
// For now, direct instantiation for simplicity in this service.
const gameRepository = new DrizzleGameRepository();

export const EnrichmentService = {
  async enrichGame(gameId: string): Promise<void> {
    console.log(`EnrichmentService: Starting enrichment for gameId: ${gameId}`);

    // Use the instantiated repository
    const game = await gameRepository.getById(Number(gameId)); // Assuming gameId from service is string, but repo expects number
    if (!game) {
      console.error(`EnrichmentService: Game with id ${gameId} not found.`);
      return;
    }

    // Orchestrate the enrichment process
    await this.enrichBasicInfo(gameId, game.title || undefined); // Pass game title or other relevant info
    await this.enrichMedia(gameId);
    await this.enrichSocialMentions(gameId);
    // await this.generateEmbeddings(gameId); // Mocked or skipped for now

    console.log(`EnrichmentService: Finished enrichment for gameId: ${gameId}`);
  },

  async enrichBasicInfo(gameId: string, gameTitle?: string): Promise<void> {
    console.log(
      `Mock: Enriching basic info for gameId: ${gameId} (Title: ${gameTitle || "N/A"})`
    );
    // In a real scenario, this might fetch from Steam API, IGDB, etc.
    // For now, we can assume GameRepository.getById provided some basic info,
    // or this service would call specific methods on an API client.
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Example: Update game record with new info via GameRepository (if applicable)
    // await gameRepository.update(Number(gameId), { description: 'Fetched description...' });
  },

  async enrichMedia(gameId: string): Promise<void> {
    console.log(`Mock: Enriching media for gameId: ${gameId}`);
    const media = await EnrichmentRepository.getMediaForGame(gameId);
    // Process/store media data as needed
    console.log("Fetched media:", media);
    // Example: Save enriched media URLs to game_enrichment table via a repository method
  },

  async enrichSocialMentions(gameId: string): Promise<void> {
    console.log(`Mock: Enriching social mentions for gameId: ${gameId}`);
    const mentions =
      await EnrichmentRepository.getSocialMentionsForGame(gameId);
    // Process/store mentions data
    console.log("Fetched social mentions:", mentions);
  },

  async generateEmbeddings(gameId: string): Promise<void> {
    console.log(
      `Mock: Generating embeddings for gameId: ${gameId} - SKIPPED FOR NOW`
    );
    // Placeholder for future embedding generation logic
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};
