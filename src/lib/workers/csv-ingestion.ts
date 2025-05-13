import fs from "fs/promises";
import Papa from "papaparse";

interface CsvRow {
  appid: string;
  // Add other columns if your CSV has more, but we only need appid for now
  [key: string]: any; // Allow other columns
}

/**
 * Reads a CSV file containing Steam AppIDs.
 * Assumes a column named 'appid' exists.
 *
 * @param filePath Path to the CSV file.
 * @returns A promise that resolves to an array of Steam AppIDs (strings).
 */
export async function readSteamAppIdsFromCsv(
  filePath: string
): Promise<string[]> {
  console.log(`Reading Steam AppIDs from: ${filePath}`);
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");

    const parseResult = Papa.parse<CsvRow>(fileContent, {
      header: true, // Assumes the first row is headers
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(), // Normalize headers
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV parsing errors:", parseResult.errors);
      // Decide if we should throw or return partial results
      // For MVP, let's throw on significant errors
      throw new Error(
        `Failed to parse CSV: ${parseResult.errors[0]?.message || "Unknown parsing error"}`
      );
    }

    if (!parseResult.meta.fields?.includes("appid")) {
      throw new Error("CSV must contain an 'appid' column.");
    }

    const appIds = parseResult.data
      .map((row) => row.appid?.toString().trim())
      .filter((id): id is string => !!id); // Filter out empty/null IDs

    console.log(`Successfully read ${appIds.length} AppIDs.`);
    return appIds;
  } catch (error: any) {
    console.error(`Error reading or parsing CSV file at ${filePath}:`, error);
    // Re-throw or handle as appropriate for the calling context
    throw new Error(`Failed to process CSV file ${filePath}: ${error.message}`);
  }
}

// Example Usage (can be run directly via node or imported elsewhere)
// async function main() {
//   // Assume the CSV is placed at the root of the project for now
//   const csvPath = './steam_appids_seed.csv';
//   try {
//     const appIds = await readSteamAppIdsFromCsv(csvPath);
//     console.log('Found AppIDs:', appIds);
//     // Next step: Pass these IDs to the enrichment worker
//   } catch (error) {
//     console.error('Failed to run CSV ingestion:', error);
//   }
// }

// if (require.main === module) { // Basic check if run directly
//   main();
// }
