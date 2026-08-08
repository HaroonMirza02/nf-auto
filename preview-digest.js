/**
 * preview-digest.js
 *
 * Local dry run of the news-fetching stage of the digest pipeline.
 * Fetches and categorizes news for every configured user, exactly the way
 * digestPersonalized.js does, but:
 *   - never calls the mailer (no email is sent)
 *   - never touches data/latest_digest.html
 *   - prints the fetched articles per user/category straight to the terminal
 *
 * Usage:
 *   node preview-digest.js                 -> raw fetched articles only
 *   node preview-digest.js --with-summary   -> also runs the Gemini step and
 *                                              prints the final digest text
 *                                              (uses your GOOGLE_AI_KEY quota)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SOURCES = require('./src/sources');
const { fetchUserNews } = require('./src/fetchUserNews');

const WITH_SUMMARY = process.argv.includes('--with-summary');

const CATEGORIES = ['Global News', 'Pakistan News', 'Technology', 'AI', 'Business'];

function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error(`Fatal: config.json not found at ${configPath}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function printArticle(article, index) {
    console.log(`   ${index + 1}. ${article.title}`);
    console.log(`      Source: ${article.source}`);
    console.log(`      URL:    ${article.url}`);
}

async function previewUser(user, globalSeenUrls) {
    console.log('\n' + '='.repeat(70));
    console.log(`USER: ${user.name}  (${user.email})`);
    console.log(`Configured sources: ${user.sources.map(id => SOURCES[id]?.label || id).join(', ')}`);
    console.log('='.repeat(70));

    let articles;
    try {
        articles = await fetchUserNews(user.sources);
    } catch (err) {
        console.error(`  fetchUserNews failed for ${user.name}: ${err.message}`);
        return;
    }

    // Mirror the cross-user dedupe that digestPersonalized.js applies
    articles = articles.filter(a => {
        if (globalSeenUrls.has(a.url)) return false;
        globalSeenUrls.add(a.url);
        return true;
    });

    const byCategory = {};
    CATEGORIES.forEach(c => (byCategory[c] = []));
    articles.forEach(a => {
        const cat = a.assignedCategory || 'Global News';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(a);
    });

    let emptyCategories = 0;
    CATEGORIES.forEach(category => {
        const items = byCategory[category] || [];
        console.log(`\n-- ${category} (${items.length}/3) ${items.length === 0 ? '⚠️  EMPTY' : ''}`);
        if (items.length === 0) {
            emptyCategories++;
        } else {
            items.forEach((a, i) => printArticle(a, i));
        }
    });

    console.log(`\nCoverage: ${CATEGORIES.length - emptyCategories}/${CATEGORIES.length} categories filled, ${articles.length} total articles`);

    if (WITH_SUMMARY) {
        const { fetchUSStocks, calculatePSXStocks } = require('./src/fetchStocks');
        const { buildUserPrompt } = require('./src/buildUserPrompt');
        const { summarizeForUser } = require('./src/summarizeForUser');

        console.log('\n--- Generating Gemini summary (uses API quota) ---');
        const usStockData = await fetchUSStocks(user.us_stocks);
        const psxData = calculatePSXStocks(user.psx_stocks);
        const prompt = buildUserPrompt(user, articles, psxData, usStockData);
        const html = await summarizeForUser(user.name, prompt);
        console.log('\n--- FINAL DIGEST TEXT (would be emailed) ---');
        console.log(html);
    }
}

async function run() {
    const config = loadConfig();
    const globalSeenUrls = new Set();

    console.log(`Dry run started — ${config.users.length} user(s), no email will be sent.`);
    if (WITH_SUMMARY) {
        console.log('(--with-summary enabled: this will also call the Gemini API)');
    }

    for (const user of config.users) {
        await previewUser(user, globalSeenUrls);
        // Same cooldown digestPersonalized.js uses, to avoid API pressure
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(70));
    console.log('Dry run complete. Nothing was emailed or written to data/latest_digest.html.');
    console.log('='.repeat(70));
}

run();