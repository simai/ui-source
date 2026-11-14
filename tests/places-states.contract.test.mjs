import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Places states (PS, 2026-11-14). A strong coloured place (bg-<colour>, the
// alert bar's levels, the duo gradient plate) and glass re-declare what their
// content reads beyond the neutral roles:
//   PS-B  the ink of every status and colour container (a tonal secondary or
//         error badge, tag or button wrote tone 10 on blue, 2.43-2.73:1, and
//         on glass in the light theme 1.12-1.14) and its graphic. The fill
//         keeps its hue; the ink is the place's.
//   PS-A  the link and the focus ring on a strong place (blue on blue,
//         1.00-1.20:1 and 1.31-1.45:1), as glass does (C70).
// An opaque place on them, and a popover in them, take back what the page had.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const mix = read('src/core/scss/mix/_mix__places.scss');
const theme = read('src/core/scss/_sf_css__theme.scss');
const gradient = read('src/utility/gradient/default/scss/_sf_css__gradient_kind.scss');
const popover = read('src/smart/popover/js/templates/default.css');
const block = (source, head) => {
  const start = source.indexOf(head);
  assert.ok(start >= 0, `${head} is declared`);
  return source.slice(start, source.indexOf('\n}', start));
};

const STATUS = ['secondary', 'tertiary', 'info', 'success', 'warning', 'error', 'neutral'];
const INK_ROLES = ['on-primary-container-graphic', ...STATUS.flatMap((s) => [`on-${s}-container`, `on-${s}-container-graphic`])];
const LINK_RING = ['link', 'link-hover', 'link-active', 'link-visited', 'focus'];

test('PS-B: the container ink roles repeat the theme, every status and the accent graphic', () => {
  const map = mix.slice(mix.indexOf('$sf-place-container-ink-roles: ('), mix.indexOf(');', mix.indexOf('$sf-place-container-ink-roles: (')));
  const entries = Object.fromEntries([...map.matchAll(/'([a-z0-9-]+)': '([^']+)'/gu)].map(([, r, v]) => [r, v]));
  assert.deepEqual(Object.keys(entries).sort(), [...INK_ROLES].sort());
  for (const [role, value] of Object.entries(entries)) {
    assert.equal((theme.match(new RegExp(`\\s--sf-${role}: ([^;]+);`, 'u')) ?? [])[1], value, role);
  }
  // Only the ink: no container fill is re-declared, so the fill keeps its hue.
  assert.doesNotMatch(block(mix, '@mixin sf-place-container-ink('), /--sf-[a-z]+-container(-hover|-active)?:/u);
});

test('PS-A, PS-B: a strong place writes the ink, link and ring on its children from its own tones', () => {
  const accent = block(mix, '@mixin sf-place-strong-accent(');
  assert.ok(accent.includes('@include sf-place-container-ink(light-dark(var(--sf-white), var(--sf-#{$c}-20)));'));
  assert.ok(accent.includes('@include sf-place-link-ring(light-dark(var(--sf-white), var(--sf-#{$c}-20)),'));
  assert.ok(accent.includes('light-dark(var(--sf-#{$c}-95), var(--sf-#{$c}-25)), light-dark(var(--sf-#{$c}-90), var(--sf-#{$c}-30)),'));
  assert.ok(accent.includes('#{sf-ink($c, 80)});'), 'a visited link is the place\'s dim ink, alpha 80');
  const ring = block(mix, '@mixin sf-place-link-ring(');
  for (const role of LINK_RING) assert.match(ring, new RegExp(`--sf-${role}: #\\{\\$`, 'u'), role);
  assert.ok(ring.includes('--sf-focus--color: var(--sf-focus);'), 'the ring colour follows --sf-focus');
  // The place keeps what it found, for an opaque place on it.
  const strong = mix.slice(mix.indexOf('@mixin sf-place-strong('), mix.indexOf('@mixin sf-place-strong-accent'));
  assert.ok(strong.includes('@each $role, $value in map.merge($sf-place-container-ink-roles, $sf-place-glass-link-roles) {\n    --sf-place--outer-#{$role}: var(--sf-#{$role});'));
  assert.ok(strong.includes('--sf-place--outer-focus--color: var(--sf-focus--color);'));
});

test('PS-B: glass writes the container ink white on its children and keeps what it found', () => {
  assert.ok(block(mix, '@mixin sf-place-glass-accent {').includes('@include sf-place-container-ink(var(--sf-white));'));
  assert.ok(block(mix, '@mixin sf-place-glass-outer {').includes('map.merge($sf-place-glass-accent-roles, $sf-place-container-ink-roles)'));
});

test('PS-A, PS-B: the duo gradient plate is white ink for the containers, the link and the ring', () => {
  const duo = block(gradient, '.gradient-duo');
  assert.ok(duo.includes('@include places.sf-place-container-ink(var(--sf-white));'));
  assert.ok(duo.includes('@include places.sf-place-link-ring(var(--sf-white), var(--sf-primary-hover), var(--sf-primary-active), var(--sf-white--alfa-80));'));
});

test('an opaque place and a popover on a strong place or glass take the ink, link and ring back', () => {
  const back = block(mix, '@mixin sf-place-back-on-colour {');
  assert.ok(back.includes('@each $role, $value in map.merge($sf-place-container-ink-roles, $sf-place-glass-link-roles) {'));
  const onGlass = back.slice(back.indexOf(':where(.sf-surface-media) & {'));
  assert.ok(onGlass.includes('@each $role, $value in $sf-place-container-ink-roles {'), 'on glass too');
  const strongPop = block(popover, ":where(.bg-primary, .bg-secondary, .bg-tertiary, .bg-info, .bg-success, .bg-warning, .bg-error, :is(.sf-alert-bar--error, .sf-alert-bar--danger, .sf-alert-bar--warning, .sf-alert-bar--info) :is(.sf-alert-bar-row, .sf-alert-bar-strip), .bg-surface-inverse, .bg-surface-inverse-fixed) sf-popover > [slot='content'] {\n    --sf-primary:");
  const glassPop = block(popover, ":where(.sf-surface-media) sf-popover > [slot='content'] {");
  for (const role of INK_ROLES) {
    const value = theme.match(new RegExp(`\\s--sf-${role}: ([^;]+);`, 'u'))[1];
    const line = `--sf-${role}: var(--sf-place--outer-${role}, ${value});`;
    assert.ok(strongPop.includes(line), `popover on a strong place: ${role}`);
    assert.ok(glassPop.includes(line), `popover on glass: ${role}`);
  }
  for (const role of LINK_RING) assert.ok(strongPop.includes(`--sf-${role}: var(--sf-place--outer-${role}, `), `popover on a strong place: ${role}`);
  assert.ok(strongPop.includes('--sf-focus--color: var(--sf-place--outer-focus--color, var(--sf-focus));'));
});
