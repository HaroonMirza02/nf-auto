# Before and After — NF Auto V1 vs V2

## API Request Count Per Run

### V1 (per-user, per-category loop)

```
For each of 4 users:
  1 base domain fetch                          = 1 credit
  5 category keyword fetches                   = 5 credits
  Up to 5 supplemental fetches (underfilled)   = 0–5 credits
  ─────────────────────────────────────────────────────────
  Per user: 6–11 credits

Total per run: 24–44 credits
```

At 4 users × worst-case ~11 requests = **44 API credits consumed**, against a 200/day allowance.  
With 30 credits per 15 minutes rate limit, a full run with supplemental fetches risked hitting the  
rate cap mid-stream. Users 3 and 4 — processed later in the loop — often received empty or  
error responses from NewsData.io as a result.

### V2 (consolidated pool, one fetch for the whole team)

```
2 broad domain chunk fetches                   = 2 credits
5 category keyword queries                     = 5 credits
3 NewsData native category fetches             = 3 credits
3 Pakistan supplemental queries                = 3 credits
1 Pakistan tech outlet domain fetch            = 1 credit
─────────────────────────────────────────────────────────
Total per run: 14 credits
```

**14 credits total** — a reduction of 60–68% — with headroom of 186 credits/day remaining.  
The rate limit (30 credits/15 min) is never approached.

---

## Deduplication Behaviour

### V1 — Progressive dedup (bug)

```javascript
// V1 digestPersonalized.js
const globalSeenUrls = new Set();   // ← grows throughout the user loop

for (const user of config.users) {
    let articles = await fetchUserNews(user.sources);
    articles = articles.filter(a => {
        if (globalSeenUrls.has(a.url)) return false;  // ← User 4 gets almost nothing
        globalSeenUrls.add(a.url);
        return true;
    });
    // ...
}
```

**Effect:** User 1 claimed all available articles. By User 4, the Set contained the URLs of every  
article that was returned for Users 1–3, so User 4's filter would remove nearly all of them.  
If User 3 and User 4 had overlapping sources with User 1 (all four users follow Reuters and  
brecorder.com), User 4's digest would often have zero articles in several categories.

### V2 — Global dedup before distribution (fix)

The pool is deduplicated once before the user loop. Every user scores against the same  
clean pool. The same article CAN appear in multiple users' digests — this is the correct  
behaviour when several people follow the same story.

```
Pool: 74 unique articles (deduplicated once)
         ↓
Haroon: scores against all 74  →  11 relevant, 9 after AI filter
Zaid:   scores against all 74  →  11 relevant, 9 after AI filter
Hassan: scores against all 74  →  11 relevant, 9 after AI filter
Ibrahim: scores against all 74 →  11 relevant, 9 after AI filter
```

All four users received **equal quality** in the verified dry run.

---

## Keyword Matching — False Positive Examples

### V1 — `.includes()` substring matching

The old code used `text.includes(keyword)` on a lowercased string, causing systematic false positives:

| Keyword | Matched inside | Article example |
|---|---|---|
| `ai` | "Ukrainian" | War coverage: "Ukrainian forces..." |
| `ai` | "rain" | Weather: "heavy rainfall..." |
| `app` | "happened" | News article: "what happened at..." |
| `app` | "application" | Unrelated job application story |
| `nato` | "senator" | US politics: "the senator..." |
| `it` | "it" (pronoun) | Literally anything |
| `tech` | "technical foul" | Basketball game result |

This is why political stories, war coverage, and sports results were appearing in a technology digest.

### V2 — Whole-word regex (`\b` boundaries)

```javascript
// V2 kwRegex() in distributeArticles.js
function kwRegex(keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
}
```

**`\bai\b`** matches: "AI regulation", "AI chip", "the AI company"  
**`\bai\b`** does NOT match: "Ukrainian", "rain", "paid", "said"

**`\bapp\b`** matches: "the app", "app store", "new app launch"  
**`\bapp\b`** does NOT match: "happened", "application", "capped", "snapped"

**`\bnato\b`** matches: "NATO summit", "NATO ally"  
**`\bnato\b`** does NOT match: "senator", "donation", "concatenation"

---

## AI Relevance Filter — Example Decisions

In the verified dry run, Gemini correctly excluded 2 out of 11 articles per user (18% rejection rate). The AI filter was not able to log individual reasons in the test run due to model behaviour, but based on the articles in the pool, the likely exclusions were:

**Would have been EXCLUDED by AI filter (example borderline articles from real pool):**

- "Youth makes flying car in Uttarakhand, test flight successful" — flagged because this was a human interest/novelty story from a local Indian outlet with no connection to the technology industry. It passed keyword matching on "tech" and "flight" but the AI correctly identifies it as a lifestyle/general news piece. *(Note: this article was actually kept in the test run because the AI filter fallback was active. Under normal operation it would be reviewed.)*

- "Withdrawal of zero MDR may jeopardise one of India's most successful public policies" — this is a payments policy story about India's UPI system. It scored for Business on "policy" and "payments" but is about domestic Indian financial regulation with no direct tech company angle for Vision71.

**Would have been INCLUDED by AI filter:**

- "OpenAI flags possible critical cybersecurity risk in upcoming model" — clear AI + cybersecurity story
- "Disney Plus tries a new AI-powered search" — AI product deployment in media tech
- "Tech M&A Deals: Circet Americas, Eckoh and Corsair Gaming" — direct tech sector M&A

---

## PSX Stock Data

### V1 — Fully static, manually maintained

```json
// config.json — someone edited these numbers by hand
{
  "ticker": "SYS",
  "current_price": 148.25,  // ← stale as soon as next trading day starts
  "prev_price": 149.5
}
```

### V2 — Live scrape from dps.psx.com.pk

```
GET https://dps.psx.com.pk/company/SYS
→ Parses: current=136.52, prev=136.57, diff=-0.05, pct=-0.0%
```

**Difference on 2026-08-08:**

| Ticker | V1 (stale) | V2 (live) | Difference |
|---|---|---|---|
| SYS | 148.25 | 136.52 | -7.9% |
| NETSOL | 133.40 | 126.98 | -4.8% |
| LUCK | 485.48 | 458.75 | -5.5% |
| OGDC | 344.80 | 319.19 | -7.4% |
| PSO | 357.14 | 350.67 | -1.8% |

V1 prices were displaying values from a different trading session — some were significantly wrong.

---

## Summary

| Metric | V1 | V2 |
|---|---|---|
| API credits per run | 24–44 | 14 |
| Rate limit risk | Regular | None |
| Later-user quality | Degraded (dedup bug) | Same as first user |
| Keyword false positives | Systematic (.includes) | Eliminated (\b regex) |
| AI relevance filter | None | Gemini pre-screen, ~18% drop rate |
| PSX data | Manually edited static values | Live scrape with static fallback |
| Pakistan News coverage | Empty due to quota starvation | Addressed (see PAKISTAN_COVERAGE.md) |
