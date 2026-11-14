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
// wait for hydration. Each loaded URL gets a rule in its own stylesheet instead of an attribute on the <img>, which
// React owns; a cover that's already loaded then shows at once on the next page, with no fade. A failed image gets no
// rule and keeps its placeholder. It listens on document because element load events never reach window. An image
// that finished before its load event could be seen (Safari, a preloaded or cached one) is caught once the page has parsed.
// The empty touchstart listener is what makes iOS Safari apply :active while a finger is down; without one, a press
// only flashes on release, which reads as a bounce.
const ART_FADE = `(function(){var d=document,s=new CSSStyleSheet,seen={};d.adoptedStyleSheets=d.adoptedStyleSheets.concat(s);d.documentElement.dataset.artFade="";function show(t){var u=t.tagName==="IMG"&&t.getAttribute("src");if(!u||seen[u])return;seen[u]=1;u='[src="'+CSS.escape(u)+'"]';s.insertRule("img"+u+"{opacity:1!important}");s.insertRule(":has(>img"+u+")::before{animation:none!important}")}d.addEventListener("load",function(e){show(e.target)},true);d.addEventListener("DOMContentLoaded",function(){for(var i=0,m=d.images;i<m.length;i++)if(m[i].complete&&m[i].naturalWidth)show(m[i])});d.addEventListener("touchstart",function(){},{passive:true})})()`;

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
          <div id="content" className="px-4 sm:px-7">{children}</div>
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
