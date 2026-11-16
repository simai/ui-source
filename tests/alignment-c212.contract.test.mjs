// Owner decision C212 (2), 2026-11-16 (research control/research/2026-11-15-
// utilities-sprawl.md section 2 in simai/ui-control): alignment has one public
// spelling, the SIMAI Framework axis names -- content-main-*, content-cross-*,
// items-main-*, items-cross-*, self-main-*, self-cross-* and, for both axes,
// items-*, content-*, self-*. Tailwind names work through the Loader's
// conversion only (C214: it is not extended); justify-* and the nine flex-align
// classes are dated aliases (journal class-c212-alignment).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
const {convertTailwindClasses} = await import('../src/core/js/tailwind-map.js');

const BREAKPOINTS = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];
const FOLDERS = ['justify-content', 'align-items', 'justify-items', 'place-items', 'align-content', 'place-content',
  'align-self', 'justify-self', 'place-self', 'flex-align'];
const SF = {RuleLoader: {}};
for (const folder of FOLDERS) for (const bp of BREAKPOINTS) new Function('SF', read(`src/utility/${folder}/${bp}/rule.js`))(SF);
const served = (token) => FOLDERS.filter((folder) => {
  const bp = token.includes(':') ? token.split(':')[0] : 'default';
  return SF.RuleLoader[`${folder}/${bp}`]?.test(token);
});

const PUBLIC = {
  'content-main': ['start', 'end', 'center', 'between', 'around', 'evenly'],
  'content-cross': ['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'],
  'items-main': ['start', 'end', 'center', 'stretch'],
  'items-cross': ['start', 'end', 'center', 'baseline', 'stretch'],
  'self-main': ['auto', 'start', 'end', 'center', 'stretch'],
  'self-cross': ['auto', 'start', 'end', 'center', 'stretch', 'baseline'],
  items: ['start', 'end', 'center', 'stretch'],
  content: ['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'],
  self: ['auto', 'start', 'end', 'center', 'stretch'],
};
const publicNames = Object.entries(PUBLIC).flatMap(([family, values]) => values.map((value) => `${family}-${value}`));
const AXES = ['start', 'center', 'end'];
const FLEX_ALIGN = AXES.flatMap((main) => AXES.map((cross) => [`${main}-${cross}`, main, cross]));
const JUSTIFY = PUBLIC['content-main'].map((value) => `justify-${value}`);
const record = table.records.find((item) => item.journal === 'class-c212-alignment');

test('C212 (2): every public axis name is served at every breakpoint and is not retired', () => {
  assert.equal(publicNames.length, 49);
  for (const bp of BREAKPOINTS) {
    const prefix = bp === 'default' ? '' : `${bp}:`;
    for (const name of publicNames) {
      assert.equal(served(`${prefix}${name}`).length, 1, `${prefix}${name} is served by one sheet`);
      assert.equal(aliases.retiredClassName(`${prefix}${name}`), null, `${prefix}${name} is public`);
    }
  }
});

test('C212 (2): justify-* and the nine flex-align classes are dated aliases in the one table and the journal', () => {
  assert.ok(record, 'class-c212-alignment record');
  assert.equal(record.decision, 'C212 (2)');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(Object.keys(record.names).sort(), [...JUSTIFY, ...FLEX_ALIGN.map(([name]) => name)].sort());
  for (const name of JUSTIFY) assert.equal(record.names[name], name.replace(/^justify-/, 'content-main-'));
  for (const [name, main, cross] of FLEX_ALIGN) assert.equal(record.names[name], `content-main-${main} items-cross-${cross}`);
  const journal = JSON.parse(read('contracts/changes/journal.json')).records.find(({id}) => id === 'class-c212-alignment');
  assert.ok(journal);
  assert.equal(journal.remove_after, record.remove_after);
  assert.deepEqual(Object.fromEntries(journal.items.map(({from, to}) => [from, to])), record.names);
  // A flex-align name is looked for in class attributes only: the popover's
  // placement values (start-end, end-start) are no classes.
  for (const item of journal.items.filter(({from}) => !from.startsWith('justify-'))) {
    const re = new RegExp(item.match, 'gu');
    assert.ok(re.test(`<div class="flex md:${item.from}">`), item.from);
    assert.equal(new RegExp(item.match, 'gu').test(`<sf-popover placement="${item.from}">`), false, item.from);
  }
});

