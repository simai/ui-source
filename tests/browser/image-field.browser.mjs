#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-image-field (simai/ui-source#27), measured on the built bytes:
// - the group is named by its label and described by its help or error, the
//   thumbnail's alt is the description (empty without one: 1.4.0, never the
//   file name), «Заменить…» and «Выбрать…» are real buttons and remove is an
//   icon button (sf-button-icon, IF-9), each named for the image;
// - Tab goes replace -> remove -> out (the drop target takes no focus); Enter
//   on remove empties the field, sends input and change once each, says so
//   politely and puts focus on «Выбрать…»;
// - «Заменить…» opens the platform dialog, a file chosen there replaces the
//   image (source input) and its size and dimensions show;
// - a file dragged over draws the drop state, dropped it replaces the image
//   (source drop) and the form gets the File from the host (§17.1, the
//   native input carries no name); a PDF is refused, with its name said;
// - disabled and read-only take no file; required holds the form while empty;
// - at 1000 and 390 wide: the thumbnail is the control height one rung up for
//   each of the three sizes, the inset the field's own, the buttons one rung
//   down, nothing overflows, and on the narrow column the buttons go under the
//   name.
// - «Изменить» (edit="crop,focus") opens the editor in a window over the page
//   (C125, sf-modal), with the frame / focal point buttons, the stage in focus
//   and zoom; «Готово» writes crop and focus into the value (one input, one
//   change, source edit); «Отмена», Escape and the scrim leave it; focus comes
//   back to «Изменить» each time; the window's sf-modal-* events stay in the
//   field; at 1000 the window is centred and 40rem wide, at 390 it is the
//   whole screen.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
// The window (sf-modal) stands by its utilities (fixed, inset, flex), as a page
// with the loader gets them: the full utility sheet stands in for them.
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'component/component/modal/css/modal.css', 'smart/smart/input-image/css/input-image.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', 'smart/smart/modal/js/modal.js', 'smart/smart/input-image/js/input-image.js'];
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
      <sf-input-image id="filled" label="Логотип" name="logo" hint="PNG или SVG" value='${stored('logo.svg', 900, 300, 2048)}'></sf-input-image>
      <sf-input-image id="empty" label="Обложка" name="cover" required></sf-input-image>
      <sf-input-image id="err" label="Баннер" invalid error-message="Нужно изображение шире 600 px" value='${stored('banner.svg', 300, 100, 1500)}'></sf-input-image>
      <sf-input-image id="ro" label="Только чтение" readonly value='${stored('ro.svg', 40, 40, 900)}'></sf-input-image>
      <sf-input-image id="dis" label="Отключено" disabled value='${stored('dis.svg', 40, 40, 900)}'></sf-input-image>
      <sf-input-image id="s-half" size="1/2" label="1/2" value='${stored('half.svg', 40, 40, 900)}'></sf-input-image>
      <sf-input-image id="s-one" size="1" label="1" value='${stored('one.svg', 40, 40, 900)}'></sf-input-image>
      <sf-input-image id="s-two" size="2" label="2" value='${stored('two.svg', 40, 40, 900)}'></sf-input-image>
      <sf-input-image id="ed" layout="preview" aspect="16/9" label="Обложка" edit="crop focus" value='${stored('cover.svg', 1600, 900, 4096)}'></sf-input-image>
    </form>
    <button id="after" type="button">После</button>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-input-image') && customElements.get('sf-button') && customElements.get('sf-button-icon') && customElements.get('sf-modal'), null, {timeout: 8000});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__events = [];
    window.__windowEvents = [];
    for (const type of ['sf-modal-open', 'sf-modal-opened', 'sf-modal-close', 'sf-modal-closed']) {
      document.addEventListener(type, () => window.__windowEvents.push(type));
    }
    for (const type of ['input', 'change', 'sf-image-field:select', 'sf-image-field:remove', 'sf-image-field:reject']) {
      document.addEventListener(type, (event) => {
        const host = event.target.closest?.('sf-input-image');
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
      return button ? {name: button.getAttribute('aria-label'), text: button.textContent.trim(), disabled: button.disabled,
        tag: button.closest('sf-button, sf-button-icon')?.localName ?? null} : null;
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
      focused: document.activeElement?.closest?.('sf-button, sf-button-icon')?.className ?? document.activeElement?.id ?? null,
      formFile: (() => {
        const sent = host.form ? new FormData(host.form).get(host.getAttribute('name')) : null;
        return sent instanceof File ? sent.name : sent;
      })(),
    };
  }, id);

  // Names, roles and descriptions.
  const filled = await state('filled');
  if (filled.role !== 'group' || filled.groupName !== 'Логотип' || filled.description !== 'PNG или SVG' || filled.alt !== ''
    || filled.replace?.name !== 'Заменить изображение «logo.svg»' || filled.replace?.text !== 'Заменить…'
    || filled.remove?.name !== 'Убрать изображение «logo.svg»' || filled.remove?.tag !== 'sf-button-icon'
    || filled.wellTabIndex !== null || filled.meta !== '900×300 · 2 КБ' || filled.inputTab !== -1 || filled.inputDisplay === 'none') note({case: 'filled field names and meta', got: filled});
  const empty = await state('empty');
  if (empty.value !== null || empty.choose?.name !== 'Выбрать изображение' || empty.choose?.text !== 'Выбрать…' || empty.name !== 'Изображение не выбрано'
    || empty.groupName !== 'Обложка *' || !empty.inputRequired) note({case: 'empty field invites a choice and holds the form', got: empty});
  const formValid = await page.evaluate(() => document.getElementById('form').checkValidity());
  if (formValid) note({case: 'a required, empty field keeps the form from submitting', got: formValid});
  const err = await state('err');
  if (err.invalid !== 'true' || err.description !== 'Нужно изображение шире 600 px') note({case: 'error state', got: err});
  const ro = await state('ro');
  if (ro.replace || ro.remove || ro.choose || ro.alt !== '' || ro.name !== 'ro.svg') note({case: 'read-only has no buttons', got: ro});
  const dis = await state('dis');
  if (!dis.replace?.disabled || !dis.remove?.disabled) note({case: 'disabled buttons', got: dis});

  // Keyboard: replace, remove, then out of the field; the well is no stop.
  await page.focus('#before');
  const order = [];
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const element = document.activeElement;
      const host = element?.closest?.('sf-input-image');
      return host ? `${host.id}:${element.closest('sf-button, sf-button-icon')?.className.split(' ')[0] ?? element.className}` : element?.id;
    }));
  }
  if (order.join(',') !== 'filled:sf-image-field-replace,filled:sf-image-field-remove,empty:sf-image-field-choose,err:sf-image-field-replace') note({case: 'tab order', got: order});

  // Enter on remove: empty, input + change once, said, focus on «Выбрать…».
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
  if (accept !== 'image/*' || picked.value?.label !== 'photo.png' || picked.src !== 'blob:' || picked.meta !== `2×1 · ${PNG.length} Б` || picked.alt !== ''
    || picked.live !== 'Выбрано изображение «photo.png»') note({case: 'choose through the dialog', got: {accept, picked}});
  const pickTypes = pickEvents.map((event) => `${event.type}:${event.source}:${event.file}:${event.target}`);
  if (pickTypes.join(',') !== 'input:input:photo.png:true,change:input:photo.png:true,sf-image-field:select:input:photo.png:true') note({case: 'one input and one change from the host, with the File', got: pickEvents});

  // Drag a file over: the drop state; drop it: replaced, the form gets the File.
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
  if (!over.dragover || over.name !== 'Отпустите файл, чтобы поставить его' || overPaint !== 'dashed') note({case: 'drop state is drawn', got: {over, overPaint}});
  await drag('filled', 'drop', 'dropped.png', 'image/png');
  await page.waitForTimeout(300);
  const dropped = await state('filled');
  const dropEvents = (await events()).filter((event) => event.id === 'filled').map((event) => `${event.type}:${event.source}`);
  if (dropped.dragover || dropped.value?.label !== 'dropped.png' || dropped.formFile !== 'dropped.png' || dropEvents.join(',') !== 'input:drop,change:drop,sf-image-field:select:drop') note({case: 'drop replaces', got: {dropped, dropEvents}});
  await drag('filled', 'drop', 'brief.pdf', 'application/pdf');
  await page.waitForTimeout(300);
  const refused = await state('filled');
  const refuseEvents = (await events()).map((event) => event.type);
  if (refused.value?.label !== 'dropped.png' || refuseEvents.join(',') !== 'sf-image-field:reject' || refused.live !== '«brief.pdf» не подходит: можно изображения') note({case: 'a PDF is refused and said', got: {refused, refuseEvents}});
  for (const id of ['dis', 'ro']) {
    await drag(id, 'drop', 'x.png', 'image/png');
    await page.waitForTimeout(150);
    const after = await state(id);
    if (after.value?.label !== `${id}.svg`) note({case: `${id} takes no file`, got: after});
  }
  if ((await events()).length) note({case: 'disabled and read-only send nothing'});

  // The editor's window (C125), at 1000 and at 390.
  const editor = () => page.evaluate(() => {
    const host = document.getElementById('ed');
    const content = document.querySelector('[data-sf-modal-portal] .sf-image-field-editor');
    const root = content?.closest('[data-sf-modal-portal]')?.querySelector('[data-sf-modal-state]');
    const panel = content?.closest('[data-sf-modal-panel]');
    const box = panel?.getBoundingClientRect();
    const round = (number) => Math.round(number * 100) / 100;
    const active = document.activeElement;
    return {
      open: Boolean(root && root.getAttribute('data-sf-modal-state') === 'open' && box && box.width > 0),
      inField: Boolean(host.querySelector('.sf-image-field .sf-image-field-editor, .sf-image-field-stage')),
      heading: panel?.querySelector('[id$="title"], h2, [data-sf-modal-title]')?.textContent.trim() ?? null,
      modes: Array.from(content?.querySelectorAll('.sf-image-field-editor-modes sf-button button') ?? []).map((button) => `${button.closest('sf-button')?.getAttribute('text')}:${button.getAttribute('aria-pressed') ?? button.closest('sf-button')?.getAttribute('aria-pressed')}`),
      zoom: Array.from(content?.querySelectorAll('.sf-image-field-editor-zoom button') ?? []).map((button) => button.getAttribute('aria-label')),
      footer: Array.from(panel?.querySelectorAll('.sf-modal-footer sf-button') ?? []).map((button) => `${button.querySelector('button')?.textContent.trim()}:${button.getAttribute('appearance') ?? 'filled'}`),
      stageFocused: active?.classList?.contains('sf-image-field-stage') ?? false,
      editFocused: Boolean(active?.closest?.('#ed .sf-image-field-edit')),
      panel: box ? {left: round(box.left), right: round(window.innerWidth - box.right), top: round(box.top), bottom: round(window.innerHeight - box.bottom), width: round(box.width), height: round(box.height)} : null,
      h0: (() => {
        const probe = document.createElement('div');
        probe.style.inlineSize = 'var(--sf-h0)';
        document.body.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width;
      })(),
      viewport: {width: window.innerWidth, height: window.innerHeight},
      value: host.value,
      edit: host.querySelector('.sf-image-field-edit button')?.getAttribute('aria-haspopup') ?? host.querySelector('.sf-image-field-edit')?.getAttribute('aria-haspopup'),
    };
  });
  const openEditor = async () => {
    await page.click('#ed .sf-image-field-edit button');
    await page.waitForFunction(() => document.querySelector('[data-sf-modal-portal] .sf-image-field-editor')?.closest('[data-sf-modal-panel]')?.getBoundingClientRect().width > 0, null, {timeout: 4000}).catch(() => {});
    await page.waitForTimeout(500);
    return editor();
  };
  const closed = async () => {
    await page.waitForTimeout(600);
    return editor();
  };
  const windows = {};
  await events();
  for (const width of [1000, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(300);
    const before = (await editor()).value;
    const opened = await openEditor();
    windows[width] = opened;
    if (!opened.open || opened.inField || opened.heading !== 'Изменить изображение' || opened.modes.join(',') !== 'Кадр:true,Точка фокуса:false'
      || opened.zoom.join(',') !== 'Уменьшить,Увеличить' || opened.footer.join(',') !== 'Отмена:ghost,Готово:filled' || !opened.stageFocused || opened.edit !== 'dialog') note({case: `${width}: «Изменить» opens the window`, got: opened});
    const fits = width === 1000
      ? Math.abs(opened.panel?.width - opened.h0) < 1 && Math.abs(opened.panel.left - opened.panel.right) < 1
      : opened.panel?.width === opened.viewport.width && opened.panel.height === opened.viewport.height && opened.panel.left === 0 && opened.panel.top === 0;
    if (!fits) note({case: `${width}: the window is ${width === 1000 ? 'centred, 40rem' : 'the whole screen'}`, got: opened.panel, h0: opened.h0, viewport: opened.viewport});
    // Escape leaves the value.
    await page.keyboard.press('+');
    await page.keyboard.press('Escape');
    const escaped = await closed();
    if (escaped.open || JSON.stringify(escaped.value) !== JSON.stringify(before) || !escaped.editFocused) note({case: `${width}: Escape cancels, focus on «Изменить»`, got: escaped});
    // «Отмена» leaves it.
    await openEditor();
    await page.keyboard.press('+');
    await page.click('[data-sf-modal-portal] .sf-image-field-editor-cancel button');
    const cancelled = await closed();
    if (cancelled.open || JSON.stringify(cancelled.value) !== JSON.stringify(before) || !cancelled.editFocused) note({case: `${width}: «Отмена» cancels, focus on «Изменить»`, got: cancelled});
    // The scrim leaves it (no scrim shows around the whole-screen window).
    if (width === 1000) {
      await openEditor();
      await page.keyboard.press('+');
      await page.mouse.click(5, 5);
      const outside = await closed();
      if (outside.open || JSON.stringify(outside.value) !== JSON.stringify(before) || !outside.editFocused) note({case: `${width}: the scrim cancels, focus on «Изменить»`, got: outside});
    }
    if ((await events()).length) note({case: `${width}: a cancelled edit sends nothing`});
    // «Готово» writes the frame and the focal point.
    await openEditor();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    await page.click('[data-sf-modal-portal] .sf-image-field-editor-modes sf-button:nth-child(2) button');
    await page.waitForTimeout(200);
    await page.focus('[data-sf-modal-portal] .sf-image-field-stage');
    await page.keyboard.press('Shift+ArrowUp');
    await page.click('[data-sf-modal-portal] .sf-image-field-editor-done button');
    const done = await closed();
    const doneEvents = (await events()).filter((event) => event.id === 'ed').map((event) => `${event.type}:${event.source}`);
    const crop = done.value?.crop;
    const focus = done.value?.focus;
    const expectedZoom = Math.round(((before?.crop?.zoom ?? 1) + 0.2) * 100) / 100;
    if (done.open || !crop || crop.aspect !== '16/9' || crop.zoom !== expectedZoom || !focus || !done.editFocused
      || doneEvents.join(',') !== 'input:edit,change:edit') note({case: `${width}: «Готово» writes crop and focus, focus on «Изменить»`, got: {done, doneEvents, expectedZoom}});
  }
  const leaked = await page.evaluate(() => window.__windowEvents.splice(0));
  if (leaked.length) note({case: 'the window\'s sf-modal-* events leave the field', got: leaked});
  await page.setViewportSize({width: 1000, height: 900});
  await page.waitForTimeout(300);

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
  console.log(JSON.stringify({filled, empty, err, order, removed, picked, dropped, measured, windows}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('IMAGE_FIELD_OK');
