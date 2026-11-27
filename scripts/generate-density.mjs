#!/usr/bin/env node
// Density (owner decision C22, 2026-11-09): data-sf-density="compact" on the
// root or on any container moves every component one step down the one size
// ladder -- control height, padding, gap, icon and text together (40 -> 32,
// 24 -> 20, 16 -> 14). Nothing is scaled: no rem, no font-size alone (C18),
// only steps.
//
// The mechanism is the ladder variables themselves (C19, core first): inside a
// compact region each step variable holds the value of the step below it, so a
// component reads its own steps and needs no compact rule of its own. Custom
// properties inherit, so the region reaches every element under it; Smart
// components draw in light DOM, so the attribute selectors below reach them
// too.
//
// An explicit size is a step on the region's ladder (owner decision C79,
// 2026-11-12, changing C22): a component given size="1" in a compact region
// stands where no size stands (40 -> 32), size="2" one step below its normal
// height (48 -> 40), and so on -- one form keeps one height whatever its
// authors wrote. Before C79 an explicit size took the normal ladder back
// under it, and a compact form drew size="1" fields at 40 beside no-size
// buttons at 32. data-sf-density="normal" on an element or a container is the
// one way back to the normal ladder (a fixed size).
//
// Desktop, and below it a fine pointer (C435, 2026-11-27, clarifying C146 (1)
// on DEV's answer to the group build 20 display question, msg-e6aaf2ea): at
// and above 60rem compact moves the desktop ladder one step down for every
// pointer; below 60rem it does so only for a fine pointer (a mouse) on a page
// in the desktop layout (core's page layout word, data-sf-layout="desktop":
// SF.device PHONE_BELOW of the page, the S-A signal, no width of the sheets),
// so a 768 window with a mouse draws compact tables, buttons and fields (32)
// as the desktop does, and a phone-width page keeps the phone ladder with any
// pointer (C36). A coarse pointer below 60rem keeps the phone ladder (control
// 36, text 14) and its touch targets (owner decision C36: compact on a phone
// does not make the buttons smaller); the touch rows stay 44 (touch screens
// rule 12). Below 60rem the normal block writes the phone ladder back (the
// root values of the ladder files), and the compact block keeps the headings
// at the phone's own steps (C44), so a region reads the ladder of its width.
//
// The values are read from the ladder files as they are built (desktop
// blocks), not from a second table: when a ladder step changes, rerun this
// script; --check fails while the projection is stale.
//
// Widths tied to text (owner decision C396, 2026-11-19, replacing the C32
// compact table): the width ladder in characters, --sf-measure--char (half the
// body text size) and the steps --sf-measure-N, follows the text by itself.
// Its declarations and the popup widths that read its steps (core/scss/
// _sf_css__size.scss) are declared again in each region, as the role tokens
// are, so a compact container reads its own text's steps; nothing is computed
// here any more (before C396 each popup width took normal x 14/16 rounded up
// to the next step of the size scale).
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
// Below the breakpoint, compact for a fine pointer only (C435): the exact
// complement of the breakpoint, and the primary pointer a mouse; the page in
// the desktop layout by core's word.
export const QUERIES = [`(min-width: ${DESKTOP})`, `(not (min-width: ${DESKTOP})) and (pointer: fine)`];
export const PAGE_DESKTOP = ':root[data-sf-layout="desktop"]';
const below = (density) => `${PAGE_DESKTOP}[data-sf-density="${density}"],\n    ${PAGE_DESKTOP} [data-sf-density="${density}"]`;

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

// The role tokens that read a step density moves (role-tokens.v1.json,
// density: true).
function roleTokenNames() {
  const data = JSON.parse(readFileSync(join(root, 'src/core/contracts/role-tokens.v1.json'), 'utf8'));
  return data.tokens.filter((token) => token.density).map((token) => token.name);
}

// Declared on :root from the step variables: a custom property is resolved
// where it is declared, so these would keep the root's values in a region
// unless declared again there. Read from their files, written as they are.
const DERIVED = [
  ['figma_text_text_size.scss', CONTROL_STEPS.map((s) => `--sf-text-size-${s}`)],
  ['figma_text_body_text_height.scss', CONTROL_STEPS.map((s) => `--sf-text-height-${s}`)],
  ['figma_ui_control_height.scss', CONTROL_STEPS.map((s) => `--sf-ui-${s}--control-height`)],
  ['figma_typography_roles.scss', ['--sf-text-small--size', '--sf-text-small--height', '--sf-text-medium--size', '--sf-text-medium--height', '--sf-text-large--size', '--sf-text-large--height']],
  // The role tokens on a step (C173): declared again in each region, or a
  // compact region would read the root's step (RT-15). Written by
  // scripts/generate-role-tokens.mjs from src/core/contracts/role-tokens.v1.json.
  ['figma_role_tokens.scss', roleTokenNames()],
  // The width ladder in characters and its roles (C396), written by
  // scripts/generate-adaptive-sizing-contract.mjs.
  ['figma_measure.scss', measureNames()],
];

// The names the measure projection declares on :root, in its order.
function measureNames() {
  const text = readFileSync(join(root, VARIABLES, 'figma_measure.scss'), 'utf8');
  const names = [...text.slice(0, text.indexOf('@media')).matchAll(/(--sf-[^:\s]+)\s*:/gu)].map((match) => match[1]);
  if (!names.length) throw new Error('figma_measure.scss: no root declarations');
  return names;
}

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
  '--sf-popup--window-form-width',
  '--sf-popup--window-wide-width',
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
      const phone = rootDeclarations(file).get(variable) ?? normal;
      rows.push({variable, step, normal, compact, phone, from: file});
    });
  }
  return rows;
}

