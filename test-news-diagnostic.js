const KEYS = {
    newsapi: 'e65916715c1b42c19f2272660800f4d6',
    newsdata: 'pub_506529ffe6084ddebe6dc7b3b8a50ce9',
    currents: 'RCUCqGkcac9z3WrppBfF2Ln9oJLE826LgIfzVS0OhsGHcI3o'
};

async function testSingle() {
    const domains = 'techcrunch.com,reuters.com';

    console.log('Testing NewsData.io...');
    const r1 = await fetch(`https://newsdata.io/api/1/news?apikey=${KEYS.newsdata}&domainurl=${domains}&language=en`).then(r => r.json());
    console.log(`NewsData: Found ${r1.results?.length || 0} articles`);

    console.log('\nTesting CurrentsAPI...');
    // Currents uses 'domain' but sometimes it's picky. Let's try 'keywords' instead as a fallback?
    const r2 = await fetch(`https://api.currentsapi.services/v1/search?apiKey=${KEYS.currents}&domain=${domains}&language=en`).then(r => r.json());
    console.log(`Currents: Found ${r2.news?.length || 0} articles`);
    if (r2.news?.length > 0) console.log('Sample Currents Title:', r2.news[0].title);

    console.log('\nTesting NewsAPI.org...');
    const r3 = await fetch(`https://newsapi.org/v2/everything?domains=${domains}&language=en&apiKey=${KEYS.newsapi}`).then(r => r.json());
    console.log(`NewsAPI: Found ${r3.articles?.length || 0} articles`);
}

testSingle();
