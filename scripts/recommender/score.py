#!/usr/bin/env python
"""Fixed scorer for the hand-written recommender.

Reads the catalog and params.json, ranks every catalog game for a seed.
Everything that decides the ranking is a number or phrase in params.json;
this file only does arithmetic. No fitted weights, no LLM calls, no network.

  python handwritten/score.py "Mouthwashing"        # top 10 for a title or appid

Score for seed s and candidate c:
  similarity = sum of blend[f] * f(s, c)             (axis, steam_tag, steam_conflict, tag, affinity, text, ..., gaps)
  z          = similarity standardised per seed over its top-K candidates
  score      = z + prior.popularity * pop(c) + prior.quality * quality(c)

Real Steam user tags (data/steam_tags.json, backfilled after the catalog export) are optional:
Model(use_steam_tags=False) scores from the catalog alone.
"""
import html, json, pickle, re, sys
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.preprocessing import normalize

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TOKEN = re.compile(r"[a-z0-9]+")
YEAR = re.compile(r"(?:19|20)\d{2}")


def tokens(text):
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(text or ""))).lower()
    return TOKEN.findall(text.replace("'", "").replace("’", ""))


def load_catalog():
    """Catalog rows sorted by appid (same order as scripts/baselines.py) plus cached token lists."""
    rows = json.loads((ROOT / "data/catalog.json").read_text())["rows"]
    rows.sort(key=lambda r: int(r["appid"]))
    cache = HERE / "cache/tokens.pkl"
    if cache.exists():
        toks = pickle.loads(cache.read_bytes())
    else:
        toks = [(tokens(r.get("title")), tokens(r.get("short_description")), tokens(r.get("long_description"))) for r in rows]
        cache.parent.mkdir(exist_ok=True)
        cache.write_bytes(pickle.dumps(toks))
    return rows, toks


def word_match(pattern, token):
    return token.startswith(pattern[:-1]) if pattern.endswith("*") else token == pattern


def sparse(rows_of_dicts, width):
    r, c, v = [], [], []
    for i, d in enumerate(rows_of_dicts):
        for j, x in d.items():
            r.append(i); c.append(j); v.append(x)
    return csr_matrix((v, (r, c)), shape=(len(rows_of_dicts), width), dtype=np.float32)


def idf(matrix):
    df = np.asarray((matrix > 0).sum(axis=0)).ravel()
    return np.log((matrix.shape[0] + 1) / (df + 1)) + 1  # same formula as scripts/baselines.py


class PhraseIndex:
    """Finds whole-word phrases ('deck build*', 'slay the spire') in token lists."""

    def __init__(self, phrases):  # phrases: iterable of (phrase string, payload)
        self.exact, self.prefix, self.first = {}, {}, {}
        for phrase, payload in phrases:
            ws = phrase.split()
            (self.prefix if ws[0].endswith("*") else self.exact).setdefault(ws[0].rstrip("*"), []).append((ws[1:], payload))

    def starts(self, tok):
        if tok not in self.first:
            hits = list(self.exact.get(tok, ()))
            if self.prefix:
                for k in range(1, len(tok) + 1): hits += self.prefix.get(tok[:k], ())
            self.first[tok] = hits
        return self.first[tok]

    def find(self, ts):
        for i, t in enumerate(ts):
            for rest, payload in self.starts(t):
                if all(i + 1 + j < len(ts) and word_match(w, ts[i + 1 + j]) for j, w in enumerate(rest)):
                    yield payload


