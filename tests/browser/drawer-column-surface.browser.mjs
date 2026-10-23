#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A docked sf-drawer is a column of the page and takes the page's surface
// (simai/ui-source#26 C1, ui-mail P-02), on the built bytes, in the light and
// the dark theme:
//   - in a dock host with the room (at least 48rem) the docked panel says
//     data-sf-drawer-column="true", paints --sf-surface-0 -- the colour of the
//     page beside it, not the raised --sf-elevation-4--surface -- draws no
//     shadow, and keeps the page's --sf-on-surface-variant;
//   - narrowed under 48rem the same panel floats over the page: column
//     "false", the raised surface and a shadow, as a floating panel;
//   - a drawer that is not docked keeps the raised surface and its shadow;
//   - --sf-drawer-background still overrides the column's surface.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'smart/smart/drawer/css/drawer.css'].map((p) => join(out, p));
const modules = ['core/core/js/smart-base.js', 'smart/smart/drawer/js/drawer.js'].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)">
<div id="host" data-sf-drawer-dock-host style="inline-size:1200px;block-size:600px">Страница</div>
<sf-drawer id="library" docked open placement="inline-start" size="1/2" label="Библиотека"><p>Блоки</p></sf-drawer>
<sf-drawer id="floating" modal="false" placement="inline-end" size="1/2" title="Поверх"><p>Текст</p></sf-drawer>
<sf-drawer id="painted" docked placement="inline-end" size="1/2" label="Своя" style="--sf-drawer-background: rgb(1, 2, 3)"><p>Текст</p></sf-drawer>
</body></html>`;

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
    const tab = await context.newPage();
    tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: `${theme}: page error`, said: error.message}); });
    await tab.setContent(page(theme));
    for (const path of styles) await tab.addStyleTag({path});
    for (const path of modules) await tab.addScriptTag({path});
    await tab.waitForFunction(() => customElements.get('sf-drawer') && document.querySelectorAll('[data-sf-drawer-root]').length === 3);
    await tab.waitForTimeout(300);
    const read = (id) => tab.evaluate((id) => {
      const resolveColor = (value) => {
        const probe = document.createElement('i');
        probe.style.color = value;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const root = document.querySelector(`[data-sf-drawer-id="${id}"]`);
      const panel = root.querySelector('[data-sf-drawer-panel]');
      const style = getComputedStyle(panel);
      const variant = document.createElement('i');
      variant.style.color = 'var(--sf-on-surface-variant)';
      panel.append(variant);
      const panelVariant = getComputedStyle(variant).color;
      variant.remove();
      return {
        column: root.getAttribute('data-sf-drawer-column'), background: style.backgroundColor, shadow: style.boxShadow,
        variant: panelVariant, page: resolveColor('var(--sf-surface-0)'), raised: resolveColor('var(--sf-elevation-4--surface)'),
        pageVariant: resolveColor('var(--sf-on-surface-variant)'), padding: getComputedStyle(document.getElementById('host')).paddingInlineStart,
      };
    }, id);
    const at = (what) => `${theme}: ${what}`;

    let library = await read('library');
    evidence[`${theme} column`] = library;
    check(at('a docked drawer with the room is a column'), library.column === 'true', library);
    check(at('the column paints the page surface'), library.background === library.page, library);
    check(at('the column draws no shadow'), library.shadow === 'none', library);
    check(at('the column keeps the page\'s dimmed text'), library.variant === library.pageVariant, library);
    check(at('the column takes room from the page'), library.padding !== '0px', library);
    if (theme === 'dark') check(at('the column is not the raised step'), library.background !== library.raised, library);

    await tab.evaluate(() => { document.getElementById('floating').open(); document.getElementById('painted').open(); });
    await tab.waitForTimeout(300);
    const floating = await read('floating');
    evidence[`${theme} floating`] = floating;
    check(at('a drawer that is not docked keeps the raised surface'), floating.background === floating.raised && floating.column === 'false', floating);
    check(at('a drawer that is not docked keeps its shadow'), floating.shadow !== 'none', floating);
    const painted = await read('painted');
    check(at('--sf-drawer-background overrides the column'), painted.background === 'rgb(1, 2, 3)' && painted.column === 'true', painted);
    await tab.evaluate(() => { document.getElementById('floating').close(); document.getElementById('painted').close(); });

    // Narrowed under 48rem the docked drawer floats over the page.
    await tab.evaluate(() => { document.getElementById('host').style.inlineSize = '600px'; });
    await tab.waitForTimeout(300);
    library = await read('library');
    evidence[`${theme} narrow`] = library;
    check(at('a docked drawer without the room is not a column'), library.column === 'false', library);
    check(at('it floats with the raised surface'), library.background === library.raised, library);
    check(at('it floats with a shadow'), library.shadow !== 'none', library);
    check(at('it takes no room from the page'), library.padding === '0px', library);

    // Wide again: a column again.
    await tab.evaluate(() => { document.getElementById('host').style.inlineSize = '1200px'; });
    await tab.waitForTimeout(300);
    library = await read('library');
    check(at('widened, it is a column again'), library.column === 'true' && library.background === library.page && library.shadow === 'none', library);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DRAWER_COLUMN_SURFACE_OK');
