import type { Metadata, Viewport } from "next";
import { VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { ScrollToTopOnNavigation } from "@/components/ScrollToTopOnNavigation";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg"
  ),
  title: {
    default: "IndieFindr - Discover Games Like Your Favorites",
    template: "%s",
  },
  description:
    "Find games like your favorites. Discover similar indie games on Steam with AI-powered recommendations and explanations.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${vt323.variable} antialiased bg-[#0a0a0a] text-[#cccccc] font-sans selection:bg-[#00ffcc] selection:text-black`}
      >
        <Suspense fallback={null}>
          <ScrollToTopOnNavigation />
        </Suspense>
        <div className="min-h-screen relative retro-bg">
          <Navbar />
          <main className="container mx-auto max-w-5xl px-4 py-8">
            {children}
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
