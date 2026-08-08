# Story Linking Design

## Goal

Connect related articles across days so the digest can surface when a story is developing, following up, or resolving — rather than treating each article as isolated. For example: an AI funding round on Monday, a product launch by the same company on Wednesday, and a regulatory response on Friday should be recognizable as the same thread.

---

## Data Model

### Story Record

```json
{
  "storyId": "story_openai_o3_safety_2026",
  "title": "OpenAI o3 safety investigation",
  "createdAt": "2026-08-05T00:00:00Z",
  "updatedAt": "2026-08-08T00:00:00Z",
  "status": "active",
  "category": "AI",
  "keyEntities": ["OpenAI", "o3", "cybersecurity", "safety"],
  "articles": [
    {
      "url": "https://reuters.com/...",
      "title": "OpenAI flags possible critical cybersecurity risk in upcoming model",
      "publishedAt": "2026-08-07",
      "relation": "origin"
    }
  ]
}
```

### Relation Types

| Type | Meaning | Example |
|---|---|---|
| `origin` | The first article to establish this story | "OpenAI flags cybersecurity risk" |
| `development` | Adds new facts to an ongoing story | "OpenAI delays model release pending audit" |
| `followup` | Response or reaction coverage | "Regulators respond to OpenAI safety warning" |
| `consequence` | Downstream effects of the original event | "Competitors pause similar model launches" |
| `resolution` | Story reaches a conclusion | "OpenAI clears model for release after audit" |

### Matching Criteria

An incoming article matches an existing story if it scores above a similarity threshold on a combination of:

1. **Entity overlap** — named organizations, products, and people extracted from title + description
2. **Category match** — same assigned category (or adjacent: AI↔Technology)
3. **Recency** — story must have been active within the last 7 days
4. **Keyword overlap** — at least 2 shared significant keywords (ignoring stopwords)

If no existing story matches above the threshold, the article becomes the `origin` of a new story.

---

## Matching Algorithm (Proof of Concept)

The PoC implemented in `src/storyLinker.js` uses a lightweight local approach:

1. Load the story index from `data/story-index.json` (created on first run)
2. For each incoming article, extract key tokens (title words, length > 4, excluding stopwords)
3. Compute a Jaccard similarity score against each active story's `keyEntities` list
4. If score > 0.25, link the article to that story with the best-fit relation type
5. If score < 0.25 for all stories, create a new story entry
6. Save the updated index back to `data/story-index.json`

### Jaccard Similarity

```
similarity = |tokens_article ∩ tokens_story| / |tokens_article ∪ tokens_story|
```

A score of 0.25 means roughly a quarter of the combined unique tokens are shared — sufficient for a "same story" signal while avoiding false positives between unrelated articles that share common tech words.

### Relation Type Assignment

After a match is confirmed, the relation type is determined by:
- **development**: article is newer than the origin, adds new facts (detected by presence of words like "now", "update", "announces", "launches", "reveals")
- **followup**: article cites or responds to an entity in the matched story (detected by words like "responds", "reacts", "says", "replies", "addresses")
- **consequence**: article describes downstream effects ("impact", "affects", "following", "amid", "in wake of")
- **resolution**: article signals closure ("resolved", "cleared", "approved", "drops", "ends", "cancels")
- Defaults to **development** if none of the above signals are found

---

## Proof of Concept Implementation

See `src/storyLinker.js`. The PoC:
- Maintains a persistent story index in `data/story-index.json`
- Runs after pool distribution, before summarization
- Annotates each article with `storyId` and `relation` fields
- Logs new stories created and links made per run
- Does NOT yet surface story links in the email HTML (that requires a `buildUserPrompt.js` and `buildEmail.js` change, noted in REMAINING_RECOMMENDATIONS.md)

To enable it, add this call in `digestPersonalized.js` after `distributePool`:
```js
const { linkArticlesToStories } = require('./storyLinker');
// After distribution, before per-user loop:
for (const [userId, articles] of userArticleMap) {
    userArticleMap.set(userId, await linkArticlesToStories(articles));
}
```

---

## What Is Not Yet Implemented

1. **Email surface** — story links are computed but not shown in the digest yet. The prompt in `buildUserPrompt.js` would need a new instruction block telling Gemini to note "This is a follow-up to yesterday's story about X" when a `relation` field is present.

2. **Entity extraction** — the PoC uses simple tokenization. A proper implementation would use NER (named entity recognition) to extract people, organizations, and products more reliably. This could be done with a small Gemini call or a local NLP library.

3. **Story expiry** — stories currently stay active for 7 days by a simple date check. A smarter system would close a story when a resolution article is linked or when no new articles have matched for N days.

4. **Cross-category linking** — the PoC only links within the same category. A story can legitimately span categories (e.g., an AI story that becomes a Business story when the company IPOs). This requires relaxing the category match constraint.

5. **Persistence backend** — `data/story-index.json` is a local file. In a multi-server or CI/CD deployment (like the current GitHub Actions setup), this file is ephemeral — it resets on every run. A proper implementation needs the story index stored externally: a small database, a GitHub repo commit, or a cloud key-value store.

---

## Recommended Next Steps

1. Implement entity extraction with a single Gemini call per article batch
2. Add story context to the Gemini summarization prompt
3. Solve story index persistence for the GitHub Actions environment (simplest: commit `data/story-index.json` back to the repo at the end of each run)
4. Review and tune the 0.25 similarity threshold with real data after 2 weeks of runs
