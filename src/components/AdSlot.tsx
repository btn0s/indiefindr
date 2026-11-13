import { adConfig } from "@/lib/monetization";
import { AdSense } from "./AdSense";
export function AdSlot() {
  const config = adConfig();
  return config ? <AdSense {...config} /> : null;
}
