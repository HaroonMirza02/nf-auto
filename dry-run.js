/**
 * dry-run.js — NF Auto V2
 *
 * Runs the full digest pipeline (fetch → distribute → AI filter → summarize →
 * build email) but does NOT send the email. Output is saved to:
 *   data/dry-run-preview.html  — open in a browser to review the full digest
 *   data/dry-run-report.txt    — article counts, category breakdown per user,
 *                                pool stats, and any warnings
 *
 * Usage:
 *   node dry-run.js
 *
 * To also see per-article relevance audit logs:
 *   $env:NF_DEBUG="true"; node dry-run.js   (PowerShell)
 *   NF_DEBUG=true node dry-run.js            (bash/Linux)
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const SOURCES                    = require('./src/sources');
const { fetchNewsPool }          = require('./src/fetchNewsPool');
const { distributePool }         = require('./src/distributeArticles');
const { runAiRelevanceFilter }   = require('./src/aiRelevanceFilter');
const { fetchUSStocks,
        calculatePSXStocks,
        fetchPSXStocks }         = require('./src/fetchStocks');
const { buildUserPrompt }        = require('./src/buildUserPrompt');
const { summarizeForUser }       = require('./src/summarizeForUser');
const { buildEmail }             = require('./src/buildEmail');
const { formatReadMoreLink,
        injectReadMoreLinks }    = require('./src/injectReadMoreLinks');

const DEBUG_MODE = process.env.NF_DEBUG === 'true';

async function getPsxData(psxStocks) {
    try {
        const live = await fetchPSXStocks(psxStocks);
        if (live && live.length > 0) return live;
    } catch (err) {
        console.warn(`[dry-run] PSX live fetch failed, using static values:`, err.message);
    }
    return calculatePSXStocks(psxStocks);
}

async function runDryRun() {
    const runStart = Date.now();
    const report   = [];

    const log = (msg) => {
        console.log(msg);
        report.push(msg);
    };

    log('====================================================');
    log('  NF AUTO V2 — DRY RUN (no email will be sent)');
    log(`  ${new Date().toLocaleString()}`);
    log('====================================================\n');

    // Load config
    const configPath = path.join(__dirname, 'config.json');
    const config     = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const today      = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // ── Step 1: Fetch pool ────────────────────────────────────────────────
    log('── STEP 1: Consolidated pool fetch ──────────────────\n');
    const pool = await fetchNewsPool(config.users);
    log(`\nPool: ${pool.length} unique articles fetched\n`);

    // Pool source breakdown
    const sourceCounts = {};
    for (const a of pool) {
        sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
    }
    const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([src, n]) => `  ${src}: ${n}`)
        .join('\n');
    log(`Top sources in pool:\n${topSources}\n`);

    // ── Step 2: Distribute ────────────────────────────────────────────────
    log('── STEP 2: Pool distribution ────────────────────────\n');
    const userArticleMap = distributePool(config.users, pool, DEBUG_MODE);

    for (const user of config.users) {
        const arts = userArticleMap.get(user.id) || [];
        log(`  ${user.name}: ${arts.length} articles after keyword filter`);
    }
    log('');

    // ── Step 3: Per-user processing ───────────────────────────────────────
    log('── STEP 3: Per-user AI filter + summarization ───────\n');
    const userSections = [];
    const userReports  = [];

    for (const user of config.users) {
        log(`\n┌── ${user.name} ${'─'.repeat(Math.max(0, 44 - user.name.length))}`);

        try {
            let articles = userArticleMap.get(user.id) || [];
            log(`│  After keyword filter : ${articles.length} articles`);

            // AI filter
            articles = await runAiRelevanceFilter(articles, user.name);
            log(`│  After AI filter      : ${articles.length} articles`);

            // Category breakdown
            const byCat = {};
            for (const a of articles) {
                const cat = a.assignedCategory || 'Uncategorized';
                if (!byCat[cat]) byCat[cat] = [];
                byCat[cat].push(a.title);
            }
            for (const [cat, titles] of Object.entries(byCat)) {
                log(`│  ${cat} (${titles.length}):`);
                for (const t of titles) {
                    log(`│    • ${t.substring(0, 80)}`);
                }
            }

            if (articles.length === 0) {
                log(`│  ⚠️  WARNING: Zero articles survived for ${user.name} — digest will show fallback text`);
            }

            // Stocks
            const usStockData = await fetchUSStocks(user.us_stocks);
            const psxData     = await getPsxData(user.psx_stocks);

            // PSX values check — log each ticker's live price
            const psxSource = psxData.length > 0 ? 'dps.psx.com.pk (live with static fallback)' : 'none';
            log(`│  PSX data source      : ${psxSource}`);
            for (const p of psxData) {
                log(`│    ${p.ticker}: ${p.current} (prev ${p.prev}, ${p.pct})`);
            }

            // Summarize
            log(`│  Calling Gemini to summarize...`);
            const prompt     = buildUserPrompt(user, articles, psxData, usStockData);
            let contentHtml  = await summarizeForUser(user.name, prompt);

            // Inject links
            contentHtml = contentHtml.replace(/\[READ_MORE:(\d+)\]/gi, (match, numStr) => {
                const idx = parseInt(numStr, 10) - 1;
                return formatReadMoreLink(articles[idx]) || '';
            });
            contentHtml = injectReadMoreLinks(contentHtml, articles);

            // Check for fallback/error text in the output
            const hasFallback = /limited coverage|unavailable|no tech-relevant/i.test(contentHtml);
            if (hasFallback) {
                log(`│  ⚠️  NOTICE: Fallback/limited coverage text detected in output`);
            } else {
                log(`│  ✓  Content looks populated`);
            }

            userSections.push({
                id:           user.id,
                name:         user.name,
                email:        user.email,
                sourceLabels: user.sources.map(id => SOURCES[id]?.label || id).join(', '),
                psxTickers:   user.psx_stocks.map(s => s.ticker).join(', '),
                usTickers:    user.us_stocks.join(', '),
                psxData,
                usStockData,
                contentHtml
            });

            userReports.push({
                user:      user.name,
                afterKw:   (userArticleMap.get(user.id) || []).length,
                afterAi:   articles.length,
                byCat,
                hasFallback
            });

            log(`└── Done: ${user.name}`);

        } catch (err) {
            log(`└── ❌ ERROR for ${user.name}: ${err.message}`);
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

        await new Promise(r => setTimeout(r, 2000));
    }

    // ── Step 4: Build HTML (no send) ──────────────────────────────────────
    log('\n── STEP 4: Building email HTML ──────────────────────\n');
    const emailHtml = buildEmail(userSections, today);

    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    const previewPath = path.join(dataDir, 'dry-run-preview.html');
    fs.writeFileSync(previewPath, emailHtml);
    log(`✓  Preview saved: ${previewPath}`);

    // ── Summary report ────────────────────────────────────────────────────
    const elapsed = Math.round((Date.now() - runStart) / 1000);
    log('\n====================================================');
    log('  SUMMARY');
    log('====================================================');
    log(`  Run time      : ${elapsed}s`);
    log(`  Pool size     : ${pool.length} unique articles`);
    log('');
    log('  Per-user results:');

    for (const r of userReports) {
        const catSummary = Object.entries(r.byCat)
            .map(([c, arts]) => `${c.replace(' News', '').replace('Pakistan', 'PK')}:${arts.length}`)
            .join(' ');
        const flag = r.hasFallback ? ' ⚠️ fallback text detected' : ' ✓';
        log(`  ${r.user.padEnd(16)} kw:${r.afterKw} → ai:${r.afterAi}  [${catSummary}]${flag}`);
    }

    log('');
    log('  EMAIL NOT SENT — review the preview file above');
    log('  Open data/dry-run-preview.html in a browser to');
    log('  inspect the full digest before approving a live run.');
    log('====================================================\n');

    // Save the text report too
    const reportPath = path.join(dataDir, 'dry-run-report.txt');
    fs.writeFileSync(reportPath, report.join('\n'));
    console.log(`Report saved: ${reportPath}`);
}

runDryRun().catch(err => {
    console.error('\n❌ DRY RUN FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
