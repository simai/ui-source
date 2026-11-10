import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {isSchema} from '../src/core/js/composition/schema-name.mjs';

// The public variables a component offers (src/core/contracts/public-variables.v1.json):
// each is read by the component's stylesheet, none is set by the Framework, and
// the list keeps to the small set the docs show under «Настройка».
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
const FOLDERS = {
  badge: 'badges', button: 'buttons', input: 'inputs', alert: 'alerts',
  tag: 'tags', 'icon-button': 'icon-buttons', checkbox: 'checkbox', 'radio-button': 'radio',
  switch: 'switch', textarea: 'textarea', toast: 'toast', modal: 'modal',
  tooltip: 'tooltip', tabs: 'tabs', avatar: 'avatars', 'context-menu': 'context-menu',
  'button-group': 'button-group', accordion: 'accordion', verification: 'verification',
  // sf-menu draws with the class sheet; its own sheet reads the sticky offset
  // of the host (sf-menu 1.3.0).
  menu: ['menu', 'smart/menu'],
  // A Smart component that carries its own sheet: the path from src/.
  'image-field': 'smart/input-image',
  // sf-quantity draws the class component's markup, so the class sheet reads them.
  quantity: 'quantity',
  // Group B of the form fields, with their move to standard 1.3.8 (2026-10-27).
  'country-code': 'country-code',
  // A Smart component whose sheet sits beside its template.
  color: 'smart/input-color/js/templates',
  'range-slider': 'range-slider',
  'file-upload': 'file-upload',
  datepicker: 'datepicker',
  // The navigation family, with its move to standard 1.3.8 (2026-10-27).
  breadcrumbs: 'breadcrumbs',
  steps: 'step',
  close: 'close',
  icon: 'icons',
  'reference-link': 'reference-link',
  'download-file': 'download-file',
  'copy-button': 'smart/button-copy',
  'help-mark': 'smart/help-mark',
  // Display group B, with its move to standard 1.3.8 (2026-10-27): the class
  // sheets the Smart elements draw with, or a sheet of the element's own.
  'progress-bar': 'progress-bar',
  'progress-scale': 'progress-scale',
  // sf-progress-ring draws with its class sheet (2026-10-29).
  'progress-ring': 'progress-ring',
  spinner: 'spinner',
  skeleton: 'skeleton',
  'empty-state': 'smart/empty-state',
  'file-preview': 'file-preview',
  slider: 'slider',
  gallery: 'smart/gallery/js/templates',
  resizer: 'smart/resizer',
  'profile-picker': 'smart/profile-picker',
  // The editors and screens, with their move to standard 1.3.8 (2026-10-27).
  'page-header': 'smart/header-page',
  // The top bar of a SIMAI site (2026-10-28): a sheet of its own.
  'site-header': 'smart/header-site',
  // The site search window (2026-10-30): a sheet of its own.
  search: 'smart/search',
  // Neighbouring pages and steps (2026-10-30): a sheet of its own.
  pager: 'smart/pager',
  // The page's table of contents (2026-10-30): a sheet of its own.
  contents: 'smart/contents',
  // sf-list-item draws with the class sheet of the dropdown's rows.
  'list-item': 'dropdown',
  // sf-tree draws its rows with the tree and tree-item class sheets.
  tree: 'tree',
  'tree-item': 'tree-item',
  'theme-generator': 'smart/theme-generator',
  // sf-rich-text (2026-10-30): a sheet of its own, sf-textarea's set of names.
  'rich-text': 'smart/input-rich',
  // sf-lookup (2026-10-30): a sheet of its own, sf-input's set and the list's surface.
  lookup: 'smart/input-lookup',
  // sf-include (2026-11-02): a sheet of its own, the placeholder's height and the error row.
  include: 'smart/include',
  // sf-confirm and sf-confirm-change (2026-11-03, block confirm): each a sheet
  // beside its Lit template; sf-confirm-change's variables keep the stem of its
  // former tag, sf-change-confirm (rename plan R2), so its entry does too.
  confirm: 'smart/confirm/js/templates',
  'change-confirm': 'smart/confirm-change/js/templates',
  // sf-alert-bar (2026-11-05): a sheet of its own, the level fills, the inset and the list.
  'alert-bar': 'smart/alert-bar',
  // The Larena admin screens' tile, attention list and run progress (2026-11-07): sheets of their own.
  'tile-metric': 'smart/tile-metric',
  'list-attention': 'smart/list-attention',
  'progress-run': 'smart/progress-run',
  // sf-list and sf-list-feed (2026-11-05, block list): each a sheet beside its
  // Lit template.
  list: 'smart/list/js/templates',
  'list-feed': 'smart/list-feed/js/templates',
  // sf-wizard (2026-11-06): a sheet of its own, the frame's gap, inset, fill, edge, corner and width.
  wizard: 'smart/wizard',
  // sf-input-choice (2026-11-08): a sheet of its own, the cards' gap, width, room, corner, fills and edges.
  choice: 'smart/input-choice',
  // The Larena admin screens' description list and timeline (2026-11-08): sheets of their own.
  'list-description': 'smart/list-description',
  'list-timeline': 'smart/list-timeline',
  // The moment with its tooltip (2026-11-10, C40): a sheet of its own.
  time: 'smart/time',
  // «before → after» as text (2026-11-10, C40): a sheet of its own.
  change: 'smart/change',
  // The group heading of block list (2026-11-10, C40): a class, CSS only.
  'group-heading': 'group-heading',
  // The workspace layout (2026-10-30): a core layout, in the core sheet.
  workspace: 'core',
  // Code in running text (2026-11-07, R024): the base rule in the core sheet.
  code: 'core',
  // The code block (2026-11-09, simai/ui-source#31): the code surface's corner, fill, ink and edge.
  highlight: 'highlight',
  // Keys (2026-11-08, R030, rule C04): one look per place, in the kbd sheet.
  kbd: 'kbd',
  // The display parts of the structured-content types (2026-11-01): CSS only.
  card: 'card',
  figure: 'figure',
  procedure: 'procedure',
};

