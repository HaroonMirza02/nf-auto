# Market Data — PSX Options Analysis

## Problem (V1)

PSX stock prices in V1 were fully static: `current_price` and `prev_price` were hardcoded numbers in `config.json` that someone on the team had to update manually before each run. Prices became stale immediately after the first daily run, and on weekends or missed edits they could be days out of date. There was no live data connection at all.

## Options Considered

### Option 1: Official PSX Data License

**Source:** `marketdatarequest@psx.com.pk`

The Pakistan Stock Exchange provides licensed real-time and delayed data feeds to commercial subscribers. This is the most reliable, compliant, and structured option.

**Tradeoffs:**
- Reliable and officially sanctioned
- Requires a formal data agreement — cost unknown but likely commercial pricing
- Takes time to negotiate and onboard
- Overkill for an internal morning digest with 5 tickers per user

**Verdict:** Right long-term option if Vision71 scales this or redistributes data, but not practical this sprint.

### Option 2: dps.psx.com.pk HTML Scraper (Implemented)

**Source:** `https://dps.psx.com.pk/company/<TICKER>`

PSX's official data portal renders company pages with the last-traded price and LDCP (Last Day Closing Price) in server-side HTML. The page is powered by capitalstake.com. A standard HTTP fetch retrieves the rendered HTML — no headless browser needed.

**How it works:**
```
GET https://dps.psx.com.pk/company/SYS
→ <div class="quote__close">Rs.136.52</div>
→ LDCP</div><div class="stats_value">136.57</div>
```

The scraper in `src/fetchStocks.js` (`fetchPSXStocks`) parses these two values to compute current price, LDCP (previous close), diff, and percentage change.

**Tradeoffs:**
- Works today with no registration or API key
- Returns the last-traded price as of the most recent market session
- Page structure could change if PSX redesigns their portal — would break the parser
- PSX's terms of service prohibit commercial redistribution of their data. This scraper is suitable for an internal non-commercial daily briefing, but must not be used for a publicly distributed product or a trading system without explicit PSX authorization
- Per-ticker HTTP fetch (~800ms each) — for 5 tickers this adds ~5s to the run, which is acceptable

**Verdict:** Best practical option for this sprint. Implemented and verified working.

**Observed live prices (2026-08-08 test run):**

| Ticker | V1 Static | V2 Live |
|---|---|---|
| SYS | 148.25 | 136.52 |
| NETSOL | 133.40 | 126.98 |
| LUCK | 485.48 | 458.75 |
| OGDC | 344.80 | 319.19 |
| PSO | 357.14 | 350.67 |
| SHSML | 394.24 | 381.96 |
| TRG | 66.68 | 63.29 |
| PTC | 65.58 | 72.41 |

The static V1 values were significantly wrong — in some cases more than 10% off current market price.

### Option 3: Third-party PSX Data APIs

Several third-party services aggregate PSX data:

**iTick (itick.org):** Multi-market data API that includes PSX. Has a documented REST API. Requires subscription — pricing not confirmed. Could be a suitable mid-term option if the scraper breaks.

**EODHD (eodhd.com):** Covers PSX tickers with the `.KAR` exchange suffix (e.g., `SYS.KAR`). Has a free tier with limited requests. More structured than scraping and less dependent on PSX's HTML layout.

**Yahoo Finance (unofficial):** Many open-source libraries wrap Yahoo Finance's internal API, which covers some PSX tickers. Not officially supported and has historically been rate-limited or broken without warning.

**Verdict for mid-term:** EODHD is the most viable third-party option if the scraper becomes unreliable. Free tier covers the team's ~15 tickers easily.

### Option 4: RSS/Manual Semi-automated Update

A script could scrape the PSX market summary page once per day and update `config.json` automatically before the digest runs. This is simpler than per-ticker scraping but gives end-of-day aggregate data rather than per-ticker current prices.

**Verdict:** Less useful than the current per-ticker scraper — not pursued.

---

## What Was Implemented (V2)

`src/fetchStocks.js` now exports `fetchPSXStocks(psxStocks)` which:
1. Makes an HTTP GET to `dps.psx.com.pk/company/<TICKER>` for each ticker
2. Parses `quote__close` for the current price and `stats_value` after `LDCP` for the previous close
3. Caches results in-session (subsequent users requesting the same ticker hit the cache, not the website again)
4. Falls back to `calculatePSXStocks()` (static config.json values) for any ticker where the scrape or parse fails

`digestPersonalized.js` calls `fetchPSXStocks` first and falls back to `calculatePSXStocks` if the whole call fails.

---

## What Would Be Needed for a Fully Live Long-Term Solution

1. **Official PSX data license** — contact `marketdatarequest@psx.com.pk` for commercial use or public distribution
2. **EODHD subscription** as a reliable third-party alternative that doesn't depend on PSX's HTML structure
3. **Resilient scraper monitoring** — add an alert if the scraper fails for more than 2 consecutive tickers (portal redesign detection)
4. **Market hours awareness** — currently the scraper runs at 07:30 PKT when the PSX is closed. The price shown is the last-traded price from the previous session (correct for a morning briefing). For intraday updates, the digest would need to run during PSX hours (09:30–15:30 PKT Monday–Friday)

---

## Config.json Migration Note

The `current_price` and `prev_price` fields in `config.json` are now fallback values only. They no longer need to be updated manually on a regular basis — the scraper keeps the displayed values current. They should still be updated occasionally (e.g., quarterly) to keep the fallback values approximately correct in case of extended scraper outages.
