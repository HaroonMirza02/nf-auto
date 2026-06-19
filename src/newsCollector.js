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

        // Take top 6
        const articles = deduplicated.slice(0, 6);

        console.log(`[${new Date().toISOString()}] ${category.label}: ${articles.length} articles selected after deduplication and shuffle`);

        results.push({ category, articles });
    }

    return results;
}

module.exports = { collectAllCategories };