const scss = async (folder) => {
  if (Array.isArray(folder)) return (await Promise.all(folder.map(scss))).join('\n');
  const dir = folder === 'core' ? 'src/core/scss' : folder.endsWith('/templates') ? `src/${folder}` : folder.includes('/') ? `src/${folder}/scss` : `src/component/${folder}/scss`;
  const names = (await readdir(new URL(`../${dir}`, import.meta.url))).filter((name) => /\.s?css$/u.test(name));
  return (await Promise.all(names.map((name) => read(`${dir}/${name}`)))).join('\n');
};

const walk = async (dir) => (await Promise.all((await readdir(new URL(`../${dir}`, import.meta.url), {withFileTypes: true}))
  .map((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.(s?css|js|mjs)$/u.test(entry.name) ? [`${dir}/${entry.name}`] : []))))
  .flat();

// The pilot of four (2026-10-13), the twelve after it (2026-10-18), the
// segmented button group (2026-10-19), the image field (2026-10-24), the
// first whose sheet is its Smart element's own, the accordion (2026-10-25),
// whose class sheet sf-accordion draws with, the quantity (2026-10-25), the
// menu (2026-10-25), whose class sheet sf-menu draws with, and the
// verification code (2026-10-25), whose class sheet sf-code-input draws with.
test('every component in the contract has its stylesheet folder here, five to ten variables each', () => {
  assert.ok(isSchema(contract, 'simai.framework.public-variables', 1), 'either form of the format name');
  assert.deepEqual(contract.components.map((entry) => entry.component).sort(), Object.keys(FOLDERS).sort());
  for (const entry of contract.components) {
    assert.ok(entry.variables.length >= 5 && entry.variables.length <= 10, entry.component);
    for (const variable of entry.variables) {
      assert.match(variable.name, new RegExp(`^--sf-${entry.component}-[a-z]+(?:-[a-z]+)*$`, 'u'), variable.name);
      assert.doesNotMatch(variable.name.slice(2), /--/u, `${variable.name} has no double dash: that marks an internal one`);
    }
  }
});

