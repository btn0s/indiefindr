"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { motion } from "motion/react";
import { GamepadIcon, BookMarked, Gamepad2 } from "lucide-react";
import { Button } from "./ui/button";

// Types for the component props
interface ProfileData {
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  fullName: string | null;
}

interface ProfileMiniCardProps {
  isLoggedIn: boolean;
  userProfile: ProfileData | null;
  libraryCount: number;
  findsCount: number;
}

// Helper function for initials
const getUserInitials = (
  name?: string | null,
  fallbackEmail?: string | null
) => {
  if (name) {
    const names = name.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  }
  if (fallbackEmail) {
    return fallbackEmail.charAt(0).toUpperCase();
  }
  return "?";
};

export function ProfileMiniCard({
  isLoggedIn,
  userProfile,
  libraryCount,
  findsCount,
}: ProfileMiniCardProps) {
  return (
    <aside className="bg-card text-card-foreground p-4 border rounded-lg shadow-sm sticky top-24">
      {isLoggedIn && userProfile ? (
        <motion.div
          initial={{ opacity: 0.6, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="space-y-3">
            <Link
              href={`/user/${userProfile.username}`}
              className="group flex items-center gap-3"
            >
              <Avatar className="size-8 border ring-1 ring-primary/10">
                <AvatarImage
                  src={userProfile.avatarUrl ?? undefined}
                  alt={userProfile.username ?? "User avatar"}
                />
                <AvatarFallback className="bg-primary/5 text-primary">
                  {getUserInitials(userProfile.fullName, userProfile.username)}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col">
                <h2
                  className="text-base font-semibold leading-none truncate group-hover:text-primary transition-colors"
                  title={userProfile.username ?? undefined}
                >
                  {userProfile.username || "user"}
                </h2>
                {userProfile.fullName && (
                  <p
                    className="text-xs text-muted-foreground truncate -mt-0.5"
                    title={userProfile.fullName}
                  >
                    {userProfile.fullName}
                  </p>
                )}
              </div>
            </Link>

            {userProfile.bio && (
              <p
                className="text-xs text-muted-foreground line-clamp-2 border-l-2 border-primary/20 pl-2 italic"
                title={userProfile.bio}
              >
                "{userProfile.bio}"
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href={`/user/${userProfile.username}?tab=library`}
              className="flex flex-col items-center p-2 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <span className="text-xs text-muted-foreground">Library</span>
              <span className="text-lg font-semibold">{libraryCount}</span>
            </Link>
            <Link
              href={`/user/${userProfile.username}?tab=finds`}
              className="flex flex-col items-center p-2 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <span className="text-xs text-muted-foreground">Finds</span>
              <span className="text-lg font-semibold">{findsCount}</span>
            </Link>
          </div>

          <Button variant="secondary" className="w-full" asChild>
            <Link
              href={`/user/${userProfile.username}`}
              className="flex items-center justify-center w-full gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <span>View Full Profile</span>
            </Link>
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0.6, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="size-10 border bg-primary/5">
              <AvatarFallback className="text-primary">IF</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base font-semibold">IndieFindr</h2>
              <p className="text-xs text-muted-foreground">
                Join our community
              </p>
            </div>
          </div>

          <p className="text-sm">
            Create your personalized game library, discover hidden gems, and
            track indie games you love.
          </p>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="pt-1"
          >
            <Link
              href="/login"
              className="block w-full text-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              Login / Sign Up
            </Link>
          </motion.div>
        </motion.div>
      )}
    </aside>
  );
}
