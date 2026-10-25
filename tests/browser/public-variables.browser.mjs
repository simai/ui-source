#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Every public variable (src/core/contracts/public-variables.v1.json) changes
// what it says it changes, on the built bytes. Each component is drawn by its
// Smart element at rest; each variable is set on an ancestor, as the contract
// says a page may, to a value nothing else uses, and the property its role
// names has to take that value on the component's root or on one of the parts
// inside it (an input paints its box on the field, a switch on its track). A
// variable the stylesheet reads but a more specific rule beats, or reads only
// inside a state, passes the source contract and fails here (2026-10-18: it
// found the button's border variables doing nothing on a non-outline button).
// Transitions are off: a style read during an ease reads where it started.
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-variables.v1.json', import.meta.url), 'utf8'));

// The element that draws each component at rest, its sheets and its module;
// `open` puts an overlay on the screen. A component the contract adds without
// an entry here fails, so the probe grows with the contract.
const DRAW = {
  // A count anchored on an icon besides the label: the ring is drawn on the
  // anchored badge alone (simai/ui-source#12).
  badge: {css: ['badges'], js: 'badges', html: '<sf-badge text="Новое" size="1"></sf-badge><span class="sf-badge-anchor"><i class="sf-icon" aria-hidden="true">mail</i><span class="sf-badge sf-badge--anchored" aria-hidden="true">3</span></span>'},
  button: {css: ['buttons'], js: 'buttons', html: '<sf-button text="Сохранить" size="1"></sf-button>'},
  input: {css: ['inputs'], js: 'inputs', html: '<sf-input label="Имя" value="Текст" size="1"></sf-input>'},
  alert: {css: ['alerts', 'icon-buttons'], js: 'alert', html: '<sf-alert title="Сообщение" supporting-text="Текст"></sf-alert>'},
  tag: {css: ['tags'], js: 'tags', html: '<sf-tag text="Метка" size="1"></sf-tag>'},
  'icon-button': {css: ['icon-buttons'], js: 'icon-buttons', html: '<sf-icon-button icon="add" aria-label="Добавить" size="1"></sf-icon-button>'},
  checkbox: {css: ['checkbox'], js: 'checkbox', html: '<sf-checkbox label="Флажок" size="1"></sf-checkbox>'},
  'radio-button': {css: ['radio'], js: 'radio', html: '<sf-radio label="Вариант" size="1"></sf-radio>'},
  switch: {css: ['switch'], js: 'switch', html: '<sf-switch label="Включено" size="1"></sf-switch>'},
  textarea: {css: ['textarea'], js: 'textarea', html: '<sf-textarea label="Текст" value="Строка" size="1"></sf-textarea>'},
  toast: {css: ['toast', 'icon-buttons'], js: 'toast', html: '<sf-toast status="info" title="Сохранено" supporting-text="Изменения доступны."></sf-toast>'},
  modal: {css: ['modal', 'icon-buttons', 'buttons'], js: 'modal', html: '<sf-modal id="modal" title="Окно"><p>Текст</p><button slot="footer" type="button">Отмена</button><button slot="footer" type="button">Удалить</button></sf-modal>',
    open: 'document.getElementById("modal").open()'},
  tooltip: {css: ['tooltip'], js: 'tooltip', html: '<sf-tooltip text="Подсказка" supporting-text="Пояснение" size="1"></sf-tooltip>'},
  tabs: {css: ['tabs', 'buttons'], js: 'tabs', html: '<sf-tabs type="underline" size="1" items="Обзор|Настройки|История"></sf-tabs>'},
  avatar: {css: ['avatars'], js: 'avatar', html: '<sf-avatar text="АБ" size="1"></sf-avatar>'},
  'context-menu': {css: ['context-menu', 'buttons'], js: 'context-menu', html: '<button id="anchor" type="button">Меню</button><sf-context-menu id="menu" popup aria-label="Меню"></sf-context-menu>',
    open: 'const m = document.getElementById("menu"); m.entries = [{id: "a", text: "Открыть"}, {id: "b", text: "Удалить"}]; m.toggleFor(document.getElementById("anchor"))'},
  // The variables belong to the segmented appearance; a count is drawn on a
  // segment that is not selected, so the count's own colour has a part to reach.
  'button-group': {css: ['button-group', 'buttons'], js: 'button-group',
    html: `<sf-button-group appearance="segmented" aria-label="Тема" value="all" items='[{"value":"all","label":"Все","count":24},{"value":"dark","label":"Тёмные","count":7}]'></sf-button-group>`},
  // A Smart element with a sheet of its own: a css entry with a slash is a
  // path in the output. Empty, so the glyph's thumbnail is drawn without an
  // image to wait for.
  'image-field': {css: ['buttons', 'smart/smart/image-field/css/image-field.css'], js: 'image-field',
    html: '<sf-image-field label="Логотип" size="1"></sf-image-field>'},
  // The class accordion's sheet, drawn by sf-accordion in each appearance: the
  // fill and radius are the default one's, the border the outline's, and the
  // first section is open so its content has a colour to take.
  accordion: {css: ['accordion', 'icons', 'smart/smart/accordion/css/accordion.css'], js: 'accordion',
    html: ['default', 'outline', 'flush'].map((appearance) => `<sf-accordion appearance="${appearance}" items='[{"id":"a","title":"Раздел","content":"Текст","open":true},{"id":"b","title":"Ещё раздел","content":"Текст"}]'></sf-accordion>`).join('')},
  // The class menu's sheet, drawn by sf-menu as a column and as a row whose
  // panel is open, so the panel's own variables have a part to reach.
  menu: {css: ['menu', 'icons', 'icon-buttons', 'smart/smart/menu/css/menu.css'], js: 'menu',
    html: `<sf-menu label="Разделы" items='[{"id":"a","label":"Обзор","href":"#a"},{"id":"b","label":"Каталог","href":"#b"}]'></sf-menu>`
      + `<div style="inline-size:900px"><sf-menu id="row" orientation="horizontal" label="Шапка" items='[{"id":"c","label":"Каталог","children":[{"id":"d","label":"Решения","href":"#d"}]},{"id":"e","label":"Контакты","href":"#e"}]'></sf-menu></div>`,
    open: 'document.getElementById("row").open("c")'},
};

