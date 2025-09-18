import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default function ComingSoonPage() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-6xl font-bold mb-6">Indiefindr</h1>

        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          Discover your next favorite indie game.
        </p>

        <p className="text-lg text-muted-foreground mb-12">Coming soon.</p>

        <Link
          href="https://x.com/indiefindr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 rounded-full text-lg font-medium hover:opacity-90 transition-opacity"
        >
          Follow us on Twitter for updates
          <ExternalLink className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
