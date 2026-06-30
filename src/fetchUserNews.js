require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';
const DEFAULT_SIZE = 10;

const EXCLUDE_KEYWORDS = [
    'sports', 'cricket', 'football', 'fashion', 'showbiz',
    'entertainment', 'celebrity', 'bollywood', 'film', 'music',
    'recipe', 'lifestyle', 'drama', 'wedding', 'gossip'
];

const CATEGORIES = [
    'Global News',
    'Pakistan News',
    'Technology',
    'AI',
    'Business'
];

const CATEGORY_KEYWORDS = {
    'Global News': ['global', 'world', 'international', 'geopolitics', 'diplomatic', 'policy'],
    'Pakistan News': ['pakistan', 'islamabad', 'karachi', 'lahore', 'psx', 'sbp', 'pak rupee'],
    Technology: ['technology', 'tech', 'software', 'hardware', 'cloud', 'cyber', 'chip', 'semiconductor', 'digital', 'app', 'api'],
    AI: ['ai', 'artificial intelligence', 'llm', 'model', 'chatbot', 'machine learning', 'generative', 'openai', 'gemini'],
    Business: ['business', 'market', 'economy', 'finance', 'investment', 'funding', 'stock', 'earnings', 'merger', 'acquisition']
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
    const excluded = EXCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    if (excluded) return false;
    return bestCategoryMatch(article).score > 0;
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
    return articles
        .map(a => ({ article: a, score: scoreArticleForCategory(a, category) }))
        .filter(item => item.score > 0)
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
        const first = (categoryPools[category] || []).find(a => a.url && !usedUrls.has(a.url));
        if (first) {
            usedUrls.add(first.url);
            selected.push(first);
            continue;
        }

        // Hard fallback: keep category filled from the same user sources.
        const fallback = [...allCandidates]
            .filter(a => a.url && !usedUrls.has(a.url))
            .sort((a, b) => scoreArticleForCategory(b, category) - scoreArticleForCategory(a, category))[0];

        if (fallback) {
            usedUrls.add(fallback.url);
            selected.push({ ...fallback, assignedCategory: category });
        }
    }

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
