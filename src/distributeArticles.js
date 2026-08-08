/**
 * distributeArticles.js — NF Auto V2
 *
 * Takes the pre-fetched article pool (from fetchNewsPool.js) and distributes
 * articles to each user based on their configured sources and the five fixed
 * categories. Zero additional API calls are made here.
 *
 * KEY V2 FIX — Progressive deduplication bug:
 *   The V1 system kept a single `globalSeenUrls` Set that was filled as each
 *   user was processed. User 1 claimed the best articles; by the time User 4
 *   was processed, most good URLs were already in the set and filtered out.
 *   V2 deduplicates the pool ONCE (in fetchNewsPool.js) before distribution.
 *   Every user then scores against the FULL deduplicated pool. The per-user
 *   output is still deduplicated (no article appears twice for one user), but
 *   the same article CAN appear in multiple users' digests — which is correct
 *   behaviour when several users legitimately follow the same story.
 *
 * KEY V2 FIX — Word-boundary matching:
 *   V1 used `text.includes(keyword)`, which causes false positives:
 *     "ai"   → matches inside "Ukrainian", "rain", "paid"
 *     "app"  → matches inside "happened", "application", "capped"
 *     "nato" → matches inside "senator", "donation"
 *   V2 uses regex word-boundary anchors (\b) for all keyword checks so only
 *   whole-word occurrences trigger a match.
 */

const { CATEGORIES } = require('./fetchNewsPool');

// ─── Keyword lists ───────────────────────────────────────────────────────────

/**
 * Hard-exclusion terms. An article matching ANY of these is dropped regardless
 * of category score. All matching uses whole-word regex (see matchesAny below).
 */
const EXCLUDE_KEYWORDS = [
    // Sports
    'cricket', 'football', 'soccer', 'basketball', 'tennis', 'golf', 'rugby',
    'world cup', 'fifa', 'uefa', 'premier league', 'nba', 'nfl', 'nhl', 'mlb',
    'formula 1', 'f1 race', 'olympics', 'athlete', 'goalkeeper', 'striker',
    'midfielder', 'squad', 'match result', 'knockout stage', 'tournament',
    'batting', 'bowling', 'wicket', 'innings', 'odi', 't20',
    // Entertainment / Lifestyle
    'showbiz', 'celebrity', 'bollywood', 'hollywood', 'actor', 'actress',
    'box office', 'album', 'music concert', 'fashion week',
    'recipe', 'lifestyle', 'drama series', 'wedding', 'gossip',
    'reality show', 'award show', 'oscar', 'grammy', 'emmy',
    // General conflict noise (kept as backstop; AI filter is the main guard)
    'airstrike', 'missile strike', 'ceasefire',
    'insurgent', 'militant attack',
    // Junk content
    'horoscope', 'astrology', 'zodiac',
    'market size report', 'cagr', 'market projected',
    'press release', 'hiring now', 'job vacancy'
];

/**
 * Category-specific scoring keywords.
 * Matching is whole-word (see matchesAny / scoreArticleForCategory below).
 */
const CATEGORY_KEYWORDS = {
    'Global News': [
        'global', 'world', 'international', 'geopolitics', 'diplomatic', 'policy',
        'united nations', 'un summit', 'nato', 'sanctions', 'trade war', 'tariff',
        'bilateral', 'foreign minister', 'state department', 'g7', 'g20',
        'chip export', 'export control', 'tech regulation', 'digital trade'
    ],
    'Pakistan News': [
        'pakistan', 'islamabad', 'karachi', 'lahore', 'peshawar', 'quetta',
        'psx', 'sbp', 'state bank of pakistan', 'imf pakistan', 'rupee', 'pta',
        'ptcl', 'secp', 'ecc', 'federal budget', 'nepra', 'ogra',
        'sindh', 'punjab', 'khyber', 'balochistan',
        'pakistan tech', 'pakistan startup', 'pakistan fintech',
        'pakistan digital', 'pakistan telecom', 'pakistan it',
        'pakistan business', 'pakistan economy', 'pakistan investment'
    ],
    Technology: [
        'technology', 'software', 'hardware', 'cloud computing', 'cybersecurity',
        'chip', 'semiconductor', 'digital transformation', 'startup', 'saas',
        'api', 'developer', 'open source', 'quantum computing', 'robotics',
        'drone technology', 'satellite', 'data center', '5g', '6g',
        'fiber optic', 'broadband', 'encryption', 'zero trust', 'devops',
        'kubernetes', 'microservices', 'edge computing', 'iot'
    ],
    AI: [
        'artificial intelligence', 'machine learning', 'deep learning', 'llm',
        'large language model', 'generative ai', 'chatbot', 'openai', 'gemini',
        'claude', 'gpt', 'neural network', 'computer vision', 'nlp',
        'natural language processing', 'ai model', 'ai agent', 'ai chip',
        'nvidia ai', 'foundation model', 'ai regulation', 'ai safety',
        'anthropic', 'mistral', 'diffusion model', 'transformer model',
        'reinforcement learning', 'ai ethics', 'ai governance'
    ],
    Business: [
        'venture capital', 'private equity', 'series a', 'series b', 'series c',
        'ipo', 'acquisition', 'merger', 'tech earnings', 'tech revenue',
        'funding round', 'valuation', 'unicorn', 'tech investment',
        'tech stocks', 'nasdaq', 'software revenue', 'cloud revenue',
        'tech layoffs', 'tech hiring', 'tech partnership', 'joint venture',
        'market cap', 'quarterly earnings'
    ]
};

