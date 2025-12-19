#!/usr/bin/env node

/**
 * Script to identify adult content games in the database
 * Uses Steam API to check if each game has adult content indicators
 */

function getAllGameIds() {
  return [
    220, 12130, 42670, 219150, 223470, 233860, 242640, 243930, 251990, 253330,
    265300, 271590, 283640, 286690, 292030, 341940, 367500, 374320, 377160, 379720,
    427520, 466500, 526160, 578080, 581270, 606160, 613190, 688060, 746850,
    747340, 757310, 783170, 794540, 860890, 884660, 890700, 893680, 894020, 937380,
    1000410, 1011700, 1017180, 1055540, 1086940, 1091500, 1108590, 1110910, 1118240,
    1123050, 1142570, 1159090, 1162750, 1164940, 1168870, 1172650, 1173220, 1227690,
    1238710, 1245620, 1272840, 1274600, 1275150, 1285670, 1325200, 1328840, 1335680,
    1337010, 1343240, 1359980, 1368030, 1442850, 1501750, 1582650, 1590910, 1627720,
    1655140, 1684930, 1745510, 1782120, 1808500, 1830430, 1857090, 1920430, 2055360,
    2059170, 2113570, 2114740, 2115160, 2193600, 2202650, 2406770, 2828860,
    3090810, 3108510, 3167020, 3204960, 3293010, 3341650, 3457390, 3694480,
    3709810, 3897990, 3932890, 4176460
  ];
}

async function checkIfAdult(appId) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch data for ${appId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const appData = data[appId.toString()];
    
    if (!appData || !appData.success) {
      console.warn(`App ${appId} not found or unavailable`);
      return null;
    }
    
    const game = appData.data;
    
    // Check STRICTLY for NSFW/explicit sexual content:
    // 1. Category ID 3 is "Adult Only Sexual Content" 
    // 2. Categories explicitly containing "Nudity" or "Sexual Content" or "Adult Only"
    // 3. Type is explicitly "adult"
    // NOT just age ratings - we want explicit NSFW markers
    const hasNSFWCategory = game.categories?.some(
      (cat) => cat.id === 3 || // Category 3 is explicitly "Adult Only Sexual Content"
      cat.description?.toLowerCase().includes("nudity") ||
      cat.description?.toLowerCase().includes("sexual content") ||
      cat.description?.toLowerCase().includes("adult only")
    );
    
    const isAdultType = game.type === "adult" || game.type?.toLowerCase().includes("adult");
    
    // Only count as NSFW if it has explicit sexual/adult content markers
    // NOT just based on age rating alone
    const isNSFW = hasNSFWCategory || isAdultType;
    
    return {
      isNSFW,
      reasons: {
        hasNSFWCategory,
        isAdultType,
        requiredAge: game.required_age,
        categories: game.categories?.map(c => `${c.id}: ${c.description}`).join(', ') || 'none',
        type: game.type
      }
    };
  } catch (error) {
    console.error(`Error checking ${appId}:`, error.message);
    return null;
  }
}

async function findAdultGames() {
  const gameIds = await getAllGameIds();
  console.log(`Checking ${gameIds.length} games for adult content...\n`);
  
  const nsfwGames = [];
  
  for (let i = 0; i < gameIds.length; i++) {
    const appId = gameIds[i];
    process.stdout.write(`\rChecking ${i + 1}/${gameIds.length}: ${appId}...`);
    
    const result = await checkIfAdult(appId);
    
    if (result?.isNSFW) {
      nsfwGames.push({ appId, ...result });
      console.log(`\n  ✓ Found NSFW game: ${appId}`);
    }
    
    // Rate limiting - wait 2 seconds between requests (Steam API limit)
    if (i < gameIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n\nFound ${nsfwGames.length} NSFW game(s) (explicit sexual/adult content):`);
  nsfwGames.forEach(({ appId, reasons }) => {
    console.log(`  - ${appId}: Type: ${reasons.type || 'unknown'}, Age: ${reasons.requiredAge || 'unknown'}, Categories: ${reasons.categories}`);
  });
  
  return { nsfwGames, total: nsfwGames.length };
}

// Run the script
findAdultGames()
  .then(({ nsfwGames, total }) => {
    console.log(`\nTotal NSFW games: ${total}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
