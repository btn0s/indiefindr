# Trainer: interaction data collection + training

Implements the bootstrap loop from
[`docs/interaction-trained-recommender.md`](../../docs/interaction-trained-recommender.md):
collect similarity judgments (humans, agents, mined Steam co-reviews), fit a
cheap scorer offline, serve with zero LLM calls.

## Prerequisites

- Migration `20260613000000_add_similarity_judgments.sql` applied
  (`pnpm supabase:reset` locally or push to the linked project).
- `steamspy_tags` populated for the catalog — the sampler and trainer score by
  tags. Games without tags are skipped.
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (all writes use the service
  client; the new tables have no public RLS policies).

## Pieces

| What | How |
|---|---|
| Human labeling UI | `/trainer` route — gated by `TRAINER_ENABLED=true`, unindexed. One tap = similar, two = definitely not. ~20% of screens ask facet-specific questions (feel vs play). |
| Agent labeling | `npx tsx scripts/trainer/run-agents.ts --screens 20 --budget-usd 0.50` — cheap model plays the same task across fixed personas; hard budget cap; rows tagged `source='agent'`. |
| Steam co-review mining | `npx tsx scripts/trainer/mine-steam-coreviews.ts --limit 50` — resumable crawl of public review pages; stores hashed reviewer→game edges. |
| Co-review pairs | `npx tsx scripts/trainer/refresh-coreview-pairs.ts` — rebuilds PMI-weighted `coreview_pairs` from edges and prints the top pairs as a sanity check. |
| Training | `npx tsx scripts/trainer/train.ts` — BPR over (seed, picked, not-picked) pairs; linear weights over tag/dev/review/popularity features; split **by seed** for honest holdout; writes a JSON artifact to `scripts/trainer/artifacts/`. |

## Gates before scaling (from the experiment plan)

- **E7 agent fidelity:** before bulk `run-agents` spending, label ~100 screens
  yourself at `/trainer`, run agents over the *same period of seeds*, and
  compare picked-set agreement. Down-weight (`--agent-weight`) or exclude agent
  data if agreement is poor.
- **E8 learning curve:** retrain at increasing judgment counts and watch
  holdout pairwise accuracy; if it's flat, fix features or task design before
  buying more labels.

The trainer prints a tag-similarity-only holdout accuracy alongside the
learned weights — that's the E1 baseline; the learned model has to beat it to
justify existing.
