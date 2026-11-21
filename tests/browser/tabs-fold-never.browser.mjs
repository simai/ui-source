#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-tabs fold (owner remark VR11-1, view round 11 order 1, group build 16
// G9): vertical tabs in a 688 px place (below 44rem, the h1 step) fold into
// the line with «Ещё» under fold="auto" (the default, C181 (2)) and stay the
// vertical list under fold="never". The attribute is a setting of the element
// (sf-view-properties feature-checks 'fold' in its props), and writing it
// later changes the look at once: never -> auto folds, auto -> never unfolds.
// 1440 and 390 (the place is narrow at both), light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const items = JSON.stringify([{id: 'main', label: 'Основное'}, {id: 'people', label: 'Люди'}, {id: 'files', label: 'Файлы'}, {id: 'history', label: 'История'}]);
const place = (id, fold) => `<div class="place" style="inline-size:min(688px, 100%);box-sizing:border-box;display:flex;gap:16px">
  <sf-tabs id="${id}" type="vertical" ${fold === null ? '' : `fold="${fold}"`} aria-label="Разделы" items='${items}'></sf-tabs>
  <div style="flex:1 1 0;min-inline-size:0">Содержимое</div>
</div>`;
const BODY = `<main style="display:flex;flex-direction:column;gap:16px">${place('never', 'never')}${place('auto', 'auto')}${place('plain', null)}${place('late', 'never')}</main>`;

const READ = () => Object.fromEntries(['never', 'auto', 'plain', 'late'].map((id) => {
  const root = document.querySelector(`#${id} > .sf-tabs`);
  return [id, {
    vertical: root?.classList.contains('sf-tabs--vertical') ?? null,
    folded: root?.classList.contains('sf-tabs--underline') ?? null,
    place: Math.round(document.getElementById(id).parentElement.getBoundingClientRect().width),
  }];
}));

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => customElements.get('sf-tabs') && ['never', 'auto', 'plain', 'late'].every((id) => document.querySelector(`#${id} > .sf-tabs`)), null, {timeout: 20_000});
    await tab.waitForTimeout(400);
    const first = await tab.evaluate(READ);
    const props = await tab.evaluate(() => 'fold' in (customElements.get('sf-tabs').props ?? {}));
    ok(`${at}: fold is a setting of sf-tabs (props)`, props, props);
    ok(`${at}: the place is below 44rem (${first.never.place} px)`, first.never.place < 704, first);
    ok(`${at}: fold="never" keeps the vertical list`, first.never.vertical === true && first.never.folded === false, first.never);
    ok(`${at}: fold="auto" folds into the line`, first.auto.folded === true && first.auto.vertical === false, first.auto);
    ok(`${at}: no fold is auto and folds`, first.plain.folded === true, first.plain);
    // Written later: never -> auto folds, then auto -> never unfolds.
    await tab.evaluate(() => document.getElementById('late').setAttribute('fold', 'auto'));
    await tab.waitForTimeout(300);
    const folded = (await tab.evaluate(READ)).late;
    await tab.evaluate(() => { document.getElementById('late').fold = 'never'; });
    await tab.waitForTimeout(300);
    const unfolded = (await tab.evaluate(READ)).late;
    ok(`${at}: fold written auto later folds at once`, folded.folded === true, folded);
    ok(`${at}: fold set never later unfolds at once`, unfolded.vertical === true, unfolded);
    evidence[at] = {first, folded, unfolded};
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
