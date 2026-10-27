#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-image-field (simai/ui-source#27), measured on the built bytes:
// - the group is named by its label and described by its help or error, the
//   thumbnail's alt is the file name, «Заменить…», «Убрать» and «Выбрать…» are
//   real buttons named for the image;
// - Tab goes replace -> remove -> out (the drop target takes no focus); Enter
//   on «Убрать» empties the field, sends input and change once each, says so
//   politely and puts focus on «Выбрать…»;
// - «Заменить…» opens the platform dialog, a file chosen there replaces the
//   image (source input) and its size and dimensions show;
// - a file dragged over draws the drop state, dropped it replaces the image
//   (source drop) and goes into the form input; a PDF is refused and said;
// - disabled and read-only take no file; required holds the form while empty;
// - at 1000 and 390 wide: the thumbnail is the control height one rung up for
//   each of the three sizes, the inset the field's own, the buttons one rung
//   down, nothing overflows, and on the narrow column the buttons go under the
//   name.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'smart/smart/image-field/css/image-field.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/image-field/js/image-field.js'];
const failures = [];
const note = (detail) => failures.push(detail);

const svg = (width, height) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#5b8def"/></svg>`)}`;
const stored = (label, width, height, size) => JSON.stringify({value: label, label, mime: 'image/svg+xml', size, href: svg(width, height)}).replace(/'/gu, '&#39;');
// A 2×1 PNG, written out so the probe brings its own picture.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGNgYPj/n4GBgQEADvQB/wGUz3IAAAAASUVORK5CYII=', 'base64');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px">
    <button id="before" type="button">До</button>
    <form id="form" style="display:grid;gap:24px;max-width:640px">
      <sf-image-field id="filled" label="Логотип" name="logo" hint="PNG или SVG" value='${stored('logo.svg', 900, 300, 2048)}'></sf-image-field>
      <sf-image-field id="empty" label="Обложка" name="cover" required></sf-image-field>
      <sf-image-field id="err" label="Баннер" invalid error-message="Нужно изображение шире 600 px" value='${stored('banner.svg', 300, 100, 1500)}'></sf-image-field>
      <sf-image-field id="ro" label="Только чтение" readonly value='${stored('ro.svg', 40, 40, 900)}'></sf-image-field>
      <sf-image-field id="dis" label="Отключено" disabled value='${stored('dis.svg', 40, 40, 900)}'></sf-image-field>
      <sf-image-field id="s-half" size="1/2" label="1/2" value='${stored('half.svg', 40, 40, 900)}'></sf-image-field>
      <sf-image-field id="s-one" size="1" label="1" value='${stored('one.svg', 40, 40, 900)}'></sf-image-field>
      <sf-image-field id="s-two" size="2" label="2" value='${stored('two.svg', 40, 40, 900)}'></sf-image-field>
    </form>
    <button id="after" type="button">После</button>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-image-field') && customElements.get('sf-button'), null, {timeout: 8000});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__events = [];
    for (const type of ['input', 'change', 'sf-image-field:select', 'sf-image-field:remove', 'sf-image-field:reject']) {
      document.addEventListener(type, (event) => {
        const host = event.target.closest?.('sf-image-field');
        if (!host) return;
        window.__events.push({type, id: host.id, target: event.target === host, source: event.detail?.source ?? null,
          file: event.detail?.file?.name ?? null, label: event.detail?.value?.label ?? null});
      });
    }
  });
  const events = () => page.evaluate(() => window.__events.splice(0));

  const state = (id) => page.evaluate((key) => {
    const host = document.getElementById(key);
    const well = host.querySelector('.sf-image-field-well');
    const named = (selector) => {
      const button = host.querySelector(`${selector} button`);
      return button ? {name: button.getAttribute('aria-label'), text: button.textContent.trim(), disabled: button.disabled} : null;
    };
    const labelledby = well?.getAttribute('aria-labelledby');
    const describedby = well?.getAttribute('aria-describedby');
    const input = host.querySelector('.sf-image-field-input');
    return {
      value: host.value, role: well?.getAttribute('role'),
      groupName: labelledby ? document.getElementById(labelledby)?.textContent.replace(/\s+/gu, ' ').trim() : well?.getAttribute('aria-label'),
      description: describedby ? document.getElementById(describedby)?.textContent.trim() : null,
      invalid: well?.getAttribute('aria-invalid'), wellTabIndex: well?.getAttribute('tabindex'),
      alt: host.querySelector('.sf-image-field-image')?.getAttribute('alt') ?? null,
      src: host.querySelector('.sf-image-field-image')?.getAttribute('src')?.slice(0, 5) ?? null,
      name: host.querySelector('.sf-image-field-name')?.textContent.trim(),
      meta: host.querySelector('.sf-image-field-meta')?.textContent.trim() ?? null,
      replace: named('.sf-image-field-replace'), remove: named('.sf-image-field-remove'), choose: named('.sf-image-field-choose'),
      live: host.querySelector('.sf-image-field-live')?.textContent.trim(),
      dragover: host.querySelector('.sf-image-field')?.classList.contains('dragover'),
      inputRequired: input?.required, inputFiles: input?.files?.length ?? 0, inputTab: input?.tabIndex, inputDisplay: input ? getComputedStyle(input).display : null,
      focused: document.activeElement?.closest?.('sf-button')?.className ?? document.activeElement?.id ?? null,
    };
  }, id);

  // Names, roles and descriptions.
  const filled = await state('filled');
  if (filled.role !== 'group' || filled.groupName !== 'Логотип' || filled.description !== 'PNG или SVG' || filled.alt !== 'logo.svg'
    || filled.replace?.name !== 'Заменить изображение «logo.svg»' || filled.replace?.text !== 'Заменить…'
    || filled.remove?.name !== 'Убрать изображение «logo.svg»' || filled.remove?.text !== 'Убрать'
    || filled.wellTabIndex !== null || filled.meta !== '900×300 · 2 КБ' || filled.inputTab !== -1 || filled.inputDisplay === 'none') note({case: 'filled field names and meta', got: filled});
  const empty = await state('empty');
  if (empty.value !== null || empty.choose?.name !== 'Выбрать изображение' || empty.choose?.text !== 'Выбрать…' || empty.name !== 'Изображение не выбрано'
    || empty.groupName !== 'Обложка *' || !empty.inputRequired) note({case: 'empty field invites a choice and holds the form', got: empty});
  const formValid = await page.evaluate(() => document.getElementById('form').checkValidity());
  if (formValid) note({case: 'a required, empty field keeps the form from submitting', got: formValid});
  const err = await state('err');
  if (err.invalid !== 'true' || err.description !== 'Нужно изображение шире 600 px') note({case: 'error state', got: err});
  const ro = await state('ro');
  if (ro.replace || ro.remove || ro.choose || ro.alt !== 'ro.svg') note({case: 'read-only has no buttons', got: ro});
  const dis = await state('dis');
  if (!dis.replace?.disabled || !dis.remove?.disabled) note({case: 'disabled buttons', got: dis});

  // Keyboard: replace, remove, then out of the field; the well is no stop.
  await page.focus('#before');
  const order = [];
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const element = document.activeElement;
      const host = element?.closest?.('sf-image-field');
      return host ? `${host.id}:${element.closest('sf-button')?.className.split(' ')[0] ?? element.className}` : element?.id;
    }));
  }
  if (order.join(',') !== 'filled:sf-image-field-replace,filled:sf-image-field-remove,empty:sf-image-field-choose,err:sf-image-field-replace') note({case: 'tab order', got: order});

  // Enter on «Убрать»: empty, input + change once, said, focus on «Выбрать…».
  await page.focus('#filled .sf-image-field-remove button');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const removed = await state('filled');
  const removeEvents = await events();
  if (removed.value !== null || removed.focused !== 'sf-image-field-choose' || removed.live !== 'Изображение убрано') note({case: 'remove by keyboard', got: removed});
  const removeTypes = removeEvents.filter((event) => event.id === 'filled').map((event) => `${event.type}:${event.source ?? ''}`);
  if (removeTypes.join(',') !== 'input:remove,change:remove,sf-image-field:remove:') note({case: 'remove events', got: removeEvents});

  // «Выбрать…» opens the platform dialog; the chosen file replaces the image.
  // Playwright takes over the dialog only once something listens for it, and
  // the listener is set up asynchronously: one armed together with the click
  // missed the dialog. It is armed here, before the click.
  const choosers = [];
  page.on('filechooser', (opened) => choosers.push(opened));
  await page.waitForTimeout(300);
  await page.click('#filled .sf-image-field-choose button');
  await page.waitForTimeout(500);
  const [chooser = null] = choosers;
  if (!chooser) note({case: '«Выбрать…» opens no file dialog', got: await state('filled')});
  const accept = chooser ? await chooser.element().getAttribute('accept') : null;
  if (chooser) await chooser.setFiles({name: 'photo.png', mimeType: 'image/png', buffer: PNG});
  else await page.setInputFiles('#filled .sf-image-field-input', {name: 'photo.png', mimeType: 'image/png', buffer: PNG});
  await page.waitForTimeout(500);
  const picked = await state('filled');
  const pickEvents = (await events()).filter((event) => event.id === 'filled');
  if (accept !== 'image/*' || picked.value?.label !== 'photo.png' || picked.src !== 'blob:' || picked.meta !== `2×1 · ${PNG.length} Б` || picked.alt !== 'photo.png'
    || picked.live !== 'Выбрано изображение «photo.png»') note({case: 'choose through the dialog', got: {accept, picked}});
  const pickTypes = pickEvents.map((event) => `${event.type}:${event.source}:${event.file}:${event.target}`);
  if (pickTypes.join(',') !== 'input:input:photo.png:true,change:input:photo.png:true,sf-image-field:select:input:photo.png:true') note({case: 'one input and one change from the host, with the File', got: pickEvents});

  // Drag a file over: the drop state; drop it: replaced, in the form input.
  const drag = async (id, type, name, mime) => page.evaluate(({key, kind, file, mimeType}) => {
    const well = document.querySelector(`#${key} .sf-image-field-well`);
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], file, {type: mimeType}));
    well.dispatchEvent(new DragEvent(kind, {bubbles: true, cancelable: true, dataTransfer: transfer}));
  }, {key: id, kind: type, file: name, mimeType: mime});
  await drag('filled', 'dragenter', 'dropped.png', 'image/png');
  await drag('filled', 'dragover', 'dropped.png', 'image/png');
  await page.waitForTimeout(200);
  const over = await state('filled');
  const overPaint = await page.evaluate(() => getComputedStyle(document.querySelector('#filled .sf-image-field-well')).borderTopStyle);
  if (!over.dragover || over.name !== 'Отпустите файл, чтобы поставить его' || overPaint !== 'solid') note({case: 'drop state is drawn', got: {over, overPaint}});
  await drag('filled', 'drop', 'dropped.png', 'image/png');
  await page.waitForTimeout(300);
  const dropped = await state('filled');
  const dropEvents = (await events()).filter((event) => event.id === 'filled').map((event) => `${event.type}:${event.source}`);
  if (dropped.dragover || dropped.value?.label !== 'dropped.png' || dropped.inputFiles !== 1 || dropEvents.join(',') !== 'input:drop,change:drop,sf-image-field:select:drop') note({case: 'drop replaces', got: {dropped, dropEvents}});
  await drag('filled', 'drop', 'brief.pdf', 'application/pdf');
  await page.waitForTimeout(300);
  const refused = await state('filled');
  const refuseEvents = (await events()).map((event) => event.type);
  if (refused.value?.label !== 'dropped.png' || refuseEvents.join(',') !== 'sf-image-field:reject' || !refused.live.startsWith('Этот файл не подходит')) note({case: 'a PDF is refused and said', got: {refused, refuseEvents}});
  for (const id of ['dis', 'ro']) {
    await drag(id, 'drop', 'x.png', 'image/png');
    await page.waitForTimeout(150);
    const after = await state(id);
    if (after.value?.label !== `${id}.svg`) note({case: `${id} takes no file`, got: after});
  }
  if ((await events()).length) note({case: 'disabled and read-only send nothing'});

  // Sizes on the ladder, at 1000 and 390.
  const geometry = () => page.evaluate(() => {
    const px = (name) => {
      const probe = document.createElement('div');
      probe.style.blockSize = `var(${name})`;
      document.body.append(probe);
      const value = probe.getBoundingClientRect().height;
      probe.remove();
      return Math.round(value * 100) / 100;
    };
    const measure = (id) => {
      const host = document.getElementById(id);
      const box = (selector) => host.querySelector(selector)?.getBoundingClientRect();
      const well = box('.sf-image-field-well');
      const thumb = box('.sf-image-field-thumb');
      const body = box('.sf-image-field-body');
      const actions = box('.sf-image-field-actions');
      const button = box('.sf-image-field-replace button');
      const style = getComputedStyle(host.querySelector('.sf-image-field-well'));
      const element = host.querySelector('.sf-image-field-well');
      return {thumb: Math.round(thumb.width * 100) / 100, thumbHeight: Math.round(thumb.height * 100) / 100,
        inset: parseFloat(style.paddingTop), insetStart: parseFloat(style.paddingInlineStart), button: Math.round(button.height * 100) / 100,
        actionsBelow: actions.top >= body.bottom - 1, actionsAtBodyStart: Math.abs(actions.left - body.left) < 1,
        overflow: element.scrollWidth > element.clientWidth || well.right > document.documentElement.clientWidth};
    };
    return {
      ladder: {
        control: {'1/2': px('--sf-ui-1\\/2--control-height'), 1: px('--sf-ui-1--control-height'), 2: px('--sf-ui-2--control-height'), 3: px('--sf-ui-3--control-height')},
        inset: {'1/2': px('--sf-ui-1\\/2--space-y-tightness-default') - 1, 1: px('--sf-ui-1--space-y-tightness-default') - 1, 2: px('--sf-ui-2--space-y-tightness-default') - 1},
      },
      half: measure('s-half'), one: measure('s-one'), two: measure('s-two'), filled: measure('err'),
      scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  // The button heights the field's buttons must have: a plain sf-button of the
  // rung below, measured beside them at each width. (A class marks them: an
  // sf-button hands its data- attributes to its inner button.)
  await page.evaluate(() => {
    for (const size of ['1/3', '1/2', '1']) {
      const probe = document.createElement('sf-button');
      probe.setAttribute('size', size);
      probe.setAttribute('text', 'Заменить…');
      probe.setAttribute('appearance', 'outline');
      probe.className = `ladder ladder-${size.replace('/', '-')}`;
      document.body.append(probe);
    }
  });
  await page.waitForTimeout(400);
  const ladderButtons = () => page.evaluate(() => Object.fromEntries(['1/3', '1/2', '1'].map((size) => [size,
    Math.round(document.querySelector(`sf-button.ladder-${size.replace('/', '-')} button`).getBoundingClientRect().height * 100) / 100])));
  const measured = {};
  for (const width of [1000, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(300);
    const got = await geometry();
    const buttons = await ladderButtons();
    got.buttons = buttons;
    measured[width] = got;
    const rungs = [['half', '1/2', 1, '1/3'], ['one', '1', 2, '1/2'], ['two', '2', 3, '1']];
    for (const [key, size, up, buttonSize] of rungs) {
      const field = got[key];
      const thumb = got.ladder.control[up];
      if (field.thumb !== thumb || field.thumbHeight !== thumb) note({case: `${width}: size ${size} thumbnail is the control height one rung up`, got: field.thumb, expected: thumb});
      if (Math.abs(field.inset - got.ladder.inset[size]) > 0.01 || field.inset !== field.insetStart) note({case: `${width}: size ${size} inset`, got: field.inset, expected: got.ladder.inset[size]});
      if (field.button !== buttons[buttonSize]) note({case: `${width}: size ${size} buttons are size ${buttonSize}`, got: field.button, expected: buttons[buttonSize]});
      if (field.overflow) note({case: `${width}: size ${size} overflows`});
    }
    if (got.scroll) note({case: `${width}: the page scrolls sideways`});
    const narrow = width === 390;
    if (got.filled.actionsBelow !== narrow || (narrow && !got.filled.actionsAtBodyStart)) note({case: `${width}: buttons ${narrow ? 'under the name, at its start' : 'on the row'}`, got: got.filled});
  }
  if (errors.length) note({case: 'page errors', got: errors});
  console.log(JSON.stringify({filled, empty, err, order, removed, picked, dropped, measured}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('IMAGE_FIELD_OK');
