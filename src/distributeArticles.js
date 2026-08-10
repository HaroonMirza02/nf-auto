/**
 * distributeArticles.js — NF Auto V2
 *
 * Takes the pre-fetched article pool (from fetchNewsPool.js) and assigns
 * articles to users. Two requirements must both be satisfied:
 *
 *   1. EVERY CATEGORY MUST BE FILLED FOR EVERY USER.
 *      No user may have an empty category going into summarization. An empty
 *      category results in "No tech-relevant coverage" fallback text in the
 *      digest, which is only acceptable when genuinely no relevant article
 *      exists anywhere in the pool for that category.
 *
 *   2. NO ARTICLE MAY APPEAR IN MORE THAN ONE USER'S DIGEST.
 *      The same story should not repeat across sections. Each article is
 *      assigned to exactly one user. If the pool lacks enough unique articles
 *      to fill every slot exclusively, a category-level fallback allows sharing
 *      within that specific category only — but this is a last resort, not the
 *      default behaviour.
 *
 * Algorithm:
 *   Phase 1 — Score: run the full relevance filter once on the pool.
 *             For each article, compute its score against ALL five categories
 *             (not just the best one) so it can serve as a backup for any
 *             category it qualifies for.
 *   Phase 2 — Assign: for each category, distribute articles across users
 *             round-robin with slot-rotation (slot 0 → user[0] leads,
 *             slot 1 → user[1] leads, etc.) so no user always gets first pick.
 *             A global claimed Set ensures each article goes to one user only.
 *   Phase 3 — Gap fill: any user missing a category gets the highest-scoring
 *             unclaimed article that qualifies for that category, even if it
 *             means sharing with another user (last resort only).
 *
 * V2 fixes:
 *   - Whole-word regex (\b) replacing .includes() substring matching.
 *     Prevents "ai" matching inside "Ukrainian", "nato" inside "senator", etc.
 *   - globalSeenUrls progressive dedup bug removed.
 *   - Per-category slot rotation so no user is consistently last in line.
 */

const { CATEGORIES } = require('./fetchNewsPool');

// ─── Keyword lists ───────────────────────────────────────────────────────────

const EXCLUDE_KEYWORDS = [
    // Sports
    'cricket', 'football', 'soccer', 'basketball', 'tennis', 'golf', 'rugby',
    'world cup', 'fifa', 'uefa', 'premier league', 'nba', 'nfl', 'nhl', 'mlb',
    'formula 1', 'f1 race', 'olympics', 'athlete', 'goalkeeper', 'striker',
    'midfielder', 'match result', 'knockout stage', 'batting', 'bowling',
    'wicket', 'innings', 'odi', 't20',
    // Entertainment / Lifestyle
    'showbiz', 'celebrity', 'bollywood', 'hollywood', 'actor', 'actress',
    'box office', 'music concert', 'fashion week', 'recipe',
    'drama series', 'wedding', 'gossip', 'reality show', 'award show',
    'oscar', 'grammy', 'emmy',
    // Conflict noise (backstop; AI filter is the primary guard)
    'airstrike', 'missile strike', 'ceasefire', 'insurgent', 'militant attack',
    // Junk
    'horoscope', 'astrology', 'zodiac', 'cagr', 'market projected',
    'recruitment process', 'job openings', 'career opportunities',
    'we are hiring', 'join our team'
];

