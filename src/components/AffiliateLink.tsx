"use client";
import { track } from "@/lib/tracking";

export function AffiliateLink({ appid, url, label, position }: {
  appid: number; url: string; label: string; position: number;
}) {
  return <a href={url} target="_blank" rel="sponsored noopener noreferrer"
    className="underline" onClick={() => track("click_affiliate", appid, appid, position)}>
    {label} ↗
  </a>;
}
