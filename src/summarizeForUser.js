require('dotenv').config();

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;

if (!GOOGLE_AI_KEY) {
    console.error('CRITICAL: GOOGLE_AI_KEY is missing from .env file');
}

const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`;

async function summarizeForUser(userName, prompt) {
    console.log(`[${new Date().toISOString()}] Summarizing for user: ${userName} using ${MODEL}...`);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (response.status === 429 || data.error?.code === 429) {
            console.warn(`[${new Date().toISOString()}] ${MODEL} quota exhausted for ${userName}:`, data.error?.message?.split('\n')[0]);
            return `<p><em>AI summary temporarily unavailable for ${userName} — quota exhausted. Please retry later.</em></p>`;
        }

        if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const errMsg = data.error?.message || 'Unknown error';
            console.warn(`[${new Date().toISOString()}] ${MODEL} failed for ${userName}: ${errMsg}`);
            return `<p><em>Summary unavailable for ${userName}.</em></p>`;
        }

        let html = data.candidates[0].content.parts[0].text;
        // Strip markdown fences and convert markdown bold to HTML <b>
        html = html.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        console.log(`[${new Date().toISOString()}] Summary successful for ${userName}`);
        return html;

    } catch (err) {
        console.error(`[${new Date().toISOString()}] Summarization network error for ${userName}:`, err.message);
        return `<p><em>Summary unavailable for ${userName} — network error.</em></p>`;
    }
}

module.exports = { summarizeForUser };
