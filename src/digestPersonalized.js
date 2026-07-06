require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SOURCES = require('./sources');
const { fetchUserNews } = require('./fetchUserNews');
const { fetchUSStocks,
    calculatePSXStocks } = require('./fetchStocks');
const { buildUserPrompt } = require('./buildUserPrompt');
const { summarizeForUser } = require('./summarizeForUser');
const { buildEmail } = require('./buildEmail');
const { sendDigest } = require('./mailer');
const { injectReadMoreLinks } = require('./injectReadMoreLinks');
const { buildFallbackContent } = require('./buildFallbackContent');

async function runPersonalizedDigest() {
    console.log(`[${new Date().toISOString()}] Starting personalized NF AUTO digest run...`);

    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error(`[${new Date().toISOString()}] Fatal: config.json not found at ${configPath}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const userSections = [];

    for (const user of config.users) {
        console.log(`[${new Date().toISOString()}] Processing user: ${user.name}`);

        try {
            const articles = await fetchUserNews(user.sources);

            const usStockData = await fetchUSStocks(user.us_stocks);
            const psxData = calculatePSXStocks(user.psx_stocks);

            let contentHtml;
            if (!articles.length) {
                console.warn(`[${new Date().toISOString()}] No articles for ${user.name} — using fallback content`);
                contentHtml = buildFallbackContent();
            } else {
                const prompt = buildUserPrompt(user, articles, psxData, usStockData);
                contentHtml = await summarizeForUser(user.name, prompt);

                if (!contentHtml || /please provide the articles/i.test(contentHtml)) {
                    console.warn(`[${new Date().toISOString()}] AI returned empty prompt for ${user.name} — retrying with fallback`);
                    contentHtml = buildFallbackContent();
                }

                contentHtml = injectReadMoreLinks(contentHtml, articles);
            }

            userSections.push({
                id: user.id,
                name: user.name,
                email: user.email,
                sourceLabels: user.sources
                    .map(id => SOURCES[id]?.label || id)
                    .join(', '),
                psxTickers: user.psx_stocks.map(s => s.ticker).join(', '),
                usTickers: user.us_stocks.join(', '),
                psxData,
                usStockData,
                contentHtml
            });

            console.log(`[${new Date().toISOString()}] Done processing: ${user.name}`);

        } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed for ${user.name}:`, err.message);

            userSections.push({
                id: user.id,
                name: user.name,
                email: user.email,
                sourceLabels: '',
                psxTickers: '',
                usTickers: '',
                psxData: [],
                usStockData: {},
                contentHtml: `<p>Digest unavailable for ${user.name} due to processing error.</p>`
            });
        }

        // Cooldown between user processing to avoid API pressure
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`[${new Date().toISOString()}] Assembling personalized email...`);
    const emailHtml = buildEmail(userSections, today);
    const allEmails = [...config.users.map(u => u.email), 'hm98756@gmail.com', 'hm051622@gmail.com'].join(',');


    console.log(`[${new Date().toISOString()}] Sending digest to: ${allEmails}`);
    await sendDigest(emailHtml, allEmails, today);

    // Save for Admin Preview
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'latest_digest.html'), emailHtml);

    console.log(`[${new Date().toISOString()}] Personalized Digest Run Complete.`);
}


module.exports = { runPersonalizedDigest };
