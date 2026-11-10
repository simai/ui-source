#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The action set-error {message} on the form fields that declare it
// (standard simai.smart-component §17.2): sf-input, sf-input-textarea,
// sf-input-quantity and sf-input-image. On the built bytes, for each field in
// a form: setError({message}) answers the outcome applied (§4.4: the generated
// method returns the outcome, not the element), writes error-message and
// invalid, sets custom-error so the form does not submit, and an empty message
// clears all three. Then SF.whenDefined loads nothing (a tag the page does not
// have stays pending and no script is asked for), while SF.Loader.ensure loads
// it. Docs pre-review of guide/smart-components, 2026-11-10: GS-F1, GS-F6, GS-F7.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const FIELDS = ['sf-input', 'sf-input-textarea', 'sf-input-quantity', 'sf-input-image'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const consoleLines = [];
  page.on('pageerror', (error) => note({said: `page error: ${error.message}`}));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleLines.push(`${message.type()}: ${message.text()}`);
  });
  const asked = [];
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body></body></html>'});
    asked.push(url.pathname);
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'set-error', pluginListVersion: 'set-error', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
    <link rel="stylesheet" href="/distr/core/css/core.css">
    </head><body><form id="form">
      <sf-input name="a" label="A"></sf-input>
      <sf-input-textarea name="b" label="B"></sf-input-textarea>
      <sf-input-quantity name="c" label="C"></sf-input-quantity>
      <sf-input-image name="d" label="D"></sf-input-image>
    </form><script src="/distr/core/js/core.js"></script></body></html>`);
  await page.waitForFunction((tags) => tags.every((tag) => customElements.get(tag)), FIELDS, {timeout: 15000});
  const fields = await page.evaluate(async (tags) => {
    const form = document.getElementById('form');
    const rows = [];
    for (const tag of tags) {
      const element = document.querySelector(tag);
      await element.whenRendered?.();
      const set = await element.setError({message: 'Taken'});
      const afterSet = {
        outcome: set?.outcome,
        isElement: set === element,
        message: element.getAttribute('error-message'),
        invalid: element.hasAttribute('invalid'),
        customError: element.validity?.customError === true,
        formValid: form.checkValidity(),
        shown: (element.textContent || '').includes('Taken'),
      };
      const cleared = await element.setError({message: ''});
      const afterClear = {
        outcome: cleared?.outcome,
        message: element.getAttribute('error-message'),
        invalid: element.hasAttribute('invalid'),
        customError: element.validity?.customError === true,
      };
      const positional = await element.setError('Again');
      const afterPositional = element.getAttribute('error-message');
      element.setError({message: ''});
      rows.push({tag, afterSet, afterClear, positional: positional?.outcome, afterPositional});
    }
    return rows;
  }, FIELDS);
  for (const row of fields) {
    const {tag, afterSet, afterClear} = row;
    if (afterSet.outcome !== 'applied' || afterSet.isElement) note({case: 'setError answers the outcome applied', tag, got: afterSet});
    if (afterSet.message !== 'Taken' || !afterSet.invalid) note({case: 'setError writes error-message and invalid', tag, got: afterSet});
    if (!afterSet.customError || afterSet.formValid) note({case: 'setError sets custom-error, so the form does not submit', tag, got: afterSet});
    if (!afterSet.shown) note({case: 'the message is drawn', tag, got: afterSet});
    if (afterClear.outcome !== 'applied' || afterClear.message !== null || afterClear.invalid || afterClear.customError) note({case: 'an empty message clears all three', tag, got: afterClear});
    if (row.positional !== 'applied' || row.afterPositional !== 'Again') note({case: 'setError(message) positionally (§4.4 MAY)', tag, got: row});
  }
  const formValidAtEnd = await page.evaluate(() => document.getElementById('form').checkValidity());
  if (!formValidAtEnd) note({case: 'the form is valid again once every error is cleared'});

  // GS-F1: SF.whenDefined waits and loads nothing; SF.Loader.ensure loads.
  const before = asked.length;
  const waited = await page.evaluate(async () => {
    let settled = false;
    window.SF.whenDefined('slider-range').then(() => { settled = true; });
    await new Promise((done) => setTimeout(done, 1500));
    return {settled, defined: Boolean(customElements.get('sf-slider-range'))};
  });
  const askedForSlider = asked.slice(before).filter((path) => /slider-range/u.test(path));
  if (waited.settled || waited.defined || askedForSlider.length) note({case: 'SF.whenDefined loads nothing', got: {...waited, askedForSlider}});
  const ensured = await page.evaluate(() => window.SF.Loader.ensure('slider-range', {timeout: 10000}));
  if (!ensured.ready.includes('sf-slider-range')) note({case: 'SF.Loader.ensure loads the tag', got: ensured});
  await page.waitForTimeout(300);
  if (consoleLines.length) note({case: 'console clean', got: consoleLines});
  console.log(JSON.stringify({fields: fields.map((row) => ({tag: row.tag, outcome: row.afterSet.outcome, customError: row.afterSet.customError, formValid: row.afterSet.formValid})), whenDefined: waited, ensure: ensured}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_SET_ERROR_OK');
