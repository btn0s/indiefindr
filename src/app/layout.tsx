import { ThemeSwitcher } from "@/components/theme-switcher";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Nav } from "@/components/nav";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "IndieFindr - AI-Powered Indie Game Discovery",
  description: "Discover your next favorite indie game.",
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
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen">
            <Nav />
            <div className="max-w-5xl p-4 mx-auto">{children}</div>
            <div className="flex items-center justify-center border-t mx-auto text-center text-xs py-8">
              <ThemeSwitcher />
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
