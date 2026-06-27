const KEYS = {
    newsapi: 'e65916715c1b42c19f2272660800f4d6',
    newsdata: 'pub_506529ffe6084ddebe6dc7b3b8a50ce9',
    currents: 'RCUCqGkcac9z3WrppBfF2Ln9oJLE826LgIfzVS0OhsGHcI3o'
};

async function showResults() {
    const domains = 'techcrunch.com,reuters.com,bloomberg.com';

    console.log('--- ACTUAL NEWS RESULTS PER API ---\n');

    // 1. NewsData.io
    try {
        const res = await fetch(`https://newsdata.io/api/1/news?apikey=${KEYS.newsdata}&domainurl=${domains}&language=en`).then(r => r.json());
        console.log('--- [NewsData.io] Top Results ---');
        (res.results || []).slice(0, 3).forEach((a, i) => console.log(`${i + 1}. ${a.title} (${a.source_id})`));
    } catch (e) { console.log('NewsData failed'); }

    console.log('\n');

    // 2. NewsAPI.org
    try {
        const res = await fetch(`https://newsapi.org/v2/everything?domains=${domains}&language=en&pageSize=3&apiKey=${KEYS.newsapi}`).then(r => r.json());
        console.log('--- [NewsAPI.org] Top Results ---');
        (res.articles || []).forEach((a, i) => console.log(`${i + 1}. ${a.title} (${a.source.name})`));
    } catch (e) { console.log('NewsAPI failed'); }

    console.log('\n');

    // 3. CurrentsAPI
    try {
        const res = await fetch(`https://api.currentsapi.services/v1/search?apiKey=${KEYS.currents}&domain=${domains}&language=en&limit=3`).then(r => r.json());
        console.log('--- [CurrentsAPI] Top Results ---');
        (res.news || []).forEach((a, i) => console.log(`${i + 1}. ${a.title} (${a.author})`));
    } catch (e) { console.log('CurrentsAPI failed'); }
}

showResults();
