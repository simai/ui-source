#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The paper and the well (simai/ui-source#24, the ui-mail document preview),
// resolved from the built core.css in the light and the dark theme, on the page
// root and in a subtree whose theme is the other one:
//   - --sf-paper is white and --sf-on-paper the darkest neutral in both themes:
//     they do not flip; their contrast is at least 7:1 (AAA);
//   - --sf-surface-well is recessed: no lighter than surface-0 and darker than
//     surface-1 in the light theme; the darkest surface in the dark theme; it
//     differs between the themes;
//   - the interface's text on the well holds 4.5:1 -- --sf-on-surface and
//     --sf-on-surface-variant;
//   - in the dark theme the paper stands off the well by itself (at least 3:1);
//     in the light theme it stands by the shadow the elevation guide gives it;
//   - the marks an editor draws on the paper (simai/ui-source#29, ui-mail
//     P-04) are the light theme's in both themes and in either subtree:
//     --sf-paper-primary holds 4.5:1 on the paper (the dark theme's primary
//     measured 1.75:1), --sf-paper-outline 3:1, and the --sf-paper-hover and
//     --sf-paper-select tints are the light theme's state layers.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const ROLES = ['--sf-paper', '--sf-on-paper', '--sf-surface-well', '--sf-surface-0', '--sf-surface-1',
  '--sf-on-surface', '--sf-on-surface-variant', '--sf-paper-primary', '--sf-paper-outline', '--sf-paper-hover',
  '--sf-paper-select', '--sf-primary', '--sf-primary-transparent-hover', '--sf-primary-transparent-select'];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  for (const theme of ['light', 'dark']) {
    const other = theme === 'light' ? 'dark' : 'light';
    await page.setContent(`<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"></head>
      <body><div id="root"></div><section class="theme-${other}"><div id="nested"></div></section></body></html>`);
    await page.addStyleTag({path: join(out, 'core/core/css/core.css')});
    const read = await page.evaluate((roles) => {
      const channel = (value) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const luminance = (rgb) => { const [r, g, b] = rgb.match(/\d+(\.\d+)?/gu).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
      const resolveIn = (host) => Object.fromEntries(roles.map((role) => {
        const probe = document.createElement('i');
        probe.style.color = `var(${role})`;
        host.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return [role, {color, luminance: luminance(color)}];
      }));
      return {root: resolveIn(document.getElementById('root')), nested: resolveIn(document.getElementById('nested'))};
    }, ROLES);
    evidence[theme] = Object.fromEntries(Object.entries(read.root).map(([role, value]) => [role, value.color]));
    evidence[`${other} inside ${theme}`] = Object.fromEntries(Object.entries(read.nested).map(([role, value]) => [role, value.color]));
    for (const [where, scheme, roles] of [[`${theme} root`, theme, read.root], [`${other} subtree in ${theme}`, other, read.nested]]) {
      const ratio = (a, b) => { const [x, y] = [roles[a].luminance, roles[b].luminance]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const at = (what) => `${where}: ${what}`;
      check(at('the paper is white'), roles['--sf-paper'].color === 'rgb(255, 255, 255)', roles['--sf-paper']);
      check(at('the paper\'s ink is the darkest neutral, the same in both themes'), roles['--sf-on-paper'].color === 'rgb(26, 27, 31)', roles['--sf-on-paper']);
      check(at('ink on paper holds 7:1'), ratio('--sf-on-paper', '--sf-paper') >= 7, {ratio: ratio('--sf-on-paper', '--sf-paper')});
      check(at('the well is no lighter than surface-0'), roles['--sf-surface-well'].luminance <= roles['--sf-surface-0'].luminance + 1e-9, roles);
      check(at('the well is darker than surface-1'), roles['--sf-surface-well'].luminance < roles['--sf-surface-1'].luminance, roles);
      for (const ink of ['--sf-on-surface', '--sf-on-surface-variant']) {
        const value = ratio(ink, '--sf-surface-well');
        check(at(`${ink} on the well holds 4.5:1`), value >= 4.5, {ratio: value});
        evidence[`${where}: ${ink} on well`] = Number(value.toFixed(2));
      }
      const paperOnWell = ratio('--sf-paper', '--sf-surface-well');
      evidence[`${where}: paper on well`] = Number(paperOnWell.toFixed(2));
      if (scheme === 'dark') check(at('the paper stands off the well by itself'), paperOnWell >= 3, {ratio: paperOnWell});
      const frame = ratio('--sf-paper-primary', '--sf-paper');
      const outline = ratio('--sf-paper-outline', '--sf-paper');
      evidence[`${where}: paper-primary on paper`] = Number(frame.toFixed(2));
      evidence[`${where}: paper-outline on paper`] = Number(outline.toFixed(2));
      evidence[`${where}: primary on paper`] = Number(ratio('--sf-primary', '--sf-paper').toFixed(2));
      check(at('the selection frame on the paper holds 4.5:1'), frame >= 4.5, {ratio: frame});
      check(at('the hover outline on the paper holds 3:1'), outline >= 3, {ratio: outline});
      if (scheme === 'light') {
        check(at('the paper\'s frame is the light theme\'s primary'), roles['--sf-paper-primary'].color === roles['--sf-primary'].color, roles);
        check(at('the paper\'s tints are the light theme\'s state layers'),
          roles['--sf-paper-hover'].color === roles['--sf-primary-transparent-hover'].color
          && roles['--sf-paper-select'].color === roles['--sf-primary-transparent-select'].color, roles);
      }
    }
  }
  check('the well differs between the themes', evidence.light['--sf-surface-well'] !== evidence.dark['--sf-surface-well'], evidence);
  check('the paper does not', evidence.light['--sf-paper'] === evidence.dark['--sf-paper']
    && evidence.light['--sf-on-paper'] === evidence.dark['--sf-on-paper'], evidence);
  for (const role of ['--sf-paper-primary', '--sf-paper-outline', '--sf-paper-hover', '--sf-paper-select']) {
    const seen = new Set(['light', 'dark', 'dark inside light', 'light inside dark'].map((where) => evidence[where][role]));
    check(`${role} is the same in both themes and either subtree`, seen.size === 1, {role, seen: [...seen]});
  }
  check('the dark theme\'s own primary is what the paper roles replace', evidence.dark['--sf-primary'] !== evidence.dark['--sf-paper-primary'], evidence.dark);
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('THEME_PAPER_WELL_OK');
