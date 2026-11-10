#!/usr/bin/env node
// Density (owner decision C22, 2026-11-09): data-sf-density="compact" on the
// root or on any container moves every component one step down the one size
// ladder -- control height, padding, gap, icon and text together (40 -> 32,
// 24 -> 20, 16 -> 14). An explicit size on a component wins. Nothing is
// scaled: no rem, no font-size alone (C18), only steps.
//
// The mechanism is the ladder variables themselves (C19, core first): inside a
// compact region each step variable holds the value of the step below it, so a
// component reads its own steps and needs no compact rule of its own. Custom
// properties inherit, so the region reaches every element under it; Smart
// components draw in light DOM, so the attribute selectors below reach them
// too.
//
// An explicit size: a Smart element whose page gave it a size attribute is
// drawn at that size whatever the region says, so the region's shift is
// undone under it (the normal values again). A size a component's template
// gives to an element it draws is relative to the component's own size and is
// not explicit: smart-base marks those data-sf-size-relative, and they follow
// the region with their parent.
//
// Desktop only (>= 60rem): below it the phone ladder already is the dense one
// (control 36, text 14) and its touch targets stay (owner decision C36: compact
// on a phone does not make the buttons smaller); the rule that set compact
// body text was desktop-only before as well.
//
// The values are read from the ladder files as they are built (desktop
// blocks), not from a second table: when a ladder step changes, rerun this
// script; --check fails while the projection is stale.
//
// Popup widths (owner decision C32, 2026-11-09): a width tied to text follows
// the text. The compact width of each --sf-popup-*-width (core/scss/
// _sf_css__size.scss) is its normal width times the ratio of the compact body
// text to the normal one (14/16), rounded up to the next step of the size
// scale (C18), so the common row never clips: 160 -> 144, 288 -> 256,
// 320 -> 288, 384 -> 352.
//
// Usage: node scripts/generate-density.mjs [--check] [--print-table]
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VARIABLES = 'src/core/figma_variables';
const OUTPUT = 'src/core/scss/_sf_css__density.scss';
// The desktop breakpoint is the ladder's own (adaptive-sizing contract,
// modes.desktop.minWidthPx over the nominal root): the density switches where
// the ladder does, never at a width of its own, so every width has exactly one
// defined ladder (S-03, 2026-11-10).
const SIZING = JSON.parse(readFileSync(join(root, 'src/core/contracts/adaptive-sizing.v1.json'), 'utf8'));
export const DESKTOP = `${SIZING.modes.desktop.minWidthPx / SIZING.meta.nominalRootPx}rem`;

// The control ladder. A step below the lowest stays at the lowest: 1/3 is a
// 24px control, the smallest target (WCAG 2.5.8), and text under 12 is a
// label, not body.
export const CONTROL_STEPS = ['1/3', '1/2', '1', '2', '3'];
export const ICON_STEPS = ['1/3', '1/2', '1', '2', '3', '4', '5', '6', '7'];
export const SPACE_STEPS = ['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7', '8'];

// [file, variable name for a step, steps]
export const FAMILIES = [
  ['figma_text_text_size.scss', (s) => `--sf-text--size-${s}`, CONTROL_STEPS],
  ['figma_text_body_text_height.scss', (s) => `--sf-text--height-${s}`, CONTROL_STEPS],
  ['figma_ui_tightness_default.scss', (s) => `--sf-ui-${s}--space-y-tightness-default`, CONTROL_STEPS],
  ['figma_ui_tightness_low.scss', (s) => `--sf-ui-${s}--space-y-tightness-low`, CONTROL_STEPS],
  ['figma_ui_tightness_high.scss', (s) => `--sf-ui-${s}--space-y-tightness-high`, CONTROL_STEPS],
  ['figma_ui_tightness_highest.scss', (s) => `--sf-ui-${s}--space-y-tightness-highest`, CONTROL_STEPS],
  ['figma_ui_space_x.scss', (s) => `--sf-ui-${s}--space-x`, CONTROL_STEPS],
  ['figma_ui_text_space_x.scss', (s) => `--sf-ui-${s}--text-space-x`, CONTROL_STEPS],
  ['figma_uncategorized.scss', (s) => `--sf-ui-${s}--space-y`, CONTROL_STEPS],
  ['figma_icon_sizes.scss', (s) => `--sf-icon-size-${s}`, ICON_STEPS],
  ['figma_space.scss', (s) => `--sf-space-${s}`, SPACE_STEPS],
];

