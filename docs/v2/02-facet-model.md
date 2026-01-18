# The Five-Facet Model

This document defines the five facets used to represent games in v2, along with their data sources, embedding strategies, and user-facing presentation.

## Overview

| Facet | Code | User Label | What It Captures |
|-------|------|------------|------------------|
| **AESTHETIC** | `aesthetic` | "Looks Like" | Art style, visual design, color palette |
| **ATMOSPHERE** | `atmosphere` | "Feels Like" | Emotional mood, tone, vibe |
| **MECHANICS** | `mechanics` | "Plays Like" | Core loop, controls, genre conventions |
| **NARRATIVE** | `narrative` | "About" | Theme, setting, story, fantasy |
| **DYNAMICS** | `dynamics` | "Flows Like" | Pacing, intensity, game feel |

---

## Facet 1: AESTHETIC

### What It Captures
The visual identity of a game—what you'd recognize from a single screenshot.

- Art style (pixel art, hand-drawn, realistic, anime, low-poly)
- Color palette (dark, vibrant, muted, pastel, monochrome)
- Visual density (minimalist vs detailed)
- Rendering style (2D, 2.5D, 3D, cel-shaded)
- UI aesthetic (as visible in screenshots)

### Data Sources
| Source | Priority | Notes |
|--------|----------|-------|
| Header image | Primary | Always available, 460x215 |
| Screenshots | Primary | Up to 20 per game |
| Store capsule | Secondary | 231x87, good for thumbnails |

### Embedding Strategy
```
Model: SigLIP 2 (siglip2-base-patch16-224)
Dimensions: 768

Process:
1. Fetch header_image and first 3 screenshots
2. Resize each to 224x224
3. Run through SigLIP 2 image encoder
4. Weight: header=0.4, screenshots=0.2 each
5. Compute weighted average
6. L2 normalize

Output: 768-dimensional vector
```

### Example Similarities
- Hollow Knight ↔ Ori and the Blind Forest (hand-drawn, atmospheric)
- Celeste ↔ Dead Cells (pixel art, vibrant)
- Dark Souls ↔ Elden Ring (dark fantasy, realistic)

### User-Facing Copy
> **Looks Like**: Games with similar visual style and art direction

---

## Facet 2: ATMOSPHERE

### What It Captures
The emotional feeling a game evokes—its mood and tone.

- Emotional tone (cozy, tense, melancholic, whimsical, oppressive)
- Atmosphere (serene, chaotic, mysterious, nostalgic)
- World feeling (alive, desolate, dreamlike, grounded)
- Intensity level (relaxing, stressful, contemplative)

### Data Sources
| Source | Priority | Notes |
|--------|----------|-------|
| Screenshots | Primary | Visual mood indicators |
| Description | Primary | Often describes atmosphere |
| Steam tags | Primary | "Atmospheric", "Cozy", "Dark" |
| IGDB themes | Secondary | Structured theme data |

### Embedding Strategy
```
Model: Hybrid (SigLIP 2 + OpenAI text-embedding-3-small)
Dimensions: 768 (projected)

Process:
Option A - Hybrid:
1. Get AESTHETIC embedding (visual mood)
2. Extract mood tags and description
3. Generate mood text embedding
4. Combine: 0.6 * visual + 0.4 * text
5. L2 normalize

Option B - Vision-Language (richer):
1. Send screenshots to GPT-4V
2. Prompt: "Describe the emotional atmosphere..."
3. Embed the generated description
4. Combine with mood tags
```

### Mood Tag Vocabulary
```
Positive/Cozy: cozy, wholesome, relaxing, peaceful, heartwarming
Dark/Tense: dark, atmospheric, horror, tense, creepy, oppressive
Whimsical: whimsical, quirky, surreal, dreamlike, fantastical
Melancholic: melancholic, bittersweet, nostalgic, somber
Action: intense, exciting, thrilling, adrenaline
```

### Example Similarities
- Hollow Knight ↔ Rain World (melancholic, atmospheric, lonely)
- Stardew Valley ↔ Spiritfarer (cozy, heartwarming, gentle)
- Limbo ↔ Inside (dark, oppressive, mysterious)

### User-Facing Copy
> **Feels Like**: Games with similar mood and emotional atmosphere

