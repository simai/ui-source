#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every platform x language x theme.
//
// A combination in running text (owner decision C191 (9) and (10),
// 2026-11-15; ui-control research 2026-11-14-recipe-parts, prototype
// recipe-parts-study.html #q-kb-text, #q-kb-names). On the built bytes, over
// the Loader, with the platform emulated before the page runs (the user agent,
// navigator.platform and navigator.userAgentData of a Mac and of Windows,
// through the DevTools protocol), on a Russian and an English page:
//
//   - <kbd data-sf-shortcut="mod+k"> is filled with the caps every host draws
//     (js/shortcut.js shortcutView): ⌘ K on a Mac, Ctrl K on Windows -- caps
//     apart, no + drawn between them in text; ⇧⌘Z / Ctrl Shift Z; one
//     character a square key; the group the same size as the same caps written
//     by hand;
//   - the caps are hidden from a screen reader and the names of the keys
//     stand beside them in the page's language, read once: «Нажмите Command K,
//     чтобы открыть поиск.»; «Ввод», «Стрелка вверх» on a Russian page, «Enter»,
//     «Up Arrow» on an English one; the words take no room;
//   - a combination added after the page loaded is filled, a changed value is
//     filled again, and SF.language.use() changes the words;
//   - in a tooltip (plain glyphs) the + between Windows words is shown;
//   - no console error.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const TEXT = {
  ru: {
    search: 'Нажмите <kbd id="k-search" data-sf-shortcut="mod+k"></kbd>, чтобы открыть поиск.',
    redo: 'Повторить — <kbd id="k-redo" data-sf-shortcut="shift+mod+z"></kbd>.',
    keys: 'Отправить — <kbd id="k-enter" data-sf-shortcut="enter"></kbd>, выше — <kbd id="k-up" data-sf-shortcut="up"></kbd>, закрыть — <kbd id="k-esc" data-sf-shortcut="escape"></kbd>.',
    late: 'Жирный — <kbd id="k-late" data-sf-shortcut="mod+b"></kbd>.',
  },
  en: {
    search: 'Press <kbd id="k-search" data-sf-shortcut="mod+k"></kbd> to open search.',
    redo: 'Redo — <kbd id="k-redo" data-sf-shortcut="shift+mod+z"></kbd>.',
    keys: 'Send — <kbd id="k-enter" data-sf-shortcut="enter"></kbd>, up — <kbd id="k-up" data-sf-shortcut="up"></kbd>, close — <kbd id="k-esc" data-sf-shortcut="escape"></kbd>.',
    late: 'Bold — <kbd id="k-late" data-sf-shortcut="mod+b"></kbd>.',
  },
};

