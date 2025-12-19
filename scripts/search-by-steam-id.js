#!/usr/bin/env node

/**
 * Script to search for similar games by Steam ID
 * Fetches gameplay screenshots, title, and description from Steam,
 * then sends to the search-by-image endpoint.
 * 
 * Usage: node scripts/search-by-steam-id.js <steamAppId> [baseUrl]
 * Example: node scripts/search-by-steam-id.js 730 http://localhost:3000
 */

const STEAM_API_BASE = 'https://store.steampowered.com/api';

async function fetchSteamGameData(appId) {
  const url = `${STEAM_API_BASE}/appdetails?appids=${appId}&l=english`;

  console.log(`\n📥 Fetching Steam data for app ID: ${appId}...`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Steam data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const appData = data[appId.toString()];

  if (!appData || !appData.success) {
    throw new Error(`Steam app ${appId} not found or unavailable`);
  }

  const game = appData.data;

  // Extract screenshots (prefer gameplay screenshots, but use any if available)
  const screenshots = (game.screenshots || [])
    .map((s) => s.path_full || s.path_thumbnail)
    .filter(Boolean);

  if (screenshots.length === 0) {
    throw new Error(`No screenshots available for Steam app ${appId}`);
  }

  // Get the first screenshot (usually the most representative)
  const firstScreenshot = screenshots[0];

  return {
    name: game.name,
    shortDescription: game.short_description || '',
    screenshots,
    firstScreenshot,
  };
}

async function searchByImage(imageUrl, text, baseUrl) {
  const searchUrl = `${baseUrl}/api/games/search-by-image`;

  console.log(`\n🔍 Sending search request to: ${searchUrl}`);
  console.log(`   Image: ${imageUrl.substring(0, 80)}...`);
  console.log(`   Text: ${text.substring(0, 100)}...`);

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageUrl,
      text: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Search failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
  }

  return await response.json();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Steam App ID is required');
    console.error('\nUsage: node scripts/search-by-steam-id.js <steamAppId> [baseUrl]');
    console.error('Example: node scripts/search-by-steam-id.js 730 http://localhost:3000');
    process.exit(1);
  }

  const steamAppId = parseInt(args[0], 10);
  const baseUrl = args[1] || 'http://localhost:3000';

  if (isNaN(steamAppId)) {
    console.error(`❌ Error: Invalid Steam App ID: ${args[0]}`);
    process.exit(1);
  }

  console.log('🎮 Steam Game Similarity Search');
  console.log('='.repeat(50));
  console.log(`Steam App ID: ${steamAppId}`);
  console.log(`Base URL: ${baseUrl}`);

  try {
    // Step 1: Fetch Steam game data
    const gameData = await fetchSteamGameData(steamAppId);

    console.log(`\n✅ Game found: ${gameData.name}`);
    console.log(`   Screenshots available: ${gameData.screenshots.length}`);
    console.log(`   Using screenshot: ${gameData.firstScreenshot}`);
    console.log(`   Description: ${gameData.shortDescription.substring(0, 100)}...`);

    // Step 2: Build text context
    const textContext = `${gameData.name}. ${gameData.shortDescription}`;

    // Step 3: Send to search-by-image endpoint
    const result = await searchByImage(gameData.firstScreenshot, textContext, baseUrl);

    // Step 4: Display results
    console.log('\n' + '='.repeat(50));
    console.log('📊 Search Results:');
    console.log('='.repeat(50));
    console.log('\n' + result.result);
    
    if (result.usage) {
      console.log('\n' + '='.repeat(50));
      console.log('📈 Usage Stats:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(result.usage, null, 2));
    }

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
