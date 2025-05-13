import React from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user is logged in, redirect to sign-in
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center">Welcome to IndieFindr</h1>
          <p className="text-center text-muted-foreground mt-2">
            Let's get you set up so you can discover indie games you'll love
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

