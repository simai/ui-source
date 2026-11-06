#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-wizard 1.0 on the built bytes with the real Loader (owner decision
// 2026-11-06), at 1440 and 390 px, light and dark:
//   inline   three steps: the row with aria-current, «Шаг 1 из 3», no Back on
//            the first step, one primary at the footer's end, the footer's
//            buttons the rung's control height; Далее on an empty required
//            field marks it, focuses it and sends invalid; filled, the wizard
//            moves, marks the step done, focuses the title and says where it
//            went; narrow, the row gives way to the compact line;
//   pages    a page per step served here: the primary posts the step's form
//            with wizard-action=next and the fields, Skip posts skip without
//            validation, an action step posts run and shows running;
//   modal    the window opens from its trigger; Escape with unsent input asks
//            first; the whole import ends in completed with one value;
//   touch    under a coarse pointer the footer's buttons are at least 44 px.
// No sideways scroll, no page errors, no failed requests. With a screenshot
// folder, each case is saved there as a PNG.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};

const head = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface);color:var(--sf-on-surface)}</style></head><body>`;

const THREE = `<sf-wizard id="w" heading="Новый сайт">
<sf-wizard-step name="name" label="Название" type="form" description="Так сайт будет называться."><form><sf-input name="title" label="Название сайта" required></sf-input></form></sf-wizard-step>
<sf-wizard-step name="template" label="Шаблон" description="С чего начнётся сайт."><p>Шаблон «Магазин».</p></sf-wizard-step>
<sf-wizard-step name="done" label="Готово" type="result"><p>Сайт создан.</p></sf-wizard-step>
</sf-wizard>`;

// 30 steps beside a short body: the column must not make the wizard taller
// (owner, 2026-11-07); it scrolls inside and keeps the current step in view.
const THIRTY = `<sf-wizard id="w" heading="Установка" progress="column" navigation="free" current="s18">
${Array.from({length: 30}, (_, i) => `<sf-wizard-step name="s${i + 1}" label="Шаг ${i + 1}"><p>Короткий шаг ${i + 1}.</p></sf-wizard-step>`).join('\n')}
</sf-wizard>`;

const posts = [];
const PAGE_STEPS = ['address', 'notify', 'protection', 'done'];
const pagesMarkup = (current) => `<sf-wizard id="w" place="pages" heading="Настройка сервера" current="${current}">
${PAGE_STEPS.map((name) => {
    const type = {address: 'form', notify: 'form', protection: 'action', done: 'result'}[name];
    const body = name !== current ? '' : {
      address: '<form method="post" action="/post?step=address"><sf-input name="host" label="Адрес" required></sf-input></form>',
      notify: '<form method="post" action="/post?step=notify"><sf-input name="email" label="Почта" required></sf-input></form>',
      protection: '<form method="post" action="/post?step=protection"><p>Выпуск сертификата.</p></form>',
      done: '<p>Готово.</p>',
    }[name];
    return `<sf-wizard-step name="${name}" label="${name}" type="${type}" href="/pages?step=${name}"${name === 'notify' ? ' optional' : ''}>${body}</sf-wizard-step>`;
  }).join('\n')}
</sf-wizard>`;

const CSV = `<sf-button id="open" text="Импорт"></sf-button>
<sf-wizard id="w" place="modal" for="open" heading="Импорт контактов">
<sf-wizard-step name="upload" label="Файл" type="form"><form><sf-input name="file" label="Файл" required></sf-input></form></sf-wizard-step>
<sf-wizard-step name="preview" label="Проверка" type="review" action-text="Импортировать"><ul class="sf-wizard-plan"><li><span>124 контакта</span></li></ul></sf-wizard-step>
<sf-wizard-step name="result" label="Итог" type="result"><p>Готово.</p></sf-wizard-step>
</sf-wizard>`;

let theme = 'light';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const html = (body) => { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); response.end(`${head(theme)}${body}</body></html>`); };
  if (path === '/three') return html(THREE);
  if (path === '/csv') return html(CSV);
  if (path === '/thirty') return html(THIRTY);
  if (path === '/pages') return html(pagesMarkup(url.searchParams.get('step') || 'address'));
  if (path === '/post') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const step = url.searchParams.get('step');
    posts.push({step, body: Object.fromEntries(new URLSearchParams(raw))});
    const next = PAGE_STEPS[PAGE_STEPS.indexOf(step) + 1] ?? step;
    // The action keeps its page a moment, as a server running it would.
    if (step === 'protection') await new Promise((settle) => setTimeout(settle, 1500));
    response.writeHead(303, {location: `/pages?step=${next}`});
    return response.end();
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) < tolerance;
const browser = await chromium.launch();

async function open(path, {width, scheme, touch = false}) {
  theme = scheme;
  const context = await browser.newContext({viewport: {width, height: 900}, locale: 'ru-RU', colorScheme: scheme, reducedMotion: 'reduce', hasTouch: touch, isMobile: touch});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}${path}`);
  await tab.waitForFunction(() => customElements.get('sf-wizard') && document.querySelector('#w .sf-wizard, .sf-wizard'), null, {timeout: 20000}).catch(() => null);
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  return {tab, context, errors};
}

