# Case Study: Building an Adaptive Game Suggestion System

## Problem Statement

The game suggestion system was producing poor recommendations. Games from "The Water Museum" (an art game developer) were getting generic mainstream suggestions instead of experimental/avant-garde games that would appeal to the same audience.

Initial observations:
- Suggestions ignored the unique vibe/tone of games
- AAA games were suggested for indie titles
- Action games were suggested for narrative games
- The system had no awareness of game "type" or matching philosophy

## Journey

### Phase 1: Understanding the Problem

Started by analyzing existing suggestions in the database. Found that generic prompts like "find similar games" produced surface-level matches based on keywords rather than the actual feel of the game.

Key insight: A game description like "gigantic crustacean festooned with cannons" should match **whimsical adventure games**, not shooters. The word "cannons" was being interpreted literally.

### Phase 2: Prompt Engineering Experiments

Tested various prompt approaches:

1. **Tone-aware prompts**: Explicitly asking AI to read the emotional tone
2. **Parallel search strategies**: Running multiple prompts (vibe, mechanics, community) simultaneously
3. **User query simulation**: Mimicking how users search ("games like X", "games from developer Y")
4. **Site-specific searches**: Using `site:reddit.com`, `site:steam.com` context

Results:
- Single prompts were inconsistent
- Parallel strategies with consensus detection worked better
- Different games needed different matching philosophies

### Phase 3: The Adaptive System

Designed a system that detects game type first, then adapts its matching strategy:

```
Game Types:
- action: Combat/shooter is core loop
- narrative: Story IS the gameplay
- cozy: Relaxation-focused
- competitive: Skill/challenge-focused  
- avant-garde: Art/experimental
- mainstream: Standard game
```

Each type gets different weights:

| Type | Vibe | Aesthetic | Theme | Mechanics |
|------|------|-----------|-------|-----------|
| avant-garde | 0.45 | 0.30 | 0.20 | 0.05 |
| cozy | 0.40 | 0.35 | 0.15 | 0.10 |
| action | 0.30 | 0.15 | 0.15 | 0.40 |
| narrative | 0.30 | 0.20 | 0.35 | 0.15 |
| competitive | 0.15 | 0.10 | 0.10 | 0.65 |

### Phase 4: Edge Cases and Refinements

**Problem: DuneCrawl misclassified**

DuneCrawl ("gigantic crustacean festooned with cannons") was classified as "action" and got suggestions like Void Bastards. But it's actually a whimsical adventure game.

Fix: Updated type detection prompt to emphasize reading the TONE of the writing, not just keywords:
- "gigantic crustacean festooned with cannons" = WHIMSICAL, QUIRKY, CHARMING
- "coop" doesn't mean chaotic (could be cozy coop like Stardew)
- "cannons" doesn't mean shooter (could be whimsical like pirates)

**Problem: PIGFACE misclassified**

PIGFACE ("guns-blazing, tactical") was classified as "narrative" because of its dark story. Got suggestions like Disco Elysium instead of shooters.

Fix: Added "action" type explicitly and updated detection:
- "A game with story BUT guns-blazing gameplay = action, NOT narrative"
- "Combat-focused games with dark stories are still ACTION"

**Problem: Eating Nature getting cozy suggestions**

An avant-garde experimental game was getting nature-themed cozy games instead of weird experimental games.

Fix: Created `KNOWN_ARTGAME_DEVS` list for fast-path detection:
- the water museum, thecatamites, tale of tales, kittyhorrorshow, increpare...

### Phase 5: Quality Assurance

Added retry mechanisms for quality:

1. **Strategy-level retries**: If a strategy returns < MIN_STRATEGY_RESULTS, retry it
2. **Pipeline-level retries**: If highConsensusCount < MIN_HIGH_CONSENSUS, retry entire pipeline
3. **Fallback curation**: If AI hallucinates games, fill from top consensus candidates

### Phase 6: Testing Simpler Approaches

Question: Can we achieve the same quality with a simpler system?

Created experiments-v2 with 4 test approaches:

| Test | Approach | AI Calls |
|------|----------|----------|
| A (Baseline) | Type detection → 3 strategies → consensus → curation | ~5 |
| B | Smart single prompt with tone + gameplay awareness | 1 |
| C | Type detection + single strategy based on type | 2 |
| D | Rich examples baked into prompt | 1 |

## Results

### Speed

| Test | Avg Time/Game | Relative |
|------|---------------|----------|
| A (Baseline) | 18.7s | 1.0x |
| B (Smart Prompt) | 10.3s | 0.55x |
| C (Type+Single) | 9.9s | 0.53x |
| D (Examples) | 10.3s | 0.55x |

### Validation Rate

