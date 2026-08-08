/**
 * fetchNewsPool.js — NF Auto V2
 *
 * Single consolidated fetch for one full run. Rather than calling NewsData.io
 * once per user per category (which multiplies API credits and causes later
 * users to receive worse content), this module pulls ONE large article pool
 * for the whole team in a single coordinated batch.
 *
 * NewsData.io free-plan limits (as of 2025-2026):
 *   - 200 credits / day
 *   - 1 credit consumed per request regardless of `size`
 *   - Max 10 articles per request on the free tier
 *   - Max 100 characters in the `q` (keyword) parameter
 *   - Rate: 30 credits / 15 min (~2 req/min sustained)
 *
 * Budget used by this module per daily run:
 *   - 2  broad domain chunk fetches (9 domains in groups of 5)          = 2 credits
 *   - 5  category keyword-query fetches (one per category)              = 5 credits
 *   - 3  NewsData native category fetches (technology/business/science) = 3 credits
 *   - 5  per-category "top-up" fetches (country/domain widened)         = 5 credits
 *   - 3  Pakistan supplemental queries (country:pk)                     = 3 credits
 *   - 1  Pakistan dedicated tech outlet domain fetch                    = 1 credit
 *   TOTAL: ~19 credits per run  (well within 200/day limit)
 *
 * Design goal:
 *   The pool must contain enough unique relevant articles to give every user
 *   at least 1 article in every category after exclusive cross-user assignment.
 *   Minimum needed: 4 users × 5 categories × 1 article = 20 slots.
 *   Target: 4 users × 5 categories × 3 articles = 60 usable slots.
 *   We fetch aggressively per category and rely on local filtering to keep
 *   only the relevant ones.
 */

require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';

const QUERY_MAX_LENGTH = 100;  // NewsData hard limit, confirmed April 2025
const REQUEST_SIZE = 10;       // Free-tier max per request

const CATEGORIES = ['Global News', 'Pakistan News', 'Technology', 'AI', 'Business'];

/**
 * Primary category query hints — technology-anchored, stay under 100 chars.
 */
const CATEGORY_QUERY_HINTS = {
    'Global News':   'technology AND (global OR world OR policy OR regulation)',
    'Pakistan News': 'technology AND (Pakistan OR Islamabad OR Karachi OR telecom OR fintech)',
    Technology:      'technology OR software OR cybersecurity OR semiconductor',
    AI:              '"artificial intelligence" OR LLM OR "machine learning" OR generative',
    Business:        'technology AND (earnings OR funding OR IPO OR investment)'
};

/**
 * Secondary per-category queries — different angles to widen coverage.
 * Each category gets a second fetch using a complementary query so that
 * after dedup we have more unique candidate articles per slot.
 */
const CATEGORY_SECONDARY_HINTS = {
    'Global News':   'tech regulation OR chip export OR digital trade OR AI policy',
    'Pakistan News': 'Pakistan startup OR Pakistan fintech OR Pakistan digital economy',
    Technology:      'cloud computing OR data center OR quantum OR robotics OR IoT',
    AI:              'OpenAI OR Anthropic OR Gemini OR GPT OR AI safety OR AI chip',
    Business:        'tech merger OR acquisition OR VC funding OR startup valuation'
};

/**
 * Pakistan supplemental queries with country filter.
 * These run with country:'pk' to pull Pakistani news sources directly.
 */
const PAKISTAN_SUPPLEMENTAL_QUERIES = [
    'Pakistan technology startup fintech digital',
    'Pakistan software IT export SBP economy',
    'Pakistan telecom broadband 5G internet'
];

// Pakistan-specific tech outlets — fetched by domain to bypass index limitations
const PAKISTAN_TECH_DOMAINS = 'propakistani.pk,techjuice.pk,profit.pakistantoday.com.pk';

