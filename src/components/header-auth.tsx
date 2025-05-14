import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
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
import { hasEnvVars } from "@/utils/supabase/check-env-vars"; // Keep this utility
import { SubmitGameDialog } from "./nav/submit-game-dialog";
import { signOutAction } from "@/app/(api)/actions/auth";

// Define Profile type (can be shared or defined locally)
type Profile = {
  id: string;
  username: string | null;
  // Add other fields if needed, e.g., email for initials if not on auth.user
  email?: string | null; // Assuming email might come from profile or auth user
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

  if (!hasEnvVars) {
    return (
      <Badge variant={"default"} className="font-normal pointer-events-none">
        Update .env.local
      </Badge>
    );
  }

  const getUserInitials = () => {
    // Prefer profile email if available, fallback to authUser email
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
            <DropdownMenuItem asChild>
              {/* Link to user profile using username from userProfile */}
              <Link href={`/user/${userProfile.username ?? "unknown"}`}>
                Profile
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={signOutAction} className="w-full">
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
