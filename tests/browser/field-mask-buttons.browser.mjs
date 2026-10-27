#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The set's half of simai.property-view-port 1.16.0 (consumer simai.main,
// agreed contract q-b0de123841), on the built bytes, at sizes 1 and 1/2, at
// 600px and 360px, with a harness host that redraws with what it is given -- as
// a panel does, so a value written back over the person's typing would show:
// - a masked string is sf-input with its mask; the stored text shows and an
//   untouched field writes nothing;
// - typing writes the text as shown, fixed parts included; an incomplete text is
//   told to the host on every keystroke and marked invalid with the stock
//   message («Заполните поле полностью») once the field is left, and the typing
//   is never written over; completing it takes the mark off;
// - clearing writes null, or "" for nullable false; two masked fields keep their
//   own state; a host that hears no errors gets undefined for an incomplete text;
// - a read-only masked field is shown, not typed in; a plain string is unchanged;
// - a choice as buttons is one segmented sf-button-group, a button per option, as
//   tall as an sf-button of its size (field.size, else the set's); choosing writes
//   the option's own value, pressing the chosen one again writes null unless the
//   field is required; the arrows choose; read-only shows the chosen one and
//   lets none be pressed; disabled is the group's disabled; a long list wraps
//   without scrolling; the dropdown choice is unchanged.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/button-group/css/button-group.css',
  'component/component/dropdown/css/dropdown.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-group/js/button-group.js', 'smart/smart/input/js/input.js', 'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/field-renderers/js/field-renderers.js'];

const failures = [];
let checks = 0;
const check = (name, pass, detail = {}) => { checks += 1; if (!pass) failures.push({check: name, got: detail}); };
const browser = await chromium.launch();
const origin = 'http://probe.test';

async function open(width) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">
    ${['phone', 'inn', 'quiet', 'shown', 'plain', 'kind', 'tier', 'locked', 'off', 'many', 'dropdown', 'refButton', 'refInput']
      .map((id) => `<div id="${id}" style="max-inline-size:420px;margin-block-end:16px"></div>`).join('')}
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => window.SF?.fieldRenderers?.renderEditField && window.SF?.render
    && customElements.get('sf-input') && customElements.get('sf-button-group') && customElements.get('sf-dropdown'), null, {timeout: 10000});
  return page;
}

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

