#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Every scheme of a button keeps the geometry and type of its appearance and
// size, on the built bytes: an error button is as tall as the primary one
// beside it and sets its label the same way. The destructive scheme listed
// its sizes for default, outline and link and forgot tonal, so a tonal error
// button fell back to the browser's 13.3px Arial and stood 23/27/31/35px tall
// instead of 24/32/40/48 (documentation trial 6, 2026-10-18).
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const APPEARANCES = ['default', 'tonal', 'outline', 'link'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const buttons = [];
  for (const appearance of APPEARANCES) for (const size of SIZES) for (const scheme of ['primary', 'error']) {
    buttons.push(`<button type="button" data-key="${appearance}|${size}|${scheme}" class="sf-button sf-button--${appearance} sf-button--${scheme} sf-button--size-${size}"><span class="sf-button-text-container">Удалить</span></button>`);
  }
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${buttons.join('')}</div></body></html>`);
  await page.addStyleTag({content: readFileSync(join(out, 'core/core/css/core.css'), 'utf8')});
  await page.addStyleTag({content: readFileSync(join(out, 'component/component/buttons/css/buttons.css'), 'utf8')});
  const measured = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-key]')].map((button) => {
    const text = getComputedStyle(button.querySelector('.sf-button-text-container'));
    return [button.dataset.key, {height: Math.round(button.getBoundingClientRect().height), size: text.fontSize, family: text.fontFamily.split(',')[0].trim()}];
  })));
  for (const appearance of APPEARANCES) for (const size of SIZES) {
    const primary = measured[`${appearance}|${size}|primary`];
    const error = measured[`${appearance}|${size}|error`];
    if (JSON.stringify(primary) !== JSON.stringify(error)) failures.push({case: `${appearance} size-${size}: error matches primary`, primary, error});
  }
  console.log(JSON.stringify({checked: APPEARANCES.length * SIZES.length}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_SCHEMES_OK');
