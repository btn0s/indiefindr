"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Force scroll-to-top on all navigations (including back/forward).
 * Next.js already scrolls to top for most navigations, but it restores scroll
 * position on history navigation; this opts into "always top" behavior.
 */
export function ScrollToTopOnNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

