import { embedTextProjected } from "./text";
import {
  categorizeTags,
  extractSortedTags,
  inferPerspective,
  inferGameModes,
  inferSubgenre,
} from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

export function buildMechanicsText(game: GameWithIgdb): string {
  const genres = game.raw?.genres?.map((g) => g.description).join(", ") || "Unknown";
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);

  const perspective = inferPerspective(tags);
  const gameModes = inferGameModes(tags);
  const subgenre = inferSubgenre(tags);

  const igdbPerspectives = game.igdb_data?.player_perspectives?.join(", ") || perspective;
  const igdbModes = game.igdb_data?.game_modes?.join(", ") || gameModes.join(", ");
  const igdbKeywords = game.igdb_data?.keywords?.slice(0, 10).join(", ") || "";

  const parts: string[] = [
    `Genre: ${genres}`,
    `Perspective: ${igdbPerspectives}`,
    `Core mechanics: ${categorized.mechanics.slice(0, 8).join(", ") || "action"}`,
    `Game modes: ${igdbModes}`,
    `Subgenre: ${subgenre}`,
  ];

  if (igdbKeywords) parts.push(`Keywords: ${igdbKeywords}`);
  if (categorized.other.length > 0) parts.push(`Additional: ${categorized.other.slice(0, 5).join(", ")}`);

  return parts.join("\n");
}

export async function generateMechanicsEmbedding(game: GameWithIgdb): Promise<EmbeddingInput> {
  const mechanicsText = buildMechanicsText(game);
  console.log(`Generating MECHANICS embedding for ${game.title}...`);

  const embedding = await embedTextProjected(mechanicsText);

  return {
    appid: game.appid,
    facet: "mechanics",
    embedding,
    source_type: "text",
    source_data: {
      template: mechanicsText,
      tags_used: extractSortedTags(game.steamspy_tags).slice(0, 15),
      has_igdb: !!game.igdb_data,
    },
    embedding_model: "text-embedding-3-small",
  };
}

export function canGenerateMechanicsEmbedding(game: GameWithIgdb): boolean {
  return extractSortedTags(game.steamspy_tags).length >= 1 || !!game.raw?.genres?.length;
}
