"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type ManualLinkDisplay = {
  id: string;
  otherAppid: number;
  otherName: string;
  otherHeader: string | null;
  facets: string[];
  note: string | null;
};

type ManualSimilarEditorProps = {
  appid: number;
  existingLinks: ManualLinkDisplay[];
};

const FACET_OPTIONS = [
  { id: "overall", label: "Overall" },
  { id: "aesthetic", label: "Aesthetic" },
  { id: "gameplay", label: "Gameplay" },
  { id: "narrative", label: "Narrative" },
];

const IS_DEV = process.env.NEXT_PUBLIC_ENV === "development";

export function ManualSimilarEditor({
  appid,
  existingLinks,
}: ManualSimilarEditorProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string; header_image: string | null }[]
  >([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedFacets, setSelectedFacets] = useState<Set<string>>(
    () => new Set(["overall"])
  );
  const [note, setNote] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [steamUrl, setSteamUrl] = useState("");
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  // Dev-only UI
  if (!IS_DEV) return null;

  useEffect(() => {
    let cancelled = false;
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    const timer = setTimeout(async () => {
      const query = searchTerm.trim();
      const numericId = Number(query);
      const filters = supabase.from("games").select("id, name, header_image").limit(10);

      const request = Number.isFinite(numericId)
        ? filters.or(`id.eq.${numericId},name.ilike.%${query}%`)
        : filters.ilike("name", `%${query}%`);

      const { data, error } = await request;
      if (cancelled) return;
      if (error) {
        setStatusMessage(error.message);
        setSearchResults([]);
      } else {
        const filtered = (data || []).filter((g) => g.id !== appid);
        setSearchResults(filtered);
      }
      setLoadingSearch(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, appid]);

  const existingIds = useMemo(
    () => new Set(existingLinks.map((l) => l.otherAppid)),
    [existingLinks]
  );

  const toggleFacet = (facetId: string) => {
    setSelectedFacets((prev) => {
      const next = new Set(prev);
      if (next.has(facetId)) {
        next.delete(facetId);
      } else {
        next.add(facetId);
      }
      // Keep at least one
      if (next.size === 0) {
        next.add("overall");
      }
      return next;
    });
  };

  const addLink = async (targetId: number) => {
    setAddingId(targetId);
    setStatusMessage(null);
    try {
      const facets = Array.from(selectedFacets);
      const canonicalSource = Math.min(appid, targetId);
      const canonicalTarget = Math.max(appid, targetId);
      const { error } = await supabase.from("manual_similarities").upsert({
        source_appid: canonicalSource,
        target_appid: canonicalTarget,
        facets,
        note: note.trim() || null,
      });
      if (error) throw error;
      setStatusMessage("Saved link");
      setNote("");
      setSearchTerm("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save link";
      setStatusMessage(message);
    } finally {
      setAddingId(null);
    }
  };

  const ingestGame = async () => {
    if (!steamUrl.trim()) return;
    setIngestStatus("Submitting ingest...");
    try {
      const response = await fetch("/api/games/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to ingest game");
      }
      setIngestStatus("Ingest queued. Refresh after it finishes.");
      setSteamUrl("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to ingest game";
      setIngestStatus(message);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm">Manual links (debug)</div>
        {statusMessage && (
          <div className="text-xs text-muted-foreground">{statusMessage}</div>
        )}
      </div>

      {existingLinks.length > 0 ? (
        <div className="space-y-2">
          {existingLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <div className="font-medium text-sm">{link.otherName}</div>
                <div className="flex flex-wrap gap-1">
                  {link.facets.map((facet) => (
                    <Badge key={facet} variant="secondary" className="text-[10px]">
                      {facet}
                    </Badge>
                  ))}
                </div>
                {link.note && (
                  <div className="text-xs text-muted-foreground">{link.note}</div>
                )}
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href={`/games/${link.otherAppid}`}>Open</a>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          No manual links yet. Add one below.
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold">Facets</div>
        <div className="flex flex-wrap gap-3">
          {FACET_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={selectedFacets.has(option.id)}
                onCheckedChange={() => toggleFacet(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">Note (optional)</div>
        <Input
          placeholder="Why is this similar?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">Search existing games</div>
        <Input
          placeholder="Search by name or appid"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {loadingSearch && (
          <div className="text-xs text-muted-foreground">Searching...</div>
        )}
        {!loadingSearch && searchResults.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{result.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {result.id}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={existingIds.has(result.id) || addingId === result.id}
                  onClick={() => addLink(result.id)}
                >
                  {existingIds.has(result.id)
                    ? "Already linked"
                    : addingId === result.id
                    ? "Saving..."
                    : "Link"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">Ingest new game by Steam URL</div>
        <div className="flex gap-2">
          <Input
            placeholder="https://store.steampowered.com/app/XXXXXX/"
            value={steamUrl}
            onChange={(e) => setSteamUrl(e.target.value)}
          />
          <Button variant="outline" onClick={ingestGame}>
            Ingest
          </Button>
        </div>
        {ingestStatus && (
          <div className="text-xs text-muted-foreground">{ingestStatus}</div>
        )}
      </div>
    </div>
  );
}
