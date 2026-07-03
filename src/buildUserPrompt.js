function buildUserPrompt(user, articles, psxData, usStockData) {
  const articleList = articles.map((a, i) =>
    `[Article ${i + 1}]
Category: ${a.assignedCategory || 'Global News'}
Title: ${a.title}
Source: ${a.source}
Context: ${a.description.substring(0, 300)}`
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
- EVERY category must contain at least 1 item.
- Use the article "Category" hint first when placing items.
- If an item fits multiple categories, place it in the most relevant one only.

SOURCES: ${user.sources.join(', ')}

NEWS TO SUMMARIZE:
${articleList}

FORMATTING:
- <h3> for categories.
- <ul> and <li> for news items.
- At the end of the "Why this matters" line, write: [READ_MORE:N] where N is the Article number (e.g. [READ_MORE:1]).
- This placeholder will be replaced with the real article link automatically.
- Do NOT output "No news found" for any category.`;
}

module.exports = { buildUserPrompt };
