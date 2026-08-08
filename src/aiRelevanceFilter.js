/**
 * aiRelevanceFilter.js — NF Auto V2
 *
 * AI-based relevance pass that runs AFTER keyword/word-boundary filtering and
 * BEFORE summarization. Gemini evaluates each remaining article in a single
 * batched prompt and returns a yes/no verdict with a one-line reason.
 *
 * ⚠️  CHECKPOINT — IBRAHIM REVIEW REQUIRED
 * The prompt wording below defines what counts as "relevant" for Vision71's
 * digest. This is business intelligence logic. The framing, the accept/reject
 * categories, and any future edits to the prompt MUST be reviewed with Ibrahim
 * before being treated as final. See ARCHITECTURE.md for the review checkpoint.
 *
 * Design:
 *   - Articles are batched into groups of up to BATCH_SIZE to stay within
 *     Gemini's output token budget and avoid individual per-article calls.
 *   - Each article is identified by a numeric index so the model's response
 *     can be parsed back into the original list without fragile string matching.
 *   - On any Gemini error or parse failure the filter falls back to INCLUDE
 *     (pass-through) so a bad AI response never silently deletes all news.
 *   - In DEBUG_MODE the full per-article verdict is logged to console.
 */

require('dotenv').config();

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const MODEL         = 'gemini-3.1-flash-lite';
const ENDPOINT      = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`;

const BATCH_SIZE    = 20;   // articles per Gemini call
const DEBUG_MODE    = process.env.NF_DEBUG === 'true';

// ─── Prompt template ─────────────────────────────────────────────────────────

/**
 * Builds the screening prompt for a batch of articles.
 *
 * ⚠️  CHECKPOINT: The INCLUDE/EXCLUDE criteria below are subject to Ibrahim review.
 *
 * @param {object[]} articles - Array of { title, description } objects
 * @returns {string}
 */
function buildScreeningPrompt(articles) {
    const articleLines = articles.map((a, i) =>
        `[${i + 1}] Title: ${a.title}\n    Description: ${a.description.substring(0, 200)}`
    ).join('\n\n');

    return `You are a content screener for a daily technology news digest sent to the team at Vision71, a technology-first company in Pakistan.

Your job: decide whether each article below is RELEVANT or IRRELEVANT for a technology-focused business audience.

INCLUDE if the article is about:
- Software, hardware, chips, semiconductors, or computing infrastructure
- Artificial intelligence, machine learning, or LLMs (including regulation, safety, products, or company activity)
- Cybersecurity, data privacy, or digital infrastructure
- Technology startups, VC funding, tech IPOs, tech M&A, or tech company earnings
- Pakistan's technology sector, IT exports, fintech, telecom, or digital economy
- Global technology policy, chip export controls, cross-border digital trade
- Robotics, drones, satellites, quantum computing, or other emerging tech

EXCLUDE if the article is about:
- General war, military conflict, or geopolitical events with no direct technology angle
- Domestic politics, elections, or government affairs not related to technology
- Crime, law enforcement, or courts (unless it involves a major tech company or cybercrime)
- Sports, entertainment, celebrity news, fashion, or lifestyle
- General economics, inflation, or commodity prices with no technology company angle
- Public health, food, environment stories with no technology angle
- Press releases, market size forecasts, or CAGR reports

For each article, respond ONLY with lines in this exact format (no extra text, no markdown):
[N] INCLUDE: <one-line reason>
OR
[N] EXCLUDE: <one-line reason>

Articles to screen:

