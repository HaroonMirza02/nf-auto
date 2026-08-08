/**
 * fetchStocks.js — NF Auto V2
 *
 * Handles market data for both US stocks (Finnhub) and PSX stocks.
 *
 * PSX V2 improvement:
 *   V1 used fully static prices hard-coded in config.json — staff had to
 *   manually edit the file every trading day. V2 adds fetchPSXStocks() which
 *   scrapes live price data from dps.psx.com.pk (PSX's official data portal,
 *   powered by capitalstake.com).
 *
 *   The scraper reads the company page HTML and extracts the last-traded price
 *   and previous-day close (LDCP). If the scrape fails for any ticker, it falls
 *   back to the static config.json value for that ticker. The orchestrator in
 *   digestPersonalized.js handles the full fallback chain.
 *
 *   See MARKET_DATA.md for a full options analysis and the roadmap to a proper
 *   commercial data feed.
 */

require('dotenv').config();

const FINNHUB_KEY = process.env.FINNHUB_KEY;

// In-session cache to avoid re-fetching the same ticker within one run
const usStockCache  = {};
const psxStockCache = {};

// ─── US Stocks (Finnhub) ─────────────────────────────────────────────────────

async function fetchUSStocks(tickers) {
    const results = {};

    for (const ticker of tickers) {
        if (usStockCache[ticker]) {
            console.log(`[fetchStocks] Using cached US data for ${ticker}`);
            results[ticker] = usStockCache[ticker];
            continue;
        }

        try {
            console.log(`[fetchStocks] Fetching US stock: ${ticker} (Finnhub)`);
            const url      = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
            const response = await fetch(url);
            const data     = await response.json();

            if (!data || data.c === 0 || data.c === null) {
                console.warn(`[fetchStocks] No data / rate limited on Finnhub for ${ticker}`);
                results[ticker] = nullStock();
                continue;
            }

            const stockData = {
                current: data.c.toFixed(2),
                prev:    data.pc.toFixed(2),
                diff:    data.d.toFixed(2),
                pct:     `${data.dp.toFixed(1)}%`
            };

            usStockCache[ticker] = stockData;
            results[ticker]      = stockData;

            await new Promise(r => setTimeout(r, 1000));

        } catch (err) {
            console.warn(`[fetchStocks] Finnhub failed for ${ticker}:`, err.message);
            results[ticker] = nullStock();
        }
    }

    return results;
}

function nullStock() {
    return { current: '0.00', prev: '0.00', diff: '0.00', pct: '0.0%' };
}

// ─── PSX Stocks — static fallback (V1 behaviour) ────────────────────────────

/**
 * Pure calculation from config.json static values.
 * Used as the final fallback when the live scraper fails.
 */
function calculatePSXStocks(psxStocks) {
    return psxStocks.map(stock => {
        const diff = stock.current_price - stock.prev_price;
        const pct  = stock.prev_price > 0
            ? ((diff / stock.prev_price) * 100).toFixed(1)
            : '0.0';
        return {
            ticker:  stock.ticker,
            current: stock.current_price.toFixed(2),
            prev:    stock.prev_price.toFixed(2),
            diff:    diff.toFixed(2),
            pct:     `${pct}%`
        };
    });
}

// ─── PSX Stocks — live scraper (V2) ─────────────────────────────────────────

/**
 * Scrapes live price data for PSX tickers from dps.psx.com.pk.
 *
 * Source: https://dps.psx.com.pk/company/<TICKER>
 * The page HTML contains the last-traded price and LDCP (Last Day Closing Price)
 * in plaintext within the rendered content (powered by capitalstake.com).
 *
 * IMPORTANT: This is a best-effort scraper, not a licensed data feed.
 * PSX explicitly states that commercial usage of their data requires prior
 * approval (marketdatarequest@psx.com.pk). This scraper is suitable for an
 * internal non-commercial daily briefing but must not be used for trading
 * systems or redistributed data products. See MARKET_DATA.md for alternatives.
 *
 * @param {object[]} psxStocks - Array from config.json { ticker, current_price, prev_price }
 * @returns {Promise<object[]>} - Array of { ticker, current, prev, diff, pct }
 */
