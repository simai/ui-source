#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-contents on the built bytes.
//
// 1280 px, layout auto (a column): the h2 and h3 of the target are collected in
// order, the h3 a level deeper; the first section is current at the top
// (aria-current="location"); scrolling makes the section under the top of the
// window current, sends sf-contents-change and writes the hash; at the end of
// the page the last section is current; a chosen link scrolls (smoothly, and
// instantly under reduced motion), focuses its section and marks it; Tab
// reaches the links; the column stays in view (sticky). Geometry: each row is
// the 1/2 text line plus a space-1/4 inset above and below, the label and the
// links start on one axis, the current bar is a2 wide on the 1 px line.
//
// 375 px, the same element: compact. Scrolled, the button stays in view on an
// opaque band, and sticky="false" lets it scroll away (1.1.0). The button names the current section,
// opens and closes the list (aria-expanded, data-open), Escape gives focus
// back, a row of the open list is the 1/2 control height, the progress line
// follows the scroll.
//
// rail and bar: strokes of three lengths, names hidden until hover; a row of
// tabs with the current one underlined.
//
// First paint: the drawn markup printed as static markup on a page without
// any script shows the same list in the same box, at 1280 and at 375.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SECTIONS = [['intro', 'Введение', 2], ['install', 'Подключение', 2], ['cdn', 'Через CDN', 3], ['npm', 'Через npm', 3], ['settings', 'Настройки', 2], ['events', 'События', 2], ['a11y', 'Доступность', 2]];
const paragraph = '<p>Компонент берёт данные из манифеста, рисует начальный вид без кода и оживает, когда код загрузится. Размеры идут по одной шкале, цвета — по ролям темы.</p>';
const article = SECTIONS.map(([id, text, level]) => `<h${level} id="${id}">${text}</h${level}>${paragraph.repeat(6)}`).join('');
const STYLE = '<style>body{margin:0}.page{display:grid;grid-template-columns:minmax(0,1fr) 14rem;gap:24px;max-width:1100px;margin:0 auto;padding:16px}'
  + '@media (max-width:59.99rem){.page{grid-template-columns:minmax(0,1fr)}.page aside{order:-1}}</style>';
const head = (scripts) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
${scripts ? '<script>window.sfPath=\'/distr/\';window.sfSmartPath=\'/distr/\';</script>' : ''}
<link rel="stylesheet" href="/distr/core/css/core.css">
${scripts ? '<script src="/distr/core/js/core.js"></script>' : ''}${STYLE}`;
const page = () => `${head(true)}</head><body>
<div class="page"><article id="article">${article}</article><aside><sf-contents id="toc" target="#article"></sf-contents></aside></div>
<div style="padding:16px;display:flex;gap:48px;align-items:start">
  <div style="position:relative;padding-inline-start:160px"><sf-contents id="rail" layout="rail" sticky="false" hash="false"><a href="#r1">Первый раздел</a><a href="#r2" data-level="3">Второй</a><a href="#r3">Третий</a></sf-contents></div>
  <div style="inline-size:320px"><sf-contents id="bar" layout="bar" sticky="false" hash="false"><a href="#b1">Основное</a><a href="#b2">Доступ</a><a href="#b3">Уведомления</a></sf-contents></div>
