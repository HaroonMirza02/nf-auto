require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';
const DEFAULT_SIZE = 10;
const MIN_PER_CATEGORY = 3;
const MAX_PER_CATEGORY = 3;

const EXCLUDE_KEYWORDS = [
    // Sports
    'cricket', 'football', 'soccer', 'basketball', 'tennis', 'golf', 'rugby',
    'world cup', 'fifa', 'uefa', 'premier league', 'nba', 'nfl', 'nhl', 'mlb',
    'formula 1', 'f1 race', 'olympics', 'athlete', 'goalkeeper', 'striker',
    'midfielder', 'squad', 'match result', 'knockout stage', 'tournament',
    'batting', 'bowling', 'wicket', 'innings', 'odi', 't20',
    // Entertainment / Lifestyle
    'showbiz', 'celebrity', 'bollywood', 'hollywood', 'actor', 'actress',
    'film', 'movie', 'box office', 'album', 'music', 'concert', 'fashion',
    'recipe', 'lifestyle', 'drama', 'wedding', 'gossip', 'entertainment',
    'reality show', 'award show', 'oscar', 'grammy', 'emmy',
    // Conflict / general politics noise — filtered here as a backstop even
    // though the query-level NOT clauses below already try to exclude these
    'war', 'military', 'conflict', 'attack', 'airstrike', 'missile', 'ceasefire',
    'invasion', 'militant', 'terrorist', 'insurgent',
    // General exclusions
    'horoscope', 'astrology', 'zodiac'
];

const CATEGORIES = [
    'Global News',
    'Pakistan News',
    'Technology',
    'AI',
    'Business'
];

// Minimum keyword score required for a category match (stricter for AI)
const CATEGORY_MIN_SCORE = {
    'Global News': 1,
    'Pakistan News': 1,
    Technology: 1,
    AI: 2,   // AI needs 2 hits to avoid weak matches
    Business: 1
};

const CATEGORY_KEYWORDS = {
    'Global News': [
        'global', 'world', 'international', 'geopolitics', 'diplomatic', 'policy',
        'united nations', 'un summit', 'nato', 'sanctions', 'trade war', 'tariff',
        'bilateral', 'foreign minister', 'state department'
    ],
    'Pakistan News': [
        'pakistan', 'islamabad', 'karachi', 'lahore', 'peshawar', 'quetta',
        'psx', 'sbp', 'state bank', 'imf', 'rupee', 'pta', 'ptcl', 'kesc',
        'secp', 'ecc', 'federal budget', 'nepra', 'ogra', 'passco', 'sindh',
        'punjab', 'khyber', 'balochistan'
    ],
    Technology: [
        'technology', 'tech', 'software', 'hardware', 'cloud computing', 'cybersecurity',
        'chip', 'semiconductor', 'digital', 'startup', 'app', 'platform', 'saas',
        'api', 'developer', 'open source', 'quantum', 'robotics', 'drone', 'satellite',
        'data center', '5g', '6g', 'fiber', 'broadband', 'encryption'
    ],
    AI: [
        'artificial intelligence', 'machine learning', 'deep learning', 'llm',
        'large language model', 'generative ai', 'chatbot', 'openai', 'gemini',
        'claude', 'gpt', 'neural network', 'computer vision', 'nlp', 'natural language',
        'ai model', 'ai agent', 'ai chip', 'nvidia ai', 'foundation model',
        'ai regulation', 'ai safety', 'anthropic', 'mistral', 'diffusion model'
    ],
    Business: [
        'business', 'market', 'economy', 'finance', 'investment', 'funding', 'revenue',
        'profit', 'loss', 'earnings', 'merger', 'acquisition', 'ipo', 'valuation',
        'venture capital', 'private equity', 'interest rate', 'inflation', 'gdp',
        'trade deficit', 'exports', 'imports', 'supply chain', 'commodities'
    ]
};

// Words that anchor an article to the tech industry. Global News, Pakistan
// News, and Business must contain at least one of these to qualify — this is
// what keeps a war/politics/general-economy story out of a tech digest even
// though it might otherwise match the category's theme keywords above.
const TECH_ANCHOR_KEYWORDS = [
    'technology', 'tech', 'ai', 'artificial intelligence', 'software', 'hardware',
    'digital', 'startup', 'app', 'platform', 'internet', 'cyber', 'cybersecurity',
    'data', 'cloud', 'chip', 'semiconductor', 'automation', 'robot', 'robotics',
    'innovation', 'telecom', 'fintech', 'e-commerce', 'broadband', '5g', '6g',
    'blockchain', 'crypto', 'quantum', 'satellite', 'saas', 'developer'
];

