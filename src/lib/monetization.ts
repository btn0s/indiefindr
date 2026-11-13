import { z } from "zod";

export const PROVIDERS = {
  humble: "Humble Bundle",
  fanatical: "Fanatical",
  gmg: "Green Man Gaming",
} as const;

const affiliate = z.object({
  provider: z.enum(["humble", "fanatical", "gmg"]),
  url: z.url().refine((value) => new URL(value).protocol === "https:" && !new URL(value).username && !new URL(value).password),
});
const links = z.record(z.string().regex(/^\d+$/), z.array(affiliate).max(3).refine((items) => new Set(items.map((item) => item.provider)).size === items.length));

/** Only approved, game-specific tracking links supplied by the account owner. */
export function affiliateLinks(appid: number) {
  if (process.env.AFFILIATES_ENABLED !== "true") return [];
  let value: unknown;
  try { value = JSON.parse(process.env.AFFILIATE_LINKS_JSON || "{}"); }
  catch { throw new Error("Invalid affiliate link configuration"); }
  const parsed = links.safeParse(value);
  if (!parsed.success) throw new Error("Invalid affiliate link configuration");
  return parsed.data[String(appid)] || [];

}

export function adsenseClient(): string | undefined {
  const client = process.env.ADSENSE_CLIENT;
  return client && /^ca-pub-\d{16}$/.test(client) ? client : undefined;
}

export function adConfig() {
  if (process.env.ADS_ENABLED !== "true") return null;
  const client = adsenseClient();
  const slot = process.env.ADSENSE_SLOT;
  if (!client || !slot || !/^\d+$/.test(slot)) throw new Error("AdSense account and slot configuration required");
  return { client, slot };
}
