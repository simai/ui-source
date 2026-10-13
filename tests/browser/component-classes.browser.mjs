#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The classes and parts the component pass found drawing nothing: the
// Verification, VerificationForm and FileUpload classes built no markup; an
// emoji's skin and an icon button's loading had no effect; sf-avatars wrote
// classes no sheet answers. A page that loads Core and lets the Loader bring them.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<div class="sf-verification-form" hidden></div><div class="sf-file-upload" hidden></div>
<span class="sf-emoji" hidden>x</span><a class="sf-download-file" hidden></a>
<button type="button" class="sf-icon-button sf-icon-button--size-1 loading" id="busy"><i class="sf-icon">add</i></button>
<sf-avatars id="group" template="group" avatars='[{"imageUrl":"data:image/gif;base64,R0lGODlhAQABAAAAACw="},{"text":"АБ"}]' avatars-more="5"></sf-avatars>
<sf-avatars id="label" template="label" avatar-url="data:image/gif;base64,R0lGODlhAQABAAAAACw=" label-text="Анна" label-second-text="Дизайнер"></sf-avatars>
<main id="made"></main>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1000, height: 800}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => ['VerificationForm', 'Verification', 'FileUpload', 'Emoji'].every((name) => window.SF?.Loader?.ComponentRegistry?.[name])
    && customElements.get('sf-avatars') && document.querySelector('#label .sf-avatar-label-group'), null, {timeout: 15000})
    .catch(() => failures.push('the classes or sf-avatars never arrived'));
  await tab.waitForTimeout(400);
  const seen = await tab.evaluate(() => {
    const registry = window.SF.Loader.ComponentRegistry;
    const made = document.getElementById('made');
    const form = new registry.VerificationForm({param: {label: 'Код', length: 4, name: 'code'}}).render();
    const code = new registry.Verification({param: {label: 'Код', length: 6}}).render();
    const upload = new registry.FileUpload({param: {accept: '.pdf'}}).render();
    const emoji = new registry.Emoji({param: {name: 'thumbs_up', skin: 3}}).render();
    made.append(form, code, upload, emoji);
    const busy = getComputedStyle(document.getElementById('busy'), '::after').backgroundImage;
    const box = (node) => { const rect = node?.getBoundingClientRect(); return rect ? [Math.round(rect.width), Math.round(rect.height)] : null; };
    return {
      form: form ? {cells: form.querySelectorAll('.sf-verification-cell').length, input: form.querySelector('input.sf-verification-input')?.name, label: form.querySelector('.sf-verification-form-label')?.textContent} : null,
      code: code ? {cells: code.querySelectorAll('.sf-verification-cell').length, name: code.querySelector('input')?.getAttribute('aria-label')} : null,
      upload: upload ? {area: Boolean(upload.querySelector('.sf-file-upload[data-accept=".pdf"]')), link: upload.querySelector('.sf-file-upload-link')?.textContent, role: upload.querySelector('.sf-file-upload')?.getAttribute('role')} : null,
      emoji: emoji?.textContent,
      busy,
      group: {avatars: [...document.querySelectorAll('#group .sf-avatar')].map(box), buttons: document.querySelectorAll('#group button').length, more: document.querySelector('#group .sf-avatar:last-child')?.textContent.trim()},
      label: {avatar: box(document.querySelector('#label .sf-avatar')), title: document.querySelector('#label .sf-avatar-label-group-title')?.textContent.trim()},
    };
  });
  console.log(JSON.stringify(seen, null, 1));
  if (seen.form?.cells !== 4 || seen.form?.input !== 'code' || seen.form?.label !== 'Код') failures.push('VerificationForm did not build a labelled four-cell field');
  if (seen.code?.cells !== 6 || seen.code?.name !== 'Код') failures.push('Verification did not build a named six-cell control');
  if (!seen.upload?.area || seen.upload?.link !== 'Выберите файл' || seen.upload?.role !== 'button') failures.push('FileUpload did not build a bound drop area in the page language');
  if (seen.emoji !== '\u{1F44D}\u{1F3FD}') failures.push(`emoji skin 3 gave ${JSON.stringify(seen.emoji)}`);
  if (!/gradient/.test(seen.busy || '')) failures.push('a loading icon button draws no stripes');
  const sized = (size) => size && size[0] > 8 && size[0] === size[1];
  if (seen.group.avatars.length !== 3 || !seen.group.avatars.every(sized) || seen.group.buttons || seen.group.more !== '+5') failures.push('sf-avatars group is not three round sized avatars without buttons ending in +5');
  if (!sized(seen.label.avatar) || seen.label.title !== 'Анна') failures.push('sf-avatars label has no sized avatar beside its text');
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('COMPONENT_CLASSES_OK');
