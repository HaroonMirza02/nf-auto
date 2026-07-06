function readMoreAnchor(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#3B82F6;text-decoration:none;">Read more ↗</a>`;
}

function replacePlaceholders(html, articles) {
    return html.replace(/\[READ_MORE:(\d+)\]/gi, (match, numStr) => {
        const idx = parseInt(numStr, 10) - 1;
        const article = articles[idx];
        if (article?.url) return readMoreAnchor(article.url);
        return '';
    });
}

function hasReadMoreLink(text) {
    return /<a\s[^>]*href=/i.test(text) || /Read more/i.test(text);
}

function injectMissingLinks(html, articles) {
    let articleIdx = 0;

    const appendLink = (content) => {
        if (hasReadMoreLink(content)) return content;
        const article = articles[articleIdx++];
        if (!article?.url) return content;
        return `${content} ${readMoreAnchor(article.url)}`;
    };

    // <li> items without links
    html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, content) => {
        if (hasReadMoreLink(content)) return match;
        const updated = appendLink(content.trimEnd());
        return `<li>${updated}</li>`;
    });

    // "Why this matters" lines (with or without <b> tags) missing links
    html = html.replace(
        /((?:<b>)?Why this matters:(?:<\/b>)?[^<\n]*)(?=\s*(?:<\/li>|<h3>|<\/ul>|<p>|$|\n\n))/gi,
        (match, impactLine) => {
            if (hasReadMoreLink(impactLine)) return match;
            return appendLink(impactLine);
        }
    );

    return html;
}

function injectReadMoreLinks(contentHtml, articles) {
    if (!contentHtml || !articles?.length) return contentHtml;

    let html = replacePlaceholders(contentHtml, articles);
    html = injectMissingLinks(html, articles);
    return html;
}

module.exports = { injectReadMoreLinks, readMoreAnchor };
