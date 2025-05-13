import React from "react";
import { createClient } from "@/utils/supabase/server";
import { Feed } from "@/components/feed"; // Import the new client component

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;

  return (
    <main className="">
      {!isLoggedIn && (
        <section className="py-12 text-center md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
              Discover Your Next Favorite Indie Game
            </h1>
            <p className="mx-auto mt-4 max-w-[700px] text-lg text-muted-foreground md:text-xl">
              A simple, personalized way to discover and play unique indie games
              you'll love.
            </p>
          </div>
        </section>
      )}
      {/* Render the FeedDisplay client component, passing login status */}
      <Feed isLoggedIn={isLoggedIn} />
    </main>
  );
}