| Test | Rate |
|------|------|
| A (Baseline) | 100% |
| B (Smart Prompt) | 96.7% |
| C (Type+Single) | 93.3% |
| D (Examples) | 95.0% |

### Quality Analysis

**DuneCrawl (whimsical adventure)**
- Test A: Sable, Ship of Fools, Lovers in Dangerous Spacetime, Sail Forth (correct)
- Test B: Barony, Gauntlet, Warhammer: Chaosbane (WRONG - action RPGs)
- Test C: Lovers in Dangerous Spacetime, We Need To Go Deeper (correct)
- Test D: Sail Forth, Lovers in Dangerous Spacetime, FAR: Lone Sails (correct)

**PIGFACE (gritty action FPS)**
- Test A: ULTRAKILL, Cruelty Squad, Trepang2 (correct)
- Test B: Ruiner, Mortal Shell, GRIME (mixed - some are souls-likes)
- Test C: Trepang2, Ready or Not, ULTRAKILL, Severed Steel (correct)
- Test D: Buckshot Roulette, Outlast, Visage (WRONG - horror games)

**Go Ape Ship! (party co-op)**
- Test A: Overcooked! 2, Lovers in Dangerous Spacetime, Moving Out (correct)
- Test B: Overcooked! 2, Tools Up!, Moving Out (correct)
- Test C: HELLDIVERS 2, Risk of Rain 2, Deep Rock Galactic (WRONG - action co-op)
- Test D: Overcooked! 2, Lovers in Dangerous Spacetime, Moving Out (correct)

**Eating Nature (avant-garde)**
- Test A: Yume Nikki, Cruelty Squad, Salad Fields (correct - weird art games)
- Test B: The Plan, Mountain, Proteus (correct)
- Test C: The Space Between, Promesa, Beeswing (correct)
- Test D: Mountain, Everything, Flower (mixed - some too mainstream)

### Failure Modes

| Test | Failure Mode |
|------|--------------|
| B (Smart Prompt) | Over-indexes on keywords ("cannons" → action) |
| C (Type+Single) | Loses subcategory nuance (party co-op → action co-op) |
| D (Examples) | Confuses genre boundaries (dark FPS → horror) |

## Conclusions

### Why Multi-Strategy Consensus Works

1. **Redundancy**: Different strategies catch different aspects
2. **Consensus filtering**: Games appearing in multiple strategies are more likely to be good matches
3. **Edge case handling**: One strategy's mistake gets outvoted

### Why Simpler Approaches Fail

1. **Single prompts are brittle**: One misinterpretation cascades
2. **No cross-checking**: No way to catch AI mistakes
3. **Context collapse**: Hard to encode all matching nuances in one prompt

### Recommendations

1. **Keep the baseline system** for production use
2. Speed savings (45-50%) aren't worth quality degradation
3. For ingestion (where quality matters most), use full pipeline
4. Consider simpler approaches only for low-stakes scenarios

### Future Improvements

1. **Caching**: Cache type detection results to avoid re-detection
2. **Batch processing**: Run suggestions for multiple games in parallel
3. **User feedback loop**: Learn from user interactions which suggestions work
4. **Embedding fallback**: Use embeddings when API rate-limited

## Technical Implementation

The final system is in `src/lib/suggest-new.ts`:

```
suggestGamesVibe(appid, title, description, developers, count)
├── detectGameType() → GameProfile
│   ├── Check KNOWN_ARTGAME_DEVS (fast path)
│   └── AI classification with tone-aware prompt
├── Run 3 strategies in parallel
│   ├── buildVibePrompt() → vibe-focused suggestions
│   ├── buildMechanicsPrompt() → mechanics-focused suggestions
│   └── buildCommunityPrompt() → community-recommended suggestions
├── combineWithConsensus() → dedupe and count appearances
├── validateSuggestions() → check DB then Steam
├── Quality check (retry if needed)
└── curateWithAI() → final ranking with type-aware curation
```

## Test Games Used

| Game | Type | Challenge |
|------|------|-----------|
| DuneCrawl | Whimsical adventure | "Cannons" could be misread as action |
| PIGFACE | Gritty action FPS | Dark story could be misread as narrative |
| Death and Taxes | Narrative | Grim Reaper theme could be misread as horror |
| Go Ape Ship! | Party co-op | Co-op could be misread as action co-op |
| ROUTINE | Atmospheric horror | Sci-fi could be misread as action |
| Eating Nature | Avant-garde | Short description, easy to misclassify |

## Appendix: Key Files

- `src/lib/suggest-new.ts` - Main suggestion logic
- `src/lib/actions/suggestions.ts` - Server action wrapper
- `scripts/experiments-v2/` - Test experiments
- `scripts/vibe-experiments/` - Earlier experiments