test('C212 (2): the old names keep drawing until the date, and the variant goes on both new classes', () => {
  for (const bp of BREAKPOINTS) {
    const prefix = bp === 'default' ? '' : `${bp}:`;
    for (const name of [...JUSTIFY, ...FLEX_ALIGN.map(([n]) => n)]) {
      assert.equal(served(`${prefix}${name}`).length, 1, `${prefix}${name} still loads its sheet`);
    }
    const justify = read(`src/utility/justify-content/${bp}/scss/_sf_css__justify_content.scss`);
    assert.match(justify, /\.#\{\$infix\}justify-#\{\$flex-justify-content-name\},\s*\.#\{\$infix\}content-main-#\{\$flex-justify-content-name\}/u);
    assert.match(justify, /deprecated until\s*\/\/\s*2027-01-01/u, `${bp}: the sheet says the alias is dated`);
    assert.match(read(`src/utility/flex-align/${bp}/scss/_sf_css__align.scss`), /deprecated until 2027-01-01, owner decision C212 \(2\)/u);
  }
  assert.equal(aliases.retiredClassName('md:center-end').to, 'md:content-main-center md:items-cross-end');
  assert.equal(aliases.retiredClassName('justify-between').to, 'content-main-between');
  assert.equal(aliases.retiredClassName('start-stretch'), null, 'not a flex-align class');
});

test('C212 (2): a flex-align class writes what its two new classes write (flex-start/-end on the cross axis is start/end)', () => {
  const vars = (path, name) => Object.fromEntries([...read(path).match(new RegExp(`\\$${name}:\\s*\\(([^)]*)\\)`, 'u'))[1]
    .matchAll(/([a-z]+):\s*([a-z-]+)/gu)].map(([, key, value]) => [key, value]));
  const main = vars('src/utility/justify-content/default/scss/_sf_var__justify_content.scss', 'flex-justify-content-array');
  const cross = vars('src/utility/align-items/default/scss/_sf_var__align_items.scss', 'flex-align-items-array');
  const LEGACY = {'flex-start': 'start', 'flex-end': 'end', center: 'center'};
  for (const bp of BREAKPOINTS) {
    const sheet = read(`src/utility/flex-align/${bp}/scss/_sf_css__align.scss`);
    for (const [name, m, c] of FLEX_ALIGN) {
      const body = sheet.match(new RegExp(`\\.#\\{\\$infix\\}${name}\\s*\\{([^}]*)\\}`, 'u'))[1];
      assert.equal(body.match(/justify-content:\s*([a-z-]+)/u)[1], main[m], `${bp} ${name} main axis`);
      assert.equal(LEGACY[body.match(/align-items:\s*([a-z-]+)/u)[1]], cross[c], `${bp} ${name} cross axis`);
    }
  }
});

test('C212 (2): the Loader notes a flex-align name once with both classes to write', () => {
  clearDeprecations();
  assert.equal(aliases.noteUtilityClassAlias('center-center', Date.parse('2026-11-16')), 'content-main-center items-cross-center');
  aliases.noteUtilityClassAlias('center-center', Date.parse('2026-11-16'));
  aliases.noteUtilityClassAlias('content-main-center', Date.parse('2026-11-16'));
  const listed = listDeprecations().filter(({from}) => /center/.test(from));
  assert.deepEqual(listed.map(({from, to, kind}) => [from, to, kind]), [['center-center', 'content-main-center items-cross-center', 'class']]);
  clearDeprecations();
});

test('C212 (2), C214: the Tailwind alignment names convert to served Framework names, never to a retired one', () => {
  const TAILWIND = [
    ...JUSTIFY,
    ...['start', 'end', 'center', 'stretch'].map((v) => `justify-items-${v}`),
    ...['auto', 'start', 'end', 'center', 'stretch'].map((v) => `justify-self-${v}`),
    ...['start', 'end', 'center', 'stretch'].map((v) => `place-items-${v}`),
    ...['auto', 'start', 'end', 'center', 'stretch'].map((v) => `place-self-${v}`),
    ...['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'].map((v) => `place-content-${v}`),
    'items-baseline',
  ];
  for (const name of TAILWIND) {
    for (const token of convertTailwindClasses(`md:${name}`).split(' ')) {
      assert.equal(aliases.retiredClassName(token), null, `${name} -> ${token} is not retired`);
      assert.ok(served(token).length >= 1, `${name} -> ${token} is served`);
      assert.ok(!/^md:justify-/u.test(token), `${name} is converted`);
    }
  }
  // The Framework's own both-axes names are not Tailwind's: items-center stays
  // place-items (C212 (2)).
  assert.equal(convertTailwindClasses('items-center'), 'items-center');
});
