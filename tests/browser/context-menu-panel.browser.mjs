#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-context-menu as a panel with tabs (owner, 2026-10-15), on the built bytes:
// - the head (tabs and the close button) stays put while the body scrolls,
//   and so does the footer;
// - the panel's width is its own: a footer button's longer label and another
//   tab's narrower rows leave it as it was;
// - choosing a tab and pressing the close button are said to the host.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/tabs/css/tabs.css', 'component/component/context-menu/css/context-menu.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/tabs/js/tabs.js', 'smart/smart/context-menu/js/context-menu.js'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${origin}/`);
  const rows = Array.from({length: 40}, (_, i) => `<label class="sf-context-menu-row"><span>⋮</span><span class="sf-context-menu-row-text">Поле номер ${i} с довольно длинным названием</span><input type="checkbox"></label>`).join('');
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
    <sf-context-menu id="m" size="1" tabs="Поля|Вид" closable role="dialog" aria-label="Настройки">
      <div slot="content" id="rows">${rows}</div>
      <sf-button slot="footer" id="apply" size="1" text="Применить"></sf-button>
    </sf-context-menu>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => document.querySelector('#m .sf-context-menu-head sf-tabs [role="tab"]') && document.querySelector('#m .sf-context-menu-close button'), null, {timeout: 8000});
  await page.evaluate(() => {
    const surface = document.querySelector('#m .sf-context-menu > .relative');
    surface.style.maxBlockSize = '400px';
  });
  await page.waitForTimeout(300);

  const got = await page.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const menu = document.getElementById('m');
    const content = menu.querySelector('.sf-context-menu-content');
    const head = menu.querySelector('.sf-context-menu-head');
    const body = menu.querySelector('.sf-context-menu-body');
    const footer = menu.querySelector('.sf-context-menu-footer');
    const events = [];
    menu.addEventListener('sf-context-menu-tab', (event) => events.push(['tab', event.detail]));
    menu.addEventListener('sf-context-menu-close', () => events.push(['close']));
    const result = {width0: Math.round(content.getBoundingClientRect().width), height: Math.round(content.getBoundingClientRect().height)};
    const headTop = head.getBoundingClientRect().top;
    const footTop = footer.getBoundingClientRect().top;
    body.scrollTop = 300;
    // The body may scroll smoothly: measured after a fixed 100 ms it was still
    // on its way under load (37 of 185 px in a full probe run, 2026-10-19), so
    // wait until it has stopped moving.
    for (let last = -1, still = 0, tries = 0; still < 3 && tries < 100; tries += 1) {
      await new Promise((frame) => requestAnimationFrame(frame));
      still = body.scrollTop === last ? still + 1 : 0;
      last = body.scrollTop;
    }
    result.scrolled = {body: body.scrollTop, headMoved: Math.round(head.getBoundingClientRect().top - headTop), footMoved: Math.round(footer.getBoundingClientRect().top - footTop),
      bodyScrolls: body.scrollHeight > body.clientHeight};
    document.getElementById('apply').setAttribute('text', 'Применить выбранные поля (12)');
    await wait(200);
    result.width1 = Math.round(content.getBoundingClientRect().width);
    menu.querySelectorAll('.sf-context-menu-head [role="tab"]')[1].click();
    await wait(200);
    document.getElementById('rows').innerHTML = '<label class="sf-context-menu-row"><span></span><span class="sf-context-menu-row-text">Коротко</span><span></span></label>';
    await wait(200);
    result.width2 = Math.round(content.getBoundingClientRect().width);
    result.active = menu.getAttribute('active-tab');
    menu.querySelector('.sf-context-menu-close button').click();
    await wait(100);
    result.events = events;
    return result;
  });
  if (!got.scrolled.bodyScrolls || got.scrolled.body < 100) note({case: 'the body scrolls', got: got.scrolled});
  if (got.scrolled.headMoved !== 0 || got.scrolled.footMoved !== 0) note({case: 'the head and the footer stay while the body scrolls', got: got.scrolled});
  if (got.width1 !== got.width0 || got.width2 !== got.width0) note({case: 'the panel keeps its width', got});
  if (got.width0 !== 320) note({case: 'the panel is eight controls wide by default', got: got.width0});
  if (got.active !== 'Вид' || !got.events.some(([kind, detail]) => kind === 'tab' && detail?.id === 'Вид' && detail.index === 1)) note({case: 'a tab chosen is said', got});
  if (!got.events.some(([kind]) => kind === 'close')) note({case: 'the close button asks the host to close', got: got.events});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('CONTEXT_MENU_PANEL_OK');
