# Whitepaper Outline: Semantic Game Matching

**Working Title**: *Multi-Facet Embedding Approach to Game Recommendation: Aligning Machine Learning with Player Mental Models*

---

## Abstract (Draft)

Game recommendation systems typically rely on collaborative filtering or simple content-based features like genre tags. These approaches fail to capture the multidimensional nature of game similarity as perceived by players. We present a multi-facet embedding system that models games across five orthogonal dimensions—aesthetic, atmosphere, mechanics, narrative, and dynamics—each aligned with psychological research on player motivation. Using a combination of vision-language models (SigLIP 2) for visual similarity and structured text embeddings for semantic content, our system enables faceted similarity search where users control which dimensions matter most. We demonstrate that this approach outperforms single-embedding baselines and provides more interpretable recommendations.

---

## 1. Introduction

### 1.1 The Problem with Current Approaches

Current game recommendation systems suffer from several limitations:

1. **Single-dimension matching**: Treating games as points in a single embedding space conflates orthogonal qualities (visual style, gameplay mechanics, emotional tone)

2. **Static recommendations**: Pre-computed suggestions don't update when new games are added

3. **Black-box outputs**: Users have no control over or understanding of why games are recommended

4. **Genre over-reliance**: Genre tags are coarse and player-generated tags are noisy

### 1.2 Our Contribution

We propose a multi-facet embedding approach that:

1. Models games across five research-backed dimensions
2. Enables real-time similarity search via vector databases
3. Provides faceted filtering for user control
4. Combines vision-language models with structured text embeddings

### 1.3 Research Questions

- RQ1: Do multi-facet embeddings better capture human perception of game similarity than single embeddings?
- RQ2: Which facets are most predictive of player preferences?
- RQ3: How does embedding-based recommendation compare to LLM-generated suggestions?

---

## 2. Related Work

### 2.1 Player Motivation Research

- **Yee (2006)**: Three-factor model (achievement, social, immersion) for MMO players
- **Quantic Foundry**: 12 motivations in 6 clusters based on 500,000+ gamers
- **King et al. (2010)**: Five structural characteristics (social, manipulation/control, narrative/identity, reward/punishment, presentation)
- **Vahlo et al. (2017)**: Five gameplay dynamics preferences (management, aggression, exploration, coordination, caretaking)

### 2.2 Game Recommendation Systems

- **Collaborative filtering**: Netflix-style "players who played X also played Y"
- **Content-based**: Matching on genre, tags, developer
- **Hybrid approaches**: Combining collaborative and content signals
- **Knowledge graphs**: Using game ontologies for reasoning

### 2.3 Vision-Language Models

- **CLIP (Radford et al., 2021)**: Contrastive language-image pre-training
- **SigLIP (Zhai et al., 2023)**: Sigmoid loss variant with improved efficiency
- **SigLIP 2 (2025)**: Multilingual extension with self-distillation

### 2.4 Game Visual Analysis

- **From Pixels to Titles (2024)**: CNN-based game identification from screenshots
- **Game Feel Research (Swink, 2008)**: Taxonomy of game feel components
- **Juicy Design (Jonasson & Purho, 2012)**: Feedback amplification in games

---

## 3. The Five-Facet Model

### 3.1 Theoretical Foundation

Our facet model is derived from three sources:

1. **Quantic Foundry's motivation clusters**: Maps to which dimensions matter to different player types
2. **King et al.'s structural features**: Identifies distinct psychological dimensions
3. **Steam tag clustering**: Empirical evidence of how players categorize games

### 3.2 Facet Definitions

| Facet | Psychological Basis | Data Signal |
|-------|---------------------|-------------|
| AESTHETIC | King's "Presentation" | Visual similarity from screenshots |
| ATMOSPHERE | Quantic's "Immersion" | Mood/tone from visuals + text |
| MECHANICS | Vahlo's dynamics | Tags, game modes, keywords |
| NARRATIVE | Quantic's "Fantasy/Story" | Description, themes, setting |
| DYNAMICS | King's "Manipulation/Control" | Video analysis, review mining |

