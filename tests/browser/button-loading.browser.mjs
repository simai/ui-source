#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A loading button shows the spinner at its icon's size (simai/ui-source#10),
// measured on the built bytes at every step and on both sides of the 60rem
// breakpoint (widths 1000 and 390):
//   - sf-button with an icon: the spinner takes the icon's place and box, and
//     the button keeps its width and height;
//   - sf-button without an icon: the spinner lies over the label, centred on
//     it; the label keeps its place (text fill transparent) and the button its
//     width; the label is still the accessible name;
//   - an icon-only sf-button and sf-icon-button: the spinner replaces the icon;
//   - sf-button-group, default and segmented, with text, icon and icon-only
//     items: the same, and no item changes width;
//   - aria-busy="true" and native disabled on every loading button;
//   - the spinner takes the disabled ink, or --sf-loader--color;
//   - the arc moves without end, and under reduced motion it is a still arc;
//   - the slot is right without the spinner sheet (the button sheets draw it);
//   - toggling loading on sf-button and sf-icon-button brings the icon back;
//   - the ordinary constructors draw the same spinner;
//   - no stripes: the old layer paints nothing unless a page still sets
//     --sf-button-loading-stripe, which is read until the sweep.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SPINNER_SHEET = 'component/component/spinner/css/spinner.css';
const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/button-group/css/button-group.css', SPINNER_SHEET];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'component/component/button-group/js/button-group.js', 'smart/smart/button-group/js/button-group.js',
  'component/component/buttons/js/buttons.js', 'component/component/icon-buttons/js/icon-buttons.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();

async function open({width = 1000, body = '', reducedMotion = 'no-preference', spinnerSheet = true} = {}) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS.filter((path) => spinnerSheet || path !== SPINNER_SHEET)) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => ['sf-button', 'sf-icon-button', 'sf-button-group'].every((tag) => customElements.get(tag)));
  await page.waitForTimeout(600);
  return page;
}

const items = (list) => `items='${JSON.stringify(list)}'`;
const TEXT = [{value: 'a', label: 'Сохранить'}, {value: 'b', label: 'Отправить'}];
const WITH_ICON = [{value: 'a', label: 'Сохранить', icon: 'save'}, {value: 'b', label: 'Отправить', icon: 'send'}];
const ICON_ONLY = [{value: 'a', label: 'Сохранить', icon: 'save', 'icon-only': true}, {value: 'b', label: 'Отправить', icon: 'send', 'icon-only': true}];
const loadingFirst = (list) => list.map((item, index) => (index === 0 ? {...item, loading: true} : item));

// Everything one loading control says about itself.
const READ = `(button) => {
  const of = (node) => { const rect = node.getBoundingClientRect(); return {x: rect.x, y: rect.y, width: rect.width, height: rect.height}; };
  const spinner = button.querySelector(':scope > .sf-loader-container');
  const label = button.querySelector(':scope > .sf-button-text-container');
  const accent = spinner?.querySelector('.sf-loader-ring-accent');
  return {
    box: of(button),
    busy: button.getAttribute('aria-busy'),
    disabled: button.disabled,
    icons: button.querySelectorAll('.sf-icon').length,
    spinner: spinner ? of(spinner) : null,
    overlay: Boolean(spinner && /--overlay/u.test(spinner.className)),
    label: label ? {...of(label), colour: getComputedStyle(label).color, fill: getComputedStyle(label).webkitTextFillColor, text: label.textContent.trim()} : null,
    stroke: accent ? getComputedStyle(accent).stroke : null,
    animation: accent ? getComputedStyle(accent).animationName : null,
    iterations: accent ? getComputedStyle(accent).animationIterationCount : null,
    dash: accent ? getComputedStyle(accent).strokeDasharray : null,
    spin: spinner ? getComputedStyle(spinner.querySelector('.sf-loader-svg')).animationName : null,
    spinIterations: spinner ? getComputedStyle(spinner.querySelector('.sf-loader-svg')).animationIterationCount : null,
    stripes: getComputedStyle(button, '::after').backgroundImage,
    stripeAnimation: getComputedStyle(button, '::after').animationName,
  };
}`;

