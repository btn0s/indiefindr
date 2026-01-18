# Research: Player Psychology & Game Categorization

This document summarizes research on how players think about game similarity, informing the v2 facet model.

## Key Research Sources

1. **Quantic Foundry's Gamer Motivation Model** - 12 motivations in 6 clusters, based on 500,000+ gamers
2. **King et al. (2010)** - 5 structural characteristics that drive player engagement
3. **Vahlo et al. (2017)** - 5 gameplay preference dimensions
4. **Steam Tag Network Analysis** - How tags cluster based on player usage
5. **Game Feel Research (Swink, Pichlmair)** - What makes games feel responsive

---

## Quantic Foundry: 12 Motivations in 6 Clusters

From [Quantic Foundry's Gamer Motivation Model](https://quanticfoundry.com/gamer-motivation-model/), based on factor analysis of 500,000+ gamers:

| Cluster | Motivations | Player Desire |
|---------|-------------|---------------|
| **Action** | Destruction, Excitement | Fast-paced, explosive, thrilling |
| **Social** | Competition, Community | Multiplayer, co-op, versus |
| **Mastery** | Challenge, Strategy | Difficult, tactical, skill-based |
| **Achievement** | Completion, Power | Progression, collecting, leveling |
| **Immersion** | Fantasy, Story | Narrative, role-playing, escapism |
| **Creativity** | Design, Discovery | Building, exploring, experimenting |

### Key Insight
Players are rarely motivated by a single factor. Trait-based models (sum of characteristics) better capture player preferences than categorical types.

### The 9 Gamer Types

Quantic Foundry identified 9 player archetypes:
- **Slayer**: Cinematic stories, solo, accessible gameplay
- **Skirmisher**: Fast-paced team arenas, not too challenging
- **Ninja**: Difficult challenges, strategic, competitive
- **Bounty Hunter**: Power progression, collection, solo
- And 5 more...

---

## King et al.: 5 Structural Features

From psychological research on what makes games engaging:

| Feature | What It Captures | Relevance to v2 |
|---------|------------------|-----------------|
| **Social Features** | Multiplayer, communication, cooperation | → MECHANICS facet |
| **Manipulation/Control** | Game feel, responsiveness, controls | → DYNAMICS facet |
| **Narrative/Identity** | Story, character, role-playing | → NARRATIVE facet |
| **Reward/Punishment** | Progression, loot, difficulty curve | → MECHANICS facet |
| **Presentation** | Aesthetics, audio, visuals | → AESTHETIC facet |

### Key Insight
"Manipulation and Control" (game feel) is a distinct psychological dimension. Players notice when controls feel "tight" vs "floaty"—but this is hard to capture without playing.

---

## Vahlo et al.: Gameplay Activity Preferences

From [Digital Game Dynamics Preferences and Player Types](https://onlinelibrary.wiley.com/doi/full/10.1111/jcc4.12181):

| Preference | Example Activities |
|------------|-------------------|
| **Management** | Building, organizing, optimizing |
| **Aggression** | Combat, destruction, defeating enemies |
| **Exploration** | Discovering, wandering, uncovering secrets |
| **Coordination** | Teamwork, cooperation, communication |
| **Caretaking** | Nurturing, protecting, helping |

### Key Insight
Players prefer certain *activities* regardless of genre. A "caretaking" player might enjoy Stardew Valley, Pokémon, or The Sims for the same underlying reason.

---

## Steam Tag Clusters

Research on Steam tag co-occurrence reveals ~17 natural clusters:

### Visual Style Clusters
- Pixel Art, Retro, 8-bit
- Anime, Visual Novel, JRPG
- Realistic, Photorealistic, AAA
- Hand-drawn, Artistic, Stylized

### Mood/Tone Clusters
- Horror, Dark, Psychological Horror
- Cozy, Relaxing, Wholesome
- Atmospheric, Immersive, Beautiful

### Mechanics Clusters
- Roguelike, Roguelite, Procedural
- Metroidvania, Souls-like, Exploration
- Turn-based, Strategy, Tactical
- Open World, Sandbox, Crafting

### Key Insight
Players naturally cluster games by visual style, mood, AND mechanics—supporting the multi-facet approach.

---

## Game Feel Research

From [A Survey on Game Feel](https://arxiv.org/pdf/2011.09201):

> "A juicy game feels alive and responds to everything you do—tons of cascading action and response for minimal user input."

### Components of Game Feel
- **Input**: How controls translate to action
- **Response**: Visual/audio feedback to actions
- **Context**: Environmental reactions
- **Aesthetic**: Visual polish and effects
- **Metaphor**: How actions map to real-world expectations

### What Makes Games "Juicy"
- Screen shake
- Particle effects
- Squash and stretch
- Sound effects on every action
- Camera movement
- Generous hit pause

### Key Insight
Game feel is crucial for player satisfaction but nearly impossible to capture from screenshots alone. Video analysis or review mining may help.

---

## Self-Determination Theory (SDT)

Ryan et al. applied SDT to games, finding three core needs:

| Need | In Games |
|------|----------|
| **Autonomy** | Meaningful choices, player agency |
| **Competence** | Skill mastery, achievable challenges |
| **Relatedness** | Social connection, belonging |

### Key Insight
These map loosely to facets: Autonomy → MECHANICS/NARRATIVE, Competence → DYNAMICS, Relatedness → (not captured, would need social features).

---

## Data Availability Analysis

What can we actually capture from available data?

| Signal | Steam API | IGDB | Screenshots | Videos | Reviews |
|--------|-----------|------|-------------|--------|---------|
| Visual style | Tags | - | **Primary** | Yes | - |
| Mood/tone | Tags | Themes | **Primary** | Yes | Yes |
| Mechanics | Tags | Keywords, Modes | UI hints | Yes | Yes |
| Narrative/theme | Description | Themes, Storyline | Setting | - | - |
| Game feel/pacing | Limited | - | Motion cues | **Primary** | **Primary** |
| Social mode | Categories | Game Modes | - | - | - |

### IGDB Provides Data Steam Doesn't
- **Themes**: Horror, Sci-fi, Fantasy (structured)
- **Keywords**: Permadeath, Crafting, Procedural
- **Player Perspectives**: First-person, Side-view, VR
- **Game Modes**: Single-player, Co-op, Battle Royale
- **Storyline**: Extended plot summary

---

## Implications for v2

### What the Research Tells Us

1. **Multi-facet is correct**: Players evaluate games on independent dimensions
2. **Visual matters**: Presentation is a core psychological feature
3. **Feel is hard**: Game feel requires playing or video analysis
4. **Motivations vary**: Different players weight facets differently
5. **Tags are user-generated**: Steam tags reflect real player mental models

### Recommended Facet Model

Based on research alignment + data availability:

| Facet | Research Basis | Capturable? |
|-------|---------------|-------------|
| AESTHETIC | King's "Presentation", Steam visual tags | ✅ Screenshots |
| ATMOSPHERE | Quantic's "Immersion", mood clusters | ✅ Screenshots + text |
| MECHANICS | Vahlo's dynamics, Steam mechanic tags | ✅ Tags + IGDB |
| NARRATIVE | Quantic's "Fantasy/Story" | ✅ Description + themes |
| DYNAMICS | King's "Manipulation/Control", game feel | ⚠️ Video + reviews |

---

## References

1. Yee, N. (2006). Motivations for Play in Online Games. *CyberPsychology & Behavior*.
2. King, D. et al. (2010). Video game structural characteristics: A new psychological taxonomy. *International Journal of Mental Health and Addiction*.
3. Vahlo, J. et al. (2017). Digital Game Dynamics Preferences and Player Types. *Journal of Computer-Mediated Communication*.
4. Swink, S. (2008). *Game Feel: A Game Designer's Guide to Virtual Sensation*. CRC Press.
5. Pichlmair, M. & Johansen, M. (2020). Designing Game Feel: A Survey. *arXiv:2011.09201*.
6. Quantic Foundry. Gamer Motivation Model. https://quanticfoundry.com/gamer-motivation-model/
