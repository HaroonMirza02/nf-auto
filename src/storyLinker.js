/**
 * storyLinker.js — NF Auto V2 (Proof of Concept)
 *
 * Maintains a persistent story index across runs. Each article that passes
 * the relevance pipeline is compared against active stories; matching articles
 * are linked with a relation type (development, followup, consequence,
 * resolution, or origin). New stories are created for unmatched articles.
 *
 * See STORY_LINKING_DESIGN.md for the full design, data model, and roadmap.
 *
 * CURRENT LIMITATION: Story links are computed and stored in the article
 * objects (storyId, relation fields) but are not yet surfaced in the email
 * HTML. The prompt in buildUserPrompt.js would need updating to use them.
 * See REMAINING_RECOMMENDATIONS.md.
 *
 * PERSISTENCE LIMITATION: data/story-index.json is a local file. In the
 * GitHub Actions CI environment this resets every run. See design doc for
 * the recommended fix (commit index back to repo after each run).
 */

const fs   = require('fs');
const path = require('path');

const INDEX_PATH  = path.join(__dirname, '..', 'data', 'story-index.json');
const MAX_STORY_AGE_DAYS = 7;
const MATCH_THRESHOLD    = 0.25;   // Jaccard similarity threshold

// Common English stopwords that add noise to similarity scoring
const STOPWORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','shall',
    'its','it','this','that','these','those','their','they','them','he',
    'she','his','her','we','our','you','your','by','from','as','into',
    'up','out','about','over','after','before','than','more','also','just',
    'not','no','new','says','said','say','amid','amid','after','following'
]);

// ─── Token extraction ────────────────────────────────────────────────────────

/**
 * Extracts meaningful tokens from a text string.
 * Keeps words longer than 3 chars that aren't stopwords.
 */
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

/**
 * Jaccard similarity between two token arrays.
 */
function jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

// ─── Relation type detection ─────────────────────────────────────────────────

const RELATION_SIGNALS = {
    resolution:  ['resolved', 'cleared', 'approved', 'dropped', 'ends', 'cancels', 'cancelled', 'settled', 'closed'],
    consequence: ['impact', 'affects', 'affected', 'following', 'wake', 'reaction', 'responds', 'backlash', 'result'],
    followup:    ['responds', 'reacts', 'addresses', 'replies', 'statement', 'response', 'denies', 'confirms'],
    development: ['announces', 'launches', 'reveals', 'releases', 'updates', 'expands', 'raises', 'secures', 'plans']
};

function detectRelation(text) {
    const lower = text.toLowerCase();
    for (const [relation, signals] of Object.entries(RELATION_SIGNALS)) {
        if (signals.some(s => lower.includes(s))) return relation;
    }
    return 'development';  // default
}

// ─── Story ID generation ─────────────────────────────────────────────────────

function generateStoryId(article) {
    const tokens  = tokenize(`${article.title} ${article.description}`).slice(0, 4);
    const date    = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const slug    = tokens.join('_').substring(0, 40);
    return `story_${slug}_${date}`;
}

// ─── Index I/O ───────────────────────────────────────────────────────────────

function loadIndex() {
    try {
        if (fs.existsSync(INDEX_PATH)) {
            return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        }
    } catch (err) {
        console.warn(`[storyLinker] Could not load story index: ${err.message} — starting fresh`);
    }
    return { stories: {}, lastUpdated: null };
}

function saveIndex(index) {
    try {
        const dataDir = path.dirname(INDEX_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        index.lastUpdated = new Date().toISOString();
        fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    } catch (err) {
        console.warn(`[storyLinker] Could not save story index: ${err.message}`);
    }
}

// ─── Age pruning ─────────────────────────────────────────────────────────────

function pruneOldStories(index) {
    const cutoff  = Date.now() - MAX_STORY_AGE_DAYS * 24 * 60 * 60 * 1000;
    let pruned    = 0;
    for (const [id, story] of Object.entries(index.stories)) {
        if (new Date(story.updatedAt).getTime() < cutoff) {
            delete index.stories[id];
            pruned++;
        }
    }
    if (pruned > 0) {
        console.log(`[storyLinker] Pruned ${pruned} stories older than ${MAX_STORY_AGE_DAYS} days`);
    }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Links a set of articles to existing stories or creates new story entries.
 * Returns the articles with `storyId` and `relation` fields added.
 *
 * @param {object[]} articles
 * @returns {object[]} Articles with storyId and relation fields
 */
function linkArticlesToStories(articles) {
    const index = loadIndex();
    pruneOldStories(index);

    let linked  = 0;
    let created = 0;

    const enriched = articles.map(article => {
        const text   = `${article.title} ${article.description}`;
        const tokens = tokenize(text);
        let bestStoryId   = null;
        let bestScore     = 0;

        // Find best matching active story
        for (const [storyId, story] of Object.entries(index.stories)) {
            const storyTokens = tokenize(
                story.keyEntities.join(' ') + ' ' + story.title
            );
            const score = jaccardSimilarity(tokens, storyTokens);
            if (score > bestScore) {
                bestScore   = score;
                bestStoryId = storyId;
            }
        }

        if (bestScore >= MATCH_THRESHOLD && bestStoryId) {
            // Link to existing story
            const relation = detectRelation(text);
            const story    = index.stories[bestStoryId];
            story.updatedAt = new Date().toISOString();
            story.articles.push({
                url:         article.url,
                title:       article.title,
                publishedAt: article.publishedAt || new Date().toISOString().split('T')[0],
                relation,
                score:       Math.round(bestScore * 100) / 100
            });

            console.log(
                `[storyLinker] LINKED (${relation}, score=${bestScore.toFixed(2)}): ` +
                `"${article.title.substring(0, 60)}" → ${bestStoryId}`
            );
            linked++;

            return { ...article, storyId: bestStoryId, relation };

        } else {
            // Create new story
            const storyId = generateStoryId(article);
            index.stories[storyId] = {
                storyId,
                title:       article.title,
                createdAt:   new Date().toISOString(),
                updatedAt:   new Date().toISOString(),
                status:      'active',
                category:    article.assignedCategory || 'General',
                keyEntities: tokenize(text).slice(0, 10),
                articles: [{
                    url:         article.url,
                    title:       article.title,
                    publishedAt: article.publishedAt || new Date().toISOString().split('T')[0],
                    relation:    'origin',
                    score:       1.0
                }]
            };

            console.log(
                `[storyLinker] NEW STORY: "${article.title.substring(0, 60)}" → ${storyId}`
            );
            created++;

            return { ...article, storyId, relation: 'origin' };
        }
    });

    saveIndex(index);

    console.log(
        `[storyLinker] Run complete: ${linked} articles linked to existing stories, ` +
        `${created} new stories created. Index now has ${Object.keys(index.stories).length} stories.`
    );

    return enriched;
}

module.exports = { linkArticlesToStories };
