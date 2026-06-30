// Netlify uses Node 18+, so fetch is available globally
exports.handler = async (event) => {
    // 1. Handle Stock Search
    if (event.path.includes('search-stocks')) {
        const query = event.queryStringParameters.q;
        const token = process.env.FINNHUB_KEY;

        try {
            const res = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${token}`);
            const data = await res.json();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            };
        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
        }
    }

    // 2. Handle Config Updates (to avoid 409 Conflict)
    if (event.path.includes('update-config') && event.httpMethod === 'POST') {
        const { userId, updatedData } = JSON.parse(event.body);
        const REPO = process.env.VITE_GITHUB_REPO;
        const TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
        const BRANCH = process.env.VITE_GITHUB_BRANCH || 'main';
        const URL = `https://api.github.com/repos/${REPO}/contents/config.json?ref=${BRANCH}`;

        try {
            // Always get the FRESH version before updating to avoid 409
            const getRes = await fetch(URL, {
                headers: { Authorization: `Bearer ${TOKEN}` }
            });
            const fileData = await getRes.json();
            const config = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

            // Merge changes
            config.users = config.users.map(u =>
                u.id === userId ? { ...u, ...updatedData } : u
            );
            config.lastUpdated = new Date().toISOString();

            // Push back to GitHub
            const putRes = await fetch(URL, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update config for ${userId} via proxy`,
                    content: Buffer.from(JSON.stringify(config, null, 2)).toString('base64'),
                    sha: fileData.sha,
                    branch: BRANCH
                })
            });

            if (putRes.ok) {
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            } else {
                const errData = await putRes.json();
                return { statusCode: putRes.status, body: JSON.stringify(errData) };
            }
        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
        }
    }

    // 3. Read latest config.json from GitHub
    if (event.path.includes('get-config') && event.httpMethod === 'GET') {
        const REPO = process.env.VITE_GITHUB_REPO;
        const TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
        const BRANCH = process.env.VITE_GITHUB_BRANCH || 'main';
        const URL = `https://api.github.com/repos/${REPO}/contents/config.json?ref=${BRANCH}`;

        try {
            const res = await fetch(URL, {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            });

            if (!res.ok) {
                const errData = await res.json();
                return { statusCode: res.status, body: JSON.stringify(errData) };
            }

            const data = await res.json();
            const currentConfig = JSON.parse(Buffer.from(data.content, 'base64').toString());
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentConfig)
            };
        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 404, body: "Not Found" };
};
