require('dotenv').config();
const categories = require('../config/categories');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';

async function fetchQuery(queryParams) {
    try {
        const params = new URLSearchParams({
            apikey: NEWSDATA_API_KEY,
            ...queryParams
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || data.status !== "success") {
            console.error(`[${new Date().toISOString()}] Query failed: ${JSON.stringify(queryParams)} — ${data.message || 'Unknown error'}`);
            return [];
        }

        return (data.results || []).map(item => ({
            title: item.title || 'No title',
            description: item.description || item.content || '',
            source: item.source_name || 'Unknown',
            url: item.link || '',
            publishedAt: item.pubDate || ''
        }));
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in fetchQuery for ${JSON.stringify(queryParams)}:`, error.message);
        return [];
    }
}

async function collectAllCategories() {
    const results = [];

    for (const category of categories) {
        console.log(`[${new Date().toISOString()}] Collecting news for: ${category.label} (${category.queries.length} queries)`);

        let allArticles = [];

        for (let i = 0; i < category.queries.length; i++) {
            const query = category.queries[i];
            const fetchedArticles = await fetchQuery(query);

            allArticles.push(...fetchedArticles);

            console.log(`[${new Date().toISOString()}] Query ${i + 1}/${category.queries.length} for ${category.label}: ${fetchedArticles.length} articles fetched`);

            // 500ms delay after each query call
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Deduplicate allArticles by URL
        const seen = new Set();
        const deduplicated = allArticles.filter(article => {
            if (!article.url || seen.has(article.url)) return false;
            seen.add(article.url);
            return true;
        });

        // Fisher-Yates shuffle
        for (let i = deduplicated.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deduplicated[i], deduplicated[j]] = [deduplicated[j], deduplicated[i]];
        }

        // Shuffling and filtering
        let articles = deduplicated;

        // 1. Editorial Filter (Remove Hiring, Sports, Fashion, Showbiz, and Marketing spam)
        const editorialNoise = [
            'hiring', 'looking for', 'vacancy', 'career', 'recruiting', // Jobs
            'auction', 'collectible', 'vintage', 'sale', 'deal', ' Father\'s Day', // Commercial
            'cycling', 'tournament', 'match', 'olympics', 'league', 'race', // Sports
            'fashion', 'beauty', 'showbiz', 'celebrity', 'entertainment', 'luxury', // Lifestyle
            'market size', 'market report', 'cagr', 'market projected', 'forecast to reach', // Market Spam
            'horoscope', 'recipe', 'lifestyle' // Others
        ];

        // 2. Source Filter (Remove known press-release/SEO spam outlets)
        const bannedSources = ['openpr.com', 'einnews.com', 'marketwatch.com', 'bringatrailer.com', 'cyclingnews.com'];

        articles = articles.filter(a => {
            const text = (a.title + ' ' + a.description).toLowerCase();
            const source = a.source.toLowerCase();

            const hasNoise = editorialNoise.some(k => text.includes(k));
            const isBannedSource = bannedSources.some(s => source.includes(s) || a.url.toLowerCase().includes(s));

            return !hasNoise && !isBannedSource;
        });

        // 3. Strict Category Filters
        if (category.id === 'pakistan') {
            const pkKeywords = ['pakistan', 'islamabad', 'karachi', 'lahore', 'peshawar', 'quetta', 'sindh', 'punjab', 'kpk', 'balochistan'];
            const techKeywords = ['tech', 'digital', 'software', 'innovation', 'startup', 'telecom', 'ai', 'internet', 'broadband', 'fintech', 'automation'];

            articles = articles.filter(a => {
                const text = (a.title + ' ' + a.description).toLowerCase();
                const hasLocation = pkKeywords.some(k => text.includes(k));
                const hasTech = techKeywords.some(k => text.includes(k));
                return hasLocation && hasTech;
            });
        }

        // Limit the final count to 5 high-quality articles
        articles = articles.slice(0, 5);

        console.log(`[${new Date().toISOString()}] ${category.label}: ${articles.length} clean articles selected.`);

        results.push({ category, articles });
    }

    return results;
}

module.exports = { collectAllCategories };
