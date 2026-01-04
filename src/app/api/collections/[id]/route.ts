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

const IdSchema = z.string().uuid();

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  pinned_rank: z.number().int().optional(),
  addAppids: z.array(z.number().int().positive()).max(200).optional(),
  removeAppids: z.array(z.number().int().positive()).max(200).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = IdSchema.parse(id);

    const supabase = getSupabaseServerClient();
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("id, title, description, pinned, pinned_rank, created_at, updated_at")
      .eq("id", collectionId)
      .maybeSingle();

    if (collectionError) {
      return NextResponse.json({ error: collectionError.message }, { status: 500 });
    }
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("collection_items")
      .select(
        "created_at, games_new(appid, title, header_image, screenshots, videos, short_description, long_description, raw, suggested_game_appids, created_at, updated_at)"
      )
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const games = (items || [])
      .map((row) => {
        const embedded = row.games_new as unknown;
        if (Array.isArray(embedded)) return embedded[0] ?? null;
        return embedded ?? null;
      })
      .filter(Boolean);

    return NextResponse.json({ collection, games });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const collectionId = IdSchema.parse(id);
    const body = PatchSchema.parse(await request.json());
    const supabase = getSupabaseServiceRoleClient();

    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.description === "string") updates.description = body.description;
    if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
    if (typeof body.pinned_rank === "number") updates.pinned_rank = body.pinned_rank;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("collections")
        .update(updates)
        .eq("id", collectionId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (body.addAppids && body.addAppids.length > 0) {
      const rows = body.addAppids.map((appid) => ({
        collection_id: collectionId,
        appid,
      }));
      const { error: insertError } = await supabase
        .from("collection_items")
        .insert(rows, { defaultToNull: false });
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    if (body.removeAppids && body.removeAppids.length > 0) {
      const { error: deleteError } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collectionId)
        .in("appid", body.removeAppids);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
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

