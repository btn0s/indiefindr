"use client";
import { ArrowUpRight } from "lucide-react";
import { track } from "@/lib/tracking";

export function AffiliateLink({ appid, url, label, position }: {
  appid: number; url: string; label: string; position: number;
}) {
  return <a href={url} target="_blank" rel="sponsored noopener noreferrer"
    className="inline-flex items-center gap-1 underline underline-offset-3" onClick={() => track("click_affiliate", appid, appid, position)}>
    {label}<ArrowUpRight size={14} aria-hidden="true" />
  </a>;
}
