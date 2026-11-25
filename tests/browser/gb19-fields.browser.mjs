#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Group build 19, area B (fields and forms). At 1440 and 390, light and dark,
// `loads` fresh loads each (3 by default), on the distribution as a site
// serves it:
//
// 1. Include field (View round 19 return, include-w1): an sf-form in view mode
//    shows a code value («Код виджета») on a page that loads sf-highlight. The
//    value changes three times, as the next record of a record card does, then
//    is the same again, then empty, then back: no page error («Cannot set
//    properties of null (setting 'data')» came from lit's commit when the
//    highlighter had taken the code's text node), and the code shows each
//    value. «Переносить строки» of the highlighted block is pressed for real:
//    on, then off again.
// 2. Window content-actions rows weigh nothing (sf-drawer 1.22.1): in an open
//    panel a composite whose one child holds its own foot bar keeps the bar
//    where its own class rule (in the components layer, as a Smart sheet
//    writes it) puts it -- static, the panel not scrolled on opening -- while
//    a page's wrapper without such a rule still has its last row of buttons
//    held at the panel's foot while the wheel scrolls the body.
// 3. sf-form labels="start" (1.16.0): the label column is one axis; with
//    --sf-form-label-width: 10rem the controls start 10rem + the label gap
//    after the fields' start; a host's own class rule in the components layer
//    lays the fields out in two columns (it lost to the attribute's weight);
//    «*» stands right after its label's text (C153 (2), SB-10).
// 4. Money at rest (SB-11): 9800 RUB in the edit field reads «9 800,00».
// A clean console in every load.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const CODES = [
  "window.widget = {id: 1};\nconsole.log('one');",
  "const two = 2;\n// the second record\nexport default two;",
  "<script src=\"/third.js\"></script>",
];

const LAYER = `<style>@layer sf.components {
  .probe-card { display: flex; flex-direction: column; }
  .probe-card-bar { position: static; margin-block-end: 0; padding-block: var(--sf-space-1); }
  .probe-two .sf-form-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .probe-two .sf-form-field { grid-column: auto; }
}</style>`;

const tall = (n) => Array.from({length: n}, (_, i) => `<p style="margin:0 0 16px">Строка содержимого ${i + 1}</p>`).join('');

const page = (theme) => russianPage({theme, head: LAYER, body: `
<main style="inline-size:min(100%,60rem)">
  <pre hidden><code>loads the highlighter as a docs page does</code></pre>
  <sf-form id="view" mode="view" label="Запись"></sf-form>
  <sf-form id="start" labels="start" label="Правка"></sf-form>
  <sf-form id="width" labels="start" label="Ширина" style="--sf-form-label-width: 10rem"></sf-form>
  <div class="probe-two"><sf-form id="two" labels="start" label="Две колонки"></sf-form></div>
  <sf-form id="money" label="Сумма"></sf-form>
</main>
<sf-drawer id="own" heading="Карточка" modal="false">
  <div class="probe-card">${tall(60)}<div class="probe-card-bar"><sf-button text="Сохранить"></sf-button><sf-button text="Отменить" appearance="ghost"></sf-button></div></div>
</sf-drawer>
<sf-drawer id="page" heading="Страница" modal="false">
  <div>${tall(60)}<div class="probe-page-bar"><sf-button text="Применить"></sf-button><sf-button text="Отмена" appearance="ghost"></sf-button></div></div>
</sf-drawer>`});