const CATEGORY_KEYWORDS = {
    'Global News': [
        // Scope words
        'global', 'world', 'international', 'cross-border', 'worldwide',
        'multinational', 'countries', 'nations', 'geopolitics', 'diplomatic',
        // Policy & regulatory
        'policy', 'regulation', 'legislation', 'law', 'treaty', 'agreement',
        'united nations', 'nato', 'sanctions', 'trade war', 'tariff',
        'bilateral', 'foreign minister', 'state department', 'g7', 'g20',
        'chip export', 'export control', 'tech regulation', 'digital trade',
        'government', 'authorities', 'parliament', 'congress', 'senate',
        // Regional tech signals that are inherently global
        'taiwan', 'tsmc', 'south korea', 'samsung', 'eu', 'europe',
        'uae', 'gulf', 'middle east', 'india', 'china', 'japan'
    ],
    'Pakistan News': [
        'pakistan', 'islamabad', 'karachi', 'lahore', 'peshawar', 'quetta',
        'psx', 'sbp', 'rupee', 'pta', 'ptcl', 'secp', 'nepra', 'ogra',
        'sindh', 'punjab', 'khyber', 'balochistan'
    ],
    Technology: [
        'technology', 'tech', 'software', 'hardware', 'cybersecurity',
        'chip', 'semiconductor', 'digital', 'startup', 'saas',
        'developer', 'open source', 'quantum', 'robotics',
        'satellite', 'data center', '5g', '6g', 'broadband',
        'encryption', 'cloud', 'cyber', 'computing', 'platform',
        'app', 'device', 'network', 'internet', 'infrastructure'
    ],
    AI: [
        'artificial intelligence', 'machine learning', 'deep learning', 'llm',
        'large language model', 'generative ai', 'chatbot', 'openai', 'gemini',
        'claude', 'gpt', 'neural network', 'computer vision', 'nlp',
        'ai model', 'ai agent', 'ai chip', 'nvidia',
        'foundation model', 'ai regulation', 'ai safety',
        'anthropic', 'mistral', 'diffusion model', 'transformer',
        'reinforcement learning', 'ai'
    ],
    Business: [
        'venture capital', 'private equity', 'ipo', 'acquisition', 'merger',
        'earnings', 'revenue', 'funding', 'valuation', 'unicorn', 'investment',
        'stocks', 'nasdaq', 'market cap', 'shares', 'profit', 'loss',
        'quarterly', 'annual results', 'layoffs', 'hiring', 'partnership',
        'deal', 'finance', 'economy', 'investors', 'shareholders', 'trading',
        'markets', 'growth', 'forecast', 'outlook'
    ]
};

const TECH_ANCHOR_KEYWORDS = [
    'technology', 'tech', 'artificial intelligence', 'ai', 'software', 'hardware',
    'digital', 'startup', 'platform', 'internet', 'cyber', 'cybersecurity',
    'data', 'cloud', 'chip', 'semiconductor', 'automation', 'robotics',
    'innovation', 'telecom', 'fintech', 'e-commerce', 'broadband', '5g',
    'blockchain', 'saas', 'developer', 'api', 'iot', 'llm',
    'nvidia', 'microsoft', 'google', 'apple', 'amazon', 'meta', 'openai',
    'anthropic', 'tesla', 'salesforce', 'oracle', 'intel', 'amd', 'qualcomm',
    'spacex', 'netflix', 'uber', 'airbnb',
    'computing', 'network', 'infrastructure', 'device', 'operating system',
    'encryption', 'quantum', 'satellite'
];

const REQUIRES_TECH_ANCHOR = {
    'Global News':   true,
    'Pakistan News': true,
    Technology:      false,
    AI:              false,
    Business:        true
};

const CATEGORY_MIN_SCORE = {
    'Global News':   1,
    'Pakistan News': 1,
    Technology:      1,
    AI:              1,
    Business:        1
};

const MAX_PER_CATEGORY = 3;  // max articles per category per user

const BANNED_DOMAINS = [
    'openpr.com', 'einnews.com', 'bringatrailer.com', 'cyclingnews.com',
    'cred.club'
];

// ─── Regex helpers ────────────────────────────────────────────────────────────

const _regexCache = new Map();

function kwRegex(keyword) {
    if (_regexCache.has(keyword)) return _regexCache.get(keyword);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    _regexCache.set(keyword, re);
    return re;
}

function matchesAny(text, keywords) {
    return keywords.some(kw => kwRegex(kw).test(text));
}

