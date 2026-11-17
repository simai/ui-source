#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A code block's head is one step of the height ladder: the control height
// of step 1, 40 on a desktop and 36 on a phone (C18). Its language label
// carries the text utility sf-text-1/2, whose flow rule (.sf-text-1/2 + *)
// gave the next part of the head, the wrap toggle, a 16 px top margin: the
// head drew 48 (defects-d12, DEV msg-dd9ece44). The head's parts keep no
// block margin. 1440 and 390 (a touch phone), light and dark, 3 loads; a
// block with the language name and the two buttons, one titled, and one
// whose head the page wrote: the label, then a button right after it.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:16px">
<div class="sf-highlight" id="plain"><pre><code class="language-js">const answer = 42;</code></pre></div>
<div class="sf-highlight" id="titled" style="margin-top:16px"><pre data-title="main.js"><code class="language-js">console.log(answer);</code></pre></div>
<div class="sf-highlight" id="written" style="margin-top:16px"><div class="sf-highlight__head"><span class="sf-highlight__language sf-text-1/2 weight-5">js</span><button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/2" aria-label="Перенос строк"><i class="sf-icon" aria-hidden="true">wrap_text</i></button></div><pre><code class="language-js">const written = true;</code></pre></div>
</body></html>`;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/light' || path === '/dark') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
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
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    for (let load = 1; load <= 3; load += 1) {
      const view = `${width} ${theme} load ${load}`;
      const context = await browser.newContext({viewport: {width, height: 700}, isMobile: width < 768, hasTouch: width < 768});
      const tab = await context.newPage();
      const said = [];
      tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) said.push(message.text()); });
      tab.on('pageerror', (error) => said.push(error.message));
      await tab.goto(`${origin}/${theme}`);
      await tab.waitForFunction(() => document.querySelectorAll('.sf-highlight__head .sf-highlight__language').length === 3
        && document.querySelectorAll('.sf-highlight__head .sf-highlight__copy').length === 3, null, {timeout: 15000});
      await tab.waitForTimeout(300);
      const read = await tab.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.blockSize = 'var(--sf-ui-1--control-height)';
        document.body.append(probe);
        const step = probe.getBoundingClientRect().height;
        probe.remove();
        return {step, heads: [...document.querySelectorAll('.sf-highlight__head')].map((head) => ({
          id: head.closest('.sf-highlight').id,
          height: head.getBoundingClientRect().height,
          label: head.querySelector('.sf-highlight__language').className,
          margins: [...head.children].filter((child) => child.getBoundingClientRect().height > 0 && !child.matches('.sr-only, .sf-highlight__status'))
            .map((child) => [child.className.split(' ')[0], getComputedStyle(child).marginTop, getComputedStyle(child).marginBottom])
            .filter(([, top, bottom]) => top !== '0px' || bottom !== '0px'),
        }))};
      });
      const want = width < 768 ? 36 : 40;
      if (Math.abs(read.step - want) > 0.5) failures.push({view, name: 'the step 1 control height is the ladder\'s', step: read.step, want});
      for (const head of read.heads) {
        if (Math.abs(head.height - read.step) > 0.5) failures.push({view, name: `the ${head.id} head is the step 1 control height`, height: head.height, step: read.step});
        if (head.margins.length) failures.push({view, name: `the ${head.id} head's parts keep no block margin`, margins: head.margins});
      }
      if (said.length) failures.push({view, name: 'console', said});
      console.log(JSON.stringify({view, step: read.step, heads: read.heads.map(({id, height}) => ({id, height}))}));
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`highlight head height: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('highlight head height: pass');
