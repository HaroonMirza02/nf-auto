module.exports = [
  {
    id: 'global',
    label: 'Global News',
    queries: [
      { language: 'en', category: 'world', size: 5 },
      { language: 'en', q: 'international politics', size: 5 },
      { language: 'en', q: 'global economy', size: 5 }
    ]
  },
  {
    id: 'pakistan',
    label: 'Pakistan News',
    queries: [
      { language: 'en', country: 'pk', size: 5 },
      { language: 'en', q: 'Pakistan economy', size: 5 },
      { language: 'en', q: 'Pakistan government policy', size: 5 }
    ]
  },
  {
    id: 'technology',
    label: 'Technology',
    queries: [
      { language: 'en', category: 'technology', size: 5 },
      { language: 'en', q: 'software engineering', size: 5 },
      { language: 'en', q: 'tech industry startups', size: 5 }
    ]
  },
  {
    id: 'ai',
    label: 'Artificial Intelligence',
    queries: [
      { language: 'en', q: 'artificial intelligence', category: 'technology', size: 5 },
      { language: 'en', q: 'machine learning large language models', size: 5 },
      { language: 'en', q: 'AI tools products releases', size: 5 }
    ]
  },
  {
    id: 'business',
    label: 'Business',
    queries: [
      { language: 'en', category: 'business', size: 5 },
      { language: 'en', q: 'global markets finance', size: 5 },
      { language: 'en', q: 'startup funding venture capital', size: 5 }
    ]
  }
];
