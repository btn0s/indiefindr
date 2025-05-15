// src/contexts/PersonalizationContext.tsx
import React, { createContext, useState, ReactNode, useMemo } from "react";

// Define the shape of your personalization preferences
export interface UserPreferences {
  favoriteGenres: string[];
  preferredThemes: string[];
  // Add other preference fields as needed
}

// Define the shape of the context value
export interface PersonalizationContextType {
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  // Potentially add feed settings or other personalization-related state/actions
  feedSettings: Record<string, any>; // Example, define more strictly later
}

// Create the context with a default undefined value initially,
// as the provider will always supply a value.
export const PersonalizationContext = createContext<
  PersonalizationContextType | undefined
>(undefined);

interface PersonalizationProviderProps {
  children: ReactNode;
}

export const PersonalizationProvider: React.FC<
  PersonalizationProviderProps
> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    favoriteGenres: [], // Initial empty preferences
    preferredThemes: [],
  });

  const [feedSettings, setFeedSettings] = useState<Record<string, any>>({
    showMatureContent: false, // Example feed setting
  });

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...newPreferences }));
    // Here you might also persist preferences to localStorage or a backend
    console.log("Preferences updated:", { ...preferences, ...newPreferences });
  };

  const value = useMemo(
    () => ({
      preferences,
      updatePreferences,
      feedSettings,
      // any other values/functions to expose
    }),
    [preferences, feedSettings]
  );

  return (
    <PersonalizationContext.Provider value={value}>
      {children}
    </PersonalizationContext.Provider>
  );
};
