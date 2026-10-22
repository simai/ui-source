#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Auto-grow for sf-textarea (simai/ui-source#17), measured on the built bytes.
// The acceptance base is ui-chat's composer (f359b7d): the field grows with its
// text, stops at a cap and scrolls inside, and nothing around it shifts. Here:
//   - at every step, 1/3 to 3 (1/3 and 3 render as the kept 1/2 and 2), on both
//     sides of the 60rem breakpoint (widths 1000 and 390), for the Smart element
//     and the ordinary markup alike: an empty field is exactly as tall as the
//     sf-input field and the sf-button of the same size; N rows are that height
//     plus (N - 1) line heights of that size; growth stops at max-rows and the
//     field scrolls inside; deleting the text shrinks it back to min-rows;
//   - min-rows above one, typing, pasting a long wrapping text, a value set from
//     code (element.value, setState, the native textarea's value), a form reset,
//     a disabled field and a right-to-left field;
//   - an IME composition: nothing is written to the field while it lasts, and
//     the height follows once it ends; the window does not scroll while a field
//     above the fold shrinks;
//   - all of it twice: with CSS field-sizing (the browser sizes the field and the
//     script writes nothing), and with field-sizing taken away (CSS.supports says
//     no and the property is overridden), where the script's fallback sizes it.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/inputs/css/inputs.css', 'smart/smart/inputs/css/inputs.css', 'component/component/textarea/css/textarea.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/inputs/js/inputs.js', 'component/component/textarea/js/textarea.js', 'smart/smart/textarea/js/textarea.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const KEPT = {'1/3': '1/2', '3': '2'};
const MAX = 4;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();

async function open({width, body, fallback}) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  if (fallback) {
    // A browser without field-sizing: the feature query says no, and the
    // property no longer sizes the field.
    await page.evaluate(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => (/field-sizing/u.test(String(args[0])) ? false : supports(...args));
    });
    await page.addStyleTag({content: 'textarea { field-sizing: fixed !important; }'});
  }
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-textarea') && customElements.get('sf-input') && customElements.get('sf-button'));
  await page.waitForFunction(() => [...document.querySelectorAll('sf-textarea')].every((node) => node.querySelector('textarea')));
  await page.waitForTimeout(400);
  return page;
}

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// Sets text the way the case says and returns the field's height afterwards.
const HEIGHTS = `async (rows, mode) => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const text = (n) => Array.from({length: n}, (_, i) => 'Строка ' + (i + 1)).join('\\n');
  const out = {};
  for (const row of rows) {
    const element = row.querySelector(mode === 'smart' ? 'sf-textarea' : 'label.sf-textarea[data-plain]');
    const field = element.querySelector('textarea');
    const write = (value) => { if (mode === 'smart') element.value = value; else field.value = value; };
    const height = () => field.getBoundingClientRect().height;
    const result = {size: row.dataset.size};
    result.button = row.querySelector('sf-button > button').getBoundingClientRect().height;
    result.input = row.querySelector('sf-input .sf-input-field').getBoundingClientRect().height;
    result.line = parseFloat(getComputedStyle(field).lineHeight);
    result.empty = height();
    result.rows = [];
    for (let n = 1; n <= ${MAX} + 2; n += 1) {
      write(text(n));
      await frame();
      result.rows.push(height());
    }
    result.scrolls = field.scrollHeight > field.clientHeight + 1;
    result.overflow = getComputedStyle(field).overflowY;
    write('');
    await frame();
    result.deleted = height();
    result.inline = field.style.blockSize;
    result.fieldSizing = getComputedStyle(field).fieldSizing;
    result.resize = getComputedStyle(field).resize;
    out[row.dataset.size] = result;
  }
  return out;
}`;

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

