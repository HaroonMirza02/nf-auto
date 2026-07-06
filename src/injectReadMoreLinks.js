function formatReadMoreLink(article) {
    if (!article?.url) return '';
    return `<a href="${article.url}" target="_blank" rel="noopener noreferrer" style="color:#3B82F6;text-decoration:none;">Read more ↗</a>`;
}

const HAS_READ_MORE = /Read more/i;

function normalizeCategory(title) {
    return title.replace(/^\d+\.\s*/, '').trim();
}

function getLinkedUrls(html) {
    const urls = new Set();
    const re = /<a\s[^>]*href="([^"]+)"[^>]*>\s*Read more/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        urls.add(match[1]);
    }
    return urls;
}

function buildCategoryQueues(articles, linkedUrls) {
    const queues = {};
    for (const article of articles) {
        if (!article.url || linkedUrls.has(article.url)) continue;
        const category = article.assignedCategory || 'Global News';
        if (!queues[category]) queues[category] = [];
        queues[category].push(article);
    }
    return queues;
}

function injectReadMoreLinks(contentHtml, articles) {
    const linkedUrls = getLinkedUrls(contentHtml);
    const queues = buildCategoryQueues(articles, linkedUrls);

    return contentHtml.replace(
        /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi,
        (match, title, sectionContent) => {
            const category = normalizeCategory(title.replace(/<[^>]+>/g, ''));
            const updated = sectionContent.replace(
                /<li>([\s\S]*?)<\/li>/gi,
                (liMatch, inner) => {
                    if (HAS_READ_MORE.test(inner) || /limited coverage/i.test(inner)) {
                        return liMatch;
                    }
                    const queue = queues[category];
                    if (!queue?.length) return liMatch;
                    const article = queue.shift();
                    const link = formatReadMoreLink(article);
                    if (!link) return liMatch;
                    return `<li>${inner.trimEnd()} ${link}</li>`;
                }
            );
            return `<h3>${title}</h3>${updated}`;
        }
    );
}

module.exports = { formatReadMoreLink, injectReadMoreLinks };
