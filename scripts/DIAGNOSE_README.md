# Game Matching Diagnostic Tools

Tools to analyze why games aren't matching and find potential matches based on descriptors.

## API Endpoints

### 1. Find Games by Name
```
GET /api/diagnose/find?name=Game Name
```

Returns games matching the name (fuzzy search) with their descriptors and embedding status.

**Example:**
```bash
curl "http://localhost:3000/api/diagnose/find?name=Pig%20Face"
```

### 2. Compare Two Games
```
GET /api/diagnose/compare?game1Id=123&game2Id=456&facet=aesthetic
```

Compares two games and shows:
- Similarity score
- Shared descriptors
- Unique descriptors for each game
- Why they're not matching

**Example:**
```bash
curl "http://localhost:3000/api/diagnose/compare?game1Id=123456&game2Id=789012&facet=aesthetic"
```

### 3. Find Games with Similar Descriptors
```
GET /api/diagnose/similar-descriptors?facet=aesthetic&limit=20&minShared=2
```

Finds pairs of games that share descriptor words (potential matches that aren't being caught by embeddings).

**Example:**
```bash
curl "http://localhost:3000/api/diagnose/similar-descriptors?facet=aesthetic&limit=20"
```

## CLI Script

Use the `diagnose-matching.js` script for easier command-line access:

```bash
# Find games by name
node scripts/diagnose-matching.js find "Pig Face"

# Compare two games
node scripts/diagnose-matching.js compare 123456 789012 aesthetic

# Find games with similar descriptors
node scripts/diagnose-matching.js similar-descriptors aesthetic 20
```

## Using with Supabase MCP

You can also use Supabase MCP's `execute_sql` tool to run custom queries:

### Find games by name:
```sql
SELECT 
  id,
  name,
  aesthetic_text,
  gameplay_text,
  narrative_text,
  aesthetic_embedding IS NOT NULL as has_aesthetic_embedding,
  gameplay_embedding IS NOT NULL as has_gameplay_embedding,
  narrative_embedding IS NOT NULL as has_narrative_embedding
FROM games
WHERE name ILIKE '%Pig Face%'
ORDER BY name
LIMIT 10;
```

### Compare two games' similarity:
```sql
SELECT 
  g1.id as game1_id,
  g1.name as game1_name,
  g2.id as game2_id,
  g2.name as game2_name,
  g1.aesthetic_text as game1_descriptors,
  g2.aesthetic_text as game2_descriptors,
  1 - (g1.aesthetic_embedding <=> g2.aesthetic_embedding) as similarity_score,
  CASE 
    WHEN (1 - (g1.aesthetic_embedding <=> g2.aesthetic_embedding)) >= 0.55 THEN 'WOULD MATCH'
    ELSE 'BELOW THRESHOLD'
  END as match_status
FROM games g1
CROSS JOIN games g2
WHERE g1.id = 123456
  AND g2.id = 789012
  AND g1.aesthetic_embedding IS NOT NULL
  AND g2.aesthetic_embedding IS NOT NULL;
```

### Find games with shared descriptors:
```sql
WITH game_descriptors AS (
  SELECT 
    id,
    name,
    unnest(string_to_array(LOWER(aesthetic_text), ', ')) as descriptor
  FROM games
  WHERE aesthetic_text IS NOT NULL 
    AND aesthetic_text != ''
)
SELECT 
  gd1.id as game1_id,
  gd1.name as game1_name,
  gd2.id as game2_id,
  gd2.name as game2_name,
  COUNT(DISTINCT gd1.descriptor) as shared_count,
  STRING_AGG(DISTINCT gd1.descriptor, ', ' ORDER BY gd1.descriptor) as shared_words
FROM game_descriptors gd1
INNER JOIN game_descriptors gd2 
  ON gd1.descriptor = gd2.descriptor
  AND gd1.id < gd2.id
WHERE TRIM(gd1.descriptor) != ''
GROUP BY gd1.id, gd1.name, gd2.id, gd2.name
HAVING COUNT(DISTINCT gd1.descriptor) >= 2
ORDER BY shared_count DESC
LIMIT 20;
```

## Common Issues

### Games should match but don't

1. **Check similarity score**: Use the compare endpoint to see the actual similarity score
2. **Check descriptors**: Look for shared descriptor words that might indicate similarity
3. **Check threshold**: The default threshold is 0.55; games below this won't match
4. **Check embeddings**: Ensure both games have embeddings for the facet

### Disparate descriptors (e.g., "PS1 era polygons" vs "PS1-era 3D")

These are semantically similar but use different wording. Solutions:
1. **Normalize descriptors**: Consider creating a normalization step in the Perplexity refinement
2. **Manual links**: Use the manual similarity editor to link games that should match
3. **Lower threshold**: Temporarily lower the threshold to catch more matches (but may increase false positives)

## Next Steps

1. Use the diagnostic tools to identify games that should match
2. Analyze why they're not matching (low similarity score, missing descriptors, etc.)
3. Either:
   - Add manual links via the Manual Similarity Editor
   - Re-ingest games to get better descriptors
   - Adjust the similarity threshold
   - Normalize descriptor variations
