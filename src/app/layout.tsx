import { ThemeSwitcher } from "@/components/theme-switcher";
import { Geist } from "next/font/google";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const defaultTitle = "Discover your next favorite indie game.";
const defaultDescription =
  "Find and curate hidden gems easily missed on Steam.";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: defaultTitle,
  description: defaultDescription,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: defaultUrl,
    siteName: "IndieFindr",
    images: [
      {
        url: `${defaultUrl}/og-image.png`,
        width: 1200,
        height: 630,
      },
    ],
  },
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>
        <AppProviders>
          <main className="min-h-screen">
            <TopNav />
            <div className="max-w-5xl p-4 mx-auto pb-24">{children}</div>
            <BottomNav />
          </main>
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
