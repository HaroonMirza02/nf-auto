require('dotenv').config();

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`;

async function summarizeAll(collectedData) {
    const summarizedResults = [];

    for (const item of collectedData) {
        const { category, articles } = item;

        if (!articles || articles.length === 0) {
            summarizedResults.push({ label: category.label, html: `<p>No articles found for ${category.label} today.</p>` });
            continue;
        }

        const articleList = articles
            .map((a, i) => `${i + 1}. Title: ${a.title}\nSummary: ${a.description.substring(0, 400)}\nSource: ${a.source}\nURL: ${a.url}`)
            .join('\n\n');

        const prompt = `You are a professional tech editor. Create a ultra-concise daily digest.

Category: ${category.label}
Articles:
${articleList}

CRITICAL INSTRUCTIONS:
- Return ONLY a <ul> list with <li> items. 
- For each article, write EXACTLY ONE short sentence (max 18 words) focusing on TECH/BUSINESS value.
- YOU MUST BOLD exactly 2-3 key terms using HTML <b> tags (e.g. <b>Nvidia</b>).
- ABSOLUTELY NO markdown (no **), no code fences, no extra text.
- No job postings or recruitment mentions.
- If news is not tech-related, simplify it to its technical essence.
- After the sentence, add source and link: <a href="URL">Read more</a>
- Example: <b>Apple</b> is launching a new <b>AI chip</b> for the iPhone 17. TechCrunch: <a href="url">Read more</a>`;

        console.log(`[${new Date().toISOString()}] Summarizing category: ${category.label} using Google Gemini...`);

        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const data = await response.json();

            if (response.ok && data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                let html = data.candidates[0].content.parts[0].text;
                // Strip markdown fences
                html = html.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
                summarizedResults.push({ label: category.label, html });
            } else {
                const errorMsg = data.error ? data.error.message : 'Unknown Gemini error';
                console.warn(`[${new Date().toISOString()}] Gemini failed for ${category.label}: ${errorMsg}`);
                summarizedResults.push({
                    label: category.label,
                    html: `<p>Summary unavailable for ${category.label} — AI Error.</p>`
                });
            }

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Fetch error for ${category.label}:`, error.message);
            summarizedResults.push({
                label: category.label,
                html: `<p>Summary unavailable for ${category.label} — Network error.</p>`
            });
        }

        // Increase delay to 12s to safely stay under free-tier RPM limits
        await new Promise(resolve => setTimeout(resolve, 12000));
    }

    return summarizedResults;
}

module.exports = { summarizeAll };
