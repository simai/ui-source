#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-profile-picker (owner, 2026-10-14), measured on the built bytes: folded
// it is sf-button ghost naming the profile in use (C163 (2)); open, it lists
// the profiles with the current one filled (no check, C08 / C106 (3)), a
// caption row 48 high (C49), one «⋯» on a row the person may change (C163
// (3)) whose sf-menu-context holds «Переименовать» and «Удалить…», a lock on
// one the person may not change and no «⋯» on the standard one; choosing,
// making, renaming and removing are events the host answers; a personal
// profile cannot be made twice; the keyboard walks the rows, F2 renames,
// Escape leaves a form back to its row and then closes the panel. At 390
// under touch the panel is sf-drawer placement=bottom (C163 (4)) with the
// picker's label as its title, rows 60 and the form in the same sheet.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'smart/smart/profile-picker/css/profile-picker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', 'smart/smart/menu-context/js/menu-context.js', 'smart/smart/drawer/js/drawer.js', 'smart/smart/profile-picker/js/profile-picker.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 700}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html lang="ru" class="theme-light"><body style="margin:40px"><div style="width:260px"><sf-profile-picker id="p" label="Профиль" resettable></sf-profile-picker></div></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-profile-picker'), null, {timeout: 8000});
  await page.evaluate(() => {
    const picker = document.getElementById('p');
    window.acts = [];
    for (const name of ['select', 'create', 'rename', 'delete', 'reset']) {
      picker.addEventListener(`sf-profile-${name}`, (event) => window.acts.push([name, event.detail]));
    }
    picker.profiles = [
      {id: 'regular', label: 'Обычный', shared: true, builtin: true},
      {id: 'editors', label: 'Редакторы', shared: true, editable: false},
      {id: 'mine', label: 'Мой', shared: false},
    ];
    picker.rights = {create: {personal: false, shared: true}};
    picker.setAttribute('current', 'regular');
  });
  await page.waitForTimeout(200);

  const folded = await page.evaluate(() => {
    const host = document.querySelector('#p .sf-profile-picker-trigger');
    const button = host?.querySelector(':scope > button');
    return {tag: host?.localName, ghost: button?.classList.contains('sf-button--ghost'), haspopup: button?.getAttribute('aria-haspopup'),
      expanded: button?.getAttribute('aria-expanded'), text: button?.textContent.replace(/\s+/gu, ' ').trim()};
  });
  if (folded.tag !== 'sf-button' || !folded.ghost || folded.haspopup !== 'menu' || folded.expanded !== 'false' || !folded.text?.includes('Профиль: Обычный')) note({case: 'folded', got: folded});

  await page.click('#p .sf-profile-picker-trigger > button');
  await page.waitForTimeout(250);
  const open = await page.evaluate(() => {
    const panel = document.querySelector('#p .sf-profile-picker-panel');
    const rows = [...panel.querySelectorAll('.sf-profile-picker-row[data-id]')];
    return {
      top: panel.matches(':popover-open'),
      rows: rows.map((row) => ({id: row.dataset.id, checked: row.getAttribute('aria-checked'),
        actions: Boolean(row.querySelector('.sf-profile-picker-actions')), lock: Boolean(row.querySelector('.sf-profile-picker-lock'))})),
      add: Boolean(panel.querySelector('.sf-profile-picker-add')),
      reset: Boolean(panel.querySelector('.sf-profile-picker-footer')),
      width: Math.round(panel.getBoundingClientRect().width),
      height: Math.round(rows[2]?.getBoundingClientRect().height ?? 0),
      check: Boolean(panel.querySelector('.sf-profile-picker-check')),
      fill: getComputedStyle(rows[0]).backgroundColor,
      triggerHeight: Math.round(document.querySelector('#p .sf-profile-picker-trigger > button').getBoundingClientRect().height),
      expanded: document.querySelector('#p .sf-profile-picker-trigger > button').getAttribute('aria-expanded'),
      actions: rows.map((row) => [...row.querySelectorAll('.sf-profile-picker-actions sf-button-icon')].map((b) => b.getAttribute('icon')).join('+')).join(','),
    };
  });
  const expected = 'regular:true:false:false,editors:false:false:true,mine:false:true:false';
  const seen = open.rows.map((row) => `${row.id}:${row.checked}:${row.actions}:${row.lock}`).join(',');
  if (!open.top || seen !== expected || !open.add || !open.reset || open.width < 260 || open.height !== 48 || open.check
      || open.fill === 'rgba(0, 0, 0, 0)' || open.triggerHeight !== 40 || open.expanded !== 'true' || open.actions !== ',,more_horiz') {
    note({case: 'open', got: open, expected});
  }

  // Making a profile: the personal kind is taken, so it is shared.
  await page.click('#p .sf-profile-picker-add');
  await page.waitForTimeout(150);
  const form = await page.evaluate(() => {
    const kinds = document.querySelector('#p sf-segmented.sf-profile-picker-kinds');
    const items = JSON.parse(kinds?.getAttribute('items') || '[]');
    return {personalDisabled: items[0]?.disabled === true, sharedPressed: kinds?.getAttribute('value') === 'shared' ? 'true' : 'false', focused: document.activeElement?.classList.contains('sf-profile-picker-field')};
  });
  await page.keyboard.type('Продажи');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // The host answers with the list: the form closes.
  await page.evaluate(() => {
    const picker = document.getElementById('p');
    picker.profiles = [...picker.profiles, {id: 'sales', label: 'Продажи', shared: true}];
    picker.setAttribute('current', 'sales');
  });
  await page.waitForTimeout(150);
  const afterCreate = await page.evaluate(() => ({form: Boolean(document.querySelector('#p .sf-profile-picker-form')),
    checked: document.querySelector('#p .sf-profile-picker-row[aria-checked="true"]')?.dataset.id}));

  // The «⋯» of «Мой» opens a menu: «Переименовать», a line, «Удалить…» in danger.
  await page.evaluate(() => document.querySelector('#p .sf-profile-picker-row[data-id="mine"] .sf-profile-picker-more button').click());
  await page.waitForTimeout(500);
  const menu = await page.evaluate(() => {
    const host = document.querySelector('#p .sf-profile-picker-actions-menu');
    const items = [...(host?.querySelectorAll('.sf-context-menu-item') ?? [])].filter((item) => item.getBoundingClientRect().height > 0);
    return {items: items.map((item) => `${item.querySelector('.sf-context-menu-item-label')?.textContent.trim()}${item.classList.contains('sf-context-menu-item--danger') ? '!' : ''}`).join(','),
      separator: host?.querySelectorAll('[role="separator"]').length ?? 0};
  });
  if (menu.items !== 'Переименовать,Удалить…!' || menu.separator !== 1) note({case: 'the row menu', got: menu});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // F2 on «Мой» renames it; Delete asks first.
  await page.focus('#p .sf-profile-picker-row[data-id="mine"]');
  await page.keyboard.press('F2');
  await page.waitForTimeout(150);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Моё');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const picker = document.getElementById('p');
    picker.profiles = picker.profiles.map((entry) => (entry.id === 'mine' ? {...entry, label: 'Моё'} : entry));
  });
  await page.waitForTimeout(150);
  await page.focus('#p .sf-profile-picker-row[data-id="mine"]');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  const confirm = await page.evaluate(() => Boolean(document.querySelector('#p .sf-profile-picker-confirm')));
  await page.evaluate(() => document.querySelector('#p .sf-profile-picker-confirm sf-button button')?.click());
  await page.waitForTimeout(100);
  await page.click('#p .sf-profile-picker-row[data-id="regular"]');
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => !document.querySelector('#p .sf-profile-picker-panel').matches(':popover-open'));
  const acts = await page.evaluate(() => window.acts);

  // Escape leaves the new-profile form back to its row, and the next closes the panel.
  await page.click('#p .sf-profile-picker-trigger > button');
  await page.waitForTimeout(250);
  await page.click('#p .sf-profile-picker-add');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const leftForm = await page.evaluate(() => ({form: Boolean(document.querySelector('#p .sf-profile-picker-form')), focus: document.activeElement?.classList.contains('sf-profile-picker-add')}));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const escaped = await page.evaluate(() => ({open: document.querySelector('#p .sf-profile-picker-panel').matches(':popover-open'),
    focus: document.activeElement === document.querySelector('#p .sf-profile-picker-trigger > button')}));
  if (leftForm.form || !leftForm.focus || escaped.open || !escaped.focus) note({case: 'escape', got: {leftForm, escaped}});

  // A phone: the bottom sheet (sf-drawer placement=bottom) with the label as its title, rows 60, the form inside.
  const phone = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const small = await phone.newPage();
  await small.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await small.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await small.goto(`${origin}/`);
  await small.setContent('<!doctype html><html lang="ru" class="theme-light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:16px"><sf-profile-picker id="p" label="Вид"></sf-profile-picker></body></html>');
  for (const path of styles) await small.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await small.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await small.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await small.waitForFunction(() => customElements.get('sf-profile-picker') && customElements.get('sf-drawer'), null, {timeout: 8000});
  await small.evaluate(() => {
    const picker = document.getElementById('p');
    picker.profiles = [{id: 'regular', label: 'Обычный', shared: true, builtin: true}, {id: 'mine', label: 'Мой', shared: false}];
    picker.rights = {create: {personal: false, shared: true}};
    picker.setAttribute('current', 'regular');
  });
  await small.waitForTimeout(200);
  await small.evaluate(() => document.querySelector('#p .sf-profile-picker-trigger > button').click());
  await small.waitForTimeout(900);
  const sheet = await small.evaluate(() => {
    const panel = document.querySelector('[data-sf-drawer-panel] .sf-profile-picker-panel');
    const drawer = panel?.closest('[data-sf-drawer-panel]');
    const rows = [...(panel?.querySelectorAll('.sf-profile-picker-row[data-id]') ?? [])];
    return {drawer: Boolean(drawer), title: drawer?.querySelector('.sf-drawer-title')?.textContent.trim(), close: Boolean(drawer?.querySelector('[data-sf-drawer-close]')),
      heights: rows.map((row) => Math.round(row.getBoundingClientRect().height)).join(','),
      more: rows[1]?.querySelector('.sf-profile-picker-actions') ? getComputedStyle(rows[1].querySelector('.sf-profile-picker-actions')).opacity : null};
  });
  await small.evaluate(() => document.querySelector('[data-sf-drawer-panel] .sf-profile-picker-add')?.click());
  await small.waitForTimeout(400);
  sheet.form = await small.evaluate(() => Boolean(document.querySelector('[data-sf-drawer-panel] .sf-profile-picker-form')));
  await phone.close();
  if (!sheet.drawer || sheet.title !== 'Вид' || !sheet.close || sheet.heights !== '60,60' || sheet.more !== '1' || !sheet.form) note({case: 'phone sheet', got: sheet});

  const said = acts.map(([name, detail]) => `${name}:${detail.id ?? ''}:${detail.label ?? ''}:${detail.shared ?? ''}`).join(',');
  const wanted = 'create::Продажи:true,rename:mine:Моё:,delete:mine::,select:regular::';
  if (!form.personalDisabled || form.sharedPressed !== 'true' || !form.focused) note({case: 'the form', got: form});
  if (afterCreate.form || afterCreate.checked !== 'sales') note({case: 'the host answered', got: afterCreate});
  if (!confirm) note({case: 'delete asks first'});
  if (said !== wanted) note({case: 'acts', got: said, expected: wanted});
  if (!closed) note({case: 'choosing closes the panel'});
  console.log(JSON.stringify({folded, open, menu, form, afterCreate, confirm, said, closed, leftForm, escaped, sheet}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PROFILE_PICKER_OK');
