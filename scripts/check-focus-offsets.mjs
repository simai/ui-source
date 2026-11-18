#!/usr/bin/env node
// Usage: node scripts/check-focus-offsets.mjs [--json] [<file or folder>...]
//
// The keyboard focus ring stands off its element by one of two tokens (owner
// decision C212 (7), 2026-11-16):
//
//   --sf-focus--offset   outwards, the gap between element and ring (1px)
//   --sf-focus--inset    inwards, the ring drawn inside the element's edge
//                        (minus the focus width, -2px)
//
// Components and Smart components read them and write no offset of their own:
// before C212 the same two distances were spelt 24 ways in 85 files
// (calc(var(--sf-focus--width) * -1), calc(-1 * var(--sf-focus-outline-width)),
// var(--sf-px) ...). This check reads every outline-offset declared in a rule
// whose selector names :focus, :focus-visible or :focus-within (the nesting of
// SCSS joined) and fails on any value other than var(--sf-focus--offset) or
// var(--sf-focus--inset). An outline that is not a focus ring (a current
// thumbnail, a selected dot, an avatar's frame) is not read. It also fails on
// a read of the former width name var(--sf-focus-outline-width) (C178).
//
// KEPT lists the focus offsets that keep a distance of their own. One offset
// everywhere (C212, dispatcher decision msg-bc1702eb, 2026-11-18): only the
// forced-colours rings, the system's Highlight outline two pixels off the box,
// and, by the owner's C186 (4) (dispatcher 2026-11-18: an owner decision
// outranks the technical rule), a link's ring two pixels off its words - the
// text link, sf-link, a crumb and a reference in text - stay; the flush
// segments and slider dots, the 2 px and 4 px rings of the editor, the overlay, sortable, confirm and the feed, the selected day
// and the two built from the tokens read the two tokens since. An entry that
// no longer matches fails, so a fixed line leaves the list.
//
// Default folders: src/component, src/smart, src/core/scss. Exit 0 clean,
// 1 findings or stale KEPT entries.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const TOKENS = ['var(--sf-focus--offset)', 'var(--sf-focus--inset)'];

// {file suffix, value}: offsets a focus rule keeps until the owner decides.
export const KEPT = [
  // Forced colours: the ring is the system's Highlight/currentColor outline
  // two pixels off the box (the box-shadow ring is gone there).
  {file: 'component/breadcrumbs/scss/_css__breadcrumbs_item.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/buttons/scss/_css__buttons.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/checkbox/scss/_css__checkbox.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/country-code/scss/_css_country_code_custom.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/file-upload/scss/_css__file_upload.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/radio/scss/_css_radio.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/radio/scss/_css_radio_custom.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/range-slider/scss/_css__thumbs.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/step/scss/_css__step.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/switch/scss/_css_switch.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  {file: 'component/tags/scss/_css__tags.scss', value: 'var(--sf-focus--width)', why: 'forced colours, 2px out'},
  // C186 (4), the owner's link ring: two pixels off the words.
  {file: 'core/scss/_sf_css__link.scss', value: 'var(--sf-a2)', why: 'link, 2px out (C186 (4))'},
  {file: 'component/link/scss/_css__link.scss', value: 'var(--sf-a2)', why: 'link, 2px out (C186 (4))'},
  {file: 'component/breadcrumbs/scss/_css__breadcrumbs_item.scss', value: 'var(--sf-a2)', why: 'crumb link, 2px out (C186 (4))'},
  {file: 'component/reference-link/scss/_css__reference_link.scss', value: 'var(--sf-a2)', why: 'link in text, 2px out (C186 (4))'},
];

const SHEETS = new Set(['.css', '.scss']);
const FORMER = 'var(--sf-focus-outline-width)';
const FOCUS = /:focus(?:-visible|-within)?\b/u;

const blank = (text) => text.replace(/[^\n]/gu, ' ');
const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//gu, blank)
  .replace(/(^|[^:\\])\/\/[^\n]*/gu, (match, before) => before + blank(match.slice(before.length)));

const squeeze = (text) => text.replace(/\s+/gu, ' ').trim();

// Every outline-offset of a sheet with its line and the selector chain of the
// rule it stands in (outer preludes first; at-rules are kept in the chain).
export function offsetsOf(source) {
  const text = withoutComments(source);
  const found = [];
  const stack = [];
  let start = 0;
  let depth = 0; // parentheses: a ; or { inside :is(...) or calc(...) is not a break
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth > 0) continue;
    else if (char === '{') {
      // #{...} interpolation is not a block
      if (text[at - 1] === '#') {
        const close = text.indexOf('}', at);
        at = close < 0 ? text.length : close;
        continue;
      }
      stack.push(squeeze(text.slice(start, at)));
      start = at + 1;
    } else if (char === ';' || char === '}') {
      const declaration = text.slice(start, at);
      const match = /^\s*outline-offset\s*:\s*([\s\S]*?)\s*(!important)?\s*$/u.exec(declaration);
      if (match) {
        const offset = start + declaration.indexOf('outline-offset');
        found.push({
          line: text.slice(0, offset).split('\n').length,
          value: squeeze(match[1]),
          chain: [...stack],
        });
      }
      if (char === '}') stack.pop();
      start = at + 1;
    }
  }
  return found;
}

