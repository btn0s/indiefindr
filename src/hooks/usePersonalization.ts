import { useContext } from "react";
import {
  PersonalizationContext,
  PersonalizationContextType,
  UserPreferences,
} from "@/contexts/PersonalizationContext"; // Adjust path if needed

// Custom hook to access the PersonalizationContext
export const usePersonalization = (): PersonalizationContextType => {
  const context = useContext(PersonalizationContext);
  if (context === undefined) {
    throw new Error(
      "usePersonalization must be used within a PersonalizationProvider"
    );
  }
  return context;
};

// Example of a more specific hook that might evolve from this,
// directly returning specific pieces of state or derived values.
export const useUserPreferences = (): UserPreferences => {
  const { preferences } = usePersonalization();
  return preferences;
};

// Mock function as per blueprint, can be expanded later
export const usePersonalizedFeed = () => {
  const { preferences, feedSettings } = usePersonalization();

  const getPersonalizedFeed = async (/* params: any */) => {
    console.log(
      "usePersonalizedFeed: Mock fetching personalized feed based on:",
      preferences,
      feedSettings
    );
    // In a real scenario, this would make an API call using preferences and feedSettings
    // For now, return mock data
    await new Promise((resolve) => setTimeout(resolve, 100));
    return [
      {
        id: "game-mock-1",
        title: "Personalized Game 1 for you!",
        basedOn: preferences.favoriteGenres,
      },
      {
        id: "game-mock-2",
        title: "Another Game based on Themes!",
        basedOn: preferences.preferredThemes,
      },
    ];
  };

  return {
    getPersonalizedFeed,
    // Potentially expose current feed items, loading states etc. if this hook managed that directly
  };
};
