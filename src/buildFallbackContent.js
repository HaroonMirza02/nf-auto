const CATEGORIES = [
    'Global News',
    'Pakistan News',
    'Technology',
    'AI',
    'Business'
];

function buildFallbackContent() {
    return CATEGORIES.map(category => `
<h3>${category}</h3>
<ul><li>Limited coverage from selected sources today.</li></ul>`).join('\n');
}

module.exports = { buildFallbackContent };
