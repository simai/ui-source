#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The set's `view` template, the fourth of the four and the last one it was
// missing. What this measures is the claim the template is built on: a field
// that is shown rather than edited puts its badge, tag, avatar and reference
// link on the row's text line, not on a control's height. A size would stand
// them taller than the words beside them, which is the same mistake the cell
// template avoids one rung down, so the numbers are read here rather than
// assumed.
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
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/badges/js/badges.js',
  'smart/smart/tags/js/tags.js', 'smart/smart/avatar/js/avatar.js',
  'smart/smart/reference-link/js/reference-link.js',
  'smart/smart/progress-scale/js/progress-scale.js',
  'smart/smart/file-preview/js/file-preview.js', 'smart/smart/input/js/input.js',
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

try {
  const page = await browser.newPage({viewport: {width: 1000, height: 1000}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="host" style="width:700px"></div>'
    // A size-1 control and a bare line of text, to measure the two heights the
    // view template sits between.
    + '<div id="ruler" style="width:300px"><sf-input size="1" value="x"></sf-input>'
    + '<span id="line" class="sf-text-1">Строка</span></div>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1400);

  const measured = await page.evaluate(async () => {
    const set = window.SF?.fieldRenderers;
    const {render} = window.SF || {};
    if (!set?.renderViewField || !render) {
      return {missing: true, sf: Object.keys(window.SF || {}), has: Object.keys(set || {})};
    }

    const fields = [
      {key: 'title', label: 'Название', propertyType: 'string'},
      {key: 'count', label: 'Счёт', propertyType: 'integer', unit: 'шт'},
      {key: 'bare', label: 'Без единицы', propertyType: 'integer'},
      {key: 'progress', label: 'Прогресс', propertyType: 'integer', variant: 'scale'},
      {key: 'when', label: 'Дата', propertyType: 'date'},
      {key: 'live', label: 'Опубликовано', propertyType: 'boolean'},
      {key: 'english', label: 'Enabled', propertyType: 'boolean', trueText: 'Yes', falseText: 'No'},
      {key: 'status', label: 'Статус', propertyType: 'choice', options: [
        {value: 'live', label: 'Опубликовано', color: '#1b8f4a'},
      ]},
      {key: 'modules', label: 'Модули', propertyType: 'choices', options: [
        {value: 'updates', label: 'Обновления'}, {value: 'billing', label: 'Оплата'},
      ]},
      {key: 'author', label: 'Автор', propertyType: 'user'},
      {key: 'section', label: 'Раздел', propertyType: 'record'},
      {key: 'docs', label: 'Файлы', propertyType: 'file'},
      {key: 'unknown', label: 'Цвет', propertyType: 'colour'},
    ];
    const values = {
      title: 'Первая запись', count: 42, bare: 7, progress: 64, when: '2026-10-06',
      live: true, english: false, status: 'live', modules: ['updates', 'billing'],
      author: {label: 'Super User', avatarText: 'SU'},
      section: {label: 'Платежи', href: '/admin/cms/record-1'},
      docs: [{label: 'contract.pdf', size: '240 KB', mime: 'application/pdf', href: '/files/f1'}],
      unknown: '#ff0000',
    };
    // The host formats a date, which is the one thing the view template asks a
    // host for: the set has no locale and must not invent one.
    const host = {formatFieldValue: (field, value) => (field.propertyType === 'date' ? '6 октября 2026' : undefined)};

    const holder = document.getElementById('host');
    const rendered = {};
    for (const field of fields) {
      const box = document.createElement('div');
      box.dataset.field = field.key;
      box.style.cssText = 'padding:0;margin:0';
      holder.append(box);
      const content = set.renderViewField(field, values[field.key], host);
      rendered[field.key] = content === null ? 'null' : typeof content;
      if (content && content !== 'null') render(content, box);
    }
    await new Promise((done) => setTimeout(done, 600));

    // The two heights the inline elements must sit between: a size-1 control and
    // a bare line of text in the same stylesheet.
    // Every Smart element is a display:contents host: it has no box of its own,
    // and the first version of this probe measured those hosts and read 0 for
    // all of them. The attributes are the host's, the geometry is the inner
    // element's, and the two are read from different nodes on purpose.
    const painted = (root, selector) => {
      const node = root?.querySelector(selector);
      if (!node) return null;
      return {node, height: Math.round(node.getBoundingClientRect().height),
        display: getComputedStyle(node).display};
    };
    const control = painted(document.getElementById('ruler'), '.sf-input')?.height ?? 0;
    const textLine = document.getElementById('line')?.getBoundingClientRect().height ?? 0;

    const inline = (key, tag, inner) => {
      const box = document.querySelector(`[data-field="${key}"]`);
      const host = box?.querySelector(tag);
      if (!host) return null;
      const paint = painted(box, inner);
      return {
        hostDisplay: getComputedStyle(host).display,
        height: paint?.height ?? null,
        innerDisplay: paint?.display ?? null,
        line: host.getAttribute('line'),
        size: host.getAttribute('size'),
      };
    };

    // Many values in a narrow record panel (a role's 137 rights, Larena
    // 2026-10-17): they wrap, and no tag shrinks below its text.
    const many = document.createElement('div');
    many.style.cssText = 'inline-size:320px;display:flex';
    holder.append(many);
    const rights = Array.from({length: 140}, (_, at) => ({value: `right-${at}`, label: `Право ${at}`}));
    render(set.renderViewField({key: 'operations', propertyType: 'choices', constraints: {options: rights}}, rights.map((right) => right.value), host), many);
    await new Promise((done) => setTimeout(done, 400));
    const manyTags = [...many.querySelectorAll('.sf-tag')];
    const wrap = {
      count: manyTags.length,
      rows: new Set(manyTags.map((tag) => Math.round(tag.getBoundingClientRect().top))).size,
      squeezed: manyTags.filter((tag) => tag.scrollWidth > tag.clientWidth + 1 || tag.getBoundingClientRect().height > 40).length,
      overflow: Math.round(many.scrollWidth - many.clientWidth),
    };

    return {
      wrap,
      rendered,
      control: Math.round(control),
      textLine: Math.round(textLine),
      text: Object.fromEntries(fields.map((field) => [field.key,
        document.querySelector(`[data-field="${field.key}"]`)?.textContent.replace(/\s+/gu, ' ').trim() ?? '']),
      ),
      badge: inline('status', 'sf-badge', '.sf-badge'),
      tags: [...document.querySelectorAll('[data-field="modules"] sf-tag')].map((node) => ({
        height: Math.round(node.querySelector('.sf-tag')?.getBoundingClientRect().height ?? 0),
        line: node.getAttribute('line'), kind: node.getAttribute('kind'),
      })),
      avatar: inline('author', 'sf-avatar', '.sf-avatar'),
      reference: inline('section', 'sf-reference-link', '.sf-reference-link'),
      scale: inline('progress', 'sf-progress-scale', '.sf-progress-scale'),
      preview: (() => {
        const node = document.querySelector('[data-field="docs"] sf-file-preview');
        return node ? {size: node.getAttribute('size'), fileSize: node.getAttribute('file-size'),
          icon: node.getAttribute('icon'), remove: node.getAttribute('remove-action'),
          download: node.getAttribute('download-action')} : null;
      })(),
    };
  });

  if (measured.missing) {
    note({case: 'the view template is reachable from the page', got: measured,
      expected: 'renderViewField on window.SF.fieldRenderers'});
  } else {
    // Every type in the consumer's request has a view, and a type the set does
    // not carry returns null rather than an empty box.
    if (measured.rendered?.unknown !== 'null') {
      note({case: 'a type the set has no view for returns null', got: measured.rendered?.unknown,
        expected: 'null'});
    }
    for (const key of ['title', 'count', 'when', 'live', 'status', 'modules', 'author', 'section', 'docs']) {
      if (measured.rendered?.[key] === 'null') {
        note({case: `the view template renders ${key}`, got: 'null', expected: 'a template'});
      }
    }
    // The unit is the field's, and a field without one gets no invented unit.
    if (measured.text?.count !== '42 шт' || measured.text?.bare !== '7') {
      note({case: 'a number carries the field unit and no other',
        got: {withUnit: measured.text?.count, without: measured.text?.bare},
        expected: {withUnit: '42 шт', without: '7'}});
    }
    // The date is the host's formatting, not the stored string.
    if (measured.text?.when !== '6 октября 2026') {
      note({case: 'a date is formatted by the host', got: measured.text?.when,
        expected: '6 октября 2026'});
    }
    // The boolean's words, here as in the other two templates.
    if (measured.text?.live !== 'Да' || measured.text?.english !== 'No') {
      note({case: "a boolean shows the field's words", got: {fallback: measured.text?.live,
        asked: measured.text?.english}, expected: {fallback: 'Да', asked: 'No'}});
    }
    // The claim this template is built on, measured: the inline elements stand
    // on the text line and not on the control height.
    const {control, textLine} = measured;
    if (!control || !textLine || control <= textLine) {
      note({case: 'the two rulers differ', got: {control, textLine},
        expected: 'a size-1 control taller than a bare text line'});
    }
    for (const [name, element] of [['badge', measured.badge], ['avatar', measured.avatar],
      ['reference link', measured.reference]]) {
      if (!element) {
        note({case: `the ${name} is present`, got: null, expected: 'an element to measure'});
        continue;
      }
      if (!element.height || element.innerDisplay === 'contents') {
        note({case: `the ${name} has a painted box to measure`,
          got: {host: element.hostDisplay, inner: element.innerDisplay, height: element.height},
          expected: 'an inner element with a box -- the host itself has none'});
        continue;
      }
      if (element.line !== '1') {
        note({case: `the ${name} takes the row's text line`, got: element,
          expected: 'line="1"'});
      }
      if (element.height >= control) {
        note({case: `the ${name} is not as tall as a control`, got: element.height,
          expected: `below the size-1 control height of ${control}`});
      }
    }
    if (measured.wrap?.count !== 140 || measured.wrap.rows < 10 || measured.wrap.squeezed || measured.wrap.overflow > 0) {
      note({case: 'many values wrap and no tag shrinks below its text', got: measured.wrap});
    }
    if (measured.tags?.length !== 2 || measured.tags.some((tag) => tag.line !== '1' || tag.kind !== 'default')) {
      note({case: 'several values render as default tags on the line', got: measured.tags,
        expected: 'two tags, line 1, kind default'});
    }
    // And the two that are not inline keep their own scale rather than a line.
    if (measured.scale?.size !== '1' || measured.scale?.line) {
      note({case: 'a scale is a control and keeps its size', got: measured.scale,
        expected: 'size 1 and no line'});
    }
    // file-preview has no visual size: its `size` is the file's size as text,
    // so the view passes file-size and never size.
    if (measured.preview?.size !== null || measured.preview?.fileSize !== '240 KB'
      || measured.preview?.icon !== 'picture_as_pdf') {
      note({case: 'a file is previewed with its size as text and no visual size',
        got: measured.preview, expected: {size: null, fileSize: '240 KB', icon: 'picture_as_pdf'}});
    }
    // A view offers the download and not the remove, which is the edit's.
    if (measured.preview?.remove !== 'false' || measured.preview?.download !== 'true') {
      note({case: 'a viewed file can be downloaded and not removed', got: measured.preview,
        expected: {remove: 'false', download: 'true'}});
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
console.log('FIELD_RENDERERS_VIEW_OK');
