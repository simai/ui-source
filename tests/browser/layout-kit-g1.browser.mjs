#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The Docara layout kit (owner 2026-11-21, DEV msg-ce867783; group build 16
// G1), the recipe the docs give, at 1440, 1024 and 390, light and dark:
// - a half centred in twelve columns: query-container > grid grid-col-12 >
//   col-span-12 cq-md:col-span-6 cq-md:col-start-4 -- centred where the
//   container is md or wider, the whole row below;
// - a hero's scene before its text where the block is wide: cq-lg:order-first
//   on the scene, written after the text;
// - measure-44 is max-width var(--sf-measure-44), md:measure-28 from md up.
// Loaded by the Loader from the classes alone (no sheet links but core).
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const BODY = `<main>
  <section class="query-container" id="half-box">
    <div class="grid grid-col-12 gap-1">
      <div id="half" class="col-span-12 cq-md:col-span-6 cq-md:col-start-4" style="background:var(--sf-surface-container)">Половина по центру</div>
    </div>
  </section>
  <section class="query-container" id="hero-box" style="margin-block-start:16px">
    <div class="flex flex-col cq-lg:flex-row gap-1">
      <div id="hero-text">Текст героя</div>
      <div id="hero-scene" class="cq-lg:order-first" style="min-block-size:40px;background:var(--sf-surface-container)">Сцена</div>
    </div>
  </section>
  <p id="m44" class="measure-44">Текст шириной в сорок четыре знака.</p>
  <p id="m28" class="measure-44 md:measure-28">Текст шириной в двадцать восемь знаков.</p>
</main>`;

const READ = () => {
  const box = (id) => document.getElementById(id).getBoundingClientRect();
  const token = (name) => { const probe = document.createElement('div'); probe.style.inlineSize = `var(${name})`; document.body.append(probe); const width = probe.getBoundingClientRect().width; probe.remove(); return width; };
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return {
    container: box('half-box').width, half: {left: box('half').left - box('half-box').left, width: box('half').width},
    sceneFirst: box('hero-scene').left < box('hero-text').left || box('hero-scene').top < box('hero-text').top,
    sceneLeft: box('hero-scene').left < box('hero-text').left,
    m44: getComputedStyle(document.getElementById('m44')).maxWidth, m44px: box('m44').width, t44: token('--sf-measure-44'),
    m28: getComputedStyle(document.getElementById('m28')).maxWidth, t28: token('--sf-measure-28'),
    md: 44 * rem, lg: 60 * rem, window: innerWidth,
  };
};

const evidence = {};
for (const width of [1440, 1024, 390]) {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= LOADS; load += 1) {
      const at = `${width} ${theme} #${load}`;
      const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
      const tab = await context.newPage();
      const errors = watchConsole(tab);
      await tab.goto(server.page(russianPage({theme, body: BODY})));
      await tab.waitForFunction(() => getComputedStyle(document.getElementById('m44')).maxWidth !== 'none'
        && getComputedStyle(document.getElementById('half')).gridColumnEnd !== 'auto', null, {timeout: 20_000}).catch(() => {});
      await tab.waitForTimeout(400);
      const read = await tab.evaluate(READ);
      evidence[at] = read;
      // md is 44rem (704), lg 60rem (960): core/scss/vars/_sf_var__breakpoint.scss.
      if (read.container >= read.md) {
        // Centred: the half starts at column 4 and leaves as much on each side.
        ok(`${at}: the half is centred in twelve columns (start 4, span 6)`, near(read.half.left, read.container - read.half.left - read.half.width, 1.5) && read.half.width < read.container * 0.6, read);
      } else {
        ok(`${at}: below md the half is the whole row`, near(read.half.width, read.container) && near(read.half.left, 0), read);
      }
      if (read.container >= read.lg) ok(`${at}: the hero's scene stands before its text where the block is lg`, read.sceneLeft === true, read);
      else ok(`${at}: below lg the scene stays after the text`, read.sceneFirst === false, read);
      ok(`${at}: measure-44 is the ladder's step`, read.m44 !== 'none' && near(parseFloat(read.m44), read.t44, 0.5), read);
      if (width >= read.md) ok(`${at}: md:measure-28 takes over from md`, near(parseFloat(read.m28), read.t28, 0.5), read);
      else ok(`${at}: below md measure-44 stays`, near(parseFloat(read.m28), read.t44, 0.5), read);
      ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
      await context.close();
    }
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
