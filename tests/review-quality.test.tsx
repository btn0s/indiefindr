import { expect, test } from "vitest";
import { recommendationEligible, reviewBomb } from "../src/lib/review-quality";

// Russian Fishing 4 as the v3 run stored it: Steam 61% Mixed, 70.1% without its February 2024 bomb.
const fishing = {
  review_positive_pct: 61,
  review_count: 92987,
  clean_score: 70.0866,
  checked_at: "2026-11-14T04:28:20Z",
  bomb_windows: [{
    start: "2024-01-31", end: "2024-02-28", start_ts: 1706745600, end_ts: 1709251200, up: 813, down: 13970,
    steam_up: 1457, steam_down: 12201, verdict: "bomb", adjusted: true,
  }],
};

test("a bomb that put a positive game into Mixed is reported with both ratings and its days", () => {
  expect(reviewBomb(fishing)).toEqual({
    ratingBefore: { pct: 70, label: "Mostly Positive" },
    ratingNow: { pct: 61, label: "Mixed" },
    when: { start: "2024-02-01", end: "2024-02-29" },
    active: false,
  });
  expect(recommendationEligible(fishing)).toBe(true);
});

test("nothing is reported when the bomb no longer decides the rating", () => {
  // Rated positive today: the bomb doesn't drag it out of the positive range.
  expect(reviewBomb({ ...fishing, review_positive_pct: 72 })).toBeNull();
  // Still Mixed without the bomb: the bomb isn't what put it there.
  expect(reviewBomb({ ...fishing, clean_score: 64 })).toBeNull();
  expect(recommendationEligible({ ...fishing, clean_score: 64 })).toBe(false);
});

test("only windows the detector set aside count; a possible bomb still being judged does not", () => {
  const [window] = fishing.bomb_windows;
  expect(reviewBomb({ ...fishing, bomb_windows: [{ ...window, verdict: "unresolved", adjusted: false }] })).toBeNull();
  expect(reviewBomb({ ...fishing, bomb_windows: [{ ...window, verdict: "active_bomb" }] })?.active).toBe(true);
});

test("unrated games stay eligible", () => {
  expect(recommendationEligible({ ...fishing, review_count: 9, clean_score: 0 })).toBe(true);
  expect(recommendationEligible({ ...fishing, review_positive_pct: null })).toBe(true);
});
