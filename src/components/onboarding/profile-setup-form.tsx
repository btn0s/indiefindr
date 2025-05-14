"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/(api)/actions/profile";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProfileSetupFormProps {
  userId: string;
}

export function ProfileSetupForm({ userId }: ProfileSetupFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Simulate loading state for initial data fetch
  useEffect(() => {
    // In a real app, you might fetch existing profile data here
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const fullName = formData.get("fullName") as string;
    const bio = formData.get("bio") as string;
    
    try {
      const result = await updateProfile({
        username,
        fullName,
        bio,
        // Set partial onboarding completion flag
        hasCompletedOnboarding: false,
      });
      
      if (result.success) {
        toast.success("Profile updated successfully!");
        router.push("/onboarding/games");
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSkip = () => {
    // Note: When skipping, we don't set hasCompletedOnboarding
    // This will be handled in the final step when the user completes the game selection
    router.push("/onboarding/games");
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading profile data...</span>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username *</Label>
        <Input
          id="username"
          name="username"
          placeholder="Choose a unique username"
          required
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          This will be your public username visible to other users
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="Your full name (optional)"
          disabled={isSubmitting}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          placeholder="Tell us a bit about yourself and the games you enjoy"
          rows={3}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="flex gap-4 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          Skip for now
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save and Continue"
          )}
        </Button>
      </div>
    </form>
  );
}
