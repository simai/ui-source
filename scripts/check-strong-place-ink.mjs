#!/usr/bin/env node
// A strong coloured place with words on it names its ink (C208, dispatcher
// decision msg-bc1702eb, 2026-11-18). bg-primary, bg-secondary, bg-tertiary,
// bg-error, bg-warning, bg-success, bg-info and bg-neutral paint the fill and
// re-declare the roles their content reads, but the text an element holds
// keeps the colour it inherited: the page's ink on the colour, about 3:1. The
// on-class (color-on-primary, ...) is required on the element: a class list
// that writes a strong place writes its color-on-<c> (or another color-*
// utility) beside it. A decorative plate with no words -- aria-hidden="true",
// a colour dot -- is not text and is not read.
//
//   node scripts/check-strong-place-ink.mjs [folder or file ...] [--json]
//
// Default folders: src, docs. Reads .html, .md, .js, .mjs and .json files;
// a class attribute is class="..." (or className, class=\"...\" in a string).
// Exit 0 clean, 1 findings.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const STRONG = ['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info', 'neutral'];
const FILES = new Set(['.html', '.md', '.js', '.mjs', '.json']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'distr']);
// The opening tag around a class attribute: from the last < before it to the
// next > after it, so aria-hidden on the same element is seen.
const CLASS = /(?<![\w-])class(?:Name)?=\\?(["'])(.*?)\\?\1/gsu;

export function findingsIn(source) {
  const found = [];
  for (const match of source.matchAll(CLASS)) {
    const tokens = match[2].split(/\s+/u).filter(Boolean);
    const strong = tokens.filter((token) => STRONG.some((name) => token === `bg-${name}`));
    if (!strong.length) continue;
    if (tokens.some((token) => token.startsWith('color-'))) continue;
    const open = source.lastIndexOf('<', match.index);
    const close = source.indexOf('>', match.index + match[0].length);
    const tag = open >= 0 ? source.slice(open, close >= 0 ? close + 1 : undefined) : '';
    if (/aria-hidden=\\?["']true\\?["']/u.test(tag)) continue;
    found.push({line: source.slice(0, match.index).split('\n').length, classes: match[2], need: strong.map((token) => `color-on-${token.slice(3)}`)});
  }
  return found;
}

function filesIn(path) {
  const stat = statSync(path);
  if (stat.isFile()) return FILES.has(extname(path)) ? [path] : [];
  return readdirSync(path, {withFileTypes: true}).filter((entry) => !SKIP.has(entry.name))
    .flatMap((entry) => filesIn(join(path, entry.name)));
}

export function checkStrongPlaceInk(paths, {root = process.cwd()} = {}) {
  const findings = [];
  for (const file of paths.flatMap(filesIn).sort()) {
    for (const finding of findingsIn(readFileSync(file, 'utf8'))) findings.push({file: relative(root, file).split('\\').join('/'), ...finding});
  }
  return findings;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const named = args.filter((arg) => arg !== '--json');
  const paths = named.length ? named.map((path) => resolve(path)) : ['src', 'docs'].map((path) => join(root, path));
  const findings = checkStrongPlaceInk(paths, {root});
  if (json) process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  else for (const one of findings) process.stdout.write(`${one.file}:${one.line} class="${one.classes}" -- a strong place with words writes ${one.need.join(' / ')} beside it (C208)\n`);
  process.exit(findings.length ? 1 : 0);
}
