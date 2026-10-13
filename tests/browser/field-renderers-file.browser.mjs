#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The set's `file` edit control, measured on the built bytes. It is a
// composition of two components that are not interchangeable, so the probe
// measures the seam rather than the parts:
//
//   1. a stored file renders as a preview, with the icon chosen from its mime
//      type -- not from its name, which is why a .bin with an image mime is in
//      the fixture;
//   2. a stored file with no href offers no download, which is the one place
//      this renderer cannot use lit's boolean attribute form: download-action
//      and remove-action both read `true` when the attribute is absent, so
//      dropping the attribute would have offered a download of nothing;
//   3. removing a stored file writes the remaining list through the host, and
//      a single-valued field writes null rather than an empty array;
//   4. the upload zone appears only when the host can actually transfer, and a
//      host that cannot still edits what is already stored;
//   5. choosing files hands the host items that carry the real File, and the
//      host's own list -- the only writer of `items` -- renders with progress.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/file-upload/css/file-upload.css',
  'component/component/file-preview/css/file-preview.css',
  'component/component/progress-bar/css/progress-bar.css',
  'component/component/buttons/css/buttons.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/progress-bar/js/progress-bar.js',
  'smart/smart/file-preview/js/file-preview.js', 'smart/smart/file-upload/js/file-upload.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

