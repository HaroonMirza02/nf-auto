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
 *   - Rate: 30 credits / 15 min (≈ 2 req/min sustained)
 *
 * Budget used by this module per daily run:
 *   - 2 broad domain chunk fetches (9 domains split into groups of 5)  = 2 credits
 *   - 5 category-query fetches (one per category hint)                 = 5 credits
 *   - 3 NewsData native category fetches (technology/business/science) = 3 credits
 *   - 3 Pakistan-specific supplemental fetches                         = 3 credits
 *   TOTAL: ~13 credits per run  (well within 200/day limit)
 *
 * The pool returned typically contains 80–120 unique articles before
 * any relevance filtering. After filtering it yields ~40–60 usable
 * articles that are then distributed locally to each user with zero
 * further API calls.
 */

require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';

// Hard limit enforced by NewsData.io on their live API (confirmed April 2025)
const QUERY_MAX_LENGTH = 100;

// Articles returned per request (free-tier max is 10)
const REQUEST_SIZE = 10;

/**
 * The five categories used throughout the pipeline.
 * Order matters: articles are assigned to the first category they score highest in.
 */
const CATEGORIES = ['Global News', 'Pakistan News', 'Technology', 'AI', 'Business'];

/**
 * Tech-anchored query hints, one per category.
 * Each string is verified to stay under QUERY_MAX_LENGTH.
 * These bake the technology focus directly into the NewsData request so the
 * raw pool already leans tech before any local filtering touches it.
 */
const CATEGORY_QUERY_HINTS = {
    'Global News':    'technology AND (global OR world OR policy OR regulation)',
    'Pakistan News':  'technology AND (Pakistan OR Islamabad OR Karachi OR telecom OR fintech)',
    Technology:       'technology OR software OR cybersecurity OR semiconductor',
    AI:               '"artificial intelligence" OR LLM OR "machine learning" OR generative',
    Business:         'technology AND (earnings OR funding OR IPO OR investment)'
};

/**
 * Additional Pakistan-focused queries that deliberately widen beyond tech so
 * the Pakistan pool isn't starved. The AI relevance filter downstream decides
 * what's actually included in the digest; here we want broad raw coverage.
 */
const PAKISTAN_SUPPLEMENTAL_QUERIES = [
    'Pakistan business economy startup digital',
    'Pakistan fintech banking SBP SECP',
    'Pakistan IT export software Lahore Karachi'
];

