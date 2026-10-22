#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Escape over an open dropdown list closed the whole record panel behind it
// (Larena storage QA, 2026-10-22): the panel, the drawer and the modal all
// listen for Escape on the document in capture and stand back only while the
// root says a surface is open, and that mark was raised by sf-popover alone.
// What this measures is the press itself, over each surface that owns Escape:
// the list closes, and what is behind it stays open.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/dropdown/css/dropdown.css',
  'smart/smart/drawer/css/drawer.css',
  'component/component/modal/css/modal.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/drawer/js/drawer.js',
  'smart/smart/modal/js/modal.js',
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
  const page = await browser.newPage({viewport: {width: 1200, height: 800}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:40px">'
    // The markup each surface is shown with in its own probes: the drawer takes
    // its content as children, the modal through its content slot.
    + '<sf-drawer id="drawer" title="Запись" size="1">'
    + '<sf-dropdown id="in-drawer" label="Статус" size="1">'
    + '<sf-list-item text="Черновик" value="draft"></sf-list-item>'
    + '<sf-list-item text="Опубликовано" value="live"></sf-list-item>'
    + '</sf-dropdown></sf-drawer>'
    + '<sf-modal id="modal" title="Запись">'
    + '<div slot="content"><sf-dropdown id="in-modal" label="Раздел" size="1">'
    + '<sf-list-item text="Каталог" value="catalog"></sf-list-item>'
    + '<sf-list-item text="Новости" value="news"></sf-list-item>'
    + '</sf-dropdown></div></sf-modal>'
    + '<sf-dropdown id="alone" label="Один" size="1" multiple>'
    + '<sf-list-item text="Первый" value="1"></sf-list-item>'
    + '<sf-list-item text="Второй" value="2"></sf-list-item>'
    + '</sf-dropdown>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1500);

  const unupgraded = await page.evaluate(() => ['sf-dropdown', 'sf-drawer', 'sf-modal', 'sf-list-item']
    .filter((tag) => !customElements.get(tag)));
  if (unupgraded.length) {
    console.error(JSON.stringify({unupgraded}, null, 2));
    throw new Error(`${unupgraded.join(', ')} not defined: every measurement of an unupgraded element is false in the same direction.`);
  }

  const measured = await page.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const mark = () => Boolean(document.documentElement.dataset.sfPopoverOpen);
    // The press starts where the person's press starts -- on the control that
    // has the focus -- and travels from there. Dispatched on the document it
    // would reach the drawer's and the modal's own listeners and never the
    // dropdown's, which listens on its own root: the defect is about the order
    // of two listeners on one path, so the path has to be real.
    const press = (node) => node.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true}),
    );

    const read = async (dropdownId, surfaceId) => {
      const dropdown = document.getElementById(dropdownId);
      const surface = surfaceId ? document.getElementById(surfaceId) : null;
      if (surface) {
        surface.setAttribute('open', '');
        await settle(400);
      }
      dropdown.openDropdown();
      await settle(250);
      const trigger = dropdown.querySelector('.sf-dropdown-field, .sf-dropdown-trigger') || dropdown;
      const opened = {list: dropdown.hasAttribute('open') || Boolean(dropdown.querySelector('.sf-dropdown--open')),
        mark: mark(), surface: surface ? surface.hasAttribute('open') : null};
      press(trigger);
      await settle(250);
      const afterFirst = {list: Boolean(dropdown.querySelector('.sf-dropdown--open')),
        mark: mark(), surface: surface ? surface.hasAttribute('open') : null};
      // A second press, with no list open, is the surface's own: it closes.
      // A modal closes through an animation, so the attribute is read until it
      // drops rather than once -- read too early, a closing modal looks like one
      // that ignored the press.
      press(trigger);
      let closing = 0;
      while (surface && surface.hasAttribute('open') && closing < 1600) {
        await settle(200);
        closing += 200;
      }
      const afterSecond = {surface: surface ? surface.hasAttribute('open') : null, waited: closing};
      return {opened, afterFirst, afterSecond};
    };

    const inDrawer = await read('in-drawer', 'drawer');
    const inModal = await read('in-modal', 'modal');
    const alone = await read('alone', null);

    // What a multiple list draws beside each option.
    const multiple = document.getElementById('alone');
    multiple.openDropdown();
    await settle(250);
    const boxes = multiple.querySelectorAll('.sf-list-item .sf-checkbox-box').length;
    const options = multiple.querySelectorAll('.sf-list-item[role="option"]').length;
    multiple.closeDropdown();
    await settle(200);

    return {inDrawer, inModal, alone, multiple: {boxes, options}, markWhenClosed: mark()};
  });

  for (const [where, result] of [['a drawer', measured.inDrawer], ['a modal', measured.inModal]]) {
    if (!result.opened.mark) {
      note({case: `an open list inside ${where} says so on the root`, got: result.opened,
        expected: 'the shared mark present while the list is open'});
    }
    if (result.afterFirst.list || !result.afterFirst.surface) {
      note({case: `Escape over a list inside ${where} closes the list and nothing else`,
        got: result.afterFirst,
        expected: `the list closed, ${where} still open -- one press must not close both`});
    }
    if (result.afterSecond.surface) {
      note({case: `the next Escape, with no list open, closes ${where}`, got: result.afterSecond,
        expected: 'closed: the mark must not outlive the list'});
    }
  }
  if (measured.alone.afterFirst.list || measured.alone.afterFirst.mark) {
    note({case: 'Escape closes a list that stands on its own, and clears the mark',
      got: measured.alone.afterFirst, expected: 'closed, no mark left behind'});
  }
  if (measured.markWhenClosed) {
    note({case: 'no list open, no mark', got: measured.markWhenClosed, expected: false});
  }
  if (!measured.multiple.options || measured.multiple.boxes !== measured.multiple.options) {
    note({case: 'every option of a multiple list carries a box',
      got: measured.multiple,
      expected: 'one box per option -- a class and aria-selected alone show a sighted person nothing'});
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
console.log('DROPDOWN_ESCAPE_OK');
