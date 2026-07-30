'use strict';

/**
 * SEO state extractor + AI-powered analysis module.
 *
 * extractSEOState()  — reads meta tags / headings from repo source files
 * analyzeWithAI()    — sends GSC data + current SEO state to GPT-4o and
 *                      returns structured change recommendations
 */

const fs   = require('fs');
const path = require('path');

// ── File lists ────────────────────────────────────────────────────────────────

/** Main pages the agent reads SEO metadata from */
const MAIN_PAGES = [
  'landing-page/index.html',
  'landing-page/src/pages/Home.tsx',
  'landing-page/src/pages/Blog.tsx',
  'landing-page/src/pages/BlogPost.tsx',
  'landing-page/src/pages/PolitykaPrywatnosci.tsx',
  'landing-page/src/pages/Regulamin.tsx',
];

const BLOG_POSTS_DIR = 'landing-page/src/data/blogPosts';

// ── SEO extraction helpers ────────────────────────────────────────────────────

/** Extract SEO fields from a single file */
function extractFromFile(relPath, content) {
  const result = {
    file:          relPath,
    canonicalUrl:  null,
    title:         null,
    description:   null,
    ogTitle:       null,
    ogDescription: null,
    headings:      [],
  };

  if (relPath.endsWith('.html')) {
    // ── index.html ──────────────────────────────────────────────────────
    const m = (pattern) => (content.match(pattern) || [])[1] || null;

    result.title         = m(/<title>([\s\S]*?)<\/title>/);
    result.description   = m(/<meta\s+name="description"\s+content="([^"]+)"/);
    result.ogTitle       = m(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    result.ogDescription = m(/<meta\s+property="og:description"\s+content="([^"]+)"/);
    result.canonicalUrl  = m(/<link\s+rel="canonical"\s+href="([^"]+)"/);

    if (result.title) result.title = result.title.trim();

  } else if (relPath.endsWith('.tsx')) {
    // ── React components with react-helmet-async ────────────────────────
    const helmetBlock = (content.match(/<Helmet>([\s\S]*?)<\/Helmet>/) || [])[1] || '';
    const m = (src, pattern) => (src.match(pattern) || [])[1] || null;

    result.title         = m(helmetBlock, /<title>([\s\S]*?)<\/title>/);
    result.description   = m(helmetBlock, /<meta\s+name="description"\s+content="([^"]+)"/);
    result.ogTitle       = m(helmetBlock, /<meta\s+property="og:title"\s+content="([^"]+)"/);
    result.ogDescription = m(helmetBlock, /<meta\s+property="og:description"\s+content="([^"]+)"/);
    result.canonicalUrl  = m(helmetBlock, /<link\s+rel="canonical"\s+href="([^"]+)"/);

    if (result.title) result.title = result.title.trim();

    // Extract hardcoded h1/h2/h3 text (strips child JSX tags)
    for (const [, level, inner] of content.matchAll(/<h([123])[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) result.headings.push({ level: Number(level), text });
    }
  }

  return result;
}

