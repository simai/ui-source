import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// An on-surface outline or ghost button on a strong place keeps the place's
// ink on hover and press (C107 open item 5, 2026-11-12). The button's hovered
// and pressed label and icon read --sf-on-surface-hover and
// --sf-on-surface-active, the theme's dark neutral 15 and 20. A strong place
// (bg-<c>, the alert bar's levels) and glass re-declared the ink and the state
// fills but not those two, so the button went dark under the pointer
// (#24262a / #2f3035 on blue). The places now declare them as their own ink,
// and an opaque place on them (a card, a popup) takes the theme's back.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, 'src', path), 'utf8');

const buttons = read('component/buttons/scss/_css__buttons.scss');
const mix = read('core/scss/mix/_mix__places.scss');
const glass = read('core/scss/_sf_css__surface_places.scss');
const theme = read('core/scss/_sf_css__theme.scss');
const popover = read('smart/popover/js/templates/default.css');

const between = (text, from, to) => {
  const at = text.indexOf(from);
  assert.ok(at >= 0, `${from} is declared`);
  return text.slice(at, text.indexOf(to, at + from.length));
};
const declares = (body) => new Map([...body.matchAll(/(--sf-[a-z0-9-]+):\s*([^;]+);/gu)].map(([, name, value]) => [name, value.trim()]));

// The roles an on-surface outline / ghost button's hovered or pressed label
// and icon read, from the button's own state rules.
const stateInks = () => {
  const inks = new Set();
  const onSurface = /sf-button--(outline|ghost)[^{]*sf-button--on-surface|sf-button--on-surface[^{]*sf-button--(outline|ghost)/u;
  for (const [, selector, body] of buttons.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    if (!/:hover|:active|\.active\b/u.test(selector) || !onSurface.test(selector)) continue;
    for (const [, prop, value] of body.matchAll(/(--sf-button-text-container--color|--sf-icon--color):\s*var\((--sf-[a-z0-9-]+)\)/gu)) {
      if (prop && value.startsWith('--sf-on-surface')) inks.add(value);
    }
  }
  return inks;
};

test('the hovered and pressed on-surface label and icon read the state inks', () => {
  const inks = stateInks();
  assert.ok(inks.has('--sf-on-surface-hover'), 'hover reads --sf-on-surface-hover');
  assert.ok(inks.has('--sf-on-surface-active'), 'press reads --sf-on-surface-active');
});

test('an on-surface outline/ghost button on a strong place keeps the place\'s ink on hover and press', () => {
  const strong = declares(between(mix, '@mixin sf-place-strong($c)', '@mixin sf-place-strong-accent'));
  assert.equal(strong.get('--sf-on-surface'), 'var(--sf-on-#{$c})');
  for (const ink of stateInks()) {
    assert.equal(strong.get(ink), 'var(--sf-on-#{$c})', `a strong place declares ${ink} as its ink`);
  }
  // Every bg-<c> and every strong alert-bar level is that mixin.
  assert.match(read('utility/background-color/default/scss/_sf_css__background_color.scss'), /@include places\.sf-place-strong\(\$c\);/u);
  assert.match(read('smart/alert-bar/scss/_smart__alert-bar.scss'), /@include places\.sf-place-strong\(\$c\);/u);
});

test('on glass the hovered and pressed ink is the glass\'s ink', () => {
  const body = declares(between(glass, '.sf-surface-media {', '\n  }\n'));
  assert.equal(body.get('--sf-on-surface'), 'var(--sf-on-surface-media)');
  for (const ink of stateInks()) {
    assert.equal(body.get(ink), 'var(--sf-on-surface-media)', `glass declares ${ink} as its ink`);
  }
});

test('an opaque place on a strong place takes the theme\'s state inks back', () => {
  const map = between(mix, '$sf-place-theme-roles: (', ');');
  for (const ink of stateInks()) {
    const themed = (theme.match(new RegExp(`\\s${ink}: ([^;]+);`, 'u')) ?? [])[1];
    assert.ok(themed, `${ink} is a theme role`);
    assert.ok(map.includes(`'${ink.slice(5)}': '${themed}'`), `$sf-place-theme-roles carries ${ink} = ${themed}`);
    assert.ok(popover.includes(`${ink}: ${themed};`), `the popover writes ${ink} out`);
  }
});
