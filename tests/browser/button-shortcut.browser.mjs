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
// the quieter ink; the keys the kbd component's soft caps (owner decision
// 2026-11-07, docs review R030, rule C04): sized from the label (0.8125em
// letters, 1.6em high), their ink the label's own and their fill that ink
// at 8 %, no edge; the key box the same before and after the kbd sheet
// arrives.
//
// The snapshot and the live button: the search-trigger snapshot (printed on
// a Mac, ⌘ K) on a page without any script stands in the same boxes as the
// button drawn live on a Mac, 0 px apart. On a page that says it is Windows
// the caps are Ctrl K: a key of one character is a square, a key of several
// letters hugs its word -- the caps are true to the platform, not to its
// widest word (docs review R010, 2026-11-06) -- and the + between the words
// is written but not drawn: caps stand apart.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
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
// The snapshot of the search-trigger example and the sheets it was printed with.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const snapshot = readFileSync(join(repo, 'src/smart/button/static/default/search-trigger.html'), 'utf8');
const snapshotSheets = JSON.parse(readFileSync(join(repo, 'src/smart/button/static/sheets.json'), 'utf8')).examples['search-trigger'];
const STAGE = '<style>.stage{display:flex;inline-size:320px;padding:16px}</style>';
const printedPage = () => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
${snapshotSheets.map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('\n')}
${STAGE}</head><body><div class="stage">${snapshot}</div></body></html>`;
const livePage = () => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>${STAGE}</head><body><div class="stage">
<sf-button text="Поиск" appearance="tonal" scheme="on-surface-variant" radius="rounded" icon-start="search" text-position="start" shortcut="mod+k" root-class="w-full"></sf-button>
</div></body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const requested = [];
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  requested.push(path);
  const pages = {'/page': page, '/printed': printedPage, '/live': livePage};
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path]());
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
const url = (path) => `http://127.0.0.1:${server.address().port}${path}`;

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/page`);
  await tab.waitForFunction(() => customElements.get('sf-button') && document.querySelector('#search .sf-button-shortcut kbd kbd')
    && document.querySelector('#search .sf-icon'), null, {timeout: 20000})
    .catch(() => failures.push('the search trigger never drew its keys'));
  // The key box as first drawn, before the lazily fetched kbd sheet.
  const firstBox = await tab.evaluate(() => {
    const group = document.querySelector('#search .sf-button-shortcut .sf-kbd--group');
    const kbdSheet = Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || ''));
    return {kbdSheet, group: group ? [group.getBoundingClientRect().width, group.getBoundingClientRect().height] : null};
  });
  await tab.waitForFunction(() => Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 15000})
    .catch(() => failures.push('the kbd sheet never arrived'));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);

  const apple = await tab.evaluate(() => /mac|iphone|ipad|ipod/iu.test(navigator.userAgentData?.platform || navigator.platform || ''));
  const drawn = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const button = host.querySelector('button.sf-button');
      const wrapper = button?.querySelector('.sf-button-shortcut');
      const group = wrapper?.querySelector(':scope > .sf-kbd--group');
      return {
        host: getComputedStyle(host).display,
        caps: Array.from(group?.querySelectorAll(':scope > kbd') ?? []).map((key) => key.textContent.trim()),
        hidden: wrapper?.getAttribute('aria-hidden') ?? null,
        last: button?.lastElementChild === wrapper,
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
    const group = button.querySelector('.sf-button-shortcut .sf-kbd--group');
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
    probe.remove();
    // A cap is 1.6em of letters at 0.8125em of the label (owner decision C04).
    const labelSize = parseFloat(getComputedStyle(label).fontSize);
    const keyLadder = labelSize * 0.8125 * 1.6;
    // The ink the caps should wear: the label's own, the fill that ink at 8 %.
    const mix = document.createElement('span');
    mix.style.color = getComputedStyle(label).color;
    button.append(mix);
    const capInk = getComputedStyle(mix).color;
    mix.style.color = `color-mix(in srgb, ${capInk} 8%, transparent)`;
    const capFill = getComputedStyle(mix).color;
    mix.remove();
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
      keyFill: getComputedStyle(keys[0]).backgroundColor,
      keyEdge: getComputedStyle(keys[0]).borderTopWidth,
      keyFace: [getComputedStyle(keys[0]).fontSize, getComputedStyle(keys[0]).fontWeight],
      labelSize,
      capInk,
      capFill,
      variant,
      radius: getComputedStyle(button).borderTopLeftRadius,
      group: [box(group).width, box(group).height],
    };
  });
  seen.geometry = geometry;
  seen.firstBox = firstBox;
  if (Math.abs(geometry.height - geometry.ladder) > 0.5) failures.push(`the trigger is ${geometry.height}px tall, the size 1 control height is ${geometry.ladder}px`);
  if (geometry.keyHeights.some((height) => Math.abs(height - geometry.keyLadder) > 0.5)) failures.push(`the keys are ${geometry.keyHeights}px tall, not 1.6em of 0.8125em of the label (${geometry.keyLadder}px)`);
  if (Math.abs(parseFloat(geometry.keyFace[0]) - geometry.labelSize * 0.8125) > 0.05 || geometry.keyFace[1] !== '500') failures.push(`the caps' letters are ${geometry.keyFace}, not 0.8125em of the ${geometry.labelSize}px label at weight 500`);
  if (geometry.keyColour !== geometry.capInk || geometry.keyFill !== geometry.capFill) failures.push(`the caps wear ${geometry.keyColour} on ${geometry.keyFill}, not the label's ink (${geometry.capInk}) on 8 % of it (${geometry.capFill})`);
  if (geometry.keyEdge !== '0px') failures.push(`a cap has an edge of ${geometry.keyEdge}`);
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
  await phone.waitForFunction(() => document.querySelector('#search .sf-button-shortcut kbd kbd') && document.querySelector('#search .sf-icon'), null, {timeout: 20000})
    .catch(() => failures.push('375: the search trigger never drew its keys'));
  await phone.evaluate(() => document.fonts.ready);
  const small = await phone.evaluate(() => {
    const button = document.querySelector('#search button.sf-button');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;display:block;block-size:var(--sf-ui-1--control-height)';
    button.append(probe);
    const ladder = probe.getBoundingClientRect().height;
    probe.remove();
    const keyLadder = parseFloat(getComputedStyle(button.querySelector('.sf-button-text-container')).fontSize) * 0.8125 * 1.6;
    const b = button.getBoundingClientRect();
    const centre = (rect) => rect.top + rect.height / 2;
    return {
      height: b.height,
      ladder,
      keyLadder,
      keyHeights: Array.from(button.querySelectorAll('.sf-button-shortcut .sf-kbd--group > kbd')).map((key) => key.getBoundingClientRect().height),
      centres: [button.querySelector('.sf-icon'), button.querySelector('.sf-button-shortcut')].map((node) => Math.round((centre(node.getBoundingClientRect()) - centre(b)) * 100) / 100),
    };
  });
  seen.phone = small;
  if (Math.abs(small.height - small.ladder) > 0.5) failures.push(`375: the trigger is ${small.height}px tall, the control height is ${small.ladder}px`);
  if (small.keyHeights.some((height) => Math.abs(height - small.keyLadder) > 0.5)) failures.push(`375: the keys are ${small.keyHeights}px tall, expected ${small.keyLadder}px`);
  if (small.centres.some((offset) => Math.abs(offset) > 0.5)) failures.push(`375: icon and keys are off the centre line: ${small.centres}`);
  await phone.close();

  // Across platforms: the printed Mac snapshot against the live Windows button.
  const geometryOf = (tab) => tab.evaluate(() => {
    const button = document.querySelector('button.sf-button');
    const origin = button.getBoundingClientRect();
    const box = (node) => {
      const r = node.getBoundingClientRect();
      return [r.left - origin.left, r.top - origin.top, r.width, r.height].map((n) => Math.round(n * 100) / 100);
    };
    const group = button.querySelector('.sf-button-shortcut .sf-kbd--group');
    return {
      joins: Array.from(group.querySelectorAll(':scope > .sf-kbd-join')).map((join) => [join.textContent, getComputedStyle(join).display]),
      button: [origin.left, origin.top, origin.width, origin.height].map((n) => Math.round(n * 100) / 100),
      group: box(group),
      keys: Array.from(group.querySelectorAll(':scope > kbd')).map(box),
      caps: Array.from(group.querySelectorAll(':scope > kbd')).map((key) => key.textContent.trim()),
      label: box(button.querySelector('.sf-button-text-container')),
    };
  });
  for (const width of [1280, 375]) {
    const printedTab = await browser.newPage({viewport: {width, height: 400}});
    await printedTab.goto(url('/printed'));
    await printedTab.evaluate(() => document.fonts.ready);
    await printedTab.waitForTimeout(200);
    const printed = await geometryOf(printedTab);
    await printedTab.close();
    const drawLive = async (windows) => {
      const tab = await browser.newPage({viewport: {width, height: 400}});
      await tab.addInitScript((onWindows) => {
        const platform = onWindows ? ['Win32', 'Windows'] : ['MacIntel', 'macOS'];
        Object.defineProperty(Navigator.prototype, 'platform', {get: () => platform[0], configurable: true});
        Object.defineProperty(Navigator.prototype, 'userAgentData', {get: () => ({platform: platform[1], brands: [], mobile: false}), configurable: true});
      }, windows);
      await tab.goto(url('/live'));
      await tab.waitForFunction(() => document.querySelector('sf-button .sf-button-shortcut kbd kbd') && document.querySelector('sf-button .sf-icon')
        && Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 20000})
        .catch(() => failures.push(`${width}: the live ${windows ? 'Windows' : 'Mac'} button never drew its keys with the kbd sheet`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(200);
      const drawn = await geometryOf(tab);
      drawn.hug = await tab.evaluate(() => Array.from(document.querySelectorAll('sf-button .sf-button-shortcut .sf-kbd--group > kbd')).map((key) => {
        const style = getComputedStyle(key);
        const range = document.createRange();
        range.selectNodeContents(key);
        return Math.round((range.getBoundingClientRect().width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
          + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)) * 100) / 100;
      }));
      await tab.close();
      return drawn;
    };
    const mac = await drawLive(false);
    const live = await drawLive(true);
    seen[`platforms${width}`] = {printed, mac, live};
    if (JSON.stringify(printed.caps) !== JSON.stringify(['⌘', 'K']) || JSON.stringify(mac.caps) !== JSON.stringify(['⌘', 'K']) || JSON.stringify(live.caps) !== JSON.stringify(['Ctrl', 'K'])) {
      failures.push(`${width}: the printed caps are ${printed.caps}, the live Mac caps ${mac.caps} and the live Windows caps ${live.caps}, expected ⌘ K, ⌘ K and Ctrl K`);
    }
    if (JSON.stringify(mac.joins) !== '[]' || JSON.stringify(live.joins) !== JSON.stringify([['+', 'none']])) {
      failures.push(`${width}: the joins are ${JSON.stringify(mac.joins)} on a Mac and ${JSON.stringify(live.joins)} on Windows, expected none and one + that is not drawn`);
    }
    for (const part of ['button', 'group', 'keys', 'label']) {
      if (JSON.stringify(printed[part]) !== JSON.stringify(mac[part])) failures.push(`${width}: ${part} moved between the printed Mac snapshot and the live Mac button: ${JSON.stringify(printed[part])} -> ${JSON.stringify(mac[part])}`);
    }
    for (const [name, drawn] of [['Mac', mac], ['Windows', live]]) {
      drawn.keys.forEach(([, , keyWidth, keyHeight], index) => {
        const cap = drawn.caps[index];
        if ([...cap].length === 1 && Math.abs(keyWidth - keyHeight) > 0.5) failures.push(`${width} ${name}: the key ${cap} is ${keyWidth}x${keyHeight}, not a square`);
        if ([...cap].length > 1 && Math.abs(keyWidth - drawn.hug[index]) > 0.5) failures.push(`${width} ${name}: the key ${cap} is ${keyWidth}px wide, its word with the padding ${drawn.hug[index]}px`);
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
