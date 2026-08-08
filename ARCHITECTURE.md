# NF Auto V2 — Architecture

## Overview

NF Auto generates a personalized daily technology news digest for four Vision71 team members. Each recipient gets a section of the same email covering five fixed categories: Global News, Pakistan News, Technology, AI, and Business.

V2 replaces the per-user, per-category API fetch loop from V1 with a single consolidated fetch that runs once per day, followed by local distribution.

---

## Pipeline — Step by Step

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1 — Consolidated Fetch  (fetchNewsPool.js)            │
│                                                             │
│  One batch of NewsData.io requests covers ALL users         │
│  and ALL categories in a single coordinated pass.           │
│                                                             │
│  Requests fired per daily run:                              │
│   • 2  broad domain fetches  (9 team sources, chunked ×5)  │
│   • 5  category keyword queries  (one per category)         │
│   • 3  NewsData native category fetches (tech/biz/sci)      │
│   • 3  Pakistan supplemental queries                        │
│  ─────────────────────────────────────────────────────────  │
│   TOTAL: ~13 API credits consumed per run                   │
│   LIMIT:  200 credits/day (NewsData.io free plan)           │
│   HEADROOM: 187 credits/day unused                          │
│                                                             │
│  Output: ~70–100 raw articles                               │
│  After global dedup: ~60–80 unique articles (pool)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2 — Global Deduplication  (fetchNewsPool.js)          │
│                                                             │
│  Runs ONCE on the full pool before any user sees it.        │
│  A URL-based Set removes duplicate articles across all       │
│  queries. Every user scores against the SAME clean pool.    │
│                                                             │
│  V1 bug fixed here: V1 used a globalSeenUrls Set inside     │
│  the user loop. User 1 claimed all good URLs first; by      │
│  User 4 most articles were already filtered out.            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3 — Pool Distribution  (distributeArticles.js)        │
│                                                             │
│  Zero additional API calls.                                 │
│                                                             │
│  For each user in parallel (in-memory, not sequential):     │
│   a) Keyword relevance filter (whole-word regex, not        │
│      .includes()) scores every article against 5 category   │
│      keyword lists + hard-exclusion list.                   │
│   b) Tech-anchor check: Global News, Pakistan News, and     │
│      Business articles must contain a tech sector signal.   │
│   c) Articles are sorted: user's own preferred sources      │
│      first, then by relevance score.                        │
│   d) Up to 3 articles per category are taken (15 max).      │
│                                                             │
│  Same article CAN appear in multiple users' digests — this  │
│  is correct. The V1 globalSeenUrls bug that prevented this  │
│  has been removed.                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4 — AI Relevance Filter  (aiRelevanceFilter.js)       │
│                                                             │
│  ⚠️  CHECKPOINT: Prompt wording requires Ibrahim review.    │
│  Do not treat as final until that review has happened.      │
│                                                             │
│  Gemini (gemini-3.1-flash-lite) screens each article with   │
│  clear framing: technology-first firm, keep software /      │
│  hardware / AI / semiconductors / tech M&A / tech funding,  │
│  reject general war / politics / crime / lifestyle.         │
│                                                             │
│  Articles batched in groups of 20 to stay within output     │
│  token budget. Falls back to include-all on quota/error     │
│  so a bad AI response never silently deletes all news.      │
│                                                             │
│  Observed rejection rate: ~15–20% of keyword-filtered set.  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5 — Summarization  (summarizeForUser.js)              │
│                                                             │
│  Gemini (gemini-3.1-flash-lite) writes the per-user         │
│  briefing from the filtered article list. Prompt in         │
│  buildUserPrompt.js enforces category structure, "why       │
│  it matters" lines, and [READ_MORE:N] placeholders.         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6 — Market Data  (fetchStocks.js)                     │
│                                                             │
│  US stocks: Finnhub live API, in-session cache.             │
│  PSX stocks: dps.psx.com.pk HTML scraper (live), with       │
│  static config.json values as fallback per ticker.          │
│  See MARKET_DATA.md for full options analysis.              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7 — Email Assembly + Send                             │
│                                                             │
│  buildEmail.js assembles the multi-user HTML email.         │
│  injectReadMoreLinks.js replaces [READ_MORE:N] with         │
│  real article URLs.                                         │
│  mailer.js sends via SMTP (nodemailer).                     │
│  latest_digest.html saved to data/ for admin preview.       │
└─────────────────────────────────────────────────────────────┘
```

---

## NewsData.io API Limits (Free Plan)

| Limit | Value |
|---|---|
| Credits per day | 200 |
| Credits per request | 1 (regardless of `size`) |
| Max articles per request | 10 (free tier) |
| Max `q` parameter length | 100 characters |
| Rate limit | 30 credits / 15 minutes |

**V2 budget per run: ~13 credits.** This leaves 187 credits/day unused — enough to run the digest ~15 times per day if needed, or to add more query diversity in the future without hitting the limit.

**V1 budget per run: ~24–40+ credits.** The old system fired:
- 1 base domain fetch per user × 4 users = 4 credits
- 5 category queries per user × 4 users = 20 credits
- Up to 5 supplemental fetches per underfilled category = up to 20 more credits

This regularly pushed past the quota boundary mid-run, causing later users and later categories to receive zero articles and triggering the "Limited coverage from selected sources today" fallback text.

---

## Why Later Users No Longer Degrade

In V1, two compounding problems caused progressive quality degradation:

**Problem 1 — API quota exhaustion:** Each user consumed ~6–10 API credits. With 4 users, the run would exhaust the quota partway through, leaving Users 3 and 4 with empty or fallback responses from NewsData.io.

**Problem 2 — globalSeenUrls progressive dedup:** A single `Set` was populated as each user was processed. User 1 claimed all available URLs. By User 4, nearly every article was already in the set and filtered out, even when the API had returned results.

**V2 solution:** One fetch, one dedup, then local distribution. The pool is built and deduplicated before the user loop starts. All four users score against the identical ~70-article pool. User 1 and User 4 get articles from the same input. Processing order has no effect on quality.

---

## Source Registry

Source IDs map to NewsData.io domain strings in `src/sources.js`. Each user in `config.json` lists their preferred source IDs. During distribution, articles from a user's own sources are ranked above supplemental pool articles, so preferences are respected without restricting the candidate set.

NewsData.io caps the `domainurl` parameter at 5 domains per request. The pool fetcher chunks the 9 team domains into batches of 5 to stay within this limit.

---

## Relevance Filter Design

Three layers run in sequence:

1. **Hard exclusion** (distributeArticles.js): Articles containing sports, entertainment, astrology, or specific conflict keywords are dropped immediately. Uses whole-word regex (`\b` boundaries) — not substring matching — to prevent false positives like "ai" matching inside "Ukrainian" or "nato" matching inside "senator".

2. **Category scoring** (distributeArticles.js): Each article is scored against the keyword list for all five categories. It is assigned to its best-scoring category. Articles that score zero in all categories, or score below the category minimum threshold, are dropped. Categories that require a tech anchor (Global News, Pakistan News, Business) additionally require at least one tech-sector signal to prevent general news from slipping through.

3. **AI screening** (aiRelevanceFilter.js): Gemini evaluates the remaining articles with explicit framing for a technology-first firm. This layer catches borderline cases that keyword scoring can't distinguish — for example, a finance article that mentions "technology" once but is really about commodities.

---

## Collaboration Checkpoints

- **Zaid**: Any change to email layout, section rendering, or anything user-facing requires Zaid's review before finalizing.
- **Ibrahim**: Any change to keyword lists, AI screening prompt wording, category definitions, or what counts as "relevant" requires Ibrahim's review before finalizing. The current AI prompt in `aiRelevanceFilter.js` is marked with a checkpoint comment and should not be treated as approved until that review happens.
- **All three** (Haroon, Zaid, Ibrahim): Sign off together before the V2 changes are submitted as done.

---

## File Map

| File | Role |
|---|---|
| `src/fetchNewsPool.js` | Consolidated NewsData.io fetch — fires once per run |
| `src/distributeArticles.js` | Local pool distribution + whole-word keyword relevance |
| `src/aiRelevanceFilter.js` | Gemini-based AI relevance pre-screening pass |
| `src/digestPersonalized.js` | Top-level orchestrator — wires all steps together |
| `src/buildUserPrompt.js` | Constructs the Gemini summarization prompt per user |
| `src/summarizeForUser.js` | Calls Gemini to produce the HTML briefing |
| `src/fetchStocks.js` | US stocks (Finnhub) + PSX stocks (live scraper + fallback) |
| `src/buildEmail.js` | Assembles the multi-user HTML email |
| `src/injectReadMoreLinks.js` | Replaces [READ_MORE:N] placeholders with article URLs |
| `src/mailer.js` | SMTP send via nodemailer |
| `src/sources.js` | Source ID → domain registry |
| `config.json` | User config: sources, PSX stocks, US stocks |
| `config/categories.js` | Legacy category queries (used by digest.js path only) |
| `dry-run.js` | Full pipeline test — no email sent |
| `debug-relevance.js` | Relevance audit only — shows per-article verdicts |
