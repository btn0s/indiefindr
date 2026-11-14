import { adsenseClient } from "@/lib/monetization";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Navbar } from "@/components/Navbar";
import { getPopularIndies } from "@/lib/catalog";

import "./globals.css";

export const preferredRegion = "pdx1";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Lets art fade up once it has loaded (see globals.css). It runs in the head, before any image starts, so it doesn't
// wait for hydration. Each art image is marked on its own element as it loads: data-art="fade" fades it up, "shown" puts
// it there at once. A picture already in hand shows at once with no fade: one already decoded when it's inserted (the
// observer runs before the next paint), or one this page has loaded before (an earlier card's header, a cover seen on a
// previous page). A failed image is never marked and keeps its placeholder. It listens on document because element load
// events never reach window. An image that finished before its load event could be seen (Safari, a preloaded or cached
// one) is caught once the page has parsed. React owns these <img>s, so each art image carries suppressHydrationWarning
// for the mark, and a new src clears the mark so the new picture loads like any other.
// The empty touchstart listener is what makes iOS Safari apply :active while a finger is down; without one, a press
// only flashes on release, which reads as a bounce.
const ART_FADE = `(function(){var d=document,r=d.documentElement,seen=new Set,ART=":is(.game-card-art,.search-art,.showcase-source,.showcase-tile,.game-trailer)>img";r.dataset.artFade="";function mark(i,now){if(i.tagName!=="IMG"||!i.complete||!i.naturalWidth||i.hasAttribute("data-art")||!i.matches(ART))return;var u=i.getAttribute("src");i.setAttribute("data-art",now||seen.has(u)?"shown":"fade");seen.add(u)}function all(n){n.querySelectorAll(ART).forEach(function(i){mark(i,1)})}d.addEventListener("load",function(e){mark(e.target)},true);d.addEventListener("DOMContentLoaded",function(){for(var i=0,m=d.images;i<m.length;i++)mark(m[i])});new MutationObserver(function(l){l.forEach(function(m){var t=m.target;if(m.type==="attributes"){if(t.tagName==="IMG"&&t.hasAttribute("data-art")){t.removeAttribute("data-art");mark(t,1)}}else m.addedNodes.forEach(function(n){if(n.tagName==="IMG")mark(n,1);else if(n.firstElementChild)all(n)})})}).observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});d.addEventListener("touchstart",function(){},{passive:true})})()`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

export const metadata: Metadata = {
  other: adsenseClient() ? { "google-adsense-account": adsenseClient()! } : {},
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg"
  ),
  title: {
    default: "IndieFindr: Find your next favorite indie game",
    template: "%s — IndieFindr",
  },
  description:
    "Find games like your favorites. Discover similar indie games on Steam with recommendations based on gameplay, themes, and feel.",
  openGraph: {
    siteName: "IndieFindr",
    locale: "en_US",
    type: "website",
  },
};

// Pinch zoom stays available: inputs are 16px on phones, so iOS has no reason to zoom on focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "IndieFindr",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "Discover indie games on Steam with indie game recommendations",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "IndieFindr",
  url: SITE_URL
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ART_FADE }} />
        {/* Every store image (headers, screenshots, trailer posters) is served from this host. */}
        <link rel="preconnect" href="https://shared.akamai.steamstatic.com" />
        <link rel="dns-prefetch" href="https://shared.akamai.steamstatic.com" />
      </head>
      <body
        className={`${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <div className="site-shell">
          <a href="#content" className="skip-link">Skip to content</a>
          <Navbar popular={await getPopularIndies()} />
          <div id="content">{children}</div>
          <footer className="site-footer">
            <nav aria-label="Footer"><Link href="/agents">Agent access</Link><Link href="/privacy">Privacy</Link></nav>
            <p>indiefindr · Game information and media from Steam.</p>
          </footer>
        </div>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
