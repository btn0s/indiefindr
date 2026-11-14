import React from "react";
import { expect, test } from "vitest";
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ReviewQualityNote } from "../src/components/ReviewQualityNote";
import { createAgent } from "@ui-sdk/react/agent";
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
test("shows both scores, accessible periods and a neutral learn-more link", async () => {
  render(
    <ReviewQualityNote
      game={game}
      history={{
        appid: 1,
        granularity: "month",
        checked_at: game.checked_at,
        periods: [{ start: 1735689600, end: 1738368000, up: 10, down: 100 }],
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /91% excluding review bomb/ }),
  );
  expect(
    screen
      .getByRole("dialog", { hidden: true })
      .getAttribute("aria-labelledby"),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("dialog", { hidden: true })
      .getAttribute("aria-describedby"),
  ).toBeTruthy();
  expect(screen.getByText("60%")).toBeTruthy();
  expect(screen.getAllByText("91%")).toHaveLength(2);
  const agent = createAgent();
  const bar = screen.getByRole("button", {
    name: /Jan 2025: 10 positive/,
    hidden: true,
  });
  fireEvent.keyDown(document, { key: "Tab" });
  await act(async () => {
    bar.focus();
  });
  expect(
    agent
      .snapshot()
      .filter((e) => !e.offPage)
      .map((e) => e.label),
  ).toContain(bar.getAttribute("aria-label"));
  const result = await agent.act({
    steps: [
      {
        ref: "Jan 2025: 10 positive / 100 negative / 9.1% positive",
        action: "setOpen",
        args: [true],
      },
    ],
  });
  expect(result.ok).toBe(true);
  await waitFor(() => {
    const tooltip = screen
      .getAllByRole("tooltip", { hidden: true })
      .find((e) => e.hasAttribute("data-open"));
    expect(tooltip?.textContent).toContain("100 negative");
  });
  const link = screen.getByRole("link", {
    name: "Search for more about this",
    hidden: true,
  });
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toContain("noopener");
  expect(link.getAttribute("href")).toBe(
    "https://www.google.com/search?q=" +
      encodeURIComponent("Example & Game review bombing"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close", hidden: true }));
  await waitFor(() =>
    expect(
      screen.getByRole("dialog", { hidden: true }).hasAttribute("data-closed"),
    ).toBe(true),
  );
});
test("preserves Steam label on rescued cards with spaced disclosure", () => {
  render(<CardRating pct={60} count={1000} rescued cleanScore={91} />);
  expect(screen.getByText("91% outside")).toBeTruthy();
  expect(screen.getByText(/Mixed/)).toBeTruthy();
  expect(screen.getByText("60%")).toBeTruthy();
});
test("ordinary and unrated pages have no disclosure", () => {
  const view = render(
    <ReviewQualityNote game={{ ...game, review_positive_pct: 95 }} />,
  );
  expect(view.container.textContent).toBe("");
  view.rerender(<ReviewQualityNote game={{ ...game, review_count: 1 }} />);
  expect(view.container.textContent).toBe("");
});

test("keeps the rescue chip with the Steam rating as one metadata group", () => {
  render(
    <GameMetadata
      game={{ ...game, developers: [], release_date: null, is_indie: true }}
      reviewDetail={<ReviewQualityNote game={game} />}
    />,
  );
  const chip = screen.getByRole("button", {
    name: /91% excluding review bomb/,
  });
  expect(chip.closest(".meta-rating-group")?.textContent).toContain(
    "60% Mixed",
  );
  expect(
    screen.queryByRole("button", { name: "Learn more", exact: true }),
  ).toBeNull();
});
