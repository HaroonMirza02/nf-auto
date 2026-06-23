const { runPersonalizedDigest } = require('./src/digestPersonalized');

console.log('--- NF AUTO TEST RUN STARTED ---');
console.log('This will fetch live news, stock data, and generate personalized summaries for all users.');
console.log('Please ensure your root .env file has all required API keys.');

runPersonalizedDigest()
    .then(() => {
        console.log('\n✅ TEST RUN SUCCESSFUL');
        console.log('The email has been sent to the addresses listed in config.json.');
    })
    .catch(err => {
        console.error('\n❌ TEST RUN FAILED');
        console.error(err.message);
        process.exit(1);
    });