---

## Facet 3: MECHANICS

### What It Captures
What you actually *do* in the game—the core gameplay loop.

- Genre conventions (metroidvania, roguelike, turn-based)
- Core actions (explore, fight, build, puzzle, manage)
- Player perspective (first-person, top-down, side-scroller)
- Game modes (single-player, co-op, competitive)
- Systems (crafting, skill trees, permadeath)

### Data Sources
| Source | Priority | Notes |
|--------|----------|-------|
| Steam tags | Primary | User-generated, high signal |
| Steam categories | Primary | Multiplayer, controller support |
| IGDB keywords | Primary | Structured mechanics data |
| IGDB game_modes | Primary | Single, co-op, versus |
| IGDB perspectives | Primary | First-person, side-view |

### Embedding Strategy
```
Model: OpenAI text-embedding-3-small
Dimensions: 1536 (or 768 projected)

Process:
1. Build structured text template
2. Embed the template

Template:
"""
Genre: {genres}
Perspective: {perspective}
Core mechanics: {mechanic_tags}
Game modes: {game_modes}
Subgenre: {subgenre_tags}
Systems: {system_keywords}
"""
```

### Example Template
```
Game: Hollow Knight

Genre: Action, Adventure, Indie
Perspective: Side-scroller, 2D
Core mechanics: Metroidvania, Souls-like, Exploration, Platformer
Game modes: Single-player
Subgenre: Action-Adventure
Systems: Ability gating, Skill-based combat, Non-linear progression
```

### Tag Normalization
Map synonyms to canonical terms:
- "Souls-like", "Soulslike", "Soulsborne" → `souls-like`
- "Rogue-like", "Roguelike", "Rogue-lite" → `roguelike`
- "Metroidvania", "MetroidVania" → `metroidvania`

### Example Similarities
- Hollow Knight ↔ Blasphemous (metroidvania, souls-like, 2D)
- Hades ↔ Dead Cells (roguelike, action, fast combat)
- Civilization VI ↔ Humankind (4X, turn-based, strategy)

### User-Facing Copy
> **Plays Like**: Games with similar gameplay and mechanics

---

## Facet 4: NARRATIVE

### What It Captures
What the game is *about*—its themes, setting, and story.

- Setting (fantasy, sci-fi, modern, historical, abstract)
- Themes (love, loss, survival, discovery, revenge)
- Story type (epic, personal, environmental, none)
- Player fantasy (who you get to be)

### Data Sources
| Source | Priority | Notes |
|--------|----------|-------|
| Short description | Primary | Steam's summary |
| IGDB storyline | Primary | Extended plot summary |
| IGDB themes | Primary | Structured theme data |
| Long description | Secondary | More detail, more noise |
| Steam tags | Secondary | Theme-related tags |

### Embedding Strategy
```
Model: OpenAI text-embedding-3-small
Dimensions: 1536 (or 768 projected)

Process:
1. Extract/infer setting and themes
2. Build narrative template
3. Embed the template

Template:
"""
Setting: {setting}
Themes: {themes}
Story: {short_description}
Fantasy: {player_fantasy}
Tone: {narrative_tone}
"""
```

### Example Template
```
Game: Hollow Knight

Setting: Dark fantasy underground kingdom
Themes: Exploration, Mystery, Decay, Sacrifice, Identity
Story: Descend into the depths of a ruined kingdom teeming
       with strange creatures and ancient secrets.
Fantasy: A lone knight exploring a fallen civilization
Tone: Melancholic, mysterious, epic
```

### Theme Vocabulary (from IGDB)
```
Action, Fantasy, Science fiction, Horror, Thriller, Survival,
Historical, Stealth, Comedy, Business, Drama, Non-fiction,
Sandbox, Educational, Kids, Open world, Warfare, Party,
4X, Erotic, Mystery, Romance
```

### Example Similarities
- Hollow Knight ↔ Dark Souls (fallen kingdom, mystery, discovery)
- Disco Elysium ↔ Planescape: Torment (identity, philosophy, dialogue)
- Firewatch ↔ Gone Home (personal story, mystery, exploration)

### User-Facing Copy
> **About**: Games with similar themes and story

---

