#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// container-breakout and the width parameter set, on the built bytes, in a
// left-to-right and a right-to-left page, at 390, 800, 1100 and 1600px:
//   - a breakout inside a centred container spans the root's content box,
//     edge to edge, and a container inside it is centred again;
//   - the page never scrolls sideways, also when the root is narrower than
//     the viewport (a classic scrollbar, simulated: headless Chrome draws
//     overlay scrollbars) and when the breakout sits inside a size container;
//   - sticky and fixed elements keep their place while a breakout is on the
//     page (the root becomes a query container, with no layout containment);
//   - width (parameter-sets.mjs): narrow is a centred text measure, normal the
//     centred page container, wide a wider container from the desktop
//     breakpoint (max-container-7 on the block, the container its descendant),
//     full the whole width.
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css'];
const {render} = await import(pathToFileURL(resolve(import.meta.dirname, '../../src/core/js/composition/index.mjs')).href);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const text = (value) => [{type: 'text', value}];
// No space above and below (layout.section 1.2.0 prints p-y-8 unset): the
// sticky check scrolls to a fixed offset measured without it.
const section = (id, props, children) => ({id, type: 'layout.section', props: {padding_y: 0, ...props}, slots: {default: children || [{id: `${id}-p`, type: 'content.paragraph', data: {content: text('Lorem ipsum dolor sit amet. '.repeat(12))}}]}});
const {html} = await render({schema: 'simai.composition.document', schema_version: 1, id: 'probe', profile: 'ui-layout', root: {id: 'root', type: 'layout.page', slots: {default: [
  section('narrow', {width: 'narrow'}), section('normal', {width: 'normal'}), section('wide', {width: 'wide'}), section('full', {width: 'full'}),
  section('page', {width: 'normal'}, [section('band', {breakout: true, background: 'container', width: 'normal'})]),
]}}});

const browser = await chromium.launch();
try {
  for (const dir of ['ltr', 'rtl']) {
    for (const width of [390, 800, 1100, 1600]) {
      for (const scrollbar of [false, true]) {
        const label = `${dir} ${width}px${scrollbar ? ' root 17px narrower' : ''}`;
        const page = await browser.newPage({viewport: {width, height: 700}});
        await page.setContent(`<!doctype html><html dir="${dir}" class="theme-light"><head><meta charset="utf-8">${scrollbar ? '<style>html{margin-inline-end:17px}</style>' : ''}</head><body style="margin:0"><div style="block-size:3000px">${html}<div data-sticky style="position:sticky;inset-block-start:0">sticky</div></div><div data-fixed style="position:fixed;inset-block-start:10px">fixed</div><div style="container-type:inline-size" class="container m-inline-auto"><div data-nested class="container-breakout">nested</div></div></body></html>`);
        for (const sheet of SHEETS) await page.addStyleTag({path: join(out, sheet)});
        const m = await page.evaluate(() => {
          const box = (selector) => { const rect = document.querySelector(selector).getBoundingClientRect(); return {left: rect.left, right: rect.right, width: rect.width}; };
          const root = document.documentElement.getBoundingClientRect();
          const result = {root: {left: root.left, right: root.right}, band: box('[data-sf-composition-id="band"]'), bandText: box('[data-sf-composition-id="band-p"]'), nested: box('[data-nested]')};
          for (const id of ['narrow', 'normal', 'wide', 'full']) result[id] = box(`[data-sf-composition-id="${id}-p"]`);
          window.scrollTo({left: 400, top: 800, behavior: 'instant'});
          result.scrollX = window.scrollX;
          result.sticky = document.querySelector('[data-sticky]').getBoundingClientRect().top;
          result.fixed = document.querySelector('[data-fixed]').getBoundingClientRect().top;
          result.sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          return result;
        });
        evidence[label] = m;
        const pageWidth = m.root.right - m.root.left;
        check(`${label}: the breakout spans the page`, near(m.band.left, m.root.left) && near(m.band.right, m.root.right), {band: m.band, root: m.root});
        check(`${label}: a breakout in a size container spans the page`, near(m.nested.left, m.root.left) && near(m.nested.right, m.root.right), {nested: m.nested, root: m.root});
        check(`${label}: the band's content is centred`, near(m.bandText.left - m.root.left, m.root.right - m.bandText.right), {text: m.bandText});
        check(`${label}: the page does not scroll sideways`, m.scrollX === 0 && m.sideways <= 0, {scrollX: m.scrollX, sideways: m.sideways});
        check(`${label}: sticky and fixed keep their place`, near(m.sticky, 0) && near(m.fixed, 10), {sticky: m.sticky, fixed: m.fixed});
        for (const id of ['narrow', 'normal', 'wide']) check(`${label}: ${id} is centred`, near(m[id].left - m.root.left, m.root.right - m[id].right), {[id]: m[id]});
        check(`${label}: full spans the page`, near(m.full.width, pageWidth), {full: m.full});
        check(`${label}: narrow <= normal <= wide <= full`, m.narrow.width <= m.normal.width + 0.5 && m.normal.width <= m.wide.width + 0.5 && m.wide.width <= m.full.width + 0.5, {narrow: m.narrow.width, normal: m.normal.width, wide: m.wide.width, full: m.full.width});
        if (width >= 960) check(`${label}: wide is wider than normal on the desktop`, m.wide.width > m.normal.width + 1, {normal: m.normal.width, wide: m.wide.width});
        if (width >= 800) check(`${label}: narrow is a text measure`, m.narrow.width < m.normal.width - 1, {narrow: m.narrow.width, normal: m.normal.width});
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({probe: 'container-breakout', passed: failures.length === 0, failures, measured: Object.keys(evidence).length}, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