// Technology and AI are inherently tech — they're exempt from the extra check.
const REQUIRES_TECH_ANCHOR = {
    'Global News': true,
    'Pakistan News': true,
    Technology: false,
    AI: false,
    Business: true
};

// Query hints bake the tech requirement into the NewsData request itself.
// IMPORTANT: NewsData's real limit on `q` is 100 characters, despite their
// docs mentioning 512 — verified against the live API (UnsupportedQueryLength
// fires above 100). NOT() clauses are deliberately left out here: they're not
// needed for exclusion (EXCLUDE_KEYWORDS + isRelevant already strip war/sports/
// politics noise downstream) and they weren't cheap enough to keep within
// budget alongside the OR-lists that actually widen the candidate pool.
const QUERY_MAX_LENGTH = 100;

const CATEGORY_QUERY_HINTS = {
    'Global News': 'technology AND (global OR world OR policy OR regulation)',
    'Pakistan News': 'technology AND (Pakistan OR Islamabad OR Karachi OR telecom OR fintech)',
    Technology: 'technology OR software OR cybersecurity OR semiconductor',
    AI: '"artificial intelligence" OR LLM OR "machine learning" OR generative',
    Business: 'technology AND (earnings OR funding OR IPO OR investment)'
};

// Defensive check: catch a future edit that pushes a hint back over the real
// limit immediately at startup instead of silently degrading in production
// (this is exactly what happened before this fix — every category query was
// failing and nobody knew until a dry run surfaced the API error).
for (const [category, hint] of Object.entries(CATEGORY_QUERY_HINTS)) {
    if (hint.length > QUERY_MAX_LENGTH) {
        console.warn(`[${new Date().toISOString()}] WARNING: query hint for "${category}" is ${hint.length} chars, over NewsData's ${QUERY_MAX_LENGTH}-char limit — it WILL be rejected by the API.`);
    }
}

// ─── Word-boundary regex helpers (V2) ────────────────────────────────────────
// Replaces the old text.includes(kw) approach that caused false positives:
//   "ai" → matched inside "Ukrainian", "rain", "paid"
//   "app" → matched inside "happened", "application"
//   "nato" → matched inside "senator", "donation"

const _kwRegexCache = new Map();
function kwRegex(keyword) {
    if (_kwRegexCache.has(keyword)) return _kwRegexCache.get(keyword);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    _kwRegexCache.set(keyword, re);
    return re;
}

function scoreArticleForCategory(article, category) {
    const text = `${article.title} ${article.description}`;
    const keywords = CATEGORY_KEYWORDS[category] || [];
    return keywords.reduce((score, kw) => score + (kwRegex(kw).test(text) ? 1 : 0), 0);
}

function isTechAnchored(article) {
    const text = `${article.title} ${article.description}`;
    return TECH_ANCHOR_KEYWORDS.some(kw => kwRegex(kw).test(text));
}

function bestCategoryMatch(article) {
    let bestCategory = null;
    let bestScore = 0;

    for (const category of CATEGORIES) {
        const score = scoreArticleForCategory(article, category);
        if (score > bestScore) {
            bestCategory = category;
            bestScore = score;
        }
    }

    return { category: bestCategory, score: bestScore };
}

function normalizeArticle(item) {
    return {
        title: item.title || 'No title',
        description: item.description || item.content || '',
        source: item.source_name || 'Unknown',
        url: item.link || '',
        publishedAt: item.pubDate || ''
    };
}

function isRelevant(article) {
    const text = `${article.title} ${article.description}`;
    // Hard exclusion check — whole-word matching to avoid false positives
    const excluded = EXCLUDE_KEYWORDS.some(kw => kwRegex(kw).test(text));
    if (excluded) return false;
    // Must score at least 1 in any category
    const { category, score } = bestCategoryMatch(article);
    if (!category || score < 1) return false;
    // Category-specific minimum score
    if (score < (CATEGORY_MIN_SCORE[category] || 1)) return false;
    // Non-tech-inherent categories must also carry a tech anchor
    if (REQUIRES_TECH_ANCHOR[category] && !isTechAnchored(article)) return false;
    return true;
}

function dedupeArticles(articles) {
    const seen = new Set();
    return articles.filter(a => {
        if (!a.url || seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    });
}

function takeTopForCategory(articles, category, limit) {
    const minScore = CATEGORY_MIN_SCORE[category] || 1;
    return articles
        .map(a => ({ article: a, score: scoreArticleForCategory(a, category) }))
        .filter(item => item.score >= minScore)
        .filter(item => !REQUIRES_TECH_ANCHOR[category] || isTechAnchored(item.article))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({ ...item.article, assignedCategory: category }));
}

