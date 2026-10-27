#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The set's edit template, measured on the built bytes: what each type is edited
// with, that the control writes through the host, and that an optional boolean
// shows «не задано» as nothing chosen rather than as «Нет»; a long list of
// choices is a checklist in two columns where there is room and one where there
// is not, and a short one stays a dropdown (Larena roles, 2026-10-17).
//
// There is no record view yet, so the harness is the host: it holds the values
// and takes the writes, which is exactly the interface a record view will
// implement.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/textarea/css/textarea.css',
  'component/component/dropdown/css/dropdown.css', 'component/component/switch/css/switch.css',
  'component/component/button-group/css/button-group.css', 'component/component/buttons/css/buttons.css',
  'component/component/datepicker/css/datepicker.css', 'component/component/checkbox/css/checkbox.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/textarea/js/textarea.js', 'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/switch/js/switch.js', 'smart/smart/button-group/js/button-group.js',
  'smart/smart/datepicker/js/datepicker.js', 'smart/smart/spinner/js/spinner.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 900, height: 900}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="host" style="width:600px"></div></body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1300);

  const rendered = await page.evaluate(async () => {
    // A host reaches the set where the Framework puts what a page may call.
    const set = window.SF?.fieldRenderers;
    if (!set?.renderEditField) return {missing: true, sf: Object.keys(window.SF || {})};

    const {render} = window.SF;
    if (!render) return {missingLit: true};

    const values = {};
    const writes = [];
    const host = {
      getFieldValue: (field) => values[field.key],
      setFieldValue: (field, value) => { values[field.key] = value; writes.push([field.key, value]); },
    };
    const fields = [
      {key: 'title', label: 'Название', propertyType: 'string', required: true},
      {key: 'about', label: 'Описание', propertyType: 'text'},
      {key: 'count', label: 'Счёт', propertyType: 'integer'},
      {key: 'when', label: 'Дата', propertyType: 'date'},
      {key: 'live', label: 'Опубликовано', propertyType: 'boolean', required: true},
      {key: 'maybe', label: 'Активно', propertyType: 'boolean'},
      // A consumer saw «Да»/«Нет» in an English admin, because the words were
      // written into the set. They come from the field now, so this one asks
      // for its own and the one above keeps the published fallback.
      {key: 'english', label: 'Enabled', propertyType: 'boolean', trueText: 'Yes', falseText: 'No'},
      {key: 'status', label: 'Статус', propertyType: 'choice', options: [
        {value: 'live', label: 'Опубликовано'}, {value: 'draft', label: 'Черновик'},
      ]},
      {key: 'rights', label: 'Права', propertyType: 'choices', options: Array.from({length: 20}, (_, at) => ({value: `r${at}`, label: `Право ${at}`}))},
      {key: 'tags', label: 'Метки', propertyType: 'choices', options: [{value: 'a', label: 'А'}, {value: 'b', label: 'Б'}]},
    ];
    values.rights = ['r1'];
    const holder = document.getElementById('host');
    for (const field of fields) {
      const box = document.createElement('div');
      box.dataset.field = field.key;
      holder.append(box);
      const content = set.renderEditField(field, values[field.key], host);
      if (content) render(content, box);
    }
    await new Promise((done) => setTimeout(done, 500));

    const element = (key) => {
      const box = document.querySelector(`[data-field="${key}"]`);
      const node = box?.querySelector('sf-input, sf-textarea, sf-dropdown, sf-switch, sf-button-group, sf-datepicker');
      return node ? {tag: node.tagName.toLowerCase(), size: node.getAttribute('size'),
        value: node.getAttribute('value'),
        chosen: [...box.querySelectorAll('button')].filter((b) => b.className.includes('sf-button--default')).length,
        buttons: box.querySelectorAll('button').length} : null;
    };
    // The snapshot of how each field renders is taken before anything is
    // pressed, because one of the things it asserts is what an unset optional
    // boolean looks like -- and a first version of this probe read that after
    // the press and reported the set broken.
    const before = {
      title: element('title'), about: element('about'), count: element('count'),
      when: element('when'), live: element('live'), maybe: element('maybe'), status: element('status'),
      english: element('english'),
    };
    const words = (key) => [...document.querySelectorAll(`[data-field="${key}"] button`)]
      .map((button) => button.textContent.trim());
    before.maybeWords = words('maybe');
    before.englishWords = words('english');
    // And the cell template, which has no host at all: its words can only come
    // from the field, so both cases are read from the same place.
    before.cells = {
      fallback: set.renderCellField({key: 'a', propertyType: 'boolean'}, true),
      asked: set.renderCellField({key: 'b', propertyType: 'boolean', falseText: 'No'}, false),
    };

    // The header claims the controls write through the host, so the probe makes
    // them write. A claim a probe states and does not measure is the thing this
    // set exists to stop.
    const input = document.querySelector('[data-field="title"] input');
    if (input) {
      input.value = 'Новое название';
      input.dispatchEvent(new Event('change', {bubbles: true}));
    }
    // The checklist: its columns at the field's width and at a narrow one, and a
    // box that writes the list through the host.
    const columnsOf = () => {
      const tops = [...document.querySelectorAll('[data-field="rights"] .sf-field-checklist > sf-checkbox')]
        .map((node) => node.firstElementChild?.getBoundingClientRect().left ?? null).filter((left) => left !== null);
      return new Set(tops.map((left) => Math.round(left))).size;
    };
    const checklist = {
      boxes: document.querySelectorAll('[data-field="rights"] sf-checkbox').length,
      dropdown: Boolean(document.querySelector('[data-field="rights"] sf-dropdown')),
      shortIsDropdown: Boolean(document.querySelector('[data-field="tags"] sf-dropdown')),
      wide: columnsOf(),
      checkedFirst: document.querySelectorAll('[data-field="rights"] sf-checkbox')[1]?.checked ?? null,
    };
    document.querySelector('[data-field="rights"]').style.width = '300px';
    await new Promise((done) => setTimeout(done, 200));
    checklist.narrow = columnsOf();
    document.querySelector('[data-field="rights"]').style.width = '';
    const third = document.querySelectorAll('[data-field="rights"] sf-checkbox')[3];
    (third?.querySelector('input') ?? third)?.click();
    await new Promise((done) => setTimeout(done, 300));
    checklist.written = values.rights;
    const yes = [...document.querySelectorAll('[data-field="maybe"] button')]
      .find((button) => button.textContent.trim() === 'Да');
    yes?.click();
    await new Promise((done) => setTimeout(done, 400));

    return {
      ...before,
      writes,
      checklist,
      afterWrites: {title: values.title, maybe: values.maybe},
      maybeAfter: element('maybe'),
    };
  });

  if (rendered.missing || rendered.missingLit) {
    note({case: 'the set is reachable from the page', got: rendered,
      expected: 'the renderer module and lit on the page'});
  } else {
    const expected = {
      title: 'sf-input', about: 'sf-textarea', count: 'sf-input', when: 'sf-datepicker',
      live: 'sf-switch', maybe: 'sf-button-group', status: 'sf-dropdown',
    };
    for (const [key, tag] of Object.entries(expected)) {
      if (rendered[key]?.tag !== tag) {
        note({case: `edit ${key}`, got: rendered[key], expected: tag});
      }
    }
    // An optional boolean with no value: two buttons, neither chosen. That is
    // «не задано» shown rather than written.
    if (rendered.maybe?.buttons !== 2 || rendered.maybe?.chosen !== 0) {
      note({case: 'an optional boolean unset', got: rendered.maybe,
        expected: 'two buttons with neither chosen'});
    }
    // And the controls write through the host, with the types the host expects:
    // a string from the input, a boolean from the pair of buttons.
    if (rendered.afterWrites?.title !== 'Новое название') {
      note({case: 'the input writes through the host', got: rendered.afterWrites,
        expected: 'the typed string'});
    }
    if (rendered.afterWrites?.maybe !== true) {
      note({case: 'the buttons write a boolean', got: rendered.afterWrites,
        expected: 'true after pressing Да'});
    }
    // The words of a boolean are the field's, in both templates.
    if (rendered.maybeWords?.join('|') !== 'Да|Нет') {
      note({case: 'a boolean with no words asked keeps the published ones',
        got: rendered.maybeWords, expected: ['Да', 'Нет']});
    }
    if (rendered.englishWords?.join('|') !== 'Yes|No') {
      note({case: 'a boolean renders the words the field asks for',
        got: rendered.englishWords, expected: ['Yes', 'No']});
    }
    if (rendered.cells?.fallback !== 'Да' || rendered.cells?.asked !== 'No') {
      note({case: 'the cell template reads the words from the field too',
        got: rendered.cells, expected: {fallback: 'Да', asked: 'No'}});
    }
    if (rendered.maybeAfter?.chosen !== 1) {
      note({case: 'the pressed button shows', got: rendered.maybeAfter,
        expected: 'one of the two chosen after the press'});
    }
  }
  {
    const c = rendered.checklist ?? {};
    if (c.boxes !== 20 || c.dropdown || !c.shortIsDropdown || c.wide !== 2 || c.narrow !== 1 || c.checkedFirst !== true
      || JSON.stringify(c.written) !== JSON.stringify(['r1', 'r3'])) {
      note({case: 'a long list of choices is a checklist in two columns where there is room, one where not, and writes the list', got: c,
        expected: {boxes: 20, dropdown: false, shortIsDropdown: true, wide: 2, narrow: 1, checkedFirst: true, written: ['r1', 'r3']}});
    }
  }

  console.error(JSON.stringify(rendered, null, 1));
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FIELD_RENDERERS_EDIT_OK');