function countMatches(text, keywords) {
    return keywords.reduce((n, kw) => n + (kwRegex(kw).test(text) ? 1 : 0), 0);
}

// ─── Article scoring ──────────────────────────────────────────────────────────

const SOURCES = require('./sources');

function isFromUserSource(article, userSources) {
    const url = (article.url || '').toLowerCase();
    return userSources.some(id => {
        const domain = SOURCES[id]?.domain;
        return domain && url.includes(domain);
    });
}

/**
 * Returns the relevance score of an article for a specific category,
 * or 0 if it doesn't qualify (fails exclusion, tech anchor, or min score).
 *
 * Unlike V1 where each article had one assigned category, here we score
 * against any requested category so an article can serve as backup for
 * multiple categories during gap-filling.
 */
function scoreForCategory(article, category) {
    const text = `${article.title} ${article.description}`;
    const lower = text.toLowerCase();

    // Banned domain
    const url = (article.url || '').toLowerCase();
    if (BANNED_DOMAINS.some(d => url.includes(d))) return 0;

    // Hard exclusion (whole-word)
    if (EXCLUDE_KEYWORDS.some(kw => kwRegex(kw).test(text))) return 0;

    // Category score (whole-word)
    const score = countMatches(text, CATEGORY_KEYWORDS[category] || []);
    if (score < (CATEGORY_MIN_SCORE[category] || 1)) return 0;

    // Tech anchor for non-tech-inherent categories
    if (REQUIRES_TECH_ANCHOR[category] && !matchesAny(text, TECH_ANCHOR_KEYWORDS)) return 0;

    return score;
}

/**
 * Returns the best primary category for an article (highest score across all
 * five categories), or null if it doesn't qualify for any.
 */
function bestCategory(article) {
    let best = null;
    let bestScore = 0;
    for (const cat of CATEGORIES) {
        const s = scoreForCategory(article, cat);
        if (s > bestScore) { bestScore = s; best = cat; }
    }
    return best ? { category: best, score: bestScore } : null;
}

// ─── Distribution ─────────────────────────────────────────────────────────────

/**
 * Distributes the pool to all users.
 *
 * Guarantees:
 *   - Every category is attempted for every user.
 *   - Each article is assigned to at most one user (exclusive by default).
 *   - If a category has too few unique articles to fill all users, the
 *     category-level fallback shares the best available article rather than
 *     leaving a user's category empty.
 *
 * @param {object[]} users
 * @param {object[]} pool
 * @param {boolean}  debugMode
 * @returns {Map<string, object[]>}  user.id → article[]
 */
