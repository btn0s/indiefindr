# Deslopping IndieFindr without losing its character

Research: 2026-11-13. Scope: design guidance only; no application edits or builds.

## What the term means

“Deslop” is informal language for replacing recognizable, generic AI defaults with choices that serve this particular product. It is not a formal style, a requirement to become austere, or a blacklist of fonts and rounded corners. Designer Can Dedeoglu describes the issue as individually plausible choices accumulating into an interchangeable result, and emphasizes hierarchy, context, and restraint instead. [Author's account](https://www.candede.com/articles/escaping-ai-slop-in-web-design/)

NN/G's own evaluation of AI prototyping tools found that broad briefs tended to produce generic visual output; more specific project context improved results, but spacing, grouping, and hierarchy still required judgment. That supports refining the existing design around the actual task rather than asking for another vaguely “premium” redesign. [NN/G evaluation](https://www.nngroup.com/articles/ai-prototyping/)

Anthropic's cookbook likewise identifies convergence toward common frontend choices and recommends explicit direction for individual design dimensions. Its font, gradient, and animation suggestions are prompting heuristics and examples, not evidence that every use of a particular font or treatment is bad. [Anthropic's first-party guide](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)

## Application to this codebase

These are recommendations inferred from the inspected CSS and page components, not findings from user testing. Preserve the warm paper background, ink text, green accent, game artwork, readable type, search prominence, and useful recommendation grid: the user has already accepted that direction.

1. **Replace filler with game-specific information.** The hero currently repeats “spark” and “next favorite” language without explaining the source game. Keep the “Games like X” H1; make the source-game showcase use its real description, developer, release date, genres, and screenshots/trailer. This also respects visitors who do not yet know X.
2. **Simplify the brand mark as requested.** A controller outline can work without a colored square, button details, or an additional decorative badge. Preserve a clear wordmark relationship.
3. **Reduce competing flourishes.** The homepage's rotated, overlapping covers, oval backdrop, broad shadows, and large slogan operate simultaneously. Prefer a straightforward arrangement of recognizable game art; let the covers provide variation.
4. **Give containers a job.** Each game image is already a distinct rectangle. Consider one image crop plus a clean title row instead of another padded white shell around every image. A game grid is functional browsing UI; it need not be dismantled merely because grids are common.
5. **Reserve emphasis.** Use the green accent for the logo identity, primary action, and selected media state. Reduce all-caps slogan eyebrows, generic section subtitles, and repeated arrow ornaments where they do not clarify an action.
6. **Keep media direct.** Use explicit carousel controls and thumbnails; avoid automatic slide advancement or decorative entrance sequences. The visitor should control exploration, and the source game's media should remain separate from the recommendation list.

The decision test is concrete: does each detail help someone identify a game, understand it, compare it, or choose where to go? The user's judgment of the next preview remains the acceptance criterion.