// Declared on :root from the step variables: a custom property is resolved
// where it is declared, so these would keep the root's values in a region
// unless declared again there. Read from their files, written as they are.
const DERIVED = [
  ['figma_text_text_size.scss', CONTROL_STEPS.map((s) => `--sf-text-size-${s}`)],
  ['figma_text_body_text_height.scss', CONTROL_STEPS.map((s) => `--sf-text-height-${s}`)],
  ['figma_ui_control_height.scss', CONTROL_STEPS.map((s) => `--sf-ui-${s}--control-height`)],
  ['figma_typography_roles.scss', ['--sf-text-small--size', '--sf-text-small--height', '--sf-text-medium--size', '--sf-text-medium--height', '--sf-text-large--size', '--sf-text-large--height']],
];

// The popup widths, declared on :root in the size tokens.
const WIDTHS_FILE = 'src/core/scss/_sf_css__size.scss';
export const WIDTHS = [
  '--sf-popup-menu-min-width',
  '--sf-popup-menu-max-width',
  '--sf-popup-list-max-width',
  '--sf-popup-panel-width',
  '--sf-popup-form-width',
  '--sf-popup-form-wide-width',
  '--sf-popup-question-width',
];

const esc = (name) => name.replaceAll('/', '\\/');
const read = (file) => readFileSync(join(root, VARIABLES, file), 'utf8');

// The declarations of a file's desktop block (or of the file when it has no
// media block: one value on every width), later ones winning.
function desktopDeclarations(file) {
  const text = read(file);
  const at = text.indexOf(`@media (min-width: ${DESKTOP})`);
  const block = at === -1 ? text : text.slice(at);
  const values = new Map();
  for (const match of block.matchAll(/(--sf-[^:\s]+)\s*:\s*([^;]+);/gu)) values.set(match[1].replaceAll('\\/', '/'), match[2].trim());
  return values;
}

function rootDeclarations(file) {
  const text = read(file);
  const at = text.indexOf('@media');
  const block = at === -1 ? text : text.slice(0, at);
  const values = new Map();
  for (const match of block.matchAll(/(--sf-[^:\s]+)\s*:\s*([^;]+);/gu)) values.set(match[1].replaceAll('\\/', '/'), match[2].trim());
  return values;
}

// The control heights (decision C27): a height setting picks a tightness of
// its size -- low, default, high, highest -- and size 1/3 has no size below
// it. There the compact step is the tightness below in the same size (default
// takes low's, high default's, highest high's; low stays), so a compact 1/3
// stands one ladder step lower as every other size does (28 -> 24 at default)
// and never below low, the 24px target.
export const TIGHTNESS_BELOW = {
  'figma_ui_tightness_low.scss': 'figma_ui_tightness_low.scss',
  'figma_ui_tightness_default.scss': 'figma_ui_tightness_low.scss',
  'figma_ui_tightness_high.scss': 'figma_ui_tightness_default.scss',
  'figma_ui_tightness_highest.scss': 'figma_ui_tightness_high.scss',
};

export function ladder() {
  const rows = [];
  for (const [file, name, steps] of FAMILIES) {
    const values = desktopDeclarations(file);
    steps.forEach((step, index) => {
      const variable = name(step);
      const normal = values.get(variable);
      if (!normal) throw new Error(`${file}: no desktop value for ${variable}`);
      let compact = values.get(name(steps[Math.max(0, index - 1)]));
      if (index === 0 && TIGHTNESS_BELOW[file]) {
        const lower = TIGHTNESS_BELOW[file];
        const family = FAMILIES.find(([other]) => other === lower);
        compact = desktopDeclarations(lower).get(family[1](step));
        if (!compact) throw new Error(`${lower}: no desktop value for ${family[1](step)}`);
      }
      rows.push({variable, step, normal, compact, from: file});
    });
  }
  return rows;
}

function derived() {
  const rows = [];
  for (const [file, names] of DERIVED) {
    const values = rootDeclarations(file);
    for (const name of names) {
      const value = values.get(name);
      if (!value) throw new Error(`${file}: no root declaration of ${name}`);
      rows.push([name, value]);
    }
  }
  return rows;
}

// The size scale: a range letter starts at a length and climbs in its own
// step (core/scss/vars/_sf_var__size.scss), ten steps a range.
const RANGES = {a: [0, 1], b: [10, 1], c: [20, 2], d: [40, 4], e: [80, 8], f: [160, 16], g: [320, 32], h: [640, 64], i: [1280, 128]};
export const STEPS = Object.entries(RANGES)
  .flatMap(([letter, [start, step]]) => Array.from({length: 10}, (_, index) => [`--sf-${letter}${index}`, start + step * index]))
  .sort((a, b) => a[1] - b[1]);
const stepPx = (value) => {
  const match = /^var\((--sf-[a-i]\d)\)$/u.exec(String(value).trim());
  return match ? STEPS.find(([name]) => name === match[1])?.[1] ?? null : null;
};

// The text ratio: the compact body text over the normal one (size 1).
export function textRatio() {
  const row = ladder().find((entry) => entry.variable === '--sf-text--size-1');
  const normal = stepPx(row?.normal);
  const compact = stepPx(row?.compact);
  if (!normal || !compact) throw new Error('no step for --sf-text--size-1 in the ladder');
  return compact / normal;
}

