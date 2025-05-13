"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <LibraryProvider>{children}</LibraryProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
