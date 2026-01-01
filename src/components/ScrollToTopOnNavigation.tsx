"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Scrolls to top on client-side navigations (push/replace).
 * Keeps native scroll restoration on back/forward.
 */
export function ScrollToTopOnNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPopStateRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isPopStateRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // If the URL includes a hash, let the browser/Next handle anchor scrolling.
    if (window.location.hash) return;

    // If this navigation was a back/forward, preserve the restored position.
    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, searchParams]);

  return null;
}