// The properties a role may change; a value nothing in the Framework uses.
const ROLES = {
  // A toast lays its tint over the raised surface as an image layer.
  background: {properties: ['background-color', 'background-image'], value: 'rgb(1, 2, 3)'},
  color: {properties: ['color'], value: 'rgb(4, 5, 6)'},
  'border-color': {properties: ['border-top-color', 'border-bottom-color'], value: 'rgb(7, 8, 9)'},
  'border-width': {properties: ['border-top-width', 'border-bottom-width'], value: '7px'},
  radius: {properties: ['border-top-left-radius'], value: '13px'},
  'padding-inline': {properties: ['padding-inline-start', 'padding-left'], value: '17px'},
  'padding-block': {properties: ['padding-top'], value: '19px'},
  gap: {properties: ['column-gap', 'row-gap'], value: '23px'},
  size: {properties: ['block-size', 'height'], value: '29px'},
  'indicator-color': {properties: ['border-bottom-color', 'background-color'], value: 'rgb(10, 11, 12)'},
  'indicator-width': {properties: ['border-bottom-width', 'block-size', 'height'], value: '5px'},
  // The ring of an anchored badge is a spread shadow in the surface's colour.
  'ring-color': {properties: ['box-shadow'], value: 'rgb(13, 14, 15)'},
};

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const results = {};
try {
  for (const entry of contract.components) {
    const draw = DRAW[entry.component];
    if (!draw) { note({component: entry.component, said: 'no markup in the probe for this component'}); continue; }
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    // core.js added as an inline module cannot work out its own address; every
    // probe that adds it this way sees that one error, and it changes nothing here.
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({component: entry.component, said: `page error: ${error.message}`}); });
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="margin:20px"><div id="stage">${draw.html}</div></body></html>`);
    for (const folder of ['core', ...draw.css]) {
      const path = folder === 'core' ? 'core/core/css/core.css' : folder.includes('/') ? folder : `component/component/${folder}/css/${folder}.css`;
      await page.addStyleTag({path: join(out, path)}).catch(() => note({component: entry.component, said: `no sheet ${path}`}));
    }
    for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js', 'smart/smart/icon-buttons/js/icon-buttons.js', `smart/smart/${draw.js}/js/${draw.js}.js`]) {
      await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
    }
    await page.waitForTimeout(700);
    if (draw.open) { await page.evaluate(draw.open); await page.waitForTimeout(500); }
    const measured = await page.evaluate(({selector, variables, roles}) => {
      const roots = [...document.querySelectorAll(selector)];
      if (!roots.length) return {missing: selector};
      // Every instance on the stage and its parts: a variant drawn beside the
      // first (the anchored badge) is part of the component too.
      const scope = roots.flatMap((root) => [root, ...root.querySelectorAll('*')]);
      const answers = [];
      for (const variable of variables) {
        const role = roles[variable.role];
        if (!role) { answers.push({name: variable.name, role: variable.role, unmeasured: true}); continue; }
        // A part may be a pseudo-element: the accordion's divider is the
        // header's ::after.
        const read = () => scope.flatMap((element) => [null, '::after'].flatMap((pseudo) => role.properties.map((property) => getComputedStyle(element, pseudo).getPropertyValue(property).trim())));
        const before = read();
        document.documentElement.style.setProperty(variable.name, role.value);
        const after = read();
        document.documentElement.style.removeProperty(variable.name);
        // Taken by some element that did not have it before.
        const ok = after.some((value, at) => (value === role.value || value.startsWith(`${role.value} `) || value.includes(`(${role.value}`) || value.includes(` ${role.value}`)) && before[at] !== value);
        answers.push({name: variable.name, role: variable.role, ok});
      }
      return {answers};
    }, {selector: entry.selector, variables: entry.variables, roles: ROLES});
    results[entry.component] = measured;
    if (measured.missing) note({component: entry.component, said: `nothing drawn for ${measured.missing}`});
    for (const answer of measured.answers ?? []) {
      if (!answer.unmeasured && !answer.ok) note({component: entry.component, variable: answer.name, role: answer.role, said: 'no part of the component took the value'});
    }
    await page.close();
  }
} finally {
  await browser.close();
}
const unmeasured = Object.entries(results).flatMap(([component, measured]) => (measured.answers ?? []).filter((answer) => answer.unmeasured).map((answer) => `${component}:${answer.name}`));
const measuredCount = Object.values(results).reduce((sum, measured) => sum + (measured.answers ?? []).filter((answer) => !answer.unmeasured).length, 0);
console.log(JSON.stringify({measured: measuredCount, unmeasured}));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_VARIABLES_OK');
