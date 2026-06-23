require('dotenv').config();
const SOURCES = require('./sources');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = 'https://newsdata.io/api/1/news';

const INCLUDE_KEYWORDS = [
    'tech', 'technology', 'AI', 'artificial intelligence', 'software',
    'startup', 'digital', 'cyber', 'cloud', 'data', 'chip',
    'semiconductor', 'Pakistan', 'PSX', 'economy', 'energy',
    'robotics', 'LLM', 'model', 'API', 'SaaS', 'finance', 'market',
    'investment', 'funding', 'business'
];

const EXCLUDE_KEYWORDS = [
    'sports', 'cricket', 'football', 'fashion', 'showbiz',
    'entertainment', 'celebrity', 'bollywood', 'film', 'music',
    'recipe', 'lifestyle', 'drama', 'wedding', 'gossip'
];

async function fetchUserNews(userSources) {
    const domains = userSources
        .map(id => SOURCES[id]?.domain)
        .filter(Boolean)
        .join(',');

    const sourceLabels = userSources
        .map(id => SOURCES[id]?.label || id)
        .join(', ');

    console.log(`[${new Date().toISOString()}] Fetching news from domains: ${domains}`);

    try {
        const params = new URLSearchParams({
            apikey: NEWSDATA_API_KEY,
            language: 'en',
            domainurl: domains,
            size: 10   // Free tier max
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.status !== 'success') {
            console.error(`[${new Date().toISOString()}] NewsData API Error Details:`, JSON.stringify(data));
            return [];
        }

        const articles = (data.results || [])
            .map(item => ({
                title: item.title || 'No title',
                description: item.description || item.content || '',
                source: item.source_name || 'Unknown',
                url: item.link || '',
                publishedAt: item.pubDate || ''
            }))
            .filter(article => {
                const text = `${article.title} ${article.description}`.toLowerCase();
                const excluded = EXCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
                if (excluded) return false;
                return INCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
            });

        const seen = new Set();
        const deduped = articles.filter(a => {
            if (!a.url || seen.has(a.url)) return false;
            seen.add(a.url);
            return true;
        });

        const final = deduped.slice(0, 15);
        console.log(`[${new Date().toISOString()}] ${final.length} articles selected after filtering`);
        return final;

    } catch (err) {
        console.error(`[${new Date().toISOString()}] fetchUserNews failed:`, err.message);
        return [];
    }
}

module.exports = { fetchUserNews };
