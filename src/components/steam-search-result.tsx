import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment";
import { useRouter } from "next/navigation";

interface SteamSearchResultProps {
  appid: number;
  name: string;
  icon: string;
  userId: string | null; // Pass the user ID for attribution
}

export function SteamSearchResult({ appid, name, icon, userId }: SteamSearchResultProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleClaimFind = async () => {
    if (!userId) {
      toast.error("You must be logged in to claim finds");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the enrichment function to add the game to the database
      await enrichSteamAppId(appid.toString(), userId);
      
      toast.success(`Successfully claimed "${name}" as your find!`);
      
      // Refresh the page to show the updated results
      router.refresh();
    } catch (error) {
      console.error("Error claiming find:", error);
      toast.error("Failed to claim find. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="relative h-40 w-full">
        {icon ? (
          <Image
            src={icon}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground">No image available</span>
          </div>
        )}
      </div>
      <CardContent className="flex-1 p-4">
        <h3 className="font-semibold text-lg line-clamp-2 mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground">
          This game is not yet in our database.
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full" 
          onClick={handleClaimFind}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Claiming..." : "Claim Find"}
        </Button>
      </CardFooter>
    </Card>
  );
}

