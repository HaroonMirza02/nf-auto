# Remaining Recommendations

Items not fully solved this sprint, with what would be needed to complete them.

---

## 1. Pakistan News Coverage (Partially Solved)

**Current state:** V2 adds ProPakistani, TechJuice, and Profit Pakistan to the source registry and fires a dedicated domain fetch for those outlets. The Pakistan supplemental queries now use `country: 'pk'` and broader phrasing.

**Remaining problem:** In the dry-run test, Pakistan supplemental queries still returned 0–1 articles. This indicates that ProPakistani, TechJuice, and/or Profit Pakistan may not be indexed in NewsData.io's free-tier catalogue. NewsData.io's free plan covers a subset of their full index.

**What is needed to fully solve it:**
1. Manually verify whether these outlets appear in NewsData.io's index by testing at [newsdata.io/search](https://newsdata.io/search) with domain filters for `propakistani.pk` and `techjuice.pk`
2. If not indexed: implement direct RSS feed fetching for these outlets. Both ProPakistani and TechJuice publish RSS feeds. A small `fetchPakistanRSS.js` module parsing their RSS XML would supplement the NewsData.io pool with 5–10 Pakistan tech articles per day at zero API cost
3. Consider splitting Pakistan News into two categories: Pakistan Technology and Pakistan Business. This would give each a dedicated slot in the digest and prevent the combined category from being crowded out by general Pakistan news

---

## 2. Story Linking — Email Surface Not Implemented

**Current state:** `src/storyLinker.js` computes story links and annotates articles with `storyId` and `relation` fields. The index is persisted to `data/story-index.json`.

**Remaining problem:** Story links are not yet shown in the email. The Gemini prompt in `buildUserPrompt.js` does not reference the `storyId` or `relation` fields, and the email template does not render story thread indicators.

**What is needed to fully solve it:**
1. Update `buildUserPrompt.js` to include story context: when an article has `relation: 'development'` or `relation: 'followup'`, add a line to the article context block saying "This is a follow-up to a story from [date] about [story title]"
2. Update `digestPersonalized.js` to call `linkArticlesToStories()` after distribution and before summarization (see STORY_LINKING_DESIGN.md for the exact integration point)
3. Consider adding a visual "thread" indicator in `buildEmail.js` — a small tag showing "Developing story" or "Follow-up" next to the article summary

**Story index persistence in GitHub Actions:**
The story index file is written to `data/story-index.json` locally, but GitHub Actions environments are ephemeral — the file disappears after each run. To persist the index across daily runs, add a step at the end of the workflow that commits `data/story-index.json` back to the repository:
```yaml
- name: Commit story index
  run: |
    git config user.name "NF Auto Bot"
    git config user.email "nf-auto@vision71tech.com"
    git add data/story-index.json
    git diff --staged --quiet || git commit -m "chore: update story index [skip ci]"
    git push
```

---

## 3. AI Relevance Filter Prompt — Ibrahim Review Pending

**Current state:** The AI screening prompt in `src/aiRelevanceFilter.js` defines what counts as relevant for Vision71. The logic is functional and tested, but the exact wording of the INCLUDE/EXCLUDE criteria has not been reviewed by Ibrahim.

**What is needed:**
- Ibrahim reviews the prompt in `aiRelevanceFilter.js` (the `buildScreeningPrompt` function)
- Pay particular attention to the EXCLUDE list — "general war coverage" and "domestic politics" need to be precise so legitimate tech-policy stories (chip export controls, AI regulation) are not accidentally excluded
- Once reviewed and agreed, remove the `⚠️ CHECKPOINT` comment from the file and this document

---

## 4. Email Layout Review — Zaid Review Pending

**Current state:** The email HTML template in `buildEmail.js` was not changed in V2. The content sections, stock pills, and navigation are the same as V1.

**Pending:**
- Zaid reviews `data/dry-run-preview.html` in a browser
- Confirm the stock pills still render correctly with the new live PSX values
- Confirm the Read More links are working as expected
- Sign off on content section formatting once story linking indicators are added (Recommendation 2 above)

---

## 5. Category Coverage — Global News and Pakistan News Thin

**Current state:** In the dry run, Global News had 1 article per user and Pakistan News had 0. Technology, AI, and Business were well-covered (3 articles each).

**Root cause:** The pool is dominated by CNBC (9 articles) and Bloomberg/Reuters/Seeking Alpha financial content, which scores well for Business and Technology but rarely for Global News (which requires both a "global/international" keyword AND a tech anchor). Pakistan News requires Pakistani geography keywords, which are almost never present in the global pool.

**What is needed:**
1. For Global News: add more international tech policy sources to the source registry — e.g., Nikkei Asia, South China Morning Post (tech section), or Politico Tech. These cover cross-border tech regulation that directly fits the Global News definition.
2. For Pakistan News: RSS supplements (Recommendation 1 above)
3. Alternatively: relax the Global News tech-anchor requirement slightly — a story about chip export controls or AI regulation from a government is tech-relevant even if it doesn't explicitly say "software"

---

## 6. NewsData.io Free Tier Ceiling

**Current state:** V2 uses ~14 credits per run, well within the 200/day limit. However, the free tier caps article size at 10 per request. This means the pool can never exceed ~140 articles from NewsData alone, and in practice returns ~70–100 after deduplication.

**Impact:** For the current 4-user team this is sufficient. If the team grows to 8–10 users with more diverse source preferences, the pool may start to feel thin for niche categories.

**What is needed:** Upgrade to NewsData.io Basic or Professional plan, which allows `size` up to 50 per request. A single pool fetch could then return 500+ raw articles, giving much more filtering headroom. Estimated cost: ~$199/month (Basic plan as of 2026).

---

## 7. Gemini Model Reference in buildEmail.js

`buildEmail.js` contains a hardcoded footer string:
```html
<div>Synthesized using Gemini 3.1 & Node.js</div>
```

This should be updated to reflect the actual model being used (`gemini-3.1-flash-lite`) and ideally be driven by a constant from `summarizeForUser.js` rather than hardcoded. Minor cosmetic issue, but it will become wrong if the model is upgraded.

---

## 8. Haroon / Zaid / Ibrahim Joint Sign-Off

Per the project brief, V2 is not "done" until:
- Ibrahim has reviewed the AI relevance filter prompt (Recommendation 3)
- Zaid has reviewed the email preview (Recommendation 4)
- All three have jointly signed off

The current state of the codebase is committed and testable. The `dry-run.js` script produces a preview HTML that can be reviewed in any browser. Once the above reviews happen and any requested adjustments are made, the work is ready to submit.
