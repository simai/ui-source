#!/usr/bin/env node
// Usage: node this-file [ui-source root] (node_modules from the root, or SF_NODE_MODULES)
//
// The shared positioning (core/js/position.js) and the floating-surface engine
// (core/js/float-anchor.js) from source, without a product build: the modules
// are served as they are, Floating UI through an import map. Three cases from
// the C59 S1 acceptance (control/evidence/2026-11-12-popover-s1-accept):
//
// - D1, nested overlays: a surface anchored inside another top-layer surface
//   (a lifted popover panel, a modal dialog) is lifted too and drawn over its
//   parent's later content, by both engines;
// - D2, a narrow window: at 390, a 180 px panel at a 120 px centred trigger
//   placed start or end (every alignment, LTR and RTL) never covers the
//   trigger, and data-sf-side names the side it stands on;
// - M1, density: a density switch while open restates the gap at once (12 ->
//   8 here), by both engines.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

const root = resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const modules = resolve(process.env.SF_NODE_MODULES || join(root, 'node_modules'));
const TYPES = {'.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8'};
const failures = [];
const check = (ok, detail) => { if (!ok) failures.push(detail); };

const mounts = [['/src/', join(root, 'src')], ['/node_modules/', modules]];
const importMap = {imports: {
  '@floating-ui/dom': '/node_modules/@floating-ui/dom/dist/floating-ui.dom.browser.mjs',
  '@floating-ui/core': '/node_modules/@floating-ui/core/dist/floating-ui.core.browser.mjs',
  '@floating-ui/utils': '/node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs',
  '@floating-ui/utils/dom': '/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs',
}};

