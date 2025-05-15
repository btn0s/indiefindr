import { ThemeSwitcher } from "@/components/theme-switcher";
import { Geist } from "next/font/google";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers";
import { createClient } from "@/utils/supabase/server";
import { DrizzleUserRepository } from "@/lib/repositories/user-repository";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const defaultTitle = "IndieFindr - Discover your next favorite indie game.";
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
        url: "/og.png",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialLibraryGameIds: number[] = [];
  if (user) {
    const userRepository = new DrizzleUserRepository();
    try {
      initialLibraryGameIds = await userRepository.getLibraryGameIds(user.id);
    } catch (error) {
      console.error(
        "RootLayout: Failed to fetch initial library game IDs:",
        error
      );
    }
  }

  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>
        <AppProviders initialLibraryGameIds={initialLibraryGameIds}>
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
