#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-resizer (owner, 2026-10-14): a panel widened and narrowed by its edge.
// Measured on the built bytes: a drag changes the width the panel's
// stylesheet reads and stops at max and min; the keys move it by a step and to
// a limit; the width is remembered under the storage key and restored on the
// next page; a double click returns the stylesheet's width and forgets it; the
// handle is a separator with its value; sf-resize says move, end and reset;
// its name and hint come from the shared language reader, so a live switch
// and a registered language rename it where it stands.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'smart/smart/resizer/css/resizer.css'];
const modules = ['core/core/js/core.js', 'smart/smart/resizer/js/resizer.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport: {width: 1000, height: 600}});
  const origin = 'http://probe.test';
  await context.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    const path = join(out, product, product, ...rest);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  const load = async () => {
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await page.setContent(`<!doctype html><html lang="ru"><body style="margin:0">
      <div style="display:flex">
        <nav id="panel" style="inline-size: var(--menu-width, 256px); block-size: 300px; background: #eee">
          <aside id="menu-layer" style="position:relative; z-index:60; block-size:100%; background:#ddd">Меню</aside>
          <sf-resizer id="handle" min="200px" max="400px" property="--menu-width" storage-key="probe-menu" label="Ширина меню"></sf-resizer>
        </nav>
        <main style="flex:1">Страница</main>
      </div></body></html>`);
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
    // Core takes its distr from its own script URL when sfPath is unset
    // (simai/ui-source#8); here that is the build output's core/ root, not a
    // distr, so the page names the distr this probe routes.
    await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => customElements.get('sf-resizer'), null, {timeout: 8000});
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      window.resized = [];
      document.addEventListener('sf-resize', (event) => window.resized.push(event.detail));
    });
    return page;
  };
  const width = (page) => page.evaluate(() => Math.round(document.getElementById('panel').getBoundingClientRect().width));

  const page = await load();
  const handle = await page.evaluate(() => {
    const element = document.getElementById('handle');
    const box = element.getBoundingClientRect();
    return {x: box.left + box.width / 2, y: box.top + 100, role: element.getAttribute('role'),
      now: element.getAttribute('aria-valuenow'), min: element.getAttribute('aria-valuemin'),
      max: element.getAttribute('aria-valuemax'), label: element.getAttribute('aria-label'), tab: element.tabIndex};
  });
  // The value is the share of the way from min to max (C158 (3)): 256 of
  // 200-400 is 28.
  if (handle.role !== 'separator' || handle.now !== '28' || handle.min !== '0' || handle.max !== '100'
    || handle.label !== 'Ширина меню' || handle.tab !== 0) {
    note({case: 'a separator with its value', got: handle});
  }
  if (Math.abs(handle.x - 256) > 2) note({case: 'the handle stands on the edge', got: handle.x, expected: 256});
  // A layer in the panel that lifts itself (the larena menu: z-6 = 60) does
  // not cover the handle's inner half (docs trial 5).
  const onTop = await page.evaluate(({x, y}) => document.elementFromPoint(x - 2, y)?.closest('sf-resizer')?.id ?? document.elementFromPoint(x - 2, y)?.id ?? null, handle);
  if (onTop !== 'handle') note({case: 'the handle is above a lifted layer in its panel', got: onTop});

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y, {steps: 6});
  const during = await width(page);
  await page.mouse.move(handle.x + 400, handle.y, {steps: 6});
  const capped = await width(page);
  await page.mouse.up();
  await page.mouse.move(400, handle.y);
  await page.mouse.down();
  await page.mouse.move(0, handle.y, {steps: 8});
  await page.mouse.up();
  const floored = await width(page);
  if (during !== 316 || capped !== 400 || floored !== 200) note({case: 'a drag stops at the limits', got: {during, capped, floored}});

  await page.focus('#handle');
  await page.keyboard.press('ArrowRight');
  const stepped = await width(page);
  await page.keyboard.press('Shift+ArrowRight');
  const shifted = await width(page);
  await page.keyboard.press('End');
  const end = await width(page);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  const kept = await width(page);
  if (stepped !== 216 || shifted !== 280 || end !== 400 || kept !== 216) note({case: 'the keys', got: {stepped, shifted, end, kept}});
  const phases = await page.evaluate(() => [...new Set(window.resized.map((event) => event.phase))].join(','));
  if (!phases.includes('move') || !phases.includes('end')) note({case: 'sf-resize', got: phases, expected: 'move and end'});

  const again = await load();
  const restored = await width(again);
  if (restored !== 216) note({case: 'remembered under the storage key', got: restored, expected: 216});
  await again.dblclick('#handle');
  await again.waitForTimeout(100);
  const reset = await width(again);
  // Kept as a view preference (SF.Preferences): gone from it on reset.
  const forgotten = await again.evaluate(() => localStorage.getItem('sf-pref:sf-resizer/probe-menu') ?? localStorage.getItem('sf-resizer:probe-menu'));
  const resetPhase = await again.evaluate(() => window.resized.at(-1)?.phase);
  if (reset !== 256 || forgotten !== null || resetPhase !== 'reset') note({case: 'a double click restores and forgets', got: {reset, forgotten, resetPhase}});
  // A width the host keeps (value) wins over the browser's memory.
  await again.evaluate(() => document.getElementById('handle').setAttribute('value', '333'));
  await again.waitForTimeout(50);
  const valued = await width(again);
  if (valued !== 333) note({case: 'value is the host-kept width', got: valued, expected: 333});

  // SF.Resizer.attach: the same gesture on edges the page draws itself.
  const attached = await again.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', `<table id="grid" style="table-layout:fixed;border-collapse:collapse;margin-top:20px">
      <thead><tr><th id="a" style="width:120px;position:relative">A<button class="edge" type="button" style="position:absolute;right:-4px;top:0;width:8px;height:100%">|</button></th>
      <th style="width:120px">B</th></tr></thead></table>`);
    const table = document.getElementById('grid');
    window.log = [];
    window.SF.Resizer.attach(table, {
      handles: '.edge',
      session: (edge) => {
        const th = edge.closest('th');
        return {
          measure: () => th.getBoundingClientRect().width,
          limits: () => ({min: 80, max: 260}),
          apply: (next) => { th.style.width = `${next}px`; return next; },
          commit: (next) => window.log.push(['commit', next]),
          reset: () => { th.style.width = '120px'; window.log.push(['reset']); },
          direction: () => 1, step: 10,
        };
      },
    });
    const edge = table.querySelector('.edge');
    const box = edge.getBoundingClientRect();
    return {x: box.left + box.width / 2, y: box.top + box.height / 2};
  });
  await again.mouse.move(attached.x, attached.y);
  await again.mouse.down();
  await again.mouse.move(attached.x + 40, attached.y, {steps: 5});
  await again.mouse.up();
  const dragged = await again.evaluate(() => Math.round(document.getElementById('a').getBoundingClientRect().width));
  await again.focus('#grid .edge');
  await again.keyboard.press('End');
  const ended = await again.evaluate(() => ({width: Math.round(document.getElementById('a').getBoundingClientRect().width),
    role: document.querySelector('#grid .edge').getAttribute('aria-valuenow')}));
  await again.dblclick('#grid .edge');
  const log = await again.evaluate(() => window.log);
  if (dragged !== 160 || ended.width !== 260 || ended.role !== '100' || JSON.stringify(log) !== JSON.stringify([['commit', 160], ['commit', 260], ['reset']])) {
    note({case: 'SF.Resizer.attach on drawn edges', got: {dragged, ended, log}});
  }
  // An edge without an upper limit (max Infinity: a column with no maxWidth)
  // had no way from min to max, so aria-valuenow was always 0 (ui-view,
  // 2026-11-17). It says its width in pixels from min, no aria-valuemax, and
  // the page language's words; End leaves it where it is.
  const open = await again.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', `<table id="open-grid" style="table-layout:fixed;border-collapse:collapse;margin-top:20px">
      <thead><tr><th id="oa" style="width:120px;position:relative">A<button class="edge" type="button" style="position:absolute;right:-4px;top:0;width:8px;height:100%">|</button></th>
      <th style="width:120px">B</th></tr></thead></table>`);
    const table = document.getElementById('open-grid');
    window.SF.Resizer.attach(table, {
      handles: '.edge',
      session: (edge) => {
        const th = edge.closest('th');
        return {
          measure: () => th.getBoundingClientRect().width,
          limits: () => ({min: 80, max: Infinity}),
          apply: (next) => { th.style.width = `${next}px`; return next; },
          direction: () => 1, step: 10,
        };
      },
    });
    const edge = table.querySelector('.edge');
    const read = () => ({now: edge.getAttribute('aria-valuenow'), min: edge.getAttribute('aria-valuemin'),
      max: edge.getAttribute('aria-valuemax'), text: edge.getAttribute('aria-valuetext'),
      width: Math.round(document.getElementById('oa').getBoundingClientRect().width)});
    edge.focus();
    const reached = read();
    const key = (name) => edge.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true}));
    key('ArrowRight'); key('ArrowRight');
    const widened = read();
    key('End');
    const ended = read();
    key('Home');
    const home = read();
    return {reached, widened, ended, home};
  });
  const pixelWords = (n) => [`${n}\u00a0пикс.`, `${n} px`];
  if (open.reached.now !== '120' || open.reached.min !== '80' || open.reached.max !== null || !pixelWords(120).includes(open.reached.text)
    || open.widened.now !== '140' || open.widened.width !== 140 || !pixelWords(140).includes(open.widened.text)
    || open.ended.width !== 140 || open.ended.now !== '140'
    || open.home.now !== '80' || open.home.width !== 80) {
    note({case: 'SF.Resizer.attach edge without an upper limit says its width', got: open});
  }
  // The name and the hint come from the shared reader (SF.language), so the
  // page chooses the language and a product adds one; a handle already on the
  // page is renamed when a language is announced (ui-mail feedback
  // ui-mail.resizer-language, 2026-10-21).
  const words = await again.evaluate(async () => {
    document.documentElement.lang = 'ru';
    document.body.insertAdjacentHTML('beforeend', '<div id="spoken" style="inline-size:260px"><sf-resizer id="unnamed" min="200px" max="400px"></sf-resizer></div>');
    const handle = document.getElementById('unnamed');
    const settle = () => new Promise((done) => setTimeout(done, 30));
    const read = () => ({label: handle.getAttribute('aria-label'), hint: handle.title});
    await settle();
    const russian = read();
    window.SF.language.use('en');
    await settle();
    const english = read();
    window.SF.language.register('sf-resizer', 'de', {label: 'Breite ändern', hint: 'Ziehen oder Pfeiltasten.'});
    window.SF.language.use('de');
    await settle();
    const german = read();
    window.SF.language.use(null);
    await settle();
    const back = read();
    window.SF.language.forget();
    return {russian, english, german, back};
  });
  if (words.russian.label !== 'Изменить ширину'
    || !words.russian.hint.startsWith('Тяните')
    || words.english.label !== 'Resize' || !words.english.hint.startsWith('Drag, or use the arrow keys')
    || words.german.label !== 'Breite ändern' || words.german.hint !== 'Ziehen oder Pfeiltasten.'
    || words.back.label !== 'Изменить ширину') {
    note({case: 'the page language names the handle, and a live switch renames it', got: words});
  }

  // The resizer study (control/research/2026-11-14-resizer.md): the strip is
  // the hit zone 24 (RS-1); a disabled handle is no Tab stop (RS-6); the
  // arrows of an RTL page move the edge the way they point (RS-5); a panel
  // that scrolls keeps the whole strip on its edge, scrolled or not (RS-2);
  // the content beside a panel keeps min (RS-9).
  // A page taller than the window: the rows below are measured where they
  // stand, in view.
  await again.setViewportSize({width: 1000, height: 2400});
  const study = await again.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="study" style="display:flex; flex-wrap:wrap; inline-size:700px; margin-top:20px">
        <div id="s-rtl-box" dir="rtl" style="display:flex; flex:0 0 auto; inline-size:700px"><nav id="s-rtl" style="inline-size:var(--rw, 240px); block-size:160px; background:#eee"><sf-resizer id="s-rtl-h" min="200px" max="400px" property="--rw"></sf-resizer></nav><main style="flex:1">Текст</main></div>
        <nav id="s-off" style="inline-size:240px; block-size:160px; background:#eee"><sf-resizer id="s-off-h" disabled></sf-resizer></nav>
      </div>
      <div style="display:flex; inline-size:700px; block-size:160px">
        <nav id="s-scroll" style="inline-size:240px; overflow:auto; background:#eee"><div style="block-size:600px"></div><sf-resizer id="s-scroll-h" min="200px" max="400px"></sf-resizer></nav>
        <main style="flex:1">Страница</main>
      </div>
      <div style="display:flex; inline-size:700px; block-size:100px">
        <nav id="s-room" style="inline-size:var(--room, 160px); background:#eee"><sf-resizer id="s-room-h" min="120px" max="640px" property="--room"></sf-resizer></nav>
        <main style="flex:1 1 auto; min-inline-size:0">Текст рядом</main>
      </div>`);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const at = (id) => document.getElementById(id);
    const hit = Math.round(at('s-rtl-h').getBoundingClientRect().width);
    const off = {tabIndex: at('s-off-h').tabIndex, tabindex: at('s-off-h').getAttribute('tabindex'), disabled: at('s-off-h').getAttribute('aria-disabled')};
    const scroller = at('s-scroll');
    const caught = () => {
      const strip = at('s-scroll-h').getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      const y = box.top + box.height / 2;
      return [0.1, 0.5, 0.9].map((k) => document.elementFromPoint(strip.left + strip.width * k, y)?.id === 's-scroll-h').filter(Boolean).length
        + '/' + Math.round(strip.left + strip.width / 2 - box.right);
    };
    scroller.scrollIntoView({block: 'center'});
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const before = caught();
    scroller.scrollTop = 300;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const scrolled = caught();
    return {hit, off, before, scrolled, sideways: scroller.scrollWidth - scroller.clientWidth,
      roomMax: at('s-room-h').getAttribute('aria-valuemax')};
  });
  await again.focus('#s-rtl-h');
  const rtl0 = await again.evaluate(() => Math.round(document.getElementById('s-rtl').getBoundingClientRect().width));
  await again.keyboard.press('ArrowLeft');
  study.rtlArrowLeft = (await again.evaluate(() => Math.round(document.getElementById('s-rtl').getBoundingClientRect().width))) - rtl0;
  await again.focus('#s-room-h');
  await again.keyboard.press('End');
  study.roomEnd = await again.evaluate(() => Math.round(document.getElementById('s-room').getBoundingClientRect().width));
  if (study.hit !== 24) note({case: 'the strip is the hit zone 24', got: study.hit});
  if (study.off.tabIndex !== -1 || study.off.disabled !== 'true') note({case: 'a disabled handle is no Tab stop', got: study.off});
  if (study.rtlArrowLeft !== 16) note({case: 'ArrowLeft moves an RTL end edge left: wider', got: study.rtlArrowLeft});
  if (study.before !== '3/0' || study.scrolled !== '3/0' || study.sideways !== 0) note({case: 'a scrolling panel keeps the whole strip on its edge', got: study});
  // 700 less the content's min 120: End stops at 580, not at max 640 (the
  // value is a share since C158 (3), so the room is read from the width).
  if (study.roomMax !== '100' || study.roomEnd !== 580) note({case: 'the content beside keeps min', got: study});

  // Owner decision C158: a collapsible panel folds past min by half of min
  // and on Enter, comes back on Enter and by its «Показать» button, and says
  // so to a screen reader; Space does nothing; below the layout's split step
  // (40rem of the container) there is no handle; a .sf-workspace region
  // marked data-sf-workspace-resize gets its edge from core.
  await again.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="fold-row" style="display:flex; inline-size:900px; block-size:120px; margin-top:20px">
        <nav id="fold" aria-label="Разделы" style="inline-size:var(--fw, 300px); background:#eee; padding:8px"><a href="#x" id="fold-link">Ссылка</a><sf-resizer id="fold-h" min="200px" max="400px" property="--fw" collapsible storage-key="probe-fold"></sf-resizer></nav>
        <main style="flex:1 1 auto; min-inline-size:0">Текст рядом</main>
      </div>
      <div style="display:flex; inline-size:480px; block-size:80px">
        <nav id="thin" style="inline-size:200px"><sf-resizer id="thin-h" min="160px" max="300px"></sf-resizer></nav>
        <main style="flex:1">Узко</main>
      </div>
      <div class="sf-workspace" id="ws" style="inline-size:900px; block-size:160px">
        <nav class="sf-workspace-list" id="ws-list" data-sf-workspace-resize="probe-ws"><div style="block-size:600px">Чаты</div></nav>
        <div class="sf-workspace-main">Переписка</div>
      </div>`);
    window.SF.workspace(document.getElementById('ws'));
  });
  await again.waitForTimeout(300);
  const c158 = {};
  await again.evaluate(() => window.scrollTo(0, 0));
  const edge = await again.evaluate(() => { const box = document.getElementById('fold').getBoundingClientRect(); return {x: box.right, y: box.top + box.height / 2}; });
  await again.mouse.move(edge.x, edge.y);
  await again.mouse.down();
  await again.mouse.move(edge.x - 220, edge.y, {steps: 10});
  c158.foldDuring = await again.evaluate(() => document.getElementById('fold').hasAttribute('data-folded'));
  await again.mouse.up();
  c158.folded = await again.evaluate(() => {
    const panel = document.getElementById('fold'); const handle = document.getElementById('fold-h');
    return {folded: panel.hasAttribute('data-folded'), width: Math.round(panel.getBoundingClientRect().width), now: handle.getAttribute('aria-valuenow'),
      text: handle.getAttribute('aria-valuetext'), controls: handle.getAttribute('aria-controls'), link: getComputedStyle(document.getElementById('fold-link')).display,
      unfold: !!panel.querySelector('[data-sf-resizer-unfold]'), kept: JSON.parse(localStorage.getItem('sf-pref:sf-resizer/probe-fold') || 'null')};
  });
  await again.focus('#fold-h');
  await again.keyboard.press('Enter');
  c158.enterBack = await again.evaluate(() => [document.getElementById('fold').hasAttribute('data-folded'), Math.round(document.getElementById('fold').getBoundingClientRect().width), document.getElementById('fold-h').getAttribute('aria-valuetext')]);
  await again.keyboard.press(' ');
  c158.space = await again.evaluate(() => Math.round(document.getElementById('fold').getBoundingClientRect().width));
  await again.keyboard.press('Enter');
  await again.waitForTimeout(400);
  await again.evaluate(() => document.querySelector('#fold [data-sf-resizer-unfold] button, #fold [data-sf-resizer-unfold] sf-button-icon')?.click());
  await again.waitForTimeout(100);
  c158.unfolded = await again.evaluate(() => [document.getElementById('fold').hasAttribute('data-folded'), Math.round(document.getElementById('fold').getBoundingClientRect().width), document.activeElement?.id]);
  c158.thin = await again.evaluate(() => [getComputedStyle(document.getElementById('thin-h')).display, document.getElementById('thin-h').hasAttribute('data-sf-resizer-narrow')]);
  c158.workspace = await again.evaluate(() => {
    const list = document.getElementById('ws-list'); const handle = list.querySelector(':scope > sf-resizer');
    if (!handle) return null;
    const box = list.getBoundingClientRect(); const y = box.top + box.height / 2;
    const caught = [-11, 0, 11].filter((dx) => document.elementFromPoint(box.right + dx, y) === handle).length;
    return {property: handle.getAttribute('property'), collapsible: handle.hasAttribute('collapsible'), key: handle.getAttribute('storage-key'), caught, width: Math.round(handle.getBoundingClientRect().width)};
  });
  await again.focus('#ws-list > sf-resizer');
  await again.keyboard.press('ArrowRight');
  c158.workspaceWidth = await again.evaluate(() => [document.getElementById('ws-list').style.getPropertyValue('--sf-workspace-list'), Math.round(document.getElementById('ws-list').getBoundingClientRect().width)]);
  if (!c158.foldDuring || !c158.folded.folded || c158.folded.now !== '0' || c158.folded.text !== 'Свёрнуто' || c158.folded.controls !== 'fold'
    || c158.folded.link !== 'none' || !c158.folded.unfold || c158.folded.kept?.folded !== true || c158.folded.kept?.width !== 300) {
    note({case: 'C158 (2)(3): a drag past half of min folds, said and kept', got: c158.folded, during: c158.foldDuring});
  }
  if (c158.enterBack[0] || c158.enterBack[1] !== 300 || c158.enterBack[2] !== '50\u00a0%') note({case: 'C158 (2): Enter gives the width back', got: c158.enterBack});
  if (c158.space !== 300) note({case: 'C158 (2): Space does nothing', got: c158.space});
  if (c158.unfolded[0] || c158.unfolded[1] !== 300 || c158.unfolded[2] !== 'fold-h') note({case: 'C158 (2): «Показать» brings the panel back and focus to the edge', got: c158.unfolded});
  if (c158.thin[0] !== 'none' || !c158.thin[1]) note({case: 'C158 (4): no handle below the split step', got: c158.thin});
  if (!c158.workspace || c158.workspace.property !== '--sf-workspace-list' || !c158.workspace.collapsible || c158.workspace.key !== 'probe-ws' || c158.workspace.caught !== 3 || c158.workspace.width !== 24) {
    note({case: 'C158 (6): a .sf-workspace list region gets its edge, whole', got: c158.workspace});
  }
  if (!/px$/u.test(c158.workspaceWidth[0])) note({case: 'C158 (6): the width goes into the region variable', got: c158.workspaceWidth});

  console.log(JSON.stringify({handle, during, capped, floored, stepped, shifted, end, kept, phases, restored, reset, valued, dragged, ended, log, words, study, c158}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('RESIZER_OK');