class Model:
    def __init__(self, params=None, catalog=None, use_steam_tags=True):
        self.p = p = params or json.loads((HERE / "params.json").read_text())
        self.rows, toks = catalog or load_catalog()
        st = p["steam_tags"]
        steam_file = ROOT / st["file"]
        self.with_tags = bool(use_steam_tags and steam_file.exists())
        steam_all = json.loads(steam_file.read_text()) if steam_file.exists() else {}
        steam = steam_all if self.with_tags else {}
        self.blend, self.prior = (p["blend_with_steam_tags"], p["prior_with_steam_tags"]) if self.with_tags else (p["blend"], p["prior"])
        rows = self.rows
        n = len(rows)
        self.ids = [int(r["appid"]) for r in rows]
        self.ix = {a: i for i, a in enumerate(self.ids)}
        self.axes = list(p["axes"])
        axis_ix = {a: i for i, a in enumerate(self.axes)}

        # ---- concepts: lexicon phrases found in text + Steam store metadata (genres, categories) ----
        names = list(p["lexicon"]) + list(p["meta_tags"])
        self.concepts = names
        cix = {c: i for i, c in enumerate(names)}
        specs = {**p["lexicon"], **p["meta_tags"]}
        load = np.zeros((len(names), len(self.axes)), dtype=np.float32)
        for c, spec in specs.items():
            for a, x in spec.get("ax", {}).items():
                load[cix[c], axis_ix[a]] = x
        lex = PhraseIndex((pat, cix[c]) for c, spec in p["lexicon"].items() for pat in spec["m"])
        f = p["fields"]
        k_sat, k_pow = p["concept_saturation"], p["concept_saturation_power"]
        concept_rows = []
        for r, (title, short, long_) in zip(rows, toks):
            raw = {}
            for ts, w in ((title, f["title"]), (short, f["short"]), (long_[: f["long_max_tokens"]], f["long"])):
                for c in lex.find(ts): raw[c] = raw.get(c, 0.0) + w
            tags = r.get("steamspy_tags") or {}
            top = max(tags.values(), default=0)
            for tag, votes in tags.items():  # real Steam tags (rare in this export) go through the same lexicon
                if votes and top:
                    for c in lex.find(tokens(tag)): raw[c] = raw.get(c, 0.0) + f["steam_tag"] * votes / top
            vec = {c: specs[names[c]].get("w", 1.0) * x ** k_pow / (x ** k_pow + k_sat ** k_pow) for c, x in raw.items()}
            meta = [f"genre:{g['description']}" for g in r.get("genres") or []]
            meta += [f"cat:{g['description']}" for g in r.get("categories") or []]
            meta += [f"cd:{j}" for j in (r.get("content_descriptors") or {}).get("ids") or []]
            for m in meta:
                if m in cix: vec[cix[m]] = specs[m].get("w", 1.0)
            concept_rows.append(vec)
        C = sparse(concept_rows, len(names))
        self.C = C
        self.T = normalize(C.multiply(idf(C))).tocsr()  # IDF-weighted pseudo-tag vectors

        # ---- real Steam user tags: vote-weighted tag vector per game, and the hand-written tag x axis matrix ----
        key = lambda name: name.strip().casefold()
        tag_ix, tag_rows = {}, []
        for a in self.ids:
            tags = [(key(t["name"]), float(t["weight"])) for t in (steam.get(str(a)) or {}).get("tags", [])]
            top = max((w for _, w in tags), default=1.0)
            tag_rows.append({tag_ix.setdefault(name, len(tag_ix)): (w / top) ** st["weight_power"] for name, w in tags})
        nt = max(len(tag_ix), 1)
        S = sparse(tag_rows, nt)
        self.S = normalize(S.multiply(idf(S) ** st["idf_power"])).tocsr()  # the brief's IDF-weighted tag cosine
        tag_load = np.zeros((nt, len(self.axes)), dtype=np.float32)
        for name, loads in p["steam_tag_axes"].items():
            if key(name) in tag_ix:
                for a, x in loads.items(): tag_load[tag_ix[key(name)], axis_ix[a]] = x
        K = np.zeros((nt, nt), dtype=np.float32)  # hand-written tag pairs that do not belong in one slate
        if self.with_tags:
            for a, b, x in p["steam_tag_conflicts"][1:]:
                K[tag_ix[key(a)], tag_ix[key(b)]] += x; K[tag_ix[key(b)], tag_ix[key(a)]] += x
        self.K = csr_matrix(K)

        # ---- vibe axes: (tags x matrix) mixed with (lexicon concepts x matrix); common axes scaled down ----
        mix = st["axis_mix"]
        A = mix["lexicon"] * normalize(C @ load)
        if self.with_tags: A = A + mix["steam_tags"] * normalize(S @ tag_load)
        A = A / (np.abs(A).mean(axis=0) + 1e-6) ** p["axis_common_power"]
        A = A * np.array([p["axes"][a].get("w", 1.0) for a in self.axes], dtype=np.float32)
        self.A = normalize(A).astype(np.float32)

        # ---- affinities / conflicts between concepts --------------------------------
        M = np.zeros((len(names), len(names)), dtype=np.float32)
        for a, b, x in p["affinities"]:
            M[cix[a], cix[b]] += x
            if a != b: M[cix[b], cix[a]] += x
        self.M = csr_matrix(M)

        # ---- plain text: IDF-weighted word cosine over descriptions, and over titles ----
        t = p["text"]
        vocab, doc_rows, title_rows = {}, [], []
        for title, short, long_ in toks:
            d = {}
            for ts, w in ((title, t["title"]), (short, t["short"]), (long_[: t["long_max_tokens"]], t["long"])):
                for tok in ts:
                    j = vocab.setdefault(tok, len(vocab)); d[j] = d.get(j, 0.0) + w
            doc_rows.append({j: 1 + np.log(x) if x > 1 else x for j, x in d.items()})
            title_rows.append({vocab[tok]: 1.0 for tok in title})
        X = sparse(doc_rows, len(vocab))
        df = np.asarray((X > 0).sum(axis=0)).ravel()
        keep = (df >= t["min_df"]) & (df <= t["max_df_share"] * n)
        self.X = normalize(X.multiply(idf(X) * keep)).tocsr()
        Ti = sparse(title_rows, len(vocab))
        self.Ti = normalize(Ti.multiply(idf(Ti) * (df < t["title_max_df_share"] * n))).tocsr()

        # ---- metadata features ---------------------------------------------------
        def incidence(key):
            voc, out = {}, []
            for r in rows:
                out.append({voc.setdefault(str(x).casefold().strip(), len(voc)): 1.0 for x in (r.get(key) or []) if str(x).strip()})
            return sparse(out, max(len(voc), 1))
        self.dev, self.pub = incidence("developers"), incidence("publishers")
        self.reviews = np.array([(r.get("recommendations") or {}).get("total", 0) for r in rows], dtype=np.float64)  # catalog field; 0 below ~100
        self.steam_reviews = np.array([((steam.get(str(a)) or {}).get("popularity") or {}).get("review_count") or 0 for a in self.ids], dtype=np.float64)
        positive = np.array([((steam.get(str(a)) or {}).get("popularity") or {}).get("percent_positive") or np.nan for a in self.ids], dtype=np.float32)
        self.pop = np.log10(1 + (self.steam_reviews if self.with_tags else self.reviews)).astype(np.float32)
        # review counts used only for reporting popularity skew (Sol's real-tag metric), whatever the model itself reads
        self.report_reviews = np.array([((steam_all.get(str(a)) or {}).get("popularity") or {}).get("review_count") or 0 for a in self.ids], dtype=np.float64) if steam_all else self.reviews
        lo, hi = (st["popularity_floor"], st["popularity_cap"]) if self.with_tags else (p["popularity_floor"], p["popularity_cap"])  # log10 reviews
        self.pop_prior = ((np.clip(self.pop, lo, hi) - lo) / (hi - lo)).astype(np.float32)
        years = []
        for r in rows:
            m = YEAR.search(str(r.get("steam_release_date") or r.get("release_date") or ""))
            years.append(int(m[0]) if m else np.nan)
        self.year = np.array(years, dtype=np.float32)
        price = [0.0 if r.get("is_free") else (r["price_overview"]["initial"] / 100 if r.get("price_overview") else np.nan) for r in rows]
        self.price = np.log1p(np.array(price, dtype=np.float32))
        q = p["quality_prior"]
        self.quality = q["not_indie"] * np.array([not r.get("is_indie") for r in rows], dtype=np.float32)  # the site is for indie games
        if self.with_tags:  # review ratio: share of positive reviews, once there are enough reviews to trust it
            ratio = np.clip((positive - st["ratio_centre"]) / st["ratio_span"], -1, 1)
            self.quality = self.quality + q["review_ratio"] * np.where((self.steam_reviews >= st["min_reviews_for_ratio"]) & ~np.isnan(ratio), ratio, 0).astype(np.float32)

        # ---- hard filters --------------------------------------------------------
        flt = p["filters"]
        software = set(flt["software_genres"])
        game_genres = set(flt["game_genres"])
        bad_title = re.compile("|".join(flt["title_patterns"]), re.I) if flt["title_patterns"] else None
        ok = np.ones(n, dtype=bool)
        for i, r in enumerate(rows):
            g = {x["description"] for x in r.get("genres") or []}
            if r.get("steam_type") not in flt["steam_types"]: ok[i] = False
            elif g & software and not g & game_genres: ok[i] = False
            elif bad_title and bad_title.search(str(r.get("title") or "")): ok[i] = False
        self.ok = ok

    def features(self, seeds):
        """Dict of (len(seeds) x catalog) similarity feature matrices for seed row indices."""
        s = np.asarray(seeds)
        p = self.p
        dense = lambda m: np.asarray(m.todense(), dtype=np.float32)
        gap = lambda v, cap: np.nan_to_num(np.minimum(np.abs(v[None, :] - v[s][:, None]), cap) / cap, nan=p["unknown_gap"])
        return {
            "axis": self.A[s] @ self.A.T,
            "tag": dense(self.T[s] @ self.T.T),
            "affinity": dense((self.T[s] @ self.M) @ self.T.T),
            "steam_tag": dense(self.S[s] @ self.S.T),
            "steam_conflict": dense((self.S[s] @ self.K) @ self.S.T),
            "text": dense(self.X[s] @ self.X.T),
            "title": dense(self.Ti[s] @ self.Ti.T),
            "same_developer": (dense(self.dev[s] @ self.dev.T) > 0).astype(np.float32),
            "same_publisher": (dense(self.pub[s] @ self.pub.T) > 0).astype(np.float32),
            "popularity_gap": -gap(self.pop, p["popularity_cap"]),
            "year_gap": -gap(self.year, p["year_gap_cap"]),
            "price_gap": -gap(self.price, p["price_gap_cap"]),
        }

    def combine(self, feats, seeds, blend=None, prior=None):
        """Similarity blend, standardised per seed, plus candidate priors. Returns the final score matrix."""
        p = self.p
        blend = self.blend if blend is None else blend
        prior = self.prior if prior is None else prior
        s = np.asarray(seeds)
        sim = np.zeros((len(s), len(self.rows)), dtype=np.float32)
        for name, w in blend.items():
            if w: sim += w * feats[name]
        sim[:, ~self.ok] = -np.inf
        sim[np.arange(len(s)), s] = -np.inf
        k = p["standardise_top_k"]
        head = -np.partition(-sim, k, axis=1)[:, :k]
        z = (sim - head.mean(axis=1, keepdims=True)) / (head.std(axis=1, keepdims=True) + 1e-6)
        return z + prior["popularity"] * self.pop_prior[None, :] + prior["quality"] * self.quality[None, :]

    def top(self, seeds, k=10, blend=None, prior=None, batch=200):
        out = []
        for a in range(0, len(seeds), batch):
            part = seeds[a:a + batch]
            sc = self.combine(self.features(part), part, blend, prior)
            out.extend(np.argsort(-sc, axis=1, kind="stable")[:, :k])
        return np.array(out)

    def explain(self, i, top=12):
        """Top concepts and axes for one game: what the model thinks it is."""
        row = self.C[i].toarray().ravel()
        cs = [(self.concepts[j], round(float(row[j]), 2)) for j in np.argsort(-row)[:top] if row[j] > 0]
        ax = [(self.axes[j], round(float(self.A[i, j]), 2)) for j in np.argsort(-self.A[i])[:8]]
        return cs, ax

    def recommend(self, appid, k=10):
        """Top-k appids for one seed appid."""
        return [self.ids[j] for j in self.top([self.ix[int(appid)]], k)[0]]


if __name__ == "__main__":
    model = Model()
    q = " ".join(sys.argv[1:]) or "Mouthwashing"
    hit = [i for i, r in enumerate(model.rows) if str(r["appid"]) == q or str(r.get("title") or "").casefold() == q.casefold()]
    if not hit: sys.exit(f"not in catalog: {q}")
    i = hit[0]
    print(model.rows[i]["title"], model.explain(i))
    for j in model.top([i])[0]:
        print(f"  {model.rows[j]['title']}  [{int(model.report_reviews[j])} reviews]")
