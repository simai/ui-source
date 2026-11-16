// Owner decisions C264-C272 and C274, 2026-11-17 (ui-control
// control/docs-review/decisions.md; prototypes utilities-*-study.html and
// guide-size-and-type-study.html): one aspect list, logical object sides,
// scroll side names as m-/p-, pointer-events-*, the brand colours as a listed
// C18 exception with a dark-theme edge for the black brands, the wider line
// steps on the extended page, percent scale names, the slant retired, and the
// short text-role names as dated aliases. C267 (print-hidden is display: none
// on paper, print-invisible keeps the room) is tests/hide-c212.contract.test.mjs.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const {convertTailwindClassToken} = await import('../src/core/js/tailwind-map.js');
const journal = json('contracts/changes/journal.json');

const SF = {RuleLoader: {}};
const ruleOf = (folder, variant = 'default') => {
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  const rule = SF.RuleLoader[`${folder}/${variant}`];
  return rule.regex || rule;
};
const record = (id) => {
  const found = table.records.find(({journal: name}) => name === id);
  assert.ok(found, `${id} is in the retired-classes table`);
  assert.equal(found.since, '2026-11-17');
  assert.equal(found.remove_after, '2027-01-01');
  const entry = journal.records.find((item) => item.id === id);
  assert.ok(entry, `${id} is in the change journal`);
  assert.equal(entry.stage, 'compat');
  assert.equal(entry.remove_after, '2027-01-01');
  return {found, entry};
};
const to = (name) => aliases.retiredClassName(name)?.to ?? null;
const version = (folder) => json(`src/utility/${folder}/passport.json`).version;

test('C264: one aspect list - 1x1, 4x3, 3x2, 16x9, 21x9, 3x4, auto; the six other names are dated aliases', () => {
  const vars = read('src/utility/aspect-ratio/default/scss/_var__aspect_ratio.scss');
  assert.match(vars, /'21x9' : '21 \/ 9',/u);
  assert.match(vars, /'auto' : 'auto',/u);
  for (const variant of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const rule = ruleOf('aspect-ratio', variant);
    const prefix = variant === 'default' ? '' : `${variant}:`;
    for (const name of ['1x1', '4x3', '3x2', '16x9', '21x9', '3x4', 'auto', '9x16', '2x1']) {
      assert.ok(rule.test(`${prefix}aspect-${name}`), `${prefix}aspect-${name} loads`);
    }
    assert.ok(!rule.test(`${prefix}aspect-5x4`));
  }
  const {found, entry} = record('class-c264-aspect-list');
  const former = {'aspect-9x16': 'aspect-3x4', 'aspect-1x2': 'aspect-3x4', 'aspect-2x3': 'aspect-3x4',
    'aspect-2x1': 'aspect-16x9', 'aspect-3x1': 'aspect-21x9', 'aspect-4x1': 'aspect-21x9'};
  assert.deepEqual(found.names, former);
  assert.equal(to('md:aspect-9x16'), 'md:aspect-3x4');
  for (const name of ['aspect-1x1', 'aspect-4x3', 'aspect-3x2', 'aspect-16x9', 'aspect-21x9', 'aspect-3x4', 'aspect-auto']) {
    assert.equal(aliases.retiredClassName(name), null, `${name} stays`);
  }
  assert.equal(entry.rewrite, 'manual', 'the nearest proportion looks different');
  assert.equal(version('aspect-ratio'), '1.1.0');
});