// Each popup width at both densities: the compact one is the first step at or
// above normal x ratio.
export function widths() {
  const text = readFileSync(join(root, WIDTHS_FILE), 'utf8');
  const ratio = textRatio();
  return WIDTHS.map((variable) => {
    const match = new RegExp(`${variable}\\s*:\\s*([^;]+);`, 'u').exec(text);
    if (!match) throw new Error(`${WIDTHS_FILE}: no declaration of ${variable}`);
    const normal = match[1].trim();
    const px = stepPx(normal);
    if (px === null) throw new Error(`${variable}: ${normal} is not a step of the size scale`);
    const target = px * ratio;
    const [step] = STEPS.find(([, length]) => length >= target - 1e-9);
    return {variable, normal, compact: `var(${step})`};
  });
}

export function sourceDigest() {
  const hash = createHash('sha256');
  for (const file of [...new Set([...FAMILIES.map(([file]) => file), ...DERIVED.map(([file]) => file)])].sort()) hash.update(`${file}\n${read(file)}\n`);
  hash.update(`${WIDTHS_FILE}\n${widths().map((row) => `${row.variable}:${row.normal}`).join('\n')}\n`);
  return hash.digest('hex');
}

// A page's own size attribute, not a native one (input size, select size),
// not a width (a drawer's size: manifest x-scale, mark data-sf-size-scale)
// and not part of a printed first-paint picture.
export const EXPLICIT = ':not(input, select, textarea)[size]:not([data-sf-size-relative], [data-sf-size-scale], [data-sf-static] *)';

export function render() {
  const rows = ladder();
  const aliases = derived();
  const popup = widths();
  const block = (pick, indent) => [
    ...rows.map((row) => `${indent}${esc(row.variable)}: ${row[pick]};`),
    ...popup.map((row) => `${indent}${row.variable}: ${row[pick]};`),
    ...aliases.map(([name, value]) => `${indent}${esc(name)}: ${value};`),
    `${indent}--sf-text--size: var(--sf-text--size-1);`,
    `${indent}--sf-text--height: var(--sf-text--height-1);`,
  ].join('\n');
  return `/*
 * Generated by scripts/generate-density.mjs from the ladder files in
 * src/core/figma_variables (desktop blocks). Do not edit by hand.
 * source-sha256: ${sourceDigest()}
 *
 * Density (owner decision C22): data-sf-density="compact" on the root or on
 * a container moves every component one ladder step down -- height, padding,
 * gap, icon and text together. Each step variable holds the value of the step
 * below; components read their steps as always. An element with an explicit
 * size (a page's size attribute) takes the normal ladder back under it;
 * data-sf-density="normal" does the same for a region. Desktop only: below
 * 60rem the phone ladder already is the dense one.
 *
 * The popup widths (C32) follow the text: normal x 14/16, rounded up to the
 * next step of the size scale.
 */
@layer sf.base {
  @media (min-width: ${DESKTOP}) {
    [data-sf-density="compact"] {
${block('compact', '      ')}
    }

    [data-sf-density="compact"] ${EXPLICIT},
    [data-sf-density="normal"] {
${block('normal', '      ')}
    }

    /* On <html> the variables only, which body reads: a font-size on the
       root element would move rem, and with it every step of the ladder.
       An explicit size takes the normal body text back too, for the text a
       component inherits rather than sizes. */
    [data-sf-density="compact"]:not(:root),
    [data-sf-density="compact"] ${EXPLICIT},
    [data-sf-density="normal"]:not(:root) {
      font-size: var(--sf-text--size);
      line-height: var(--sf-text--height);
    }
  }
}
`;
}

const px = (value) => {
  const match = /var\(--sf-([a-i])(\d)\)/u.exec(value);
  if (!match) return value;
  const start = {a: 0, b: 10, c: 20, d: 40, e: 80, f: 160, g: 320, h: 640, i: 1280}[match[1]];
  const step = {a: 1, b: 1, c: 2, d: 4, e: 8, f: 16, g: 32, h: 64, i: 128}[match[1]];
  return `${start + step * Number(match[2])}px`;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--print-table')) {
    for (const row of [...ladder(), ...widths()]) process.stdout.write(`${row.variable}\t${px(row.normal)}\t${px(row.compact)}\n`);
  } else {
    const expected = render();
    const target = join(root, OUTPUT);
    if (args.has('--check')) {
      const actual = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (actual !== expected) {
        process.stderr.write(`density projection is stale: ${OUTPUT}\nrun node scripts/generate-density.mjs\n`);
        process.exitCode = 1;
      }
    } else {
      writeFileSync(target, expected);
    }
  }
}
