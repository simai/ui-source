#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Every public variable's `default` (src/core/contracts/public-variables.v1.json)
// is what the component draws, on the built bytes. Each component is drawn at
// rest from the stage the first public-variable probe uses
// (tests/support/public-variables-draw.mjs); each variable is set on the
// component's roots to the default the contract writes, and no property its
// role names may move on the roots or the parts inside them: a page that sets
// a variable to its documented default must see nothing change. The docs print
// the defaults as they are (ui-doc «Настройка» tables), so a default that is not
// what is drawn misleads every reader: DF-1 (2026-11-18) found the progress bar
// and scale written as grey while the pair drew primary, and the spinner as
// the text's ink while it drew the quiet ink.
//
// The variable is set on every element of the component, not on its root
// alone: a default that names a token (var(--sf-on-surface-variant)) is then
// read where each part reads its fallback, on the fill or the surface the part
// stands on, as the stylesheet's own fallback is. A variable whose value
// depends on a variant (varies_with) is compared on the instance at rest alone,
// the first root on the stage: the default is the resting variant's, and a
// status or an appearance beside it gives its own colour unless the variable is
// set. Where the shared stage draws a component in a variant (a size, a status,
// the Smart element's compact look) the instance at rest is drawn here instead
// (REST). A default that reads another public variable stands for that
// variable's own default and is read the same way.
// Transitions are off: a style read during an ease reads where it started.
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {DRAW, ROLES} from '../support/public-variables-draw.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-variables.v1.json', import.meta.url), 'utf8'));

// The instance at rest, where the shared stage draws a variant: its markup,
// and the sheets and modules it needs when they differ from the stage's.
const REST = {
  // The stage's toast carries a status; the default is the toast without one.
  toast: {html: '<sf-toast title="Сохранено" supporting-text="Изменения доступны."></sf-toast>'},
  // The stage's icon and spinner carry a size; the default is the element's own.
  icon: {html: '<sf-icon icon="home"></sf-icon>'},
  spinner: {html: '<sf-spinner label="Загрузка данных"></sf-spinner>'},
  // The stage's link has a size; the default is the card without one.
  'reference-link': {html: '<sf-reference-link label="Документация" text="/docs/" href="#"></sf-reference-link>'},
  // sf-input-quantity draws the compact look of C53 (the steppers hug the
  // number, gap 0) through its own row; the variables are the class field's,
  // whose box keeps --sf-quantity-gap between its parts (docs: 1.4.4).
  quantity: {js: [], html: '<label class="sf-quantity sf-quantity--size-1"><span class="sf-quantity-label"><span class="sf-quantity-text">Количество</span></span><span class="sf-quantity-wrap"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/3" aria-label="Меньше"><i class="sf-icon" aria-hidden="true">remove</i></button><input type="text" value="3" inputmode="numeric"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/3" aria-label="Больше"><i class="sf-icon" aria-hidden="true">add</i></button></span></label>'},
};

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
let compared = 0;
const skipped = [];
try {
  // PVD_ONLY=<component,...>: those components alone (evidence runs).
  const only = new Set((process.env.PVD_ONLY ?? '').split(',').filter(Boolean));
  for (const entry of contract.components) {
    if (only.size && !only.has(entry.component)) continue;
    const draw = DRAW[entry.component] && {...DRAW[entry.component], ...REST[entry.component]};
    if (!draw) { note({component: entry.component, said: 'no markup in the probe for this component'}); continue; }
    // Every page a component is drawn on (`opens`); a default holds when it
    // changes nothing on every one of them.
    const verdicts = new Map();
    for (const open of draw.opens ?? [draw.open]) {
      const page = await browser.newPage({viewport: {width: 1000, height: 700}});
      page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({component: entry.component, said: `page error: ${error.message}`}); });
      await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="margin:20px"><div id="stage">${draw.html}</div></body></html>`);
      for (const folder of ['core', ...draw.css]) {
        const path = folder === 'core' ? 'core/core/css/core.css' : folder.includes('/') ? folder : `component/component/${folder}/css/${folder}.css`;
        await page.addStyleTag({path: join(out, path)}).catch(() => note({component: entry.component, said: `no sheet ${path}`}));
      }
      for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', ...[].concat(draw.js).map((js) => `smart/smart/${js}/js/${js}.js`)]) {
        await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
      }
      await page.waitForTimeout(700);
      if (open) { await page.evaluate(open); await page.waitForTimeout(500); }
      const measured = await page.evaluate(({selector, parts, variables, roles}) => {
        const roots = [...document.querySelectorAll(selector)];
        if (!roots.length) return {missing: selector};
        // The parts the component draws outside its root (the stage's `parts`).
        const own = parts ? [...document.querySelectorAll(parts)] : [];
        const partsOf = (list) => [...new Set([...list, ...own].flatMap((root) => [root, ...root.querySelectorAll('*')]))];
        const answers = [];
        for (const variable of variables) {
          const role = roles[variable.role];
          if (!role) { answers.push({name: variable.name, unmeasured: true}); continue; }
          const on = variable.varies_with?.length ? roots.slice(0, 1) : roots;
          const scope = partsOf(on);
          const read = () => scope.flatMap((element) => [null, '::before', '::after'].flatMap((pseudo) => role.properties.map((property) => getComputedStyle(element, pseudo).getPropertyValue(property).trim())));
          const before = read();
          for (const element of scope) element.style.setProperty(variable.name, variable.default);
          const after = read();
          for (const element of scope) element.style.removeProperty(variable.name);
          const moved = [];
          after.forEach((value, at) => {
            if (value === before[at]) return;
            const element = scope[Math.floor(at / (3 * role.properties.length))];
            const pseudo = [null, '::before', '::after'][Math.floor(at / role.properties.length) % 3];
            moved.push({part: `${element.tagName.toLowerCase()}${element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : ''}${pseudo ?? ''}`, property: role.properties[at % role.properties.length], drawn: before[at], default: value});
          });
          answers.push({name: variable.name, moved: moved.slice(0, 3), count: moved.length});
        }
        return {answers};
      }, {selector: entry.selector, parts: draw.parts ?? null, variables: entry.variables, roles: ROLES});
      await page.close();
      if (measured.missing) { note({component: entry.component, said: `nothing drawn for ${measured.missing}`}); continue; }
      for (const answer of measured.answers) {
        if (answer.unmeasured) { verdicts.set(answer.name, {unmeasured: true}); continue; }
        const held = verdicts.get(answer.name);
        if (!held || answer.count) verdicts.set(answer.name, answer.count ? answer : (held ?? answer));
      }
    }
    for (const variable of entry.variables) {
      const verdict = verdicts.get(variable.name);
      if (!verdict) continue;
      if (verdict.unmeasured) { skipped.push(`${entry.component}:${variable.name}`); continue; }
      compared += 1;
      if (verdict.count) note({component: entry.component, variable: variable.name, contract_default: variable.default, said: `the default is not what is drawn: ${verdict.count} value(s) moved`, moved: verdict.moved});
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({compared, unmeasured: skipped}));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_VARIABLE_DEFAULTS_OK');
