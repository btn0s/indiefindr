"use client";

import React, { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Home, Search, Library, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import useClickOutside from "@/hooks/useClickOutside";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Input } from "./ui/input";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";

// Dynamically import the AuthButton to avoid server/client mismatch
const AuthButton = dynamic(() => import("./header-auth"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-[140px] bg-muted rounded animate-pulse" />
  ),
});

const transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.25,
};

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentRef, { height: heightContent }] = useMeasure();
  const [menuRef, { width: widthContainer }] = useMeasure();
  const ref = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);

  useClickOutside(ref, () => {
    setSearchOpen(false);
  });

  useEffect(() => {
    if (!widthContainer || maxWidth > 0) return;
    setMaxWidth(widthContainer);
  }, [widthContainer, maxWidth]);

  // Fetch user data
  useEffect(() => {
    async function getUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      } catch (error) {
        console.error("Error getting user:", error);
      } finally {
        setUserLoading(false);
      }
    }

    getUser();
  }, []);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  const createNavItems = () => [
    {
      id: 1,
      label: "Discover",
      href: "/",
      icon: <Home className="h-5 w-5" />,
    },
    {
      id: 2,
      label: "Search",
      href: "/search",
      icon: <Search className="h-5 w-5" />,
    },
    {
      id: 3,
      label: "Library",
      href: "/profile/library",
      icon: <Library className="h-5 w-5" />,
    },
    {
      id: 4,
      label: "Profile",
      href: "/profile",
      icon: userLoading ? (
        <div className="h-5 w-5 bg-muted rounded-full animate-pulse" />
      ) : user ? (
        <Avatar className="h-5 w-5 border border-border">
          <AvatarFallback className="text-[10px]">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <User className="h-5 w-5" />
      ),
    },
  ];

  const NAV_ITEMS = createNavItems();

  const isNavActive = (item: (typeof NAV_ITEMS)[0]) => {
    // When search is open, only the search icon should be active
    if (searchOpen) {
      return item.id === 2;
    }

    if (item.href === "/" && pathname === "/") return true;
    if (item.href !== "/" && pathname.startsWith(item.href)) {
      // Special case for library
      if (item.href === "/profile" && pathname.includes("/library")) {
        return false;
      }
      return true;
    }
    return false;
  };

  const handleNavClick = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.id === 2) {
      // Search
      setSearchOpen(!searchOpen);
    } else {
      // Close search if it's open when navigating to another page
      if (searchOpen) {
        setSearchOpen(false);
      }
      router.push(item.href);
    }
  };

  return (
    <>
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">IndieFindr</span>
          </Link>

          {/* Auth Button */}
          <div className="flex">
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <motion.div
          className="pointer-events-auto"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
          ref={ref}
        >
          <motion.div
            className="rounded-xl border border-border/40 bg-background/95 backdrop-blur shadow-lg"
            animate={{
              width: searchOpen ? "min(320px, 90vw)" : "auto",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="overflow-hidden">
              <AnimatePresence initial={false} mode="sync">
                {searchOpen && (
                  <motion.div
                    key="search-content"
                    initial={{ height: 0 }}
                    animate={{ height: heightContent || 0 }}
                    exit={{ height: 0 }}
                    transition={transition}
                  >
                    <div ref={contentRef} className="p-3">
                      <form onSubmit={handleSearch} className="flex gap-2">
                        <Input
                          ref={inputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search games..."
                          className="flex-1 text-sm"
                        />
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2 p-2 justify-center" ref={menuRef}>
              {NAV_ITEMS.map((item) => {
                const isItemActive = isNavActive(item);
                const isSearchItem = item.id === 2;
                const isSelected = isSearchItem && searchOpen;
                const isDimmed = searchOpen && !isSearchItem;

                return (
                  <motion.button
                    key={item.id}
                    aria-label={item.label}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                      isSelected || isItemActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    animate={{
                      opacity: isDimmed ? 0.3 : 1,
                      scale: isSelected ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleNavClick(item)}
                  >
                    {item.icon}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