try {
  // 1. Every step, both sides of 60rem: resting and loading side by side.
  for (const width of [1000, 390]) {
    const body = SIZES.map((size) => `<div data-row="${size}" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-block-end:8px">
      <sf-button size="${size}" icon="save" text="Сохранить" class="k-icon s-rest"></sf-button>
      <sf-button size="${size}" icon="save" text="Сохранить" loading class="k-icon s-load"></sf-button>
      <sf-button size="${size}" text="Сохранить" class="k-text s-rest"></sf-button>
      <sf-button size="${size}" text="Сохранить" loading class="k-text s-load"></sf-button>
      <sf-button size="${size}" icon="save" aria-label="Сохранить" class="k-only s-rest"></sf-button>
      <sf-button size="${size}" icon="save" aria-label="Сохранить" loading class="k-only s-load"></sf-button>
      <sf-icon-button size="${size}" icon="save" aria-label="Сохранить" class="k-iconbutton s-rest"></sf-icon-button>
      <sf-icon-button size="${size}" icon="save" aria-label="Сохранить" loading class="k-iconbutton s-load"></sf-icon-button>
      <sf-button-group size="${size}" aria-label="Действие" value="b" ${items(WITH_ICON)} class="k-group s-rest"></sf-button-group>
      <sf-button-group size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(WITH_ICON))} class="k-group s-load"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(TEXT)} class="k-segtext s-rest"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(TEXT))} class="k-segtext s-load"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(WITH_ICON)} class="k-segicon s-rest"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(WITH_ICON))} class="k-segicon s-load"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(ICON_ONLY)} class="k-segonly s-rest"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(ICON_ONLY))} class="k-segonly s-load"></sf-button-group>
    </div>`).join('');
    const page = await open({width, body});
    await page.waitForFunction(() => document.querySelectorAll('sf-button-group button').length === 5 * 8 * 2);
    const rows = await page.evaluate(({sizes, source}) => {
      const read = eval(source);
      const first = (host) => host.querySelector('button');
      return sizes.map((size) => {
        const row = document.querySelector(`[data-row="${size}"]`);
        const pick = (kind, state) => row.querySelector(`.k-${kind}.s-${state}`);
        const pair = (kind) => ({rest: read(first(pick(kind, 'rest'))), load: read(first(pick(kind, 'load')))});
        const icon = row.querySelector('.k-icon.s-rest .sf-icon').getBoundingClientRect();
        const iconButtonIcon = row.querySelector('.k-iconbutton.s-rest .sf-icon').getBoundingClientRect();
        const groupWidths = (kind, state) => [...pick(kind, state).querySelectorAll('button')].map((node) => node.getBoundingClientRect().width);
        return {
          size,
          icon: {x: icon.x, y: icon.y, width: icon.width, height: icon.height},
          iconButtonIcon: {width: iconButtonIcon.width, height: iconButtonIcon.height},
          icon_: pair('icon'), text: pair('text'), only: pair('only'), iconbutton: pair('iconbutton'),
          group: pair('group'), segtext: pair('segtext'), segicon: pair('segicon'), segonly: pair('segonly'),
          widths: Object.fromEntries(['group', 'segtext', 'segicon', 'segonly'].map((kind) => [kind, {rest: groupWidths(kind, 'rest'), load: groupWidths(kind, 'load')}])),
        };
      });
    }, {sizes: SIZES, source: READ});
    evidence[`ladder@${width}`] = rows.map((row) => ({
      size: row.size, button: row.icon_.rest.box.height, icon: row.icon.width, spinner: row.icon_.load.spinner?.width,
      overlay: row.text.load.spinner?.width, iconOnly: row.only.load.spinner?.width, iconButton: row.iconbutton.load.spinner?.width,
      segment: row.segicon.load.spinner?.width,
    }));
    for (const row of rows) {
      const at = `size ${row.size} at ${width}px`;
      const iconBox = row.icon;
      const sameBox = (spinner, box = iconBox) => spinner && near(spinner.width, box.width) && near(spinner.height, box.height) && box.width > 0;
      for (const kind of ['icon_', 'text', 'only', 'iconbutton', 'group', 'segtext', 'segicon', 'segonly']) {
        const {rest, load} = row[kind];
        check(`${at} ${kind}: loading keeps the width and the height`, near(rest.box.width, load.box.width) && near(rest.box.height, load.box.height), {rest: rest.box, load: load.box});
        check(`${at} ${kind}: aria-busy and disabled while loading, neither at rest`, load.busy === 'true' && load.disabled && rest.busy === null && !rest.disabled, {rest: {busy: rest.busy, disabled: rest.disabled}, load: {busy: load.busy, disabled: load.disabled}});
        check(`${at} ${kind}: a spinner while loading, none at rest`, load.spinner && !rest.spinner, {load: load.spinner});
        check(`${at} ${kind}: the spinner moves without end`, load.spin === 'sf-loader-svg-rotate' && load.spinIterations === 'infinite' && /^30(px)?, 70(px)?$/u.test(load.dash), {spin: load.spin, iterations: load.spinIterations, dash: load.dash});
        check(`${at} ${kind}: no stripes`, !/rgb/u.test(load.stripes.replace(/rgba\(0, 0, 0, 0\)/gu, '')) && load.stripeAnimation === 'none', {stripes: load.stripes});
      }
      // With an icon: the spinner takes the icon's box and place, the icon goes.
      for (const kind of ['icon_', 'only', 'group', 'segicon', 'segonly']) {
        const {load} = row[kind];
        check(`${at} ${kind}: the spinner is the icon's box`, sameBox(load.spinner), {icon: iconBox, spinner: load.spinner});
        check(`${at} ${kind}: the spinner replaces the icon`, !load.overlay && load.icons === row[kind].rest.icons - 1, {icons: load.icons, rest: row[kind].rest.icons});
      }
      check(`${at} icon: the spinner stands where the icon stood`, near(row.icon_.load.spinner.x - row.icon_.load.box.x, iconBox.x - row.icon_.rest.box.x, 0.5) && near(row.icon_.load.spinner.y - row.icon_.load.box.y, iconBox.y - row.icon_.rest.box.y, 0.5), {icon: iconBox, spinner: row.icon_.load.spinner});
      check(`${at} icon: the label stays visible`, row.icon_.load.label.colour !== 'rgba(0, 0, 0, 0)', row.icon_.load.label);
      check(`${at} icon button: the spinner is the icon's box`, sameBox(row.iconbutton.load.spinner, row.iconButtonIcon) && row.iconbutton.load.icons === 0, {icon: row.iconButtonIcon, spinner: row.iconbutton.load.spinner});
      // Without an icon: over the label, which keeps its place, unpainted.
      for (const kind of ['text', 'segtext']) {
        const {rest, load} = row[kind];
        const centre = (box) => ({x: box.x + box.width / 2, y: box.y + box.height / 2});
        check(`${at} ${kind}: the spinner is the icon's box`, sameBox(load.spinner), {icon: iconBox, spinner: load.spinner});
        check(`${at} ${kind}: the spinner lies over the label, centred`, load.overlay && near(centre(load.spinner).x, centre(load.label).x, 0.75) && near(centre(load.spinner).y, centre(load.label).y, 0.75), {spinner: load.spinner, label: load.label});
        check(`${at} ${kind}: the label keeps its place and its text, unpainted`, near(load.label.width, rest.label.width) && load.label.text === 'Сохранить'
          && load.label.fill === 'rgba(0, 0, 0, 0)', {rest: rest.label, load: load.label});
      }
      for (const kind of ['group', 'segtext', 'segicon', 'segonly']) {
        const {rest, load} = row.widths[kind];
        check(`${at} ${kind}: no item changes width`, rest.length === load.length && rest.every((value, index) => near(value, load[index])), {rest, load});
      }
    }
    check(`no horizontal scroll at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.close();
  }

  // 2. The label is the accessible name; the ink; --sf-loader--color.
  {
    const page = await open({body: `<sf-button id="text" text="Отправить" loading></sf-button>
      <sf-button id="tinted" text="Отправить" icon="send" loading style="--sf-loader--color: rgb(200, 0, 0)"></sf-button>
      <sf-icon-button id="iconbutton" icon="save" aria-label="Сохранить" loading></sf-icon-button>
      <span id="disable" style="color: var(--sf-on-disable)">x</span>`});
    const named = await page.getByRole('button', {name: 'Отправить', exact: true}).count();
    const busyNamed = await page.locator('#text').getByRole('button', {name: 'Отправить', exact: true}).count();
    const iconNamed = await page.getByRole('button', {name: 'Сохранить', exact: true}).count();
    const colours = await page.evaluate(() => ({
      disable: getComputedStyle(document.getElementById('disable')).color,
      text: getComputedStyle(document.querySelector('#text .sf-loader-ring-accent')).stroke,
      iconbutton: getComputedStyle(document.querySelector('#iconbutton .sf-loader-ring-accent')).stroke,
      tinted: getComputedStyle(document.querySelector('#tinted .sf-loader-ring-accent')).stroke,
    }));
    evidence.names = {named, busyNamed, iconNamed};
    evidence.colours = colours;
    check('a loading button without an icon keeps its label as its name', busyNamed === 1 && named === 2, evidence.names);
    check('a loading icon button keeps its name', iconNamed === 1, evidence.names);
    check('the spinner takes the disabled ink of the loading button', colours.text === colours.disable && colours.iconbutton === colours.disable, colours);
    check('--sf-loader--color colours the spinner in a button', colours.tinted === 'rgb(200, 0, 0)', colours);
    await page.close();
  }

  // 3. Reduced motion: a still arc in every kind of button.
  {
    const page = await open({reducedMotion: 'reduce', body: `<sf-button text="Сохранить" loading></sf-button>
      <sf-button text="Сохранить" icon="save" loading></sf-button>
      <sf-icon-button icon="save" aria-label="Сохранить" loading></sf-icon-button>
      <sf-button-group appearance="segmented" aria-label="Действие" value="b" ${items(loadingFirst(TEXT))}></sf-button-group>`});
    const still = await page.evaluate(() => [...document.querySelectorAll('.sf-loader-ring-accent')].map((node) => {
      const style = getComputedStyle(node);
      return {animation: style.animationName, spin: getComputedStyle(node.closest('.sf-loader-svg')).animationName, dash: style.strokeDasharray, opacity: style.opacity};
    }));
    evidence.reducedMotion = still;
    check('reduced motion: a still arc in every loading button', still.length === 4 && still.every((row) => row.animation === 'none' && row.spin === 'none' && /^30(px)?, 70(px)?$/u.test(row.dash) && row.opacity === '1'), {still});
    await page.close();
  }

  // 4. Without the spinner sheet the slot is still the icon's box.
  for (const width of [1000, 390]) {
    const page = await open({width, spinnerSheet: false, body: SIZES.map((size) => `<div data-row="${size}">
      <sf-button size="${size}" icon="save" text="Сохранить"></sf-button>
      <sf-button size="${size}" text="Сохранить" loading class="text"></sf-button>
      <sf-icon-button size="${size}" icon="save" aria-label="Сохранить" loading></sf-icon-button></div>`).join('')});
    const rows = await page.evaluate((sizes) => sizes.map((size) => {
      const row = document.querySelector(`[data-row="${size}"]`);
      const box = (node) => { const rect = node.getBoundingClientRect(); return [rect.width, rect.height]; };
      return {size, icon: box(row.querySelector('.sf-icon')), text: box(row.querySelector('sf-button.text .sf-loader-container')), iconButton: box(row.querySelector('sf-icon-button .sf-loader-container'))};
    }), SIZES);
    evidence[`withoutSpinnerSheet@${width}`] = rows;
    check(`without the spinner sheet the slot is the icon's box at ${width}px`, rows.every((row) => near(row.text[0], row.icon[0]) && near(row.text[1], row.icon[1])
      && near(row.iconButton[0], row.icon[0]) && near(row.iconButton[1], row.icon[1])), {rows});
    await page.close();
  }

  // 5. Toggling loading brings the icon back; the ordinary constructors draw the same spinner.
  {
    const page = await open({body: `<sf-button id="b" icon="save" text="Сохранить"></sf-button><sf-icon-button id="ib" icon="save" aria-label="Сохранить"></sf-icon-button><div id="ordinary"></div>`});
    const state = () => page.evaluate(() => ['b', 'ib'].map((id) => {
      const button = document.querySelector(`#${id} button`);
      return {id, spinner: Boolean(button.querySelector('.sf-loader-container')), icon: Boolean(button.querySelector('.sf-icon')), busy: button.getAttribute('aria-busy'), disabled: button.disabled};
    }));
    await page.evaluate(() => { document.getElementById('b').setAttribute('loading', ''); document.getElementById('ib').setAttribute('loading', ''); });
    await page.waitForTimeout(300);
    const on = await state();
    await page.evaluate(() => { document.getElementById('b').removeAttribute('loading'); document.getElementById('ib').removeAttribute('loading'); });
    await page.waitForTimeout(300);
    const off = await state();
    evidence.toggle = {on, off};
    check('loading on: spinner, no icon, busy and disabled', on.every((row) => row.spinner && !row.icon && row.busy === 'true' && row.disabled), {on});
    check('loading off: the icon is back, nothing busy', off.every((row) => !row.spinner && row.icon && row.busy === null && !row.disabled), {off});

    const ordinary = await page.evaluate(() => {
      const find = (name) => window.SF?.Loader?.ComponentRegistry?.[name] || window.SF?.ComponentRegistry?.[name]
        || (window.SF_PENDING_COMPONENTS || []).find(([key]) => key === name)?.[1];
      const Buttons = find('Buttons');
      const IconButtons = find('IconButtons');
      if (!Buttons || !IconButtons) return null;
      const host = document.getElementById('ordinary');
      const text = new Buttons({param: {text: 'Сохранить', loading: true}}).template;
      const withIcon = new Buttons({param: {text: 'Сохранить', icon: 'save', loading: true}}).template;
      const iconButton = new IconButtons({param: {icon: 'save', loading: true}, attrs: {'aria-label': 'Сохранить'}}).template;
      host.append(text, withIcon, iconButton);
      const spinner = (button) => button.querySelector(':scope > .sf-loader-container');
      return {
        text: {overlay: /--overlay/u.test(spinner(text)?.className || ''), before: spinner(text)?.nextElementSibling?.classList.contains('sf-button-text-container'), busy: text.getAttribute('aria-busy'), disabled: text.disabled},
        withIcon: {spinner: Boolean(spinner(withIcon)), icons: withIcon.querySelectorAll('.sf-icon').length, overlay: /--overlay/u.test(spinner(withIcon)?.className || '')},
        iconButton: {spinner: Boolean(iconButton.querySelector('.sf-icon-button-spinner')), icons: iconButton.querySelectorAll('.sf-icon').length},
      };
    });
    evidence.ordinary = ordinary;
    check('the ordinary constructors are registered', ordinary !== null);
    if (ordinary) {
      check('ordinary button without an icon: the spinner over the label, before it', ordinary.text.overlay && ordinary.text.before && ordinary.text.busy === 'true' && ordinary.text.disabled, ordinary);
      check('ordinary button with an icon: the spinner in the icon\'s place', ordinary.withIcon.spinner && ordinary.withIcon.icons === 0 && !ordinary.withIcon.overlay, ordinary);
      check('ordinary icon button: the spinner in place of the icon', ordinary.iconButton.spinner && ordinary.iconButton.icons === 0, ordinary);
    }
    await page.close();
  }

  // 6. The stripes: nothing by default, still stripes in a colour a page still sets.
  {
    const page = await open({body: `<sf-button id="plain" text="Сохранить" loading></sf-button>
      <sf-button id="legacy" text="Сохранить" loading style="--sf-button-loading-stripe: rgb(255, 0, 0)"></sf-button>
      <sf-icon-button id="legacy-icon" icon="save" aria-label="Сохранить" loading style="--sf-icon-button-loading-stripe: rgb(0, 0, 255)"></sf-icon-button>`});
    const stripes = await page.evaluate(() => Object.fromEntries(['plain', 'legacy', 'legacy-icon'].map((id) => {
      const style = getComputedStyle(document.querySelector(`#${id} button`), '::after');
      return [id, {image: style.backgroundImage, animation: style.animationName}];
    })));
    evidence.stripes = stripes;
    check('no stripes by default', !/rgb\((?!0, 0, 0)/u.test(stripes.plain.image.replace(/rgba\(0, 0, 0, 0\)/gu, '')) && stripes.plain.animation === 'none', stripes);
    check('a page that still sets --sf-button-loading-stripe gets still stripes in it', /rgb\(255, 0, 0\)/u.test(stripes.legacy.image) && stripes.legacy.animation === 'none', stripes);
    check('a page that still sets --sf-icon-button-loading-stripe gets still stripes in it', /rgb\(0, 0, 255\)/u.test(stripes['legacy-icon'].image) && stripes['legacy-icon'].animation === 'none', stripes);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_LOADING_OK');