export const isFocusRule = (chain) => chain.some((prelude) => !prelude.startsWith('@') && FOCUS.test(prelude));

function sheetsIn(path) {
  const stat = statSync(path);
  if (stat.isFile()) return SHEETS.has(extname(path)) ? [path] : [];
  return readdirSync(path).flatMap((name) => (name === 'node_modules' ? [] : sheetsIn(join(path, name))));
}

export function checkFocusOffsets(paths, {root = process.cwd(), kept = KEPT} = {}) {
  const findings = [];
  const keptHits = new Map(kept.map((entry) => [entry, 0]));
  for (const file of paths.flatMap(sheetsIn).sort()) {
    const name = relative(root, file).split('\\').join('/');
    const source = readFileSync(file, 'utf8');
    // The former width name reads the family name until 2027-01-01 (C178);
    // the Framework's own sheets read the family name.
    const plain = withoutComments(source);
    for (let at = plain.indexOf(FORMER); at >= 0; at = plain.indexOf(FORMER, at + 1)) {
      findings.push({file: name, line: plain.slice(0, at).split('\n').length, value: FORMER, selector: ''});
    }
    for (const offset of offsetsOf(source)) {
      if (!isFocusRule(offset.chain) || TOKENS.includes(offset.value)) continue;
      const entry = kept.find((item) => name.endsWith(item.file) && item.value === offset.value);
      if (entry) {
        keptHits.set(entry, keptHits.get(entry) + 1);
        continue;
      }
      findings.push({file: name, line: offset.line, value: offset.value, selector: offset.chain.join(' | ')});
    }
  }
  const stale = kept.filter((entry) => keptHits.get(entry) === 0);
  return {findings, stale};
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const named = args.filter((arg) => arg !== '--json');
  const paths = named.length ? named.map((path) => resolve(path)) : ['src/component', 'src/smart', 'src/core/scss'].map((path) => join(root, path));
  const result = checkFocusOffsets(paths, {root});
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const finding of result.findings) {
      process.stdout.write(finding.value === FORMER
        ? `${finding.file}:${finding.line} ${FORMER} -- read var(--sf-focus--width) (C178)\n`
        : `${finding.file}:${finding.line} outline-offset: ${finding.value} -- a focus ring reads var(--sf-focus--offset) or var(--sf-focus--inset) (C212)\n`);
    }
    for (const entry of result.stale) {
      process.stdout.write(`stale KEPT entry: ${entry.file} ${entry.value}\n`);
    }
  }
  process.exitCode = result.findings.length || result.stale.length ? 1 : 0;
}