</div>
</body></html>`;
// The first paint: the element's drawn markup, printed as a server prints
// it, with the sheets and no script at all.
let printed = '';
const staticPage = () => `${head(false)}
<link rel="stylesheet" href="/distr/component/buttons/css/buttons.min.css">
<link rel="stylesheet" href="/distr/component/icons/css/icons.min.css">
<link rel="stylesheet" href="/distr/smart/contents/css/contents.min.css">
<link rel="stylesheet" href="/distr/utility/width/default/css/default.min.css">
<link rel="stylesheet" href="/distr/utility/display/default/css/default.min.css">
<link rel="stylesheet" href="/distr/utility/flex/default/css/default.min.css">
<link rel="stylesheet" href="/distr/utility/align-items/default/css/default.min.css">
<link rel="stylesheet" href="/distr/utility/text-align/default/css/default.min.css">
<link rel="stylesheet" href="/distr/utility/pointer-events/default/css/default.min.css">
</head><body>
<div class="page"><article id="article">${article}</article><aside><sf-contents id="toc" target="#article" style="display: contents">${printed}</sf-contents></aside></div>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/page' || path === '/static') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(path === '/page' ? page() : staticPage());
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
const near = (a, b) => Math.abs(a - b) <= 0.5;
const ready = (tab, selector) => tab.waitForFunction((s) => customElements.get('sf-contents') && document.querySelectorAll(`${s} .sf-contents-link`).length > 0, selector, {timeout: 20000});
const settle = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50)))));
const current = (tab, selector = '#toc') => tab.evaluate((s) => ({
  value: document.querySelector(s).current,
  marked: Array.from(document.querySelectorAll(`${s} [aria-current="location"]`)).map((a) => a.getAttribute('href')),
}), selector);
// The box of the element's nav and of each link, for the first-paint check.
const boxes = (tab) => tab.evaluate(() => {
  const nav = document.querySelector('#toc nav.sf-contents');
  const rect = (node) => {
    const r = node.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 100) / 100);
  };
  return {
    nav: nav ? rect(nav) : null,
    links: Array.from(document.querySelectorAll('#toc .sf-contents-link')).filter((a) => a.getClientRects().length).map(rect),
    head: Array.from(document.querySelectorAll('#toc .sf-contents-head')).filter((a) => a.getClientRects().length).map(rect),
  };
});