### 3.3 Independence of Facets

We demonstrate that facets capture orthogonal information:

- Correlation analysis between facet embeddings
- Examples of games similar in one facet but not others
- User studies on facet distinctiveness

---

## 4. System Architecture

### 4.1 Data Pipeline

```
Steam API → Raw Game Data → Feature Extraction → Embedding Generation → Vector Database
```

### 4.2 Embedding Models

| Facet | Model | Dimensions | Input |
|-------|-------|------------|-------|
| AESTHETIC | SigLIP 2 | 768 | Screenshots |
| ATMOSPHERE | Hybrid | 768 | Screenshots + mood text |
| MECHANICS | OpenAI | 768 | Structured tag template |
| NARRATIVE | OpenAI | 768 | Description + themes |
| DYNAMICS | Hybrid | 768 | Video frames + reviews |

### 4.3 Vector Database

- PostgreSQL with pgvector extension
- HNSW indexes for approximate nearest neighbor search
- Filtered indexes per facet for efficient queries

### 4.4 Query Processing

- Single-facet queries: Direct similarity search
- Multi-facet queries: Weighted combination across facets
- Cross-modal queries: Text/image to game search

---

## 5. Embedding Strategies

### 5.1 Visual Embeddings (AESTHETIC, ATMOSPHERE)

**Screenshot Selection**:
- Header image + first 3 screenshots
- Weighted averaging (header=0.4, screenshots=0.2 each)

**Model**: SigLIP 2 (siglip2-base-patch16-224)
- 768-dimensional output
- Trained on web-scale image-text pairs
- Supports zero-shot text queries

### 5.2 Text Embeddings (MECHANICS, NARRATIVE)

**Template-Based Approach**:
- Structured templates from game metadata
- Normalized tag vocabulary
- IGDB enrichment for themes/keywords

**Model**: OpenAI text-embedding-3-small
- 1536 dimensions (projected to 768)
- Strong semantic understanding
- Handles domain-specific terminology

### 5.3 Multimodal Embeddings (ATMOSPHERE, DYNAMICS)

**Hybrid Approach**:
- Combine visual and text signals
- Weighted averaging with learned weights
- Optional: Vision-language analysis with GPT-4V

### 5.4 Dynamic Embeddings (DYNAMICS)

**Review Mining**:
- Extract "feel" descriptors from player reviews
- Pattern matching for pacing/control language
- Aggregate into structured profile

**Video Analysis** (future work):
- Frame sampling from gameplay trailers
- Motion analysis between frames
- Temporal embedding aggregation

---

## 6. Evaluation

### 6.1 Dataset

- Games: All games in IndieFindr database (~N games)
- Embeddings: Five facets per game
- Ground truth: Human similarity judgments (to be collected)

### 6.2 Metrics

| Metric | Description |
|--------|-------------|
| **Precision@K** | Fraction of top-K recommendations that are relevant |
| **nDCG** | Normalized Discounted Cumulative Gain |
| **Diversity** | Variety in recommended games |
| **Coverage** | Fraction of catalog that can be recommended |
| **User satisfaction** | A/B test engagement metrics |

### 6.3 Baselines

1. **Single embedding**: All game features in one vector
2. **Tag-based**: Jaccard similarity on Steam tags
3. **Collaborative filtering**: "Players who played X also played Y"
4. **LLM-generated**: Current v1 system (Perplexity + GPT)

### 6.4 Human Evaluation Protocol

1. Present pairs of games
2. Ask: "Are these games similar in [facet]?" (1-5 scale)
3. Compare to embedding similarity
4. Compute rank correlation

---

## 7. Results

### 7.1 Quantitative Results

*(To be filled after experiments)*

- Precision@10 by facet
- Comparison to baselines
- Facet correlation analysis

### 7.2 Qualitative Analysis

- Example recommendations by facet
- Interesting edge cases
- Failure mode analysis

