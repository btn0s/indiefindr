import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Header } from "@/components/Header";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "IndieFindr - Discover Your Next Favorite Indie Game",
  description:
    "IndieFindr is your curated feed for discovering exciting new indie games. Explore the latest finds and uncover hidden gems from the indie gaming world.",
  keywords: [
    "indie games",
    "game discovery",
    "indie gaming",
    "video games",
    "indie developers",
  ],
  openGraph: {
    title: "IndieFindr - Discover Your Next Favorite Indie Game",
    description:
      "Your curated feed for discovering exciting new indie games. Explore the latest finds and uncover hidden gems.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "IndieFindr - Discover Your Next Favorite Indie Game",
    description:
      "Your curated feed for discovering exciting new indie games. Explore the latest finds and uncover hidden gems.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-gray-50 font-sans antialiased",
          fontSans.variable
        )}
      >
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