const page = (dir, engine) => `<!doctype html><html lang="ru" dir="${dir}"${engine === 'script' ? ' data-sf-position-engine="script"' : ''}><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify(importMap)}</script>
<style>
  :root { --sf-space-1\\/4: 4px; --sf-space-1\\/2: 12px; --sf-space-1: 16px; }
  :root[data-sf-density="compact"] { --sf-space-1\\/2: 8px; }
  body { margin: 0; font: 14px/20px sans-serif; }
  .panel { box-sizing: border-box; background: #fff; border: 1px solid #888; padding: 8px; }
  #parent { inline-size: 240px; }
  #parent .row { position: relative; background: #eee; block-size: 40px; margin-block-start: 4px; }
  #tip { inline-size: 120px; block-size: 32px; background: #222; color: #fff; }
  #trigger { position: absolute; inset-inline-start: 135px; top: 300px; inline-size: 120px; block-size: 40px; }
  #wide { inline-size: 180px; block-size: 80px; }
  dialog { padding: 8px; inline-size: 240px; }
  dialog .row { position: relative; background: #eee; block-size: 40px; margin-block-start: 4px; }
  #dtip { inline-size: 120px; block-size: 32px; background: #222; color: #fff; }
</style></head><body>
<button id="ptrig" type="button" style="margin:40px">Открыть</button>
<div id="parent" class="panel">
  <button id="ttrig" type="button" style="inline-size:40px;block-size:40px">?</button>
  <div id="tip" class="panel">Подсказка</div>
  <div class="row" id="row1">Поле</div><div class="row" id="row2">Город</div>
</div>
<button id="trigger" type="button">Триггер</button>
<div id="wide" class="panel">Панель шириной 180px</div>
<dialog id="dlg"><button id="dtrig" type="button" style="inline-size:40px;block-size:40px">?</button>
  <div id="dtip" class="panel">В окне</div><div class="row">Поле</div><div class="row">Город</div></dialog>
<script type="module">
  import Position from '/src/core/js/position.js';
  import {anchorFloating} from '/src/core/js/float-anchor.js';
  window.Position = Position;
  window.anchorFloating = anchorFloating;
  window.ready = true;
</script></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  if (url.pathname.startsWith('/p/')) {
    const [, , dir, engine] = url.pathname.split('/');
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    response.end(page(dir, engine));
    return;
  }
  for (const [prefix, base] of mounts) {
    if (!url.pathname.startsWith(prefix)) continue;
    const file = resolve(base, `.${url.pathname.slice(prefix.length - 1)}`);
    if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) break;
    response.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
    response.end(readFileSync(file));
    return;
  }
  response.writeHead(404);
  response.end();
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const frames = (tab, count = 3) => tab.evaluate((n) => new Promise((done) => {
  let left = n;
  const step = () => (--left <= 0 ? done() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), count);

const browser = await chromium.launch();
try {
  for (const dir of ['ltr', 'rtl']) for (const engine of ['auto', 'script']) {
    const where = `${dir} ${engine}`;
    const context = await browser.newContext({viewport: {width: 390, height: 800}});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${origin}/p/${dir}/${engine}`);
    await tab.waitForFunction(() => window.ready === true);

    // D1: a tooltip inside a lifted panel, and inside a modal dialog.
    const nested = await tab.evaluate(async () => {
      const parent = document.getElementById('parent');
      window.Position.liftToTopLayer(parent);
      const lifted = window.anchorFloating(document.getElementById('ptrig'), parent, {side: 'block-end', align: 'start'});
      const tip = document.getElementById('tip');
      // The tip hangs over the following rows of its parent.
      const inner = window.Position.anchor(document.getElementById('ttrig'), tip, {side: 'block-end', align: 'start', offset: 0, fitHeight: false});
      await inner.update();
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const box = tip.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const result = {parentTop: parent.matches(':popover-open'), tipTop: tip.matches(':popover-open'), hit: hit === tip || tip.contains(hit),
        at: hit ? `${hit.localName}#${hit.id}` : null, engine: lifted.engine};
      // The same in a modal dialog.
      const dialog = document.getElementById('dlg');
      dialog.showModal();
      const dtip = document.getElementById('dtip');
      const dinner = window.Position.anchor(document.getElementById('dtrig'), dtip, {side: 'block-end', align: 'start', offset: 0, fitHeight: false});
      await dinner.update();
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const dbox = dtip.getBoundingClientRect();
      const dhit = document.elementFromPoint(dbox.left + dbox.width / 2, dbox.top + dbox.height / 2);
      result.dialogTipTop = dtip.matches(':popover-open');
      result.dialogHit = dhit === dtip || dtip.contains(dhit);
      dinner.stop();
      dialog.close();
      result.dialogTipDown = !dtip.matches(':popover-open') && !dtip.hasAttribute('popover');
      inner.stop();
      result.tipDown = !tip.matches(':popover-open') && !tip.hasAttribute('popover');
      lifted.stop();
      parent.hidePopover();
      parent.removeAttribute('popover');
      parent.removeAttribute('data-sf-position-layer');
      return result;
    });
    check(nested.parentTop && nested.tipTop, `${where} D1: parent and nested tooltip both in the top layer ${JSON.stringify(nested)}`);
    check(nested.hit, `${where} D1: the nested tooltip is drawn over its parent's content (hit ${nested.at})`);
    check(nested.dialogTipTop && nested.dialogHit, `${where} D1: a tooltip in a modal dialog is lifted and on top ${JSON.stringify(nested)}`);
    check(nested.tipDown && nested.dialogTipDown, `${where} D1: stop() puts a nested surface back`);

    // D2: start/end at 390 with no room on either side.
    for (const side of ['inline-start', 'inline-end']) for (const align of ['center', 'start', 'end']) {
      const got = await tab.evaluate(async ({side, align}) => {
        const trigger = document.getElementById('trigger');
        const wide = document.getElementById('wide');
        window.Position.liftToTopLayer(wide);
        const anchor = window.anchorFloating(trigger, wide, {side, align, offset: 0, fitHeight: false, topLayer: false});
        await anchor.update();
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const t = trigger.getBoundingClientRect();
        const s = wide.getBoundingClientRect();
        const covered = Math.max(0, Math.min(s.right, t.right) - Math.max(s.left, t.left)) * Math.max(0, Math.min(s.bottom, t.bottom) - Math.max(s.top, t.top));
        const physical = s.bottom <= t.top + 1 ? 'top' : s.top >= t.bottom - 1 ? 'bottom' : s.right <= t.left + 1 ? 'left' : s.left >= t.right - 1 ? 'right' : 'over';
        const rtl = getComputedStyle(trigger).direction === 'rtl';
        const said = wide.dataset.sfSide;
        const result = {covered: Math.round(covered), physical, said, expected: physical === 'over' ? null : window.Position.logicalSide(physical, rtl),
          engine: anchor.engine, inside: s.left >= -0.5 && s.right <= innerWidth + 0.5, width: Math.round(s.width)};
        anchor.stop();
        wide.hidePopover();
        wide.removeAttribute('popover');
        wide.removeAttribute('data-sf-position-layer');
        return result;
      }, {side, align});
      check(got.covered === 0, `${where} D2 ${side} ${align}: the panel covers the trigger ${JSON.stringify(got)}`);
      check(got.said === got.expected, `${where} D2 ${side} ${align}: data-sf-side ${got.said}, stands ${got.physical} ${JSON.stringify(got)}`);
      check(got.inside, `${where} D2 ${side} ${align}: inside the window ${JSON.stringify(got)}`);
    }

    // M1: a density switch while open restates the gap, with nothing resized.
    const density = await tab.evaluate(async () => {
      const trigger = document.getElementById('trigger');
      const wide = document.getElementById('wide');
      trigger.style.top = '200px';
      window.Position.liftToTopLayer(wide);
      const anchor = window.anchorFloating(trigger, wide, {side: 'block-end', align: 'center', offset: 'var(--sf-space-1\\/2)', fitHeight: false, topLayer: false});
      await anchor.update();
      const wait = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))));
      await wait();
      const gap = () => Math.round(wide.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom);
      const before = gap();
      document.documentElement.setAttribute('data-sf-density', 'compact');
      await wait();
      const after = gap();
      document.documentElement.removeAttribute('data-sf-density');
      await wait();
      const back = gap();
      const result = {before, after, back, engine: anchor.engine};
      anchor.stop();
      wide.hidePopover();
      wide.removeAttribute('popover');
      wide.removeAttribute('data-sf-position-layer');
      trigger.style.top = '';
      return result;
    });
    check(density.before === 12 && density.after === 8 && density.back === 12, `${where} M1: gap 12 -> 8 -> 12 live ${JSON.stringify(density)}`);
    check(engine !== 'script' || density.engine === 'script', `${where}: the script engine was asked for and used`);
    check(!errors.length, `${where}: console ${errors.join(' | ')}`);
    console.log(`${where}: D1 ${JSON.stringify(nested)} M1 ${JSON.stringify(density)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('float-anchor nested / narrow / density: PASS');