// Validate query lengths at module load — catch accidental over-length edits
// before they silently fail in production.
for (const [cat, hint] of Object.entries(CATEGORY_QUERY_HINTS)) {
    if (hint.length > QUERY_MAX_LENGTH) {
        console.warn(
            `[fetchNewsPool] WARNING: query hint for "${cat}" is ${hint.length} chars` +
            ` — over the ${QUERY_MAX_LENGTH}-char limit and WILL be rejected by NewsData.io`
        );
    }
}
for (const q of PAKISTAN_SUPPLEMENTAL_QUERIES) {
    if (q.length > QUERY_MAX_LENGTH) {
        console.warn(
            `[fetchNewsPool] WARNING: Pakistan supplemental query is ${q.length} chars` +
            ` — over the ${QUERY_MAX_LENGTH}-char limit`
        );
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeArticle(item) {
    return {
        title:       item.title        || 'No title',
        description: item.description  || item.content || '',
        source:      item.source_name  || 'Unknown',
        url:         item.link         || '',
        publishedAt: item.pubDate      || '',
        // assignedCategory will be stamped on during distribution, not here
    };
}

/**
 * Single NewsData.io fetch. Returns normalized articles or [] on failure.
 * All error paths are non-throwing — the pool build degrades gracefully if
 * one query fails.
 *
 * @param {object} params  - Query parameters (apikey is added automatically)
 * @param {string} label   - Human-readable label for log lines
 */
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
 * Deduplicate an array of articles by URL.
 * This is the single global dedup for the full pool — it runs once, before
 * distribution, so every user sees the same complete deduplicated set.
 */
function dedupeByUrl(articles) {
    const seen = new Set();
    return articles.filter(a => {
        if (!a.url || seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    });
}

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches the consolidated article pool for one full digest run.
 *
 * Steps:
 *   1. Collect all unique source domains from all users in config (no user
 *      receives more or fewer articles based on their processing order).
 *   2. Fire one broad domain-restricted fetch (no keyword filter) to capture
 *      general headlines from the team's preferred outlets.
 *   3. Fire one fetch per category using the tech-anchored query hint — this
 *      fills topic-specific slots that the broad fetch might miss.
 *   4. Fire three Pakistan-specific supplemental fetches to compensate for
 *      the generally thinner Pakistan tech coverage in global news indices.
 *   5. Merge, deduplicate, and return the combined pool.
 *      No per-user filtering happens here — that is done in distributeArticles.js.
 *
 * @param {object[]} users   - User objects from config.json (need .sources)
 * @returns {Promise<object[]>} - Raw deduplicated article pool
 */
async function fetchNewsPool(users) {
    console.log(`[fetchNewsPool] Starting consolidated pool fetch for ${users.length} users...`);

    // 1. Gather all unique domains across all users
    const allDomainSet = new Set();
    for (const user of users) {
        for (const srcId of (user.sources || [])) {
            const domain = SOURCES[srcId]?.domain;
            if (domain) allDomainSet.add(domain);
        }
    }

    // NewsData.io caps domainurl at 5 per request — we use the domain list for
    // the broad fetch only; category queries are intentionally domain-free to
    // widen the candidate pool beyond just the team's preferred outlets.
    //
    // We chunk the domains into groups of 5 and fire one request per chunk.
    const domainList  = [...allDomainSet];
    const DOMAIN_CHUNK = 5;
    const domainChunks = [];
    for (let i = 0; i < domainList.length; i += DOMAIN_CHUNK) {
        domainChunks.push(domainList.slice(i, i + DOMAIN_CHUNK).join(','));
    }

    console.log(
        `[fetchNewsPool] ${domainList.length} unique domains across all users ` +
        `→ ${domainChunks.length} broad fetch(es)`
    );

    const allArticles = [];

    // 2. Broad domain fetches (no keyword restriction)
    for (let i = 0; i < domainChunks.length; i++) {
        const chunk   = domainChunks[i];
        const results = await fetchFromNewsData(
            { domainurl: chunk },
            `broad domain batch ${i + 1}/${domainChunks.length} (${chunk})`
        );
        allArticles.push(...results);
        // 600 ms between calls to stay well under the 30-credit/15-min rate limit
        if (i < domainChunks.length - 1) {
            await new Promise(r => setTimeout(r, 600));
        }
    }

    // 3. Category query fetches (domain-free to widen the pool)
    for (const [category, hint] of Object.entries(CATEGORY_QUERY_HINTS)) {
        const results = await fetchFromNewsData(
            { q: hint },
            `category query: ${category}`
        );
        allArticles.push(...results);
        await new Promise(r => setTimeout(r, 600));
    }

    // 3b. NewsData also supports a `category` parameter — fire one per major
    //     category without a q filter to capture headlines that don't use the
    //     exact keyword phrases we picked but are still relevant.
    const NEWSDATA_CATEGORIES = ['technology', 'business', 'science'];
    for (const cat of NEWSDATA_CATEGORIES) {
        const results = await fetchFromNewsData(
            { category: cat },
            `NewsData category: ${cat}`
        );
        allArticles.push(...results);
        await new Promise(r => setTimeout(r, 600));
    }

    // 4. Pakistan supplemental fetches
    for (let i = 0; i < PAKISTAN_SUPPLEMENTAL_QUERIES.length; i++) {
        const q       = PAKISTAN_SUPPLEMENTAL_QUERIES[i];
        const results = await fetchFromNewsData(
            { q, country: 'pk' },
            `Pakistan supplemental ${i + 1}: "${q}"`
        );
        allArticles.push(...results);
        if (i < PAKISTAN_SUPPLEMENTAL_QUERIES.length - 1) {
            await new Promise(r => setTimeout(r, 600));
        }
    }

    // 5. Global dedup — runs once on the full pool before anyone touches it
    const pool = dedupeByUrl(allArticles);

    console.log(
        `[fetchNewsPool] Pool complete: ${pool.length} unique articles ` +
        `(from ${allArticles.length} raw, ${allArticles.length - pool.length} duplicates removed)`
    );

    return pool;
}

module.exports = { fetchNewsPool, CATEGORIES, CATEGORY_QUERY_HINTS };