/** Extract title/excerpt from blog post .ts files that appear in GSC data */
function extractBlogPosts(repoRoot, topUrls = []) {
  const blogDir = path.join(repoRoot, BLOG_POSTS_DIR);
  if (!fs.existsSync(blogDir)) return [];

  // Build set of slugs we care about (from top GSC URLs)
  const relevantSlugs = topUrls.length > 0
    ? new Set(
        topUrls
          .map((u) => (u.match(/\/blog\/([^/?#]+)/) || [])[1])
          .filter(Boolean)
      )
    : null; // null = include all

  const posts = [];

  for (const file of fs.readdirSync(blogDir).filter((f) => f.endsWith('.ts'))) {
    const slug = file.replace(/\.ts$/, '');
    if (relevantSlugs && !relevantSlugs.has(slug)) continue;

    const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');

    const sq  = (pattern) => (content.match(pattern) || [])[1] || null;
    const title   = sq(/title:\s*'([^']+)'/)   || sq(/title:\s*"([^"]+)"/);
    const excerpt = sq(/excerpt:\s*'([^']+)'/) || sq(/excerpt:\s*"([^"]+)"/);
    const category= sq(/category:\s*'([^']+)'/)|| sq(/category:\s*"([^"]+)"/);

    // First H2 from markdown content (gives AI context about the post)
    const contentBlock = (content.match(/content:\s*`([\s\S]*?)`/) || [])[1] || '';
    const firstH2 = (contentBlock.match(/^## (.+)$/m) || [])[1] || null;

    posts.push({
      file:     `${BLOG_POSTS_DIR}/${file}`,
      slug,
      url:      `https://allgrafika.pl/blog/${slug}`,
      title,
      excerpt,
      category,
      firstH2,
    });
  }

  return posts;
}

/**
 * Read current SEO state from the repository.
 *
 * @param {string}   repoRoot  - Absolute path to repo root
 * @param {string[]} topUrls   - Top page URLs from GSC (used to filter blog posts)
 * @returns {{ pages: Array, blogPosts: Array }}
 */
function extractSEOState(repoRoot, topUrls = []) {
  const pages = [];

  for (const relPath of MAIN_PAGES) {
    const fullPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    pages.push(extractFromFile(relPath, content));
  }

  const blogPosts = extractBlogPosts(repoRoot, topUrls);

  return { pages, blogPosts };
}

// ── Opportunity detection ─────────────────────────────────────────────────────

/**
 * Identify the most actionable SEO opportunities from raw GSC data.
 * Returns up to 10 issues, sorted by priority.
 */
function identifyOpportunities(gscData) {
  const { pages, queries } = gscData;
  if (!pages.length) return [];

  const avgCtr = pages.reduce((s, p) => s + p.ctr, 0) / pages.length;
  const issues = [];

  for (const page of pages) {
    if (page.impressions < 10) continue;

    const pageQueries = queries
      .filter((q) => q.page === page.url)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    // High impressions, low CTR → rewrite meta title/description
    if (page.impressions > 50 && page.ctr < avgCtr * 0.7) {
      issues.push({
        type:        'low_ctr',
        priority:    'high',
        page:        page.url,
        impressions: page.impressions,
        ctr:         page.ctr,
        avgCtr,
        topQueries:  pageQueries,
        recommendation:
          'Rewrite meta title/description to better match search intent and increase CTR.',
      });
    }

    // Positions 5–20 → ranking but not top-3, good optimization target
    if (page.position >= 5 && page.position <= 20 && page.impressions > 20) {
      issues.push({
        type:        'ranking_opportunity',
        priority:    page.position <= 10 ? 'high' : 'medium',
        page:        page.url,
        position:    page.position,
        impressions: page.impressions,
        topQueries:  pageQueries,
        recommendation:
          'Optimize meta title, H1, and description to improve organic ranking.',
      });
    }
  }

  // Deduplicate by page (keep highest-priority per page)
  const seen = new Map();
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  for (const issue of issues) {
    const existing = seen.get(issue.page);
    if (!existing || priorityOrder[issue.priority] < priorityOrder[existing.priority]) {
      seen.set(issue.page, issue);
    }
  }

  return [...seen.values()]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 10);
}

// ── AI prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(gscData, seoState, opportunities) {
  const { pages: gscPages, queries, dateRange } = gscData;

  const avgCtrPct = (gscPages.reduce((s, p) => s + p.ctr, 0) / gscPages.length * 100).toFixed(2);
  const avgPos    = (gscPages.reduce((s, p) => s + p.position, 0) / gscPages.length).toFixed(1);

  // ── Section 1: GSC overview ─────────────────────────────────────────────
  const gscSummary = gscPages
    .slice(0, 20)
    .map(
      (p) =>
        `  - ${p.url}\n` +
        `      impressions=${p.impressions}  clicks=${p.clicks}  CTR=${(p.ctr * 100).toFixed(1)}%  pos=${p.position.toFixed(1)}`
    )
    .join('\n');

  // ── Section 2: Current SEO state ───────────────────────────────────────
  const pagesSummary = seoState.pages
    .map((p) => {
      const lines = [`  FILE: ${p.file}`];
      if (p.canonicalUrl)  lines.push(`    canonical: ${p.canonicalUrl}`);
      if (p.title)         lines.push(`    title: ${p.title}`);
      if (p.description)   lines.push(`    description: ${p.description}`);
      if (p.ogTitle)       lines.push(`    og:title: ${p.ogTitle}`);
      if (p.ogDescription) lines.push(`    og:description: ${p.ogDescription}`);
      if (p.headings.length)
        lines.push(`    headings: ${p.headings.map((h) => `H${h.level}:"${h.text}"`).join(' | ')}`);
      return lines.join('\n');
    })
    .join('\n\n');

  // ── Section 3: Relevant blog posts ─────────────────────────────────────
  const blogSummary = seoState.blogPosts.length
    ? seoState.blogPosts
        .slice(0, 15)
        .map(
          (p) =>
            `  FILE: ${p.file}\n    url: ${p.url}\n    title: ${p.title}\n    excerpt: ${p.excerpt}`
        )
        .join('\n\n')
    : '  (no relevant blog posts found in top GSC pages)';

  // ── Section 4: Opportunities ────────────────────────────────────────────
  const issuesSummary = opportunities.length
    ? opportunities
        .map((issue, i) => {
          const topQ = (issue.topQueries || [])
            .map(
              (q) =>
                `"${q.query}" (${q.impressions} imp, ${(q.ctr * 100).toFixed(1)}% CTR, pos ${q.position.toFixed(1)})`
            )
            .join(', ');
          return (
            `  ${i + 1}. [${issue.priority.toUpperCase()}] ${issue.type} — ${issue.page}\n` +
            `     ${issue.recommendation}\n` +
            `     Top queries: ${topQ || 'N/A'}`
          );
        })
        .join('\n\n')
    : '  (no significant opportunities detected)';

  return `You are a senior SEO engineer and technical lead for AllGrafika.pl — a Polish AI tool for generating product photos for Allegro (Polish e-commerce platform).

TASK: Analyze the GSC data and propose specific, data-backed changes to improve SEO performance.

══════════════════════════════════════════════════════════════
GOOGLE SEARCH CONSOLE DATA (${dateRange.startDate} → ${dateRange.endDate})
══════════════════════════════════════════════════════════════
Average CTR: ${avgCtrPct}%
Average position: ${avgPos}

Top pages by impressions:
${gscSummary}

══════════════════════════════════════════════════════════════
CURRENT SEO STATE OF KEY PAGES
══════════════════════════════════════════════════════════════
${pagesSummary}

══════════════════════════════════════════════════════════════
RELEVANT BLOG POSTS (from top GSC pages)
══════════════════════════════════════════════════════════════
${blogSummary}

══════════════════════════════════════════════════════════════
IDENTIFIED SEO OPPORTUNITIES
══════════════════════════════════════════════════════════════
${issuesSummary}

══════════════════════════════════════════════════════════════
CHANGE RULES (follow strictly)
══════════════════════════════════════════════════════════════
ALLOWED change types:
  meta_title        – <title> tag or Helmet <title>
  meta_description  – meta name="description" content
  og_title          – meta property="og:title" content
  og_description    – meta property="og:description" content
  h1                – H1 heading text in JSX
  h2                – H2 heading text in JSX or blog markdown
  content_title     – blog post .ts file "title:" field
  content_excerpt   – blog post .ts file "excerpt:" field

HARD RULES:
1. Suggest at most 5 changes total.
2. Every change MUST cite real GSC numbers as evidence.
3. Do NOT change files with no GSC data.
4. meta_title: 50–70 characters, main keyword near the start.
5. meta_description: 145–160 characters, includes CTA, matches search intent.
6. og_title / og_description: mirror the meta equivalents.
7. The "old" field MUST be the exact substring currently present in the file
   (copy-paste from the CURRENT SEO STATE section above).
8. The "new" field must be plain text — no HTML tags, no scripts, no JS.
9. content_excerpt changes: 145–165 characters.
10. If no change is strongly justified by data, return an empty changes array.

══════════════════════════════════════════════════════════════
RESPONSE FORMAT — raw JSON only (no markdown, no code fences)
══════════════════════════════════════════════════════════════
{
  "analysis": {
    "summary": "2-3 sentence summary of the main findings.",
    "avg_ctr_percent": 5.2,
    "avg_position": 12.3,
    "top_opportunity": "One sentence describing the single best improvement opportunity."
  },
  "changes": [
    {
      "file": "landing-page/src/pages/Home.tsx",
      "type": "meta_title",
      "old": "EXACT current string (copied verbatim from file)",
      "new": "Improved replacement string",
      "reason": "Specific reason referencing data.",
      "gsc_evidence": "Page impressions=X, CTR=Y%, position=Z. Top query 'abc' with W impressions."
    }
  ]
}`;
}

// ── AI call ───────────────────────────────────────────────────────────────────

async function callAI(prompt, token) {
  const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      messages:        [{ role: 'user', content: prompt }],
      max_tokens:      2000,
      temperature:     0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error ${response.status}: ${text.substring(0, 500)}`);
  }

  const data    = await response.json();
  const content = data.choices[0].message.content.trim();

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Failed to parse AI response as JSON: ${e.message}\nRaw: ${content.substring(0, 500)}`
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the full AI-powered SEO analysis.
 *
 * @param {object}   gscData  - Output from gsc.fetchData()
 * @param {object}   seoState - Output from extractSEOState()
 * @param {string}   token    - GitHub / AI API token
 * @returns {Promise<{analysis: object, changes: Array}>}
 */
async function analyzeWithAI(gscData, seoState, token) {
  const opportunities = identifyOpportunities(gscData);
  const prompt        = buildPrompt(gscData, seoState, opportunities);

  console.log(`   Prompt built (${prompt.length} chars). Calling gpt-4o...`);

  const aiResponse = await callAI(prompt, token);

  const analysis = aiResponse.analysis || {};
  const changes  = Array.isArray(aiResponse.changes) ? aiResponse.changes : [];

  // Validate change shape before returning
  const validated = changes.filter((c) => {
    const ok = c.file && c.type && c.old && c.new && c.reason;
    if (!ok) console.warn(`   Skipping malformed change: ${JSON.stringify(c).substring(0, 100)}`);
    return ok;
  });

  return { analysis, changes: validated };
}

module.exports = { extractSEOState, analyzeWithAI };
