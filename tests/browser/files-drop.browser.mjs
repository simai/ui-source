#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Framework order FO-1 (the view set study, ui-control control/research/
// 2026-11-17-view-round-1/framework-orders.md): files dropped from the
// computer are read by one core part, core/js/files-drop.js, in sf-file-upload
// (its host and its class component) and sf-input-image. At 1440 and 390,
// light and dark, `loads` fresh loads each (3 by default), a drop is sent as
// the browser sends one -- dragover, then drop with a DataTransfer of files,
// on the element under the pointer at the zone's centre. Measured: the drag
// is taken (dragover cancelled, copy), the zone says a file is over it, one
// attach and one change per drop, the file in the list or in the picture;
// a drag of text passes on; a disabled field takes nothing. On a touch screen
// with no fine pointer (390, touch, no mouse) the words about dragging are
// not shown and «Выберите файлы» stays (C223); with a mouse they are. A clean
// console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const BODY = `<main style="display:flex;flex-direction:column;gap:24px;inline-size:min(100%,40rem)">
  <sf-file-upload id="upload" label="Документы" multiple></sf-file-upload>
  <sf-file-upload id="off" label="Закрыто" disabled></sf-file-upload>
  <sf-input-image id="image" label="Обложка"></sf-input-image>
</main>`;

// A drop as the browser sends it, at the centre of a selector's box.
async function drop(tab, selector, {kind = 'files', name = 'a.png'} = {}) {
  return tab.evaluate(async ({selector, kind, name}) => {
    const zone = document.querySelector(selector);
    const box = zone.getBoundingClientRect();
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) ?? zone;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
    const make = () => {
      const transfer = new DataTransfer();
      if (kind === 'files') transfer.items.add(new File([png], name, {type: 'image/png'}));
      else transfer.setData('text/plain', 'строка');
      return transfer;
    };
    const host = zone.closest('sf-file-upload, sf-input-image') ?? zone;
    const heard = {attach: 0, change: 0};
    const tag = host.localName;
    const onAttach = () => { heard.attach += 1; };
    const onChange = () => { heard.change += 1; };
    host.addEventListener(`${tag}-attach`, onAttach);
    host.addEventListener('change', onChange);
    const over = new DragEvent('dragover', {bubbles: true, cancelable: true, composed: true, dataTransfer: make(), clientX: box.left + 4, clientY: box.top + 4});
    target.dispatchEvent(over);
    await new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle)));
    const during = {
      taken: over.defaultPrevented,
      effect: over.dataTransfer.dropEffect,
      hostState: host.hasAttribute('data-dragged-over') || host.hasAttribute('data-dragging'),
      areaClass: Boolean(host.querySelector('.sf-file-upload.dragover')),
    };
    const dropped = new DragEvent('drop', {bubbles: true, cancelable: true, composed: true, dataTransfer: make()});
    target.dispatchEvent(dropped);
    await new Promise((settle) => setTimeout(settle, 400));
    host.removeEventListener(`${tag}-attach`, onAttach);
    host.removeEventListener('change', onChange);
    return {
      ...during,
      dropTaken: dropped.defaultPrevented,
      ...heard,
      after: host.hasAttribute('data-dragged-over') || Boolean(host.querySelector('.sf-file-upload.dragover')),
      listed: [...host.querySelectorAll('.sf-file-upload-file, [data-file-id], .sf-file-upload__item, .sf-file-upload-item')].length,
      picture: Boolean(host.value) || Boolean(host.querySelector('img')),
    };
  }, {selector, kind, name});
}

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => document.querySelector('#upload .sf-file-upload') && document.querySelector('#off .sf-file-upload')
      && customElements.get('sf-input-image') && document.querySelector('#image')?.firstElementChild, null, {timeout: 20_000});
    await tab.waitForTimeout(300);

    const upload = await drop(tab, '#upload .sf-file-upload', {name: 'one.png'});
    ok(`${key} sf-file-upload: the drag of files is taken, copy, the zone says it`, upload.taken && upload.effect === 'copy' && upload.areaClass && upload.hostState, upload);
    ok(`${key} sf-file-upload: one attach and one change per drop, the drop taken from the browser`, upload.dropTaken && upload.attach === 1 && upload.change === 1 && !upload.after, upload);
    const second = await drop(tab, '#upload .sf-file-upload', {name: 'two.png'});
    ok(`${key} sf-file-upload: a second drop is one more of each`, second.attach === 1 && second.change === 1, second);
    const text = await drop(tab, '#upload .sf-file-upload', {kind: 'text'});
    ok(`${key} sf-file-upload: a drag of text passes on`, !text.taken && text.attach === 0 && text.change === 0, text);
    const off = await drop(tab, '#off .sf-file-upload', {name: 'off.png'});
    ok(`${key} sf-file-upload disabled: says no, takes nothing, the browser does not open the file`, off.taken && off.effect === 'none' && off.dropTaken && off.attach === 0 && off.change === 0, off);
    const image = await drop(tab, '#image', {name: 'cover.png'});
    ok(`${key} sf-input-image: the drag is taken and said, one attach per drop, the picture taken`, image.taken && image.effect === 'copy' && image.hostState && image.dropTaken && image.attach === 1 && image.picture, image);

    const words = await tab.evaluate(() => {
      const drag = document.querySelector('#upload .sf-file-upload-drag');
      return {query: matchMedia('(pointer: coarse) and (not (any-pointer: fine))').matches, shown: Boolean(drag) && getComputedStyle(drag).display !== 'none'};
    });
    ok(`${key}: with a mouse the words about dragging are shown`, !words.query && words.shown, words);
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

// A touch screen with no fine pointer (C223).
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, colorScheme: theme, locale: 'ru-RU'});
  const tab = await context.newPage();
  const errors = watchConsole(tab);
  await tab.goto(server.page(russianPage({theme, body: BODY})));
  await tab.waitForFunction(() => document.querySelector('#upload .sf-file-upload-drag'), null, {timeout: 20_000});
  await tab.waitForTimeout(300);
  const touch = await tab.evaluate(() => {
    const drag = document.querySelector('#upload .sf-file-upload-drag');
    const area = document.querySelector('#upload .sf-file-upload');
    return {
      query: matchMedia('(pointer: coarse) and (not (any-pointer: fine))').matches,
      dragShown: getComputedStyle(drag).display !== 'none',
      text: area.innerText.replace(/\s+/gu, ' ').trim(),
    };
  });
  ok(`390 touch ${theme}: the words about dragging are not shown, «Выберите» stays (C223)`, touch.query && !touch.dragShown && /Выберите/u.test(touch.text), touch);
  ok(`390 touch ${theme}: console clean`, !errors.length, errors.join(' | '));
  await context.close();
}

await browser.close();
await server.close();
report();
