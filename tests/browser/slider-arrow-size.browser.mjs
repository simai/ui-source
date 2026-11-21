#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Slider arrows are the size ladder's (DEV msg-dbd460e3, CAR-1; owner: 40 on
// a desktop, 36 on a phone, 32 compact). Every arrow of the carousel stand's
// cases -- pictures, autoplay, cards, a counter, thumbnails, a long thumbnail
// strip, a loop, a recipe row and the class markup -- measured by its layout
// box (offsetWidth: a picture's hidden arrow rests at scale 0.9, so its screen
// box is 36 of 40 until it is shown) and, for a picture's next arrow, by its
// screen box when the pointer reveals it. 1440 and 390 (a touch phone: the
// arrows always shown), normal and compact, light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const pic = (i) => `<img slot="slide" src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="hsl(${i * 47} 40% 45%)"/></svg>`)}" alt="Снимок ${i + 1}" style="display:block;inline-size:100%;block-size:100%;object-fit:cover">`;
const pics = (n) => Array.from({length: n}, (_, i) => pic(i)).join('');
const cards = (n) => Array.from({length: n}, (_, i) => `<article slot="slide" style="padding:24px;background:var(--sf-surface-container);border-radius:12px">Карточка ${i + 1}</article>`).join('');
const CASES = [
  `<sf-slider id="s-pic" aria-label="Снимки" ratio="16/9">${pics(5)}</sf-slider>`,
  `<sf-slider id="s-auto" aria-label="По очереди" ratio="16/9" data-autoplay="true" data-autoplay-delay="5000">${pics(5)}</sf-slider>`,
  `<sf-slider id="s-cards" aria-label="Карточки" root-class="sf-slider--content">${cards(6)}</sf-slider>`,
  `<sf-slider id="s-count" aria-label="Двенадцать" ratio="16/9">${pics(12)}</sf-slider>`,
  `<sf-slider id="s-thumbs" aria-label="С миниатюрами" ratio="16/9" thumbs>${pics(6)}</sf-slider>`,
  `<sf-slider id="s-thumbs-long" aria-label="Много миниатюр" ratio="16/9" thumbs>${pics(16)}</sf-slider>`,
  `<sf-slider id="s-loop" aria-label="По кругу" ratio="16/9" loop>${pics(4)}</sf-slider>`,
  `<sf-slider id="s-recipe" aria-label="Список" root-class="sf-slider--content">${cards(5)}</sf-slider>`,
];
const BODY = (density) => `<main ${density === 'compact' ? 'data-sf-density="compact"' : ''} style="display:flex;flex-direction:column;gap:24px">${CASES.join('')}</main>`;
const EXPECT = {'1440 normal': 40, '1440 compact': 32, '390 normal': 36, '390 compact': 36};

const READ = () => [...document.querySelectorAll('.sf-slider-arrows .sf-icon-button')].map((node) => ({
  slider: node.closest('sf-slider')?.id, layout: node.offsetWidth, layoutHeight: node.offsetHeight, size: (node.className.match(/sf-icon-button--size-\S+/u) || [''])[0],
}));

const evidence = {};
for (const [width, touch] of [[1440, false], [390, true]]) for (const theme of ['light', 'dark']) for (const density of ['normal', 'compact']) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} ${density} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', hasTouch: touch, isMobile: touch});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY(density)})));
    await tab.waitForFunction((count) => document.querySelectorAll('.sf-slider-arrows .sf-icon-button').length >= count * 2, CASES.length, {timeout: 20_000});
    await tab.waitForTimeout(800);
    const arrows = await tab.evaluate(READ);
    const expect = EXPECT[`${width} ${density}`];
    ok(`${at}: all ${arrows.length} arrows are ${expect} (layout box)`, arrows.length >= 16 && arrows.every((arrow) => arrow.layout === expect && arrow.layoutHeight === expect), arrows.filter((arrow) => arrow.layout !== expect));
    let shown = null;
    if (!touch) {
      await tab.hover('#s-pic');
      await tab.waitForTimeout(700);
    }
    shown = await tab.evaluate(() => { const next = document.querySelector('#s-pic .sf-slider-button-next'); const r = next.getBoundingClientRect(); return {w: Math.round(r.width), opacity: getComputedStyle(next).opacity}; });
    ok(`${at}: a picture's next arrow is ${expect} on screen when shown`, shown.w === expect && shown.opacity === '1', shown);
    evidence[at] = {arrows: arrows.length, sizes: [...new Set(arrows.map((arrow) => arrow.layout))], shown};
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
