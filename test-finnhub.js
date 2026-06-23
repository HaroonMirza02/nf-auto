
const symbol = 'AAPL';
const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`;

async function testFinnhub() {
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('Finnhub Response for AAPL:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Finnhub Test Failed:', err.message);
    }
}

testFinnhub();
