import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

function isAdmin(request: Request): boolean {
  const expected = process.env.COLLECTIONS_ADMIN_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return token === expected;
}

const CreateCollectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  pinned_rank: z.number().int().optional(),
  appids: z.array(z.number().int().positive()).max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pinnedOnly = url.searchParams.get("pinned") === "true";

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("collections")
      .select("id, title, description, pinned, pinned_rank, created_at, updated_at");

    if (pinnedOnly) {
      query = query
        .eq("pinned", true)
        .order("pinned_rank", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      query = query
        .order("pinned", { ascending: false })
        .order("pinned_rank", { ascending: false })
        .order("created_at", { ascending: false });
    }

    const { data, error } = await query.limit(100);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ collections: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json(
        {
          error:
            "Forbidden. Set COLLECTIONS_ADMIN_TOKEN and call with Authorization: Bearer <token>.",
        },
        { status: 403 }
      );
    }

    const body = CreateCollectionSchema.parse(await request.json());
    const supabase = getSupabaseServiceRoleClient();

    const { data: created, error: createError } = await supabase
      .from("collections")
      .insert({
        title: body.title,
        description: body.description ?? null,
        pinned: body.pinned ?? false,
        pinned_rank: body.pinned_rank ?? 0,
      })
      .select("id, title, description, pinned, pinned_rank, created_at, updated_at")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create collection" },
        { status: 500 }
      );
    }

    if (body.appids && body.appids.length > 0) {
      const rows = body.appids.map((appid) => ({
        collection_id: created.id,
        appid,
      }));
      const { error: itemsError } = await supabase
        .from("collection_items")
        .insert(rows);
      if (itemsError) {
        return NextResponse.json(
          {
            error: itemsError.message,
            collection: created,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ collection: created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

