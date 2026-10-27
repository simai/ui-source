#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-popover: the behaviour the Framework had no part for. What this measures is
// what a surface has to do beyond being positioned -- open on its trigger, close
// on Escape and on a press outside, give the focus back, and say on the root that
// it is open so the window behind it leaves that Escape alone.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'smart/smart/popover/css/popover.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/icon-button/js/icon-button.js',
  'smart/smart/context-menu/js/context-menu.js',
  'smart/smart/popover/js/popover.js',
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
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0;padding:40px">'
    + '<button id="outside" type="button">Outside</button>'
    + '<sf-popover id="pop" label="Настройки" width="16rem">'
    + '<button slot="trigger" id="trigger" type="button">Open</button>'
    + '<div slot="content"><button id="inside" type="button">Inside</button></div>'
    + '</sf-popover>'
    + '<sf-popover id="legacy" role="menu"><button slot="trigger" id="legacy-trigger" type="button">Menu</button>'
    + '<div slot="content" id="legacy-surface"><button type="button">Item</button></div></sf-popover>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1200);

  const unupgraded = await page.evaluate(() => ['sf-popover', 'sf-context-menu']
    .filter((tag) => !customElements.get(tag)));
  if (unupgraded.length) {
    console.error(JSON.stringify({unupgraded}, null, 2));
    throw new Error(`${unupgraded.join(', ')} not defined: every measurement of an unupgraded element is false in the same direction.`);
  }

  const measured = await page.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const pop = document.getElementById('pop');
    const readMark = () => Boolean(document.documentElement.dataset.sfPopoverOpen);
    // The surface is the consumer's own node and stays where it was written, so
    // what a closed popover owes is that nothing of it is shown -- not that the
    // node is gone.
    const shown = (id) => Boolean(document.getElementById(id)?.getClientRects().length);

    const expanded = () => document.getElementById('trigger').getAttribute('aria-expanded');
    const closed = {open: pop.hasAttribute('open'), content: shown('inside'), mark: readMark(), expanded: expanded()};

    document.getElementById('trigger').click();
    await settle(200);
    const opened = {open: pop.hasAttribute('open'), content: shown('inside'), mark: readMark(), expanded: expanded(),
      haspopup: document.getElementById('trigger').getAttribute('aria-haspopup')};

    // A press inside is not a dismissal.
    document.getElementById('inside').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
    await settle(200);
    const afterInside = pop.hasAttribute('open');

    // A press outside is.
    document.getElementById('outside').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
    await settle(200);
    const afterOutside = {open: pop.hasAttribute('open'), mark: readMark()};

    // Escape closes it, and the focus goes back where it came from.
    document.getElementById('trigger').focus();
    document.getElementById('trigger').click();
    await settle(200);
    document.getElementById('inside')?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await settle(250);
    const afterEscape = {open: pop.hasAttribute('open'), focus: document.activeElement?.id ?? null, mark: readMark()};

    // A window behind it must be told to stand back while it is open, because
    // both listen on the document in capture and the first one registered wins.
    document.getElementById('trigger').click();
    await settle(200);
    const whileOpen = readMark();
    pop.close();
    await settle(200);

    const legacy = document.getElementById('legacy');
    const legacyRoles = {host: legacy.getAttribute('role'), surface: document.getElementById('legacy-surface').getAttribute('role'),
      haspopup: document.getElementById('legacy-trigger').getAttribute('aria-haspopup')};
    return {closed, opened, afterInside, afterOutside, afterEscape, whileOpen, markWhenClosed: readMark(), legacyRoles};
  });

  if (measured.closed.content || measured.closed.open || measured.closed.mark) {
    note({case: 'a closed popover shows nothing and says nothing', got: measured.closed,
      expected: 'nothing shown, no open attribute, no mark on the root'});
  }
  if (!measured.opened.open || !measured.opened.content || !measured.opened.mark) {
    note({case: 'the trigger opens it, and the root says one is open', got: measured.opened,
      expected: 'the surface drawn, the attribute set, the mark present'});
  }
  if (measured.closed.expanded !== 'false' || measured.opened.expanded !== 'true' || measured.opened.haspopup !== 'dialog') {
    note({case: 'the trigger says that it opens a surface and whether it is open',
      got: {closed: measured.closed.expanded, opened: measured.opened.expanded, haspopup: measured.opened.haspopup},
      expected: 'aria-expanded false then true, aria-haspopup dialog'});
  }
  if (measured.legacyRoles.host !== null || measured.legacyRoles.surface !== 'menu' || measured.legacyRoles.haspopup !== 'menu') {
    note({case: 'a role written on the host goes to the surface, and the host keeps none',
      got: measured.legacyRoles, expected: 'host no role, surface menu, trigger aria-haspopup menu'});
  }
  if (!measured.afterInside) {
    note({case: 'a press inside the surface is not a dismissal', got: measured.afterInside, expected: true});
  }
  if (measured.afterOutside.open || measured.afterOutside.mark) {
    note({case: 'a press outside closes it and clears the mark', got: measured.afterOutside,
      expected: 'closed, and no mark left behind'});
  }
  if (measured.afterEscape.open || measured.afterEscape.focus !== 'trigger') {
    note({case: 'Escape closes it and the trigger gets the focus back',
      got: measured.afterEscape,
      expected: "closed with the focus on the trigger -- a surface that closes leaving the focus at the document start makes a keyboard lose its place"});
  }
  if (!measured.whileOpen || measured.markWhenClosed) {
    note({case: 'the mark is there exactly while a surface is open',
      got: {whileOpen: measured.whileOpen, whenClosed: measured.markWhenClosed},
      expected: 'present while open, gone when closed'});
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
console.log('POPOVER_OK');
