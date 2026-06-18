require('dotenv').config();
const categories = require('../config/categories');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';

async function collectAllCategories() {
    const results = [];

    for (const category of categories) {
        console.log(`[${new Date().toISOString()}] Fetching news for: ${category.label}`);

        try {
            const queryParams = new URLSearchParams({
                apikey: NEWSDATA_API_KEY,
                ...category.params
            });

            const response = await fetch(`${BASE_URL}?${queryParams.toString()}`);
            const data = await response.json();

            if (data.status !== "success") {
                console.error(`[${new Date().toISOString()}] Error fetching ${category.label}:`, data.message || "Unknown error");
                results.push({ category, articles: [] });
            } else {
                const articles = (data.results || []).map(item => ({
                    title: item.title || "No title",
                    description: item.description || item.content || "",
                    source: item.source_name || "Unknown",
                    url: item.link || "",
                    publishedAt: item.pubDate || ""
                }));
                results.push({ category, articles });
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to fetch category ${category.label}:`, error.message);
            results.push({ category, articles: [] });
        }

        // 500ms delay between each category fetch
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
}

module.exports = { collectAllCategories };
