"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ClaimFindButtonProps {
  appid: number;
  name: string;
  userId: string | null;
}

export function ClaimFindButton({ appid, name, userId }: ClaimFindButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleClaimFind = async () => {
    if (!userId) {
      toast.error("You must be logged in to claim finds");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("appid", appid.toString());
      formData.append("name", name);
      formData.append("userId", userId);

      const response = await fetch("/api/claim-find", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim find");
      }

      const data = await response.json();
      toast.success(data.message || `Successfully claimed "${name}" as your find!`);
      
      // Refresh the page to show the updated results
      router.refresh();
    } catch (error: any) {
      console.error("Error claiming find:", error);
      toast.error(error.message || "Failed to claim find. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button 
      className="w-full" 
      onClick={handleClaimFind}
      disabled={isSubmitting || !userId}
    >
      {isSubmitting ? "Claiming..." : userId ? "Claim Find" : "Sign in to Claim"}
    </Button>
  );
}

