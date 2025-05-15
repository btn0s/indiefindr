import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // Ensure .env.local is loaded

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Supabase URL not found. Please set NEXT_PUBLIC_SUPABASE_URL."
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "Supabase Service Role Key not found. Please set SUPABASE_SERVICE_ROLE_KEY."
  );
}

// Create a Supabase client with the service role key for direct table access
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function fetchAllExternalIds() {
  console.log("Fetching all external_id values from external_source table...");

  try {
    const { data, error, count } = await supabase
      .from("external_source") // Target the existing table
      .select("external_id", { count: "exact", head: false }); // Select only external_id and get count

    if (error) {
      console.error("Error fetching external_ids:", error.message);
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`Successfully fetched ${count} external_id(s):`);
      data.forEach((item) => {
        console.log(item.external_id);
      });
      // Optionally, save to a file here if needed
      // import fs from 'fs';
      // fs.writeFileSync('external_ids_backup.json', JSON.stringify(data.map(item => item.external_id), null, 2));
      // console.log('Saved external_ids to external_ids_backup.json');
    } else {
      console.log("No external_ids found in the external_source table.");
    }
  } catch (err) {
    console.error("An error occurred during the fetch operation:", err);
  }
}

fetchAllExternalIds()
  .then(() => console.log("Script completed."))
  .catch(() => console.error("Script failed."));
