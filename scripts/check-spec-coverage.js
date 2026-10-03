#!/usr/bin/env node
/**
 * Spec ↔ test traceability check (docs/specs/README.md).
 *
 *  1. Every acceptance criterion `AC-AREA-NNN` defined in docs/specs/*.md must be referenced by at
 *     least one test (backend Jest, frontend Vitest/Playwright, landing Playwright).
 *  2. Every `[AC-…]` referenced in a test must exist in the specs (no orphans).
 *  3. Identifiers must be unique across the specs.
 *
 * Usage: node scripts/check-spec-coverage.js [--report]
 * Exit code 1 when the check fails – wired into the CI job "specs".
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPEC_DIR = path.join(ROOT, 'docs', 'specs');
const TEST_GLOBS = [
  ['backend/test', /\.e2e-spec\.ts$/],
  ['backend/src', /\.spec\.ts$/],
  ['frontend/e2e', /\.spec\.ts$/],
  ['frontend/src', /\.test\.tsx?$/],
  ['landing-page/e2e', /\.spec\.ts$/],
];
const AC_DEFINITION = /\*\*(AC-[A-Z0-9]+-\d{3})\*\*/g;
const AC_REFERENCE = /\[(AC-[A-Z0-9]+-\d{3})(?:,\s*(AC-[A-Z0-9]+-\d{3}))*\]/g;

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, filter, out);
    } else if (filter.test(entry.name)) out.push(full);
  }
  return out;
}

function collectDefinitions() {
  const defs = new Map(); // id -> file
  const duplicates = [];
  for (const file of walk(SPEC_DIR, /\.md$/)) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const match of text.matchAll(AC_DEFINITION)) {
      const id = match[1];
      if (defs.has(id)) duplicates.push(`${id} (${path.relative(ROOT, defs.get(id))} and ${path.relative(ROOT, file)})`);
      else defs.set(id, file);
    }
  }
  return { defs, duplicates };
}

function collectReferences() {
  const refs = new Map(); // id -> [test file:name]
  for (const [dir, filter] of TEST_GLOBS) {
    for (const file of walk(path.join(ROOT, dir), filter)) {
      const text = fs.readFileSync(file, 'utf-8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        for (const match of line.matchAll(/AC-[A-Z0-9]+-\d{3}/g)) {
          const id = match[0];
          if (!refs.has(id)) refs.set(id, []);
          refs.get(id).push(`${path.relative(ROOT, file)}:${i + 1}`);
        }
      });
    }
  }
  return refs;
}

const report = process.argv.includes('--report');
const { defs, duplicates } = collectDefinitions();
const refs = collectReferences();

const uncovered = [...defs.keys()].filter((id) => !refs.has(id)).sort();
const orphans = [...refs.keys()].filter((id) => !defs.has(id)).sort();

if (report) {
  console.log('AC → tests');
  for (const id of [...defs.keys()].sort()) {
    const where = refs.get(id) || [];
    console.log(`${id.padEnd(14)} ${where.length ? where.join(', ') : '— (no test)'}`);
  }
  console.log('');
}

let ok = true;
if (duplicates.length) {
  ok = false;
  console.error(`✖ Duplicate acceptance criteria ids:\n  ${duplicates.join('\n  ')}`);
}
if (uncovered.length) {
  ok = false;
  console.error(`✖ Acceptance criteria without a test (${uncovered.length}):\n  ${uncovered.join('\n  ')}`);
}
if (orphans.length) {
  ok = false;
  console.error(`✖ Tests reference unknown acceptance criteria (${orphans.length}):\n  ${orphans.map((id) => `${id} ← ${refs.get(id).join(', ')}`).join('\n  ')}`);
}
if (ok) {
  console.log(`✔ Spec coverage OK: ${defs.size} acceptance criteria, all covered by tests; ${refs.size} ids referenced.`);
}
process.exit(ok ? 0 : 1);
