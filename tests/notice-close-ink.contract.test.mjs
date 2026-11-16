// The notices' close cross is translucent on-surface ink (owner decision
// C112, R198): one step of the alpha scale's ink family (48/64/80), 64, on
// sf-alert, sf-toast and sf-alert-bar; under a pointer it catches the text ink
// (C107 (4)). And an sf-alert printed with the page is not announced as an
// interruption (NS-1, notices study 2026-11-12).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const INK = '--sf-close-icon--background-color: light-dark(var(--sf-black--alfa-64), var(--sf-white--alfa-64));';

test('sf-alert and sf-toast: the cross is on-surface ink at 64, one rule for every status and look', () => {
  const alert = read('src/component/alerts/scss/_css__alerts.scss');
  const toast = read('src/component/toast/scss/_css__toast.scss');
  assert.equal(alert.split(INK).length - 1, 1, 'sf-alert declares the ink once');
  assert.equal(toast.split(INK).length - 1, 1, 'sf-toast declares the ink once');
  // AA-12's reach through any close host stays.
  assert.ok(alert.includes(':is(.sf-icon-button, :is(sf-button-icon, sf-icon-button), :is(sf-button-close, sf-close)) .sf-close > .sf-close-icon {\n  ' + INK));
  // No per-status or per-tone cross colour is left.
  for (const sheet of [alert, toast]) {
    assert.ok(!/--sf-close-icon--background-color: var\(--sf-on-surface-variant\)/.test(sheet));
    assert.ok(!/sf-close-icon--background-color: var\(--sf-on-[a-z]+-container/.test(sheet));
  }
  // Hover and press catch the text ink.
  assert.match(alert, /:is\(:hover, :active\) \.sf-close > \.sf-close-icon \{\n  --sf-close-icon--background-color: var\(--sf-alert--color\);/);
  assert.match(toast, /:is\(:hover, :active\) > \.sf-close > \.sf-close-icon \{\n    --sf-close-icon--background-color: var\(--sf-toast--content-color, var\(--sf-on-surface\)\);/);
});

test('sf-alert-bar: the cross is the strong place\'s own ink at 64; hover catches the text ink', () => {
  const bar = read('src/smart/alert-bar/scss/_smart__alert-bar.scss');
  assert.ok(bar.includes('.sf-alert-bar#{$level} .sf-alert-bar-row > .sf-alert-bar-close > .sf-icon-button .sf-icon {\n    --sf-icon--color: #{places.sf-ink($c, 64)};'));
  assert.ok(bar.includes('.sf-alert-bar-row > .sf-alert-bar-close > .sf-icon-button:not(:disabled):is(:hover, :active) .sf-icon {\n  --sf-icon--color: var(--sf-alert-bar--ink);'));
});

test('sf-alert: printed with the page it is a status; the host role wins; later ones keep their level', () => {
  const source = read('src/smart/alert/index.js');
  assert.match(source, /document\.querySelectorAll\('sf-alert'\)\.forEach\(\(element\) => inPageAtLoad\.add\(element\)\)/);
  // Settled at the load event and, under the Loader, at sf-loader-ready.
  assert.match(source, /window\.addEventListener\('load', settle, \{once: true\}\)/);
  assert.match(source, /window\.addEventListener\('sf-loader-ready', \(\) => setTimeout\(settle, 0\), \{once: true\}\)/);
  assert.match(source, /!window\.SF\.Loader\.eventSend/);
  assert.match(source, /this\._printedWithPage = !pageLoaded \|\| inPageAtLoad\.has\(this\)\n\s+\|\| Boolean\(this\.querySelector\?\.\(':scope > \[data-sf-static\]'\)\)/);
  const liveRole = source.slice(source.indexOf('get liveRole()'), source.indexOf('templateContext()'));
  const own = liveRole.indexOf("own === 'status' || own === 'alert'");
  const printed = liveRole.indexOf("if (this._printedWithPage) return 'status';");
  const level = liveRole.indexOf("ASSERTIVE.has(this.status) ? 'alert' : 'status'");
  assert.ok(own > 0 && printed > own && level > printed, 'host role, then printed with the page, then the level');
  // The first paint is the alert at load: a status even for an error.
  assert.match(read('src/smart/alert/static/default/error.html'), /sf-alert--error sf-alert--default flex items-start" role="status"/);
});
