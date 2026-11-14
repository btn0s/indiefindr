import { affiliateLinks, PROVIDERS } from "@/lib/monetization";
import { AffiliateLink } from "./AffiliateLink";

export function ShopLinks({ appid }: { appid: number }) {
  const links = affiliateLinks(appid);
  if (!links.length) return null;
  const positions = { humble: 1, fanatical: 2, gmg: 3 };
  return <aside className="flex flex-col gap-2 text-sm">
    <p className="text-muted-foreground">We may earn a commission when you buy through these links.</p>
    <div className="flex flex-wrap gap-4">
      {links.map((link) => <AffiliateLink key={link.provider} appid={appid}
        url={link.url} label={PROVIDERS[link.provider]} position={positions[link.provider]} />)}
    </div>
  </aside>;
}
