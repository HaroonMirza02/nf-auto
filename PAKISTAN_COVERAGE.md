# Pakistan Coverage — Root Cause and Fix

## Problem

The Pakistan News category consistently showed "Limited coverage from selected sources today" or "No tech-relevant coverage from today's sources" while other categories had content. This happened across all four users on most runs.

## Root Cause Analysis

Three separate problems stacked on top of each other:

### 1. API quota exhaustion (primary cause — now fixed by V2 pool design)

V1 fetched news per user, per category, sequentially. With 4 users × 6 NewsData.io requests each, the run consumed 24–40+ API credits. NewsData.io's free plan allows 200 credits/day, but the rate limit is 30 credits per 15 minutes. On runs that hit the rate cap mid-stream, the Pakistan News fetch — coming later in the per-user loop — would return empty or fail silently.

This is the single biggest contributor to Pakistan News being empty. It affected Users 3 and 4 most severely.

**Fix:** V2's consolidated pool fetch runs 14 requests total for the entire team. Rate cap is never reached. See ARCHITECTURE.md for the full credit budget.

### 2. No Pakistan-specific tech outlets in the domain list

The Pakistan sources registered in `sources.js` were general news outlets: Dawn, Business Recorder, Express Tribune, ARY News, Geo News, The News. These publish a mix of politics, crime, sports, and business — with only occasional tech coverage. None of them are dedicated Pakistan technology or startup outlets.

The broad domain fetches pulled mostly non-tech Pakistan news that was then correctly filtered out by the relevance engine, leaving nothing for Pakistan News.

**Fix (V2):** Three Pakistan tech outlets added to `sources.js`:
- **ProPakistani** (`propakistani.pk`) — Pakistan's most active technology news publication covering startups, telecom, fintech, and digital policy
- **TechJuice** (`techjuice.pk`) — Dedicated Pakistan tech and startup news
- **Profit by Pakistan Today** (`profit.pakistantoday.com.pk`) — Pakistan business and technology analysis

These are also fetched with a dedicated domain-targeted request in `fetchNewsPool.js` so they always get a slot regardless of how general domain chunks are ordered.

### 3. Supplemental query terms were too narrow or wrong language

The V1 Pakistan supplemental queries were:
```
"Pakistan business economy startup digital"
"Pakistan fintech banking SBP SECP"
"Pakistan IT export software Lahore Karachi"
```

The first two queries consistently returned 0–1 results. The issue was that these multi-word phrase queries were too specific — NewsData.io's free-tier query matching requires articles to contain the exact phrase or at least most words together. Articles from Pakistani outlets often phrase topics as "tech sector in Pakistan" or "digital transformation Pakistan" rather than matching the exact query strings used.

**Fix (V2):** Replaced with broader AND-style queries:
```
"Pakistan technology startup fintech digital"
"Pakistan software IT export SBP economy"
"Pakistan telecom broadband 5G internet"
```

All three also use `country: 'pk'` to restrict to Pakistani news sources, which increases Pakistan-specific content without over-constraining the query terms.

## What Was Implemented

1. Added ProPakistani, TechJuice, and Profit Pakistan to `sources.js`
2. Added a dedicated Pakistan tech outlet domain fetch in `fetchNewsPool.js` — fires regardless of other queries, always contributes Pakistan tech articles to the pool
3. Updated the 3 Pakistan supplemental queries with broader, more natural phrasing
4. The consolidated pool design (Task 1) eliminates the quota-starvation root cause entirely

## Expected Improvement

In the first dry run after these changes, the Pakistan supplemental queries returned 0–1 articles because ProPakistani/TechJuice/Profit Pakistan may not yet have matching articles in NewsData.io's index for those specific query terms. However, the dedicated domain fetch for those outlets should return their most recent 10 articles regardless of keywords, which are then scored by the local relevance engine.

**If Pakistan News remains empty after these changes:** the genuine root cause is that Pakistani tech news outlets are underrepresented in NewsData.io's free-tier index. The practical next step is for a team member (Ibrahim or Haroon) to verify whether ProPakistani and TechJuice articles appear at all when queried manually at newsdata.io/search — if they don't, the outlet is not indexed, and the solution is a different news provider or a direct RSS/scraper approach for those domains.

## Remaining Work

- Verify that ProPakistani, TechJuice, and Profit Pakistan are indexed in NewsData.io by testing manually
- If not indexed: evaluate RSS feed scraping for these outlets as a direct supplement (see REMAINING_RECOMMENDATIONS.md)
- The Pakistan News category structure could be split into Pakistan Technology and Pakistan Business as separate categories — this would allow more granular coverage and is recommended if the team wants that level of separation