const START_FIELDS = [
  {key: 'title', label: 'Название', propertyType: 'string', required: true},
  {key: 'client', label: 'Клиент', propertyType: 'string'},
  {key: 'manager', label: 'Ответственный менеджер', propertyType: 'string'},
  {key: 'note', label: 'Заметка', propertyType: 'string'},
];

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(page(theme)));
    await tab.waitForFunction(() => customElements.get('sf-form') && customElements.get('sf-drawer'), null, {timeout: 20_000});
    await tab.evaluate(({codes, start}) => {
      const view = document.getElementById('view');
      view.fields = [{key: 'widget', label: 'Код виджета', propertyType: 'include', templateParams: {language: 'javascript'}}];
      view.value = {widget: codes[0]};
      for (const id of ['start', 'width', 'two']) {
        const form = document.getElementById(id);
        form.fields = start;
        form.value = {title: 'Заказ', client: 'ООО Ромашка', manager: 'Анна', note: ''};
      }
      const money = document.getElementById('money');
      money.fields = [{key: 'sum', label: 'Сумма', propertyType: 'money', currency: 'RUB'}];
      money.value = {sum: {amount: '9800', currency: 'RUB'}};
    }, {codes: CODES, start: START_FIELDS});
    await tab.waitForFunction(() => document.querySelector('#view pre.sf-field-include code')
      && document.querySelector('#two .sf-form-field[data-key="note"]')
      && document.querySelector('#money .sf-form-field input'), null, {timeout: 20_000});
    await tab.waitForTimeout(400);

    // 1. Include: the value changes as the next record's does.
    const code = () => tab.evaluate(() => {
      const block = document.querySelector('#view .sf-field-include code');
      return {text: block?.textContent ?? null, highlighted: Boolean(block?.closest('.sf-highlight'))};
    });
    const sequence = [CODES[0], CODES[1], CODES[2], CODES[2], '', CODES[0]];
    const seen = [];
    for (const value of sequence) {
      await tab.evaluate((next) => { document.getElementById('view').value = {widget: next}; }, value);
      await tab.waitForTimeout(350);
      seen.push(await code());
    }
    const shownRight = sequence.every((value, index) => (value ? seen[index].text?.trim() === value.trim() : seen[index].text === null));
    const pageErrors = errors.filter((line) => /Cannot set properties of null|TypeError/u.test(line));
    ok(`${key}: include -- every next value is shown, the empty one draws nothing, no page error`, shownRight && pageErrors.length === 0, {seen, pageErrors});
    ok(`${key}: include -- the block is highlighted after each value`, seen.filter((one) => one.text !== null).every((one) => one.highlighted), seen);

    const wrapButton = '#view .sf-highlight [aria-pressed]';
    const wrapState = () => tab.evaluate(() => {
      const root = document.querySelector('#view .sf-highlight');
      return {wrap: root?.classList.contains('sf-highlight--wrap') ?? null, pressed: root?.querySelector('[aria-pressed]')?.getAttribute('aria-pressed') ?? null};
    });
    let wrapOn = null;
    let wrapOff = null;
    if (await tab.$(wrapButton)) {
      await tab.locator(wrapButton).first().click();
      await tab.waitForTimeout(150);
      wrapOn = await wrapState();
      await tab.locator(wrapButton).first().click();
      await tab.waitForTimeout(150);
      wrapOff = await wrapState();
    }
    ok(`${key}: include -- «Переносить строки» pressed turns wrapping on, pressed again off`,
      wrapOn?.wrap === true && wrapOn.pressed === 'true' && wrapOff?.wrap === false && wrapOff.pressed === 'false', {wrapOn, wrapOff});

    // 3. sf-form start labels.
    const form = await tab.evaluate(() => {
      const read = (id) => {
        const root = document.querySelector(`#${id} .sf-form`) ?? document.querySelector(`#${id} form`);
        const fields = [...document.querySelectorAll(`#${id} .sf-form-field`)];
        const fieldsBox = document.querySelector(`#${id} .sf-form-fields`)?.getBoundingClientRect();
        const controls = fields.map((field) => field.querySelector('.sf-form-control')?.getBoundingClientRect());
        return {
          labels: root?.getAttribute('data-labels') ?? null,
          fieldsLeft: fieldsBox ? Math.round(fieldsBox.left) : null,
          fieldsWidth: fieldsBox ? Math.round(fieldsBox.width) : null,
          gap: fieldsBox ? parseFloat(getComputedStyle(document.querySelector(`#${id} .sf-form-fields`)).columnGap) || 0 : null,
          controlLeft: controls.map((box) => (box ? Math.round(box.left) : null)),
          tops: fields.map((field) => Math.round(field.getBoundingClientRect().top)),
          labelLeft: fields.map((field) => Math.round(field.querySelector('.sf-form-label')?.getBoundingClientRect().left ?? -1)),
        };
      };
      const star = document.querySelector('#start .sf-form-field[data-key="title"] .sf-form-required');
      const text = star?.parentElement;
      let textEnd = null;
      if (text) {
        const range = document.createRange();
        const node = [...text.childNodes].find((one) => one.nodeType === Node.TEXT_NODE && one.textContent.trim());
        if (node) {
          range.selectNodeContents(node);
          textEnd = range.getBoundingClientRect().right;
        }
      }
      return {start: read('start'), width: read('width'), two: read('two'), star: star && textEnd !== null ? Math.round((star.getBoundingClientRect().left - textEnd) * 10) / 10 : null,
        starGap: star ? parseFloat(getComputedStyle(star).marginInlineStart) : null};
    });
    const besides = form.start.controlLeft.every((x) => x !== null && x > form.start.labelLeft[0] + 8);
    if (besides) {
      const oneAxis = new Set(form.start.controlLeft).size === 1;
      ok(`${key}: start labels -- one axis for every control, the column at most 40 % of the row`,
        oneAxis && form.start.controlLeft[0] - form.start.fieldsLeft <= form.start.fieldsWidth * 0.4 + form.start.gap + 1, form.start);
      const want = form.width.fieldsLeft + 160 + form.width.gap;
      ok(`${key}: --sf-form-label-width 10rem -- every control starts 10rem + the gap after the fields' start`,
        form.width.controlLeft.every((x) => Math.abs(x - want) <= 1), {want, ...form.width});
    } else {
      // Below md or a narrow form the label stands over its field: the column
      // and the variable do not apply.
      ok(`${key}: start labels -- over the field on a narrow page`, form.start.controlLeft.every((x, i) => x !== null && Math.abs(x - form.start.labelLeft[i]) <= 1), form.start);
    }
    const twoColumns = form.two.tops[0] === form.two.tops[1] && form.two.tops[2] === form.two.tops[3] && form.two.tops[0] < form.two.tops[2];
    ok(`${key}: a host's class rule lays start-labelled fields out in two columns`, twoColumns, form.two);
    ok(`${key}: «*» right after its label's text (the star's own 4 and no more)`, form.star !== null && form.star <= form.starGap + 1, {star: form.star, starGap: form.starGap});

    // 4. Money at rest.
    const money = await tab.evaluate(() => document.querySelector('#money .sf-form-field input')?.value ?? null);
    ok(`${key}: money at rest reads its groups and minor units (9 800,00)`, typeof money === 'string' && money.replace(/[\s  ]/gu, ' ') === '9 800,00', money);

    // 2. Drawers: open each, read the bar, scroll by the wheel.
    const drawer = async (id, barSelector) => {
      await tab.evaluate((one) => { document.getElementById(one).open = true; }, id);
      await tab.waitForFunction((one) => document.querySelector(`#${one} .sf-drawer-panel`)?.getBoundingClientRect().width > 0, id, {timeout: 10_000});
      await tab.waitForTimeout(450);
      const read = () => tab.evaluate(([one, bar]) => {
        const panel = document.querySelector(`#${one} .sf-drawer-panel`);
        const body = document.querySelector(`#${one} .sf-drawer-body`);
        const row = document.querySelector(`#${one} ${bar}`);
        const scroller = [panel, body].find((node) => node && node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/u.test(getComputedStyle(node).overflowY));
        const box = row.getBoundingClientRect();
        return {position: getComputedStyle(row).position, marginEnd: getComputedStyle(row).marginBlockEnd,
          scrollTop: scroller ? Math.round(scroller.scrollTop) : null, bottom: Math.round(box.bottom),
          panelBottom: Math.round(panel.getBoundingClientRect().bottom), viewport: innerHeight};
      }, [id, barSelector]);
      const opened = await read();
      const panelBox = await tab.evaluate((one) => {
        const r = document.querySelector(`#${one} .sf-drawer-panel`).getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      }, id);
      await tab.mouse.move(panelBox.x, panelBox.y);
      await tab.mouse.wheel(0, 600);
      await tab.waitForTimeout(400);
      const scrolled = await read();
      await tab.evaluate((one) => { document.getElementById(one).open = false; }, id);
      await tab.waitForTimeout(400);
      return {opened, scrolled};
    };
    const own = await drawer('own', '.probe-card-bar');
    ok(`${key}: a composite's own foot bar keeps its own place (static, no pull) and the panel opens unscrolled`,
      own.opened.position === 'static' && own.opened.marginEnd === '0px' && (own.opened.scrollTop ?? 0) === 0, own);
    const plain = await drawer('page', '.probe-page-bar');
    ok(`${key}: a page's last row of buttons is still held at the panel's foot while the wheel scrolls`,
      plain.opened.position === 'sticky' && (plain.scrolled.scrollTop ?? 0) > 0 && Math.abs(plain.scrolled.bottom - Math.min(plain.scrolled.panelBottom, plain.scrolled.viewport)) <= 24, plain);

    ok(`${key}: a clean console`, errors.length === 0, errors);
    await context.close();
  }
}

await browser.close();
await server.close();
report();
