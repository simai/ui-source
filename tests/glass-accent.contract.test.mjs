import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The accent on glass (C70, owner 2026-11-11, prototypes/glass-accent.html
// variant B): on .sf-surface-media the accent is the glass's own white ink, as
// on a strong place (C42.4), and the link and the focus ring with it. An opaque
// place on glass takes back what the page had there.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const places = read('src/core/scss/_sf_css__surface_places.scss');
const mix = read('src/core/scss/mix/_mix__places.scss');
const theme = read('src/core/scss/_sf_css__theme.scss');
const popover = read('src/smart/popover/js/templates/default.css');
const block = (source, head) => {
  const start = source.indexOf(head);
  assert.ok(start >= 0, `${head} is declared`);
  return source.slice(start, source.indexOf('\n}', start));
};

const ACCENT = {
  primary: 'var(--sf-white)',
  'primary-hover': 'var(--sf-neutral-95)',
  'primary-active': 'var(--sf-neutral-90)',
  'on-primary': 'var(--sf-black)',
  'primary-container': 'var(--sf-white--alfa-12)',
  'primary-container-hover': 'var(--sf-white--alfa-8)',
  'primary-container-active': 'var(--sf-white--alfa-4)',
  'on-primary-container': 'var(--sf-white)',
  link: 'var(--sf-white)',
  'link-hover': 'var(--sf-neutral-95)',
  'link-active': 'var(--sf-neutral-90)',
  'link-visited': 'var(--sf-white--alfa-80)',
  focus: 'var(--sf-white)',
};

test('glass takes its white ink as the accent, on its children, from the palette only', () => {
  const accent = block(mix, '@mixin sf-place-glass-accent {');
  for (const [role, value] of Object.entries(ACCENT)) {
    assert.ok(accent.includes(`--sf-${role}: ${value};`), `--sf-${role} on glass is ${value}`);
  }
  assert.doesNotMatch(accent, /#[0-9a-f]{3,8}\b|rgb|hsl/iu, 'no literal colour');
  // The ring reads --sf-focus--color and --sf-ui-focus-inset, resolved at the
  // root (_sf_css__border.scss): both are re-declared on glass's children.
  const border = read('src/core/scss/_sf_css__border.scss');
  const inset = border.match(/--sf-ui-focus-inset: ([^;]+);/u)[1];
  assert.match(border, /--sf-focus--color: var\(--sf-focus\);/u);
  assert.ok(accent.includes('--sf-focus--color: var(--sf-focus);'), 'the ring colour follows --sf-focus on glass');
  assert.ok(mix.includes(`$sf-place-focus-inset: '${inset}';`), 'the inset ring as the root writes it');
  assert.match(places, /\.sf-surface-media > \* \{\s*@include places\.sf-place-glass-accent;/u, 'on the children of glass');
  // The glass itself keeps what it found, and never re-declares an accent role.
  const glass = block(places, '  .sf-surface-media {');
  assert.match(glass, /@include places\.sf-place-glass-outer;/u);
  for (const role of Object.keys(ACCENT)) {
    assert.doesNotMatch(glass, new RegExp(`\\n\\s*--sf-${role}:`, 'u'), `glass does not re-declare --sf-${role}`);
  }
  assert.match(block(mix, '@mixin sf-place-glass-outer {'), /--sf-place--outer-#\{\$role\}: var\(--sf-#\{\$role\}\);/u);
});

test('an opaque place on glass, and a popover in it, take the page accent, link and ring back', () => {
  const back = block(mix, '@mixin sf-place-back-on-colour {');
  assert.match(back, /:where\(\.sf-surface-media\) & \{\s*@each \$role, \$value in \$sf-place-glass-accent-roles/u);
  // The fallbacks are the theme's own values.
  for (const role of ['link', 'link-hover', 'link-active', 'link-visited', 'focus']) {
    const value = theme.match(new RegExp(`\\n\\s*--sf-${role}: ([^;]+);`, 'u'))?.[1];
    assert.ok(value, `theme declares --sf-${role}`);
    assert.ok(mix.includes(`'${role}': '${value}',`), `take-back fallback of --sf-${role} is the theme's ${value}`);
    assert.ok(popover.includes(`--sf-${role}: var(--sf-place--outer-${role}, ${value});`), `popover takes --sf-${role} back`);
  }
  assert.match(back, /--sf-focus--color: var\(--sf-place--outer-focus--color, var\(--sf-focus\)\);/u);
  assert.match(back, /--sf-ui-focus-inset: var\(--sf-place--outer-ui-focus-inset, /u);
  assert.ok(popover.includes('--sf-focus--color: var(--sf-place--outer-focus--color, var(--sf-focus));'), 'popover takes the ring colour back');
  const pop = block(popover, ":where(.sf-surface-media) sf-popover > [slot='content'] {");
  for (const role of Object.keys(ACCENT)) {
    assert.ok(pop.includes(`--sf-${role}: var(--sf-place--outer-${role}, `), `popover on glass takes --sf-${role} back`);
  }
});
