# Suggestion Experiments v2

This directory contains experiments to test simpler approaches to game suggestions while maintaining quality.

## Structure

- `test-a-baseline.ts` - Current system (baseline for comparison)
- `test-b-smart-prompt.ts` - Single prompt with tone + gameplay awareness
- `test-c-type-plus-single.ts` - Type detection + single strategy
- `test-d-examples-in-prompt.ts` - Rich examples baked into prompt
- `run-all.ts` - Runs all tests and outputs side-by-side comparison
- `shared/` - Shared utilities (test games, Steam validation, output formatting)

## Running

Run all tests:
```bash
npx tsx scripts/experiments-v2/run-all.ts
```

Run individual tests:
```bash
npx tsx scripts/experiments-v2/test-a-baseline.ts
npx tsx scripts/experiments-v2/test-b-smart-prompt.ts
npx tsx scripts/experiments-v2/test-c-type-plus-single.ts
npx tsx scripts/experiments-v2/test-d-examples-in-prompt.ts
```

## Evaluation

The `run-all.ts` script outputs:
1. Side-by-side comparison of all tests for each game
2. Summary statistics (timing, suggestion counts, validation rates)
3. Detailed per-game comparison

Manual review questions:
1. Would a user looking at Game X be happy to see these suggestions?
2. Do the suggestions match the FEEL of the source game?
3. Any obvious mismatches? (e.g., shooter for narrative game)

Success criteria:
- Quality is subjectively equal or better than baseline
- No obvious category mismatches (action game getting narrative suggestions)
