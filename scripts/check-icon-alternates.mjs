#!/usr/bin/env node
// One meaning, one glyph (owner decision C151 point 7): a product's build runs
//
//   node <ui-source or the package>/scripts/check-icon-alternates.mjs <dir> [<dir>...] [--strict]
//
// and is warned wherever it draws a meaning with an alternate glyph from
// src/core/contracts/icon-meanings.v1.json (more_vert where the Framework
// writes more_horiz, keyboard_arrow_down where it writes expand_more). A
// warning, not a failure: the alternate still draws (there are no alias
// names); --strict makes it a failure for a product that has cleared them.
//
// It reads icon names where markup and templates give them: icon, icon-start,
// icon-end (and the legacy icon-left/-right) attributes, `icon: "name"`
// properties and the class markup <i class="sf-icon ...">name</i>.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(here, '../src/core/contracts/icon-meanings.v1.json'), 'utf8'));
const alternates = new Map();
for (const row of table.meanings) {
  for (const name of row.alternates) alternates.set(name, row);
}

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const roots = args.filter((arg) => !arg.startsWith('--'));
if (!roots.length) {
  console.error('usage: check-icon-alternates.mjs <dir> [<dir>...] [--strict]');
  process.exit(2);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'distr', 'build', 'vendor', '.artifacts', 'static']);
const EXT = /\.(?:html?|js|mjs|cjs|ts|tsx|jsx|vue|php|twig|md|json)$/u;
const PATTERNS = [
  /\bicon(?:-start|-end|-left|-right)?\s*=\s*["']([a-z0-9_]+)["']/gu,
  /\bicon(?:Start|End|Left|Right)?\s*:\s*["']([a-z0-9_]+)["']/gu,
  /<i\b[^>]*class\s*=\s*["'][^"']*\bsf-icon\b[^"']*["'][^>]*>\s*([a-z0-9_]+)\s*<\/i>/gu,
];

function* files(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (EXT.test(entry.name)) yield full;
  }
}

let count = 0;
for (const root of roots) {
  for (const file of files(root)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!/icon/u.test(text)) continue;
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const row = alternates.get(match[1]);
        if (!row) continue;
        const line = text.slice(0, match.index).split('\n').length;
        count += 1;
        console.warn(`warning: ${path.relative(process.cwd(), file)}:${line} icon "${match[1]}" draws «${row.meaning.ru}» (${row.meaning.en}); the Framework writes "${row.glyph}".`);
      }
    }
  }
}
console.warn(`check-icon-alternates: ${count} alternate glyph${count === 1 ? '' : 's'} (src/core/contracts/icon-meanings.v1.json).`);
process.exit(strict && count ? 1 : 0);