// A missing asset must fail as a missing asset. The first run of this probe was
// pointed one directory above the output root, and because the page's loads are
// swallowed it reported the set unreachable -- a true symptom of a false cause,
// which is the most expensive kind of probe result.
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 900, height: 900}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="many" style="width:600px"></div><div id="one" style="width:600px"></div>'
    + '<div id="noupload" style="width:600px"></div></body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1300);

  const measured = await page.evaluate(async () => {
    const set = window.SF?.fieldRenderers;
    const {render} = window.SF || {};
    if (!set?.renderEditField || !render) {
      return {missing: true, sf: Object.keys(window.SF || {})};
    }

    const writes = [];
    const handed = [];
    const uploads = {};
    const values = {
      // A .bin carrying an image mime: the icon has to come from the mime type.
      docs: [
        {value: 'f1', label: 'contract.pdf', size: '240 KB', mime: 'application/pdf', href: '/files/f1'},
        {value: 'f2', label: 'shot.bin', size: '1.2 MB', mime: 'image/png', href: '/files/f2'},
        {value: 'f3', label: 'pending.txt', size: '4 KB', mime: 'text/plain'},
      ],
      scan: {value: 's1', label: 'scan.jpg', size: '800 KB', mime: 'image/jpeg', href: '/files/s1'},
      locked: [{value: 'l1', label: 'old.doc', size: '90 KB', mime: 'application/msword', href: '/files/l1'}],
    };

    const host = {
      setFieldValue: (field, value) => { values[field.key] = value; writes.push([field.key, value]); },
      startFieldUpload: (field, items) => {
        handed.push(items.map((item) => ({
          name: item.name, fileSize: item.fileSize, state: item.state,
          // The real File is what a transfer needs; an item without it is a
          // description of a file the host cannot send.
          carriesFile: item.file instanceof File,
        })));
        // The host records what it was handed, with its own progress -- the
        // single writer of `items`, as the renderer's own comment states.
        uploads[field.key] = items.map((item, index) => ({
          ...item, state: index === 0 ? 'process' : 'error',
          progress: index === 0 ? 40 : 0,
          errorMessage: index === 0 ? undefined : 'Повторить',
        }));
      },
      getFieldUploads: (field) => uploads[field.key] || [],
      retryFieldUpload: (field, index) => { writes.push(['retry', field.key, index]); },
    };
    // The same host minus the two methods that make a transfer possible.
    const cannotUpload = {setFieldValue: host.setFieldValue};

    const fields = {
      many: {key: 'docs', label: 'Документы', propertyType: 'file', multiple: true, accept: '.pdf,image/*'},
      one: {key: 'scan', label: 'Скан', propertyType: 'file'},
      noupload: {key: 'locked', label: 'Архив', propertyType: 'file', multiple: true},
    };

    const draw = () => {
      for (const [holderId, field] of Object.entries(fields)) {
        const box = document.getElementById(holderId);
        const content = set.renderEditField(
          field, values[field.key], holderId === 'noupload' ? cannotUpload : host,
        );
        if (content) render(content, box);
      }
    };
    draw();
    await new Promise((done) => setTimeout(done, 600));

    const previews = (holderId) => [...document.querySelectorAll(`#${holderId} sf-file-preview`)].map((node) => ({
      name: node.getAttribute('file-name'),
      icon: node.getAttribute('icon'),
      href: node.getAttribute('href'),
      downloadAction: node.getAttribute('download-action'),
      removeAction: node.getAttribute('remove-action'),
    }));
    const zone = (holderId) => {
      const node = document.querySelector(`#${holderId} sf-file-upload`);
      return node ? {accept: node.getAttribute('accept'), multiple: node.hasAttribute('multiple')} : null;
    };

    const before = {
      many: previews('many'), one: previews('one'), noupload: previews('noupload'),
      zones: {many: zone('many'), one: zone('one'), noupload: zone('noupload')},
    };

    // Remove the middle stored file of the multiple field, and the only stored
    // file of the single one. The second is the case that decides whether an
    // empty list or null is written.
    const removeButton = (holderId, index) => {
      const node = document.querySelectorAll(`#${holderId} sf-file-preview`)[index];
      return node?.querySelector('[data-action="remove"], .sf-file-preview-remove, button[data-action="remove"]')
        || [...(node?.querySelectorAll('button') || [])].pop() || null;
    };
    removeButton('many', 1)?.click();
    removeButton('one', 0)?.click();
    await new Promise((done) => setTimeout(done, 300));
    draw();
    await new Promise((done) => setTimeout(done, 400));

    // Choosing files: the component's own select event is what the renderer
    // listens for, so the probe drives the input the component owns.
    const input = document.querySelector('#many sf-file-upload input[type="file"]');
    let selected = false;
    if (input) {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['a'], 'new-one.pdf', {type: 'application/pdf'}));
      transfer.items.add(new File(['bb'], 'new-two.png', {type: 'image/png'}));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles: true}));
      selected = true;
    }
    await new Promise((done) => setTimeout(done, 400));
    draw();
    await new Promise((done) => setTimeout(done, 500));

    const items = [...document.querySelectorAll('#many .sf-upload-progress')].map((node) => ({
      name: node.querySelector('.sf-upload-progress-name')?.textContent?.trim(),
      state: node.className.includes('--error') ? 'error'
        : node.className.includes('--done') ? 'done' : 'process',
      bar: node.querySelector('sf-progress-bar')?.getAttribute('value') ?? null,
      retry: node.querySelector('.sf-upload-progress-repeat')?.textContent?.trim() ?? null,
    }));

    return {
      before,
      writes,
      afterRemoval: {many: previews('many'), one: previews('one'), oneValue: values.scan},
      selected,
      handed,
      items,
    };
  });

  if (measured.missing) {
    note({case: 'the set is reachable from the page', got: measured,
      expected: 'the renderer module and lit on the page'});
  } else {
    const stored = measured.before?.many || [];
    if (stored.length !== 3) {
      note({case: 'stored files render as previews', got: stored, expected: 'three previews'});
    }
    // The icon is read from the mime type, which is the whole reason the map
    // exists: shot.bin is an image and contract.pdf is not a document icon.
    const icons = stored.map((file) => file.icon);
    if (icons[0] !== 'picture_as_pdf' || icons[1] !== 'image' || icons[2] !== 'description') {
      note({case: 'the icon comes from the mime type, not the name', got: icons,
        expected: ['picture_as_pdf', 'image', 'description']});
    }
    // The boolean-attribute trap: no href must mean download-action="false",
    // written out, because an absent attribute reads true.
    if (stored[2]?.downloadAction !== 'false' || stored[0]?.downloadAction !== 'true') {
      note({case: 'a file with no href offers no download',
        got: stored.map((file) => [file.name, file.href, file.downloadAction]),
        expected: 'download-action false exactly where there is no href'});
    }
    // The zone is the host's capability, not the field's.
    if (!measured.before?.zones?.many || !measured.before?.zones?.one) {
      note({case: 'the zone appears when the host can upload', got: measured.before?.zones,
        expected: 'a zone on both fields whose host can transfer'});
    }
    if (measured.before?.zones?.noupload !== null) {
      note({case: 'no zone when the host cannot transfer', got: measured.before?.zones?.noupload,
        expected: 'null'});
    }
    if (!measured.before?.noupload?.length) {
      note({case: 'a host that cannot upload still edits what is stored',
        got: measured.before?.noupload, expected: 'the stored preview still rendered'});
    }
    if (measured.before?.zones?.many?.accept !== '.pdf,image/*'
      || measured.before?.zones?.many?.multiple !== true) {
      note({case: 'the zone carries the field constraints',
        got: measured.before?.zones?.many, expected: 'accept passed through and multiple set'});
    }
    // Removal writes the remaining list, and a single-valued field writes null.
    const many = measured.afterRemoval?.many || [];
    if (many.length !== 2 || many.some((file) => file.name === 'shot.bin')) {
      note({case: 'removing a stored file writes the remaining list',
        got: many.map((file) => file.name), expected: 'the two files that were not removed'});
    }
    if (measured.afterRemoval?.oneValue !== null) {
      note({case: 'a single-valued field writes null, not an empty list',
        got: measured.afterRemoval?.oneValue, expected: null});
    }
    // The host is handed the real File, which is what a transfer needs.
    const handed = measured.handed?.[0] || [];
    if (handed.length !== 2 || !handed.every((item) => item.carriesFile)) {
      note({case: 'the host is handed items carrying the real File', got: measured.handed,
        expected: 'two items, each with a File'});
    }
    if (handed[0]?.name !== 'new-one.pdf' || !handed[0]?.fileSize) {
      note({case: 'the handed items arrive component-shaped', got: handed,
        expected: 'name and a formatted size, so recording them is a push'});
    }
    // And the host's own list is what renders -- progress on one, retry on the
    // other, which is the state the host wrote and not the selection.
    const items = measured.items || [];
    if (items.length !== 2) {
      note({case: "the host's list is the single writer of items", got: items,
        expected: 'the two items the host recorded'});
    } else {
      if (items[0]?.state !== 'process' || items[0]?.bar !== '40') {
        note({case: 'the progress the host wrote is shown', got: items[0],
          expected: 'process at 40'});
      }
      if (items[1]?.state !== 'error' || items[1]?.retry !== 'Повторить') {
        note({case: 'the failure the host wrote is shown with its retry', got: items[1],
          expected: 'error with the retry text'});
      }
    }
  }

  console.error(JSON.stringify(measured, null, 1));
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FIELD_RENDERERS_FILE_OK');
