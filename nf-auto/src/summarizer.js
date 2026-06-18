require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

async function summarizeAll(collectedData) {
    const summarizedResults = [];

    for (const item of collectedData) {
        const { category, articles } = item;

        if (!articles || articles.length === 0) {
            summarizedResults.push({ label: category.label, html: `<p>No articles found for ${category.label} today.</p>` });
            continue;
        }

        console.log(`[${new Date().toISOString()}] Summarizing category: ${category.label} using GPT-4o...`);

        const articleList = articles
            .map((a, i) => `${i + 1}. Title: ${a.title}\nSummary: ${a.description.substring(0, 400)}\nSource: ${a.source}\nURL: ${a.url}`)
            .join('\n\n');

        const prompt = `You are a professional news digest writer.

Below are today's news articles for the category: ${category.label}

${articleList}

Write a concise HTML digest for this category. Follow these rules exactly:
- Use only <ul> and <li> tags
- Each <li> must contain: a 1-2 sentence plain English summary of the story, followed by the source name and a clickable link as <a href="URL">Read more</a>
- Use the exact URLs provided above. Do not change, shorten, or invent any URLs
- Do not include any markdown, backticks, code fences, or text outside the HTML
- Do not add headings or labels inside the list
- Keep each item brief and scannable`;

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
                    model: 'openai/gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 800
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error(`[${new Date().toISOString()}] OpenRouter Error for ${category.label}:`, JSON.stringify(data.error));
                summarizedResults.push({ label: category.label, html: `<p>Summary unavailable (API Error).</p>` });
            } else if (data.choices && data.choices.length > 0) {
                let html = data.choices[0].message.content;
                // Strip markdown fences
                html = html.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
                summarizedResults.push({ label: category.label, html });
            } else {
                summarizedResults.push({ label: category.label, html: `<p>Summary unavailable for ${category.label}.</p>` });
            }

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Summarization failed for ${category.label}:`, error.message);
            summarizedResults.push({ label: category.label, html: `<p>Summary error for ${category.label}.</p>` });
        }

        // 5000ms delay between each category summarization to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return summarizedResults;
}

module.exports = { summarizeAll };
