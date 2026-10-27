#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A data-* an author writes on a Smart host ends up on exactly one element, and
// that element is the native control: the one with a box, the paint, the focus,
// the click and the drag. Measured on the built bytes:
//   - querySelector/querySelectorAll by a data-* find one element, and it is a
//     native <button>, not the host;
//   - the match has a bounding box, is natively focusable and takes a real
//     click at its own coordinates;
//   - closest('sf-button') gets back to the host from the match;
//   - the host reads what the author wrote as element.dataAttributes, and
//     removeHostDataAttribute() clears it from the record and the control;
//   - host.focus() puts focus on the control, host.blur() takes it off, and a
//     focus asked before the first render is applied once the control is there;
//   - aria-* and title are still copied to the native control;
//   - the runtime's own marks (SF.Assembly's data-sf-role, data-sf-instance,
//     data-sf-start, data-sf-started; the first paint's data-sf-static) stay
//     on the host, where the Assembly adopts the part by them; an adopted
//     host that draws loses data-sf-static (stand 24 F2, U1).
//
// Three shapes were tried in production and two were wrong. Moving the
// attribute to the control emptied the host a product had written it on
// (ui-mail.button-data-attributes); copying it put every one on two elements,
// so a count came back doubled and the first match was the display:contents
// host -- no box for a drag, no paint for a visual probe
// (larena.property-view-arranging, larena.property-view,
// larena.table-sortable-lists, larena.admin-menu-search). Keeping it on the
// host alone leaves one element, but a boxless one: a display:contents host
// generates no box at all. So the control carries it, the host is reached with
// closest(), and the host's record is public.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/icon-button/js/icon-button.js',
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
  // What an author wrote on a host, without the runtime's own state marks
  // (data-sf-started is the base value started, §4.1, and stays on the host).
  await page.evaluate(() => {
    window.authored = (host) => Object.fromEntries(Object.entries(host.dataset).filter(([key]) => key !== 'sfStarted'));
  });
  await page.waitForTimeout(600);
  return page;
}

