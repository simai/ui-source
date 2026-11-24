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
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/badge/js/badge.js',
  'smart/smart/tag/js/tag.js', 'smart/smart/avatar/js/avatar.js',
  'smart/smart/reference-link/js/reference-link.js',
  'smart/smart/progress-scale/js/progress-scale.js',
  'smart/smart/file-preview/js/file-preview.js', 'smart/smart/input/js/input.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

const ruLang = join(out, 'core/core/lang/ru.js');
const absent = [...styles, ruLang, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

// L6 (owner remark 13, View list register VL-73; field renderers 1.30.1): a
// viewed value's tag or badge is the value's own text size -- the tag inline
// on the field's size, the badge on the text beside it (line="text") -- 16/24
// at 1440 and 14/20 at 390, so the whole check runs at both widths.
const WIDTHS = [1440, 390];
const VALUE_TEXT = {1440: [16, 24], 390: [14, 20]};
for (const width of WIDTHS) {
const fail = (detail) => note({width, ...detail});
try {
  const page = await browser.newPage({viewport: {width, height: 1000}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="host" style="width:min(700px, 100%)"></div>'
    // A size-1 control and a bare line of text, to measure the two heights the
    // view template sits between.
    + '<div id="ruler" style="width:300px"><sf-input size="1" value="x"></sf-input>'
    + '<span id="line" class="sf-text-1">Строка</span></div>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  // Russian is a language file (owner decision C282): the bundles carry the
  // English words only, so the page includes core/lang/ru.js before core, as
  // a Russian page does; without it a boolean read «Yes» for «Да».
  await page.addScriptTag({path: ruLang});
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
      // Formatted text (property-view port 1.17.0) with a hostile value: what
      // is drawn is the value cleaned by sf-rich-text's rule, never the value.
      {key: 'body', label: 'Описание', propertyType: 'html'},
    ];
    const values = {
      title: 'Первая запись', count: 42, bare: 7, progress: 64, when: '2026-10-06',
      live: true, english: false, status: 'live', modules: ['updates', 'billing'],
      author: {label: 'Super User', avatarText: 'SU'},
      section: {label: 'Платежи', href: '/admin/cms/record-1'},
      docs: [{label: 'contract.pdf', size: '240 KB', mime: 'application/pdf', href: '/files/f1'}],
      unknown: '#ff0000',
      body: '<p onclick="window.__sfPwned=1">Текст <strong onmouseover="window.__sfPwned=2">важный</strong>'
        + ' <a href="javascript:window.__sfPwned=3">плохая</a> <a href="https://simai.io/">хорошая</a></p>'
        + '<script>window.__sfPwned=4<\/script><img src="x" onerror="window.__sfPwned=5">'
        + '<style>p{color:red}</style><ul><li>пункт</li></ul>',
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

    const bodyBox = document.querySelector('[data-field="body"]');
    const bodyNodes = [...(bodyBox?.querySelectorAll('*') ?? [])];
    const htmlView = {
      tags: [...new Set(bodyNodes.map((node) => node.localName))].sort(),
      onAttributes: bodyNodes.flatMap((node) => [...node.attributes].map((attribute) => attribute.name)).filter((name) => /^on/iu.test(name)),
      hrefs: [...(bodyBox?.querySelectorAll('a') ?? [])].map((node) => node.getAttribute('href')),
      strong: bodyBox?.querySelector('strong')?.textContent ?? null,
      pwned: window.__sfPwned ?? null,
      cell: set.renderCellField({key: 'body', propertyType: 'html'}, values.body),
    };

    return {
      htmlView,
      wrap,
      rendered,
      control: Math.round(control),
      textLine: Math.round(textLine),
      text: Object.fromEntries(fields.map((field) => [field.key,
        document.querySelector(`[data-field="${field.key}"]`)?.textContent.replace(/\s+/gu, ' ').trim() ?? '']),
      ),
      // The font of the element that holds a value's words: the value text of
      // a plain field, a tag's, the badge's.
      typo: (() => {
        const fontOf = (root) => {
          if (!root) return null;
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: (node) => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)});
          const text = walker.nextNode();
          const style = text ? getComputedStyle(text.parentElement) : null;
          return style ? [Math.round(parseFloat(style.fontSize)), Math.round(parseFloat(style.lineHeight))] : null;
        };
        return {
          value: fontOf(document.querySelector('[data-field="title"]')),
          tags: [...document.querySelectorAll('[data-field="modules"] sf-tag .sf-tag')].map(fontOf),
          badge: fontOf(document.querySelector('[data-field="status"] sf-badge .sf-badge')),
        };
      })(),
      badge: inline('status', 'sf-badge', '.sf-badge'),
      tags: [...document.querySelectorAll('[data-field="modules"] sf-tag')].map((node) => ({
        height: Math.round(node.querySelector('.sf-tag')?.getBoundingClientRect().height ?? 0),
        line: node.getAttribute('line'), size: node.getAttribute('size'), inline: node.hasAttribute('inline'),
        kind: node.getAttribute('kind'),
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
    fail({case: 'the view template is reachable from the page', got: measured,
      expected: 'renderViewField on window.SF.fieldRenderers'});
  } else {
    // Every type in the consumer's request has a view, and a type the set does
    // not carry returns null rather than an empty box.
    if (measured.rendered?.unknown !== 'null') {
      fail({case: 'a type the set has no view for returns null', got: measured.rendered?.unknown,
        expected: 'null'});
    }
    for (const key of ['title', 'count', 'when', 'live', 'status', 'modules', 'author', 'section', 'docs']) {
      if (measured.rendered?.[key] === 'null') {
        fail({case: `the view template renders ${key}`, got: 'null', expected: 'a template'});
      }
    }
    // Formatted text: the subset is drawn, nothing outside it is, and nothing ran.
    const htmlView = measured.htmlView || {};
    const allowed = new Set(['div', 'p', 'strong', 'a', 'ul', 'li']);
    if (measured.rendered?.body === 'null' || htmlView.strong !== 'важный'
      || htmlView.tags?.some((tag) => !allowed.has(tag)) || htmlView.onAttributes?.length
      || JSON.stringify(htmlView.hrefs) !== JSON.stringify(['https://simai.io/']) || htmlView.pwned !== null) {
      fail({case: 'an html value is drawn cleaned: no script, style, image, on* attribute or javascript: link', got: htmlView,
        expected: {tags: [...allowed], onAttributes: [], hrefs: ['https://simai.io/'], strong: 'важный', pwned: null}});
    }
    if (htmlView.cell !== 'Текст важный плохая хорошая пункт') {
      fail({case: 'an html cell is its text on one line', got: htmlView.cell, expected: 'Текст важный плохая хорошая пункт'});
    }
    // The unit is the field's, and a field without one gets no invented unit.
    if (measured.text?.count !== '42 шт' || measured.text?.bare !== '7') {
      fail({case: 'a number carries the field unit and no other',
        got: {withUnit: measured.text?.count, without: measured.text?.bare},
        expected: {withUnit: '42 шт', without: '7'}});
    }
    // The date is the host's formatting, not the stored string.
    if (measured.text?.when !== '6 октября 2026') {
      fail({case: 'a date is formatted by the host', got: measured.text?.when,
        expected: '6 октября 2026'});
    }
    // The boolean's words, here as in the other two templates.
    if (measured.text?.live !== 'Да' || measured.text?.english !== 'No') {
      fail({case: "a boolean shows the field's words", got: {fallback: measured.text?.live,
        asked: measured.text?.english}, expected: {fallback: 'Да', asked: 'No'}});
    }
    // The claim this template is built on, measured: the inline elements stand
    // on the text line and not on the control height.
    const {control, textLine} = measured;
    if (!control || !textLine || control <= textLine) {
      fail({case: 'the two rulers differ', got: {control, textLine},
        expected: 'a size-1 control taller than a bare text line'});
    }
    for (const [name, element, line] of [['badge', measured.badge, 'text'], ['avatar', measured.avatar, '1'],
      ['reference link', measured.reference, '1']]) {
      if (!element) {
        fail({case: `the ${name} is present`, got: null, expected: 'an element to measure'});
        continue;
      }
      if (!element.height || element.innerDisplay === 'contents') {
        fail({case: `the ${name} has a painted box to measure`,
          got: {host: element.hostDisplay, inner: element.innerDisplay, height: element.height},
          expected: 'an inner element with a box -- the host itself has none'});
        continue;
      }
      // The badge stands on the text beside it (L6, line="text"); the avatar
      // and the reference link keep the row's line.
      if (element.line !== line) {
        fail({case: `the ${name} takes the row's text line`, got: element,
          expected: `line="${line}"`});
      }
      if (element.height >= control) {
        fail({case: `the ${name} is not as tall as a control`, got: element.height,
          expected: `below the size-1 control height of ${control}`});
      }
    }
    if (measured.wrap?.count !== 140 || measured.wrap.rows < 10 || measured.wrap.squeezed || measured.wrap.overflow > 0) {
      fail({case: 'many values wrap and no tag shrinks below its text', got: measured.wrap});
    }
    if (measured.tags?.length !== 2 || measured.tags.some((tag) => tag.line !== null || tag.size !== '1' || !tag.inline || tag.kind !== 'default')) {
      fail({case: 'several values render as default tags inline on the field\'s size', got: measured.tags,
        expected: 'two tags, inline, size 1, no line, kind default'});
    }
    // L6, measured: the tags' and the badge's words are the value's text size.
    const [fontSize, lineHeight] = VALUE_TEXT[width];
    const typo = measured.typo || {};
    const atText = (font) => Array.isArray(font) && font[0] === fontSize && font[1] === lineHeight;
    if (!atText(typo.value) || typo.tags?.length !== 2 || !typo.tags.every(atText) || !atText(typo.badge)) {
      fail({case: 'a viewed value\'s tags and badge are the value\'s text size (L6)', got: typo,
        expected: {value: [fontSize, lineHeight], tags: [[fontSize, lineHeight], [fontSize, lineHeight]], badge: [fontSize, lineHeight]}});
    }
    // And the two that are not inline keep their own scale rather than a line.
    if (measured.scale?.size !== '1' || measured.scale?.line) {
      fail({case: 'a scale is a control and keeps its size', got: measured.scale,
        expected: 'size 1 and no line'});
    }
    // file-preview has no visual size: its `size` is the file's size as text,
    // so the view passes file-size and never size.
    if (measured.preview?.size !== null || measured.preview?.fileSize !== '240 KB'
      || measured.preview?.icon !== 'picture_as_pdf') {
      fail({case: 'a file is previewed with its size as text and no visual size',
        got: measured.preview, expected: {size: null, fileSize: '240 KB', icon: 'picture_as_pdf'}});
    }
    // A view offers the download and not the remove, which is the edit's.
    if (measured.preview?.remove !== 'false' || measured.preview?.download !== 'true') {
      fail({case: 'a viewed file can be downloaded and not removed', got: measured.preview,
        expected: {remove: 'false', download: 'true'}});
    }
  }

  console.error(JSON.stringify({width, measured}, null, 1));
  await page.close();
} catch (error) {
  note({width, case: 'the page ran', got: String(error?.message ?? error)});
}
}
await browser.close();

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FIELD_RENDERERS_VIEW_OK');
