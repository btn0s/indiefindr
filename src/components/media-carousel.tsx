"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { type MediaItem } from "../app/games/[id]/[name]/page";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface MediaCarouselProps {
  mediaItems: MediaItem[];
  gameTitle: string;
}

export function MediaCarousel({ mediaItems, gameTitle }: MediaCarouselProps) {
  const [emblaApi, setEmblaApi] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle thumbnail click
  const scrollToSlide = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  };

  // Update current index when slide changes
  const onSelect = () => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  };

  // Set up slide change listener
  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <div className="relative">
      <Carousel setApi={setEmblaApi} className="w-full">
        <CarouselContent>
          {mediaItems.map((item, index) => (
            <CarouselItem key={index}>
              <div className="aspect-video relative rounded-lg overflow-hidden bg-black">
                {item.type === "image" ? (
                  <Image
                    src={(item.data as any).path_full}
                    alt={`${gameTitle} Media ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1000px"
                  />
                ) : (
                  <video
                    src={(item.data as any).mp4.max}
                    poster={(item.data as any).thumbnail}
                    autoPlay
                    muted
                    controls
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>

      {/* Thumbnails row with active state */}
      <div className="mt-2 flex gap-2 overflow-x-auto py-2 snap-x snap-mandatory">
        {mediaItems.map((item, index) => (
          <div
            key={index}
            className={`w-20 h-12 relative rounded overflow-hidden border-2 flex-shrink-0 cursor-pointer transition-all snap-start ${
              currentIndex === index
                ? "shadow-md border-white border-2"
                : "border-white/20 hover:border-white"
            }`}
            onClick={() => scrollToSlide(index)}
            role="button"
            aria-label={`Go to slide ${index + 1}`}
          >
            {item.type === "image" ? (
              <Image
                src={(item.data as any).path_thumbnail}
                alt={`Thumbnail ${index}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={(item.data as any).thumbnail}
                  alt={`Video Thumbnail ${index}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-0.5"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
