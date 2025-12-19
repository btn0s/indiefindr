#!/usr/bin/env node

/**
 * Script to identify and delete all DLCs from the database
 * Uses Steam API to check if each game is a DLC, then deletes them via Supabase MCP
 */

const gameIds = [
  220, 12130, 42670, 219150, 223470, 233860, 242640, 243930, 251990, 253330,
  265300, 271590, 283640, 286690, 292030, 341940, 367500, 374320, 377160, 379720,
  427520, 466500, 526160, 578080, 581270, 606160, 613190, 688060, 701270, 746850,
  747340, 757310, 783170, 794540, 860890, 884660, 890700, 893680, 894020, 937380,
  1000410, 1011700, 1017180, 1055540, 1086940, 1091500, 1108590, 1110910, 1118240,
  1123050, 1142570, 1159090, 1162750, 1164940, 1168870, 1172650, 1173220, 1227690,
  1238710, 1245620, 1272840, 1274600, 1275150, 1285670, 1325200, 1328840, 1335680,
  1337010, 1343240, 1359980, 1368030, 1442850, 1501750, 1582650, 1590910, 1627720,
  1655140, 1684930, 1745510, 1782120, 1808500, 1830430, 1857090, 1920430, 2055360,
  2059170, 2113570, 2114740, 2115160, 2124750, 2193600, 2202650, 2406770, 2828860,
  3090810, 3108510, 3167020, 3204960, 3293010, 3314750, 3341650, 3457390, 3694480,
  3709810, 3897990, 3932890, 3958690, 4176460
];

async function checkIfDLC(appId) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch data for ${appId}: ${response.status}`);
      return null; // Unknown, skip
    }
    
    const data = await response.json();
    const appData = data[appId.toString()];
    
    if (!appData || !appData.success) {
      console.warn(`App ${appId} not found or unavailable`);
      return null;
    }
    
    const game = appData.data;
    
    // Check if it's a DLC using the same logic as the provider
    const isDLC =
      game.type === "dlc" ||
      game.categories?.some(
        (cat) =>
          cat.description?.toLowerCase().includes("dlc") || cat.id === 21
      );
    
    return isDLC;
  } catch (error) {
    console.error(`Error checking ${appId}:`, error.message);
    return null;
  }
}

async function findDLCs() {
  console.log(`Checking ${gameIds.length} games for DLCs...\n`);
  
  const dlcIds = [];
  
  for (let i = 0; i < gameIds.length; i++) {
    const appId = gameIds[i];
    process.stdout.write(`\rChecking ${i + 1}/${gameIds.length}: ${appId}...`);
    
    const isDLC = await checkIfDLC(appId);
    
    if (isDLC === true) {
      dlcIds.push(appId);
      console.log(`\n  ✓ Found DLC: ${appId}`);
    }
    
    // Rate limiting - wait 200ms between requests
    if (i < gameIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`\n\nFound ${dlcIds.length} DLC(s): ${dlcIds.join(', ')}`);
  return dlcIds;
}

// Run the script
findDLCs()
  .then((dlcIds) => {
    if (dlcIds.length > 0) {
      console.log('\nDLC IDs to delete:', dlcIds);
      console.log('\nTo delete these DLCs, use the Supabase MCP tool with:');
      console.log(`DELETE FROM games WHERE id IN (${dlcIds.join(', ')});`);
    } else {
      console.log('\nNo DLCs found in the database.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
