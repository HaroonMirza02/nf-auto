module.exports = [
  {
    id: 'global',
    label: 'Global News',
    queries: [
      { language: 'en', category: 'technology', q: 'innovation tech', size: 5 },
      { language: 'en', q: 'international energy tech', size: 5 },
      { language: 'en', q: 'global digital economy', size: 5 }
    ]
  },
  {
    id: 'pakistan',
    label: 'Pakistan News',
    queries: [
      { language: 'en', q: 'Pakistan technology Islamabad Karachi Lahore', size: 5 },
      { language: 'en', q: 'Pakistan startup ecosystem tech', size: 5 },
      { language: 'en', q: 'Pakistan digital transformation government', size: 5 }
    ]
  },
  {
    id: 'technology',
    label: 'Technology',
    queries: [
      { language: 'en', category: 'technology', size: 5 },
      { language: 'en', q: 'cutting edge software engineering innovation', size: 10 },
      { language: 'en', q: 'high-tech industry trends', size: 5 }
    ]
  },
  {
    id: 'ai',
    label: 'Artificial Intelligence',
    queries: [
      { language: 'en', q: 'artificial intelligence LLM machine learning', category: 'technology', size: 5 },
      { language: 'en', q: 'AI tools breakthrough research', size: 5 },
      { language: 'en', q: 'generative AI enterprise solutions', size: 5 }
    ]
  },
  {
    id: 'business',
    label: 'Business',
    queries: [
      { language: 'en', category: 'business', q: 'tech stocks finance', size: 5 },
      { language: 'en', q: 'venture capital tech startup funding', size: 5 },
      { language: 'en', q: 'energy technology oil gas innovation', size: 5 }
    ]
  }
];
