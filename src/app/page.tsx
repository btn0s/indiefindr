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
      {/* Render the FeedDisplay client component, passing login status */}
      <Feed isLoggedIn={isLoggedIn} />
    </main>
  );
}
