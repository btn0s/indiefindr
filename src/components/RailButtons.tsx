"use client";
import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Paging for a row that scrolls sideways on its own (native scrolling and snap; nothing here moves it frame by frame).
 *  Previous and Next page by the visible width, the snap lands each step on an item, and either button disables at
 *  its end. Until the row is measured, both are off and the pair is hidden, so a row that fits never shows them. */
export function useRailPaging(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const update = () => setEdges(previous => {
      const start = row.scrollLeft <= 1;
      const end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
      return previous.start === start && previous.end === end ? previous : { start, end };
    });
    update();
    row.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(row);
    return () => { row.removeEventListener("scroll", update); resize.disconnect(); };
  }, [ref]);
  const page = (direction: 1 | -1) => {
    const row = ref.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return { ...edges, page };
}

/** Previous and Next for a rail, for mouse and keyboard users (globals.css shows them only with a fine pointer; touch
 *  swipes). They keep their place while hidden, so nothing beside them moves once the row is measured. */
export function RailButtons({ rail, controls, label }: { rail: RefObject<HTMLElement | null>; controls: string; label: string }) {
  const { start, end, page } = useRailPaging(rail);
  return <div className="rail-buttons" data-scrolls={!(start && end) || undefined}>
    <button type="button" className="rail-button" onClick={() => page(-1)} disabled={start} aria-controls={controls} aria-label={`Previous ${label}`}>
      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
    </button>
    <button type="button" className="rail-button" onClick={() => page(1)} disabled={end} aria-controls={controls} aria-label={`Next ${label}`}>
      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  </div>;
}
