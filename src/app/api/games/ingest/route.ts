import { NextRequest, NextResponse } from "next/server";
import { ingestSteamGame } from "@/lib/ingest/ingestSteamGame";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { steamUrl } = body;

    if (!steamUrl || typeof steamUrl !== "string") {
      return NextResponse.json(
        { error: "steamUrl is required" },
        { status: 400 }
      );
    }

    const result = await ingestSteamGame(steamUrl);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, jobId: result.jobId },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