## Facet 5: DYNAMICS

### What It Captures
How the game *flows*—its pacing, rhythm, and feel.

- Pacing (slow-burn, frantic, methodical, relaxed)
- Intensity curve (constant, waves, building)
- Session length (quick runs, long sessions)
- Game feel / "juice" (responsive, weighty, floaty)
- Tension pattern (always tense, chill with spikes)

### Data Sources
| Source | Priority | Notes |
|--------|----------|-------|
| Gameplay videos | Primary | Best source for feel |
| Steam reviews | Primary | Players describe feel |
| Trailers | Secondary | Often misleading |
| Pacing tags | Secondary | "Fast-paced", "Relaxing" |
| Average playtime | Secondary | Session length proxy |

### Embedding Strategy
```
This is the most complex facet. Two approaches:

Approach A - Video Embedding:
1. Fetch gameplay trailer or video
2. Sample 10-20 frames
3. Embed frames with SigLIP 2
4. Analyze motion/change between frames
5. Combine into dynamics vector

Approach B - Review Mining:
1. Fetch Steam reviews
2. Extract feel-related phrases:
   - "controls feel [tight/floaty/responsive]"
   - "[fast/slow]-paced"
   - "satisfying [combat/gameplay]"
3. Aggregate descriptors
4. Embed aggregated text

Recommended: Start with Approach B, add A later
```

### Review Mining Patterns
```python
DYNAMICS_PATTERNS = [
    r"(feels?|felt) (very |so |really )?(tight|floaty|responsive|clunky|smooth|weighty)",
    r"(fast|slow|relaxing|frantic|methodical)[- ]paced",
    r"(satisfying|juicy|punchy|meaty|crunchy) (combat|gameplay|feedback|controls)",
    r"(quick|short|long) (sessions?|runs?|playthroughs?)",
    r"(tense|stressful|relaxing|chill) (gameplay|experience|moments?)",
]
```

### Example Similarities
- Hollow Knight ↔ Celeste (tight controls, challenging, flow state)
- Stardew Valley ↔ Animal Crossing (relaxed pacing, chill sessions)
- Hotline Miami ↔ Katana Zero (frantic, quick, intense)

### User-Facing Copy
> **Flows Like**: Games with similar pacing and feel

---

## Facet Interactions

Some facets correlate but are distinct:

| Correlation | Why |
|-------------|-----|
| AESTHETIC ↔ ATMOSPHERE | Visual style influences mood |
| MECHANICS ↔ DYNAMICS | Gameplay affects pacing |
| NARRATIVE ↔ ATMOSPHERE | Story themes shape mood |

Keeping them separate allows users to find unexpected matches:
- "Games that LOOK like Hollow Knight but PLAY like Stardew Valley"
- "Games ABOUT sci-fi that FEEL cozy"

---

## Embedding Dimension Summary

| Facet | Model | Native Dims | Stored Dims |
|-------|-------|-------------|-------------|
| AESTHETIC | SigLIP 2 | 768 | 768 |
| ATMOSPHERE | Hybrid | 768 + 1536 | 768 (projected) |
| MECHANICS | OpenAI | 1536 | 768 (projected) |
| NARRATIVE | OpenAI | 1536 | 768 (projected) |
| DYNAMICS | SigLIP 2 / OpenAI | varies | 768 (projected) |

All facets use 768-dimensional vectors for consistency and index efficiency.

---

## Quality Validation

### Per-Facet Test Cases

For each facet, define 10 "ground truth" similar pairs that should score high:

**AESTHETIC**:
- Hollow Knight ↔ Ori → should be high
- Hollow Knight ↔ Minecraft → should be low

**MECHANICS**:
- Hollow Knight ↔ Blasphemous → should be high
- Hollow Knight ↔ Stardew Valley → should be low

### Human Evaluation Protocol
1. Show user: "Game A and Game B"
2. Ask: "Are these similar in [facet]?" (1-5 scale)
3. Compare to embedding similarity score
4. Compute correlation

---

## References

- [SigLIP 2 Model Card](https://huggingface.co/google/siglip2-base-patch16-224)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [IGDB API Documentation](https://api-docs.igdb.com/)
- [Steam Web API](https://steamcommunity.com/dev)
