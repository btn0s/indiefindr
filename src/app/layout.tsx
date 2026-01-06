import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { ScrollToTopOnNavigation } from "@/components/ScrollToTopOnNavigation";
import { DevToolbar } from "@/components/DevToolbar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg"
  ),
  title: {
    default: "indieblargenhagen - Discover Games Like Your Favorites",
    template: "%s",
  },
  description:
    "Find games like your favorites. Discover similar indie games on Steam with AI-powered recommendations and explanations.",
  openGraph: {
    siteName: "indieblargenhagen",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <ScrollToTopOnNavigation />
        </Suspense>
        <div className="min-h-screen bg-zinc-50 dark:bg-black">
          <Navbar />
          <div className="px-4">{children}</div>
        </div>
        <DevToolbar />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