### 7.3 User Study

- A/B test results (v1 vs v2)
- Click-through rates by facet
- User feedback themes

---

## 8. Discussion

### 8.1 Key Findings

*(To be written after experiments)*

### 8.2 Limitations

1. **Game feel is hard**: DYNAMICS facet relies on proxies (reviews, video) rather than actual gameplay
2. **Cold start**: New games need sufficient data for all facets
3. **Embedding quality**: Dependent on pre-trained model biases
4. **Cultural bias**: Western-centric training data may not generalize

### 8.3 Future Work

1. **Fine-tuning**: Train SigLIP on game-specific data
2. **User personalization**: Learn individual facet weights
3. **Temporal dynamics**: Track how games' perceived similarity changes over time
4. **Explainability**: Generate natural language explanations for similarity

---

## 9. Conclusion

We presented a multi-facet embedding approach to game recommendation that aligns with psychological research on player motivation. By modeling games across five orthogonal dimensions and enabling faceted search, our system provides more controllable and interpretable recommendations than single-embedding approaches. Our evaluation demonstrates [results TBD], suggesting that this approach better captures the nuanced ways players perceive game similarity.

---

## References

### Player Motivation & Game Taxonomy

1. Yee, N. (2006). Motivations for Play in Online Games. *CyberPsychology & Behavior*, 9(6), 772-775.

2. Yee, N. (2016). The Gamer Motivation Model. Quantic Foundry. https://quanticfoundry.com/gamer-motivation-model/

3. King, D., Delfabbro, P., & Griffiths, M. (2010). Video game structural characteristics: A new psychological taxonomy. *International Journal of Mental Health and Addiction*, 8(1), 90-106.

4. Vahlo, J., Kaakinen, J. K., Holm, S. K., & Koponen, A. (2017). Digital Game Dynamics Preferences and Player Types. *Journal of Computer-Mediated Communication*, 22(2), 88-103.

5. Bartle, R. (1996). Hearts, Clubs, Diamonds, Spades: Players Who Suit MUDs. *Journal of MUD Research*, 1(1).

### Game Feel & Design

6. Swink, S. (2008). *Game Feel: A Game Designer's Guide to Virtual Sensation*. CRC Press.

7. Jonasson, M., & Purho, P. (2012). Juice it or lose it. GDC Talk.

8. Pichlmair, M., & Johansen, M. (2020). Designing Game Feel: A Survey. *arXiv:2011.09201*.

### Vision-Language Models

9. Radford, A., et al. (2021). Learning Transferable Visual Models From Natural Language Supervision. *ICML*.

10. Zhai, X., et al. (2023). Sigmoid Loss for Language Image Pre-Training. *ICCV*.

11. Tschannen, M., et al. (2025). SigLIP 2: Multilingual Vision-Language Encoders. *arXiv:2502.14786*.

### Game Recommendation Systems

12. Sifa, R., Bauckhage, C., & Drachen, A. (2015). Large-Scale Cross-Game Player Behavior Analysis on Steam. *AIIDE*.

13. Cheuque, G., et al. (2019). Recommender System for Video Games. *RecSys Workshop*.

14. Pérez-Marcos, J., et al. (2024). From Pixels to Titles: Video Game Identification by Screenshots using CNNs. *arXiv:2311.15963*.

### Vector Databases & Embeddings

15. Malkov, Y. A., & Yashunin, D. A. (2018). Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs. *IEEE TPAMI*.

16. OpenAI. (2024). Embeddings. https://platform.openai.com/docs/guides/embeddings

17. Supabase. (2024). pgvector: Embeddings and vector similarity. https://supabase.com/docs/guides/database/extensions/pgvector

---

## Appendices

### A. Steam Tag Clustering Analysis

*(Network analysis of tag co-occurrence)*

### B. Embedding Template Examples

*(Full examples for each facet)*

### C. Human Evaluation Survey Design

*(Survey questions and methodology)*

### D. API Cost Analysis

*(Breakdown of embedding generation costs)*
