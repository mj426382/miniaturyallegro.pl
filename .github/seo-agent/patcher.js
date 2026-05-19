'use strict';

/**
 * Safe file patcher for SEO changes.
 *
 * Security model:
 *  • Only files under ALLOWED_PREFIXES can be modified.
 *  • Only declared change types are accepted.
 *  • The "old" string must exist verbatim in the file.
 *  • The "new" string is screened for dangerous content.
 *  • No change may alter application logic (only text/string content).
 */

const fs   = require('fs');
const path = require('path');

// ── Allowlists ────────────────────────────────────────────────────────────────

/** File paths (relative to repo root) that the agent is allowed to modify */
const ALLOWED_PREFIXES = [
  'landing-page/index.html',
  'landing-page/src/pages/',
  'landing-page/src/data/blogPosts/',
];

/** Permitted change types (mirrors what analyzer.js may request) */
const ALLOWED_TYPES = new Set([
  'meta_title',
  'meta_description',
  'og_title',
  'og_description',
  'h1',
  'h2',
  'h3',
  'content_title',
  'content_excerpt',
]);

/** Patterns whose presence in the new value means the change is rejected */
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,     // inline event handlers (onclick=, onerror=, …)
  /data\s*:/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /eval\s*\(/i,
  /document\./i,
  /window\./i,
  /\\u0/i,          // Unicode escape sequences used to evade filters
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAllowedFile(filePath) {
  return ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function isSafeValue(str) {
  return !DANGEROUS_PATTERNS.some((re) => re.test(str));
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a proposed change before applying it.
 *
 * @param {object} change    - { file, type, old, new, reason, gsc_evidence }
 * @param {string} repoRoot  - Absolute repo root path
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateChange(change, repoRoot) {
  if (!isAllowedFile(change.file)) {
    return { valid: false, reason: `File not in allowed list: ${change.file}` };
  }

  if (!ALLOWED_TYPES.has(change.type)) {
    return { valid: false, reason: `Change type not allowed: ${change.type}` };
  }

  if (!isSafeValue(change.new)) {
    return { valid: false, reason: 'New value contains potentially dangerous content.' };
  }

  if (change.old === change.new) {
    return { valid: false, reason: 'Old and new values are identical — skipping.' };
  }

  if (!change.new || !change.new.trim()) {
    return { valid: false, reason: 'New value is empty.' };
  }

  // Length guards for meta fields
  if (change.type === 'meta_title' || change.type === 'og_title') {
    if (change.new.length > 80) {
      return { valid: false, reason: `Title too long (${change.new.length} chars, max 80).` };
    }
  }
  if (change.type === 'meta_description' || change.type === 'og_description') {
    if (change.new.length > 200) {
      return { valid: false, reason: `Description too long (${change.new.length} chars, max 200).` };
    }
  }
  if (change.type === 'content_excerpt') {
    if (change.new.length > 250) {
      return { valid: false, reason: `Excerpt too long (${change.new.length} chars, max 250).` };
    }
  }

  const fullPath = path.join(repoRoot, change.file);
  if (!fs.existsSync(fullPath)) {
    return { valid: false, reason: `File not found: ${change.file}` };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  if (!content.includes(change.old)) {
    return {
      valid:  false,
      reason: `"old" string not found verbatim in ${change.file}: "${change.old.substring(0, 80)}"`,
    };
  }

  return { valid: true };
}

// ── Application ───────────────────────────────────────────────────────────────

/**
 * Apply a single validated change to a file.
 * Replaces the FIRST occurrence of change.old with change.new.
 *
 * @returns {boolean} true if the file was modified
 */
function applyChange(change, repoRoot) {
  const fullPath = path.join(repoRoot, change.file);
  const content  = fs.readFileSync(fullPath, 'utf-8');

  const idx = content.indexOf(change.old);
  if (idx === -1) return false;

  const updated = content.slice(0, idx) + change.new + content.slice(idx + change.old.length);
  fs.writeFileSync(fullPath, updated, 'utf-8');
  return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a list of proposed changes, validating each one first.
 *
 * @param {Array}  changes   - Change objects from analyzeWithAI()
 * @param {string} repoRoot  - Absolute repo root path
 * @returns {{
 *   applied_changes: Array,
 *   skipped_changes:  Array,
 *   modifiedFiles:    string[],
 *   applied:          number,
 *   skipped:          number
 * }}
 */
function applyChanges(changes, repoRoot) {
  const applied_changes = [];
  const skipped_changes = [];
  const modifiedFiles   = new Set();

  for (const change of changes) {
    const validation = validateChange(change, repoRoot);

    if (!validation.valid) {
      console.warn(`   ⚠️  Skip [${change.type}] ${change.file}: ${validation.reason}`);
      skipped_changes.push({ change, reason: validation.reason });
      continue;
    }

    const success = applyChange(change, repoRoot);
    if (success) {
      console.log(`   ✓  Applied [${change.type}] ${change.file}`);
      applied_changes.push(change);
      modifiedFiles.add(change.file);
    } else {
      const reason = 'applyChange() could not locate the old string at write time.';
      console.warn(`   ⚠️  Failed [${change.type}] ${change.file}: ${reason}`);
      skipped_changes.push({ change, reason });
    }
  }

  return {
    applied_changes,
    skipped_changes,
    modifiedFiles: [...modifiedFiles],
    applied:       applied_changes.length,
    skipped:       skipped_changes.length,
  };
}

module.exports = { applyChanges, validateChange };
