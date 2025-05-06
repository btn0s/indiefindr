import { NextRequest, NextResponse } from "next/server";
// Remove PrismaClient import
// import { PrismaClient } from "@prisma/client";
import { startOfMonth, endOfMonth } from "date-fns";
// Import Drizzle components
import { db, schema } from "@/db"; // Assuming @/ is configured for src/
import { sql, desc, and, gte, lte } from "drizzle-orm";

// Remove Prisma Client initialization
// const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range");

  // Validate the 'range' parameter
  if (range !== "month") {
    return NextResponse.json(
      { error: 'Invalid or missing range parameter. Use "month".' },
      { status: 400 }
    );
  }

  try {
    // Calculate the start and end dates of the current month
    const now = new Date();
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(now);

    // Fetch finds from the database created within the current month using Drizzle
    const finds = await db
      .select() // Select all columns from the finds table
      .from(schema.finds) // Use the 'finds' table from your schema
      .where(
        and(
          // Assuming 'createdAt' is the relevant date field in your Drizzle schema
          gte(schema.finds.createdAt, startDate),
          lte(schema.finds.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.finds.createdAt)); // Order by creation date, newest first

    // Return the fetched finds as a JSON response
    return NextResponse.json(finds);
  } catch (error) {
    console.error("Error fetching recent finds:", error);

    // Provide a generic error message
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch recent finds.", details: message },
      { status: 500 }
    );
  }
  // No need for finally block to disconnect with Drizzle using postgres-js typically,
  // as connection pooling is handled by the driver.
}