try {
  for (const mode of ['css', 'fallback']) {
    const fallback = mode === 'fallback';
    // The script writes scrollHeight, a whole number; CSS sizes to the pixel.
    const tolerance = fallback ? 0.5 : 0.01;

    // 1. The ladder, both sides of 60rem, Smart and ordinary markup.
    for (const width of [1000, 390]) {
      // Each control on its own line, as wide as a phone allows: a squeezed field
      // wraps its placeholder and is measured at two lines.
      const body = SIZES.map((size) => `<div data-row data-size="${size}" style="display:grid;gap:8px;inline-size:min(100%, 480px);margin-block-end:16px">
        <div><sf-button size="${KEPT[size] ?? size}" icon="search" text="Кнопка"></sf-button></div>
        <sf-input size="${size}" placeholder="Поле"></sf-input>
        <sf-textarea size="${size}" auto-grow max-rows="${MAX}" placeholder="Сообщение"></sf-textarea>
        <label data-plain class="sf-textarea sf-textarea--size-${size} sf-textarea--bordered flex flex-col">
          <textarea data-auto-grow data-max-rows="${MAX}" placeholder="Сообщение"></textarea>
        </label>
      </div>`).join('');
      const page = await open({width, body, fallback});
      for (const kind of ['smart', 'plain']) {
        const rows = await page.evaluate(async ({source, kind}) => eval(source)([...document.querySelectorAll('[data-row]')], kind), {source: HEIGHTS, kind});
        evidence[`${mode}@${width}:${kind}`] = Object.values(rows).map((row) => ({
          size: row.size, button: row.button, input: row.input, line: row.line, empty: row.empty,
          rows: row.rows.map((value) => Number(value.toFixed(2))), deleted: row.deleted,
        }));
        for (const row of Object.values(rows)) {
          const at = `${mode} ${kind} size ${row.size} at ${width}px`;
          // 1/3 and 3 are compared with the button of the size they draw as.
          check(`${at}: an empty field is the sf-button and the sf-input height`, near(row.empty, row.button, tolerance) && near(row.empty, row.input, tolerance) && row.empty > 0, row);
          row.rows.forEach((height, index) => {
            const n = Math.min(index + 1, MAX);
            const expected = row.empty + (n - 1) * row.line;
            check(`${at}: ${index + 1} rows are one row + ${n - 1} line heights`, near(height, expected, tolerance), {height, expected, row});
          });
          check(`${at}: past max-rows the field scrolls inside`, row.scrolls && row.overflow === 'auto', row);
          check(`${at}: deleting the text shrinks it back to one row`, near(row.deleted, row.empty, tolerance), row);
          check(`${at}: not resizable by hand`, row.resize === 'none', row);
          if (fallback) check(`${at}: the fallback writes the block size`, row.inline.endsWith('px'), row);
          else check(`${at}: field-sizing sizes it and the script writes nothing`, row.fieldSizing === 'content' && row.inline === '', row);
        }
        // 1/3 and 3 are retired for fields: they draw as 1/2 and 2.
        for (const [retired, kept] of Object.entries(KEPT)) {
          check(`${mode} ${kind} at ${width}px: size ${retired} draws as ${kept}`, near(rows[retired].empty, rows[kept].empty, tolerance) && near(rows[retired].line, rows[kept].line, 0.01), {retired: rows[retired], kept: rows[kept]});
        }
        // The ladder rises.
        const ladder = ['1/2', '1', '2'].map((size) => rows[size].empty);
        check(`${mode} ${kind} at ${width}px: the ladder rises`, ladder[0] < ladder[1] && ladder[1] < ladder[2], {ladder});
      }
      check(`${mode} no horizontal scroll at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await page.close();
    }

    // 2. Behaviour at size 1: min-rows, typing, paste, setState, reset, disabled,
    //    RTL, IME composition and the window's scroll.
    {
      const body = `
        <sf-button size="1" text="Кнопка"></sf-button>
        <sf-textarea id="min" auto-grow min-rows="2" max-rows="5" style="display:block;width:360px"></sf-textarea>
        <sf-textarea id="typed" auto-grow max-rows="${MAX}" style="display:block;width:360px"></sf-textarea>
        <sf-textarea id="disabled" auto-grow disabled value="${'Строка\n'.repeat(2)}Строка" style="display:block;width:360px"></sf-textarea>
        <div dir="rtl" style="width:360px"><sf-textarea id="rtl" auto-grow max-rows="${MAX}"></sf-textarea></div>
        <form id="form" style="width:360px"><sf-textarea id="reset" auto-grow max-rows="${MAX}" value="Первая строка"></sf-textarea></form>
        <sf-textarea id="state" auto-grow max-rows="${MAX}" style="display:block;width:360px"></sf-textarea>
        <sf-textarea id="ime" auto-grow max-rows="${MAX}" style="display:block;width:360px"></sf-textarea>
        <sf-textarea id="unbounded" auto-grow style="display:block;width:360px"></sf-textarea>
        <sf-textarea id="plain-rows" rows="3" style="display:block;width:360px"></sf-textarea>
        <div style="height:2400px"></div>`;
      const page = await open({width: 1000, body, fallback});
      const base = await page.evaluate(() => {
        const field = document.querySelector('#typed textarea');
        return {one: field.getBoundingClientRect().height, line: parseFloat(getComputedStyle(field).lineHeight),
          button: document.querySelector('sf-button > button').getBoundingClientRect().height};
      });
      const rowsOf = (n) => base.one + (n - 1) * base.line;
      const height = (selector) => page.evaluate((s) => document.querySelector(`${s} textarea`).getBoundingClientRect().height, selector);
      const at = (name) => `${mode} ${name}`;
      check(at('a one-row field is the button height'), near(base.one, base.button, tolerance), base);

      // min-rows
      const minEmpty = await height('#min');
      check(at('min-rows="2": an empty field shows two rows'), near(minEmpty, rowsOf(2), tolerance), {minEmpty, expected: rowsOf(2)});

      // typing: Enter is a newline, and the field grows line by line.
      await page.click('#typed textarea');
      const typed = [];
      for (let n = 1; n <= MAX + 1; n += 1) {
        await page.keyboard.type(`Строка ${n}`);
        await settle(page);
        typed.push(await height('#typed'));
        if (n <= MAX) await page.keyboard.press('Enter');
      }
      evidence[`${mode}:typed`] = typed;
      check(at('typing grows the field a line at a time to the cap'), typed.every((value, index) => near(value, rowsOf(Math.min(index + 1, MAX)), tolerance)), {typed, one: base.one, line: base.line});
      const typedValue = await page.evaluate(() => document.querySelector('#typed textarea').value);
      check(at('Enter stays a newline'), typedValue.split('\n').length === MAX + 1, {typedValue});
      // Backspace to the start: it shrinks back.
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await settle(page);
      check(at('deleting by keyboard shrinks it back to one row'), near(await height('#typed'), base.one, tolerance));

      // paste a long wrapping paragraph
      await page.keyboard.insertText('Длинный вставленный текст, который переносится по словам. '.repeat(12));
      // The browser brings the caret into view a few frames after the paste.
      await page.waitForTimeout(300);
      const pasted = await page.evaluate(() => {
        const field = document.querySelector('#typed textarea');
        return {height: field.getBoundingClientRect().height, scrolls: field.scrollHeight > field.clientHeight + 1, scrollTop: field.scrollTop};
      });
      evidence[`${mode}:pasted`] = pasted;
      check(at('a pasted long text grows to the cap and scrolls inside, the caret in view'), near(pasted.height, rowsOf(MAX), tolerance) && pasted.scrolls && pasted.scrollTop > 0, pasted);

      // disabled with three lines
      check(at('a disabled field with three lines is three rows'), near(await height('#disabled'), rowsOf(3), tolerance));

      // RTL
      await page.evaluate(() => { document.querySelector('#rtl').value = 'שורה\nשורה\nשורה'; });
      await settle(page);
      const rtl = await page.evaluate(() => {
        const field = document.querySelector('#rtl textarea');
        return {height: field.getBoundingClientRect().height, direction: getComputedStyle(field).direction};
      });
      check(at('a right-to-left field grows the same'), rtl.direction === 'rtl' && near(rtl.height, rowsOf(3), tolerance), rtl);

      // setState and the native value
      await page.evaluate(() => { document.querySelector('#state').setState({value: 'А\nБ\nВ'}); });
      await settle(page);
      check(at('setState({value}) grows it'), near(await height('#state'), rowsOf(3), tolerance));
      await page.evaluate(() => { document.querySelector('#state textarea').value = 'А\nБ'; });
      await settle(page);
      check(at('the native textarea value set from code resizes it'), near(await height('#state'), rowsOf(2), tolerance));

      // form reset
      await page.evaluate(() => { document.querySelector('#reset textarea').value = 'А\nБ\nВ\nГ'; });
      await settle(page);
      const beforeReset = await height('#reset');
      await page.evaluate(() => document.querySelector('#form').reset());
      await page.waitForTimeout(50);
      await settle(page);
      const afterReset = await height('#reset');
      check(at('a form reset shrinks it back to the default text'), near(beforeReset, rowsOf(4), tolerance) && near(afterReset, rowsOf(1), tolerance), {beforeReset, afterReset});

      // no cap without max-rows
      await page.evaluate(() => { document.querySelector('#unbounded').value = Array.from({length: 9}, () => 'Строка').join('\n'); });
      await settle(page);
      const unbounded = await page.evaluate(() => {
        const field = document.querySelector('#unbounded textarea');
        return {height: field.getBoundingClientRect().height, scrolls: field.scrollHeight > field.clientHeight + 1};
      });
      check(at('with no max-rows it grows without a cap'), near(unbounded.height, rowsOf(9), tolerance) && !unbounded.scrolls, unbounded);

      // a field without auto-grow is untouched
      const plainRows = await page.evaluate(() => {
        const field = document.querySelector('#plain-rows textarea');
        const style = getComputedStyle(field);
        return {rows: field.rows, resize: style.resize, fieldSizing: style.fieldSizing, inline: field.style.blockSize};
      });
      check(at('a field without auto-grow keeps rows and vertical resize'), plainRows.rows === 3 && plainRows.resize === 'vertical' && plainRows.inline === '' && plainRows.fieldSizing !== 'content', plainRows);

      // IME composition: nothing is written while it lasts.
      const ime = await page.evaluate(async () => {
        const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const field = document.querySelector('#ime textarea');
        const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        const writes = [];
        const observer = new MutationObserver((records) => writes.push(...records.map((record) => record.attributeName)));
        observer.observe(field, {attributes: true, attributeFilter: ['style', 'rows', 'class']});
        const start = field.getBoundingClientRect().height;
        const inlineBefore = field.style.blockSize;
        field.dispatchEvent(new CompositionEvent('compositionstart', {data: ''}));
        let composed = '';
        for (const piece of ['に', 'ほ', 'ん\n', 'ご\n', 'で\n']) {
          composed += piece;
          native.set.call(field, composed);
          field.dispatchEvent(new InputEvent('input', {bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: piece}));
          await frame();
        }
        const during = {writes: writes.length, inline: field.style.blockSize};
        field.dispatchEvent(new CompositionEvent('compositionend', {data: composed}));
        field.dispatchEvent(new InputEvent('input', {bubbles: true, isComposing: false, inputType: 'insertCompositionText'}));
        await frame();
        observer.disconnect();
        return {start, inlineBefore, during, after: field.getBoundingClientRect().height, writesAfter: writes.length};
      });
      evidence[`${mode}:ime`] = ime;
      check(at('no write to the field during an IME composition'), ime.during.writes === 0 && ime.during.inline === ime.inlineBefore, ime);
      check(at('after the composition the field has the composed four rows'), near(ime.after, rowsOf(4), tolerance), {ime, expected: rowsOf(4)});
      if (fallback) check(at('the fallback measures once the composition ends'), ime.writesAfter > 0, ime);

      // The window does not move while a field above the fold shrinks and grows.
      const scroll = await page.evaluate(async () => {
        const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const element = document.querySelector('#unbounded');
        const field = element.querySelector('textarea');
        window.scrollTo({top: field.getBoundingClientRect().top + window.scrollY - 40, behavior: 'instant'});
        await frame();
        const target = field.getBoundingClientRect().top;
        const before = window.scrollY;
        element.value = 'Одна строка';
        await frame();
        const shrunk = window.scrollY;
        element.value = Array.from({length: 6}, () => 'Строка').join('\n');
        await frame();
        return {target, before, shrunk, grown: window.scrollY, height: document.documentElement.scrollHeight};
      });
      check(at('the window does not scroll while the field resizes'), scroll.before > 0 && scroll.shrunk === scroll.before && scroll.grown === scroll.before, scroll);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TEXTAREA_AUTO_GROW_OK');
