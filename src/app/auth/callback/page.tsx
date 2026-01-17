"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/actions/profiles";
import { Spinner } from "@/components/ui/spinner";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Auth callback error:", error);
          router.push("/login?error=auth_failed");
          return;
        }

        const profile = await getCurrentUserProfile();
        if (!profile?.username) {
          router.push("/settings/username");
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        router.push("/login");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <main className="container mx-auto max-w-md py-12 px-4">
      <div className="flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="container mx-auto max-w-md py-12 px-4">
          <div className="flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
