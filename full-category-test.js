const KEYS = {
    newsapi: 'e65916715c1b42c19f2272660800f4d6',
    newsdata: 'pub_506529ffe6084ddebe6dc7b3b8a50ce9',
    currents: 'RCUCqGkcac9z3WrppBfF2Ln9oJLE826LgIfzVS0OhsGHcI3o'
};

const CATEGORIES = {
    GLOBAL: ['reuters.com', 'bloomberg.com', 'ft.com'],
    TECH: ['techcrunch.com', 'theverge.com'],
    PAKISTAN: ['dawn.com', 'brecorder.com', 'thenews.com.pk']
};

async function fetchFrom(api, domains) {
    try {
        if (api === 'newsdata') {
            const res = await fetch(`https://newsdata.io/api/1/news?apikey=${KEYS.newsdata}&domainurl=${domains}&language=en`).then(r => r.json());
            return (res.results || []).map(a => a.title);
        }
        if (api === 'newsapi') {
            const res = await fetch(`https://newsapi.org/v2/everything?domains=${domains}&language=en&pageSize=5&apiKey=${KEYS.newsapi}`).then(r => r.json());
            return (res.articles || []).map(a => a.title);
        }
        if (api === 'currents') {
            const res = await fetch(`https://api.currentsapi.services/v1/search?apiKey=${KEYS.currents}&domain=${domains}&language=en&limit=5`).then(r => r.json());
            return (res.news || []).map(a => a.title);
        }
    } catch (e) { return []; }
}

async function runFullComparison() {
    console.log('--- FINAL COMPREHENSIVE CATEGORY MATRIX ---');

    for (const [catName, domains] of Object.entries(CATEGORIES)) {
        console.log(`\n### CATEGORY: ${catName} (${domains.join(', ')})`);
        const domainStr = domains.join(',');

        const [nd, cs, na] = await Promise.all([
            fetchFrom('newsdata', domainStr),
            fetchFrom('currents', domainStr),
            fetchFrom('newsapi', domainStr)
        ]);

        console.log(`[NewsData] Found ${nd.length} articles. Top: ${nd[0] || 'N/A'}`);
        console.log(`[Currents] Found ${cs.length} articles. Top: ${cs[0] || 'N/A'}`);
        console.log(`[NewsAPI]  Found ${na.length} articles. Top: ${na[0] || 'N/A'}`);
    }
}

runFullComparison();
