#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Two cells the data view port 1.8.0 asks for (Larena's tree pages and Files):
// a choices column with variant badges -- tonal badges coloured by each
// option's scheme, a value able to carry its own text -- and a file column the
// host says holds images, drawn as sf-file-preview compact: the thumbnail or
// the extension in a tile, as tall as a size-1/2 field, which is a list row.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/badges/css/badges.css', 'component/component/tags/css/tags.css',
  'component/component/avatars/css/avatars.css',
  'component/component/reference-link/css/reference-link.css',
  'component/component/progress-scale/css/progress-scale.css',
  'component/component/file-preview/css/file-preview.css',
  'component/component/inputs/css/inputs.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/badges/js/badges.js',
  'smart/smart/tags/js/tags.js', 'smart/smart/avatar/js/avatar.js',
  'smart/smart/reference-link/js/reference-link.js',
  'smart/smart/progress-scale/js/progress-scale.js',
  'smart/smart/file-preview/js/file-preview.js', 'smart/smart/inputs/js/inputs.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
let report = {};
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 800}});
  await page.setContent('<!doctype html><html class="theme-light" lang="ru"><body style="margin:0"><div id="host"></div>'
    + '<div id="ruler" style="display:inline-block;block-size:calc(var(--sf-icon-size-2) + 2 * var(--sf-a6))"></div></body></html>');
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1400);

  report = await page.evaluate(async () => {
    const set = window.SF?.fieldRenderers;
    if (!set?.renderCellField) return {missing: true};
    const badges = set.renderCellField({key: 'pub', propertyType: 'choices', variant: 'badges', options: [
      {value: 'published', label: 'Опубликовано', scheme: 'success'},
      {value: 'scheduled', label: 'Запланировано', scheme: 'warning'},
    ]}, ['published', {value: 'scheduled', text: 'ru · 14.10 09:00'}]);
    const imageCell = set.renderCellField({key: 'f', propertyType: 'file', variant: 'image'},
      {label: 'logo.png', mime: 'image/png', href: '/files/logo.png'});
    const fileCell = set.renderCellField({key: 'f', propertyType: 'file', variant: 'image'},
      {label: 'report.pdf', mime: 'application/pdf', href: '/files/report.pdf'});

    const host = document.getElementById('host');
    host.innerHTML = '<sf-file-preview id="pdf" compact file-name="report.pdf" href="/files/report.pdf"></sf-file-preview>'
      + '<sf-file-preview id="img" compact kind="image" file-name="logo.png" '
      + 'image-url="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22/%3E"></sf-file-preview>';
    await new Promise((done) => setTimeout(done, 500));
    const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const pdfHolder = box('#pdf .sf-file-preview-holder');
    const imgHolder = box('#img .sf-file-preview-holder');
    return {
      badges: badges?.map?.((item) => ({type: item.component?.type, text: item.component?.props?.text, scheme: item.component?.props?.scheme})) ?? badges,
      imageCell: imageCell?.component,
      fileCell: fileCell?.component,
      ruler: box('#ruler')?.height,
      pdf: {height: pdfHolder?.height, width: pdfHolder?.width, extension: document.querySelector('#pdf .sf-file-preview-extension')?.textContent ?? null,
        link: document.querySelector('#pdf a')?.getAttribute('href') ?? null, name: document.querySelector('#pdf a')?.getAttribute('aria-label') ?? null,
        main: Boolean(document.querySelector('#pdf .sf-file-preview-main'))},
      img: {height: imgHolder?.height, alt: document.querySelector('#img img')?.getAttribute('alt') ?? null},
    };
  });
} finally {
  await browser.close();
}

if (report.missing) note({case: 'renderer set', got: report});
else {
  const texts = (report.badges || []).map((item) => `${item.type}:${item.text}:${item.scheme}`);
  if (texts.join('|') !== 'badge:Опубликовано:success|badge:ru · 14.10 09:00:warning') note({case: 'badges', got: texts});
  if (report.imageCell?.type !== 'file-preview' || report.imageCell?.props?.imageUrl !== '/files/logo.png' || report.imageCell?.props?.compact !== true) note({case: 'image cell', got: report.imageCell});
  if (report.fileCell?.type !== 'file-preview' || report.fileCell?.props?.kind !== 'icon' || report.fileCell?.props?.imageUrl) note({case: 'file cell', got: report.fileCell});
  if (!report.ruler || Math.abs(report.pdf.height - report.ruler) > 0.5 || Math.abs(report.pdf.width - report.ruler) > 0.5) note({case: 'compact size', got: report.pdf, ruler: report.ruler});
  if (report.pdf.extension !== 'PDF' || report.pdf.link !== '/files/report.pdf' || report.pdf.name !== 'report.pdf' || report.pdf.main) note({case: 'compact file', got: report.pdf});
  if (Math.abs((report.img.height ?? 0) - report.ruler) > 0.5 || report.img.alt !== 'logo.png') note({case: 'compact image', got: report.img});
}
if (failures.length) {
  console.error(JSON.stringify({failures, report}, null, 2));
  throw new Error(`${failures.length} cell renderer check(s) failed`);
}
process.stdout.write(`Field renderer cells: PASS ${JSON.stringify({ruler: report.ruler, pdf: report.pdf, img: report.img})}\n`);
