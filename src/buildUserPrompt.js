function buildUserPrompt(user, articles, psxData, usStockData) {
    const articleList = articles.map((a, i) =>
        `[Article ${i + 1}]
Title: ${a.title}
Source: ${a.source}
Context: ${a.description.substring(0, 300)}
URL: ${a.url}`
    ).join('\n\n');

    return `You are a crisp, senior analyst writing a technical briefing for ${user.name}.

STRICT RULES:
- NO greetings (Good Morning, Hello, etc.).
- NO closing or conversational filler.
- START IMMEDIATELY with the categories.

CATEGORIES (Fixed):
1. Global News
2. Pakistan News
3. Technology
4. AI
5. Business

STRICT WRITING STYLE:
- News Item Limit: MAX 1-2 lines total for the summary.
- Bolding: BOLD exactly 2-3 most important words in the summary using <b>HTML tags</b>.
- Impact Section: 
  - MUST be on a NEW LINE (<br>).
  - Heading: "<b>Why this matters:</b>" (MUST be bold HTML).
  - Content: MAX 1 line total. NOT BOLD.
- NO news items about Sports, Showbiz, Fashion, or Celebs.
- If a category is empty of relevant news, write: "<ul><li>No news found today in this category.</li></ul>"

SOURCES: ${user.sources.join(', ')}

NEWS TO SUMMARIZE:
${articleList}

FORMATTING:
- <h3> for categories.
- <ul> and <li> for news items.
- Include link: <a href="URL">Read more</a> at the end of the "Why this matters" line.`;
}

module.exports = { buildUserPrompt };
