#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// A group of outline segments has one continuous frame (DEV return SEG-1,
// group build 16 G14; C393: a pressed toggle shows a fill and a frame). Groups
// of sf-icon-button and sf-button, --outline --on-surface, size 1, the
// pressed one (active, aria-pressed="true", as the docs' segments example)
// first, in the middle and last; a standalone pressed outline toggle of each.
// Every segment's top and bottom edge and its end edge are a non-transparent
// 1 px line, the first segment's start edge too (a join is the end edge of
// the segment before it); the pressed one still shows its fill. 1440 and 390,
// light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const POSITIONS = ['segment-start', 'segment-middle', 'segment-middle', 'segment-end'];
const icons = ['format_bold', 'format_italic', 'format_underlined', 'strikethrough_s'];
const iconGroup = (pressed) => `<div class="flex" data-group="icon-${pressed}">${POSITIONS.map((position, at) => `<button type="button" class="sf-icon-button sf-icon-button--outline sf-icon-button--on-surface sf-icon-button--icon sf-icon-button--size-1 ${position}${at === pressed ? ' active" aria-pressed="true' : '" aria-pressed="false'}" aria-label="${icons[at]}"><i class="sf-icon" aria-hidden="true">${icons[at]}</i></button>`).join('')}</div>`;
const buttonGroup = (pressed) => `<div class="flex" data-group="button-${pressed}">${POSITIONS.map((position, at) => `<button type="button" class="sf-button sf-button--outline sf-button--on-surface sf-button--size-1 ${position}${at === pressed ? ' active" aria-pressed="true' : '" aria-pressed="false'}"><span class="sf-button-text-container">Вид ${at + 1}</span></button>`).join('')}</div>`;
const GROUPS = [0, 1, 3].flatMap((pressed) => [iconGroup(pressed), buttonGroup(pressed)]);
const BODY = `<main style="display:flex;flex-direction:column;gap:16px;align-items:flex-start">${GROUPS.join('')}
  <div class="flex" style="gap:8px" data-group="alone"><button type="button" class="sf-icon-button sf-icon-button--outline sf-icon-button--on-surface sf-icon-button--icon sf-icon-button--size-1" aria-pressed="true" aria-label="Закрепить"><i class="sf-icon" aria-hidden="true">push_pin</i></button>
  <button type="button" class="sf-button sf-button--outline sf-button--on-surface sf-button--size-1" aria-pressed="true"><span class="sf-button-text-container">Закрепить</span></button></div></main>`;

const READ = () => [...document.querySelectorAll('[data-group]')].map((group) => ({
  group: group.dataset.group,
  segments: [...group.children].map((node) => {
    const style = getComputedStyle(node);
    const edge = (side) => ({width: parseFloat(style[`border${side}Width`]), color: style[`border${side}Color`], style: style[`border${side}Style`]});
    return {cls: node.className.match(/segment-\w+/u)?.[0] ?? 'alone', pressed: node.getAttribute('aria-pressed') === 'true',
      top: edge('Top'), bottom: edge('Bottom'), start: edge('Left'), end: edge('Right'), fill: style.backgroundColor};
  }),
}));
const seen = (edge) => edge.width >= 1 && edge.style !== 'none' && !/rgba\([^)]*,\s*0\)$|transparent/u.test(edge.color);

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => getComputedStyle(document.querySelector('.sf-icon-button')).borderTopStyle !== 'none', null, {timeout: 20_000}).catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(300);
    const groups = await tab.evaluate(READ);
    evidence[at] = groups;
    for (const {group, segments} of groups) {
      const gaps = [];
      segments.forEach((segment, index) => {
        for (const side of ['top', 'bottom', 'end']) if (!seen(segment[side])) gaps.push({index, side, ...segment[side], pressed: segment.pressed});
        if ((index === 0 || segment.cls === 'alone') && !seen(segment.start)) gaps.push({index, side: 'start', ...segment.start, pressed: segment.pressed});
      });
      ok(`${at} ${group}: the frame is continuous (every outer and join edge a 1 px line)`, gaps.length === 0, gaps);
      const pressed = segments.filter((segment) => segment.pressed);
      ok(`${at} ${group}: the pressed one shows its fill`, pressed.length >= 1 && pressed.every((segment) => !/rgba\([^)]*,\s*0\)$|transparent/u.test(segment.fill)), pressed);
    }
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
