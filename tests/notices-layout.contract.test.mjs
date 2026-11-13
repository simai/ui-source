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

test('sf-alert: one action in the row from 36rem, two from 48rem of the notice\'s whole width', () => {
  assert.match(alerts, /\.sf-alert:has\(\.sf-alert-buttons\) \{\s*container: sf-alert \/ inline-size;/u);
  assert.match(alerts, /@container sf-alert \(min-width: calc\(36rem - 2 \* 1rem - 2px\)\) \{\s*\.sf-alert:not\(:has\(\.sf-alert-buttons > :nth-child\(2\)\)\) \{/u);
  assert.match(alerts, /@container sf-alert \(min-width: calc\(48rem - 2 \* 1rem - 2px\)\) \{\s*\.sf-alert \{/u);
  // In the row: centred on the text block, the plate overhanging the line by
  // the low button's block padding, as the close does (C35).
  assert.match(alerts, /flex-direction: row;\s*align-items: center;\s*column-gap: var\(--sf-space-1\);\s*padding-block-end: 0;/u);
  assert.match(alerts, /margin-block: calc\(-1 \* var\(--sf-ui-1--space-y-tightness-low\)\);/u);
  // No author switch yet (owner undecided on #q-layout-override).
  assert.doesNotMatch(alerts, /actions-layout/u);
});

test('sf-toast: one action in the row from 20rem of the toast\'s whole width', () => {
  assert.match(toast, /\.sf-toast:has\(> \.sf-toast-container > \.sf-toast-bottom\) \{\s*container: sf-toast \/ inline-size;/u);
  assert.match(toast, /@container sf-toast \(min-width: calc\(20rem - 2 \* 1rem - 2px\)\) \{\s*\.sf-toast:not\(:has\(\.sf-toast-bottom > :nth-child\(2\)\)\)/u);
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
