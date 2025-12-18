// Test script for perplexity refiner
import { searchGameAesthetic } from "../src/lib/ai/perplexity.js";

async function test() {
  console.log("Testing refiner with Fallout 4...\n");
  const result = await searchGameAesthetic("Fallout 4");
  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
