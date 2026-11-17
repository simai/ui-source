#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The wrap toggle in a code block's head: a button beside copy, named in the
// page language, aria-pressed false; pressed, long lines wrap inside the block
// (no sideways scroll) and it says true; pressed again, they scroll again. A
// block with data-wrap="true" starts wrapped, and data-wrap-control="none"
// has no toggle (owner request through the effects catalogue, 2026-10-29).
// The toggle shows its name as the Framework tooltip on hover and keyboard
// focus, as copy does, and the two stand as an action row: the actions gap
// role apart, 8 and 4 in compact (C144; it was 0 on screen).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const head = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>`;
const line = `const message = '${'a long line of code that does not fit the block '.repeat(6)}';`;
const block = (attributes = '') => `<div class="sf-highlight" ${attributes} style="width:480px"><pre><code class="language-js">${line}</code></pre></div>`;
const cases = {
  plain: block(),
  wrapped: block('data-wrap="true"'),
  none: block('data-wrap-control="none"'),
  compact: `<div data-sf-density="compact">${block()}</div>`,
};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (cases[path.slice(1)]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`${head}${cases[path.slice(1)]}</body></html>`);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const state = (tab) => tab.evaluate(() => {
    const box = document.querySelector('.sf-highlight');
    const toggle = box.querySelector('.sf-highlight__wrap-toggle');
    const pre = box.querySelector('pre');
    const head = [...box.querySelector('.sf-highlight__head').children].map((node) => node.className.split(' ')[0]);
    const copy = box.querySelector('.sf-highlight__copy');
    const tip = toggle?.getAttribute('data-tooltip') ? document.getElementById(toggle.getAttribute('data-tooltip')) : null;
    const probe = document.createElement('div');
    probe.style.inlineSize = 'var(--sf-gap--actions)';
    box.append(probe);
    const role = probe.getBoundingClientRect().width;
    probe.remove();
    const gap = toggle && copy ? copy.getBoundingClientRect().left - toggle.getBoundingClientRect().right : null;
    return {toggle: Boolean(toggle), name: toggle?.getAttribute('aria-label') ?? null, pressed: toggle?.getAttribute('aria-pressed') ?? null,
      sideways: pre.scrollWidth > pre.clientWidth + 1, head: head.filter((name) => name !== 'sf-tooltip'),
      tooltip: tip ? {text: tip.textContent.trim(), tooltip: tip.classList.contains('sf-tooltip')} : null,
      gap: gap === null ? null : Math.round(gap * 100) / 100, role};
  });
  const tipShown = (tab) => tab.evaluate(() => {
    const toggle = document.querySelector('.sf-highlight__wrap-toggle');
    const tip = document.getElementById(toggle?.getAttribute('data-tooltip') || '-');
    if (!tip) return null;
    const box = tip.getBoundingClientRect();
    return {hidden: tip.hidden, visible: getComputedStyle(tip).visibility !== 'hidden' && box.width > 0 && box.height > 0, role: tip.getAttribute('role')};
  });
  const open = async (name) => {
    // 1200: compact density applies from 60rem.
    const tab = await browser.newPage({viewport: {width: 1200, height: 700}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    await tab.waitForFunction(() => document.querySelector('.sf-highlight__copy') && document.querySelector('code span[class^="hljs"]'), null, {timeout: 8000}).catch(() => {});
    await tab.waitForTimeout(200);
    return tab;
  };
  let tab = await open('plain');
  seen.plain = await state(tab);
  await tab.hover('.sf-highlight__wrap-toggle').catch(() => {});
  await tab.waitForTimeout(900);
  seen.hover = await tipShown(tab);
  await tab.mouse.move(1, 1);
  await tab.waitForTimeout(300);
  await tab.focus('.sf-highlight__copy').catch(() => {});
  await tab.keyboard.press('Shift+Tab');
  await tab.waitForTimeout(900);
  seen.keyboard = await tipShown(tab);
  await tab.locator('.sf-highlight__wrap-toggle').click().catch(() => {});
  await tab.waitForTimeout(100);
  seen.pressed = await state(tab);
  await tab.locator('.sf-highlight__wrap-toggle').click().catch(() => {});
  await tab.waitForTimeout(100);
  seen.released = await state(tab);
  await tab.close();
  tab = await open('wrapped'); seen.wrapped = await state(tab); await tab.close();
  tab = await open('none'); seen.none = await state(tab); await tab.close();
  tab = await open('compact'); seen.compact = await state(tab); await tab.close();
  if (seen.plain.tooltip?.text !== 'Переносить строки' || !seen.plain.tooltip.tooltip) failures.push(`the toggle has no Framework tooltip with its name: ${JSON.stringify(seen.plain.tooltip)}`);
  if (!seen.hover?.visible || seen.hover.hidden) failures.push(`hover shows no tooltip: ${JSON.stringify(seen.hover)}`);
  if (!seen.keyboard?.visible || seen.keyboard.hidden) failures.push(`keyboard focus shows no tooltip: ${JSON.stringify(seen.keyboard)}`);
  if (Math.abs(seen.plain.gap - 8) > 0.5 || Math.abs(seen.plain.gap - seen.plain.role) > 0.5) failures.push(`wrap and copy are not the actions gap apart (8): ${seen.plain.gap} (role ${seen.plain.role})`);
  if (Math.abs(seen.compact.gap - 4) > 0.5 || Math.abs(seen.compact.gap - seen.compact.role) > 0.5) failures.push(`compact: wrap and copy are not 4 apart: ${seen.compact.gap} (role ${seen.compact.role})`);
  if (!seen.plain.toggle || seen.plain.name !== 'Переносить строки' || seen.plain.pressed !== 'false' || !seen.plain.sideways) failures.push(`plain: ${JSON.stringify(seen.plain)}`);
  if (seen.plain.head.indexOf('sf-highlight__wrap-toggle') !== seen.plain.head.indexOf('sf-highlight__copy') - 1) failures.push(`the toggle does not stand right before copy: ${seen.plain.head.join(' ')}`);
  if (seen.pressed.pressed !== 'true' || seen.pressed.sideways) failures.push(`pressed: ${JSON.stringify(seen.pressed)}`);
  if (seen.released.pressed !== 'false' || !seen.released.sideways) failures.push(`released: ${JSON.stringify(seen.released)}`);
  if (seen.wrapped.pressed !== 'true' || seen.wrapped.sideways) failures.push(`data-wrap="true": ${JSON.stringify(seen.wrapped)}`);
  if (seen.none.toggle) failures.push('data-wrap-control="none" still drew the toggle');
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_WRAP_TOGGLE_OK');
