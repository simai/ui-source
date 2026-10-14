#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-profile-picker (owner, 2026-10-14), measured on the built bytes: folded
// it names the profile in use; open, it lists the profiles with the current
// one checked, a lock on one the person may not change and no rename or
// remove on the standard one; choosing, making, renaming and removing are
// events the host answers; a personal profile cannot be made twice; the
// keyboard walks the rows and F2 renames.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'smart/smart/profile-picker/css/profile-picker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js', 'smart/smart/profile-picker/js/profile-picker.js'];
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

  const folded = await page.evaluate(() => document.querySelector('#p .sf-profile-picker-trigger')?.textContent.replace(/\s+/gu, ' ').trim());
  if (!folded?.includes('Профиль: Обычный')) note({case: 'folded', got: folded});

  await page.click('#p .sf-profile-picker-trigger');
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
    };
  });
  const expected = 'regular:true:false:false,editors:false:false:true,mine:false:true:false';
  const seen = open.rows.map((row) => `${row.id}:${row.checked}:${row.actions}:${row.lock}`).join(',');
  if (!open.top || seen !== expected || !open.add || !open.reset || open.width < 260 || open.height < 32) {
    note({case: 'open', got: open, expected});
  }

  // Making a profile: the personal kind is taken, so it is shared.
  await page.click('#p .sf-profile-picker-add');
  await page.waitForTimeout(150);
  const form = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('#p .sf-profile-picker-segmented button')];
    return {personalDisabled: buttons[0]?.disabled, sharedPressed: buttons[1]?.getAttribute('aria-pressed'), focused: document.activeElement?.classList.contains('sf-profile-picker-field')};
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

  const said = acts.map(([name, detail]) => `${name}:${detail.id ?? ''}:${detail.label ?? ''}:${detail.shared ?? ''}`).join(',');
  const wanted = 'create::Продажи:true,rename:mine:Моё:,delete:mine::,select:regular::';
  if (!form.personalDisabled || form.sharedPressed !== 'true' || !form.focused) note({case: 'the form', got: form});
  if (afterCreate.form || afterCreate.checked !== 'sales') note({case: 'the host answered', got: afterCreate});
  if (!confirm) note({case: 'delete asks first'});
  if (said !== wanted) note({case: 'acts', got: said, expected: wanted});
  if (!closed) note({case: 'choosing closes the panel'});
  console.log(JSON.stringify({folded, open, form, afterCreate, confirm, said, closed}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PROFILE_PICKER_OK');
