import { adsenseClient } from "@/lib/monetization";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { ScrollToTopOnNavigation } from "@/components/ScrollToTopOnNavigation";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const preferredRegion = "pdx1";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

export const metadata: Metadata = {
  other: adsenseClient() ? { "google-adsense-account": adsenseClient()! } : {},
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg"
  ),
  title: {
    default: "IndieFindr - Discover Games Like Your Favorites",
    template: "%s",
  },
  description:
    "Find games like your favorites. Discover similar indie games on Steam with recommendations based on gameplay, themes, and feel.",
  openGraph: {
    siteName: "IndieFindr",
    locale: "en_US",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link
          rel="preconnect"
          href="https://cdn.akamai.steamstatic.com"
        />
        <link
          rel="dns-prefetch"
          href="https://cdn.akamai.steamstatic.com"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
        <Suspense fallback={null}>
          <ScrollToTopOnNavigation />
        </Suspense>
        <div className="site-shell">
          <Navbar />
          <div className="px-4 sm:px-7">{children}</div>
          <footer className="site-footer"><span>indiefindr</span><span>Game information and media from Steam.</span></footer>
        </div>

        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
