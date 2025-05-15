import React, { ReactNode } from "react";
import { PersonalizationProvider } from "@/contexts/PersonalizationContext";
import { LibraryProvider } from "@/contexts/LibraryContext"; // Assuming this is the correct path

// Mock/Placeholder Providers for structure, replace with actual providers later
const AuthProviderPlaceholder: React.FC<{ children: ReactNode }> = ({
  children,
}) => <>{children}</>;
const ThemeProviderPlaceholder: React.FC<{ children: ReactNode }> = ({
  children,
}) => <>{children}</>;
const UserPreferencesProviderPlaceholder: React.FC<{ children: ReactNode }> = ({
  children,
}) => <>{children}</>;

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProviderPlaceholder>
      {" "}
      {/* Replace with actual AuthProvider */}
      <ThemeProviderPlaceholder>
        {" "}
        {/* Replace with actual ThemeProvider */}
        <LibraryProvider>
          <UserPreferencesProviderPlaceholder>
            {" "}
            {/* Replace with actual UserPreferencesProvider if separate from Personalization */}
            <PersonalizationProvider>{children}</PersonalizationProvider>
          </UserPreferencesProviderPlaceholder>
        </LibraryProvider>
      </ThemeProviderPlaceholder>
    </AuthProviderPlaceholder>
  );
};
