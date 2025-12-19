#!/usr/bin/env node

/**
 * Diagnostic tool to analyze why games aren't matching
 * Uses API endpoints to query games and compare their descriptors/embeddings
 * 
 * Usage:
 *   node scripts/diagnose-matching.js find "Game Name"
 *   node scripts/diagnose-matching.js compare <id1> <id2> [facet]
 *   node scripts/diagnose-matching.js similar-descriptors [facet] [limit]
 * 
 * Examples:
 *   node scripts/diagnose-matching.js find "Pig Face"
 *   node scripts/diagnose-matching.js compare 123456 789012 aesthetic
 *   node scripts/diagnose-matching.js similar-descriptors aesthetic 20
 * 
 * Note: Set API_BASE_URL environment variable if not running locally
 *   API_BASE_URL=http://localhost:3000 node scripts/diagnose-matching.js ...
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function apiCall(endpoint, params = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Find games by name (fuzzy search)
 */
async function findGamesByName(gameName) {
  console.log(`\n🔍 Searching for games matching "${gameName}"...\n`);
  
  const result = await apiCall('/api/diagnose/find', { name: gameName });
  
  console.log(`Found ${result.count} games:\n`);
  
  result.games.forEach((game) => {
    console.log(`  ID: ${game.id}`);
    console.log(`  Name: ${game.name}`);
    console.log(`  Embeddings: aesthetic=${game.hasAestheticEmbedding ? '✓' : '✗'} gameplay=${game.hasGameplayEmbedding ? '✓' : '✗'} narrative=${game.hasNarrativeEmbedding ? '✓' : '✗'}`);
    if (game.aestheticDescriptors.length > 0) {
      console.log(`  Aesthetic: ${game.aestheticDescriptors.slice(0, 5).join(', ')}${game.aestheticDescriptors.length > 5 ? '...' : ''}`);
    }
    console.log('');
  });
  
  return result;
}

/**
 * Compare two games and show why they're not matching
 */
async function compareGames(game1Id, game2Id, facet = 'aesthetic') {
  console.log(`\n🔬 Comparing games ${game1Id} and ${game2Id} (${facet} facet)...\n`);
  
  const result = await apiCall('/api/diagnose/compare', {
    game1Id: game1Id.toString(),
    game2Id: game2Id.toString(),
    facet,
  });
  
  console.log(`Game 1: ${result.game1.name} (ID: ${result.game1.id})`);
  console.log(`  Descriptors: ${result.game1.descriptors.join(', ')}`);
  console.log(`  Has Embedding: ${result.game1.hasEmbedding ? '✓' : '✗'}`);
  console.log('');
  
  console.log(`Game 2: ${result.game2.name} (ID: ${result.game2.id})`);
  console.log(`  Descriptors: ${result.game2.descriptors.join(', ')}`);
  console.log(`  Has Embedding: ${result.game2.hasEmbedding ? '✓' : '✗'}`);
  console.log('');
  
  if (result.comparison.similarityScore !== null) {
    console.log(`📊 Similarity Score: ${(result.comparison.similarityScore * 100).toFixed(2)}%`);
    console.log(`   Status: ${result.comparison.matchStatus}`);
    console.log('');
  } else {
    console.log(`⚠️  Cannot calculate similarity: Missing embeddings`);
    console.log('');
  }
  
  console.log(`🔗 Shared Descriptors (${result.comparison.sharedCount}):`);
  if (result.comparison.sharedDescriptors.length > 0) {
    result.comparison.sharedDescriptors.forEach((desc) => {
      console.log(`   ✓ ${desc}`);
    });
  } else {
    console.log(`   (none)`);
  }
  console.log('');
  
  console.log(`📝 Only in Game 1 (${result.comparison.onlyInGame1.length}):`);
  if (result.comparison.onlyInGame1.length > 0) {
    result.comparison.onlyInGame1.slice(0, 10).forEach((desc) => {
      console.log(`   - ${desc}`);
    });
    if (result.comparison.onlyInGame1.length > 10) {
      console.log(`   ... and ${result.comparison.onlyInGame1.length - 10} more`);
    }
  } else {
    console.log(`   (none)`);
  }
  console.log('');
  
  console.log(`📝 Only in Game 2 (${result.comparison.onlyInGame2.length}):`);
  if (result.comparison.onlyInGame2.length > 0) {
    result.comparison.onlyInGame2.slice(0, 10).forEach((desc) => {
      console.log(`   - ${desc}`);
    });
    if (result.comparison.onlyInGame2.length > 10) {
      console.log(`   ... and ${result.comparison.onlyInGame2.length - 10} more`);
    }
  } else {
    console.log(`   (none)`);
  }
  console.log('');
  
  return result;
}

/**
 * Find all games with similar descriptors (potential matches)
 */
async function findSimilarDescriptors(facet = 'aesthetic', limit = 20) {
  console.log(`\n🔍 Finding games with similar descriptors (${facet} facet)...\n`);
  
  const result = await apiCall('/api/diagnose/similar-descriptors', {
    facet,
    limit: limit.toString(),
    minShared: '2',
  });
  
  console.log(`Found ${result.count} pairs with shared descriptors:\n`);
  
  result.pairs.forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.game1.name} ↔ ${pair.game2.name}`);
    console.log(`   Shared: ${pair.sharedDescriptors.join(', ')}`);
    console.log(`   Count: ${pair.sharedCount} shared descriptors`);
    console.log(`   IDs: ${pair.game1.id} ↔ ${pair.game2.id}`);
    console.log('');
  });
  
  return result;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  node scripts/diagnose-matching.js <command> [args...]

Commands:
  find <game-name>                    Find games by name
  compare <id1> <id2> [facet]        Compare two games (facet: aesthetic|gameplay|narrative)
  similar-descriptors [facet] [limit] Find games with similar descriptor words
  
Examples:
  node scripts/diagnose-matching.js find "Pig Face"
  node scripts/diagnose-matching.js compare 123456 789012 aesthetic
  node scripts/diagnose-matching.js similar-descriptors aesthetic 20
    `);
    process.exit(1);
  }
  
  const command = args[0];
  
  try {
    if (command === 'find') {
      const gameName = args[1];
      if (!gameName) {
        console.error('Error: Game name required');
        process.exit(1);
      }
      await findGamesByName(gameName);
    } else if (command === 'compare') {
      const id1 = parseInt(args[1], 10);
      const id2 = parseInt(args[2], 10);
      const facet = args[3] || 'aesthetic';
      
      if (!id1 || !id2) {
        console.error('Error: Both game IDs required');
        process.exit(1);
      }
      
      if (!['aesthetic', 'gameplay', 'narrative'].includes(facet)) {
        console.error('Error: Facet must be one of: aesthetic, gameplay, narrative');
        process.exit(1);
      }
      
      await compareGames(id1, id2, facet);
    } else if (command === 'similar-descriptors') {
      const facet = args[1] || 'aesthetic';
      const limit = parseInt(args[2] || '20', 10);
      
      if (!['aesthetic', 'gameplay', 'narrative'].includes(facet)) {
        console.error('Error: Facet must be one of: aesthetic, gameplay, narrative');
        process.exit(1);
      }
      
      await findSimilarDescriptors(facet, limit);
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
