"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { type MediaItem } from "@/types/steam";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface MediaCarouselProps {
  mediaItems: MediaItem[];
  gameTitle: string;
}

export function MediaCarousel({ mediaItems, gameTitle }: MediaCarouselProps) {
  const [emblaApi, setEmblaApi] = useState<CarouselApi | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, mediaItems.length);
  }, [mediaItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCarouselVisible(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.1,
      }
    );

    const currentCarouselRef = carouselRef.current;
    if (currentCarouselRef) {
      observer.observe(currentCarouselRef);
    }

    return () => {
      if (currentCarouselRef) {
        observer.unobserve(currentCarouselRef);
      }
      observer.disconnect();
    };
  }, []);

  const pauseAllVideos = useCallback(() => {
    videoRefs.current.forEach((videoEl) => {
      if (videoEl && !videoEl.paused) {
        videoEl.pause();
      }
    });
  }, []);

  const playVideoAtIndex = useCallback(
    (index: number) => {
      const videoEl = videoRefs.current[index];
      if (isCarouselVisible && videoEl) {
        videoEl.play().catch((error) => {
          // Autoplay prevention is common, log error if needed
          // console.error("Video play failed:", error);
        });
      }
    },
    [isCarouselVisible]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const selectedIndex = emblaApi.selectedScrollSnap();
    setCurrentIndex(selectedIndex);

    pauseAllVideos();

    const currentItem = mediaItems[selectedIndex];
    if (currentItem?.type === "video") {
      playVideoAtIndex(selectedIndex);
    }
  }, [emblaApi, mediaItems, pauseAllVideos, playVideoAtIndex]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
      pauseAllVideos();
    };
  }, [emblaApi, onSelect, pauseAllVideos]);

  useEffect(() => {
    if (!emblaApi) return;

    const currentItem = mediaItems[currentIndex];
    if (currentItem?.type === "video") {
      if (isCarouselVisible) {
        playVideoAtIndex(currentIndex);
      } else {
        pauseAllVideos();
      }
    } else if (!isCarouselVisible) {
      pauseAllVideos();
    }
  }, [
    isCarouselVisible,
    currentIndex,
    mediaItems,
    emblaApi,
    playVideoAtIndex,
    pauseAllVideos,
  ]);

  return (
    <div className="relative" ref={carouselRef}>
      <Carousel setApi={setEmblaApi} className="w-full">
        <CarouselContent>
          {mediaItems.map((item, index) => (
            <CarouselItem key={index}>
              <div className="aspect-video relative rounded-lg overflow-hidden bg-black border">
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
                    ref={(el: HTMLVideoElement | null) => {
                      videoRefs.current[index] = el;
                    }}
                    src={(item.data as any).mp4.max}
                    poster={(item.data as any).thumbnail}
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

      <div className="mt-2 flex gap-2 overflow-x-auto py-2 snap-x snap-mandatory">
        {mediaItems.map((item, index) => (
          <div
            key={index}
            className={`w-20 h-12 relative rounded overflow-hidden border-2 flex-shrink-0 cursor-pointer transition-all snap-start ${
              currentIndex === index
                ? "shadow-md border-white border-2"
                : "border-white/20 hover:border-white"
            }`}
            onClick={() => emblaApi?.scrollTo(index)}
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
