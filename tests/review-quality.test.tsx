import React from "react";
import { expect, test } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { GameMetadata } from "../src/components/GameMetadata";
import { CardRating } from "../src/components/Rating";
import {
  isRescued,
  recommendationEligible,
  qualityFields,
} from "../src/lib/review-quality";
const game = {
  title: "Example & Game",
  review_positive_pct: 60,
  review_count: 1000,
  clean_score: 91,
  bomb_windows: [
    { start: "2025-01-01", end: "2025-01-02", up: 10, down: 100 },
    { start: "2026-11-09", end: "2026-11-11", up: 20, down: 200 },
  ],
  checked_at: "2026-11-13T00:00:00Z",
};
test("retains unrated games and rejects ordinary Mixed games or positive-dominant rescue data", () => {
  expect(
    recommendationEligible({ ...game, review_count: 9, clean_score: 0 }),
  ).toBe(true);
  expect(recommendationEligible({ ...game, clean_score: 60 })).toBe(false);
  expect(
    isRescued({
      ...game,
      bomb_windows: [
        { start: "2026-01-01", end: "2026-01-02", up: 300, down: 100 },
      ],
    }),
  ).toBe(false);
  expect(isRescued(game)).toBe(true);
  expect(qualityFields(game)).toMatchObject({
    steam_score: 60,
    clean_score: 91,
    review_bombed: true,
  });
});
const facts = { ...game, developers: [], release_date: null, is_indie: true };
const history = {
  appid: 1,
  granularity: "month",
  checked_at: game.checked_at,
  periods: [
    { start: Date.UTC(2024, 11, 1) / 1000, end: Date.UTC(2025, 0, 1) / 1000, up: 40, down: 2 },
    { start: Date.UTC(2025, 0, 1) / 1000, end: Date.UTC(2025, 1, 1) / 1000, up: 10, down: 100 },
    { start: Date.UTC(2025, 5, 1) / 1000, end: Date.UTC(2025, 6, 1) / 1000, up: 30, down: 3 },
  ],
};
test("a review-bombed game shows its adjusted score, and the note under it opens the story", async () => {
  render(<GameMetadata game={facts} history={history} />);
  expect(screen.getByText("91%")).toBeTruthy();
  expect(screen.getByText(/Very Positive/)).toBeTruthy();
  const note = screen.getByRole("button", {
    name: "Adjusted for review bombs in 2025 and 2026. Steam shows 60%.",
  });
  expect(note.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(note);
  expect(note.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getByText(/was review-bombed twice, in 2025 and 2026: 330 reviews, 91% of them negative/),
  ).toBeTruthy();
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual([
    "PeriodReviewsPositive",
    "Before Dec 20244295%",
    "Review bomb Jan 20251109%",
    "Between Jun 20253391%",
    "Review bomb Nov 20262209%",
    "Adjusted score everything but the bombs7591%",
  ]);
  const link = screen.getByRole("link", { name: "Look up what happened" });
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toContain("noopener");
  expect(link.getAttribute("href")).toBe(
    "https://www.google.com/search?q=" +
      encodeURIComponent("Example & Game review bombing"),
  );
  fireEvent.click(note);
  await waitFor(() => expect(note.getAttribute("aria-expanded")).toBe("false"));
});
test("cards show the adjusted score with a quiet line", () => {
  render(<CardRating pct={91} count={1000} bombs={2} />);
  expect(screen.getByText("91%")).toBeTruthy();
  expect(screen.getByText("Adjusted for review bombs")).toBeTruthy();
});
test("ordinary and unrated games show Steam's score with no note", () => {
  const view = render(<GameMetadata game={{ ...facts, review_positive_pct: 95 }} />);
  expect(screen.getByText("95%")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<GameMetadata game={{ ...facts, review_count: 1 }} />);
  expect(screen.queryByRole("button")).toBeNull();
});