try {
  for (const width of [600, 360]) {
    for (const size of ['1', '1/2']) {
      const at = (what) => `${width}px size ${size}: ${what}`;
      const page = await open(width);
      await page.evaluate((size) => {
        const set = window.SF.fieldRenderers;
        window.writes = [];
        window.errors = [];
        const stored = {phone: '+7 (912) 345-67-89', inn: '', quiet: '', shown: '+7 (912) 345-67-89', plain: 'Текст',
          kind: 'person', tier: 1, locked: 'company', off: 'person', many: null, dropdown: 'b'};
        window.values = {...stored};
        const fields = {
          phone: {key: 'phone', label: 'Телефон', propertyType: 'string', mask: '+7 (000) 000-00-00'},
          inn: {key: 'inn', label: 'ИНН', propertyType: 'string', mask: '0000000000', nullable: false},
          quiet: {key: 'quiet', label: 'Без ошибок', propertyType: 'string', mask: '00-00'},
          shown: {key: 'shown', label: 'Телефон', propertyType: 'string', mask: '+7 (000) 000-00-00', readonly: true},
          plain: {key: 'plain', label: 'Строка', propertyType: 'string'},
          kind: {key: 'kind', label: 'Вид', propertyType: 'choice', variant: 'buttons',
            options: [{value: 'person', label: 'Физлицо'}, {value: 'company', label: 'Юрлицо'}, {value: 'other', label: 'Другое', disabled: true}]},
          tier: {key: 'tier', label: 'Тариф', propertyType: 'choice', variant: 'buttons', required: true, size: '2',
            options: [{value: 1, label: 'Базовый'}, {value: 2, label: 'Расширенный'}]},
          locked: {key: 'locked', label: 'Вид', propertyType: 'choice', variant: 'buttons', readonly: true,
            options: [{value: 'person', label: 'Физлицо'}, {value: 'company', label: 'Юрлицо'}]},
          off: {key: 'off', label: 'Вид', propertyType: 'choice', variant: 'buttons',
            options: [{value: 'person', label: 'Физлицо'}, {value: 'company', label: 'Юрлицо'}]},
          many: {key: 'many', label: 'Много', propertyType: 'choice', variant: 'buttons', size: '1/2',
            options: Array.from({length: 9}, (_, index) => ({value: `v${index}`, label: `Вариант номер ${index + 1}`}))},
          dropdown: {key: 'dropdown', label: 'Список', propertyType: 'choice',
            options: [{value: 'a', label: 'А'}, {value: 'b', label: 'Б'}]},
        };
        const withErrors = (key) => key !== 'quiet';
        const draw = (key) => {
          const field = fields[key];
          const host = {
            getFieldValue: (target) => window.values[target.key],
            // The panel's way: undefined takes the change back to what is stored,
            // and every write is drawn again with the value it carried.
            setFieldValue: (target, value) => {
              window.writes.push([target.key, value]);
              window.values[target.key] = value === undefined ? stored[target.key] : value;
              draw(target.key);
            },
            ...(withErrors(key) ? {setFieldError: (target, message) => { window.errors.push([target.key, message]); }} : {}),
          };
          window.SF.render(set.renderEditField(field, window.values[key], host, {size, ...(key === 'off' ? {disabled: true} : {})}),
            document.getElementById(key));
        };
        Object.keys(fields).forEach(draw);
        window.SF.render(window.SF.html`<sf-button size=${size} text="ref"></sf-button>`, document.getElementById('refButton'));
        window.SF.render(window.SF.html`<sf-button size="2" text="ref"></sf-button>`, document.getElementById('refInput'));
      }, size);
      await page.waitForFunction(() => document.querySelector('#phone sf-input input') && document.querySelector('#kind .sf-button-group button')
        && document.querySelector('#refButton .sf-button') && document.querySelector('#dropdown sf-dropdown'), null, {timeout: 8000});
      await page.waitForTimeout(400);

      // --- the masked string -------------------------------------------------
      const first = await page.evaluate(() => {
        const input = document.querySelector('#phone sf-input');
        return {pattern: input.getAttribute('mask-pattern'), mask: input.hasAttribute('mask'), size: input.getAttribute('size'),
          text: input.querySelector('input').value, writes: window.writes.length, name: input.querySelector('input').getAttribute('aria-label'),
          shown: document.querySelector('#shown').textContent.trim(), shownInput: Boolean(document.querySelector('#shown input')),
          plainMask: document.querySelector('#plain sf-input').hasAttribute('mask-pattern')};
      });
      check(at('a masked string is sf-input with its mask, at the set\'s size'), first.mask && first.pattern === '+7 (000) 000-00-00' && first.size === size, first);
      check(at('the stored text shows; untouched writes nothing'), first.text === '+7 (912) 345-67-89' && first.writes === 0, first);
      check(at('the control is named by the label'), first.name === 'Телефон', first);
      check(at('a read-only masked field is shown, not typed in'), first.shown === '+7 (912) 345-67-89' && !first.shownInput, first);
      check(at('a plain string carries no mask'), !first.plainMask, first);

      const PHONE = '#phone sf-input input';
      const state = (key) => page.evaluate((key) => {
        const host = document.querySelector(`#${key} sf-input`);
        const message = host.querySelector('[data-field-message]');
        return {text: host.querySelector('input').value, invalid: host.hasAttribute('invalid'),
          ariaInvalid: host.querySelector('input').getAttribute('aria-invalid'),
          message: message?.getAttribute('data-field-message') === 'error' ? message.textContent.trim() : '',
          writes: window.writes.splice(0), errors: window.errors.splice(0)};
      }, key);
      const lastOf = (got, key) => got.writes.filter(([one]) => one === key).at(-1)?.[1];
      const lastError = (got, key) => got.errors.filter(([one]) => one === key).at(-1)?.[1];

      await page.click(PHONE);
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('912345', {delay: 15});
      await settle(page);
      const typing = await state('phone');
      check(at('typing writes the text as shown and is never written over'), typing.text === '+7 (912) 345' && lastOf(typing, 'phone') === '+7 (912) 345', typing);
      check(at('an incomplete text is told to the host while it is typed'), lastError(typing, 'phone') === 'Заполните поле полностью', typing);
      check(at('the mark waits until the field is left'), !typing.invalid && typing.message === '', typing);
      await page.keyboard.press('Tab');
      await settle(page);
      const left = await state('phone');
      check(at('left incomplete: marked invalid with the stock message'), left.invalid && left.ariaInvalid === 'true'
        && left.message === 'Заполните поле полностью' && left.text === '+7 (912) 345', left);

      // A second masked field, on its own.
      await page.click('#inn sf-input input');
      await page.keyboard.type('77012', {delay: 15});
      await page.keyboard.press('Tab');
      await page.click(PHONE);
      await page.keyboard.press('End');
      await page.keyboard.type('6789', {delay: 15});
      await settle(page);
      const done = await state('phone');
      check(at('completing the text writes it with its fixed parts and takes the mark off'), lastOf(done, 'phone') === '+7 (912) 345-67-89'
        && lastError(done, 'phone') === null && !done.invalid && done.message === '', done);
      check(at('several masked fields keep their own state'), lastError(done, 'inn') === 'Заполните поле полностью'
        && await page.evaluate(() => document.querySelector('#inn sf-input').hasAttribute('invalid')), done);

      await page.click(PHONE);
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Tab');
      await settle(page);
      const cleared = await state('phone');
      check(at('clearing writes null and is no error'), lastOf(cleared, 'phone') === null && lastError(cleared, 'phone') === null && !cleared.invalid, cleared);

      await page.click('#inn sf-input input');
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Tab');
      await settle(page);
      const innCleared = await state('inn');
      check(at('clearing a nullable-false field writes ""'), lastOf(innCleared, 'inn') === '' && !innCleared.invalid, innCleared);

      await page.click('#quiet sf-input input');
      await page.keyboard.type('12', {delay: 15});
      await page.keyboard.press('Tab');
      await settle(page);
      const quiet = await state('quiet');
      check(at('a host that hears no errors gets undefined for an incomplete text'), quiet.writes.length > 0
        && quiet.writes.every(([key, value]) => key === 'quiet' && value === undefined) && quiet.invalid, quiet);

      await page.click('#plain sf-input input');
      await page.keyboard.press('End');
      await page.keyboard.type('1', {delay: 15});
      await settle(page);
      const plain = await state('plain');
      check(at('a plain string writes what is typed, as before'), lastOf(plain, 'plain') === 'Текст1' && plain.errors.length === 0, plain);

      // --- the choice as buttons ---------------------------------------------
      const group = (key) => page.evaluate((key) => {
        const host = document.querySelector(`#${key} sf-button-group`);
        const track = host?.querySelector('.sf-button-group');
        const buttons = [...(track?.querySelectorAll(':scope > button') ?? [])];
        const rect = track?.getBoundingClientRect();
        return {tag: Boolean(host), appearance: host?.getAttribute('appearance'), size: host?.getAttribute('size'),
          height: rect?.height, width: rect?.width, scrolls: track ? track.scrollWidth > track.clientWidth + 1 : null,
          labels: buttons.map((button) => button.textContent.trim()), checked: buttons.map((button) => button.getAttribute('aria-checked')),
          disabled: buttons.map((button) => button.disabled), rows: new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
          role: track?.getAttribute('role'), named: track?.getAttribute('aria-label'), readonly: host?.getAttribute('data-readonly'),
          writes: window.writes.splice(0).filter(([one]) => one === key)};
      }, key);
      const ref = (id) => page.evaluate((id) => document.querySelector(`#${id} .sf-button`).getBoundingClientRect().height, id);

      const kind = await group('kind');
      check(at('a choice as buttons is one segmented group, a button per option'), kind.tag && kind.appearance === 'segmented'
        && JSON.stringify(kind.labels) === JSON.stringify(['Физлицо', 'Юрлицо', 'Другое']) && kind.role === 'radiogroup' && kind.named === 'Вид', kind);
      check(at('the stored option is chosen; a disabled option is disabled'), JSON.stringify(kind.checked) === JSON.stringify(['true', 'false', 'false'])
        && JSON.stringify(kind.disabled) === JSON.stringify([false, false, true]), kind);
      check(at('the group is as tall as an sf-button of the set\'s size'), kind.size === size && Math.abs(kind.height - await ref('refButton')) < 0.5, kind);
      const tier = await group('tier');
      check(at('field.size sizes the group on the ladder'), tier.size === '2' && Math.abs(tier.height - await ref('refInput')) < 0.5, tier);

      await page.click('#kind button:nth-child(2)');
      await settle(page);
      const chose = await group('kind');
      check(at('choosing writes the option\'s value'), JSON.stringify(chose.writes) === JSON.stringify([['kind', 'company']])
        && chose.checked[1] === 'true', chose);
      await page.click('#kind button:nth-child(2)');
      await settle(page);
      const again = await group('kind');
      check(at('pressing the chosen one again clears it'), JSON.stringify(again.writes) === JSON.stringify([['kind', null]])
        && again.checked.every((one) => one === 'false'), again);
      await page.click('#kind button:nth-child(1)');
      await page.keyboard.press('ArrowRight');
      await settle(page);
      const arrows = await group('kind');
      check(at('the arrows choose'), JSON.stringify(arrows.writes) === JSON.stringify([['kind', 'person'], ['kind', 'company']]), arrows);

      await page.click('#tier button:nth-child(2)');
      await settle(page);
      const tierChose = await group('tier');
      check(at('a numeric option writes its own number'), JSON.stringify(tierChose.writes) === JSON.stringify([['tier', 2]]), tierChose);
      await page.click('#tier button:nth-child(2)');
      await settle(page);
      const tierStays = await group('tier');
      check(at('a required choice stays chosen'), tierStays.writes.length === 0 && tierStays.checked[1] === 'true', tierStays);

      const locked = await group('locked');
      await page.locator('#locked button').nth(0).click({force: true});
      await page.locator('#locked button').nth(1).focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Space');
      await settle(page);
      const lockedAfter = await group('locked');
      check(at('read-only shows the chosen button chosen, in its own colours'), locked.readonly === 'true'
        && JSON.stringify(locked.checked) === JSON.stringify(['false', 'true']) && locked.disabled.every((one) => one === false), locked);
      check(at('read-only lets none be pressed, by pointer or key'), lockedAfter.writes.length === 0
        && JSON.stringify(lockedAfter.checked) === JSON.stringify(['false', 'true']), lockedAfter);

      const off = await group('off');
      await page.locator('#off button').nth(1).click({force: true});
      await settle(page);
      const offAfter = await group('off');
      check(at('disabled is the group\'s disabled'), off.disabled.every((one) => one === true) && off.checked[0] === 'true'
        && offAfter.writes.length === 0, {off, offAfter});

      const many = await group('many');
      check(at('a long list wraps, never scrolls, never a dropdown'), many.labels.length === 9 && !many.scrolls
        && (width === 360 ? many.rows > 1 : true) && !(await page.evaluate(() => Boolean(document.querySelector('#many sf-dropdown')))), many);
      check(at('no horizontal page scroll'), await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

      const dropdown = await page.evaluate(() => ({dropdown: Boolean(document.querySelector('#dropdown sf-dropdown')),
        group: Boolean(document.querySelector('#dropdown sf-button-group'))}));
      check(at('a choice without the variant is the dropdown it was'), dropdown.dropdown && !dropdown.group, dropdown);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log(JSON.stringify({checks}));
console.log('FIELD_MASK_BUTTONS_OK');
