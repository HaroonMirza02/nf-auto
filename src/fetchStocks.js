require('dotenv').config();

const FINNHUB_KEY = process.env.FINNHUB_KEY;

// Global cache to save credits
const stockCache = {};

async function fetchUSStocks(tickers) {
    const results = {};

    for (const ticker of tickers) {
        // Check Cache first
        if (stockCache[ticker]) {
            console.log(`[${new Date().toISOString()}] Using cached data for ${ticker}`);
            results[ticker] = stockCache[ticker];
            continue;
        }

        try {
            console.log(`[${new Date().toISOString()}] Fetching US stock: ${ticker} (Finnhub)`);

            const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            // Finnhub returns { "c": 0, ... } if symbol not found or error
            if (!data || data.c === 0 || data.c === null) {
                console.warn(`[${new Date().toISOString()}] No data / Rate limited on Finnhub for ${ticker}`);
                results[ticker] = {
                    current: "0.00",
                    prev: "0.00",
                    diff: "0.00",
                    pct: "0.0%"
                };
                continue;
            }

            const current = data.c;
            const prev = data.pc;
            const diff = data.d;
            const pct = data.dp.toFixed(1);

            const stockData = {
                current: current.toFixed(2),
                prev: prev.toFixed(2),
                diff: diff.toFixed(2),
                pct: `${pct}%`
            };

            // Store in cache for this session
            stockCache[ticker] = stockData;
            results[ticker] = stockData;

            // Small 1s delay just to be safe, though limit is 60/min
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (err) {
            console.log(`[${new Date().toISOString()}] Finnhub failed for ${ticker}:`, err.message);
            results[ticker] = {
                current: "0.00",
                prev: "0.00",
                diff: "0.00",
                pct: "0.0%"
            };
        }
    }

    return results;
}

function calculatePSXStocks(psxStocks) {
    return psxStocks.map(stock => {
        const diff = stock.current_price - stock.prev_price;
        const pct = stock.prev_price > 0 ? ((diff / stock.prev_price) * 100).toFixed(1) : "0.0";
        return {
            ticker: stock.ticker,
            current: stock.current_price.toFixed(2),
            prev: stock.prev_price.toFixed(2),
            diff: diff.toFixed(2),
            pct: `${pct}%`
        };
    });
}

module.exports = { fetchUSStocks, calculatePSXStocks };
