"use server";

import { getBrowsePage, type CardGame } from "@/lib/catalog";

export async function loadMoreGames(offset: number): Promise<CardGame[]> {
  return getBrowsePage(offset);
}