test('every public variable is read by its component\'s stylesheet', async () => {
  for (const entry of contract.components) {
    const source = await scss(FOLDERS[entry.component]);
    for (const variable of entry.variables) {
      assert.ok(source.includes(`var(${variable.name},`), `${variable.name} is read in ${FOLDERS[entry.component]}`);
    }
  }
});

test('the Framework never sets a public variable', async () => {
  const names = contract.components.flatMap((entry) => entry.variables.map((variable) => variable.name));
  for (const file of await walk('src')) {
    const source = await read(file);
    for (const name of names) {
      assert.doesNotMatch(source, new RegExp(`(^|[;{\\s])${name}\\s*:`, 'mu'), `${file} sets ${name}`);
    }
  }
});

// The default the contract states is the one the sheet falls back to
// (2026-11-07: sf-menu-context 1.7.2 moved the panel's inset to --sf-space-1/3
// while the contract still said 1/4, and nothing compared the two). Checked
// where the sheet says it plainly: the variable does not vary with a setting,
// every read falls back to one and the same value, and that value is not an
// internal variable (--sf-<name>--<part>) whose own value moves with the
// state. A sheet's local alias (--sf-skeleton-base: var(--sf-ui-skeleton))
// is read through once, and a token's own fallback inside the value is
// ignored (var(--sf-scrim-color, var(--sf-black)) is var(--sf-scrim-color)).
const FORMER = new Map(JSON.parse(readFileSync(new URL('../src/core/contracts/token-aliases.v1.json', import.meta.url), 'utf8'))
  .component_variables.map(({from, to}) => [to, from]));
const plain = (value) => value.replace(/\\/gu, '').replace(/\s+/gu, '');
const withoutFallbacks = (value) => {
  let before;
  do {
    before = value;
    value = value.replace(/var\((--[\w/-]+),(?:[^()]|\([^()]*\))*\)/gu, 'var($1)');
  } while (value !== before);
  return value;
};
const fallbacksOf = (source, name) => {
  const found = [];
  const key = `var(${name},`;
  for (let at = source.indexOf(key); at >= 0; at = source.indexOf(key, at + key.length)) {
    let depth = 1;
    let end = at + key.length;
    for (; end < source.length && depth; end += 1) depth += source[end] === '(' ? 1 : source[end] === ')' ? -1 : 0;
    let fallback = plain(source.slice(at + key.length, end - 1));
    // A renamed variable reads its former name under the new one (C16); the
    // default is what the former name falls back to.
    const former = FORMER.get(name);
    if (former && fallback.startsWith(`var(${former},`) && fallback.endsWith(')')) fallback = fallback.slice(former.length + 5, -1);
    found.push(fallback);
  }
  return found;
};

test('a public variable\'s stated default is the value its stylesheet falls back to', async () => {
  const checked = [];
  for (const entry of contract.components) {
    const source = await scss(FOLDERS[entry.component]);
    for (const variable of entry.variables) {
      if (!('default' in variable) || variable.varies_with) continue;
      const fallbacks = [...new Set(fallbacksOf(source, variable.name))];
      if (fallbacks.length !== 1 || /--sf-[a-z0-9-]+--/u.test(fallbacks[0])) continue;
      const [fallback] = fallbacks;
      const alias = /^var\((--[\w/-]+)\)$/u.exec(fallback)?.[1];
      const local = alias ? [...new Set([...source.matchAll(new RegExp(`${alias.replace(/\//gu, '\\/')}\\s*:\\s*([^;]+);`, 'gu'))].map((match) => plain(match[1])))] : [];
      const stated = withoutFallbacks(plain(variable.default));
      const read = [fallback, ...(local.length === 1 ? local : [])].map(withoutFallbacks);
      assert.ok(read.includes(stated), `${variable.name}: the contract says ${variable.default}, ${FOLDERS[entry.component]} falls back to ${fallback}`);
      checked.push(variable.name);
    }
  }
  assert.ok(checked.length > 200, `${checked.length} defaults compared`);
});
