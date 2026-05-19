# SEO Agent — AllGrafika.pl

Automated SEO optimization agent powered by Google Search Console + GPT-4o.

## What it does

1. **Connects** to Google Search Console API and fetches the last 90 days of performance data (impressions, clicks, CTR, position, top queries per page).
2. **Analyzes** the data to find:
   - Pages with high impressions but low CTR → rewrite meta title / description
   - Pages ranking in positions 5–20 → SEO optimization opportunities
3. **Reads** the current SEO state of repo files (meta tags, OG tags, headings, blog post data).
4. **Calls GPT-4o** with all data and asks for specific, data-backed change recommendations.
5. **Applies safe patches**: only string replacements in allowed files, validated against a strict allowlist.
6. **Opens a Pull Request** on a dedicated branch (`seo-agent/run-YYYY-MM-DD`) with a full SEO report.

## Scope of changes (strict)

The agent **may only** change:

| Change type | Example file |
|-------------|-------------|
| `meta_title` | `landing-page/index.html`, `landing-page/src/pages/Home.tsx` |
| `meta_description` | same |
| `og_title` | same |
| `og_description` | same |
| `h1` / `h2` / `h3` | `landing-page/src/pages/*.tsx` |
| `content_title` | `landing-page/src/data/blogPosts/*.ts` |
| `content_excerpt` | same |

The agent **cannot**:
- Change application logic, routing, or component structure
- Modify backend code
- Add new files
- Run arbitrary commands
- Produce changes without GSC evidence

## Required secrets

| Secret | Description |
|--------|-------------|
| `GSC_SERVICE_ACCOUNT_KEY` | Base64-encoded Google service-account JSON with Search Console read access |
| `GSC_SITE_URL` | GSC property URL, e.g. `https://allgrafika.pl/` or `sc-domain:allgrafika.pl` |
| `PAT_TOKEN` | GitHub PAT with `contents:write` and `pull-requests:write` permissions |

## Setting up Google Search Console access

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **IAM & Admin** → **Service Accounts**.
2. Create a new service account and download the JSON key.
3. In [Google Search Console](https://search.google.com/search-console), add the service account email as a **restricted user** for your property.
4. Base64-encode the JSON key:
   ```bash
   base64 -w 0 service-account-key.json
   ```
5. Store the output as the `GSC_SERVICE_ACCOUNT_KEY` repository secret.

## Triggers

- **Manual**: `Actions → SEO Agent → Run workflow` (with optional dry-run toggle)
- **Scheduled**: daily at 05:00 UTC

## Dry run mode

Enable dry run in the manual trigger to see proposed changes in the workflow logs **without** committing anything or creating a PR. Useful for testing the setup.

## File structure

```
.github/
  workflows/
    seo-agent.yml   ← GitHub Actions workflow
  seo-agent/
    agent.js        ← Main orchestrator
    gsc.js          ← Google Search Console API module
    analyzer.js     ← SEO state extraction + AI analysis
    patcher.js      ← Safe file patching with security validation
    pr.js           ← Branch creation + GitHub PR
    package.json    ← Node.js dependencies (googleapis)
```