const page = (theme, lang) => `<!doctype html><html lang="${lang}" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/tooltip/css/tooltip.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:12px;padding:24px;max-inline-size:640px}p{margin:0}
.tip{position:static;display:inline-flex;inset:auto;opacity:1;visibility:visible;transform:none}</style></head><body><main>
<p id="search">${TEXT[lang].search}</p>
<p id="redo">${TEXT[lang].redo}</p>
<p id="keys">${TEXT[lang].keys}</p>
<p id="hand">Hand: <kbd class="sf-kbd--group" id="hand-mac"><kbd class="sf-kbd--square">⌘</kbd><kbd class="sf-kbd--square">K</kbd></kbd> <kbd class="sf-kbd--group" id="hand-win"><kbd>Ctrl</kbd><kbd class="sf-kbd--square">K</kbd></kbd></p>
<div><div class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 tip" role="tooltip" id="tip"><div class="sf-tooltip-content"><div class="sf-tooltip-wrap"><div class="sf-tooltip-text">Undo <kbd id="k-tip" data-sf-shortcut="shift+mod+z"></kbd></div></div></div></div></div>
<div id="later"></div>
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const route = /^\/(light|dark)-(ru|en)$/u.exec(path);
  if (route) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(route[1], route[2]));
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

const PLATFORMS = {
  mac: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    userAgentMetadata: {platform: 'macOS', platformVersion: '15.0.0', architecture: 'arm', model: '', mobile: false, brands: [{brand: 'Chromium', version: '131'}]},
  },
  win: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: 'Win32',
    userAgentMetadata: {platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', model: '', mobile: false, brands: [{brand: 'Chromium', version: '131'}]},
  },
};

// What each combination should read, per platform and language.
const EXPECT = {
  mac: {
    caps: {search: ['⌘', 'K'], redo: ['⇧', '⌘', 'Z'], enter: ['↵'], up: ['↑'], esc: ['Esc'], late: ['⌘', 'B'], tip: ['⇧', '⌘', 'Z']},
    ru: {search: 'Command K', redo: 'Shift Command Z', enter: 'Ввод', up: 'Стрелка вверх', esc: 'Escape', late: 'Command B'},
    en: {search: 'Command K', redo: 'Shift Command Z', enter: 'Enter', up: 'Up Arrow', esc: 'Escape', late: 'Command B'},
    tipShown: '⇧⌘Z',
  },
  win: {
    caps: {search: ['Ctrl', 'K'], redo: ['Ctrl', 'Shift', 'Z'], enter: ['↵'], up: ['↑'], esc: ['Esc'], late: ['Ctrl', 'B'], tip: ['Ctrl', 'Shift', 'Z']},
    ru: {search: 'Ctrl K', redo: 'Ctrl Shift Z', enter: 'Ввод', up: 'Стрелка вверх', esc: 'Escape', late: 'Ctrl B'},
    en: {search: 'Ctrl K', redo: 'Ctrl Shift Z', enter: 'Enter', up: 'Up Arrow', esc: 'Escape', late: 'Ctrl B'},
    tipShown: 'Ctrl+Shift+Z',
  },
};

const READ = () => {
  const one = (id) => {
    const host = document.getElementById(id);
    if (!host) return null;
    const caps = Array.from(host.querySelectorAll(':scope > kbd'));
    const words = host.querySelector(':scope > .sf-kbd-spoken');
    const r = host.getBoundingClientRect();
    const wr = words?.getBoundingClientRect();
    return {
      group: host.classList.contains('sf-kbd--group'),
      caps: caps.map((cap) => cap.textContent),
      hidden: caps.every((cap) => cap.getAttribute('aria-hidden') === 'true'),
      square: caps.map((cap) => cap.classList.contains('sf-kbd--square')),
      capSizes: caps.map((cap) => { const b = cap.getBoundingClientRect(); return [Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]; }),
      joins: Array.from(host.querySelectorAll(':scope > .sf-kbd-join')).map((join) => getComputedStyle(join).display),
      // What is seen: the caps and the joins, not the words read in their place.
      shown: Array.from(host.children).filter((child) => !child.classList.contains('sf-kbd-spoken') && getComputedStyle(child).display !== 'none').map((child) => child.textContent).join(''),
      words: words?.textContent ?? null,
      wordsBox: wr ? [wr.width, wr.height] : null,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
    };
  };
  const hand = (id) => {
    const host = document.getElementById(id);
    const r = host.getBoundingClientRect();
    return {width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100,
      capSizes: Array.from(host.querySelectorAll(':scope > kbd')).map((cap) => { const b = cap.getBoundingClientRect(); return [Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]; })};
  };
  return {
    search: one('k-search'), redo: one('k-redo'), enter: one('k-enter'), up: one('k-up'), esc: one('k-esc'), tip: one('k-tip'), late: one('k-late'),
    handMac: hand('hand-mac'), handWin: hand('hand-win'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

// The text the browser's accessibility tree holds under one element, in order.
async function heard(cdp, selector) {
  const {root} = await cdp.send('DOM.getDocument', {depth: 0});
  const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
  const {node} = await cdp.send('DOM.describeNode', {nodeId});
  const {nodes} = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((one) => [one.nodeId, one]));
  const start = nodes.find((one) => one.backendDOMNodeId === node.backendNodeId);
  const text = [];
  const walk = (one) => {
    if (!one) return;
    if (!one.ignored && one.role?.value === 'StaticText') text.push(one.name?.value ?? '');
    for (const id of one.childIds ?? []) walk(byId.get(id));
  };
  walk(start);
  return text.join('');
}

const failures = [];
const near = (a, b, tolerance = 0.3) => Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
const rows = [];
try {
  for (const platform of ['mac', 'win']) {
    for (const lang of ['ru', 'en']) {
      for (const theme of ['light', 'dark']) {
        const name = `${platform}-${lang}-${theme}`;
        const context = await browser.newContext({viewport: {width: 900, height: 600}, colorScheme: theme, userAgent: PLATFORMS[platform].userAgent});
        const tab = await context.newPage();
        const cdp = await context.newCDPSession(tab);
        await cdp.send('Emulation.setUserAgentOverride', PLATFORMS[platform]);
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        const fail = (detail) => failures.push(`${name}: ${detail}`);
        await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}-${lang}`);
        const said = await tab.evaluate(() => [navigator.platform, navigator.userAgentData?.platform]);
        if (said[0] !== PLATFORMS[platform].platform) fail(`the platform was not emulated: ${said}`);
        await tab.waitForFunction(() => document.querySelectorAll('kbd[data-sf-shortcut] > kbd').length >= 6
          && Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 30000})
          .catch(() => fail('the combinations were never filled with the kbd sheet'));
        await tab.evaluate(() => document.fonts.ready);

        // Added after the page loaded.
        await tab.evaluate((html) => { document.getElementById('later').innerHTML = `<p>${html}</p>`; }, TEXT[lang].late);
        await tab.waitForFunction(() => document.querySelectorAll('#k-late > kbd').length >= 2, null, {timeout: 5000})
          .catch(() => fail('a combination added later was not filled'));
        await tab.waitForTimeout(200);
        const m = await tab.evaluate(READ);
        const want = EXPECT[platform];
        for (const key of ['search', 'redo', 'enter', 'up', 'esc', 'late']) {
          const got = m[key];
          if (!got) { fail(`${key}: missing`); continue; }
          if (!got.group) fail(`${key}: not a group`);
          if (JSON.stringify(got.caps) !== JSON.stringify(want.caps[key])) fail(`${key}: caps ${JSON.stringify(got.caps)}, want ${JSON.stringify(want.caps[key])}`);
          if (!got.hidden) fail(`${key}: a cap is not hidden from the reader`);
          if (got.words !== want[lang][key]) fail(`${key}: words «${got.words}», want «${want[lang][key]}»`);
          if (!got.wordsBox || got.wordsBox[0] > 1 || got.wordsBox[1] > 1) fail(`${key}: the words take room ${JSON.stringify(got.wordsBox)}`);
          got.caps.forEach((cap, at) => { if (got.square[at] !== ([...cap].length === 1)) fail(`${key}: cap ${cap} square ${got.square[at]}`); });
          if (got.joins.some((display) => display !== 'none')) fail(`${key}: a + is drawn in running text`);
          if (got.shown !== want.caps[key].join('')) fail(`${key}: shown «${got.shown}»`);
        }
        // The same size as the same caps written by hand.
        const hand = platform === 'mac' ? m.handMac : m.handWin;
        if (!near(m.search.width, hand.width) || !near(m.search.height, hand.height)) fail(`search group ${m.search.width}x${m.search.height}, by hand ${hand.width}x${hand.height}`);
        if (JSON.stringify(m.search.capSizes) !== JSON.stringify(hand.capSizes)) fail(`search caps ${JSON.stringify(m.search.capSizes)}, by hand ${JSON.stringify(hand.capSizes)}`);
        // In a tooltip the glyphs are plain and Windows words are joined.
        if (JSON.stringify(m.tip.caps) !== JSON.stringify(want.caps.tip)) fail(`tip caps ${JSON.stringify(m.tip.caps)}`);
        if (m.tip.shown !== want.tipShown) fail(`tip shown «${m.tip.shown}», want «${want.tipShown}»`);
        if (m.overflow > 0) fail(`horizontal overflow ${m.overflow}`);

        // What a screen reader reads (the browser's own accessibility tree):
        // the words once, never the glyphs.
        const tree = await heard(cdp, '#search');
        const sentence = lang === 'ru' ? `Нажмите ${want[lang].search}, чтобы открыть поиск.` : `Press ${want[lang].search} to open search.`;
        if (tree !== sentence) fail(`the reader hears «${tree}», want «${sentence}»`);
        const keysTree = await heard(cdp, '#keys');
        for (const word of [want[lang].enter, want[lang].up, want[lang].esc]) if (!keysTree.includes(word)) fail(`the reader does not hear «${word}»: ${JSON.stringify(keysTree)}`);
        if (/[⌘⇧↵↑]/u.test(tree + keysTree)) fail(`the reader hears a glyph: ${JSON.stringify(tree + keysTree)}`);

        // A changed value is filled again.
        await tab.evaluate(() => document.getElementById('k-search').setAttribute('data-sf-shortcut', 'mod+shift+p'));
        await tab.waitForTimeout(100);
        const changed = await tab.evaluate(() => Array.from(document.querySelectorAll('#k-search > kbd')).map((cap) => cap.textContent));
        const wantChanged = platform === 'mac' ? ['⇧', '⌘', 'P'] : ['Ctrl', 'Shift', 'P'];
        if (JSON.stringify(changed) !== JSON.stringify(wantChanged)) fail(`changed value ${JSON.stringify(changed)}`);

        // The page's language chosen later changes the words.
        const other = lang === 'ru' ? 'en' : 'ru';
        await tab.evaluate((value) => globalThis.SF.language.use(value), other);
        await tab.waitForTimeout(100);
        const enterWord = await tab.evaluate(() => document.querySelector('#k-enter > .sf-kbd-spoken')?.textContent);
        if (enterWord !== EXPECT[platform][other].enter) fail(`after SF.language.use('${other}') «${enterWord}»`);

        if (evidence) await tab.screenshot({path: join(evidence, `kbd-shortcut-${name}.png`), fullPage: true});
        if (errors.length) fail(`console ${JSON.stringify(errors)}`);
        rows.push({name, search: m.search.caps.join(' '), words: m.search.words, enter: m.enter.words, size: `${m.search.width}x${m.search.height}`, hand: `${hand.width}x${hand.height}`});
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.table(rows);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`kbd shortcut text: ${rows.length} pages, every combination filled, heard once in the page's language`);
