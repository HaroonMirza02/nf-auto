require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';
const DEFAULT_SIZE = 10;

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

const CATEGORY_QUERY_HINTS = {
    'Global News': 'global OR world OR international OR geopolitics OR policy',
    'Pakistan News': 'Pakistan OR Islamabad OR Karachi OR Lahore OR PSX OR SBP',
    Technology: 'technology OR tech OR software OR cloud OR cybersecurity OR semiconductor',
    AI: 'AI OR "artificial intelligence" OR LLM OR "machine learning" OR generative',
    Business: 'business OR markets OR economy OR finance OR investment OR earnings'
};

function scoreArticleForCategory(article, category) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[category] || [];
    return keywords.reduce((score, kw) => score + (text.includes(kw) ? 1 : 0), 0);
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
    const text = `${article.title} ${article.description}`.toLowerCase();
    // Hard exclusion check
    const excluded = EXCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    if (excluded) return false;
    // Must score at least 1 in any category
    const { category, score } = bestCategoryMatch(article);
    if (!category || score < 1) return false;
    // Category-specific minimum score
    return score >= (CATEGORY_MIN_SCORE[category] || 1);
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
        // Pakistan News NEVER gets a non-Pakistan article as fallback
        if (category === 'Pakistan News') {
            // Skip fallback entirely for Pakistan — Gemini will say "limited coverage"
            continue;
        }

        const fallback = [...allCandidates]
            .filter(a => a.url && !usedUrls.has(a.url))
            .map(a => ({ article: a, score: scoreArticleForCategory(a, category) }))
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score)[0];

        if (fallback) {
            usedUrls.add(fallback.article.url);
            selected.push({ ...fallback.article, assignedCategory: category });
        }
    }

    // Fill in remaining articles from each category pool
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
        domainurl: domains,
        size: String(DEFAULT_SIZE)
    });

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