/**
 * Tech-anchor keywords: a non-tech article in Global News, Pakistan News, or
 * Business must contain at least one of these to qualify. This prevents a
 * general economics, war, or politics story from slipping through just because
 * it mentions "world" or "market."
 */
const TECH_ANCHOR_KEYWORDS = [
    'technology', 'tech', 'artificial intelligence', 'software', 'hardware',
    'digital', 'startup', 'platform', 'internet', 'cyber', 'cybersecurity',
    'data', 'cloud', 'chip', 'semiconductor', 'automation', 'robotics',
    'innovation', 'telecom', 'fintech', 'e-commerce', 'broadband', '5g',
    'blockchain', 'saas', 'developer', 'api', 'iot', 'app', 'llm', 'ai model'
];

const REQUIRES_TECH_ANCHOR = {
    'Global News':    true,
    'Pakistan News':  true,
    Technology:       false,
    AI:               false,
    Business:         true
};

const CATEGORY_MIN_SCORE = {
    'Global News':    1,
    'Pakistan News':  1,
    Technology:       1,
    AI:               2,   // needs at least 2 hits to avoid weak matches
    Business:         1
};

// Max articles per category per user in the final output
const MAX_PER_CATEGORY = 3;

// ─── Regex helpers ───────────────────────────────────────────────────────────

// Cache compiled regexes to avoid re-compiling on every article
const _regexCache = new Map();

/**
 * Returns a word-boundary regex for a keyword.
 * Multi-word phrases use \b on the outer edges only (space between words is
 * not a word-boundary issue for phrases, but the start and end of the phrase
 * must land on a word boundary).
 */
function kwRegex(keyword) {
    if (_regexCache.has(keyword)) return _regexCache.get(keyword);
    // Escape special regex chars in the keyword, then wrap in \b...\b
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    _regexCache.set(keyword, re);
    return re;
}

/**
 * Returns true if the text contains at least one whole-word match for any
 * keyword in the list.
 */
function matchesAny(text, keywords) {
    return keywords.some(kw => kwRegex(kw).test(text));
}

/**
 * Returns the count of keywords in the list that appear as whole words in text.
 */
function countMatches(text, keywords) {
    return keywords.reduce((n, kw) => n + (kwRegex(kw).test(text) ? 1 : 0), 0);
}

// ─── Relevance logic ─────────────────────────────────────────────────────────

/**
 * Returns a relevance verdict for one article.
 *
 * @param {object} article
 * @param {boolean} debug  - When true, returns a detailed reason string
 * @returns {{ include: boolean, reason: string, category: string|null, score: number }}
 */
function scoreArticle(article, debug = false) {
    const text = `${article.title} ${article.description}`.toLowerCase();

    // 1. Hard exclusion
    for (const kw of EXCLUDE_KEYWORDS) {
        if (kwRegex(kw).test(text)) {
            return {
                include:  false,
                reason:   `EXCLUDED: hard-exclude keyword "${kw}" matched (whole-word)`,
                category: null,
                score:    0
            };
        }
    }

    // 2. Find best-scoring category
    let bestCategory = null;
    let bestScore    = 0;
    const scores     = {};

    for (const category of CATEGORIES) {
        const score = countMatches(text, CATEGORY_KEYWORDS[category]);
        scores[category] = score;
        if (score > bestScore) {
            bestCategory = category;
            bestScore    = score;
        }
    }

    if (!bestCategory || bestScore < 1) {
        return {
            include:  false,
            reason:   debug
                ? `EXCLUDED: no category matched (scores: ${JSON.stringify(scores)})`
                : 'EXCLUDED: no category matched',
            category: null,
            score:    0
        };
    }

    // 3. Category minimum score threshold
    const minScore = CATEGORY_MIN_SCORE[bestCategory] || 1;
    if (bestScore < minScore) {
        return {
            include:  false,
            reason:   `EXCLUDED: score ${bestScore} below minimum ${minScore} for ${bestCategory}`,
            category: bestCategory,
            score:    bestScore
        };
    }

    // 4. Tech anchor check for categories that require it
    if (REQUIRES_TECH_ANCHOR[bestCategory] && !matchesAny(text, TECH_ANCHOR_KEYWORDS)) {
        return {
            include:  false,
            reason:   `EXCLUDED: no tech anchor for ${bestCategory} category (whole-word check)`,
            category: bestCategory,
            score:    bestScore
        };
    }

    return {
        include:  true,
        reason:   debug
            ? `INCLUDED: category=${bestCategory}, score=${bestScore}, scores=${JSON.stringify(scores)}`
            : `INCLUDED: ${bestCategory} (score ${bestScore})`,
        category: bestCategory,
        score:    bestScore
    };
}

