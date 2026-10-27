#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The `password` variant of a string (owner, 2026-10-19), measured on the built
// bytes. A host never sends a password: the value is {set: true|false}, and the
// set shows only «задан»/«не задан». The edit control is an empty
// type=password input with autocomplete=new-password and spellcheck off, a
// «Показать пароль» icon button that switches the type and says so with
// aria-pressed, and the control writes only what a person types -- an untouched
// field puts nothing in the save, a typed one puts the text, an erased one takes
// it back. A sentinel password is searched for in the whole document's markup
// in every state: it must never appear there.
//
// The harness is the host, holding changes the way sf-property-view does: only
// the fields written through setFieldValue, `undefined` withdrawing one.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'smart/smart/icon-buttons/css/icon-buttons.css',
  'smart/smart/input/css/input.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

const SENTINEL = 'Sentinel-pw-7f3a91';
const STORED = 'Stored-pw-c40e22';
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="host" style="width:600px"></div></body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1300);

  const result = await page.evaluate(async ({SENTINEL, STORED}) => {
    const set = window.SF?.fieldRenderers;
    const {render} = window.SF || {};
    if (!set?.renderEditField || !render) return {missing: true};
    const tick = (ms = 150) => new Promise((done) => setTimeout(done, ms));
    const leaks = () => document.documentElement.outerHTML.includes(SENTINEL)
      || document.documentElement.outerHTML.includes(STORED);

    const entry = set.registry.find((one) => one.type === 'string');
    const variant = entry?.variants.find((one) => one.id === 'password') ?? null;

    // The host: a change map like sf-property-view's, and the save payload it sends.
    const changed = new Map();
    const host = {
      setFieldValue: (field, value) => {
        if (value === undefined) changed.delete(field.key);
        else changed.set(field.key, value);
        draw();
      },
    };
    const payload = () => Object.fromEntries(changed);
    const fields = {
      secret: {key: 'secret', label: 'Пароль', propertyType: 'string', variant: 'password', required: true},
      fresh: {key: 'fresh', label: 'Пароль', propertyType: 'string', variant: 'password', required: true},
    };
    const stored = {secret: {set: true}, fresh: {set: false}};
    const holder = document.getElementById('host');
    const boxes = {};
    for (const key of Object.keys(fields)) {
      boxes[key] = document.createElement('div');
      boxes[key].dataset.field = key;
      holder.append(boxes[key]);
    }
    // A host re-renders on every write, passing what it holds.
    function draw() {
      for (const key of Object.keys(fields)) {
        render(set.renderEditField(fields[key], changed.has(key) ? changed.get(key) : stored[key], host), boxes[key]);
      }
    }
    draw();
    await tick(500);

    const parts = (key) => {
      const box = boxes[key];
      return {
        host: box.querySelector('sf-input'),
        input: box.querySelector('sf-input input'),
        button: box.querySelector('sf-icon-button button'),
        field: box.querySelector('.sf-input-field'),
      };
    };
    const a = parts('secret');
    const b = parts('fresh');
    const edit = {
      type: a.input?.type, autocomplete: a.input?.getAttribute('autocomplete'), spellcheck: a.input?.spellcheck,
      value: a.input?.value, valueAttribute: a.host?.hasAttribute('value'), required: a.input?.required,
      placeholder: a.input?.placeholder, freshRequired: b.input?.required, freshPlaceholder: b.input?.placeholder,
      buttonName: a.button?.getAttribute('aria-label'), pressed: a.button?.getAttribute('aria-pressed'),
      buttonHeight: Math.round(a.button?.getBoundingClientRect().height ?? -1),
      fieldHeight: Math.round(a.field?.getBoundingClientRect().height ?? -2),
    };
    const untouched = {payload: payload()};

    // The toggle shows and hides, and says which with aria-pressed.
    a.button?.click();
    await tick();
    const shown = {type: parts('secret').input?.type, pressed: parts('secret').button?.getAttribute('aria-pressed')};

    // A typed value goes out; the markup still does not hold it, and the
    // re-render the write caused keeps the person's choice to see it.
    const typing = parts('secret').input;
    typing.value = SENTINEL;
    typing.dispatchEvent(new Event('input', {bubbles: true}));
    await tick();
    const typed = {payload: payload(), leaks: leaks(), type: parts('secret').input?.type,
      pressed: parts('secret').button?.getAttribute('aria-pressed'), value: parts('secret').input?.value,
      valueAttribute: parts('secret').host?.hasAttribute('value')};
    parts('secret').button?.click();
    await tick();
    const hidden = {type: parts('secret').input?.type, pressed: parts('secret').button?.getAttribute('aria-pressed')};

    // Erased: the change is taken back, and the save carries nothing again.
    const erasing = parts('secret').input;
    erasing.value = '';
    erasing.dispatchEvent(new Event('input', {bubbles: true}));
    await tick();
    const erased = {payload: payload()};

    // View, cell and a read-only field: only set or not set, in the page's language.
    const viewText = (value, extra = {}) => {
      const box = document.createElement('div');
      holder.append(box);
      render(set.renderViewField({...fields.secret, ...extra}, value), box);
      const text = box.textContent.trim();
      box.remove();
      return text;
    };
    const readonlyText = (value) => {
      const box = document.createElement('div');
      holder.append(box);
      render(set.renderEditField({...fields.secret, readonly: true}, value, host), box);
      const text = box.textContent.trim();
      const input = Boolean(box.querySelector('input'));
      box.remove();
      return {text, input};
    };
    const view = {
      set: viewText({set: true}), unset: viewText({set: false}), absent: viewText(null),
      mistaken: viewText(STORED),
      cellSet: set.renderCellField(fields.secret, {set: true}), cellUnset: set.renderCellField(fields.secret, null),
      cellMistaken: set.renderCellField(fields.secret, STORED),
      plainCell: set.renderCellField({key: 'name', propertyType: 'string'}, 'x'),
      readonly: readonlyText({set: true}),
    };
    document.documentElement.lang = 'en';
    const english = {set: viewText({set: true}), unset: viewText({set: false})};
    const box = document.createElement('div');
    holder.append(box);
    render(set.renderEditField(fields.fresh, null, host), box);
    await tick(300);
    english.buttonName = box.querySelector('sf-icon-button button')?.getAttribute('aria-label');
    box.remove();
    document.documentElement.lang = 'ru';

    // The size ladder: at 1 and at 1/2 the field stands as tall as a plain
    // string's at the same rung, and the toggle as tall as the field.
    const ladder = {};
    for (const size of ['1', '1/2']) {
      const pair = document.createElement('div');
      holder.append(pair);
      const plain = document.createElement('div');
      const secret = document.createElement('div');
      pair.append(plain, secret);
      render(set.renderEditField({key: 'name', label: 'Имя', propertyType: 'string'}, '', host, {size}), plain);
      render(set.renderEditField(fields.fresh, null, host, {size}), secret);
      await tick(300);
      const height = (node) => Math.round(node?.getBoundingClientRect().height ?? -1);
      ladder[size] = {plain: height(plain.querySelector('.sf-input-field')), field: height(secret.querySelector('.sf-input-field')),
        button: height(secret.querySelector('sf-icon-button button'))};
      pair.remove();
    }

    return {variant, edit, ladder, untouched, shown, typed, hidden, erased, view, english, leaksAtEnd: leaks()};
  }, {SENTINEL, STORED});

  if (result.missing) {
    note({case: 'the set is published on window.SF', got: result});
  } else {
    if (!result.variant || result.variant.label?.ru !== 'Пароль' || result.variant.label?.en !== 'Password' || result.variant.writeOnly !== true) {
      note({case: 'the registry names string:password, write-only', got: result.variant});
    }
    const e = result.edit;
    if (e.type !== 'password' || e.autocomplete !== 'new-password' || e.spellcheck !== false || e.value !== '' || e.valueAttribute) {
      note({case: 'edit: an empty type=password input, autocomplete=new-password, spellcheck off, no value attribute', got: e});
    }
    if (e.required !== false || e.freshRequired !== true || !e.placeholder) {
      note({case: 'a set password is not required again and says an empty field keeps it; an unset required one is required', got: e});
    }
    if (e.buttonName !== 'Показать пароль' || e.pressed !== 'false') {
      note({case: 'the toggle is named in the page language and not pressed', got: e});
    }
    if (e.buttonHeight !== e.fieldHeight) {
      note({case: 'the toggle stands on the field\'s rung of the size ladder', got: {button: e.buttonHeight, field: e.fieldHeight}});
    }
    for (const [size, rung] of Object.entries(result.ladder)) {
      if (rung.plain <= 0 || rung.field !== rung.plain || rung.button !== rung.plain) {
        note({case: `at size ${size} the password field and its toggle are as tall as a string field`, got: rung});
      }
    }
    if (result.ladder['1']?.plain === result.ladder['1/2']?.plain) {
      note({case: 'the two rungs differ', got: result.ladder});
    }
    if (Object.keys(result.untouched.payload).length) {
      note({case: 'an untouched password field puts nothing in the save', got: result.untouched});
    }
    if (result.shown.type !== 'text' || result.shown.pressed !== 'true') {
      note({case: 'the toggle shows the password and is pressed', got: result.shown});
    }
    const t = result.typed;
    if (t.payload.secret !== SENTINEL || Object.keys(t.payload).length !== 1 || t.leaks || t.valueAttribute
      || t.type !== 'text' || t.pressed !== 'true' || t.value !== SENTINEL) {
      note({case: 'a typed password goes out in the save, stays out of the markup, and a re-render keeps it shown', got: t});
    }
    if (result.hidden.type !== 'password' || result.hidden.pressed !== 'false') {
      note({case: 'the toggle hides the password again', got: result.hidden});
    }
    if (Object.keys(result.erased.payload).length) {
      note({case: 'an erased password takes the change back', got: result.erased});
    }
    const v = result.view;
    if (v.set !== 'Задан' || v.unset !== 'Не задан' || v.absent !== 'Не задан' || v.mistaken !== 'Задан'
      || v.cellSet !== 'Задан' || v.cellUnset !== 'Не задан' || v.cellMistaken !== 'Задан' || v.plainCell !== null
      || v.readonly.text !== 'Задан' || v.readonly.input) {
      note({case: 'view, cell and read-only show only set or not set', got: v});
    }
    if (result.english.set !== 'Set' || result.english.unset !== 'Not set' || result.english.buttonName !== 'Show password') {
      note({case: 'an English page reads Set / Not set / Show password', got: result.english});
    }
    if (result.leaksAtEnd) note({case: 'no password appears anywhere in the markup', got: true});
  }
  console.error(JSON.stringify(result, null, 1));
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FIELD_PASSWORD_OK');
