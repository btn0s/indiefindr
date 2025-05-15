import {
  DrizzleUserRepository,
  ProfileUpdate as RepoProfileUpdate,
  ProfileInsert,
  Profile,
} from "@/lib/repositories/user-repository";
import type { Profile as RepoProfile } from "@/lib/repositories/user-repository"; // For return types if needed

// Define the input structure for profile updates at the service level
// This can be similar to the action's ProfileUpdateParams
export interface ServiceProfileUpdatePayload {
  username?: string; // Username is optional if not changing, but required if new or being updated
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  // hasCompletedOnboarding is handled by a separate service method for clarity
}

export interface UserService {
  markOnboardingAsCompleted(
    userId: string
  ): Promise<{ success: boolean; error?: string }>;
  updateUserProfile(
    userId: string,
    data: ServiceProfileUpdatePayload
  ): Promise<{ success: boolean; error?: string; profile?: Profile }>;
  getUserProfile(userId: string): Promise<Profile | null>;
  // Add other user-related service methods here, e.g.:
  // getUserProfile(userId: string): Promise<Profile | null>;
  // updateUserProfile(userId: string, data: ProfileUpdate): Promise<Profile | null>;
}

export class DefaultUserService implements UserService {
  private userRepository: DrizzleUserRepository;

  constructor() {
    // In a real app, DrizzleUserRepository might be injected or provided as a singleton.
    this.userRepository = new DrizzleUserRepository();
  }

  async markOnboardingAsCompleted(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
      console.error(
        "UserService: markOnboardingAsCompleted called without userId."
      );
      return { success: false, error: "User ID is required." };
    }

    console.log(
      `UserService: Marking onboarding as completed for userId: ${userId}`
    );
    try {
      const updateData: RepoProfileUpdate = {
        hasCompletedOnboarding: true,
        updatedAt: new Date(), // Explicitly set updatedAt as per original action
      };

      const updatedProfile = await this.userRepository.update(
        userId,
        updateData
      );

      if (!updatedProfile) {
        // This might happen if the user ID doesn't exist, though update usually doesn't fail silently.
        // The repository's update method returns null if not found/updated.
        console.warn(
          `UserService: Failed to update profile for userId ${userId} - user may not exist.`
        );
        return {
          success: false,
          error: "User profile not found or update failed.",
        };
      }

      console.log(
        `UserService: Onboarding marked as completed for userId: ${userId}`
      );
      return { success: true };
    } catch (error) {
      console.error(
        `UserService: Error marking onboarding as completed for userId ${userId}:`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      };
    }
  }

  async getUserProfile(userId: string): Promise<Profile | null> {
    if (!userId) {
      console.error("UserService: getUserProfile called with no userId");
      return null;
    }
    try {
      return await this.userRepository.getById(userId);
    } catch (error) {
      console.error(
        `UserService: Error fetching profile for userId ${userId}:`,
        error
      );
      return null;
    }
  }

  async updateUserProfile(
    userId: string,
    data: ServiceProfileUpdatePayload
  ): Promise<{ success: boolean; error?: string; profile?: Profile }> {
    if (!userId) {
      return {
        success: false,
        error: "User ID is required for profile update.",
      };
    }
    if (!data.username) {
      return {
        success: false,
        error: "Username is required for profile update.",
      };
    }

    try {
      // 1. Check if username is being changed and if the new one is available
      if (data.username) {
        const existingUserWithNewUsername =
          await this.userRepository.getByUsername(data.username);
        if (
          existingUserWithNewUsername &&
          existingUserWithNewUsername.id !== userId
        ) {
          return { success: false, error: "Username is already taken." };
        }
      }

      // 2. Prepare data for repository (ensure all fields are correctly typed for insert/update)
      const profileDataForRepo: RepoProfileUpdate & { username: string } = {
        username: data.username, // Username is now guaranteed by the check above
        fullName: data.fullName !== undefined ? data.fullName : null, // Handle potential undefined from client
        bio: data.bio !== undefined ? data.bio : null,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : null,
        updatedAt: new Date(),
      };

      // 3. Check if profile exists to decide on create vs update
      let userProfile = await this.userRepository.getById(userId);
      let finalProfile: Profile | null = null;

      if (userProfile) {
        // Update existing profile
        finalProfile = await this.userRepository.update(
          userId,
          profileDataForRepo
        );
      } else {
        // Create new profile - ensure all required fields for ProfileInsert are present
        const insertData: ProfileInsert = {
          id: userId,
          username: profileDataForRepo.username,
          fullName: profileDataForRepo.fullName,
          bio: profileDataForRepo.bio,
          avatarUrl: profileDataForRepo.avatarUrl,
          updatedAt: profileDataForRepo.updatedAt,
          createdAt: new Date(), // Set createdAt for new profiles
          hasCompletedOnboarding: false, // Default for new profiles unless specified otherwise
        };
        finalProfile = await this.userRepository.create(insertData);
      }

      if (!finalProfile) {
        return { success: false, error: "Failed to save profile data." };
      }

      return { success: true, profile: finalProfile };
    } catch (error) {
      console.error(
        `UserService: Error updating profile for userId ${userId}:`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred.",
      };
    }
  }

  // Example of another method:
  // async updateUserProfile(userId: string, data: ProfileUpdate): Promise<Profile | null> {
  //   if (!userId) {
  //     console.error("UserService: updateUserProfile called without userId.");
  //     return null;
  //   }
  //   try {
  //     const updatePayload = { ...data, updatedAt: new Date() };
  //     return await this.userRepository.update(userId, updatePayload);
  //   } catch (error) {
  //     console.error(`UserService: Error updating profile for ${userId}:`, error);
  //     return null; // Or throw, or return error object
  //   }
  // }
}

// Optional: Export an instance for simpler usage if a singleton is acceptable
// export const userService = new DefaultUserService();