function buildBalancedFeed(categoryPools) {
    const selected = [];
    const usedUrls = new Set();
    const allCandidates = dedupeArticles(
        CATEGORIES.flatMap(category => categoryPools[category] || [])
    );

    for (const category of CATEGORIES) {
        const minScore = CATEGORY_MIN_SCORE[category] || 1;

        // Primary: use own category pool first
        const first = (categoryPools[category] || []).find(a => a.url && !usedUrls.has(a.url));
        if (first) {
            usedUrls.add(first.url);
            selected.push(first);
            continue;
        }

        // Fallback: only use articles that actually score for this category
        // AND (for Global/Pakistan/Business) still carry a tech anchor —
        // no category is skipped anymore, but the fallback stays tech-relevant.
        const fallback = [...allCandidates]
            .filter(a => a.url && !usedUrls.has(a.url))
            .map(a => ({ article: a, score: scoreArticleForCategory(a, category) }))
            .filter(item => item.score >= minScore)
            .filter(item => !REQUIRES_TECH_ANCHOR[category] || isTechAnchored(item.article))
            .sort((a, b) => b.score - a.score)[0];

        if (fallback) {
            usedUrls.add(fallback.article.url);
            selected.push({ ...fallback.article, assignedCategory: category });
        }
    }

    // Fill in remaining articles from each category pool (already capped to
    // MAX_PER_CATEGORY upstream, so this just adds the 2nd/3rd items per category)
    for (const category of CATEGORIES) {
        for (const article of categoryPools[category] || []) {
            if (!article.url || usedUrls.has(article.url)) continue;
            usedUrls.add(article.url);
            selected.push(article);
        }
    }

    return selected;
}

async function fetchFromNewsData(domains, query) {
    const params = new URLSearchParams({
        apikey: NEWSDATA_API_KEY,
        language: 'en',
        size: String(DEFAULT_SIZE)
    });

    if (domains) params.set('domainurl', domains);
    if (query) params.set('q', query);

    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.status !== 'success') {
        const scope = query ? `query "${query}"` : 'general query';
        console.warn(`[${new Date().toISOString()}] NewsData API non-success for ${scope}: ${JSON.stringify(data)}`);
        return [];
    }

    return (data.results || []).map(normalizeArticle);
}

// Supplemental fetch: same tech-anchored query hint as the primary fetch, but
// with NO domain restriction at all — NewsData caps domainurl at 5 domains
// per request, and the curated SOURCES list has more than that, so trying to
// pass "all curated domains" errors out. Leaving domains unset searches
// NewsData's full index instead, which is a better fit anyway for "widen
// beyond this user's own sources." Only called when a category's own pool
// comes up short, so it doesn't burn quota on categories already well covered.
async function fetchSupplemental(category) {
    return fetchFromNewsData(null, CATEGORY_QUERY_HINTS[category]);
}

async function fetchUserNews(userSources) {
    const domains = userSources
        .map(id => SOURCES[id]?.domain)
        .filter(Boolean)
        .join(',');

    console.log(`[${new Date().toISOString()}] Fetching news from domains: ${domains}`);

    try {
        const baseArticles = await fetchFromNewsData(domains);
        const categoryFetches = await Promise.all(
            CATEGORIES.map(category => fetchFromNewsData(domains, CATEGORY_QUERY_HINTS[category]))
        );

        const categoryPools = {};
        CATEGORIES.forEach((category, idx) => {
            const merged = dedupeArticles([
                ...takeTopForCategory(baseArticles, category, 5),
                ...takeTopForCategory(categoryFetches[idx], category, 8)
            ]).filter(isRelevant);
            categoryPools[category] = merged;
        });

        // Top up any category that's still thin, by widening beyond this
        // user's own sources — keeps every category tech-relevant AND filled.
        for (const category of CATEGORIES) {
            if (categoryPools[category].length < MIN_PER_CATEGORY) {
                const supplemental = await fetchSupplemental(category);
                const topped = takeTopForCategory(supplemental, category, MIN_PER_CATEGORY)
                    .filter(isRelevant);
                categoryPools[category] = dedupeArticles([...categoryPools[category], ...topped]);
                console.log(`[${new Date().toISOString()}] Topped up ${category}: now ${categoryPools[category].length} candidates`);
            }
            // Hard cap — this is the real max-3, not left to the prompt to enforce
            categoryPools[category] = categoryPools[category].slice(0, MAX_PER_CATEGORY);
        }

        const final = buildBalancedFeed(categoryPools).slice(0, 15);
        const coverage = CATEGORIES.filter(category => categoryPools[category].length > 0).length;
        console.log(`[${new Date().toISOString()}] ${final.length} relevant articles selected with ${coverage}/${CATEGORIES.length} category pools populated`);
        return final;

    } catch (err) {
        console.error(`[${new Date().toISOString()}] fetchUserNews failed:`, err.message);
        return [];
    }
}

module.exports = { fetchUserNews };