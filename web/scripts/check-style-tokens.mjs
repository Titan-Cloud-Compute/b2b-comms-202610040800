#!/usr/bin/env node
/**
 * check-style-tokens.mjs — fail when component/page styles use raw colour or
 * type literals instead of tokens from src/styles/tokens.css.
 *
 * Flags: hex colours (#abc, #aabbcc…), rgb()/rgba()/hsl()/hsla() with numeric
 * channels, and raw font-size values (px/rem/em). tokens.css itself is the one
 * place literals are allowed and is never scanned.
 *
 * Usage:
 *   node scripts/check-style-tokens.mjs                  # scan default scope
 *   node scripts/check-style-tokens.mjs --files a.css b.ts
 *   node scripts/check-style-tokens.mjs --self-test
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = new URL('..', import.meta.url).pathname;
const DEFAULT_SCOPE = ['src/styles.css', 'src/app/features'];

const RULES = [
  { name: 'raw hex colour', re: /(?<![&\w])#[0-9a-fA-F]{3,8}\b/g },
  { name: 'raw rgb/hsl colour', re: /\b(?:rgba?|hsla?)\(\s*\d/g },
  { name: 'raw font-size', re: /font-size\s*:\s*[\d.]+(?:px|rem|em)\b/g },
];

export function findViolations(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes('style-tokens-allow')) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) out.push({ line: i + 1, rule: rule.name, match: m[0] });
    }
  });
  return out;
}

function walk(p, acc) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) walk(join(p, e), acc);
  } else if (/\.(css|scss|ts|html)$/.test(p) && !/\.spec\.ts$/.test(p) && !p.endsWith('tokens.css')) {
    acc.push(p);
  }
  return acc;
}

function selfTest() {
  const bad = ['color: #ccc;', 'border: 1px solid #a1b2c3;', 'background: rgba(0, 0, 0, 0.5);', 'font-size: 15px;', 'font-size: 1.5rem;'];
  const good = ['color: var(--color-text-primary);', 'box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);', 'font-size: var(--font-size-sm);', '&#128274;', 'id="x#1"'];
  let ok = true;
  for (const s of bad) if (findViolations(s).length === 0) { console.error(`self-test: missed violation in "${s}"`); ok = false; }
  for (const s of good) if (findViolations(s).length !== 0) { console.error(`self-test: false positive in "${s}"`); ok = false; }
  console.log(ok ? 'self-test passed' : 'self-test FAILED');
  process.exit(ok ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();

const fi = args.indexOf('--files');
const targets = fi >= 0 ? args.slice(fi + 1).filter(a => !a.startsWith('--')) : DEFAULT_SCOPE;
const files = targets.flatMap(t => walk(join(WEB, t), []));

let count = 0;
for (const f of files) {
  for (const v of findViolations(readFileSync(f, 'utf8'))) {
    count++;
    console.error(`${relative(WEB, f)}:${v.line}  ${v.rule}: ${v.match}`);
  }
}
if (count) {
  console.error(`\n${count} raw style literal(s) found — use tokens from src/styles/tokens.css.`);
  process.exit(1);
}
console.log(`check-style-tokens: ${files.length} file(s) clean`);
