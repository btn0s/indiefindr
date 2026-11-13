-- Similarity judgments: interaction data for the trainer
-- (docs/interaction-trained-recommender.md)
--
-- judgment_sessions / similarity_judgments: one row per labeling screen,
-- with the full impression set logged so the data supports unbiased eval.
-- steam_review_edges / coreview_pairs: mined Steam co-review signal (Source A).

CREATE TABLE IF NOT EXISTS judgment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('human', 'agent')),
  agent_model TEXT,
  persona_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS similarity_judgments (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES judgment_sessions(id) ON DELETE CASCADE,
  seed_appid BIGINT NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  shown_appids BIGINT[] NOT NULL,
  picked_appids BIGINT[] NOT NULL,
  best_appid BIGINT,
  rejected_appids BIGINT[] NOT NULL DEFAULT '{}',
  -- NULL = overall similarity question; otherwise the facet the screen asked about
  facet TEXT CHECK (facet IN ('vibe', 'mechanics')),
  sampler_version TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_similarity_judgments_seed
  ON similarity_judgments(seed_appid);
CREATE INDEX IF NOT EXISTS idx_similarity_judgments_session
  ON similarity_judgments(session_id);

-- Reviewer ids are hashed before storage; we only need co-occurrence, not identity.
CREATE TABLE IF NOT EXISTS steam_review_edges (
  appid BIGINT NOT NULL,
  reviewer_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (appid, reviewer_hash)
);

CREATE INDEX IF NOT EXISTS idx_steam_review_edges_reviewer
  ON steam_review_edges(reviewer_hash);

CREATE TABLE IF NOT EXISTS coreview_pairs (
  appid_a BIGINT NOT NULL,
  appid_b BIGINT NOT NULL,
  coreview_count INTEGER NOT NULL,
  pmi DOUBLE PRECISION NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (appid_a, appid_b),
  CHECK (appid_a < appid_b)
);

CREATE INDEX IF NOT EXISTS idx_coreview_pairs_a ON coreview_pairs(appid_a);
CREATE INDEX IF NOT EXISTS idx_coreview_pairs_b ON coreview_pairs(appid_b);

-- Rebuild coreview_pairs from steam_review_edges with PMI weighting
-- (so co-occurrence with mega-hits doesn't dominate). Returns rows inserted.
CREATE OR REPLACE FUNCTION refresh_coreview_pairs(min_coreviews INTEGER DEFAULT 3)
RETURNS INTEGER AS $$
DECLARE
  total_reviewers BIGINT;
  inserted INTEGER;
BEGIN
  SELECT COUNT(DISTINCT reviewer_hash) INTO total_reviewers FROM steam_review_edges;
  IF total_reviewers = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM coreview_pairs;

  INSERT INTO coreview_pairs (appid_a, appid_b, coreview_count, pmi)
  SELECT
    e1.appid,
    e2.appid,
    COUNT(*)::INTEGER,
    LN((COUNT(*)::DOUBLE PRECISION * total_reviewers) / (ca.cnt::DOUBLE PRECISION * cb.cnt::DOUBLE PRECISION))
  FROM steam_review_edges e1
  JOIN steam_review_edges e2
    ON e1.reviewer_hash = e2.reviewer_hash AND e1.appid < e2.appid
  JOIN (SELECT appid, COUNT(*) AS cnt FROM steam_review_edges GROUP BY appid) ca
    ON ca.appid = e1.appid
  JOIN (SELECT appid, COUNT(*) AS cnt FROM steam_review_edges GROUP BY appid) cb
    ON cb.appid = e2.appid
  GROUP BY e1.appid, e2.appid, ca.cnt, cb.cnt
  HAVING COUNT(*) >= min_coreviews;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql;

-- Training data is written only by trusted server contexts (service role
-- bypasses RLS); no public policies on purpose.
ALTER TABLE judgment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_review_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE coreview_pairs ENABLE ROW LEVEL SECURITY;
