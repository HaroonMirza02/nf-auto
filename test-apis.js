require('dotenv').config();
const fs = require('fs');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;

const lines = [];
const log = (msg) => { lines.push(msg); process.stdout.write(msg + '\n'); };

async function test() {
    log('\n=== KEY CHECK ===');
    log('NEWSDATA_API_KEY: ' + (NEWSDATA_API_KEY ? `SET (${NEWSDATA_API_KEY.substring(0, 8)}...)` : 'MISSING'));
    log('ALPHA_VANTAGE_KEY: ' + (ALPHA_VANTAGE_KEY ? `SET (${ALPHA_VANTAGE_KEY.substring(0, 8)}...)` : 'MISSING'));
    log('GOOGLE_AI_KEY: ' + (GOOGLE_AI_KEY ? `SET (${GOOGLE_AI_KEY.substring(0, 8)}...)` : 'MISSING'));

    log('\n=== TEST 1: NewsData.io (domain filter: reuters.com,techcrunch.com) ===');
    try {
        const url1 = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&language=en&domainurl=reuters.com,techcrunch.com&size=3`;
        const res1 = await fetch(url1);
        const data1 = await res1.json();
        log('HTTP Status: ' + res1.status);
        log('API Status: ' + data1.status);
        if (data1.status === 'success') {
            log('Articles returned: ' + data1.results?.length);
            log('First title: ' + (data1.results?.[0]?.title || 'none'));
        } else {
            log('Full error response: ' + JSON.stringify(data1));
        }
    } catch (e) {
        log('Exception: ' + e.message);
    }

    log('\n=== TEST 2: NewsData.io (q=technology, no domain) ===');
    try {
        const url2 = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&language=en&q=technology&size=3`;
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        log('HTTP Status: ' + res2.status);
        log('API Status: ' + data2.status);
        if (data2.status === 'success') {
            log('Articles returned: ' + data2.results?.length);
        } else {
            log('Full error response: ' + JSON.stringify(data2));
        }
    } catch (e) {
        log('Exception: ' + e.message);
    }

    log('\n=== TEST 3: Alpha Vantage (MSFT) ===');
    try {
        const url3 = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${ALPHA_VANTAGE_KEY}`;
        const res3 = await fetch(url3);
        const data3 = await res3.json();
        if (data3['Global Quote']?.['05. price']) {
            log('MSFT Price: ' + data3['Global Quote']['05. price']);
        } else if (data3.Information || data3.Note) {
            log('Rate Limited: ' + (data3.Information || data3.Note));
        } else {
            log('Unexpected: ' + JSON.stringify(data3));
        }
    } catch (e) {
        log('Exception: ' + e.message);
    }

    log('\n=== TEST 4: Gemini AI ===');
    try {
        const url4 = `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${GOOGLE_AI_KEY}`;
        const res4 = await fetch(url4, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: API_OK' }] }] })
        });
        const data4 = await res4.json();
        if (data4.candidates?.[0]?.content?.parts?.[0]?.text) {
            log('Gemini response: ' + data4.candidates[0].content.parts[0].text.trim());
        } else {
            log('Gemini error: ' + (data4.error?.message || JSON.stringify(data4)));
        }
    } catch (e) {
        log('Exception: ' + e.message);
    }

    log('\n=== DONE ===');
    fs.writeFileSync('test-report.txt', lines.join('\n'), 'utf8');
    log('Full report saved to test-report.txt');
}

test();
