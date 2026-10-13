#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/smart /absolute/path/to/distr
// Drawers opened at one edge: without stack-offset they lie flush, as before;
// with it each drawer stands depth × offset in from the edge, so the one below
// shows past it. Measured at both edges and in a right-to-left page.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[3]) throw new Error('Smart output root and distr root are required');
const smartRoot = resolve(process.argv[2]);
const distrRoot = resolve(process.argv[3]);
const cases = [
  {name: 'flush by default', placement: 'inline-end', offset: '', dir: 'ltr', expect: [0, 0, 0]},
  {name: 'inline-end, 48px', placement: 'inline-end', offset: '48px', dir: 'ltr', expect: [0, 48, 96]},
  {name: 'left, 32px', placement: 'left', offset: '32px', dir: 'ltr', expect: [0, 32, 64]},
  {name: 'inline-end in rtl', placement: 'inline-end', offset: '40px', dir: 'rtl', expect: [0, 40, 80]},
];
const browser = await chromium.launch();
const failures = [];
try {
  for (const item of cases) {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    await page.goto('about:blank');
    await page.evaluate((dir) => { document.documentElement.dir = dir; }, item.dir);
    await page.addStyleTag({path: join(distrRoot, 'core', 'css', 'core.css')});
    await page.addStyleTag({path: join(smartRoot, 'drawer', 'css', 'drawer.css')});
    await page.addScriptTag({path: join(distrRoot, 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smartRoot, 'drawer', 'js', 'drawer.js')});
    const insets = await page.evaluate(async ({placement, offset}) => {
      document.body.innerHTML = [1, 2, 3].map((n) => `<sf-drawer data-n="${n}" placement="${placement}" size="1/2" ${offset ? `stack-offset="${offset}"` : ''} title="D${n}"><p>${n}</p></sf-drawer>`).join('');
      await new Promise((settle) => setTimeout(settle, 100));
      for (const drawer of document.querySelectorAll('sf-drawer')) { drawer.setAttribute('open', ''); await new Promise((settle) => setTimeout(settle, 400)); }
      await new Promise((settle) => setTimeout(settle, 600));
      return [...document.querySelectorAll('.sf-drawer-panel')].map((panel) => {
        const box = panel.getBoundingClientRect();
        const left = panel.closest('[data-sf-drawer-placement]').dataset.sfDrawerPlacement;
        const fromLeft = Math.round(box.left);
        const fromRight = Math.round(window.innerWidth - box.right);
        return {fromLeft, fromRight, placement: left};
      });
    }, item);
    await page.close();
    const edge = (item.placement === 'left' || (item.placement === 'inline-start' && item.dir === 'ltr') || (item.placement === 'inline-end' && item.dir === 'rtl')) ? 'fromLeft' : 'fromRight';
    const got = insets.map((inset) => inset[edge]);
    if (JSON.stringify(got) !== JSON.stringify(item.expect)) failures.push(`${item.name}: insets ${JSON.stringify(got)}, expected ${JSON.stringify(item.expect)}`);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({cases: cases.length, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
