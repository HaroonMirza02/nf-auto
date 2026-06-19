require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = [
    'openai/gpt-oss-120b:free',
    'nvidia/nemotron-3-ultra-253b-v1:free',
    'nvidia/nemotron-3-super-120b-a12b:free'
];

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
- The tone must be human, concise, and easy to scan — do not write like an AI summary, write like a smart editor would
- Avoid filler phrases like "In a recent development" or "It has been reported that"
- Focus on what happened, why it matters, and who is affected
- Keep the language simple and direct
- After each summary include the source name and a link formatted as:
  <a href="EXACT_URL_FROM_ABOVE">Read more</a>
- Use the exact URLs provided above. Do not shorten, modify, or invent any URL
- Do not return markdown, backticks, code fences, or any text outside the HTML elements
- Do not add headings, labels, or extra text inside or outside the list`;

        let succeeded = false;

        for (const model of MODELS) {
            console.log(`[${new Date().toISOString()}] Trying model: ${model} for category: ${category.label}`);

            try {
                const response = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/vision71tech/nf-auto',
                        'X-Title': 'NF AUTO Digest'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 600
                    })
                });

                const data = await response.json();

                const isFailed = !response.ok ||
                    data.error ||
                    !data.choices ||
                    data.choices.length === 0 ||
                    !data.choices[0].message.content ||
                    data.choices[0].message.content.trim() === "";

                if (isFailed) {
                    console.log(`[${new Date().toISOString()}] [WARN] Model ${model} failed for ${category.label}. Trying next fallback...`);
                    continue;
                }

                let html = data.choices[0].message.content;
                // Strip markdown fences
                html = html.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

                summarizedResults.push({ label: category.label, html });
                succeeded = true;
                break;

            } catch (error) {
                console.log(`[${new Date().toISOString()}] [ERROR] Model ${model} threw for ${category.label}: ${error.message}. Trying next fallback...`);
                continue;
            }
        }

        if (!succeeded) {
            summarizedResults.push({
                label: category.label,
                html: `<p>Summary unavailable for ${category.label} — all models exhausted.</p>`
            });
        }

        // 5000ms delay between each category summarization to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return summarizedResults;
}

module.exports = { summarizeAll };