const browser = await chromium.launch();
try {
  // 1280: the column.
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
    await tab.emulateMedia({reducedMotion: 'no-preference'});
    await tab.goto(url('/page'));
    await ready(tab, '#toc').catch(() => failures.push('1280: the contents never drew a link'));
    await tab.evaluate(() => document.fonts.ready);
    await settle(tab);
    const collected = await tab.evaluate(() => ({
      label: document.querySelector('#toc nav')?.getAttribute('aria-label'),
      navs: document.querySelectorAll('#toc nav').length,
      links: Array.from(document.querySelectorAll('#toc .sf-contents-link')).map((a) => [a.getAttribute('href'), a.textContent.trim(), a.closest('li').dataset.depth]),
      head: document.querySelector('#toc .sf-contents-head')?.getClientRects().length ?? -1,
      compact: document.querySelector('#toc').hasAttribute('data-compact'),
    }));
    seen.collected = collected;
    const expected = SECTIONS.map(([id, text, level]) => [`#${id}`, text, String(level - 2)]);
    if (JSON.stringify(collected.links) !== JSON.stringify(expected)) failures.push(`1280: collected ${JSON.stringify(collected.links)}`);
    if (collected.label !== 'На этой странице' || collected.navs !== 1) failures.push(`1280: ${collected.navs} nav named ${collected.label}`);
    if (collected.head !== 0 || collected.compact) failures.push('1280: the compact button is shown in the column');
    const top = await current(tab);
    seen.atTop = top;
    if (top.value !== 'intro' || JSON.stringify(top.marked) !== '["#intro"]') failures.push(`1280: at the top the current is ${JSON.stringify(top)}`);

    // Geometry of the column.
    const geometry = await tab.evaluate(() => {
      const nav = document.querySelector('#toc nav');
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;display:block;block-size:calc(var(--sf-text-height-1\\/2) + 2 * var(--sf-space-1\\/4))';
      nav.append(probe);
      const row = probe.getBoundingClientRect().height;
      probe.remove();
      const textStart = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects()[0]?.left ?? NaN;
      };
      const links = Array.from(nav.querySelectorAll('.sf-contents-link'));
      const list = nav.querySelector('.sf-contents-list');
      const line = getComputedStyle(list, '::after');
      const mark = nav.querySelector('[aria-current] .sf-contents-mark').getBoundingClientRect();
      return {
        row,
        heights: [...new Set(links.map((a) => a.getBoundingClientRect().height))],
        labelStart: textStart(nav.querySelector('.sf-contents-label')),
        topStart: textStart(links[0].querySelector('.sf-contents-text')),
        deepStart: textStart(links[2].querySelector('.sf-contents-text')),
        lineWidth: line.width,
        listLeft: list.getBoundingClientRect().left,
        mark: [mark.left, mark.width, mark.height, links[0].getBoundingClientRect().height],
        markColour: getComputedStyle(nav.querySelector('[aria-current] .sf-contents-mark')).backgroundColor,
        currentColour: getComputedStyle(nav.querySelector('[aria-current]')).color,
      };
    });
    seen.column = geometry;
    if (geometry.heights.length !== 1 || !near(geometry.heights[0], geometry.row)) failures.push(`1280: rows are ${geometry.heights}px, the 1/2 line and its inset make ${geometry.row}px`);
    if (!near(geometry.labelStart, geometry.topStart)) failures.push(`1280: the label starts at ${geometry.labelStart}, the links at ${geometry.topStart}`);
    if (!(geometry.deepStart > geometry.topStart + 1)) failures.push('1280: a deeper level is not indented');
    if (geometry.lineWidth !== '1px' || !near(geometry.mark[0], geometry.listLeft) || !near(geometry.mark[1], 2) || !near(geometry.mark[2], geometry.mark[3])) failures.push(`1280: the line or the current bar is off: ${JSON.stringify(geometry)}`);
    if (geometry.markColour !== geometry.currentColour) failures.push('1280: the current bar and the current link differ in colour');

    // Scrolling.
    await tab.evaluate(() => {
      window.__changes = [];
      document.addEventListener('sf-contents-change', (event) => { if (event.target.id === 'toc') window.__changes.push(event.detail); });
    });
    await tab.evaluate(() => window.scrollTo({top: document.getElementById('settings').getBoundingClientRect().top + window.scrollY, behavior: 'instant'}));
    await settle(tab);
    const scrolled = {...await current(tab), changes: await tab.evaluate(() => window.__changes), hash: await tab.evaluate(() => location.hash),
      sticky: await tab.evaluate(() => Math.round(document.querySelector('#toc nav').getBoundingClientRect().top))};
    seen.scrolled = scrolled;
    if (scrolled.value !== 'settings' || JSON.stringify(scrolled.marked) !== '["#settings"]') failures.push(`1280: scrolled to Настройки, the current is ${JSON.stringify(scrolled)}`);
    if (!scrolled.changes.length || scrolled.changes.at(-1).id !== 'settings') failures.push(`1280: no sf-contents-change for settings: ${JSON.stringify(scrolled.changes)}`);
    if (scrolled.hash !== '#settings') failures.push(`1280: the address shows ${scrolled.hash}`);
    if (scrolled.sticky !== 16) failures.push(`1280: the column stands at ${scrolled.sticky}px, not the sticky 16px`);
    await tab.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
    await settle(tab);
    const end = await current(tab);
    if (end.value !== 'a11y') failures.push(`1280: at the end the current is ${end.value}`);

    // A chosen link: smooth, focus on the section, marked at once.
    await tab.evaluate(() => {
      window.__behaviours = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function patched(options) { window.__behaviours.push(options?.behavior); return original.call(this, options); };
    });
    await tab.locator('#toc a[href="#cdn"]').click();
    const chosen = {...await current(tab), focus: await tab.evaluate(() => document.activeElement?.id)};
    await tab.waitForTimeout(1500);
    const landed = await tab.evaluate(() => Math.round(document.getElementById('cdn').getBoundingClientRect().top));
    seen.chosen = {...chosen, landed, behaviours: await tab.evaluate(() => window.__behaviours)};
    if (chosen.value !== 'cdn' || chosen.focus !== 'cdn') failures.push(`1280: a chosen link: ${JSON.stringify(chosen)}`);
    if (Math.abs(landed) > 1) failures.push(`1280: the chosen section landed at ${landed}px`);
    if (seen.chosen.behaviours[0] !== 'smooth') failures.push(`1280: the scroll was ${seen.chosen.behaviours[0]}, not smooth`);
    const after = await current(tab);
    if (after.value !== 'cdn') failures.push(`1280: after the scroll the current is ${after.value}`);
    await tab.emulateMedia({reducedMotion: 'reduce'});
    await tab.locator('#toc a[href="#events"]').click();
    const reduced = await tab.evaluate(() => ({behaviour: window.__behaviours.at(-1), top: Math.round(document.getElementById('events').getBoundingClientRect().top)}));
    await tab.waitForTimeout(400);
    reduced.after = (await current(tab)).value;
    seen.reduced = reduced;
    if (reduced.after !== 'events') failures.push(`1280: the chosen section did not stay current after its scroll: ${reduced.after}`);
    if (reduced.behaviour !== 'instant' || Math.abs(reduced.top) > 1) failures.push(`1280: under reduced motion the scroll was ${JSON.stringify(reduced)}`);

    // The keyboard: Tab from the top of the page reaches the first link;
    // Enter takes focus to its section.
    await tab.evaluate(() => { window.scrollTo({top: 0, behavior: 'instant'}); document.activeElement?.blur(); });
    await tab.keyboard.press('Tab');
    const firstTab = await tab.evaluate(() => document.activeElement?.getAttribute('href'));
    await tab.keyboard.press('Enter');
    const entered = await tab.evaluate(() => document.activeElement?.id);
    seen.keyboard = {firstTab, entered};
    if (firstTab !== '#intro' || entered !== 'intro') failures.push(`1280: keyboard: Tab reached ${firstTab}, Enter focused ${entered}`);

    // rail and bar.
    const others = await tab.evaluate(() => {
      const strokes = Array.from(document.querySelectorAll('#rail .sf-contents-mark')).map((m) => Math.round(m.getBoundingClientRect().width));
      const names = Array.from(document.querySelectorAll('#rail .sf-contents-text')).map((t) => getComputedStyle(t).opacity);
      const tabs = Array.from(document.querySelectorAll('#bar .sf-contents-link')).map((a) => Math.round(a.getBoundingClientRect().top));
      const under = document.querySelector('#bar [aria-current] .sf-contents-mark').getBoundingClientRect();
      return {strokes, names, tabs, under: Math.round(under.height), railName: document.querySelector('#rail .sf-contents-link').textContent.trim()};
    });
    await tab.locator('#rail .sf-contents-link').first().hover();
    await tab.waitForTimeout(300);
    others.hovered = await tab.evaluate(() => Array.from(document.querySelectorAll('#rail .sf-contents-text')).map((t) => getComputedStyle(t).opacity));
    seen.others = others;
    const px = await tab.evaluate(() => {
      const p = document.createElement('span');
      p.style.cssText = 'position:absolute;display:block;inline-size:var(--sf-space-1);block-size:var(--sf-space-3)';
      document.body.append(p);
      const r = p.getBoundingClientRect();
      p.style.inlineSize = 'var(--sf-space-1\\/2)';
      const half = p.getBoundingClientRect().width;
      p.remove();
      return [r.width, half, r.height];
    });
    if (JSON.stringify(others.strokes) !== JSON.stringify([px[2], px[1], px[0]])) failures.push(`rail: strokes ${others.strokes}, expected current ${px[2]}, deeper ${px[1]}, ${px[0]}`);
    if (others.names.some((o) => o !== '0') || others.hovered.some((o) => o !== '1')) failures.push(`rail: names ${others.names} at rest, ${others.hovered} on hover`);
    if (others.railName !== 'Первый раздел') failures.push('rail: the hidden name is not the link\'s text');
    if (new Set(others.tabs).size !== 1 || others.under !== 2) failures.push(`bar: tabs at ${others.tabs}, underline ${others.under}px`);

    // The printed first paint: the markup drawn at the top of the page.
    await tab.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    await tab.emulateMedia({reducedMotion: 'reduce'});
    await tab.goto(url('/page'));
    await ready(tab, '#toc');
    await tab.evaluate(() => document.fonts.ready);
    await settle(tab);
    printed = await tab.evaluate(() => {
      const host = document.querySelector('#toc');
      const copy = host.cloneNode(true);
      Array.from(copy.children).forEach((child) => child.setAttribute('data-sf-static', ''));
      return copy.innerHTML;
    });
    seen.live1280 = await boxes(tab);
    await tab.close();
  }

  // 375: the same element, compact.
  {
    const tab = await browser.newPage({viewport: {width: 375, height: 700}});
    await tab.emulateMedia({reducedMotion: 'reduce'});
    await tab.goto(url('/page'));
    await ready(tab, '#toc').catch(() => failures.push('375: the contents never drew a link'));
    await tab.evaluate(() => document.fonts.ready);
    await settle(tab);
    const TOGGLE = '#toc .sf-contents-toggle button';
    const closed = await tab.evaluate((s) => {
      const b = document.querySelector(s);
      return {
        compact: document.querySelector('#toc').hasAttribute('data-compact'),
        shown: Boolean(b?.getClientRects().length),
        expanded: b?.getAttribute('aria-expanded'),
        name: b?.getAttribute('aria-label'),
        text: b?.textContent.replace(/\s+/gu, ' ').trim(),
        list: document.querySelector('#toc .sf-contents-list').getClientRects().length,
        label: document.querySelector('#toc .sf-contents-label').getClientRects().length,
        height: b?.getBoundingClientRect().height,
      };
    }, TOGGLE);
    seen.compactClosed = closed;
    if (!closed.compact || !closed.shown || closed.expanded !== 'false' || closed.list || closed.label) failures.push(`375: closed compact view: ${JSON.stringify(closed)}`);
    if (closed.name !== 'На этой странице: Введение' || !closed.text.includes('Введение')) failures.push(`375: the button says ${closed.text}, named ${closed.name}`);
    seen.live375 = await boxes(tab);

    await tab.locator(TOGGLE).click();
    await settle(tab);
    const open = await tab.evaluate((s) => {
      const b = document.querySelector(s);
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;display:block;block-size:var(--sf-ui-1\\/2--control-height)';
      document.body.append(probe);
      const row = probe.getBoundingClientRect().height;
      probe.remove();
      const list = document.querySelector('#toc .sf-contents-list');
      return {
        expanded: b.getAttribute('aria-expanded'),
        data: document.querySelector('#toc').getAttribute('data-open'),
        list: list.getClientRects().length,
        below: Math.round(list.getBoundingClientRect().top - b.getBoundingClientRect().bottom),
        rows: [...new Set(Array.from(list.querySelectorAll('.sf-contents-link')).map((a) => a.getBoundingClientRect().height))],
        row,
        buttonHeight: b.getBoundingClientRect().height,
      };
    }, TOGGLE);
    seen.compactOpen = open;
    if (open.expanded !== 'true' || open.data !== 'true' || !open.list) failures.push(`375: the list did not open: ${JSON.stringify(open)}`);
    if (open.rows.length !== 1 || !near(open.rows[0], open.row) || !near(open.buttonHeight, open.row)) failures.push(`375: open rows ${open.rows}px and the button ${open.buttonHeight}px, the 1/2 control height is ${open.row}px`);
    await tab.keyboard.press('Escape');
    await settle(tab);
    const escaped = await tab.evaluate((s) => ({
      expanded: document.querySelector(s).getAttribute('aria-expanded'),
      focus: document.activeElement === document.querySelector(s),
      list: document.querySelector('#toc .sf-contents-list').getClientRects().length,
    }), TOGGLE);
    seen.compactEscape = escaped;
    if (escaped.expanded !== 'false' || !escaped.focus || escaped.list) failures.push(`375: Escape: ${JSON.stringify(escaped)}`);

    // A section chosen in the open list closes it and becomes current; the
    // button then names it.
    await tab.locator(TOGGLE).click();
    await settle(tab);
    await tab.locator('#toc a[href="#events"]').click();
    await settle(tab);
    const picked = await tab.evaluate((s) => ({
      expanded: document.querySelector(s).getAttribute('aria-expanded'),
      current: document.querySelector('#toc').current,
      text: document.querySelector(s).textContent.replace(/\s+/gu, ' ').trim(),
      progress: Number(getComputedStyle(document.querySelector('#toc .sf-contents-progress-value')).getPropertyValue('--sf-contents--progress')),
      bar: document.querySelector('#toc .sf-contents-progress-value').getBoundingClientRect().width / document.querySelector('#toc .sf-contents-progress').getBoundingClientRect().width,
      scroll: window.scrollY / (document.documentElement.scrollHeight - innerHeight),
    }), TOGGLE);
    // Sticky (1.1.0): the page scrolls under the button, so it stays in view
    // with a band of the page's own surface behind it. Nothing of the article
    // may show through: the band is opaque and as wide as the element.
    await tab.evaluate(() => window.scrollTo(0, 1200));
    await settle(tab);
    const stuck = await tab.evaluate((s) => {
      const host = document.querySelector('#toc');
      const button = document.querySelector(s);
      const head = document.querySelector('#toc .sf-contents-head');
      const style = getComputedStyle(host);
      const box = host.getBoundingClientRect();
      return {position: style.position, top: Math.round(box.top), stops: Math.round(parseFloat(style.insetBlockStart)),
        fill: style.backgroundColor, width: Math.round(box.width), headWidth: Math.round(head.getBoundingClientRect().width),
        shown: Boolean(button?.getClientRects().length), covers: Math.round(box.bottom - button.getBoundingClientRect().bottom)};
    }, TOGGLE);
    seen.compactSticky = stuck;
    if (stuck.position !== 'sticky' || stuck.top !== stuck.stops || !stuck.shown) failures.push(`375: the scrolled compact button is ${JSON.stringify(stuck)}`);
    if (!/^rgb\(/u.test(stuck.fill)) failures.push(`375: the sticky button's band is ${stuck.fill}, not an opaque fill`);
    if (stuck.width < stuck.headWidth || stuck.covers < 4) failures.push(`375: the band does not cover the head: ${JSON.stringify(stuck)}`);
    // Without it the button scrolls away, as 1.0.0 drew it.
    await tab.evaluate(() => document.querySelector('#toc').setAttribute('sticky', 'false'));
    await settle(tab);
    const loose = await tab.evaluate(() => {
      const host = document.querySelector('#toc');
      return {position: getComputedStyle(host).position, top: Math.round(host.getBoundingClientRect().top), fill: getComputedStyle(host).backgroundColor};
    });
    seen.compactNotSticky = loose;
    if (loose.position !== 'relative' || loose.top > -100 || loose.fill !== 'rgba(0, 0, 0, 0)') failures.push(`375: sticky="false" still holds the button: ${JSON.stringify(loose)}`);
    await tab.evaluate(() => { document.querySelector('#toc').removeAttribute('sticky'); window.scrollTo(0, 0); });
    await settle(tab);

    seen.compactPicked = picked;
    if (picked.expanded !== 'false' || picked.current !== 'events' || !picked.text.includes('События')) failures.push(`375: a picked section: ${JSON.stringify(picked)}`);
    if (Math.abs(picked.bar - picked.scroll) > 0.02) failures.push(`375: the progress line reads ${picked.bar}, the page is scrolled ${picked.scroll}`);
    await tab.close();
  }

  // The first paint without any script, at both widths.
  for (const [width, live] of [[1280, 'live1280'], [375, 'live375']]) {
    const tab = await browser.newPage({viewport: {width, height: width === 1280 ? 800 : 700}});
    await tab.goto(url('/static'));
    await tab.evaluate(() => document.fonts.ready);
    await settle(tab);
    const first = await boxes(tab);
    const scripts = await tab.evaluate(() => typeof customElements.get('sf-contents'));
    seen[`static${width}`] = first;
    if (scripts !== 'undefined') failures.push(`${width}: the static page defined the element`);
    const same = JSON.stringify(first) === JSON.stringify(seen[live]);
    if (!same) failures.push(`${width}: the printed first paint differs from the drawn one: ${JSON.stringify(first)} vs ${JSON.stringify(seen[live])}`);
    if (width === 1280 && first.links.length !== SECTIONS.length) failures.push(`1280: the printed list shows ${first.links.length} links`);
    if (width === 375 && (first.links.length !== 0 || first.head.length !== 1)) failures.push('375: the printed compact view does not show its button alone');
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
