#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A data-* an author writes on a Smart host names one element, and that element
// can be focused. Measured on the built bytes:
//   - querySelector/querySelectorAll by a host data-* find exactly one element,
//     and it is the host the author wrote it on;
//   - the native control inside carries none of them;
//   - host.dataset reads them, and removing one from the host removes it
//     everywhere;
//   - delegation reaches the host from the control with
//     event.target.closest('[data-...]');
//   - host.focus() puts focus on the native control inside, host.blur() takes
//     it off, and a focus asked before the first render is applied once the
//     control is there;
//   - aria-* and title are still copied to the native control.
//
// The pair of cases this exists for: ui-mail wrote data-add on <sf-button> and
// found nothing (the attribute was moved to the inner button), and Larena then
// counted two elements for one data-action="close" and could not return focus to
// a magnifier found by data-sf-admin-search-toggle (the attribute was copied to
// both). One element, focusable.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js',
  'smart/smart/buttons/js/buttons.js', 'smart/smart/icon-buttons/js/icon-buttons.js',
  'component/component/buttons/js/buttons.js', 'component/component/icon-buttons/js/icon-buttons.js'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();

async function open(body) {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => ['sf-button', 'sf-icon-button'].every((tag) => customElements.get(tag)));
  await page.waitForTimeout(600);
  return page;
}

