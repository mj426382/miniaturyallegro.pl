#!/usr/bin/env node
/**
 * The legal texts (regulamin, polityka prywatności, dane podmiotu) have ONE source:
 * landing-page/src/legal. The app renders the same components, so this script copies them
 * verbatim before `dev`/`build`; CI additionally fails when the copies differ.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../landing-page/src/legal')
const target = resolve(here, '../src/legal')
const FILES = ['RegulaminContent.tsx', 'PolitykaContent.tsx', 'entity.ts']

mkdirSync(target, { recursive: true })
let changed = 0
for (const file of FILES) {
  const from = resolve(source, file)
  const to = resolve(target, file)
  let same = false
  try {
    same = readFileSync(from, 'utf-8') === readFileSync(to, 'utf-8')
  } catch {
    same = false
  }
  if (!same) {
    copyFileSync(from, to)
    changed++
  }
}
console.log(changed ? `✅ legal texts synced from landing-page (${changed} file(s) updated)` : '✅ legal texts already in sync with landing-page')
