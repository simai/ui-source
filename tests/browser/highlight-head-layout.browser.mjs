#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The code block's head lays itself out (simai/ui-source#31 items 2 and 3,
// ui-chat D-08), with the utility sheet withheld -- every /distr/utility/
// request answers 404, so nothing but the component's own sheet can place
// the head's children:
//   - the head is a flex row one size-1 control high (36-40 px asked);
//   - the language label stands at the start, at the code's own inset;
//   - copy stands at the end, the wrap toggle right before it; every child's
//     middle is the head's middle (within half a pixel);
//   - the copy button's box is as far from the head's end as from its top;
//   - a block whose language label is absent still puts its buttons at the end;
//   - the copy status is not shown;
//   - the public variables reach the surface: --sf-highlight-radius on an
//     ancestor sets the corner, --sf-highlight-head-height the head.
// Light and dark. With SF_EVIDENCE=<dir>, a screenshot per theme lands there.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE || '';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:24px;background:var(--sf-surface-0);color:var(--sf-on-surface)">
<div id="plain" class="sf-highlight" style="width:520px"><pre><code class="language-js">const answer = 42;
console.log(answer);</code></pre></div>
<div style="height:16px"></div>
<div id="nested" style="--sf-highlight-radius: 3px; --sf-highlight-head-height: var(--sf-ui-1\\/2--control-height); width:520px">
<div class="sf-highlight" data-wrap-control="none"><pre><code class="language-css">.box { color: red; }</code></pre></div></div>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const utilityAsked = [];
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/light' || path === '/dark') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  if (match?.[1] === 'utility') {
    utilityAsked.push(match[2]);
    response.writeHead(404);
    return response.end();
  }
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const seen = {};
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const tab = await browser.newPage({viewport: {width: 900, height: 600}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
    await tab.waitForFunction(() => document.querySelectorAll('.sf-highlight__copy').length === 2
      && document.querySelector('#plain code span[class^="hljs"]'), null, {timeout: 10000}).catch(() => {});
    await tab.waitForTimeout(300);
    const measure = await tab.evaluate(() => {
      const read = (box) => {
        const head = box.querySelector('.sf-highlight__head');
        const h = head.getBoundingClientRect();
        const pre = box.querySelector('pre');
        const code = pre.getBoundingClientRect();
        const style = getComputedStyle(head);
        const children = [...head.children].filter((node) => getComputedStyle(node).position !== 'absolute').map((node) => {
          const r = node.getBoundingClientRect();
          return {name: node.className.split(' ')[0], left: r.left - h.left, right: h.right - r.right, top: r.top - h.top, middle: r.top + r.height / 2 - (h.top + h.height / 2), height: r.height};
        });
        const status = head.querySelector('.sf-highlight__status');
        const s = status?.getBoundingClientRect();
        return {
          display: style.display,
          height: h.height,
          children,
          codeInset: code.left + Number.parseFloat(getComputedStyle(pre).paddingLeft) - h.left,
          statusShown: s ? s.width > 1 || s.height > 1 : false,
          radius: getComputedStyle(box).borderTopLeftRadius,
        };
      };
      const ruler = document.createElement('div');
      ruler.style.cssText = 'position:absolute;block-size:var(--sf-ui-1--control-height);inline-size:var(--sf-ui-1\\/2--control-height)';
      document.body.append(ruler);
      const control = {size1: ruler.getBoundingClientRect().height, size12: ruler.getBoundingClientRect().width};
      ruler.remove();
      return {plain: read(document.querySelector('#plain')), nested: read(document.querySelector('#nested .sf-highlight')), control};
    });
    seen[theme] = measure;
    if (evidence) await tab.screenshot({path: join(evidence, `highlight-head-${theme}.png`), clip: {x: 0, y: 0, width: 600, height: 300}});
    const {plain, nested, control} = measure;
    const at = (name) => plain.children.find((child) => child.name === name);
    if (plain.display !== 'flex') failures.push(`${theme}: the head is ${plain.display}, not flex`);
    if (!near(plain.height, control.size1 + 1, 0.6)) failures.push(`${theme}: head ${plain.height} px, expected one size-1 control (${control.size1}) and its rule`);
    if (plain.height < 36 || plain.height > 42) failures.push(`${theme}: head ${plain.height} px is outside 36-40 (+ the 1 px rule)`);
    const label = at('sf-highlight__language');
    const copy = at('sf-highlight__copy');
    const wrap = at('sf-highlight__wrap-toggle');
    if (!label || !copy || !wrap) failures.push(`${theme}: head children ${plain.children.map((c) => c.name).join(' ')}`);
    else {
      if (!near(label.left, plain.codeInset, 1)) failures.push(`${theme}: label at ${label.left}, the code at ${plain.codeInset}`);
      if (copy.right > 8) failures.push(`${theme}: copy stands ${copy.right} px from the end`);
      if (!near(copy.right, copy.top, 1)) failures.push(`${theme}: copy end inset ${copy.right} vs top inset ${copy.top}`);
      if (wrap.right <= copy.right) failures.push(`${theme}: the wrap toggle is not before copy`);
      for (const child of plain.children) if (!near(child.middle, -0.5, 0.6)) failures.push(`${theme}: ${child.name} middle off by ${child.middle}`);
    }
    if (plain.statusShown) failures.push(`${theme}: the copy status is visible`);
    if (plain.radius === '3px') failures.push(`${theme}: the plain block took the nested radius`);
    if (nested.radius !== '3px') failures.push(`${theme}: --sf-highlight-radius did not reach the surface (${nested.radius})`);
    if (!near(nested.height, control.size12 + 1, 0.6)) failures.push(`${theme}: --sf-highlight-head-height gave ${nested.height}`);
    const nestedCopy = nested.children.find((child) => child.name === 'sf-highlight__copy');
    if (!nestedCopy || nestedCopy.right > 8) failures.push(`${theme}: without a toggle, copy is not at the end (${JSON.stringify(nested.children)})`);
    await tab.close();
  }
  seen.utilityAsked = utilityAsked;
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_HEAD_LAYOUT_OK');
