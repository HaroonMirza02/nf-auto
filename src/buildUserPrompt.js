const ALL_CATEGORIES = ['Global News', 'Pakistan News', 'Technology', 'AI', 'Business'];

function buildUserPrompt(user, articles, psxData, usStockData) {
  // Determine which categories actually have articles assigned to them
  const coveredCategories = new Set(articles.map(a => a.assignedCategory).filter(Boolean));

  // Only list the categories that have content — Gemini must not output
  // empty sections or "limited coverage" text for categories with no articles.
  // If a category has no articles at all, it is simply omitted from this digest.
  const activeCategories = ALL_CATEGORIES.filter(c => coveredCategories.has(c));

  const categoryList = activeCategories
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  const articleList = articles.map((a, i) =>
    `[Article ${i + 1}]
Category: ${a.assignedCategory || 'Global News'}
Title: ${a.title}
Source: ${a.source}
Context: ${a.description.substring(0, 300)}`
  ).join('\n\n');

  return `You are a crisp, senior analyst writing a daily technical briefing for ${user.name}.

STRICT RULES:
- NO greetings (Good Morning, Hello, etc.).
- NO closing or conversational filler.
- START IMMEDIATELY with the first category.

TODAY'S ACTIVE CATEGORIES (output ONLY these — in this order):
${categoryList}

CATEGORY DEFINITIONS (DO NOT DEVIATE):
- Global News: International tech policy, cross-border tech regulation, chip export controls, global tech trade, tech-sector diplomacy, foreign government AI/digital initiatives. NOT general geopolitics, wars, elections unless directly involving technology.
- Pakistan News: Pakistan's tech, telecom, fintech, IT-export, or digital-economy developments. NOT general Pakistani politics, non-tech economic news, or non-tech infrastructure.
- Technology: Software, hardware, chips, semiconductors, cloud, cybersecurity, startups, dev tools. NOT AI-specific news (that belongs in AI).
- AI: ONLY news directly about artificial intelligence — models (GPT, Gemini, Claude, LLM), AI regulation, AI company funding, AI products/deployments. Do NOT place finance or cyber news here to fill the slot.
- Business: Tech-sector business news — tech earnings, tech M&A, tech IPOs, VC funding in tech companies. NOT general market/economy news unrelated to technology.

STRICT CONTENT RULES:
- NEVER include sports, cricket, football, Olympics, entertainment, showbiz, celebrity, film, music news.
- NEVER include general war, military conflict, or election coverage unless it is specifically about technology's role (e.g. defense tech, cyberwarfare, export controls).
- ONLY include news from the articles provided below. DO NOT fabricate or infer from outside knowledge.
- Each article carries a Category hint — use it as the primary placement signal.
- Include up to 3 items per category, always at least 1 if any article is provided for it.
- DO NOT output any category that is not listed in TODAY'S ACTIVE CATEGORIES above.
- DO NOT output any "limited coverage", "no coverage", or "not available" text for any category.
  If a category has no articles, it simply does not appear in today's digest.

STRICT WRITING STYLE:
- News Item: MAX 1-2 lines summary. BOLD 2-3 key words using <b>HTML</b>.
- Impact line: New line starting with "<b>Why this matters:</b>" — MAX 1 line, NOT bold, specific to how it affects a technology company.
- At the end of each "Why this matters" line, write: [READ_MORE:N] where N is the Article number.

SOURCES: ${user.sources.join(', ')}

ARTICLES TO SUMMARIZE:
${articleList}

FORMATTING:
- <h3> for category titles.
- <ul> and <li> for news items.
- [READ_MORE:N] placeholder will be auto-replaced with the real article link.`;
}

module.exports = { buildUserPrompt };
