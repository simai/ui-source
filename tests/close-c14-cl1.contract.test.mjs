import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const looks = read('src/component/close/scss/_css__close_looks.scss');
const sheet = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
const custom = read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss');

/* Rule items of a sheet: the selector list before each '{', split at its
   top-level commas. */
function items(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  for (const match of text.matchAll(/([^{};]+)\{/gu)) {
    const prelude = match[1].trim();
    if (prelude.startsWith('@')) continue;
    let depth = 0;
    let current = '';
    for (const ch of prelude) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        out.push(current.trim());
        current = '';
      } else current += ch;
    }
    out.push(current.trim());
  }
  return out;
}

/* RG-CL-1, RG-CL-2 (component.close 1.3.0; DEV study actions-close-study.html
   K1, K2): disabled fades the cross in every look. A coloured place kept its
   full ink (it looked live); media took the theme's grey (118,119,124 / 80 %
   light, 227,226,231 / 48 % dark) on the same black circle. */
test('RG-CL-1, RG-CL-2: the disabled cross fades on a coloured place and over a photo', () => {
  assert.match(looks, /\.sf-icon-button\.sf-button-close\.sf-button-close:disabled \{\s*--sf-button-close--ink: var\(--sf-on-surface-disabled\);/u);
  assert.match(looks, /\.sf-button-close--backdrop-color:not\(\.sf-button-close--media\):disabled \{\s*--sf-button-close--ink: color-mix\(in srgb, currentColor 48%, transparent\);/u);
  assert.match(looks, /\.sf-button-close\.sf-button-close\.sf-button-close--media:disabled \{\s*--sf-button-close--ink: color-mix\(in srgb, var\(--sf-white\) 48%, transparent\);/u);
  assert.doesNotMatch(looks, /:is\(\.sf-button-close--on-surface, \.sf-button-close--on-surface-variant\):disabled/u);
});

/* RG-CL-3 (component.icon-buttons 1.15.0; owner decision C14): no square and
   no solid plate under a cross. No rule item names a close together with a
   filled, tonal or outlined look unless it is a ghost rule that names them
   all; the outline's border skips the close. */
test('RG-CL-3: a close in any icon-button look is drawn as ghost', () => {
  const all = ':is(:is(.sf-icon-button--link, .sf-icon-button--ghost), .sf-icon-button--default, .sf-icon-button--tonal, .sf-icon-button--surface, .sf-icon-button--outline)';
  for (const css of [sheet, custom, read('src/smart/button-icon/js/templates/default.css')]) {
    for (const item of items(css)) {
      // Skipped: items that keep the close out, or name it as one alternative
      // beside the looks (the quiet cross's hover).
      if (!item.includes('sf-icon-button--close') || item.includes(':not(.sf-icon-button--close)') || item.includes(', .sf-icon-button--close)')) continue;
      const bare = item.split(all).join('');
      assert.doesNotMatch(bare, /sf-icon-button--(default|tonal|surface|outline)\b/u, item);
    }
  }
  assert.match(sheet, /\.sf-icon-button--outline:where\(:not\(\.sf-icon-button--close\)\) \{/u);
  assert.match(sheet, /\.sf-icon-button\.sf-icon-button--default\.sf-icon-button--primary:where\(:not\(\.sf-icon-button--close\)\) \{\s*--sf-icon-button--focus-ink/u);
  const checks = read('src/component/buttons/js/button-checks.js');
  assert.match(checks, /ICON_BUTTON_CLOSE_LOOKS = Object\.freeze\(\[\s*'sf-icon-button--default', 'sf-icon-button--tonal', 'sf-icon-button--outline', 'sf-icon-button--surface',\s*\]\)/u);
  assert.match(checks, /sayOnce\(element, 'close-look', /u);
  const journal = JSON.parse(read('contracts/changes/journal.json')).records;
  const record = journal.find((r) => r.id === 'class-icon-button-close-looks-c14');
  assert.ok(record && record.remove_after === '2027-01-01');
  const re = new RegExp(record.items[0].match, 'u');
  assert.ok(re.test('<button class="sf-icon-button sf-icon-button--close sf-icon-button--tonal">'));
  assert.ok(!re.test('<button class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal">'));
});

/* RG-CL-3: the Framework's own closes are sf-button-close (C14: one
   component): the class modal header, the class and Smart toast, the Smart
   alert; the class tag reads the plain close beside its former ghost one. */
test('RG-CL-3: the modal, toast, alert and tag closes are sf-button-close', () => {
  assert.match(read('src/component/modal/js/_modal.js'), /'sf-icon-button sf-modal-header-action sf-modal-close-button sf-icon-button--close sf-button-close sf-button-close--ghost sf-button-close--on-surface sf-icon-button--size-1\/3 m-0'/u);
  const toast = read('src/component/toast/js/_toast.js');
  assert.match(toast, /'sf-button-close',\s*'sf-button-close--ghost',\s*'sf-button-close--on-surface',/u);
  assert.doesNotMatch(toast, /'sf-icon-button--ghost'/u);
  assert.match(read('src/smart/toast/js/templates/default.js'), /TOAST_CLOSE_CLASSES = '[^']*sf-button-close sf-button-close--ghost sf-button-close--on-surface/u);
  const alert = read('src/smart/alert/js/templates/default.js');
  assert.match(alert, /<sf-button-close\s+size="1"\s+height="low"\s+scheme="on-surface"/u);
  assert.doesNotMatch(alert, /kind="close"/u);
  assert.ok(JSON.parse(read('src/smart/alert/component.json')).relations.some((r) => r.name === 'cl-button-close'));
  assert.match(read('src/component/toast/scss/_css__toast.scss'), /@layer sf\.overrides \{[\s\S]*\.sf-toast > \.sf-icon-button\.sf-button-close \{\s*--sf-button-close--ink: light-dark\(var\(--sf-black--alfa-64\), var\(--sf-white--alfa-64\)\);/u);
  assert.match(read('src/component/alerts/scss/_css__alerts.scss'), /:is\(:is\(sf-button-icon, sf-icon-button\), :is\(sf-button-close, sf-close\)\) > \.sf-icon-button:not\(:disabled\):is\(:hover, :active\)/u);
  assert.match(read('src/component/tags/scss/_css__tags.scss'), /\.sf-tag > \.sf-icon-button\.sf-button-close\.sf-button-close--plain \{\s*--sf-button-close--base: var\(--sf-tag-color, var\(--sf-on-surface\)\);/u);
});

/* RG-CL-4 (C14, C36): the lowest control is 24. On a phone the low step of
   size 1/3 is 2 (--sf-a2): 16 + 2 x 2 = 20; there a low 1/3 takes the
   default step. */
test('RG-CL-4: a low 1/3 icon button stands at 24 on a phone', () => {
  assert.match(read('src/core/figma_variables/figma_ui_tightness_low.scss'), /:root \{\s*--sf-ui-1\\\/3--space-y-tightness-low: var\(--sf-a2\);/u);
  assert.match(sheet, /@media not all and \(min-width: 60rem\) \{\s*\.sf-icon-button--size-1\\\/3\.sf-icon-button--height-low \{\s*--sf-icon-button--padding-top: var\(--sf-icon-button-padding-block, var\(--sf-ui-1\\\/3--space-y-tightness-default\)\);/u);
});
