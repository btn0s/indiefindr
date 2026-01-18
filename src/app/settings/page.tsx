"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setUsername, updateDisplayName, deleteAccount } from "@/lib/actions/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Logo from "@/components/logo";
import { User, ArrowLeft, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [username, setUsernameValue] = useState("");
  const [displayName, setDisplayNameValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? null);

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          setCurrentUsername(profile.username);
          setUsernameValue(profile.username || "");
          setDisplayNameValue(profile.display_name || "");
        }
      } catch (error) {
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (username !== currentUsername) {
        const usernameResult = await setUsername(userId, username);
        if (usernameResult.error) {
          toast.error(usernameResult.error);
          setIsSaving(false);
          return;
        }
        setCurrentUsername(username.toLowerCase().trim());
      }

      const currentDisplayName = displayName.trim() || null;
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      
      if (currentDisplayName !== (currentProfile?.display_name || null)) {
        const displayNameResult = await updateDisplayName(userId, currentDisplayName);
        if (displayNameResult.error) {
          toast.error(displayNameResult.error);
          setIsSaving(false);
          return;
        }
      }

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userId)
        .maybeSingle();

      if (updatedProfile) {
        setCurrentUsername(updatedProfile.username);
        setUsernameValue(updatedProfile.username || "");
        setDisplayNameValue(updatedProfile.display_name || "");
      }

      toast.success("Profile updated!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-2xl py-12 px-4">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl py-12 px-4">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <Link href="/saved">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h1 className="text-2xl font-semibold">Profile Settings</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 p-6 border rounded-lg">
            <h2 className="text-lg font-medium">Account Information</h2>
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here. Contact support if you need to update your email.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-6 border rounded-lg">
            <h2 className="text-lg font-medium">Public Profile</h2>
            
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
                3-20 characters, lowercase letters, numbers, and underscores only. Your saved games will be available at /@{username}/saved
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayNameValue(e.target.value)}
                disabled={isSaving}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Optional. This will be shown on your public profile instead of your username.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Link href="/saved">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>

        <div className="flex flex-col gap-4 p-6 border border-destructive/50 rounded-lg">
          <h2 className="text-lg font-medium text-destructive">Danger Zone</h2>
          
          {!showDeleteConfirm ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-fit"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete your account, profile, and all saved games. 
                Type <span className="font-mono font-semibold">delete my account</span> to confirm.
              </p>
              <Input
                type="text"
                placeholder="delete my account"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={isDeleting}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteConfirmText !== "delete my account" || isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const result = await deleteAccount();
                      if (result.error) {
                        toast.error(result.error);
                        setIsDeleting(false);
                        return;
                      }
                      
                      const supabase = getSupabaseBrowserClient();
                      await supabase.auth.signOut();
                      
                      toast.success("Account deleted successfully");
                      router.push("/");
                    } catch (error) {
                      toast.error("Failed to delete account");
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