try {
  // 1. One element per data-*, and it is the host. The shell that counts is the
  //    product's own container, as Larena's property view counts its close
  //    button inside the panel it drew.
  {
    const page = await open(`<div id="shell">
      <sf-button id="close" text="Закрыть" data-action="close" data-add="block" title="Закрыть панель" aria-describedby="hint"></sf-button>
      <sf-icon-button id="toggle" icon="search" aria-label="Поиск" data-sf-admin-search-toggle data-action="close"></sf-icon-button>
    </div>`);

    const found = await page.evaluate(() => {
      const shell = document.querySelector('#shell');
      const control = (id) => document.querySelector(`#${id} button`);
      const tags = (selector) => Array.from(shell.querySelectorAll(selector)).map((node) => node.tagName.toLowerCase());
      return {
        closeAll: tags('[data-action="close"]'),
        addAll: tags('[data-add]'),
        toggleAll: tags('[data-sf-admin-search-toggle]'),
        oneClose: shell.querySelector('[data-add]')?.tagName.toLowerCase() || null,
        dataset: {...document.querySelector('#close').dataset},
        onControl: {
          action: control('close').getAttribute('data-action'),
          add: control('close').getAttribute('data-add'),
          toggle: control('toggle').getAttribute('data-sf-admin-search-toggle'),
        },
        copied: {
          title: control('close').getAttribute('title'),
          describedby: control('close').getAttribute('aria-describedby'),
          label: control('toggle').getAttribute('aria-label'),
        },
      };
    });
    evidence.found = found;

    // Two hosts carry data-action="close", one each -- the count a product gets
    // is the number of hosts it wrote it on, never doubled by the control.
    check('data-action="close" is on the two hosts and nothing else', found.closeAll.length === 2
      && found.closeAll.every((tag) => tag === 'sf-button' || tag === 'sf-icon-button'), found);
    check('data-add is on exactly one element', found.addAll.length === 1 && found.addAll[0] === 'sf-button', found);
    check('data-sf-admin-search-toggle is on exactly one element', found.toggleAll.length === 1
      && found.toggleAll[0] === 'sf-icon-button', found);
    check('querySelector by a host data-* answers the host', found.oneClose === 'sf-button', found);
    check('host.dataset reads what the author wrote', found.dataset.action === 'close' && found.dataset.add === 'block', found);
    check('the native control carries no data-*', found.onControl.action === null
      && found.onControl.add === null && found.onControl.toggle === null, found);
    check('aria-* and title still reach the native control', found.copied.title === 'Закрыть панель'
      && found.copied.describedby === 'hint' && found.copied.label === 'Поиск', found);
    await page.close();
  }

  // 2. Focus: the element a data-* selector finds is the element to focus.
  {
    const page = await open(`<div id="menu">
      <sf-icon-button id="toggle" icon="search" aria-label="Поиск" data-sf-admin-search-toggle></sf-icon-button>
      <sf-button id="save" text="Сохранить" data-save></sf-button>
    </div>`);

    const focus = await page.evaluate(() => {
      const menu = document.querySelector('#menu');
      const where = () => {
        const active = document.activeElement;
        return {
          tag: active?.tagName.toLowerCase() || null,
          inMenu: menu.contains(active),
          inToggle: document.querySelector('#toggle').contains(active),
          label: active?.getAttribute?.('aria-label') || null,
        };
      };

      // Exactly what the admin menu does on Escape: find the magnifier by the
      // attribute it wrote, and focus the answer.
      const toggle = menu.querySelector('[data-sf-admin-search-toggle]');
      toggle.focus();
      const afterFocus = where();

      toggle.blur();
      const afterBlur = where();

      const save = menu.querySelector('[data-save]');
      save.focus();
      return {
        host: toggle.tagName.toLowerCase(),
        afterFocus,
        afterBlur,
        afterSave: where(),
        saveIsControl: document.activeElement === document.querySelector('#save button'),
      };
    });
    evidence.focus = focus;

    check('the attribute answers the host', focus.host === 'sf-icon-button', focus);
    check('focus() on the host lands on the native control inside it',
      focus.afterFocus.tag === 'button' && focus.afterFocus.inToggle && focus.afterFocus.inMenu, focus);
    check('the focused control is the magnifier', focus.afterFocus.label === 'Поиск', focus);
    check('blur() on the host takes focus off it', !focus.afterBlur.inToggle, focus);
    check('focus() on an sf-button host lands on its native button',
      focus.afterSave.tag === 'button' && focus.saveIsControl, focus);
    await page.close();
  }

  // 3. Delegation, and a data-* the author takes back.
  {
    const page = await open('<div id="list"><sf-button id="add" text="Добавить" data-add="block"></sf-button></div>');

    const delegated = await page.evaluate(async () => {
      const list = document.querySelector('#list');
      const seen = [];
      list.addEventListener('click', (event) => {
        const handle = event.target.closest('[data-add]');
        seen.push({
          fromTarget: event.target.dataset?.add ?? null,
          fromClosest: handle?.dataset.add ?? null,
          handle: handle?.tagName.toLowerCase() || null,
          targetIsControl: event.target === document.querySelector('#add button'),
        });
      });

      document.querySelector('#add button').click();

      // Taken back off the host: nothing is left anywhere.
      const host = document.querySelector('#add');
      host.removeAttribute('data-add');
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

      return {
        seen,
        left: list.querySelectorAll('[data-add]').length,
        onControl: document.querySelector('#add button').getAttribute('data-add'),
      };
    });
    evidence.delegated = delegated;

    check('a click reaches the control, not the host', delegated.seen[0]?.targetIsControl === true, delegated);
    check('closest() reads the host attribute from the control',
      delegated.seen[0]?.fromClosest === 'block' && delegated.seen[0]?.handle === 'sf-button', delegated);
    check('event.target carries no data-* of its own', delegated.seen[0]?.fromTarget === null, delegated);
    check('removing a data-* from the host leaves it nowhere',
      delegated.left === 0 && delegated.onControl === null, delegated);
    await page.close();
  }

  // 4. focus() before the control exists: applied on the first render, and
  //    dropped if something else took focus while it waited.
  {
    const page = await open('<div id="panel"><input id="other"></div>');

    const early = await page.evaluate(async () => {
      const panel = document.querySelector('#panel');

      const made = document.createElement('sf-button');
      made.textContent = 'Добавить';
      made.dataset.add = 'block';
      panel.append(made);
      made.focus();
      await new Promise((done) => setTimeout(done, 400));
      const applied = {
        tag: document.activeElement?.tagName.toLowerCase() || null,
        inMade: made.contains(document.activeElement),
      };

      const second = document.createElement('sf-button');
      second.textContent = 'Отправить';
      panel.append(second);
      second.focus();
      document.querySelector('#other').focus();
      await new Promise((done) => setTimeout(done, 400));
      const kept = document.activeElement?.id || null;

      return {applied, kept, one: panel.querySelectorAll('[data-add]').length};
    });
    evidence.early = early;

    check('a focus asked before the first render is applied to the control',
      early.applied.tag === 'button' && early.applied.inMade, early);
    check('a queued focus does not steal focus back', early.kept === 'other', early);
    check('a data-* set from code is on the host alone', early.one === 1, early);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('HOST_DATA_ATTRIBUTES_FOCUS_OK');
