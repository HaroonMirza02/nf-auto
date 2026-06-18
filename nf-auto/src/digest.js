require('dotenv').config();
const { collectAllCategories } = require('./newsCollector');
const { summarizeAll } = require('./summarizer');
const { buildEmail } = require('./emailBuilder');
const { sendDigest } = require('./mailer');

async function runDigest() {
    console.log(`[${new Date().toISOString()}] Starting NF AUTO digest run...`);

    try {
        // 1. News collection
        const collectedData = await collectAllCategories();
        console.log(`[${new Date().toISOString()}] News collection complete.`);

        // 2. Summarization
        const summarizedData = await summarizeAll(collectedData);
        console.log(`[${new Date().toISOString()}] Summarization complete.`);

        // 3. Build Email
        const emailHtml = buildEmail(summarizedData);
        console.log(`[${new Date().toISOString()}] Email built.`);

        // Save a local copy for inspection
        const fs = require('fs');
        const path = require('path');
        const outputPath = path.join(__dirname, '../data/latest_digest.html');
        fs.writeFileSync(outputPath, emailHtml);
        console.log(`[${new Date().toISOString()}] Local copy saved to: ${outputPath}`);

        // 4. Send Email
        await sendDigest(emailHtml);
        console.log(`[${new Date().toISOString()}] Digest sent successfully.`);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] CRITICAL ERROR in digest run:`, error.message);
        process.exit(1);
    }
}

module.exports = { runDigest };

// Call runDigest directly if being run as a script
if (require.main === module) {
    runDigest();
}
