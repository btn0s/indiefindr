"use client";

import React from "react";
import { motion } from "framer-motion"; // Keep framer-motion if that's what was used, or change to "motion" if it was an error
import { Home, Search, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

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
      href: "/library",
      icon: <Library className="h-5 w-5" />,
    },
  ];

  const NAV_ITEMS = createNavItems();

  const isNavActive = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.href === "/" && pathname === "/") return true;
    if (item.href !== "/" && pathname.startsWith(item.href)) {
      if (item.href === "/library" && pathname.includes("/library")) {
        return true;
      }
      if (item.href === "/search" && pathname.includes("/search")) {
        return true;
      }
      return true;
    }
    return false;
  };

  const handleNavClick = (item: (typeof NAV_ITEMS)[0]) => {
    router.push(item.href);
  };

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.div
        className="pointer-events-auto"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <motion.div className="rounded-xl border border-border/40 bg-background/95 backdrop-blur shadow-lg">
          <div className="flex gap-2 p-2 justify-center">
            {NAV_ITEMS.map((item) => {
              const isItemActive = isNavActive(item);

              return (
                <motion.button
                  key={item.id}
                  aria-label={item.label}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                    isItemActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
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
  );
}
