'use strict';

/**
 * Google Search Console API module
 *
 * Authenticates via Service Account (JSON key, base64-encoded in secret)
 * and fetches search analytics data for a given site.
 */

const { google } = require('googleapis');

/**
 * Fetch SEO performance data from Google Search Console.
 *
 * @param {string} siteUrl      - GSC property URL, e.g. "https://allgrafika.pl/"
 *                                or "sc-domain:allgrafika.pl"
 * @param {object} credentials  - Parsed service-account JSON object
 * @param {number} [days=90]    - Look-back window in days
 * @returns {Promise<{pages: Array, queries: Array, dateRange: object}>}
 */
async function fetchData(siteUrl, credentials, days = 90) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  const endDate  = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // ── Per-page aggregate (impressions, clicks, CTR, position) ──────────
  const pagesResp = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 50,
      orderby: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
    },
  });

  const pages = (pagesResp.data.rows || []).map((row) => ({
    url:         row.keys[0],
    impressions: row.impressions,
    clicks:      row.clicks,
    ctr:         row.ctr,
    position:    row.position,
  }));

  // ── Per-page + per-query (top search queries per page) ────────────────
  const queriesResp = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page', 'query'],
      rowLimit: 200,
      orderby: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
    },
  });

  const queries = (queriesResp.data.rows || []).map((row) => ({
    page:        row.keys[0],
    query:       row.keys[1],
    impressions: row.impressions,
    clicks:      row.clicks,
    ctr:         row.ctr,
    position:    row.position,
  }));

  return { pages, queries, dateRange: { startDate, endDate } };
}

module.exports = { fetchData };
