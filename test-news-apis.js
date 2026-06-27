const fs = require('fs');
const path = require('path');

// API KEYS PROVIDED BY USER
const KEYS = {
    newsapi: 'e65916715c1b42c19f2272660800f4d6',
    newsdata: 'pub_506529ffe6084ddebe6dc7b3b8a50ce9',
    currents: 'RCUCqGkcac9z3WrppBfF2Ln9oJLE826LgIfzVS0OhsGHcI3o'
};

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

// Load current configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const SOURCES_REGISTRY = require('./src/sources');

function filterArticles(articles) {
    const seen = new Set();
    return articles
        .map(item => ({
            title: item.title || 'No title',
            description: item.description || item.content || '',
            source: item.source_name || item.source?.name || 'Unknown',
            url: item.link || item.url || '',
            publishedAt: item.pubDate || item.publishedAt || ''
        }))
        .filter(article => {
            if (!article.url || seen.has(article.url)) return false;
            const text = `${article.title} ${article.description}`.toLowerCase();
            const excluded = EXCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
            if (excluded) return false;
            const included = INCLUDE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
            if (!included) return false;
            seen.add(article.url);
            return true;
        });
}

// 1. NEWSAPI.ORG
async function fetchNewsAPI(domains) {
    try {
        const url = `https://newsapi.org/v2/everything?domains=${domains}&language=en&pageSize=30&apiKey=${KEYS.newsapi}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.articles || [];
    } catch (e) { return []; }
}

// 2. NEWSDATA.IO
async function fetchNewsData(domains) {
    try {
        const url = `https://newsdata.io/api/1/news?apikey=${KEYS.newsdata}&domainurl=${domains}&language=en&size=10`;
        const res = await fetch(url);
        const data = await res.json();
        return data.results || [];
    } catch (e) { return []; }
}

// 3. CURRENTSAPI.SERVICES
async function fetchCurrents(domains) {
    try {
        // Currents prefers domain names without protocols
        const url = `https://api.currentsapi.services/v1/search?apiKey=${KEYS.currents}&domain=${domains}&language=en&limit=30`;
        const res = await fetch(url);
        const data = await res.json();
        return data.news || [];
    } catch (e) { return []; }
}

async function runComparison() {
    console.log('--- NEWS API COMPARISON TEST ---');
    console.log(`Testing with 3 APIs for ${config.users.length} users...\n`);

    const report = {
        newsapi: { name: 'NewsAPI.org', raw: 0, filtered: 0, dailyLimit: '100 requests' },
        newsdata: { name: 'NewsData.io', raw: 0, filtered: 0, dailyLimit: '200 requests' },
        currents: { name: 'CurrentsAPI', raw: 0, filtered: 0, dailyLimit: '1000 requests' }
    };

    for (const user of config.users) {
        const domains = user.sources.map(s => SOURCES_REGISTRY[s]?.domain).filter(Boolean).join(',');
        console.log(`\n> Analyzing for User: ${user.name} (Sources: ${user.sources.join(', ')})`);

        // NewsAPI
        const ra1 = await fetchNewsAPI(domains);
        const f1 = filterArticles(ra1);
        report.newsapi.raw += ra1.length;
        report.newsapi.filtered += f1.length;
        console.log(`  [NewsAPI] Found ${ra1.length} raw, ${f1.length} after Tech-filtering`);

        // NewsData
        const ra2 = await fetchNewsData(domains);
        const f2 = filterArticles(ra2);
        report.newsdata.raw += ra2.length;
        report.newsdata.filtered += f2.length;
        console.log(`  [NewsData] Found ${ra2.length} raw, ${f2.length} after Tech-filtering`);

        // Currents
        const ra3 = await fetchCurrents(domains);
        const f3 = filterArticles(ra3);
        report.currents.raw += ra3.length;
        report.currents.filtered += f3.length;
        console.log(`  [Currents] Found ${ra3.length} raw, ${f3.length} after Tech-filtering`);
    }

    console.log('\n--- FINAL COMPARISON REPORT ---');
    console.table(report);

    console.log('\nEVALUATION:');
    console.log('1. NewsAPI.org: Excellent coverage for US/Global tech, but strict daily limits (100) and excludes description content in Free tier sometimes.');
    console.log('2. NewsData.io: Best for Pakistan-specific news (Dawn, Business Recorder) and specific domain filtering. However, "size" limit of 10 per request is tight.');
    console.log('3. CurrentsAPI: High daily limit (1000). Good for general tech but domain-filtering can be less precise than NewsData.');

    console.log('\nRECOMMENDATION:');
    if (report.currents.filtered >= report.newsdata.filtered && report.currents.filtered >= report.newsapi.filtered) {
        console.log('RECOMMENDED: CurrentsAPI for its massive 1000 daily limit and solid tech coverage.');
    } else {
        console.log('RECOMMENDED: NewsData.io (Current default) for its superior handling of Pakistan business domains and focused domain-filtering.');
    }
}

runComparison();