async function fetchPSXStocks(psxStocks) {
    const results = [];

    for (const stock of psxStocks) {
        const { ticker } = stock;

        if (psxStockCache[ticker]) {
            console.log(`[fetchStocks] Using cached PSX data for ${ticker}`);
            results.push(psxStockCache[ticker]);
            continue;
        }

        try {
            console.log(`[fetchStocks] Fetching PSX live data for ${ticker}...`);
            const url      = `https://dps.psx.com.pk/company/${encodeURIComponent(ticker)}`;
            const response = await fetch(url, {
                headers: {
                    // Identify ourselves as a browser to avoid being blocked by basic UA checks
                    'User-Agent': 'Mozilla/5.0 (compatible; NF-Auto-Digest/2.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const data = parsePSXPage(html, ticker);

            if (data) {
                psxStockCache[ticker] = data;
                results.push(data);
                console.log(
                    `[fetchStocks] PSX ${ticker}: current=${data.current}, ` +
                    `prev=${data.prev}, diff=${data.diff} (${data.pct})`
                );
            } else {
                // Parse failed — fall back to static config value
                console.warn(`[fetchStocks] Could not parse PSX page for ${ticker}, using static value`);
                results.push(staticPSXEntry(stock));
            }

            // PSX portal is not a formal API — be polite with rate
            await new Promise(r => setTimeout(r, 800));

        } catch (err) {
            console.warn(`[fetchStocks] PSX scrape failed for ${ticker}: ${err.message} — using static value`);
            results.push(staticPSXEntry(stock));
        }
    }

    return results;
}

/**
 * Parses a dps.psx.com.pk company page and extracts current price and LDCP.
 *
 * The server-rendered HTML (not JS-hydrated) contains:
 *   <div class="quote__close">Rs.136.52</div>
 *   LDCP</div><div class="stats_value">136.57</div>
 *
 * @param {string} html   - Page HTML text
 * @param {string} ticker - For logging only
 * @returns {{ ticker, current, prev, diff, pct } | null}
 */
function parsePSXPage(html, ticker) {
    try {
        // Current price: inside quote__close div — "Rs.136.52"
        const currentMatch = html.match(/class="quote__close"[^>]*>\s*Rs\.([\d,]+(?:\.\d+)?)/);
        // LDCP: immediately after LDCP label in stats section
        const ldcpMatch    = html.match(/LDCP<\/div>\s*<div[^>]*>([\d,]+(?:\.\d+)?)<\/div>/);

        if (!currentMatch) {
            // Fallback: try bare Rs. pattern anywhere on page
            const bareRs = html.match(/Rs\.([\d,]+(?:\.\d+)?)/);
            const bareLdcp = html.match(/LDCP[^<]*<[^>]+>([\d,]+(?:\.\d+)?)/);
            if (!bareRs || !bareLdcp) return null;
            const current = parseFloat(bareRs[1].replace(/,/g, ''));
            const prev    = parseFloat(bareLdcp[1].replace(/,/g, ''));
            if (isNaN(current) || isNaN(prev) || current === 0) return null;
            return buildStockData(ticker, current, prev);
        }

        const current = parseFloat(currentMatch[1].replace(/,/g, ''));
        const prev    = ldcpMatch ? parseFloat(ldcpMatch[1].replace(/,/g, '')) : current;

        if (isNaN(current) || current === 0) return null;

        return buildStockData(ticker, current, prev);

    } catch {
        return null;
    }
}

function buildStockData(ticker, current, prev) {
    const diff = current - prev;
    const pct  = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '0.0';
    return {
        ticker,
        current: current.toFixed(2),
        prev:    prev.toFixed(2),
        diff:    diff.toFixed(2),
        pct:     `${pct}%`
    };
}

/**
 * Builds a PSX stock entry from static config.json values (V1 fallback).
 */
function staticPSXEntry(stock) {
    const diff = stock.current_price - stock.prev_price;
    const pct  = stock.prev_price > 0
        ? ((diff / stock.prev_price) * 100).toFixed(1)
        : '0.0';
    return buildStockData(stock.ticker, stock.current_price, stock.prev_price);
}

module.exports = { fetchUSStocks, calculatePSXStocks, fetchPSXStocks };
