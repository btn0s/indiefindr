"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/actions/profile";
import { toast } from "sonner";

interface ProfileSetupFormProps {
  userId: string;
}

export function ProfileSetupForm({ userId }: ProfileSetupFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    router.push("/onboarding/games");
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username *</Label>
        <Input
          id="username"
          name="username"
          placeholder="Choose a unique username"
          required
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
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          placeholder="Tell us a bit about yourself and the games you enjoy"
          rows={3}
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
          {isSubmitting ? "Saving..." : "Save and Continue"}
        </Button>
      </div>
    </form>
  );
}

