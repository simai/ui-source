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
import {DRAW, ROLES} from '../support/public-variables-draw.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-variables.v1.json', import.meta.url), 'utf8'));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const results = {};
try {
  for (const entry of contract.components) {
    const draw = DRAW[entry.component];
    if (!draw) { note({component: entry.component, said: 'no markup in the probe for this component'}); continue; }
    // `opens`: states that cannot stand together on one page, each drawn on a
    // page of its own; a variable passes when one of them takes it.
    let merged = null;
    for (const open of draw.opens ?? [draw.open]) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    // core.js added as an inline module cannot work out its own address; every
    // probe that adds it this way sees that one error, and it changes nothing here.
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({component: entry.component, said: `page error: ${error.message}`}); });
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="margin:20px"><div id="stage">${draw.html}</div></body></html>`);
    for (const folder of ['core', ...draw.css]) {
      const path = folder === 'core' ? 'core/core/css/core.css' : folder.includes('/') ? folder : `component/component/${folder}/css/${folder}.css`;
      await page.addStyleTag({path: join(out, path)}).catch(() => note({component: entry.component, said: `no sheet ${path}`}));
    }
    // js names one module, or several when a component draws with another
    // (sf-gallery's inline view is sf-slider).
    for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', ...[].concat(draw.js).map((js) => `smart/smart/${js}/js/${js}.js`)]) {
      await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
    }
    await page.waitForTimeout(700);
    if (open) { await page.evaluate(open); await page.waitForTimeout(500); }
    const measured = await page.evaluate(({selector, parts, variables, roles}) => {
      const roots = [...document.querySelectorAll(selector)];
      if (!roots.length) return {missing: selector};
      // Every instance on the stage and its parts: a variant drawn beside the
      // first (the anchored badge) is part of the component too. `parts`: what
      // the component draws outside its root (a colour field's window beside
      // .sf-color, a gallery's viewer on the body), with what is inside them.
      const own = parts ? [...document.querySelectorAll(parts)] : [];
      const scope = [...new Set([...roots, ...own].flatMap((root) => [root, ...root.querySelectorAll('*')]))];
      const answers = [];
      for (const variable of variables) {
        const role = roles[variable.role];
        if (!role) { answers.push({name: variable.name, role: variable.role, unmeasured: true}); continue; }
        // A part may be a pseudo-element: the accordion's divider is the
        // header's ::after, a procedure's marker a ::before.
        // `edges`: an inset with the element's edge counted inside it (owner
        // decision C105 H4, as the fields' C77): the padding gives the border
        // back, so the inset is the padding and the border's width together.
        const read = () => scope.flatMap((element) => [null, '::before', '::after'].flatMap((pseudo) => {
          const style = getComputedStyle(element, pseudo);
          return [...role.properties.map((property) => style.getPropertyValue(property).trim()),
            ...(role.edges ?? []).map(([padding, border]) => `${parseFloat(style.getPropertyValue(padding)) + parseFloat(style.getPropertyValue(border))}px`)];
        }));
        const before = read();
        document.documentElement.style.setProperty(variable.name, role.value);
        const after = read();
        document.documentElement.style.removeProperty(variable.name);
        // Taken by some element that did not have it before.
        // A layer of several (background-image: the offline dot's disabled ink
        // over its place, 5a9953ef) is the value followed by a comma.
        const ok = after.some((value, at) => (value === role.value || value.startsWith(`${role.value} `) || value.startsWith(`${role.value},`) || value.includes(`(${role.value}`) || value.includes(` ${role.value}`)) && before[at] !== value);
        answers.push({name: variable.name, role: variable.role, ok});
      }
      return {answers};
    }, {selector: entry.selector, parts: draw.parts ?? null, variables: entry.variables, roles: ROLES});
    // `proves`: a drawing the computed value cannot show (a ceiling the
    // element reaches), on the first page only (GB13 note 2).
    if (draw.proves && !merged) {
      const proof = await page.evaluate(draw.proves);
      results[`${entry.component}:proves`] = proof;
      if (!proof?.ok) note({component: entry.component, said: 'the drawing does not prove the variable', got: proof});
      // `proven`: variables the drawing proves where the computed value cannot
      // show them (a width cap taken when a window opens, a length inside a
      // calc() or a grid track): they pass on the proof.
      if (proof?.ok && measured.answers) {
        measured.answers = measured.answers.map((answer) => ((draw.proven ?? []).includes(answer.name) ? {...answer, ok: true, proven: true} : answer));
      }
    }
    await page.close();
    if (!merged || measured.missing) merged = measured;
    else if (merged.answers && measured.answers) {
      merged.answers = merged.answers.map((answer, at) => ({...answer, ok: answer.ok || measured.answers[at].ok}));
    }
    }
    const measured = merged;
    results[entry.component] = measured;
    if (measured.missing) note({component: entry.component, said: `nothing drawn for ${measured.missing}`});
    for (const answer of measured.answers ?? []) {
      if (!answer.unmeasured && !answer.ok) note({component: entry.component, variable: answer.name, role: answer.role, said: 'no part of the component took the value'});
    }
  }
} finally {
  await browser.close();
}
const unmeasured = Object.entries(results).filter(([name]) => !name.endsWith(':proves')).flatMap(([component, measured]) => (measured.answers ?? []).filter((answer) => answer.unmeasured).map((answer) => `${component}:${answer.name}`));
const measuredCount = Object.entries(results).filter(([name]) => !name.endsWith(':proves')).map(([, one]) => one).reduce((sum, measured) => sum + (measured.answers ?? []).filter((answer) => !answer.unmeasured).length, 0);
console.log(JSON.stringify({measured: measuredCount, unmeasured}));
// PV_SHOW=<component,...> prints those components' answers (evidence runs).
for (const name of (process.env.PV_SHOW ?? '').split(',').filter(Boolean)) console.log(JSON.stringify({[name]: results[name]}));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_VARIABLES_OK');
