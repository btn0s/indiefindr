import { notFound } from "next/navigation";
import { getProfileByUsername } from "@/lib/actions/profiles";
import { getSavedCollectionWithPreview } from "@/lib/collections";
import { GameRow } from "@/components/GameRow";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());

  if (!profile) {
    return { title: "User Not Found" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/@${username}`;

  const displayName = profile.display_name || username;

  return {
    title: `${displayName} — IndieFindr`,
    description: `View ${displayName}'s profile and saved games on IndieFindr`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${displayName} — IndieFindr`,
      description: `View ${displayName}'s profile and saved games on IndieFindr`,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${displayName} — IndieFindr`,
      description: `View ${displayName}'s profile and saved games on IndieFindr`,
    },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());

  if (!profile) {
    notFound();
  }

  const savedCollection = await getSavedCollectionWithPreview(profile.id);

  const displayName = profile.display_name || `@${username}`;

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{displayName}</h1>
      </div>

      {savedCollection ? (
        <GameRow
          collections={[savedCollection]}
          getCollectionHref={() => `/@${username}/saved`}
          viewMoreText="View more →"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">
            {displayName} hasn&apos;t shared any games yet.
          </p>
        </div>
      )}
    </main>
  );
}
