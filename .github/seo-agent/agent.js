'use strict';

/**
 * SEO Agent — main orchestrator
 *
 * Steps:
 *  1. Validate required environment variables
 *  2. Fetch Google Search Console data
 *  3. Extract current SEO state from repo files
 *  4. Analyse with AI (GPT-4o via GitHub Models API)
 *  5. Apply safe, minimal patches
 *  6. Create a Pull Request with a detailed SEO report
 *
 * Required secrets / env vars:
 *  GSC_SERVICE_ACCOUNT_KEY  – base64-encoded service-account JSON
 *  GSC_SITE_URL             – GSC property (e.g. "https://allgrafika.pl/")
 *  GH_TOKEN                 – GitHub PAT with contents:write + pull-requests:write
 *  GITHUB_REPOSITORY        – injected by Actions ("owner/repo")
 *
 * Optional:
 *  DRY_RUN                  – "true" to analyse only, without committing or creating a PR
 */

const path = require('path');
const gsc      = require('./gsc');
const analyzer = require('./analyzer');
const patcher  = require('./patcher');
const pr       = require('./pr');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  // ── Environment validation ───────────────────────────────────────────────
  const gscKeyRaw  = process.env.GSC_SERVICE_ACCOUNT_KEY;
  const gscSiteUrl = process.env.GSC_SITE_URL;
  const token      = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo       = process.env.GITHUB_REPOSITORY;
  const dryRun     = process.env.DRY_RUN === 'true';

  const missing = [];
  if (!gscKeyRaw)  missing.push('GSC_SERVICE_ACCOUNT_KEY');
  if (!gscSiteUrl) missing.push('GSC_SITE_URL');
  if (!token)      missing.push('GH_TOKEN or GITHUB_TOKEN');
  if (!repo)       missing.push('GITHUB_REPOSITORY');

  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  let gscCredentials;
  try {
    gscCredentials = JSON.parse(Buffer.from(gscKeyRaw, 'base64').toString('utf-8'));
  } catch (e) {
    console.error('ERROR: GSC_SERVICE_ACCOUNT_KEY must be a base64-encoded service-account JSON.');
    console.error(e.message);
    process.exit(1);
  }

  console.log(`\n🔍 SEO Agent starting`);
  console.log(`   Site    : ${gscSiteUrl}`);
  console.log(`   Repo    : ${repo}`);
  console.log(`   Dry run : ${dryRun}`);

  // ── Step 1: Fetch GSC data ───────────────────────────────────────────────
  console.log('\n📊 Step 1: Fetching Google Search Console data…');
  const gscData = await gsc.fetchData(gscSiteUrl, gscCredentials);
  console.log(
    `   ✓ ${gscData.pages.length} pages | ${gscData.queries.length} query rows` +
    ` | ${gscData.dateRange.startDate} → ${gscData.dateRange.endDate}`
  );

  if (gscData.pages.length === 0) {
    console.log('\n⚠️  No GSC data returned — the site may be new or not yet verified. Exiting.');
    return;
  }

  // ── Step 2: Extract current SEO state from repo ─────────────────────────
  console.log('\n📂 Step 2: Reading SEO state from repository…');
  const topUrls  = gscData.pages.slice(0, 20).map((p) => p.url);
  const seoState = analyzer.extractSEOState(REPO_ROOT, topUrls);
  console.log(
    `   ✓ ${seoState.pages.length} main pages | ${seoState.blogPosts.length} relevant blog posts`
  );

  // ── Step 3: AI analysis ──────────────────────────────────────────────────
  console.log('\n🤖 Step 3: Running AI analysis…');
  const { analysis, changes } = await analyzer.analyzeWithAI(gscData, seoState, token);

  console.log(`\n   Summary  : ${analysis.summary || 'N/A'}`);
  console.log(`   Avg CTR  : ${analysis.avg_ctr_percent?.toFixed(2) ?? 'N/A'}%`);
  console.log(`   Avg pos  : ${analysis.avg_position?.toFixed(1) ?? 'N/A'}`);
  console.log(`   Changes proposed: ${changes.length}`);

  if (changes.length === 0) {
    console.log('\n✅ No changes proposed — SEO is already well-optimised based on current data.');
    return;
  }

  // ── Dry-run output ───────────────────────────────────────────────────────
  if (dryRun) {
    console.log('\n📝 DRY RUN — changes that would be applied (none committed):');
    changes.forEach((c, i) => {
      console.log(`\n  [${i + 1}] ${c.file}  (${c.type})`);
      console.log(`       OLD : ${c.old.substring(0, 120)}`);
      console.log(`       NEW : ${c.new.substring(0, 120)}`);
      console.log(`       WHY : ${c.reason}`);
      console.log(`       DATA: ${c.gsc_evidence}`);
    });
    return;
  }

  // ── Step 4: Apply patches ────────────────────────────────────────────────
  console.log('\n✏️  Step 4: Applying changes…');
  const result = patcher.applyChanges(changes, REPO_ROOT);
  console.log(`   ✓ Applied: ${result.applied}  |  Skipped: ${result.skipped}`);
  if (result.modifiedFiles.length > 0) {
    console.log(`   Modified : ${result.modifiedFiles.join(', ')}`);
  }

  if (result.modifiedFiles.length === 0) {
    console.log('\n⚠️  All proposed changes were rejected by the safety validator. Exiting.');
    return;
  }

  // ── Step 5: Create PR ────────────────────────────────────────────────────
  console.log('\n🚀 Step 5: Creating Pull Request…');
  const prUrl = await pr.createPR({
    analysis,
    applied_changes: result.applied_changes,
    modifiedFiles:   result.modifiedFiles,
    gscData,
    token,
    repo,
  });

  console.log(`\n✅ Done! PR created: ${prUrl}`);
}

main().catch((err) => {
  console.error('\n❌ SEO Agent failed:', err.message);
  if (process.env.RUNNER_DEBUG === '1') console.error(err.stack);
  process.exit(1);
});