function distributePool(users, pool, debugMode = false) {
    console.log(
        `[distributeArticles] Distributing ${pool.length}-article pool to ` +
        `${users.length} users (cross-user dedup, all categories guaranteed)...`
    );

    // --- Phase 1: Score every article against its best category ---
    const scored = [];
    let excluded = 0;
    for (const article of pool) {
        const result = bestCategory(article);
        if (result) {
            scored.push({ ...article, assignedCategory: result.category, _score: result.score });
        } else {
            excluded++;
        }
    }

    if (debugMode) {
        console.log(`[distributeArticles] ${scored.length} passed filter, ${excluded} excluded`);
    } else {
        console.log(`[distributeArticles] ${scored.length} articles passed relevance filter`);
    }

    // Group by primary category
    const byCat = {};
    for (const cat of CATEGORIES) byCat[cat] = [];
    for (const a of scored) byCat[a.assignedCategory].push(a);

    // --- Phase 2: Exclusive round-robin assignment per category ---
    const claimed     = new Set();  // URLs claimed across all users
    const userBuckets = new Map();  // user.id → { cat → article[] }
    for (const user of users) {
        userBuckets.set(user.id, Object.fromEntries(CATEGORIES.map(c => [c, []])));
    }

    for (const cat of CATEGORIES) {
        // Per-user ranked list: own-source articles first, then by score
        const ranked = users.map(user => ({
            user,
            list: [...byCat[cat]].sort((a, b) => {
                const ao = isFromUserSource(a, user.sources) ? 1 : 0;
                const bo = isFromUserSource(b, user.sources) ? 1 : 0;
                if (bo !== ao) return bo - ao;
                return b._score - a._score;
            })
        }));

        // Fill MAX_PER_CATEGORY slots, rotating which user gets first pick
        for (let slot = 0; slot < MAX_PER_CATEGORY; slot++) {
            const start = slot % users.length;
            const order = [...ranked.slice(start), ...ranked.slice(0, start)];
            for (const { user, list } of order) {
                const bucket = userBuckets.get(user.id)[cat];
                if (bucket.length >= MAX_PER_CATEGORY) continue;
                const pick = list.find(a => !claimed.has(a.url));
                if (pick) {
                    claimed.add(pick.url);
                    bucket.push(pick);
                    if (debugMode) {
                        console.log(`[dist] ${cat} slot${slot + 1} → ${user.id}: "${pick.title.substring(0, 50)}"`);
                    }
                }
            }
        }

        // Log per-category coverage
        const fills = users.map(u => `${u.id}:${userBuckets.get(u.id)[cat].length}`).join(' ');
        console.log(`[distributeArticles] ${cat} — ${fills}`);
    }

    // --- Phase 3: Gap fill ---
    // Any user with 0 articles in a category gets the best available article
    // for that category, even if it means sharing it with another user.
    // This is the last-resort fallback to satisfy "every category must be filled".
    for (const cat of CATEGORIES) {
        for (const user of users) {
            const bucket = userBuckets.get(user.id)[cat];
            if (bucket.length > 0) continue;

            // Try unclaimed first
            const allForCat = [...byCat[cat]].sort((a, b) => b._score - a._score);
            const unclaimed = allForCat.find(a => !claimed.has(a.url));
            if (unclaimed) {
                claimed.add(unclaimed.url);
                bucket.push({ ...unclaimed, _sharedFallback: true });
                console.log(
                    `[distributeArticles] GAP FILL (unique) ${cat} → ${user.id}: ` +
                    `"${unclaimed.title.substring(0, 60)}"`
                );
                continue;
            }

            // Nothing unclaimed — try scoring the full pool for this category
            // even if article was already assigned to another user (shared fallback)
            const anyQualified = pool
                .map(a => ({ a, s: scoreForCategory(a, cat) }))
                .filter(x => x.s > 0)
                .sort((x, y) => y.s - x.s)[0];

            if (anyQualified) {
                const article = anyQualified.a;
                bucket.push({
                    ...article,
                    assignedCategory: cat,
                    _score:           anyQualified.s,
                    _sharedFallback:  true
                });
                console.log(
                    `[distributeArticles] GAP FILL (shared) ${cat} → ${user.id}: ` +
                    `"${article.title.substring(0, 60)}"`
                );
            } else {
                // Genuinely no relevant article for this category today
                console.warn(
                    `[distributeArticles] NO ARTICLES for ${cat}/${user.id} — ` +
                    `pool has no qualifying content for this category today`
                );
            }
        }
    }

    // --- Build final output ---
    const result = new Map();
    for (const user of users) {
        const buckets   = userBuckets.get(user.id);
        const articles  = CATEGORIES.flatMap(cat => buckets[cat]);
        const catCounts = CATEGORIES.map(c => `${c.replace(' News','').replace('hnology','ch')}:${buckets[c].length}`).join(' ');
        console.log(`[distributeArticles:${user.id}] ${articles.length} articles [${catCounts}]`);
        result.set(user.id, articles);
    }

    return result;
}

module.exports = {
    distributePool,
    scoreForCategory,
    bestCategory,
    CATEGORIES,
    CATEGORY_KEYWORDS,
    EXCLUDE_KEYWORDS,
    TECH_ANCHOR_KEYWORDS,
    MAX_PER_CATEGORY
};