test('C265: object-inline-start/-end take the other side under dir=rtl, at every breakpoint', () => {
  const vars = read('src/utility/object-position/default/scss/_sf_var__object.scss');
  assert.match(vars, /\$object-position-rtl-array:\(\s*inline-start:right,\s*inline-start-bottom:right bottom,\s*inline-start-top:right top,\s*inline-end:left,\s*inline-end-bottom: left bottom,\s*inline-end-top: left top,\s*\);/u);
  for (const variant of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const css = read(`src/utility/object-position/${variant}/scss/_sf_css__object.scss`);
    // :where() keeps the class's own specificity, so a breakpoint form later in
    // the cascade still wins over the base class under rtl.
    assert.match(css, /@each \$object-position-name, \$object-position-value in \$object-position-rtl-array \{\s*\.#\{\$infix\}object-#\{\$object-position-name\}:where\(:dir\(rtl\)\) \{\s*object-position: #\{\$object-position-value\};/u, variant);
  }
  assert.equal(version('object-position'), '1.0.1');
});

test('C266: scroll margins and paddings name their sides as m-* and p-*; the short letters are dated aliases', () => {
  const margin = ruleOf('scroll-margin');
  const padding = ruleOf('scroll-padding');
  for (const name of ['scroll-m-top-4', 'scroll-m-bottom-1/2', 'scroll-m-block-8', 'scroll-m-inline-start-1/4', 'scroll-mt-4', 'scroll-my-0']) {
    assert.ok(margin.test(name), `${name} loads`);
  }
  for (const name of ['scroll-p-top-4', 'scroll-p-bottom-2', 'scroll-p-inline-start-1/3', 'scroll-p-inline-end-1', 'scroll-p-x-4', 'scroll-p-y-8', 'scroll-pl-4', 'scroll-px-2']) {
    assert.ok(padding.test(name), `${name} loads`);
  }
  assert.ok(!margin.test('scroll-m-x-4') && !padding.test('scroll-p-block-4'), 'margins say inline/block, paddings x/y, as m-* and p-*');
  const mcss = read('src/utility/scroll-margin/default/scss/_sf_css__scroll_margin.scss');
  const pcss = read('src/utility/scroll-padding/default/scss/_sf_css__scroll_padding.scss');
  for (const [now, before] of [['scroll-m-top', 'scroll-mt'], ['scroll-m-bottom', 'scroll-mb'], ['scroll-m-block', 'scroll-my']]) {
    assert.match(mcss, new RegExp(`\\.#\\{\\$infix\\}${now}-#\\{\\$size\\},\\s*\\.#\\{\\$infix\\}${before}-#\\{\\$size\\} \\{`, 'u'), now);
  }
  const SIDES = {'scroll-p-top': 'scroll-pt', 'scroll-p-bottom': 'scroll-pb', 'scroll-p-inline-start': 'scroll-pl',
    'scroll-p-inline-end': 'scroll-pr', 'scroll-p-x': 'scroll-px', 'scroll-p-y': 'scroll-py'};
  for (const [now, before] of Object.entries(SIDES)) {
    assert.match(pcss, new RegExp(`\\.#\\{\\$infix\\}${now}-#\\{\\$size\\},\\s*\\.#\\{\\$infix\\}${before}-#\\{\\$size\\} \\{`, 'u'), now);
  }
  record('class-c266-scroll-side-names');
  assert.equal(to('scroll-mt-4'), 'scroll-m-top-4');
  assert.equal(to('scroll-my-1/2'), 'scroll-m-block-1/2');
  assert.equal(to('scroll-pl-1/3'), 'scroll-p-inline-start-1/3');
  assert.equal(to('scroll-pr-2'), 'scroll-p-inline-end-2');
  assert.equal(to('scroll-px-8'), 'scroll-p-x-8');
  for (const name of ['scroll-m-top-4', 'scroll-p-x-4', 'scroll-m-4', 'scroll-p-inline-start-1']) assert.equal(aliases.retiredClassName(name), null, name);
  assert.equal(version('scroll-margin'), '1.1.0');
  assert.equal(version('scroll-padding'), '1.1.0');
});

test('C268: pointer-events-* is the class; pointer-event-* is a dated alias; the Framework writes the class', () => {
  const rule = ruleOf('pointer-events');
  for (const name of ['pointer-events-none', 'pointer-events-auto', 'pointer-event-none', 'pointer-event-auto']) assert.ok(rule.test(name), name);
  assert.match(read('src/utility/pointer-events/default/scss/_sf_css__pointer_events.scss'),
    /\.#\{\$infix\}pointer-events-#\{\$pointer-events-name\},\s*\.#\{\$infix\}pointer-event-#\{\$pointer-events-name\} \{/u);
  record('class-c268-pointer-events');
  assert.equal(to('pointer-event-none'), 'pointer-events-none');
  assert.equal(aliases.retiredClassName('pointer-events-none'), null);
  // The Tailwind name is the class now: the Loader leaves it as written.
  assert.equal(convertTailwindClassToken('pointer-events-none'), 'pointer-events-none');
  // No template, static page or script of the Framework writes the former name.
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const path = `${dir}/${name}`;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      // component.json keeps the version notes, which name the former class.
      else if (/\.(?:m?js|html|json|scss)$/u.test(name) && name !== 'component.json'
        && /(?<![\w-])pointer-event-(?:none|auto)(?![\w-])/u.test(read(path))) found.push(path);
    }
  };
  walk('src/smart');
  walk('src/component');
  assert.deepEqual(found, []);
  assert.equal(version('pointer-events'), '1.1.0');
});

test('C269: the brand colours are a listed C18 exception; the black brands get an outline-variant edge in the dark theme', () => {
  const standard = read('docs/foundation-standard.md');
  assert.match(standard, /\| Brand colours \(C18, C269\) \| `bg-<brand>`/u);
  assert.doesNotMatch(standard, /Pending an owner decision, not listed yet: the brand colours/u);
  const vars = read('src/utility/background-color-brand/default/scss/_sf_var__background_color_brand.scss');
  assert.match(vars, /\$bg-color-brand-dark-edge: \(tiktok, qq, tumblr\);/u);
  // Messenger draws (RG-UT-V BG-1, kept): the gradient is an image over the first colour.
  assert.match(vars, /fb-messenger: '#e72c83; background-image: linear-gradient/u);
  const css = read('src/utility/background-color-brand/default/scss/_sf_css__background_color_brand.scss');
  assert.match(css, /\.#\{\$infix\}bg-#\{\$bg-color-brand-name\}:not\(:focus-visible\) \{\s*outline: var\(--sf-line--border\) solid light-dark\(transparent, var\(--sf-outline-variant\)\);\s*outline-offset: calc\(-1 \* var\(--sf-line--border\)\);/u);
  assert.match(read('src/utility/fill-brand/default/scss/_sf_var__fill_brand.scss'), /listed exception to C18 \(owner decision C269/u);
  assert.equal(version('background-color-brand'), '1.1.0');
  assert.equal(version('fill-brand'), '1.0.1');
});

test('C270: SVG stroke and text decoration widths 1, 2 are the line roles; the wider steps are on the extended page', () => {
  const stroke = read('src/utility/stroke-width/default/scss/_sf_var__stroke_width.scss');
  assert.match(stroke, /1: --sf-line--border,\s*2: --sf-line--indicator,/u);
  const decoration = read('src/utility/text-decoration-thickness/default/scss/_sf_var__text_decoration_thicknees.scss');
  assert.match(decoration, /1 : var\(--sf-line--border\),\s*2 : var\(--sf-line--indicator\),/u);
  assert.match(table.extended.decision, /C270/u);
  const family = (name) => table.extended.patterns.find((item) => item.family === name);
  const strokeWide = new RegExp(family('stroke-width 3-10').pattern, 'u');
  const decorationWide = new RegExp(family('text-decoration-thickness 3-4').pattern, 'u');
  for (let step = 3; step <= 10; step++) assert.ok(strokeWide.test(`stroke-${step}`), `stroke-${step}`);
  for (const name of ['stroke-0', 'stroke-1', 'stroke-2', 'stroke-11']) assert.ok(!strokeWide.test(name), name);
  assert.ok(decorationWide.test('decoration-3') && decorationWide.test('decoration-4'));
  assert.ok(!decorationWide.test('decoration-2') && !decorationWide.test('decoration-offset-3'));
  // Nothing is retired: the wider steps keep their sheet and their name.
  for (const name of ['stroke-5', 'decoration-4']) assert.equal(aliases.retiredClassName(name), null, name);
});

test('C271: scale names say their percent; the fraction and step names are dated aliases', () => {
  const STEPS = {'1/4': '80', '1/3': '90', '1/2': '95', '1': '100', '2': '105', '3': '110', '4': '120'};
  for (const variant of ['default', 'hover']) {
    const rule = ruleOf('transform-scale', variant);
    const prefix = variant === 'default' ? '' : 'hover:';
    for (const axis of ['', 'x-', 'y-']) {
      for (const [before, now] of Object.entries(STEPS)) {
        assert.ok(rule.test(`${prefix}scale-${axis}${now}`), `${prefix}scale-${axis}${now}`);
        assert.ok(rule.test(`${prefix}scale-${axis}${before}`), `${prefix}scale-${axis}${before}`);
      }
      assert.ok(rule.test(`${prefix}scale-${axis}0`));
    }
    assert.ok(!rule.test(`${prefix}scale-85`) && !rule.test(`${prefix}scale-10`));
  }
  const vars = read('src/utility/transform-scale/default/scss/_sf_var__transform_scale.scss');
  assert.match(vars, /\$transform-scale-percent: \(\s*'80': \.8,\s*'90': \.9,\s*'95': \.95,\s*'100': 1,\s*'105': 1\.05,\s*'110': 1\.1,\s*'120': 1\.2,\s*\);/u);
  const {found} = record('class-c271-scale-percent');
  assert.equal(Object.keys(found.names).length, 21);
  assert.equal(to('scale-1/2'), 'scale-95');
  assert.equal(to('hover:scale-2'), 'hover:scale-105');
  assert.equal(to('scale-y-1/4'), 'scale-y-80');
  for (const name of ['scale-0', 'scale-95', 'scale-x-120']) assert.equal(aliases.retiredClassName(name), null, name);
  assert.equal(version('transform-scale'), '1.1.0');
});

test('C272: the skew sheet is retired until 2027-01-01 and noted once', () => {
  const {found, entry} = record('utility-c272-skew-retired');
  assert.deepEqual(found.sheets, {'transform-skew': null});
  assert.equal(aliases.noteRetiredUtilitySheets('skew-x-5', ['transform-skew/default'], Date.parse('2026-11-17')), true);
  assert.equal(aliases.noteRetiredUtilitySheets('hover:skew-y-15', ['transform-skew/hover'], Date.parse('2026-11-17')), true);
  const match = new RegExp(entry.items[0].match, 'gu');
  assert.deepEqual('skew-x-5 hover:skew-y-15 skew-x-4'.match(match), ['skew-x-5', 'hover:skew-y-15']);
  assert.ok(ruleOf('transform-skew').test('skew-x-15'), 'the sheet still loads until the date');
  assert.equal(version('transform-skew'), '1.0.1');
});

test('C274: the short text-role names are dated aliases of the roles and the C212 text utilities', () => {
  const {found, entry} = record('class-c274-text-role-short-names');
  const expected = {text: 'text-1', 'text-medium': 'text-1', 'text-small': 'text-1/2', 'text-large': 'text-2',
    label: 'text-1/3', 'label-medium': 'text-1/3', 'label-small': 'text-1/4', 'label-large': 'sf-label-large'};
  for (let step = 1; step <= 6; step++) {
    expected[`d${step}`] = `sf-display-${step}`;
    expected[`display${step}`] = `sf-display-${step}`;
  }
  assert.deepEqual(found.names, expected);
  for (const [from, name] of Object.entries(expected)) assert.equal(to(from), name, from);
  for (const name of ['sf-display-1', 'sf-body-large', 'sf-label-small', 'text-1', 'text-2', 'body-text']) {
    assert.equal(aliases.retiredClassName(name), null, `${name} stays`);
  }
  // sf-upgrade reports them only inside a class attribute: <label> and the word text elsewhere are not them.
  for (const item of entry.items) {
    const match = new RegExp(item.match, 'gu');
    assert.equal(`<label for="a">text</label>`.match(match), null, item.from);
    assert.equal(`<p class="x ${item.from} y">`.match(match)?.[0], item.from, item.from);
  }
  // The text-large value (16/24 at desktop) is text-2's.
  const roles = read('src/core/figma_variables/figma_typography_roles.scss');
  assert.match(roles, /--sf-text-large--size: var\(--sf-text--size-2\);\s*--sf-text-large--height: var\(--sf-text--height-2\);/u);
  // The paragraph lead of the composition writes the utility, not the alias.
  assert.match(read('src/core/js/composition/builtins.mjs'), /lead: \['text-2', 'color-on-surface-variant'\]/u);
  const types = json('src/core/contracts/composition-types.v1.json');
  assert.ok(!JSON.stringify(types).includes('"text-large"'));
});
