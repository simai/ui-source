#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// .sf-procedure on the built sheets, light and dark, 1440, 1280 and 390 px,
// normal and compact density: the steps are numbered 1, 2, 3 by the sheet (no
// script) in round markers that equal the sf-steps number marker (owner
// decision C194, after C101 (3)): the same box (24 on a desktop, 20 on a phone
// and in compact density), the same edge width and radius, the same number
// size, an empty circle with no fill; the title stands centred on its marker; a line runs
// from under each marker to the next step, none after the last, however tall
// a step's content is; the content's blocks stand one text gap apart; the
// complete marker is filled with primary, the current one ringed;
// sf-procedure--list draws no line; long code scrolls inside its step and
// the page never scrolls sideways.
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const sheets = ['core/core/css/core.css', 'component/component/procedure/css/procedure.css', 'component/component/step/css/step.css'].map((path) => readFileSync(join(out, path), 'utf8'));
const html = `<ol class="sf-procedure" id="steps">
  <li class="sf-procedure-step sf-procedure-step--complete"><div class="sf-procedure-title">Install</div><div class="sf-procedure-content"><p id="p1">Add the package.</p><p id="p2">Then check the version.</p></div></li>
  <li class="sf-procedure-step sf-procedure-step--current" aria-current="step"><div class="sf-procedure-title">Configure</div><div class="sf-procedure-content"><p>Write the settings:</p><pre style="overflow:auto;margin:0"><code>${'{"theme": "auto", "density": "compact"} '.repeat(6)}</code></pre><ul><li>One</li><li>Two</li></ul></div></li>
  <li class="sf-procedure-step"><div class="sf-procedure-title">Publish</div></li>
</ol>
<ol class="sf-procedure sf-procedure--list" id="list" style="margin-top:24px"><li class="sf-procedure-step"><div class="sf-procedure-content"><p>Only content.</p></div></li><li class="sf-procedure-step"><div class="sf-procedure-content"><p>Two.</p></div></li></ol>
<div class="sf-steps sf-steps--marker-number sf-steps--layout-row" id="ref" style="margin-top:24px"><ol class="sf-steps-container" role="list"><li class="sf-step sf-step--state-ahead"><span class="sf-step-body"><span class="sf-step-marker" aria-hidden="true">1</span><span class="sf-step-content"><span class="sf-step-container">Ahead</span></span></span></li></ol></div>`;
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [width, density] of [[1440, 'normal'], [1440, 'compact'], [1280, 'normal'], [390, 'normal'], [390, 'compact']]) {
      const where = `${theme} ${width} ${density}`;
      const page = await browser.newPage({viewport: {width, height: 900}});
      await page.setContent(`<!doctype html><html lang="en" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"></head><body style="margin:16px">${html}</body></html>`);
      for (const content of sheets) await page.addStyleTag({content});
      const state = await page.evaluate(() => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const resolve = (property, value) => { probe.style.cssText = `${property}:${value}`; return getComputedStyle(probe)[property]; };
        const steps = [...document.querySelectorAll('#steps > .sf-procedure-step')];
        const markers = steps.map((step) => {
          const before = getComputedStyle(step, '::before');
          const after = getComputedStyle(step, '::after');
          const rect = step.getBoundingClientRect();
          const title = step.querySelector('.sf-procedure-title').getBoundingClientRect();
          const markerSize = parseFloat(before.height);
          return {
            content: before.content, size: before.height, width: before.width, radius: before.borderTopLeftRadius,
            border: before.borderTopWidth, edge: before.borderTopStyle, fontSize: before.fontSize,
            background: before.backgroundColor, shadow: before.boxShadow,
            titleCentre: Math.abs((title.top + title.height / 2) - (rect.top + markerSize / 2)),
            line: after.content === 'none' || after.content === 'normal' ? null : {top: rect.top + parseFloat(after.top), bottom: rect.bottom - parseFloat(after.bottom), width: after.width},
            top: rect.top, markerBottom: rect.top + markerSize,
          };
        });
        const p1 = document.getElementById('p1').getBoundingClientRect();
        const p2 = document.getElementById('p2').getBoundingClientRect();
        // The numbers the counter writes: read through a copy of the content
        // into a probe's text (CSS counters do not surface in the DOM).
        const counters = steps.map((step, index) => getComputedStyle(step).counterIncrement);
        const ref = getComputedStyle(document.querySelector('#ref .sf-step-marker'));
        const refBox = document.querySelector('#ref .sf-step-marker').getBoundingClientRect();
        return {
          markers,
          counters,
          steps: {size: ref.height, width: ref.width, box: [refBox.width, refBox.height], radius: ref.borderTopLeftRadius, border: ref.borderTopWidth, edge: ref.borderTopStyle, fontSize: ref.fontSize},
          line: resolve('height', 'var(--sf-text-height-1)'),
          primary: resolve('background-color', 'var(--sf-primary)'),
          gap: Math.round(p2.top - p1.bottom), textGap: parseFloat(resolve('width', 'var(--sf-content--space-text)')),
          listLines: [...document.querySelectorAll('#list > .sf-procedure-step')].map((step) => getComputedStyle(step, '::after').content),
          listStyle: getComputedStyle(document.getElementById('steps')).listStyleType,
          scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        };
      });
      seen[where] = state;
      const check = (ok, said) => { if (!ok) failures.push({where, said, state}); };
      const [first, second, third] = state.markers;
      check(state.markers.every((marker) => marker.content === 'counter(sf-procedure)') && state.counters.every((value) => value === 'sf-procedure 1'), 'each step is counted and its marker shows the count');
      check(state.listStyle === 'none', 'the list\'s own markers are off');
      check(state.markers.every((marker) => marker.size === state.line && marker.width === state.line && marker.radius !== '0px'), 'round markers of the body text line height');
      check(state.markers.every((marker) => marker.size === state.steps.size && marker.width === state.steps.width && marker.radius === state.steps.radius && marker.border === state.steps.border && marker.fontSize === state.steps.fontSize), 'the marker box equals the sf-steps number marker: size, edge width, radius, number size');
      check(state.steps.box[0] === parseFloat(state.line) && state.steps.box[1] === parseFloat(state.line), 'the sf-steps reference marker is drawn at the text line');
      check(state.line === (width <= 767 || density === 'compact' ? '20px' : '24px'), 'the marker is 24 on a desktop, 20 on a phone and in compact density');
      check(third.background === 'rgba(0, 0, 0, 0)' && third.border === '1px' && third.edge === 'solid', 'a neutral marker is an empty circle with a thin edge');
      check(state.markers.every((marker) => marker.titleCentre <= 1), 'the title stands centred on its marker');
      check(first.line && second.line && third.line === null, 'a line after every marker but the last');
      for (const [index, marker] of [[0, first], [1, second]]) {
        const next = state.markers[index + 1];
        check(marker.line && marker.line.top >= marker.markerBottom && marker.line.top - marker.markerBottom <= 4 && next.top - marker.line.bottom >= 0 && next.top - marker.line.bottom <= 4, `line ${index + 1} runs from under its marker to the next step`);
      }
      check(Math.abs(state.gap - state.textGap) <= 1, 'the content\'s blocks stand one text gap apart');
      check(first.background === state.primary, 'a complete marker is filled with primary');
      check(second.shadow !== 'none', 'the current marker is ringed');
      check(state.listLines.every((content) => content === 'none'), 'sf-procedure--list draws no line');
      check(state.scrollWidth <= state.viewport, 'nothing wider than the window');
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(seen).map(([where, state]) => [where, {procedure: state.markers.map(({size, width, radius, border, fontSize, background}) => ({size, width, radius, border, fontSize, background})), steps: state.steps}]))));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PROCEDURE_OK');