// Validate query lengths at startup
for (const [cat, hint] of Object.entries(CATEGORY_QUERY_HINTS)) {
    if (hint.length > QUERY_MAX_LENGTH) {
        console.warn(`[fetchNewsPool] WARNING: primary query for "${cat}" is ${hint.length} chars — over limit`);
    }
}
for (const [cat, hint] of Object.entries(CATEGORY_SECONDARY_HINTS)) {
    if (hint.length > QUERY_MAX_LENGTH) {
        console.warn(`[fetchNewsPool] WARNING: secondary query for "${cat}" is ${hint.length} chars — over limit`);
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeArticle(item) {
    return {
        title:       item.title        || 'No title',
        description: item.description  || item.content || '',
        source:      item.source_name  || 'Unknown',
        url:         item.link         || '',
        publishedAt: item.pubDate      || ''
    };
}

async function fetchFromNewsData(params, label) {
    const searchParams = new URLSearchParams({
        apikey:   NEWSDATA_API_KEY,
        language: 'en',
        size:     String(REQUEST_SIZE),
        ...params
    });

    try {
        const response = await fetch(`${BASE_URL}?${searchParams.toString()}`);
        const data     = await response.json();

        if (!response.ok || data.status !== 'success') {
            console.warn(
                `[fetchNewsPool] Non-success for ${label}: ` +
                (data.message || data.status || 'unknown error')
            );
            return [];
        }

        const articles = (data.results || []).map(normalizeArticle);
        console.log(`[fetchNewsPool] ${label}: ${articles.length} raw articles`);
        return articles;

    } catch (err) {
        console.error(`[fetchNewsPool] Network error for ${label}:`, err.message);
        return [];
    }
}

/**
 * Deduplicates by URL and by normalised title.
 * Title dedup catches the same syndicated story published under different URLs.
 */
function dedupeByUrl(articles) {
    const seenUrls   = new Set();
    const seenTitles = new Set();
    return articles.filter(a => {
        if (!a.url || seenUrls.has(a.url)) return false;
        const normalTitle = (a.title || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (normalTitle && seenTitles.has(normalTitle)) return false;
        seenUrls.add(a.url);
        if (normalTitle) seenTitles.add(normalTitle);
        return true;
    });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches the consolidated article pool for one full digest run.
 *
 * The fetch strategy is deliberately redundant — multiple queries per category,
 * broad domain fetches, and Pakistan-specific fetches — to ensure the raw pool
 * is large enough that after relevance filtering there are sufficient unique
 * articles in every category to fill all 4 users without any cross-user repeats.
 *
 * @param {object[]} users  - User objects from config.json
 * @returns {Promise<object[]>} - Raw deduplicated article pool
 */
async function fetchNewsPool(users) {
    console.log(`[fetchNewsPool] Starting consolidated pool fetch for ${users.length} users...`);

    // Gather all unique domains from all users
    const allDomainSet = new Set();
    for (const user of users) {
        for (const srcId of (user.sources || [])) {
            const domain = SOURCES[srcId]?.domain;
            if (domain) allDomainSet.add(domain);
        }
    }

    const domainList   = [...allDomainSet];
    const DOMAIN_CHUNK = 5;
    const domainChunks = [];
    for (let i = 0; i < domainList.length; i += DOMAIN_CHUNK) {
        domainChunks.push(domainList.slice(i, i + DOMAIN_CHUNK).join(','));
    }
    console.log(`[fetchNewsPool] ${domainList.length} unique domains → ${domainChunks.length} broad fetch(es)`);

    const allArticles = [];

    // --- PASS 1: Broad domain fetches (captures preferred outlet headlines) ---
    for (let i = 0; i < domainChunks.length; i++) {
        const results = await fetchFromNewsData(
            { domainurl: domainChunks[i] },
            `broad domain batch ${i + 1}/${domainChunks.length}`
        );
        allArticles.push(...results);
        if (i < domainChunks.length - 1) await delay(600);
    }

    // --- PASS 2: Primary category keyword queries (domain-free, tech-anchored) ---
    for (const [cat, hint] of Object.entries(CATEGORY_QUERY_HINTS)) {
        const results = await fetchFromNewsData({ q: hint }, `primary query: ${cat}`);
        allArticles.push(...results);
        await delay(600);
    }

    // --- PASS 3: Secondary category queries (different angle, more coverage) ---
    for (const [cat, hint] of Object.entries(CATEGORY_SECONDARY_HINTS)) {
        const results = await fetchFromNewsData({ q: hint }, `secondary query: ${cat}`);
        allArticles.push(...results);
        await delay(600);
    }

    // --- PASS 4: NewsData native category parameter (catches non-keyword stories) ---
    for (const cat of ['technology', 'business', 'science']) {
        const results = await fetchFromNewsData({ category: cat }, `NewsData category: ${cat}`);
        allArticles.push(...results);
        await delay(600);
    }

    // --- PASS 5: Pakistan supplemental (country:pk + keyword) ---
    for (let i = 0; i < PAKISTAN_SUPPLEMENTAL_QUERIES.length; i++) {
        const q = PAKISTAN_SUPPLEMENTAL_QUERIES[i];
        const results = await fetchFromNewsData({ q, country: 'pk' }, `Pakistan supplemental ${i + 1}`);
        allArticles.push(...results);
        if (i < PAKISTAN_SUPPLEMENTAL_QUERIES.length - 1) await delay(600);
    }

    // --- PASS 6: Pakistan dedicated tech outlet domains ---
    const pkResults = await fetchFromNewsData(
        { domainurl: PAKISTAN_TECH_DOMAINS },
        `Pakistan tech outlets`
    );
    allArticles.push(...pkResults);

    // Single global dedup — runs once before distribution
    const pool = dedupeByUrl(allArticles);
    console.log(
        `[fetchNewsPool] Pool complete: ${pool.length} unique articles ` +
        `(from ${allArticles.length} raw, ${allArticles.length - pool.length} duplicates removed)`
    );

    return pool;
}

module.exports = { fetchNewsPool, CATEGORIES, CATEGORY_QUERY_HINTS };
