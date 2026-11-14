import React from "react";
import { expect, test } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { GameFacts } from "../src/components/GameFacts";
import { ReviewBombBanner } from "../src/components/ReviewBombBanner";
import {
  bombSpans,
  bombStory,
  isRescued,
  recommendationEligible,
  qualityFields,
  unresolvedWindows,
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
const banner = (
  <ReviewBombBanner
    title={game.title}
    story={bombStory(game)!}
    history={history}
  />
);
test("Steam's score stays as Steam gives it", () => {
  render(<GameFacts game={{ ...game, developers: [], release_date: null, is_indie: true }} />);
  expect(screen.getByText("60%")).toBeTruthy();
  expect(screen.getByText(/Mixed/)).toBeTruthy();
  expect(screen.queryByText(/91%/)).toBeNull();
});
test("the banner says what happened, and opens the history with every figure from one source", async () => {
  render(banner);
  const open = screen.getByRole("button", { name: /Example & Game was review-bombed twice, in 2025 and 2026\./ });
  expect(open.textContent).toContain("330 reviews across both, 91% negative. Without them, players rate it 91%.");
  fireEvent.click(open);
  const dialog = await screen.findByRole("dialog", { hidden: true });
  expect(within(dialog).getByRole("heading", { name: "Review history", hidden: true })).toBeTruthy();
  const rows = within(dialog).getAllByRole("row", { hidden: true }).map((row) => row.textContent);
  expect(rows).toEqual([
    "PeriodReviewsPositive",
    "Before Dec 20244295%",
    "Review bomb Jan 20251109%",
    "Between Jun 20253391%",
    "Review bomb Nov 20262209%",
    "Steam’s score1,00060%",
    "Without the review bombs67091%",
  ]);
  expect(dialog.textContent).toContain("Steam’s score counts 1,000");
  const link = within(dialog).getByRole("link", { name: "Look up what happened", hidden: true });
  expect(link.getAttribute("rel")).toContain("noopener");
  expect(link.getAttribute("href")).toBe(
    "https://www.google.com/search?q=" + encodeURIComponent("Example & Game review bombing"),
  );
  const plot = within(dialog).getByRole("group", { name: /reviews per month/, hidden: true });
  fireEvent.keyDown(plot, { key: "Home" });
  expect(within(dialog).getByText("December 2024")).toBeTruthy();
  fireEvent.keyDown(plot, { key: "ArrowRight" });
  expect(within(dialog).getByText("10 positive · 100 negative")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close", hidden: true }));
  await waitFor(() => expect(dialog.hasAttribute("data-closed")).toBe(true));
});
test("only adjusted windows rescue; open windows still being judged are reported apart", () => {
  const active = { start: "2026-11-01", end: "2026-11-10", up: 400, down: 380, verdict: "active_bomb", adjusted: true };
  const open = { start: "2026-10-01", end: "2026-10-05", up: 5, down: 90, verdict: "unresolved", adjusted: false };
  expect(isRescued({ ...game, bomb_windows: [open] })).toBe(false);
  expect(isRescued({ ...game, bomb_windows: [active, open] })).toBe(true);
  expect(bombSpans([active, open])).toMatchObject([{ up: 400, down: 380, verdict: "active_bomb" }]);
  expect(unresolvedWindows([active, open])).toMatchObject([{ verdict: "unresolved" }]);
});
