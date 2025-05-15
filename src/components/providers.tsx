"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({
  children,
  initialLibraryGameIds,
}: {
  children: React.ReactNode;
  initialLibraryGameIds?: number[];
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <LibraryProvider initialLibraryGameIds={initialLibraryGameIds}>
          {children}
        </LibraryProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
