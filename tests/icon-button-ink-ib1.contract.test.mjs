import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
const custom = read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss');

/* RG-IB-1 (component.icon-buttons 1.14.0): the glyph is the ink of sf-button's
   label in the same look and scheme. Ghost primary and danger took the pressed
   step (-active): 0,68,145 and 147,0,10 beside 0,91,190 and 187,25,25. */
test('RG-IB-1: the ghost glyph and cross are the scheme hue, not its pressed step', () => {
  assert.match(sheet, /:is\(\.sf-icon-button--link, \.sf-icon-button--ghost\)\.sf-icon-button--primary\.sf-icon-button--icon \{\s*--sf-icon--color: var\(--sf-icon-button-color, var\(--sf-primary\)\);/u);
  // Since component.icon-buttons 1.15.0 (RG-CL-3) the close's ghost rules name every look.
  assert.match(sheet, /:is\(:is\(\.sf-icon-button--link, \.sf-icon-button--ghost\), \.sf-icon-button--default, \.sf-icon-button--tonal, \.sf-icon-button--surface, \.sf-icon-button--outline\)\.sf-icon-button--primary\.sf-icon-button--close > \.sf-close > \.sf-close-icon \{\s*--sf-close-icon--background-color: var\(--sf-icon-button-color, var\(--sf-primary\)\);/u);
  assert.doesNotMatch(sheet, /var\(--sf-place--ink, var\(--sf-error-active\)\)/u);
  assert.match(read('src/smart/button-icon/js/templates/default.css'), /:is\(:is\(\.sf-icon-button--link, \.sf-icon-button--ghost\), \.sf-icon-button--default, \.sf-icon-button--tonal, \.sf-icon-button--surface, \.sf-icon-button--outline\)\.sf-icon-button--primary\.sf-icon-button--close > :is\(sf-button-close, sf-close\) > \.sf-close > \.sf-close-icon \{\n--sf-close-icon--background-color: var\(--sf-primary\);/u);
});

/* RG-IB-1, RG-IB-3: under a pointer the glyph follows the label -- neutral
   tonal (the quiet one too), outline and ghost the on-surface hover and press
   steps; outline and ghost primary and danger -hover and -active. */
test('RG-IB-1, RG-IB-3: hover and press inks follow sf-button', () => {
  // fix/smart-pass-sp1's on-surface-variant joins the quiet list (group build 10).
  assert.match(custom, /:is\(\.sf-icon-button--on-surface, \.sf-icon-button--on-surface-variant, \.sf-icon-button--secondary\):is\(\.sf-icon-button--tonal, \.sf-icon-button--surface, \.sf-icon-button--link, \.sf-icon-button--ghost, \.sf-icon-button--outline\)\.sf-icon-button--icon:not\(:disabled, \[aria-disabled="true"\]\):not\(\.disabled\):hover \{\s*--sf-icon--color: var\(--sf-icon-button-color, light-dark\(var\(--sf-on-surface-hover\), var\(--sf-on-surface\)\)\);/u);
  assert.match(custom, /:is\(:active, \.active\) \{\s*--sf-icon--color: var\(--sf-icon-button-color, light-dark\(var\(--sf-on-surface-active\), var\(--sf-on-surface\)\)\);/u);
  for (const [scheme, ink] of [['\\.sf-icon-button--primary', 'var\\(--sf-primary-hover\\)'], [':is\\(\\.sf-icon-button--danger, \\.sf-icon-button--error\\)', 'var\\(--sf-place--ink, var\\(--sf-error-hover\\)\\)']]) {
    assert.match(custom, new RegExp(`:is\\(\\.sf-icon-button--outline, \\.sf-icon-button--link, \\.sf-icon-button--ghost\\)${scheme}\\.sf-icon-button--icon:not\\(:disabled, \\[aria-disabled="true"\\]\\):not\\(\\.disabled\\):hover \\{\\s*--sf-icon--color: var\\(--sf-icon-button-color, ${ink}\\);`, 'u'), scheme);
  }
});

/* RG-IB-2: surface and link are former looks, drawn as tonal and ghost; the
   Framework writes ghost; the runtime says the former class once per button. */
test('RG-IB-2: the Framework writes sf-icon-button--ghost; link and surface are noted aliases', () => {
  const checks = read('src/component/buttons/js/button-checks.js');
  assert.match(checks, /'sf-icon-button--surface': 'sf-icon-button--tonal',\s*'sf-icon-button--link': 'sf-icon-button--ghost',/u);
  assert.match(checks, /sayOnce\(element, from, /u);
  assert.match(read('src/smart/button-icon/js/templates/default.js'), /ghost: 'ghost', link: 'ghost', surface: 'tonal'/u);
  assert.match(read('src/component/icon-buttons/js/_icon-buttons.js'), /formerClass \|\| `sf-icon-button--\$\{type\}`/u);
  const writers = ['src/smart/dropdown/js/templates/default.js', 'src/smart/pagination/js/templates/default.js', 'src/smart/toast/js/templates/default.js',
    'src/smart/file-preview/js/templates/default.js', 'src/smart/input-date/js/templates/default.js', 'src/smart/list/js/templates/default.js',
    'src/smart/file-upload/js/templates/default.js', 'src/smart/modal/js/templates/default.js', 'src/smart/pager/js/templates/default.js',
    'src/component/dropdown/js/_dropdown.js', 'src/component/highlight/js/index.js', 'src/component/toast/js/_toast.js',
    'src/component/file-upload/js/_file_upload.js', 'src/component/modal/js/_modal.js'];
  for (const file of writers) assert.doesNotMatch(read(file), /sf-icon-button--link(?![-\w])/u, file);
  const journal = JSON.parse(read('contracts/changes/journal.json')).records;
  assert.ok(journal.some((record) => record.id === 'class-icon-button-link-to-ghost' && record.remove_after === '2027-01-01'));
  assert.ok(journal.some((record) => record.id === 'class-icon-button-density-c213' && record.remove_after === '2027-01-01'));
  // Pinned at or above the 1.14.0 / 1.13.0 that carried RG-IB-2 (1.15.0 / 1.13.1: RG-CL-3).
  assert.ok(['1.14.0', '1.15.0', '1.16.0', '1.17.1', '1.18.0'].includes(JSON.parse(read('src/component/icon-buttons/passport.json')).version));
  assert.ok(['1.13.0', '1.13.1', '1.13.3', '1.13.6', '1.13.8', '1.13.10'].includes(JSON.parse(read('src/smart/button-icon/component.json')).version)); // group build 10: the merged number
});

/* RG-IB-1 b (DEV msg-98dc9215, 2026-11-16): the quiet tonal glyph read the
   container's text role, neutral-85 (212) in the dark theme -- brighter than
   the plain neutral glyph, --sf-on-surface-icon (neutral-80, 198). The control
   carries no text: its glyph keeps the page's --sf-on-surface-variant, as
   outline and ghost do, and still reads 3:1 (C107 (2)) on the container fill
   over the surfaces 0 to 3. */
test('RG-IB-1 b: the quiet tonal glyph keeps the page role, quieter than the neutral glyph and above 3:1', () => {
  assert.doesNotMatch(sheet, /--sf-on-surface-variant: var\(--sf-on-surface-container-variant\)/u);
  const hex = Object.fromEntries([...read('src/core/scss/_sf_figma_colors_variables.scss').matchAll(/(--sf-neutral-\d+|--sf-white):\s*(#[0-9a-fA-F]{6});/gu)].map(([, n, h]) => [n, h]));
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const role = (name) => {
    const m = theme.match(new RegExp(`${name}: light-dark\\(var\\((--sf-[a-z0-9-]+)\\), var\\((--sf-[a-z0-9-]+)\\)\\);`, 'u'));
    assert.ok(m, name);
    return {light: m[1], dark: m[2]};
  };
  const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (h) => { const [r, g, b] = ch(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (top, alpha, bottom) => `#${ch(top).map((v, i) => Math.round(v * alpha + ch(bottom)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
  const quiet = role('--sf-on-surface-variant');
  const neutral = role('--sf-on-surface-icon');
  const fill = role('--sf-surface-container');
  for (const mode of ['light', 'dark']) {
    // quieter: nearer the surface than the neutral glyph
    const towardSurface = mode === 'dark' ? lum(hex[quiet.dark]) < lum(hex[neutral.dark]) : lum(hex[quiet.light]) > lum(hex[neutral.light]);
    assert.ok(towardSurface, `${mode}: the quiet glyph is quieter than the neutral one`);
    const [, tone, alpha] = fill[mode].match(/^--sf-(neutral-\d+)--alfa-(\d+)$/u);
    for (const step of ['2', '3']) {
      const surface = role(`--sf-surface-${step}`)[mode];
      const measured = contrast(hex[quiet[mode]], over(hex[`--sf-${tone}`], Number(alpha) / 100, hex[surface]));
      assert.ok(measured >= 3, `${mode} on surface ${step}: ${measured.toFixed(2)}:1`);
    }
  }
});