${articleLines}`;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parses Gemini's response text into an array of verdicts indexed to the
 * original batch positions.
 *
 * @param {string}   responseText
 * @param {number}   batchSize
 * @returns {{ include: boolean, reason: string }[]}
 */
function parseVerdicts(responseText, batchSize) {
    const verdicts = Array.from({ length: batchSize }, () => ({
        include: true,     // default: include on parse failure
        reason:  'INCLUDE: parse fallback (no verdict found in AI response)'
    }));

    const lineRe = /^\[(\d+)\]\s+(INCLUDE|EXCLUDE):\s*(.+)$/i;
    for (const line of responseText.split('\n')) {
        const match = line.trim().match(lineRe);
        if (!match) continue;
        const idx    = parseInt(match[1], 10) - 1;  // convert 1-based to 0-based
        const action = match[2].toUpperCase();
        const reason = match[3].trim();
        if (idx >= 0 && idx < batchSize) {
            verdicts[idx] = { include: action === 'INCLUDE', reason };
        }
    }

    return verdicts;
}

// ─── Gemini call ─────────────────────────────────────────────────────────────

/**
 * Sends one batch of articles to Gemini and returns verdict objects.
 * Falls back to all-INCLUDE on any error.
 *
 * @param {object[]} batch  - Array of article objects
 * @returns {Promise<{ include: boolean, reason: string }[]>}
 */
async function screenBatch(batch) {
    const prompt = buildScreeningPrompt(batch);

    try {
        const response = await fetch(ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature:     0.1,   // low temp for consistent yes/no decisions
                    maxOutputTokens: 1024
                }
            })
        });

        const data = await response.json();

        if (response.status === 429 || data.error?.code === 429) {
            console.warn(`[aiRelevanceFilter] Gemini quota hit — passing batch through unfiltered`);
            return batch.map(() => ({ include: true, reason: 'INCLUDE: AI quota fallback' }));
        }

        if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const errMsg = data.error?.message || 'Unknown error';
            console.warn(`[aiRelevanceFilter] Gemini error: ${errMsg} — passing batch through`);
            return batch.map(() => ({ include: true, reason: 'INCLUDE: AI error fallback' }));
        }

        const responseText = data.candidates[0].content.parts[0].text;
        return parseVerdicts(responseText, batch.length);

    } catch (err) {
        console.error(`[aiRelevanceFilter] Network error: ${err.message} — passing batch through`);
        return batch.map(() => ({ include: true, reason: 'INCLUDE: network error fallback' }));
    }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Runs the AI relevance pass on an array of articles.
 * Returns only the articles Gemini marks as INCLUDE.
 *
 * @param {object[]} articles   - Pre-filtered articles (keyword filter already applied)
 * @param {string}   userLabel  - Used in log lines (e.g. user name)
 * @returns {Promise<object[]>} - Subset of articles deemed relevant
 */
async function runAiRelevanceFilter(articles, userLabel = 'unknown') {
    if (!GOOGLE_AI_KEY) {
        console.warn(`[aiRelevanceFilter] GOOGLE_AI_KEY missing — skipping AI filter for ${userLabel}`);
        return articles;
    }

    if (articles.length === 0) return articles;

    console.log(
        `[aiRelevanceFilter:${userLabel}] Screening ${articles.length} articles ` +
        `in batches of ${BATCH_SIZE}...`
    );

    const kept    = [];
    let batchNum  = 0;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
        const batch    = articles.slice(i, i + BATCH_SIZE);
        batchNum++;
        const verdicts = await screenBatch(batch);

        for (let j = 0; j < batch.length; j++) {
            const article = batch[j];
            const verdict = verdicts[j];

            if (DEBUG_MODE || verdict.reason.includes('fallback')) {
                console.log(
                    `[aiRelevanceFilter:${userLabel}] [${verdict.include ? 'KEEP' : 'DROP'}] ` +
                    `"${article.title.substring(0, 60)}..." — ${verdict.reason}`
                );
            }

            if (verdict.include) {
                kept.push({ ...article, _aiReason: verdict.reason });
            }
        }

        // Small delay between batches to avoid Gemini rate limits
        if (i + BATCH_SIZE < articles.length) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    const dropped = articles.length - kept.length;
    console.log(
        `[aiRelevanceFilter:${userLabel}] Done: ${kept.length} kept, ${dropped} dropped ` +
        `(${Math.round((dropped / articles.length) * 100)}% rejection rate)`
    );

    return kept;
}

module.exports = { runAiRelevanceFilter, buildScreeningPrompt };