// Headings do not follow density (owner decision C44, 2026-11-10, after C21):
// h1-h6 and every title drawn from the heading steps -- the page header, the
// empty state, the drawer -- keep the C21 ladder in a compact region. The
// heading steps are declared on :root from the text steps density moves
// (--sf-heading-3--size: var(--sf-text--size-3)), so with compact on <html>
// they resolved at the root to the step below while a compact container kept
// them: one density, two answers. The compact block writes each heading size
// outright with the normal desktop value of the text step it names, so the
// heading is the same on <html> and on a container. The line heights are the
// title lines, which density never moves.
const HEADINGS = Array.from({length: 6}, (_, index) => `--sf-heading-${index + 1}--size`);
export function headings(width = 'desktop') {
  const roles = rootDeclarations('figma_typography_roles.scss');
  const sizes = width === 'phone' ? rootDeclarations('figma_text_text_size.scss') : desktopDeclarations('figma_text_text_size.scss');
  return HEADINGS.map((name) => {
    const value = roles.get(name);
    const match = /^var\((--sf-text--size-[^)]+)\)$/u.exec(value ?? '');
    if (!match) throw new Error(`figma_typography_roles.scss: ${name} is not a text step (${value})`);
    const step = match[1].replaceAll('\\/', '/');
    const normal = sizes.get(step);
    if (!normal) throw new Error(`figma_text_text_size.scss: no desktop value for ${step}`);
    return [name, normal];
  });
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

// Each popup width, declared again in both regions with its own value (a
// step of the width ladder in characters, C396).
export function widths() {
  const text = readFileSync(join(root, WIDTHS_FILE), 'utf8');
  return WIDTHS.map((variable) => {
    const match = new RegExp(`${variable}\\s*:\\s*([^;]+);`, 'u').exec(text);
    if (!match) throw new Error(`${WIDTHS_FILE}: no declaration of ${variable}`);
    const value = match[1].trim();
    if (!/^var\(--sf-measure-\d+\)$/u.test(value)) throw new Error(`${variable}: ${value} is not a step of the width ladder (C396)`);
    return {variable, normal: value, compact: value, phone: value};
  });
}

export function sourceDigest() {
  const hash = createHash('sha256');
  for (const file of [...new Set([...FAMILIES.map(([file]) => file), ...DERIVED.map(([file]) => file)])].sort()) hash.update(`${file}\n${read(file)}\n`);
  hash.update(`${WIDTHS_FILE}\n${widths().map((row) => `${row.variable}:${row.normal}`).join('\n')}\n`);
  return hash.digest('hex');
}

export function render() {
  const rows = ladder();
  const aliases = derived();
  const popup = widths();
  const block = (pick, indent, width = 'desktop') => [
    ...rows.map((row) => `${indent}${esc(row.variable)}: ${row[pick]};`),
    ...popup.map((row) => `${indent}${row.variable}: ${row[pick]};`),
    ...aliases.map(([name, value]) => `${indent}${esc(name)}: ${value};`),
    ...(pick === 'compact' ? headings(width).map(([name, value]) => `${indent}${name}: ${value};`) : []),
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
 * below; components read their steps as always, an explicit size too (C79: a
 * size is a step on the region's ladder). data-sf-density="normal" takes the
 * normal ladder back for an element or a region. From 60rem for every
 * pointer; below 60rem for a fine pointer on a page in the desktop layout
 * only (C435, core's data-sf-layout), where normal is the phone ladder: a
 * coarse pointer or a phone-width page keeps the phone ladder.
 *
 * The widths in characters (C396) follow the text: the measure ladder and
 * the popup widths on its steps are declared again here, with the same
 * values, so a region reads its own text's steps.
 *
 * Headings do not follow density (C44): the compact block writes the heading
 * sizes with their normal values, so h1-h6 and the titles drawn from the
 * heading steps keep the C21 ladder whether compact stands on <html> or on a
 * container.
 */
@layer sf.base {
  @media ${QUERIES[0]} {
    [data-sf-density="compact"] {
${block('compact', '      ')}
    }

    [data-sf-density="normal"] {
${block('normal', '      ')}
    }

${FONT}
  }

  /* Below the breakpoint, a fine pointer on a page in the desktop layout
     (C435): the same compact steps, the headings at the phone's steps,
     normal is the phone ladder. */
  @media ${QUERIES[1]} {
    ${below('compact')} {
${block('compact', '      ', 'phone')}
    }

    ${below('normal')} {
${block('phone', '      ')}
    }

    ${PAGE_DESKTOP} [data-sf-density="compact"]:not(:root),
    ${PAGE_DESKTOP} [data-sf-density="normal"]:not(:root) {
      font-size: var(--sf-text--size);
      line-height: var(--sf-text--height);
    }
  }
}
`;
}

const FONT = `    /* On <html> the variables only, which body reads: a font-size on the
       root element would move rem, and with it every step of the ladder. */
    [data-sf-density="compact"]:not(:root),
    [data-sf-density="normal"]:not(:root) {
      font-size: var(--sf-text--size);
      line-height: var(--sf-text--height);
    }`;

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