// ─── Source matching ─────────────────────────────────────────────────────────

const SOURCES = require('./sources');

/**
 * Returns true if an article's source domain matches one of the user's
 * configured source IDs. Used to weight articles from preferred sources higher
 * during sorting, not as a hard filter (the pool may also contain articles from
 * supplemental category queries that aren't domain-restricted).
 */
function isFromUserSource(article, userSources) {
    const articleDomain = (article.url || '').toLowerCase();
    return userSources.some(srcId => {
        const domain = SOURCES[srcId]?.domain;
        return domain && articleDomain.includes(domain);
    });
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Filters and distributes the article pool to a single user.
 *
 * Steps:
 *   1. Run keyword relevance filter on the full pool (whole-word matching).
 *   2. Stamp each surviving article with its best category.
 *   3. Sort each category's articles: user's own sources first, then by score.
 *   4. Take up to MAX_PER_CATEGORY per category.
 *   5. Dedup within the user's own output (same article can't appear twice for
 *      one user even if it scored for two categories).
 *
 * @param {object}   user        - User config object from config.json
 * @param {object[]} pool        - Full deduplicated article pool
 * @param {boolean}  debugMode   - Emit per-article relevance audit to console
 * @returns {object[]}           - Articles for this user (with assignedCategory)
 */
function distributeToUser(user, pool, debugMode = false) {
    const label = `[distributeArticles:${user.id}]`;

    // Step 1 + 2: filter and categorize
    const byCategory = {};
    for (const cat of CATEGORIES) byCategory[cat] = [];

    let includedCount = 0;
    let excludedCount = 0;

    for (const article of pool) {
        const verdict = scoreArticle(article, debugMode);

        if (debugMode) {
            console.log(
                `${label} "${article.title.substring(0, 60)}..." → ${verdict.reason}`
            );
        }

        if (verdict.include) {
            byCategory[verdict.category].push({
                ...article,
                assignedCategory: verdict.category,
                _relevanceScore:  verdict.score
            });
            includedCount++;
        } else {
            excludedCount++;
        }
    }

    if (debugMode || true) {
        console.log(
            `${label} Relevance filter: ${includedCount} included, ` +
            `${excludedCount} excluded from pool of ${pool.length}`
        );
    }

    // Step 3: sort each category — user's sources first, then by relevance score
    for (const cat of CATEGORIES) {
        byCategory[cat].sort((a, b) => {
            const aOwn = isFromUserSource(a, user.sources) ? 1 : 0;
            const bOwn = isFromUserSource(b, user.sources) ? 1 : 0;
            if (bOwn !== aOwn) return bOwn - aOwn;           // user's sources first
            return b._relevanceScore - a._relevanceScore;    // then by score
        });
    }

    // Step 4: take top N per category
    const selected     = [];
    const selectedUrls = new Set();

    for (const cat of CATEGORIES) {
        let taken = 0;
        for (const article of byCategory[cat]) {
            if (taken >= MAX_PER_CATEGORY) break;
            if (selectedUrls.has(article.url)) continue;  // cross-category dedup
            selectedUrls.add(article.url);
            selected.push(article);
            taken++;
        }

        if (debugMode) {
            console.log(
                `${label} ${cat}: ${taken} articles selected ` +
                `(pool had ${byCategory[cat].length})`
            );
        }
    }

    console.log(`${label} Final selection: ${selected.length} articles across ${CATEGORIES.length} categories`);
    return selected;
}

/**
 * Convenience wrapper: distributes the pool to ALL users in one call.
 * Returns a Map from user.id → article array.
 *
 * @param {object[]} users      - Array of user config objects
 * @param {object[]} pool       - Full deduplicated article pool
 * @param {boolean}  debugMode  - Enable per-article audit logging
 * @returns {Map<string, object[]>}
 */
function distributePool(users, pool, debugMode = false) {
    console.log(
        `[distributeArticles] Distributing ${pool.length}-article pool to ${users.length} users...`
    );
    const result = new Map();
    for (const user of users) {
        result.set(user.id, distributeToUser(user, pool, debugMode));
    }
    return result;
}

module.exports = {
    distributePool,
    distributeToUser,
    scoreArticle,
    CATEGORIES,
    CATEGORY_KEYWORDS,
    EXCLUDE_KEYWORDS,
    TECH_ANCHOR_KEYWORDS,
    MAX_PER_CATEGORY
};