try {
  // 1. One element per data-*, and it is the native control. The shell that
  //    counts is the product's own container, as Larena's property view counts
  //    its close button inside the panel it drew.
  {
    const page = await open(`<div id="shell">
      <sf-button id="close" text="Закрыть" data-action="close" data-add="block" title="Закрыть панель" aria-describedby="hint"></sf-button>
      <sf-icon-button id="toggle" icon="search" aria-label="Поиск" data-sf-admin-search-toggle data-column-key="f2"></sf-icon-button>
    </div>`);

    const found = await page.evaluate(() => {
      const shell = document.querySelector('#shell');
      const tags = (selector) => Array.from(shell.querySelectorAll(selector)).map((node) => node.tagName.toLowerCase());
      const first = (selector) => shell.querySelector(selector);
      return {
        closeAll: tags('[data-action="close"]'),
        addAll: tags('[data-add]'),
        toggleAll: tags('[data-sf-admin-search-toggle]'),
        columnAll: tags('[data-column-key="f2"]'),
        firstIsControl: first('[data-add]') === document.querySelector('#close button'),
        backToHost: first('[data-add]')?.closest('sf-button')?.id || null,
        backToIconHost: first('[data-column-key="f2"]')?.closest('sf-icon-button')?.id || null,
        onHost: {
          action: document.querySelector('#close').getAttribute('data-action'),
          dataset: authored(document.querySelector('#close')),
        },
        copied: {
          title: document.querySelector('#close button').getAttribute('title'),
          describedby: document.querySelector('#close button').getAttribute('aria-describedby'),
          label: document.querySelector('#toggle button').getAttribute('aria-label'),
        },
      };
    });
    evidence.found = found;

    check('data-action="close" is on one element', found.closeAll.length === 1 && found.closeAll[0] === 'button', found);
    check('data-add is on one element, the native button', found.addAll.length === 1 && found.addAll[0] === 'button', found);
    check('data-sf-admin-search-toggle is on one element, the native button',
      found.toggleAll.length === 1 && found.toggleAll[0] === 'button', found);
    check('data-column-key is on one element, the native button',
      found.columnAll.length === 1 && found.columnAll[0] === 'button', found);
    check('the first match of a data-* selector is the control', found.firstIsControl === true, found);
    check('closest() gets back to the sf-button host', found.backToHost === 'close', found);
    check('closest() gets back to the sf-icon-button host', found.backToIconHost === 'toggle', found);
    check('the host no longer carries the attribute', found.onHost.action === null
      && Object.keys(found.onHost.dataset).length === 0, found);
    check('aria-* and title still reach the native control', found.copied.title === 'Закрыть панель'
      && found.copied.describedby === 'hint' && found.copied.label === 'Поиск', found);

    // The match has a box and takes a real click at its own coordinates: this
    // is what the drag in table-sortable-lists and the visual read in
    // property-view need, and what a display:contents host cannot give.
    const handle = page.locator('#shell [data-column-key="f2"]').first();
    const box = await handle.boundingBox();
    evidence.box = box;
    check('the first match of a data-* selector has a bounding box',
      Boolean(box) && box.width > 0 && box.height > 0, {box});

    const painted = await page.evaluate(() => {
      const button = document.querySelector('#shell [data-action="close"]');
      const style = getComputedStyle(button);
      return {background: style.backgroundColor, display: style.display, tag: button.tagName.toLowerCase()};
    });
    evidence.painted = painted;
    check('the match is a painted element, not a boxless host',
      painted.tag === 'button' && painted.display !== 'contents', painted);

    await page.evaluate(() => {
      window.__clicks = [];
      document.querySelector('#shell').addEventListener('click', (event) => {
        window.__clicks.push({
          fromTarget: event.target.dataset?.action ?? null,
          fromClosest: event.target.closest('[data-action]')?.tagName.toLowerCase() || null,
          host: event.target.closest('sf-button')?.id || null,
        });
      });
    });

    // A real pointer click, at the coordinates of the element the selector
    // found: this is the click a host cannot take, having no box.
    await page.locator('#shell [data-action="close"]').first().click();
    // And a click whose target is the control itself, which is what a listener
    // reading event.target.dataset sees. A pointer lands on the label span
    // inside, so the two are separate cases and closest() is what spans both.
    await page.evaluate(() => document.querySelector('#shell [data-action="close"]').click());

    const clicks = await page.evaluate(() => window.__clicks);
    evidence.clicks = clicks;
    check('a real click at the match coordinates reaches it', clicks.length === 2, {clicks});
    check('closest() reads the data-* from wherever the click landed',
      clicks.every((click) => click.fromClosest === 'button' && click.host === 'close'), {clicks});
    check('a listener reading event.target.dataset sees it on the control',
      clicks[1]?.fromTarget === 'close', {clicks});
    await page.close();
  }

  // 1a. The runtime's marks stay on the host: SF.Assembly finds a part by its
  //     data-sf-role on the part's own tag, and a printed sf-button whose role
  //     went to its <button> was drawn a second time (stand 24 F2).
  {
    const page = await open(`<div id="shell">
      <sf-button id="part" text="Меню" data-sf-role="menu-button" data-sf-instance="page/screen/menu-button"
        data-sf-start="now" data-sf-started data-sf-static data-action="open"></sf-button>
    </div>`);
    const marks = await page.evaluate(() => {
      const host = document.querySelector('#part');
      const button = host.querySelector('button');
      const names = ['data-sf-role', 'data-sf-instance', 'data-sf-start', 'data-sf-started'];
      return {
        host: names.filter((name) => host.hasAttribute(name)),
        control: names.filter((name) => button?.hasAttribute(name)),
        role: document.querySelector('[data-sf-role="menu-button"]')?.localName ?? null,
        action: document.querySelectorAll('[data-action="open"]').length === 1 && button?.getAttribute('data-action') === 'open',
        static: host.hasAttribute('data-sf-static') || Boolean(button?.hasAttribute('data-sf-static')),
      };
    });
    evidence.marks = marks;
    check('the Assembly\'s marks stay on the host', marks.host.length === 4 && marks.control.length === 0 && marks.role === 'sf-button', marks);
    check('an author\'s data-* still moves to the control', marks.action === true, marks);
    check('a drawn host is no longer static markup', marks.static === false, marks);
    await page.close();
  }

  // 2. The host's record of what the author wrote, and taking one back.
  {
    const page = await open('<div id="panel"></div>');

    const record = await page.evaluate(async () => {
      const panel = document.querySelector('#panel');
      const add = document.createElement('sf-button');
      add.textContent = 'Добавить';
      add.dataset.add = 'block';
      add.dataset.columnKey = 'f2';
      panel.append(add);
      await new Promise((done) => setTimeout(done, 400));

      const afterRender = {
        read: {...add.dataAttributes},
        dataset: authored(add),
        onControl: add.querySelector('button')?.getAttribute('data-add') || null,
        count: panel.querySelectorAll('[data-add]').length,
      };

      add.removeHostDataAttribute('data-add');
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

      // A second render must not put it back: the record is what the control
      // is given again, so clearing the record is what removes it for good.
      add.setAttribute('text', 'Добавить ещё');
      await new Promise((done) => setTimeout(done, 400));

      return {
        afterRender,
        afterRemove: {
          read: {...add.dataAttributes},
          count: panel.querySelectorAll('[data-add]').length,
          other: panel.querySelectorAll('[data-column-key="f2"]').length,
          onControl: add.querySelector('button')?.getAttribute('data-add') || null,
        },
      };
    });
    evidence.record = record;

    check('the host reads what the author wrote, like dataset',
      record.afterRender.read.add === 'block' && record.afterRender.read.columnKey === 'f2', record);
    check('the attribute itself is on the control, not the host',
      record.afterRender.onControl === 'block' && record.afterRender.count === 1
      && Object.keys(record.afterRender.dataset).length === 0, record);
    check('removeHostDataAttribute clears the record and the control',
      record.afterRemove.read.add === undefined && record.afterRemove.count === 0
      && record.afterRemove.onControl === null, record);
    check('and a later render does not put it back', record.afterRemove.count === 0, record);
    check('the other data-* is untouched', record.afterRemove.other === 1
      && record.afterRemove.read.columnKey === 'f2', record);
    await page.close();
  }

  // 3. Focus through the host: the host takes none itself.
  {
    const page = await open(`<div id="menu">
      <sf-icon-button id="toggle" icon="search" aria-label="Поиск" data-sf-admin-search-toggle></sf-icon-button>
      <sf-button id="save" text="Сохранить"></sf-button>
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

      // What the admin menu does on Escape: the attribute answers the native
      // button, which is focusable on its own.
      document.querySelector('[data-sf-admin-search-toggle]').focus();
      const byAttribute = where();

      document.activeElement.blur();

      // And the host answers focus() as well, for a product that holds the host.
      const host = document.querySelector('#toggle');
      host.focus();
      const byHost = where();
      host.blur();
      const afterBlur = where();

      document.querySelector('#save').focus();
      return {
        byAttribute,
        byHost,
        afterBlur,
        saveIsControl: document.activeElement === document.querySelector('#save button'),
      };
    });
    evidence.focus = focus;

    check('the data-* match is focusable on its own',
      focus.byAttribute.tag === 'button' && focus.byAttribute.inToggle
      && focus.byAttribute.label === 'Поиск', focus);
    check('focus() on the host lands on the native control inside it',
      focus.byHost.tag === 'button' && focus.byHost.inToggle, focus);
    check('blur() on the host takes focus off it', !focus.afterBlur.inToggle, focus);
    check('focus() on an sf-button host lands on its native button', focus.saveIsControl === true, focus);
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

      return {applied, kept: document.activeElement?.id || null};
    });
    evidence.early = early;

    check('a focus asked before the first render is applied to the control',
      early.applied.tag === 'button' && early.applied.inMade, early);
    check('a queued focus does not steal focus back', early.kept === 'other', early);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('HOST_DATA_ATTRIBUTES_FOCUS_OK');
