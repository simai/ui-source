#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-button's shortcut on the built bytes: the keys drawn at the end in the
// platform's words (⌘ K on a Mac, Ctrl K elsewhere), hidden from assistive
// technology while the native button says them in aria-keyshortcuts; with
// shortcut-listen the combination presses the button once (sf-button-press),
// a bare key (/) is not heard in a field while mod+k is, a disabled button is
// never pressed. Geometry of the search trigger (tonal, on-surface-variant,
// rounded, icon-start, text-position start, stretched): the control height of
// its size, the icon, the label and the keys on one centre line, the label
// starting after the icon and the keys at the end; the label and the icon in
// the quieter ink; the key box the same before and after the kbd sheet (a
// lazy relation) arrives.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>.stage{display:flex;inline-size:320px;padding:16px}</style></head><body>
<div class="stage"><sf-button id="search" text="Поиск" icon-start="search" shortcut="mod+k" shortcut-listen
  appearance="tonal" scheme="on-surface-variant" radius="rounded" text-position="start" root-class="w-full"></sf-button></div>
<div class="stage"><sf-button id="slash" text="Найти" shortcut="/" shortcut-listen appearance="outline" scheme="on-surface"></sf-button></div>
<div class="stage"><sf-button id="off" text="Нельзя" shortcut="mod+j" shortcut-listen disabled></sf-button></div>
<div class="stage"><sf-button id="plain" text="Без клавиш"></sf-button></div>
<input id="field" type="text" aria-label="Поле">
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const requested = [];
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  requested.push(path);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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
  const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/page`);
  await tab.waitForFunction(() => customElements.get('sf-button') && document.querySelector('#search .sf-button-shortcut kbd')
    && document.querySelector('#search .sf-icon'), null, {timeout: 20000})
    .catch(() => failures.push('the search trigger never drew its keys'));
  // The key box as first drawn, before the lazily fetched kbd sheet.
  const firstBox = await tab.evaluate(() => {
    const group = document.querySelector('#search .sf-button-shortcut');
    const kbdSheet = Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || ''));
    return {kbdSheet, group: group ? [group.getBoundingClientRect().width, group.getBoundingClientRect().height] : null};
  });
  await tab.waitForFunction(() => Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 15000})
    .catch(() => failures.push('the kbd sheet (a lazy relation) never arrived'));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);

  const apple = await tab.evaluate(() => /mac|iphone|ipad|ipod/iu.test(navigator.userAgentData?.platform || navigator.platform || ''));
  const drawn = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const button = host.querySelector('button.sf-button');
      const group = button?.querySelector('.sf-button-shortcut');
      return {
        host: getComputedStyle(host).display,
        caps: Array.from(group?.querySelectorAll(':scope > kbd') ?? []).map((key) => key.textContent.trim()),
        hidden: group?.getAttribute('aria-hidden') ?? null,
        last: button?.lastElementChild === group,
        keyshortcuts: button?.getAttribute('aria-keyshortcuts') ?? null,
        name: button?.textContent.replace(/\s+/gu, ' ').trim(),
      };
    };
    return {search: read('search'), slash: read('slash'), plain: read('plain')};
  });
  seen.apple = apple;
  seen.drawn = drawn;
  const mod = apple ? '⌘' : 'Ctrl';
  if (drawn.search.host !== 'contents') failures.push(`the host is display ${drawn.search.host}, not contents`);
  if (JSON.stringify(drawn.search.caps) !== JSON.stringify([mod, 'K'])) failures.push(`mod+k reads ${JSON.stringify(drawn.search.caps)}, expected ${mod} K`);
  if (JSON.stringify(drawn.slash.caps) !== JSON.stringify(['/'])) failures.push(`/ reads ${JSON.stringify(drawn.slash.caps)}`);
  if (drawn.search.hidden !== 'true' || !drawn.search.last) failures.push('the keys are not the last, aria-hidden child of the button');
  if (drawn.search.keyshortcuts !== (apple ? 'Meta+K' : 'Control+K')) failures.push(`aria-keyshortcuts is ${drawn.search.keyshortcuts}`);
  if (drawn.slash.keyshortcuts !== '/') failures.push(`aria-keyshortcuts of / is ${drawn.slash.keyshortcuts}`);
  if (drawn.plain.caps.length || drawn.plain.keyshortcuts !== null) failures.push('a button without a shortcut draws keys or aria-keyshortcuts');

  // Geometry and ink of the search trigger.
  const geometry = await tab.evaluate(() => {
    const host = document.getElementById('search');
    const button = host.querySelector('button.sf-button');
    const icon = button.querySelector('.sf-icon');
    const label = button.querySelector('.sf-button-text-container');
    const group = button.querySelector('.sf-button-shortcut');
    const keys = Array.from(group.querySelectorAll(':scope > kbd'));
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = Array.from(range.getClientRects()).find((rect) => rect.width > 0);
    const box = (element) => element.getBoundingClientRect();
    const centre = (rect) => rect.top + rect.height / 2;
    const probe = document.createElement('span');
    probe.style.color = 'var(--sf-on-surface-variant)';
    button.append(probe);
    const variant = getComputedStyle(probe).color;
    probe.style.color = 'var(--sf-ui-1--control-height)';
    probe.style.blockSize = 'var(--sf-ui-1--control-height)';
    probe.style.display = 'block';
    probe.style.position = 'absolute';
    const ladder = probe.getBoundingClientRect().height;
    probe.style.blockSize = 'var(--sf-text-height-1\\/2)';
    const keyLadder = probe.getBoundingClientRect().height;
    probe.remove();
    const stage = box(host.parentElement);
    const b = box(button);
    return {
      height: b.height,
      ladder,
      keyLadder,
      width: b.width,
      stageInner: stage.width - 32,
      centres: [centre(box(icon)), centre(text), centre(box(group))].map((value) => Math.round((value - centre(b)) * 100) / 100),
      iconSize: [box(icon).width, box(icon).height],
      textStartAfterIcon: Math.round((text.left - box(icon).right) * 100) / 100,
      labelPaddingStart: parseFloat(getComputedStyle(label).paddingInlineStart),
      keysEndGap: Math.round((b.right - box(group).right) * 100) / 100,
      buttonPaddingEnd: parseFloat(getComputedStyle(button).paddingInlineEnd) + parseFloat(getComputedStyle(button).borderInlineEndWidth),
      keyHeights: keys.map((key) => box(key).height),
      labelColour: getComputedStyle(label).color,
      iconColour: getComputedStyle(icon).color,
      keyColour: getComputedStyle(keys[0]).color,
      variant,
      radius: getComputedStyle(button).borderTopLeftRadius,
      group: [box(group).width, box(group).height],
    };
  });
  seen.geometry = geometry;
  seen.firstBox = firstBox;
  if (Math.abs(geometry.height - geometry.ladder) > 0.5) failures.push(`the trigger is ${geometry.height}px tall, the size 1 control height is ${geometry.ladder}px`);
  if (geometry.keyHeights.some((height) => Math.abs(height - geometry.keyLadder) > 0.5)) failures.push(`the keys are ${geometry.keyHeights}px tall, not the text line of the rung below (${geometry.keyLadder}px)`);
  if (Math.abs(geometry.width - geometry.stageInner) > 0.5) failures.push(`the stretched trigger is ${geometry.width}px wide in a ${geometry.stageInner}px row`);
  if (geometry.centres.some((offset) => Math.abs(offset) > 0.5)) failures.push(`icon, label and keys are off the button's centre line: ${geometry.centres}`);
  if (Math.abs(geometry.textStartAfterIcon - geometry.labelPaddingStart) > 0.5) failures.push(`the label starts ${geometry.textStartAfterIcon}px after the icon, not at its own padding (${geometry.labelPaddingStart}px): it is not at the start`);
  if (Math.abs(geometry.keysEndGap - geometry.buttonPaddingEnd) > 0.5) failures.push(`the keys end ${geometry.keysEndGap}px before the edge, not at the button's padding (${geometry.buttonPaddingEnd}px)`);
  if (geometry.labelColour !== geometry.variant || geometry.iconColour !== geometry.variant) failures.push(`the label (${geometry.labelColour}) and the icon (${geometry.iconColour}) are not the quiet ink ${geometry.variant}`);
  if (!firstBox.group || Math.abs(firstBox.group[0] - geometry.group[0]) > 0.5 || Math.abs(firstBox.group[1] - geometry.group[1]) > 0.5) {
    failures.push(`the key box moved when the kbd sheet arrived: ${JSON.stringify(firstBox.group)} -> ${JSON.stringify(geometry.group)} (kbd sheet at first draw: ${firstBox.kbdSheet})`);
  }

  // Listening.
  await tab.evaluate(() => {
    window.__presses = {search: 0, slash: 0, off: 0};
    for (const id of Object.keys(window.__presses)) document.getElementById(id).addEventListener('sf-button-press', () => { window.__presses[id] += 1; });
  });
  const combo = apple ? 'Meta+k' : 'Control+k';
  await tab.mouse.click(5, 700);
  await tab.keyboard.press(combo);
  await tab.keyboard.press('/');
  await tab.keyboard.press(apple ? 'Meta+j' : 'Control+j');
  const onPage = await tab.evaluate(() => ({...window.__presses}));
  await tab.locator('#field').focus();
  await tab.keyboard.press('/');
  const typed = await tab.evaluate(() => document.getElementById('field').value);
  await tab.keyboard.press(combo);
  const inField = await tab.evaluate(() => ({...window.__presses}));
  seen.presses = {onPage, inField, typed};
  if (onPage.search !== 1) failures.push(`${combo} pressed the search trigger ${onPage.search} times on the page`);
  if (onPage.slash !== 1) failures.push(`/ pressed its button ${onPage.slash} times on the page`);
  if (onPage.off !== 0) failures.push('a disabled button was pressed by its shortcut');
  if (inField.slash !== 1 || typed !== '/') failures.push(`/ in a field pressed the button (${inField.slash}) or did not type (${JSON.stringify(typed)})`);
  if (inField.search !== 2) failures.push(`${combo} in a field did not press the search trigger (${inField.search})`);

  // Turning listening off removes the listener.
  await tab.evaluate(() => document.getElementById('search').removeAttribute('shortcut-listen'));
  await tab.mouse.click(5, 700);
  await tab.keyboard.press(combo);
  const after = await tab.evaluate(() => window.__presses.search);
  if (after !== 2) failures.push(`with shortcut-listen removed, ${combo} still pressed the button`);
  await tab.close();

  // A phone: the ladder's rungs are smaller below the wide breakpoint, and
  // the keys and the control follow them.
  const phone = await browser.newPage({viewport: {width: 375, height: 700}});
  await phone.goto(`http://127.0.0.1:${server.address().port}/page`);
  await phone.waitForFunction(() => document.querySelector('#search .sf-button-shortcut kbd') && document.querySelector('#search .sf-icon'), null, {timeout: 20000})
    .catch(() => failures.push('375: the search trigger never drew its keys'));
  await phone.evaluate(() => document.fonts.ready);
  const small = await phone.evaluate(() => {
    const button = document.querySelector('#search button.sf-button');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;display:block;block-size:var(--sf-ui-1--control-height)';
    button.append(probe);
    const ladder = probe.getBoundingClientRect().height;
    probe.style.blockSize = 'var(--sf-text-height-1\\/2)';
    const keyLadder = probe.getBoundingClientRect().height;
    probe.remove();
    const b = button.getBoundingClientRect();
    const centre = (rect) => rect.top + rect.height / 2;
    return {
      height: b.height,
      ladder,
      keyLadder,
      keyHeights: Array.from(button.querySelectorAll('.sf-button-shortcut > kbd')).map((key) => key.getBoundingClientRect().height),
      centres: [button.querySelector('.sf-icon'), button.querySelector('.sf-button-shortcut')].map((node) => Math.round((centre(node.getBoundingClientRect()) - centre(b)) * 100) / 100),
    };
  });
  seen.phone = small;
  if (Math.abs(small.height - small.ladder) > 0.5) failures.push(`375: the trigger is ${small.height}px tall, the control height is ${small.ladder}px`);
  if (small.keyHeights.some((height) => Math.abs(height - small.keyLadder) > 0.5)) failures.push(`375: the keys are ${small.keyHeights}px tall, expected ${small.keyLadder}px`);
  if (small.centres.some((offset) => Math.abs(offset) > 0.5)) failures.push(`375: icon and keys are off the centre line: ${small.centres}`);
  await phone.close();
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
