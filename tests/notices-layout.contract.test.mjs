import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The notices family after owner decisions C114 and C115 (2026-11-13), held
// without a browser: where the actions of sf-alert and sf-toast stand (layout
// L3a), the even bottom inset under actions that stand under the text
// (NS-9, NS-10), and the toasts that never leave by themselves (NS-2). The
// geometry is measured on the built sheets by the group build's probe.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const alerts = read('src/component/alerts/scss/_css__alerts.scss');
const toast = read('src/component/toast/scss/_css__toast.scss');
const toastJs = read('src/component/toast/js/_toast.js');
const notify = read('src/core/js/notify.js');
const smartToast = read('src/smart/toast/index.js');
const alertTemplate = read('src/smart/alert/js/templates/default.js');
const toastTemplate = read('src/smart/toast/js/templates/default.js');
const alertSettings = JSON.parse(read('src/smart/alert/component.json')).settings;
const toastSettings = JSON.parse(read('src/smart/toast/component.json')).settings;

test('sf-alert: one action in the row from 36rem, two from 48rem of the notice\'s whole width', () => {
  assert.match(alerts, /\.sf-alert:has\(\.sf-alert-buttons\) \{\s*container: sf-alert \/ inline-size;/u);
  assert.match(alerts, /@container sf-alert \(min-width: calc\(36rem - 2 \* 1rem\)\) \{\s*\.sf-alert:not\(\.sf-alert--actions-under\):not\(:has\(\.sf-alert-buttons > :nth-child\(2\)\)\) \{/u);
  assert.match(alerts, /@container sf-alert \(min-width: calc\(48rem - 2 \* 1rem\)\) \{\s*\.sf-alert:not\(\.sf-alert--actions-under\) \{/u);
  // In the row: centred on the text block, the plate overhanging the line by
  // the low button's block padding, as the close does (C35).
  assert.match(alerts, /flex-direction: row;\s*align-items: center;\s*column-gap: var\(--sf-space-1\);\s*padding-block-end: 0;/u);
  assert.match(alerts, /margin-block: calc\(-1 \* var\(--sf-ui-1--space-y-tightness-low\)\);/u);
});

test('sf-toast: one action in the row from 20rem of the toast\'s whole width', () => {
  assert.match(toast, /\.sf-toast:has\(> \.sf-toast-container > \.sf-toast-bottom\) \{\s*container: sf-toast \/ inline-size;/u);
  assert.match(toast, /@container sf-toast \(min-width: calc\(20rem - 2 \* 1rem\)\) \{\s*\.sf-toast:not\(\.sf-toast--actions-under\):not\(:has\(\.sf-toast-bottom > :nth-child\(2\)\)\)/u);
});

// The 1 px border is inside the inline inset (owner decision C105 H4/H6, as
// the fields' C77 inset): the padding is --sf-space-1 less the border, so the
// icon and the letters stand 16 from the outer edge (compact and phone 12).
test('sf-alert and sf-toast: the border is inside the inline inset', () => {
  for (const side of ['right', 'left']) {
    assert.ok(alerts.includes(`var(--sf-alert--padding-${side}, calc(var(--sf-space-1) - var(--sf-alert-border-width, var(--sf-px))))`), `alert ${side}`);
    assert.ok(toast.includes(`var(--sf-toast--padding-${side}, calc(var(--sf-space-1) - var(--sf-toast-border-width, var(--sf-px))))`), `toast ${side}`);
  }
});

test('under the text, the inset under the last button is the inset above the capitals', () => {
  assert.match(alerts, /\.sf-alert \.sf-alert-wrap:has\(> \.sf-alert-buttons\) \{[^}]*padding-block-end: calc\(var\(--sf-alert--lead\) \+ \(var\(--sf-text-height-1\) - 1cap\) \/ 2\);/u);
  assert.match(toast, /\.sf-toast \.sf-toast-container:has\(> \.sf-toast-bottom\) \{[^}]*padding-block-end: calc\(var\(--sf-toast--lead\) \+ \(var\(--sf-text-height-1\) - 1cap\) \/ 2\);/u);
});

test('an error or a warning toast stays until a person closes it; success may leave', () => {
  assert.match(notify, /const DURATIONS = \{neutral: 5000, info: 5000, success: 5000, warning: 0, error: 0\};/u);
  assert.match(notify, /const duration = STAYS\.has\(status\) \? 0 : given;/u);
  assert.match(toastJs, /const STAYING_TOAST_TYPES = new Set\(\['warning', 'error'\]\);/u);
  assert.match(toastJs, /function readDuration\(root\) \{\s*if \(staysUntilClosed\(root\)\) return 0;/u);
  assert.match(smartToast, /if \(this\.status === 'error' \|\| this\.status === 'warning'\) return 0;/u);
});

test('actions-layout (owner 2026-11-13, #q-layout-override): auto by width, under at every width', () => {
  // A public setting of both notices, two words, auto the default, no alias.
  for (const [tag, settings] of [['sf-alert', alertSettings], ['sf-toast', toastSettings]]) {
    const setting = settings['actions-layout'];
    assert.equal(setting?.type, 'enum', `${tag}: actions-layout is an enum setting`);
    assert.deepEqual(setting.values, ['auto', 'under'], tag);
    assert.equal(setting.default, 'auto', tag);
  }
  // The class form is a modifier on the notice root; the Smart templates add it
  // for under only, so auto and any other word keep layout L3a.
  assert.match(alertTemplate, /context\.actionsLayout === 'under' \? 'sf-alert--actions-under' : ''/u);
  assert.match(toastTemplate, /context\.actionsLayout === 'under' \? 'sf-toast--actions-under' : ''/u);
  assert.match(toastJs, /actionsLayout === 'under' \? 'sf-toast--actions-under' : ''/u);
  // The modifier only takes the notice out of the row queries: under the text
  // it keeps the gap and the even bottom of every other notice, so the sheets
  // hold no rule of their own for it (comments aside).
  const rules = (sheet) => sheet.replace(/\/\*[\s\S]*?\*\//gu, '');
  assert.equal((alerts.match(/:not\(\.sf-alert--actions-under\)/gu) ?? []).length, 2);
  assert.equal((toast.match(/:not\(\.sf-toast--actions-under\)/gu) ?? []).length, 3);
  assert.doesNotMatch(rules(alerts), /\.sf-alert--actions-under[^)]/u);
  assert.doesNotMatch(rules(toast), /\.sf-toast--actions-under[^)]/u);
});
