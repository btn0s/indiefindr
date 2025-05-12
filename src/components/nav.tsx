"use client";

import React, { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Home, Search, Library, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import useClickOutside from "@/hooks/useClickOutside";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Input } from "./ui/input";
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

  useClickOutside(ref, () => {
    setSearchOpen(false);
  });

  useEffect(() => {
    if (!widthContainer || maxWidth > 0) return;
    setMaxWidth(widthContainer);
  }, [widthContainer, maxWidth]);

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

  const NAV_ITEMS = [
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
      icon: (
        <Avatar className="h-5 w-5 border border-border">
          <AvatarFallback className="text-[10px]">U</AvatarFallback>
        </Avatar>
      ),
    },
  ];

  const isNavActive = (item: (typeof NAV_ITEMS)[0]) => {
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
          <div className="rounded-xl border border-border/40 bg-background/95 backdrop-blur shadow-lg">
            <div className="overflow-hidden">
              <AnimatePresence initial={false} mode="sync">
                {searchOpen && (
                  <motion.div
                    key="search-content"
                    initial={{ height: 0 }}
                    animate={{ height: heightContent || 0 }}
                    exit={{ height: 0 }}
                    transition={transition}
                    style={{
                      width: maxWidth,
                    }}
                  >
                    <div ref={contentRef} className="p-3">
                      <form onSubmit={handleSearch} className="flex gap-2">
                        <Input
                          ref={inputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Type a game title, genre, or tag..."
                          className="flex-1 text-sm"
                        />
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2 p-2" ref={menuRef}>
              {NAV_ITEMS.map((item) => {
                const isItemActive = isNavActive(item);
                const isSelected = item.id === 2 && searchOpen;

                return (
                  <button
                    key={item.id}
                    aria-label={item.label}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                      isSelected || isItemActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => handleNavClick(item)}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