const settle = async (tab) => { await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null); await tab.waitForTimeout(400); };
const shot = async (tab, name) => { if (shots) await tab.screenshot({path: join(shots, `${name}.png`), fullPage: true}); };

// ------------------------------------------------------------ inline
for (const width of [1440, 390]) {
  for (const scheme of ['light', 'dark']) {
    const tag = `inline-${width}-${scheme}`;
    const {tab, context, errors} = await open('/three', {width, scheme});
    const frame = await tab.evaluate(() => {
      const w = document.getElementById('w');
      const root = w.querySelector('.sf-wizard');
      const rect = (el) => el?.getBoundingClientRect();
      const primary = w.querySelector('.sf-wizard-primary > button');
      const footer = w.querySelector('.sf-wizard-footer');
      const row = w.querySelector('.sf-wizard-steps .sf-steps');
      const compact = w.querySelector('.sf-wizard-compact');
      // The rung's control height, resolved: a probe sized by the variable.
      const probe = document.createElement('div');
      probe.style.blockSize = 'var(--sf-wizard--control)';
      root.append(probe);
      const control = probe.getBoundingClientRect().height;
      probe.remove();
      return {
        role: root.getAttribute('role'), name: root.getAttribute('aria-label'),
        current: row?.querySelector('[aria-current="step"]')?.textContent.trim() ?? '',
        position: w.querySelector('.sf-wizard-compact-label, .sf-wizard-position')?.textContent.trim(),
        back: Boolean(w.querySelector('.sf-wizard-back')),
        primaries: w.querySelectorAll('.sf-wizard-primary').length,
        primaryText: primary?.textContent.trim(),
        primaryEnd: near(rect(primary).right, rect(footer).right, 1),
        primaryHeight: rect(primary).height, control,
        rowShown: row ? getComputedStyle(row).display !== 'none' : false,
        compactShown: compact ? getComputedStyle(compact).display !== 'none' : false,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stepsHidden: [...w.querySelectorAll('sf-wizard-step')].map((step) => step.hidden),
      };
      function near(a, b, t) { return Math.abs(a - b) < t; }
    });
    ok(`${tag}: a region named by the heading`, frame.role === 'region' && frame.name === 'Новый сайт', JSON.stringify([frame.role, frame.name]));
    ok(`${tag}: one primary «Далее» at the footer's end, no Back on step 1`, frame.primaries === 1 && frame.primaryText === 'Далее' && frame.primaryEnd && !frame.back, JSON.stringify(frame));
    ok(`${tag}: the primary is the rung's control height`, frame.control > 0 && near(frame.primaryHeight, frame.control), `${frame.primaryHeight} vs ${frame.control}`);
    ok(`${tag}: only the current step shows`, JSON.stringify(frame.stepsHidden) === '[false,true,true]', JSON.stringify(frame.stepsHidden));
    if (width === 1440) ok(`${tag}: the row with aria-current on the first step`, frame.rowShown && frame.current === 'Название', JSON.stringify([frame.rowShown, frame.current]));
    else ok(`${tag}: narrow, the compact line in place of the row`, !frame.rowShown && frame.compactShown && frame.position === 'Шаг 1 из 3', JSON.stringify(frame));
    ok(`${tag}: no sideways scroll`, frame.scroll <= 0, String(frame.scroll));
    await shot(tab, `${tag}-1`);

    if (scheme === 'light') {
      // Далее with an empty required field.
      await tab.evaluate(() => { window.__invalid = 0; document.getElementById('w').addEventListener('sf-wizard-invalid', () => { window.__invalid += 1; }); });
      await tab.locator('#w .sf-wizard-primary button').click();
      await tab.waitForTimeout(300);
      const invalid = await tab.evaluate(() => ({
        sent: window.__invalid,
        marked: document.querySelector('sf-input[name="title"]').hasAttribute('invalid'),
        message: document.querySelector('sf-input[name="title"]').getAttribute('error-message'),
        focused: document.querySelector('sf-input[name="title"]').contains(document.activeElement),
        still: document.getElementById('w').querySelector('.sf-wizard-title').textContent.trim(),
      }));
      ok(`${tag}: an empty required field is marked, focused and invalid is sent`, invalid.sent === 1 && invalid.marked && invalid.message === 'Заполните это поле.' && invalid.focused && invalid.still === 'Название', JSON.stringify(invalid));
      await tab.locator('sf-input[name="title"] input').fill('Магазин');
      await tab.waitForTimeout(100);
      const unmarked = await tab.evaluate(() => !document.querySelector('sf-input[name="title"]').hasAttribute('invalid'));
      ok(`${tag}: editing the field takes the mark off`, unmarked);
      await tab.evaluate(() => { window.__change = null; document.getElementById('w').addEventListener('sf-wizard-change', (event) => { window.__change = event.detail; }); });
      await tab.locator('#w .sf-wizard-primary button').click();
      await tab.waitForTimeout(500);
      const moved = await tab.evaluate(() => {
        const w = document.getElementById('w');
        return {
          change: window.__change && {previous: window.__change.previous, current: window.__change.current, value: window.__change.value},
          state: w.querySelector('sf-wizard-step[name="name"]').getAttribute('state'),
          title: w.querySelector('.sf-wizard-title').textContent.trim(),
          focus: document.activeElement?.classList.contains('sf-wizard-title'),
          announce: w.querySelector('.sf-wizard-announce').textContent.trim(),
          back: Boolean(w.querySelector('.sf-wizard-back')),
        };
      });
      ok(`${tag}: Далее moves on, marks the step done and says where it went`, moved.state === 'done' && moved.title === 'Шаблон' && moved.back
        && moved.change?.previous === 'name' && moved.change?.current === 'template' && moved.change?.value?.name?.title === 'Магазин', JSON.stringify(moved));
      ok(`${tag}: the focus goes to the step's title, the status line names the step`, moved.focus && moved.announce === 'Шаг 2 из 3: Шаблон', JSON.stringify(moved));
      await shot(tab, `${tag}-2`);
    }
    ok(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------ pages
{
  const {tab, context, errors} = await open('/pages?step=address', {width: 1440, scheme: 'light'});
  await tab.locator('sf-input[name="host"] input').fill('panel.example.ru');
  await Promise.all([tab.waitForURL(/step=notify/u), tab.locator('#w .sf-wizard-primary button').click()]);
  await settle(tab);
  ok('pages: the primary posts the step\'s form with its word', posts.at(-1)?.step === 'address' && posts.at(-1)?.body['wizard-action'] === 'next' && posts.at(-1)?.body.host === 'panel.example.ru', JSON.stringify(posts.at(-1)));
  await Promise.all([tab.waitForURL(/step=protection/u), tab.locator('#w .sf-wizard-skip button').click()]);
  await settle(tab);
  ok('pages: Skip posts skip without validating the required field', posts.at(-1)?.step === 'notify' && posts.at(-1)?.body['wizard-action'] === 'skip', JSON.stringify(posts.at(-1)));
  const primaryText = await tab.evaluate(() => document.querySelector('#w .sf-wizard-primary button').textContent.trim());
  ok('pages: an action step\'s primary is «Запустить»', primaryText === 'Запустить', primaryText);
  // While the post is on its way the page cannot be asked (the driver waits
  // for the navigation): the page reports the running step itself.
  const reported = new Promise((settle) => {
    tab.on('console', (message) => { if (message.text().startsWith('wizard-running ')) settle(JSON.parse(message.text().slice(15))); });
    setTimeout(() => settle({}), 5000);
  });
  await tab.evaluate(() => {
    const step = document.querySelector('sf-wizard-step[name="protection"]');
    new MutationObserver(() => {
      if (step.getAttribute('state') !== 'running') return;
      setTimeout(() => console.log(`wizard-running ${JSON.stringify({
        state: step.getAttribute('state'),
        line: Boolean(document.querySelector('#w .sf-wizard-running')),
        busy: document.querySelector('#w .sf-wizard-body')?.getAttribute('aria-busy'),
      })}`), 100);
    }).observe(step, {attributes: true});
  });
  await tab.locator('#w .sf-wizard-primary button').click({noWaitAfter: true});
  const running = await reported;
  ok('pages: the action shows running while the server works', running.state === 'running' && running.line && running.busy === 'true', JSON.stringify(running));
  await tab.waitForURL(/step=done/u, {timeout: 10000}).catch(() => null);
  await settle(tab);
  ok('pages: the action posted run', posts.at(-1)?.step === 'protection' && posts.at(-1)?.body['wizard-action'] === 'run', JSON.stringify(posts.at(-1)));
  ok('pages: no page errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------ modal
for (const scheme of ['light', 'dark']) {
  const tag = `modal-${scheme}`;
  const {tab, context, errors} = await open('/csv', {width: 1440, scheme});
  await tab.evaluate(() => { window.__done = null; document.getElementById('w').addEventListener('sf-wizard-completed', (event) => { window.__done = event.detail; }); });
  await tab.locator('#open button').click();
  await settle(tab);
  const opened = await tab.evaluate(() => Boolean(document.querySelector('.sf-wizard-window .sf-wizard')) && document.getElementById('w').hasAttribute('open'));
  ok(`${tag}: the trigger opens the window`, opened);
  await tab.locator('sf-input[name="file"] input').fill('contacts.csv');
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(400);
  const asked = await tab.evaluate(() => ({ask: Boolean(document.querySelector('.sf-wizard-confirm')), open: document.getElementById('w').hasAttribute('open')}));
  ok(`${tag}: Escape with unsent input asks first`, asked.ask && asked.open, JSON.stringify(asked));
  await shot(tab, `${tag}-ask`);
  await tab.locator('.sf-wizard-confirm button', {hasText: 'Остаться'}).click();
  await tab.waitForTimeout(300);
  for (let press = 0; press < 3; press += 1) {
    await tab.locator('.sf-wizard-window .sf-wizard-primary button').click();
    await tab.waitForTimeout(400);
  }
  const done = await tab.evaluate(() => ({detail: window.__done, open: document.getElementById('w').hasAttribute('open')}));
  ok(`${tag}: the import ends in completed with one value and the window closes`, done.detail?.value?.upload?.file === 'contacts.csv' && !done.open, JSON.stringify(done));
  ok(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------ column
for (const scheme of ['light', 'dark']) {
  const tag = `column ${scheme}`;
  const {tab, context, errors} = await open('/thirty', {width: 1280, scheme});
  const read = () => tab.evaluate(() => {
    const w = document.querySelector('#w'); const scroller = w.querySelector('.sf-wizard-column-scroll');
    const item = scroller?.querySelector('[aria-current="step"]'); const view = scroller?.getBoundingClientRect(); const box = item?.getBoundingClientRect();
    return {
      column: w.querySelector('.sf-wizard-column')?.getBoundingClientRect().height ?? -1,
      body: w.querySelector('.sf-wizard-body').getBoundingClientRect().height,
      scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight : false,
      inView: Boolean(box && box.top >= view.top - 1 && box.bottom <= view.bottom + 1),
      head: w.querySelector('.sf-wizard-head').getBoundingClientRect().top - w.querySelector('.sf-wizard').getBoundingClientRect().top,
      page: globalThis.scrollY,
      look: scroller?.closest('.sf-scrollbar')?.getAttribute('data-mode') ?? '',
    };
  });
  const first = await read();
  ok(`${tag}: 30 steps beside a short body do not make the wizard taller`, first.column > 0 && first.column <= first.body + 1, JSON.stringify(first));
  ok(`${tag}: the column scrolls inside, an sf-scrollbar in standard mode`, first.scrolls && first.look === 'standard', JSON.stringify(first));
  ok(`${tag}: the current step (18) is in view on load, the page not scrolled`, first.inView && first.page === 0, JSON.stringify(first));
  await tab.locator('#w .sf-wizard-column-scroll .sf-wizard-list-step').first().click();
  await tab.waitForTimeout(700);
  const back = await read();
  ok(`${tag}: a move to step 1 brings it into view, the head stays`, back.inView && back.page === 0 && near(back.head, first.head), JSON.stringify(back));
  await tab.evaluate(() => document.querySelector('#w').setAttribute('current', 's30'));
  await tab.waitForTimeout(700);
  const last = await read();
  ok(`${tag}: a move to step 30 brings it into view`, last.inView && last.page === 0 && last.column <= last.body + 1, JSON.stringify(last));
  ok(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
  await shot(tab, `column-${scheme}`);
  await context.close();
}

// ------------------------------------------------------------ touch
{
  const {tab, context, errors} = await open('/three', {width: 390, scheme: 'light', touch: true});
  const heights = await tab.evaluate(() => [...document.querySelectorAll('#w .sf-wizard-footer button, #w .sf-wizard-compact button')].map((el) => el.getBoundingClientRect().height));
  ok('touch: the footer\'s and the head\'s buttons are at least 44 px', heights.length > 0 && heights.every((h) => h >= 43.5), JSON.stringify(heights));
  ok('touch: no page errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((one) => !one.pass);
for (const one of results) console.log(`${one.pass ? 'ok  ' : 'FAIL'} ${one.name}${one.pass ? '' : ` -- ${one.detail}`}`);
console.log(`${results.length - failed.length}/${results.length} wizard checks`);
if (failed.length) process.exit(1);
