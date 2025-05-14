import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { createClient as createServerSupabaseClient } from "@/utils/supabase/server"; // Server client
import { db } from "@/db"; // Server Drizzle client
import { profilesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation"; // For server-side redirect
import { hasEnvVars } from "@/utils/supabase/check-env-vars"; // Keep this utility
import { SubmitGameDialog } from "./nav/submit-game-dialog";

// Define Profile type (can be shared or defined locally)
type Profile = {
  id: string;
  username: string | null;
  // Add other fields if needed, e.g., email for initials if not on auth.user
  email?: string | null; // Assuming email might come from profile or auth user
  avatarUrl?: string | null;
  fullName?: string | null;
};

export default async function AuthButton() {
  let authUser: any = null;
  let userProfile: Profile | null = null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  authUser = data.user;

  if (authUser?.id) {
    const profileResult = await db
      .select({
        id: profilesTable.id,
        username: profilesTable.username,
        // email: profilesTable.email, // Assuming you might have email in profiles for consistency
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, authUser.id))
      .limit(1);

    if (profileResult.length > 0) {
      userProfile = profileResult[0];
    }
  }

  async function handleSignOutAction() {
    "use server"; // This is a Server Action
    const supabaseSignOut = await createServerSupabaseClient();
    await supabaseSignOut.auth.signOut();
    return redirect("/sign-in"); // Use server-side redirect
  }

  if (!hasEnvVars) {
    return (
      <Badge variant={"default"} className="font-normal pointer-events-none">
        Update .env.local
      </Badge>
    );
  }

  const getUserInitials = (name?: string | null) => {
    // If name is provided, use it to generate initials
    if (name) {
      const names = name.split(" ");
      if (names.length === 1) return names[0].charAt(0).toUpperCase();
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    
    // Fallback to email if no name is provided
    const emailToUse = userProfile?.email || authUser?.email;
    if (!emailToUse) return "U";
    return emailToUse.charAt(0).toUpperCase();
  };

  return authUser && userProfile ? (
    <>
      <SubmitGameDialog />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 p-0"
          >
            <Avatar>
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
            <span className="sr-only">User menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Account</span>
              {/* Display email from authUser as profile might not have it or it might differ */}
              <span className="text-xs text-muted-foreground">
                {authUser.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {userProfile && (
              <Link href={`/${userProfile.username ?? "unknown"}`}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={userProfile.avatarUrl ?? undefined}
                      alt={userProfile.username ?? "User avatar"}
                    />
                    <AvatarFallback>
                      {getUserInitials(userProfile.fullName ?? userProfile.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block">
                    {userProfile.username}
                  </span>
                </div>
              </Link>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={handleSignOutAction} className="w-full">
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive px-2 py-1.5 text-sm h-auto font-normal"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Sign out</span>
              </Button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <Button asChild size="sm" variant={"default"}>
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}
