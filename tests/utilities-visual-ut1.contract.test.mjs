// Utilities joint pass, visual group (RG-UT-V, pair 5.20261115.1622; study
// pages ui-control prototypes/utilities-*-study.html): the Framework defects
// fixed without an owner question. Source-level checks; the browser probe of
// the branch checks the built sheets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const {convertTailwindClasses} = await import('../src/core/js/tailwind-map.js');
const journal = JSON.parse(read('contracts/changes/journal.json'));
const BP = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];
const rule = (folder, variant = 'default') => {
  const SF = {RuleLoader: {}};
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  return Object.values(SF.RuleLoader)[0];
};
const dated = (id, names) => {
  const rec = table.records.find((item) => item.journal === id);
  assert.ok(rec, id);
  assert.equal(rec.remove_after, '2027-01-01');
  const entry = journal.records.find((item) => item.id === id);
  assert.ok(entry, `${id} in the journal`);
  assert.deepEqual(Object.fromEntries(entry.items.map(({from, to}) => [from, to])), names);
  for (const [from, to] of Object.entries(names)) assert.equal(aliases.retiredClassName(from)?.to, to, from);
};

test('(1) BG-1: bg-fb-messenger writes its gradient as an image, not as a colour', () => {
  for (const v of ['default', 'hover']) {
    const vars = read(`src/utility/background-color-brand/${v}/scss/_sf_var__background_color_brand.scss`);
    assert.match(vars, /fb-messenger: '#e72c83; background-image: linear-gradient\(/u, v);
  }
});

test('(2) BG-2, TRF-1, BG-3: logical positions turn under rtl; physical bg-* are dated aliases', () => {
  for (const bp of BP) {
    assert.match(read(`src/utility/background-position/${bp}/scss/_sf_css_background_position.scss`),
      /\.#\{\$infix\}bg-#\{\$bg-position-name\}:where\(:dir\(rtl\)\)/u, bp);
  }
  const vars = read('src/utility/background-position/default/scss/_sf_var_background_position.scss');
  assert.match(vars, /\$bg-position-rtl-array: \(\n  inline-start: right,/u);
  assert.match(read('src/utility/transform-origin/default/scss/_sf_css__transform_origin.scss'), /origin-#\{\$transform-origin-name\}:where\(:dir\(rtl\)\)/u);
  assert.match(read('src/utility/transform-origin/default/scss/_sf_var__transform_origin.scss'), /\$transform-origin-rtl-array: \(\n    top-inline-end: top left,/u);
  dated('class-ut1-bg-position', {'bg-left': 'bg-inline-start', 'bg-left-top': 'bg-inline-start-top', 'bg-left-bottom': 'bg-inline-start-bottom',
    'bg-right': 'bg-inline-end', 'bg-right-top': 'bg-inline-end-top', 'bg-right-bottom': 'bg-inline-end-bottom'});
});

test('(3) line widths 1 and 2 read the line roles', () => {
  for (const path of ['border-width/default/scss/_sf_var__border_width.scss', 'outline-width/default/scss/_sf_var__outline_width.scss',
    'ring-width/default/scss/_sf_var__ring_width.scss', 'divider-width/default/scss/_sf_var__divider_width.scss']) {
    const text = read(`src/utility/${path}`);
    assert.match(text, /\b1: line--border,\s*2: line--indicator,/u, path);
  }
  assert.match(read('src/utility/stroke-width/default/scss/_sf_var__stroke_width.scss'), /1: --sf-line--border,\s*2: --sf-line--indicator,/u);
  assert.match(read('src/utility/text-decoration-thickness/default/scss/_sf_var__text_decoration_thicknees.scss'),
    /1 : var\(--sf-line--border\),\s*2 : var\(--sf-line--indicator\),/u);
});

test('(4) ANIM-4 and (5) ANIM-5: .animation on the enter role; motion utilities stop under reduce', () => {
  const animation = read('src/utility/animation/default/scss/_sf_css__animation.scss');
  assert.match(animation, /animation-timing-function: var\(--sf-ease-enter\);/u);
  assert.doesNotMatch(animation, /var\(--sf-animation\)/u);
  const reduce = (text) => (text.match(/@media \(prefers-reduced-motion: reduce\) \{\s*(?:animation|transition)-duration: 0\.01ms;/gu) || []).length;
  assert.equal(reduce(animation), 2, '.animation and .infinite');
  assert.equal(reduce(read('src/utility/animation-duration/default/scss/_sf_css__animation_duration.scss')), 1);
  assert.equal(reduce(read('src/utility/transition-duration/default/scss/_sf_css__transition_duration.scss')), 1);
  for (const bp of BP) assert.equal(reduce(read(`src/utility/transition-property/${bp}/scss/_sf_css__transition_property.scss`)), 1, bp);
});

test('(6) LNK-4: a link- class is read at the start of a class name', () => {
  const link = read('src/core/scss/_sf_css__link.scss');
  assert.doesNotMatch(link, /\[class\*=link-\]\s*[,~{]/u);
  for (const selector of ["a[class^='link-']", "a[class*=' link-']", "a[class*=':link-']", "[class^='link-'] ~ a", "[class*=' link-'] ~ a", "[class*=':link-'] ~ a"]) {
    assert.equal(link.split(selector).length - 1, 4, selector);
  }
  assert.doesNotMatch(link, /:is\(\[class/u, 'a list with :is() is split by the build');
});

test('(7) TYP-2: the Tailwind conversion writes current names, never a retired one', () => {
  for (const [from, to] of [['whitespace-nowrap', 'text-nowrap'], ['text-ellipsis', 'truncate'], ['text-clip', 'truncate']]) {
    assert.equal(convertTailwindClasses(from), to, from);
    assert.equal(aliases.retiredClassName(to), null, `${to} is not retired`);
  }
});

test('(8) TYP-4: small-caps-none restores the capitals only', () => {
  assert.match(read('src/utility/font-variant/default/scss/_sf_css__font_variant.scss'), /font-variant-caps: #\{\$variant-value\};/u);
  assert.match(read('src/utility/font-variant/default/scss/_sf_var__font_variant.scss'), /-none: normal\n/u);
});

test('(9) TXF-1, (10) SVG-1/2, TXF-2: decoration-current and the accent roles of stroke and decoration', () => {
  const deco = read('src/utility/text-decoration-color/default/scss/_sf_var__text_decoration_color.scss');
  assert.match(deco, /'current' : 'current',/u);
  const stroke = read('src/utility/stroke-color/default/scss/_sf_var__stroke.scss');
  for (const role of ['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info']) {
    assert.match(deco, new RegExp(`'${role}': '${role}',`, 'u'), `decoration-${role}`);
    assert.match(stroke, new RegExp(`'-${role}': '${role}',`, 'u'), `stroke-${role}`);
  }
  assert.ok(rule('stroke-color').test('stroke-info'));
  assert.ok(rule('stroke-color', 'hover').test('hover:stroke-info'));
});

test('(11) TRF-3: -rotate-* exist and are loaded', () => {
  assert.match(read('src/utility/transform-rotate/default/scss/_sf_css__transform_rotate.scss'), /\.-#\{\$infix\}rotate-#\{\$transform-rotate-name\} \{\s*transform: rotate\(-#\{\$transform-rotate-value\}deg\);/u);
  const re = rule('transform-rotate');
  for (const name of ['-rotate-90', '-rotate-180', '-rotate-45', 'rotate-90']) assert.ok(re.test(name), name);
  assert.equal(re.test('-rotate-0'), false);
});

test('(12) FLT-3, (13) BRD-4, (15) TYP-5: second names are dated aliases', () => {
  dated('class-ut1-blur', {blur: 'blur-medium', 'backdrop-blur': 'backdrop-blur-medium'});
  const sides = ['', 'top-', 'bottom-', 'inline-start-', 'inline-end-', 'top-inline-start-', 'top-inline-end-', 'bottom-inline-start-', 'bottom-inline-end-'];
  dated('class-ut1-radius-square', Object.fromEntries(sides.map((s) => [`radius-${s}square`, `radius-${s}0`])));
  dated('class-ut1-tracking', {'tracking-no-tracking': 'tracking-normal'});
  assert.ok(rule('letter-spacing').test('tracking-normal'));
  assert.match(read('src/utility/letter-spacing/default/scss/_sf_css__letter_spacing.scss'), /\.#\{\$infix\}tracking-normal \{\s*letter-spacing: var\(--sf-text--tracking-no-tracking\);/u);
  for (const name of ['blur-medium', 'backdrop-blur-medium', 'radius-0', 'tracking-normal']) assert.equal(aliases.retiredClassName(name), null, name);
});

test('(14) STR-2: stripes on a role at step 8 and on space steps', () => {
  assert.match(read('src/core/scss/_sf_css__color.scss'), /--sf-stripe--color: var\(--sf-surface-state-select\);/u);
  const opacity = read('src/core/scss/_sf_css__opacity.scss');
  assert.match(opacity, /--sf-stripe--color: var\(--sf-surface-state-select\);/u);
  assert.match(opacity, /--sf-stripe--size: var\(--sf-space-1\\\/2\);/u);
  const sizes = read('src/utility/stripe-width/default/scss/_sf_var__stripe.scss');
  assert.doesNotMatch(sizes, /:\s*a\d/u);
  assert.match(sizes, /1: 'space-1\\\\\/4',/u);
});

test('(16) TYP-6: the C18 exceptions are listed in the foundations standard', () => {
  const doc = read('docs/foundation-standard.md');
  assert.match(doc, /## Exceptions to C18/u);
  assert.match(doc, /--sf-text--measure.*65ch, 45ch, 80ch before C396.*--sf-measure-80/u); // C396: the steps of the width ladder in characters
});

test('(18): sf-card draws the ring and place shadow its utilities set; they do not inherit', () => {
  const card = read('src/component/card/scss/_css__card.scss');
  assert.match(card, /box-shadow: var\(--sf-ring-shadow, 0 0 transparent\), var\(--sf-place-shadow, 0 0 transparent\);/u);
  assert.match(card, /box-shadow: var\(--sf-ring-shadow, 0 0 transparent\), var\(--sf-place-shadow, var\(--sf-shadow-raised\)\);/u);
  for (const path of ['src/utility/box-shadow/default/scss/_var__shadow.scss', 'src/utility/ring-width/default/scss/_sf_var__ring_width.scss']) {
    const text = read(path);
    for (const name of ['--sf-place-shadow', '--sf-ring-shadow']) assert.match(text, new RegExp(`@property ${name} \\{\\s*syntax: "\\*";\\s*inherits: false;\\s*\\}`, 'u'), `${path} ${name}`);
  }
});
