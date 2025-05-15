import { createClient } from "@/utils/supabase/server";
import { DrizzleUserRepository } from "@/lib/repositories/user-repository";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "User not authenticated." },
      { status: 401 }
    );
  }

  const userRepository = new DrizzleUserRepository();

  try {
    const gameIds = await userRepository.getLibraryGameIds(user.id);
    return NextResponse.json({ gameIds });
  } catch (err: any) {
    console.error("Error fetching current user library game IDs:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch library game IDs." },
      { status: 500 }
    );
  }
}
