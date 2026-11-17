#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Framework order FO-3 (the view set study, ui-control control/research/
// 2026-11-17-view-round-1/framework-orders.md): a field's `when` -- visible,
// required, enabled -- read by sf-form 1.4.0 from the other fields' values on
// screen. At 1440 and 390, light and dark, `loads` fresh loads each (3 by
// default): «Адрес» is shown only for delivery by courier, «Комментарий» is
// required only for it, «Этаж» is enabled only once «Адрес» holds a value. A
// person picks «Курьером»: «Адрес» appears, «Комментарий» gets its «*»,
// «Этаж» stays read-only; they type an address: «Этаж» becomes a field to type
// in; «Самовывоз» again: «Адрес» goes and «Комментарий» is not required. A
// save with «Курьером» and no comment is refused with the comment's error; a
// hidden field's error goes with it. A clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const FIELDS = [
  {key: 'delivery', label: 'Доставка', propertyType: 'choice', options: [{value: 'pickup', label: 'Самовывоз'}, {value: 'courier', label: 'Курьером'}]},
  {key: 'address', label: 'Адрес', propertyType: 'string', when: {visible: {field: 'delivery', op: 'eq', value: 'courier'}}},
  {key: 'comment', label: 'Комментарий', propertyType: 'string', when: {required: {field: 'delivery', op: 'eq', value: 'courier'}}},
  {key: 'floor', label: 'Этаж', propertyType: 'string', when: {enabled: {all: [{field: 'delivery', op: 'eq', value: 'courier'}, {field: 'address', op: 'not_empty'}]}}},
];

const state = (tab) => tab.evaluate(() => {
  const field = (key) => document.querySelector(`#form .sf-form-field[data-key="${key}"]`);
  const shown = (key) => Boolean(field(key)) && field(key).getClientRects().length > 0;
  const control = (key) => field(key)?.querySelector('input:not([type="radio"]):not([type="checkbox"]), textarea');
  return {
    address: shown('address'),
    commentRequired: Boolean(field('comment')?.querySelector('.sf-form-required')),
    floorEditable: Boolean(control('floor')) && !control('floor').readOnly && !control('floor').disabled,
    floorShown: shown('floor'),
  };
});

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: '<main style="inline-size:min(100%,40rem)"><div id="box"></div></main>'})));
    await tab.waitForFunction(() => customElements.get('sf-form'), null, {timeout: 20_000});
    await tab.evaluate((fields) => {
      const form = document.createElement('sf-form');
      form.id = 'form';
      form.setAttribute('label', 'Заказ');
      form.fields = fields;
      form.value = {delivery: 'pickup'};
      window.saved = [];
      form.addEventListener('sf-form-submit', (event) => window.saved.push(event.detail));
      document.getElementById('box').append(form);
    }, FIELDS);
    await tab.waitForFunction(() => document.querySelector('#form .sf-form-field[data-key="delivery"] input[value="courier"]')
      && document.querySelector('#form .sf-form-field[data-key="floor"]'), null, {timeout: 20_000});
    await tab.waitForTimeout(300);

    const start = await state(tab);
    ok(`${key}: pickup -- no address, the comment not required, the floor read-only`, !start.address && !start.commentRequired && !start.floorEditable && start.floorShown, start);

    await tab.click('#form .sf-form-field[data-key="delivery"] input[value="courier"]', {force: true});
    await tab.waitForTimeout(250);
    const courier = await state(tab);
    ok(`${key}: courier -- the address appears, the comment becomes required, the floor waits for the address`, courier.address && courier.commentRequired && !courier.floorEditable, courier);

    // A save with the comment empty is refused for the comment.
    await tab.evaluate(() => {
      const save = [...document.querySelectorAll('#form sf-button, #form button')].find((one) => /Сохранить/u.test(one.textContent || one.getAttribute('text') || ''));
      (save?.querySelector('button') ?? save)?.click();
    });
    await tab.waitForTimeout(300);
    const refused = await tab.evaluate(() => ({
      saved: window.saved.length,
      commentError: Boolean(document.querySelector('#form .sf-form-field[data-key="comment"] [aria-invalid="true"], #form .sf-form-field[data-key="comment"] [invalid]'))
        || /Заполните|обязательн/iu.test(document.querySelector('#form .sf-form-field[data-key="comment"]')?.textContent ?? ''),
    }));
    ok(`${key}: a save without the comment is refused with the comment's error`, refused.saved === 0 && refused.commentError, refused);

    await tab.fill('#form .sf-form-field[data-key="address"] input', 'Москва, Тверская, 1');
    await tab.waitForTimeout(250);
    const typed = await state(tab);
    ok(`${key}: an address typed -- the floor becomes a field to type in`, typed.address && typed.floorEditable, typed);

    await tab.click('#form .sf-form-field[data-key="delivery"] input[value="pickup"]', {force: true});
    await tab.waitForTimeout(250);
    const back = await state(tab);
    const commentError = await tab.evaluate(() => Boolean(document.querySelector('#form .sf-form-field[data-key="comment"] [aria-invalid="true"]')));
    ok(`${key}: pickup again -- the address goes, the comment is not required, its error goes, the floor is read-only`, !back.address && !back.commentRequired && !commentError && !back.floorEditable, {back, commentError});
    const sideways = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${key}: no sideways scroll`, sideways <= 0, {sideways});
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
await server.close();
report();
