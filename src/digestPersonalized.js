/**
 * digestPersonalized.js — NF Auto V2
 *
 * Top-level orchestrator for the personalized digest run.
 *
 * V2 changes vs V1:
 *   - Single consolidated fetch (fetchNewsPool) replaces per-user/per-category
 *     API calls. All users share one article pool fetched before the user loop.
 *   - distributeArticles() assigns articles to each user locally, with zero
 *     additional API calls. User processing order no longer affects quality.
 *   - globalSeenUrls progressive dedup REMOVED. The pool is deduplicated once
 *     in fetchNewsPool.js; the same article can appropriately appear in
 *     multiple users' digests if they both follow that story area.
 *   - Whole-word keyword matching (via distributeArticles.scoreArticle) replaces
 *     the old .includes() substring approach that caused false positives like
 *     "ai" matching inside "Ukrainian" or "app" inside "happened".
 *   - AI relevance pre-screening pass (aiRelevanceFilter) runs per user after
 *     keyword distribution and before Gemini summarization.
 *   - PSX stocks: now fetched via fetchPSXStocks (automated) with fallback to
 *     the static config.json values if the fetch fails.
 *
 * DEBUG MODE:
 *   Set NF_DEBUG=true in .env to enable per-article relevance audit logging.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const SOURCES                    = require('./sources');
const { fetchNewsPool }          = require('./fetchNewsPool');
const { distributePool }         = require('./distributeArticles');
const { runAiRelevanceFilter }   = require('./aiRelevanceFilter');
const { fetchUSStocks,
        calculatePSXStocks,
        fetchPSXStocks }         = require('./fetchStocks');
const { buildUserPrompt }        = require('./buildUserPrompt');
const { summarizeForUser }       = require('./summarizeForUser');
const { buildEmail }             = require('./buildEmail');
const { sendDigest }             = require('./mailer');
const { formatReadMoreLink,
        injectReadMoreLinks }    = require('./injectReadMoreLinks');

const DEBUG_MODE = process.env.NF_DEBUG === 'true';

async function runPersonalizedDigest() {
    const runStart = Date.now();
    console.log(`[${new Date().toISOString()}] ===== NF AUTO V2 DIGEST RUN STARTED =====`);

    // ── Load config ─────────────────────────────────────────────────────────
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error(`[${new Date().toISOString()}] Fatal: config.json not found at ${configPath}`);
        process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // ── Step 1: Single consolidated fetch ───────────────────────────────────
    // ONE pool for the whole team. This is the only point where NewsData.io
    // is called. Credit budget: ~9 credits per run (see fetchNewsPool.js).
    console.log(`[${new Date().toISOString()}] Step 1: Fetching consolidated article pool...`);
    const pool = await fetchNewsPool(config.users);
    console.log(`[${new Date().toISOString()}] Pool ready: ${pool.length} unique articles`);

    // ── Step 2: Distribute to all users (no API calls) ───────────────────────
    // Pool is distributed locally. Keyword filter and source-preference sorting
    // happen here. User processing order has ZERO effect on article availability.
    console.log(`[${new Date().toISOString()}] Step 2: Distributing pool to ${config.users.length} users...`);
    const userArticleMap = distributePool(config.users, pool, DEBUG_MODE);

    // ── Step 3: Per-user summarization loop ──────────────────────────────────
    const userSections = [];

    for (const user of config.users) {
        console.log(`\n[${new Date().toISOString()}] ── Processing user: ${user.name} ──`);

        try {
            // 3a. Get this user's distributed articles
            let articles = userArticleMap.get(user.id) || [];
            console.log(`[${new Date().toISOString()}] ${user.name}: ${articles.length} articles from pool distribution`);

            // 3b. AI relevance pre-screening pass
            //     ⚠️ CHECKPOINT: prompt wording flagged for Ibrahim review (see aiRelevanceFilter.js)
            articles = await runAiRelevanceFilter(articles, user.name);
            console.log(`[${new Date().toISOString()}] ${user.name}: ${articles.length} articles after AI filter`);

            // 3c. Fetch market data
            const usStockData = await fetchUSStocks(user.us_stocks);
            const psxData     = await getPsxData(user.psx_stocks);

            // 3d. Build prompt + summarize
            const prompt     = buildUserPrompt(user, articles, psxData, usStockData);
            let contentHtml  = await summarizeForUser(user.name, prompt);

            // 3e. Inject Read More links
            contentHtml = contentHtml.replace(/\[READ_MORE:(\d+)\]/gi, (match, numStr) => {
                const idx = parseInt(numStr, 10) - 1;
                return formatReadMoreLink(articles[idx]) || '';
            });
            contentHtml = injectReadMoreLinks(contentHtml, articles);

            userSections.push({
                id:           user.id,
                name:         user.name,
                email:        user.email,
                sourceLabels: user.sources
                                  .map(id => SOURCES[id]?.label || id)
                                  .join(', '),
                psxTickers:   user.psx_stocks.map(s => s.ticker).join(', '),
                usTickers:    user.us_stocks.join(', '),
                psxData,
                usStockData,
                contentHtml
            });

            console.log(`[${new Date().toISOString()}] Done: ${user.name}`);

        } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed for ${user.name}:`, err.message);
            userSections.push({
                id:           user.id,
                name:         user.name,
                email:        user.email,
                sourceLabels: '',
                psxTickers:   '',
                usTickers:    '',
                psxData:      [],
                usStockData:  {},
                contentHtml:  `<p>Digest unavailable for ${user.name} due to a processing error.</p>`
            });
        }

        // Small cooldown between users to space out Gemini summarization calls
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // ── Step 4: Assemble and send ─────────────────────────────────────────────
    console.log(`\n[${new Date().toISOString()}] Step 4: Assembling email...`);
    const emailHtml = buildEmail(userSections, today);

    const allEmails = [
        ...config.users.map(u => u.email),
        'az@vision71tech.com',
        'alitkzakaria@gmail.com',
        'zaid.sd@vision71tech.com'
    ].join(',');

    console.log(`[${new Date().toISOString()}] Sending digest to: ${allEmails}`);
    await sendDigest(emailHtml, allEmails, today);

    // Save for Admin Preview
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'latest_digest.html'), emailHtml);

    const elapsed = Math.round((Date.now() - runStart) / 1000);
    console.log(`\n[${new Date().toISOString()}] ===== V2 DIGEST RUN COMPLETE (${elapsed}s) =====`);
}

/**
 * PSX data helper: tries the live fetch first, falls back to config.json
 * static values if the live fetch fails or returns empty data.
 */
async function getPsxData(psxStocks) {
    try {
        // fetchPSXStocks returns an array in the same shape as calculatePSXStocks
        const live = await fetchPSXStocks(psxStocks);
        if (live && live.length > 0) return live;
    } catch (err) {
        console.warn(`[digestPersonalized] PSX live fetch failed, using static values:`, err.message);
    }
    return calculatePSXStocks(psxStocks);
}

module.exports = { runPersonalizedDigest };
