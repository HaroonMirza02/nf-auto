require('dotenv').config();

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const MODEL = 'gemini-2.5-flash';
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

        const prompt = `You are a professional news editor writing a daily digest email for a business audience.

Below are today's news articles for the category: ${category.label}

${articleList}

Instructions:
- Write a clean HTML list using only <ul> and <li> tags
- For each article write exactly 2 to 3 short sentences summarizing only the key facts
- The tone must be human, concise, and easy to scan
- Focus on what happened, why it matters, and who is affected
- After each summary include the source name and a link formatted as: <a href="EXACT_URL_FROM_ABOVE">Read more</a>
- Use the exact URLs provided above
- Do not return markdown, backticks, or any text outside the HTML elements
- Do not add headings or extra text`;

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

        // 2000ms delay for Google AI (limits are usually generous)
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return summarizedResults;
}

module.exports = { summarizeAll };
