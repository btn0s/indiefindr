"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, setUsername, generateAndSetRandomUsername } from "@/lib/actions/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Logo from "@/components/logo";
import Link from "next/link";

export default function UsernamePage() {
  const router = useRouter();
  const [username, setUsernameValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);
        const profile = await getCurrentUserProfile();
        if (profile) {
          setCurrentUsername(profile.username);
          setUsernameValue(profile.username || "");
        } else if (user.email) {
          // Prefill with email prefix if no username exists
          const emailPrefix = user.email.split("@")[0];
          // Sanitize: lowercase, replace invalid chars with underscore, collapse underscores, trim edges
          const sanitized = emailPrefix
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");

          if (sanitized.length >= 3) {
            setUsernameValue(sanitized);
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load username settings"
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    try {
      const result = await setUsername(userId, username);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Username updated!");
        setCurrentUsername(username.toLowerCase().trim());
        router.push("/saved");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update username");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-md py-12 px-4">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-md py-12 px-4">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-xl font-bold">IndieFindr</span>
          </Link>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {currentUsername ? "Update Username" : "Choose Your Username"}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {currentUsername
                ? "Your saved lists will be available at /@" + currentUsername + "/saved"
                : "Choose a username to get a shareable link for your saved games"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="username"
                type="text"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsernameValue(e.target.value)}
                required
                disabled={isSaving}
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3-20 characters, lowercase letters, numbers, and underscores only
            </p>
          </div>

          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : currentUsername ? "Update Username" : "Claim Username"}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!userId) return;
              setIsSaving(true);
              try {
                const result = await generateAndSetRandomUsername(userId);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`Username set to @${result.username}!`);
                  router.push("/saved");
                }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to generate username");
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? "Generating..." : "Skip for now"}
          </Button>
        </div>
      </div>
    </main>
  );
}
