#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The segmented appearance of sf-button-group (simai/ui-source#4), measured on
// the built bytes:
//   - a segment is exactly as tall as a button of the same size, at every step
//     of the ladder and on both sides of the 60rem breakpoint, and the track adds
//     only its padding on each side;
//   - the plate sits under the selected segment, moves with the selection, and
//     never changes a segment's width;
//   - the dimmed ink of a segment that is not selected, and its count, reach
//     4.5:1 over the track composited over the surfaces 0 to 3, in both themes;
//     the ink on either plate reaches 4.5:1 over the plate;
//   - full-width fills its container with equal segments;
//   - an icon-only segment is square and keeps its label as its name, and a
//     count is part of the name;
//   - the keyboard is the group's own: arrows, Home and End, one tab stop,
//     disabled items skipped, change on the host; the ring is visible;
//   - no join border reaches a segment, a narrow page does not scroll sideways,
//     reduced motion stops the transitions and forced colours keep the plate;
//   - radius, as on sf-button: the track takes the named radius and the plate
//     the track's minus the padding (rounded: both pills, square: both square),
//     --sf-button-group-radius sets the track's, and a joined group rounds its
//     outer corners;
//   - with a name the group is a form field: the submitted FormData holds
//     name=value, a reset brings back the written value, a disabled group is
//     left out, and a group without a name adds nothing.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css', 'component/component/button-group/css/button-group.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'component/component/button-group/js/button-group.js', 'smart/smart/button-group/js/button-group.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();

async function open({width = 1000, theme = 'light', body = '', reducedMotion = 'no-preference', forcedColors = 'none'} = {}) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion, forcedColors});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-button-group') && customElements.get('sf-button'));
  await page.waitForTimeout(600);
  return page;
}

const items = (list) => `items='${JSON.stringify(list)}'`;
const THREE = [{value: 'all', label: 'Все', count: 24}, {value: 'light', label: 'Светлые', count: 17}, {value: 'dark', label: 'Тёмные', count: 7}];
const ICONS = [{value: 'list', label: 'Список', icon: 'list', 'icon-only': true}, {value: 'grid', label: 'Сетка', icon: 'grid_view', 'icon-only': true}];

try {
  // 1. The ladder: a segment is a button of the same size; the track adds its padding.
  for (const width of [1000, 390]) {
    const body = SIZES.map((size) => `<div data-row="${size}" style="display:flex;gap:16px;align-items:flex-start;margin-block-end:8px">
      <sf-button size="${size}" text="Кнопка"></sf-button>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Период" value="all" class="text" ${items(THREE)}></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Вид" value="list" class="icons" ${items(ICONS)}></sf-button-group>
    </div>`).join('');
    const page = await open({width, body});
    const ladder = await page.evaluate((sizes) => sizes.map((size) => {
      const row = document.querySelector(`[data-row="${size}"]`);
      const button = row.querySelector('sf-button > button').getBoundingClientRect();
      const group = row.querySelector('sf-button-group.text .sf-button-group');
      const segments = [...group.querySelectorAll(':scope > button')].map((node) => node.getBoundingClientRect());
      const iconNodes = [...row.querySelectorAll('sf-button-group.icons .sf-button-group > button')];
      const icons = iconNodes.map((node) => node.getBoundingClientRect());
      // No join border reaches a segment, of either kind.
      const borders = [...group.children, ...iconNodes].flatMap((node) => {
        const style = getComputedStyle(node);
        return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
      });
      const style = getComputedStyle(group);
      const padding = parseFloat(style.paddingTop);
      return {
        size, button: button.height, segments: segments.map((rect) => rect.height), icons: icons.map((rect) => [rect.width, rect.height]), borders,
        track: group.getBoundingClientRect().height, padding, gap: parseFloat(style.columnGap),
        radius: parseFloat(style.borderTopLeftRadius), plateRadius: parseFloat(getComputedStyle(group.firstElementChild).borderTopLeftRadius),
      };
    }), SIZES);
    evidence[`ladder@${width}`] = ladder.map(({size, button, track, padding}) => ({size, button, track, padding}));
    for (const row of ladder) {
      check(`size ${row.size} at ${width}px: a segment is as tall as the button`, row.segments.every((height) => Math.abs(height - row.button) < 0.01), row);
      check(`size ${row.size} at ${width}px: an icon-only segment is as tall as the button and square`,
        row.icons.every(([w, h]) => Math.abs(h - row.button) < 0.01 && Math.abs(w - h) < 0.01), row);
      check(`size ${row.size} at ${width}px: no segment has a border`, row.borders.every((value) => value === '0px'), row);
      check(`size ${row.size} at ${width}px: the track adds only its padding`, Math.abs(row.track - (row.button + 2 * row.padding)) < 0.01 && row.padding > 0, row);
      check(`size ${row.size} at ${width}px: the gap is the padding`, Math.abs(row.gap - row.padding) < 0.01, row);
      check(`size ${row.size} at ${width}px: the corners are concentric`, Math.abs(row.radius - row.plateRadius - row.padding) < 0.01, row);
    }
    await page.close();
  }

  // 2. The plate follows the selection and keeps the widths; no join border.
  {
    const page = await open({body: `<sf-button-group id="g" appearance="segmented" aria-label="Тема" value="all" ${items(THREE)}></sf-button-group>`});
    const read = () => page.evaluate(() => [...document.querySelectorAll('#g .sf-button-group > button')].map((node) => {
      const style = getComputedStyle(node);
      return {
        value: node.dataset.sfButtonGroupValue, checked: node.getAttribute('aria-checked'), fill: style.backgroundColor,
        width: node.getBoundingClientRect().width, borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        segmentClass: [...node.classList].some((name) => name.startsWith('segment-')),
      };
    }));
    const transparent = (fill) => fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent';
    const before = await read();
    await page.evaluate(() => document.getElementById('g').select('dark'));
    await page.waitForTimeout(200);
    const after = await read();
    evidence.plate = {before: before.map(({value, fill, width}) => ({value, fill, width})), after: after.map(({value, fill, width}) => ({value, fill, width}))};
    for (const [label, rows, selected] of [['before', before, 'all'], ['after', after, 'dark']]) {
      check(`plate ${label}: only the selected segment has a fill`, rows.every((row) => (row.value === selected) === !transparent(row.fill)), {rows});
      check(`plate ${label}: aria-checked follows`, rows.every((row) => (row.value === selected) === (row.checked === 'true')), {rows});
      check(`plate ${label}: no join border and no join class`, rows.every((row) => row.borders.every((width) => width === '0px') && !row.segmentClass), {rows});
    }
    check('the plate does not change a segment width', before.every((row, index) => Math.abs(row.width - after[index].width) < 0.01), {before, after});
    await page.close();
  }

  // 3. Contrast over the track on surfaces 0 to 3, both themes; ink on both plates.
  for (const theme of ['light', 'dark']) {
    const body = [0, 1, 2, 3].map((step) => `<div class="surface" style="background-color:var(--sf-surface-${step});padding:8px">
      <sf-button-group appearance="segmented" aria-label="Тема" value="all" data-step="${step}" ${items(THREE)}></sf-button-group>
      <sf-button-group appearance="segmented" plate="raised" aria-label="Тема" value="all" data-raised="${step}" ${items(THREE)}></sf-button-group>
      <sf-button-group appearance="segmented" scheme="secondary" aria-label="Тема" value="all" data-secondary="${step}" ${items(THREE)}></sf-button-group>
      <sf-button-group appearance="segmented" scheme="on-surface" aria-label="Тема" value="all" data-on-surface="${step}" ${items(THREE)}></sf-button-group>
    </div>`).join('');
    const page = await open({theme, body});
    const rows = await page.evaluate(() => {
      const probe = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
      // The browser resolves every colour syntax it computes (rgb, color(srgb),
      // color-mix results) into straight sRGB bytes with alpha.
      const rgba = (value) => {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const over = (top, bottom) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3]));
      const luminance = (rgb) => {
        const [r, g, b] = rgb.map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const contrast = (a, b) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
      };
      const result = [];
      for (const surface of document.querySelectorAll('.surface')) {
        const page = rgba(getComputedStyle(surface).backgroundColor);
        for (const host of surface.querySelectorAll('sf-button-group')) {
          const kind = host.dataset.raised ? 'raised' : host.dataset.secondary ? 'secondary' : host.dataset.onSurface ? 'on-surface' : 'primary';
          const root = host.querySelector('.sf-button-group');
          const track = over(rgba(getComputedStyle(root).backgroundColor), page);
          const [selected, rest] = [root.querySelector('button.active'), root.querySelector('button:not(.active)')];
          const ink = over(rgba(getComputedStyle(rest.querySelector('.sf-button-text-container')).color), track);
          const count = over(rgba(getComputedStyle(rest.querySelector('.sf-button-group-count')).color), track);
          const plate = over(rgba(getComputedStyle(selected).backgroundColor), track);
          const plateInk = over(rgba(getComputedStyle(selected.querySelector('.sf-button-text-container')).color), plate);
          result.push({
            step: Number(host.dataset.step ?? host.dataset.raised ?? host.dataset.secondary ?? host.dataset.onSurface), kind,
            text: Number(contrast(ink, track).toFixed(2)), count: Number(contrast(count, track).toFixed(2)), plate: Number(contrast(plateInk, plate).toFixed(2)),
          });
        }
      }
      return result;
    });
    evidence[`contrast-${theme}`] = rows;
    for (const row of rows) {
      check(`${theme} surface ${row.step} ${row.kind}: unselected text over the track ≥ 4.5:1`, row.text >= 4.5, row);
      check(`${theme} surface ${row.step} ${row.kind}: unselected count over the track ≥ 4.5:1`, row.count >= 4.5, row);
      check(`${theme} surface ${row.step} ${row.kind}: ink on the plate ≥ 4.5:1`, row.plate >= 4.5, row);
    }
    await page.close();
  }

  // 4. Full width, icon-only names, counts in the name, narrow pages.
  {
    const page = await open({width: 390, body: `
      <div id="box" style="inline-size:320px"><sf-button-group id="full" appearance="segmented" full-width aria-label="Период" value="d" ${items([{value: 'd', label: 'День'}, {value: 'w', label: 'Неделя'}, {value: 'm', label: 'Месяц'}])}></sf-button-group></div>
      <sf-button-group id="icons" appearance="segmented" aria-label="Вид" value="list" ${items(ICONS)}></sf-button-group>
      <sf-button-group id="named" appearance="segmented" aria-label="Фильтр" value="all" ${items([{value: 'all', label: 'Все', count: 24}, {value: 'dark', label: 'Тёмные', count: 7, 'aria-label': 'Тёмные эффекты'}])}></sf-button-group>
      <sf-button-group id="long" appearance="segmented" aria-label="Много" value="a" ${items('abcdefghij'.split('').map((value) => ({value, label: `Пункт ${value}`})))}></sf-button-group>`});
    const full = await page.evaluate(() => {
      const box = document.getElementById('box').getBoundingClientRect();
      const root = document.querySelector('#full .sf-button-group');
      return {box: box.width, track: root.getBoundingClientRect().width, segments: [...root.children].map((node) => node.getBoundingClientRect().width)};
    });
    evidence.fullWidth = full;
    check('full-width fills its container', Math.abs(full.track - full.box) < 0.01, full);
    check('full-width segments are equal', full.segments.every((width) => Math.abs(width - full.segments[0]) < 0.5), full);
    for (const name of ['Список', 'Сетка']) {
      check(`icon-only segment is named ${name}`, (await page.getByRole('radio', {name, exact: true}).count()) === 1);
    }
    const hidden = await page.evaluate(() => [...document.querySelectorAll('#icons .sf-button-group-label--hidden')].map((node) => node.getBoundingClientRect().width));
    check('an icon-only label is not seen', hidden.length === 2 && hidden.every((width) => width <= 1), {hidden});
    check('a count is part of the name', (await page.getByRole('radio', {name: 'Все 24', exact: true}).count()) === 1);
    check('an aria-label carries the count', (await page.getByRole('radio', {name: 'Тёмные эффекты 7', exact: true}).count()) === 1);
    const narrow = await page.evaluate(() => {
      const root = document.querySelector('#long .sf-button-group');
      return {page: document.documentElement.scrollWidth, viewport: innerWidth, track: root.scrollWidth, visible: root.clientWidth};
    });
    evidence.narrow = narrow;
    check('a long track scrolls inside itself, the page does not', narrow.page <= narrow.viewport && narrow.track > narrow.visible, narrow);
    await page.close();
  }

  // 5. The keyboard is the group's own; the ring is seen.
  {
    const page = await open({body: `<button id="before">до</button>
      <sf-button-group id="k" appearance="segmented" aria-label="Тема" value="a" ${items([{value: 'a', label: 'А'}, {value: 'b', label: 'Б', disabled: true}, {value: 'c', label: 'В'}, {value: 'd', label: 'Г'}])}></sf-button-group>`});
    await page.evaluate(() => { window.__changes = []; document.getElementById('k').addEventListener('change', (event) => window.__changes.push(event.detail.value)); });
    await page.focus('#before');
    await page.keyboard.press('Tab');
    const state = () => page.evaluate(() => {
      const host = document.getElementById('k');
      const buttons = [...host.querySelectorAll('button[role="radio"]')];
      const focused = document.activeElement;
      const style = getComputedStyle(focused);
      return {
        value: host.value, focused: focused.dataset?.sfButtonGroupValue, stops: buttons.filter((node) => node.tabIndex === 0).map((node) => node.dataset.sfButtonGroupValue),
        ring: focused.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0, role: host.querySelector('.sf-button-group').getAttribute('role'),
      };
    });
    const start = await state();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const right = await state();
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    const end = await state();
    await page.keyboard.press('Home');
    await page.waitForTimeout(150);
    const home = await state();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    const wrap = await state();
    const changes = await page.evaluate(() => window.__changes);
    evidence.keyboard = {start, right, end, home, wrap, changes};
    check('Tab lands on the selected segment, with a visible ring', start.focused === 'a' && start.ring && start.role === 'radiogroup', start);
    check('one tab stop', [start, right, end, home, wrap].every((row) => row.stops.length === 1 && row.stops[0] === row.value), {start, right, end, home, wrap});
    check('ArrowRight skips the disabled segment', right.value === 'c' && right.focused === 'c', right);
    check('End and Home', end.value === 'd' && home.value === 'a', {end, home});
    check('ArrowLeft wraps to the last', wrap.value === 'd' && wrap.focused === 'd' && wrap.ring, wrap);
    check('change fires once per move', JSON.stringify(changes) === JSON.stringify(['c', 'd', 'a', 'd']), {changes});
    await page.close();
  }

  // 6. Reduced motion, right to left, forced colours.
  {
    const page = await open({reducedMotion: 'reduce', body: `<div dir="rtl"><sf-button-group id="r" appearance="segmented" aria-label="Тема" value="a" ${items([{value: 'a', label: 'Первый'}, {value: 'b', label: 'Второй'}])}></sf-button-group></div>`});
    // The probe's own reset turns transitions off everywhere; read the sheet's rule instead.
    const motion = await page.evaluate(() => {
      document.head.querySelector('style').remove();
      const buttons = [...document.querySelectorAll('#r button')];
      return {duration: getComputedStyle(buttons[0]).transitionDuration, firstRight: buttons[0].getBoundingClientRect().left > buttons[1].getBoundingClientRect().left};
    });
    evidence.motion = motion;
    check('reduced motion: no transition', motion.duration.split(',').every((value) => parseFloat(value) === 0), motion);
    check('right to left: the first segment stands at the start', motion.firstRight, motion);
    await page.close();
    const forced = await open({forcedColors: 'active', body: `<sf-button-group id="f" appearance="segmented" aria-label="Тема" value="a" ${items([{value: 'a', label: 'Первый'}, {value: 'b', label: 'Второй'}])}></sf-button-group>`});
    const colors = await forced.evaluate(() => [...document.querySelectorAll('#f button')].map((node) => getComputedStyle(node).backgroundColor));
    evidence.forcedColors = colors;
    check('forced colours: the selected plate still differs', colors[0] !== colors[1], {colors});
    await forced.close();
  }

  // 7. radius: the track takes it, the plate stays concentric.
  {
    const RADII = ['', 'default', 'square', 'rounded'];
    const body = ['1', '3'].flatMap((size) => RADII.map((radius) => `<div style="margin-block-end:8px"><sf-button-group appearance="segmented" size="${size}" ${radius ? `radius="${radius}"` : ''} data-size="${size}" data-radius="${radius || 'none'}" aria-label="Период" value="all" ${items(THREE)}></sf-button-group></div>`)).join('')
      + `<div style="--sf-button-group-radius:10px"><sf-button-group id="var" appearance="segmented" aria-label="Период" value="all" ${items(THREE)}></sf-button-group></div>`
      + `<div style="--sf-button-group-radius:10px"><sf-button-group id="var-square" appearance="segmented" radius="square" aria-label="Период" value="all" ${items(THREE)}></sf-button-group></div>`
      + `<sf-button-group id="joined" radius="rounded" aria-label="Период" value="all" ${items(THREE)}></sf-button-group>`;
    const page = await open({body});
    const rows = await page.evaluate(() => {
      const read = (host) => {
        const root = host.querySelector('.sf-button-group');
        const plate = root.querySelector('button.active');
        const style = getComputedStyle(root);
        return {
          size: host.dataset.size, radius: host.dataset.radius ?? host.id,
          track: parseFloat(style.borderTopLeftRadius), trackHeight: root.getBoundingClientRect().height,
          plate: parseFloat(getComputedStyle(plate).borderTopLeftRadius), plateHeight: plate.getBoundingClientRect().height,
          padding: parseFloat(style.paddingTop),
        };
      };
      const probe = document.createElement('div');
      probe.style.borderTopLeftRadius = 'var(--sf-radius--surface)';
      document.body.append(probe);
      const named = parseFloat(getComputedStyle(probe).borderTopLeftRadius);
      probe.remove();
      const joined = [...document.querySelectorAll('#joined .sf-button-group > sf-button > .sf-button')].map((node) => {
        const style = getComputedStyle(node);
        return {start: parseFloat(style.borderStartStartRadius), end: parseFloat(style.borderStartEndRadius), height: node.getBoundingClientRect().height};
      });
      return {
        rows: [...document.querySelectorAll('sf-button-group[data-radius]')].map(read),
        variable: read(document.getElementById('var')), variableSquare: read(document.getElementById('var-square')),
        named, joined,
      };
    });
    evidence.radius = rows;
    const concentric = (row) => Math.abs(row.plate - Math.max(0, row.track - row.padding)) < 0.01;
    for (const row of rows.rows) {
      check(`radius ${row.radius} size ${row.size}: the plate is the track's radius minus the padding`, concentric(row), row);
      if (row.radius === 'none') check(`radius none size ${row.size}: the track adds the padding to the button's radius`, row.plate > 0 && Math.abs(row.track - row.plate - row.padding) < 0.01, row);
      if (row.radius === 'default') check(`radius default size ${row.size}: the track takes the surface radius`, Math.abs(row.track - rows.named) < 0.01, {row, named: rows.named});
      if (row.radius === 'square') check(`radius square size ${row.size}: track and plate are square`, row.track === 0 && row.plate === 0, row);
      if (row.radius === 'rounded') check(`radius rounded size ${row.size}: track and plate are pills`, row.track >= row.trackHeight / 2 && row.plate >= row.plateHeight / 2, row);
    }
    check('--sf-button-group-radius sets the track, the plate follows', rows.variable.track === 10 && concentric(rows.variable), rows.variable);
    check('the radius attribute wins over --sf-button-group-radius', rows.variableSquare.track === 0 && rows.variableSquare.plate === 0, rows.variableSquare);
    const [first, middle, last] = rows.joined;
    check('a joined group with radius rounded rounds its outer corners, not its joins',
      first.start >= first.height / 2 && first.end === 0 && middle.start === 0 && middle.end === 0 && last.start === 0 && last.end >= last.height / 2, rows.joined);
    await page.close();
  }

  // 8. A named group is a form field.
  {
    const PERIOD = [{value: 'd', label: 'День'}, {value: 'w', label: 'Неделя'}, {value: 'm', label: 'Месяц'}];
    const page = await open({body: `<form id="form">
      <sf-button-group id="period" appearance="segmented" name="period" value="w" aria-label="Период" ${items(PERIOD)}></sf-button-group>
      <sf-button-group id="off" appearance="segmented" name="off" value="d" disabled aria-label="Выключено" ${items(PERIOD)}></sf-button-group>
      <sf-button-group id="nameless" appearance="segmented" value="d" aria-label="Без имени" ${items(PERIOD)}></sf-button-group>
      <button id="send" type="submit">Отправить</button>
    </form>`});
    await page.evaluate(() => {
      window.__payloads = [];
      document.getElementById('form').addEventListener('submit', (event) => {
        event.preventDefault();
        window.__payloads.push([...new FormData(event.target)]);
      });
    });
    const submit = async () => {
      await page.click('#send');
      return page.evaluate(() => window.__payloads.at(-1));
    };
    const initial = await submit();
    await page.locator('#period').getByRole('radio', {name: 'Месяц', exact: true}).click();
    await page.waitForTimeout(150);
    const chosen = await submit();
    await page.evaluate(() => document.getElementById('form').reset());
    await page.waitForTimeout(150);
    const reset = await page.evaluate(() => ({value: document.getElementById('period').value, checked: document.querySelector('#period button[aria-checked="true"]')?.dataset.sfButtonGroupValue}));
    const afterReset = await submit();
    await page.evaluate(() => document.getElementById('off').removeAttribute('disabled'));
    await page.waitForTimeout(150);
    const enabled = await submit();
    evidence.form = {initial, chosen, reset, afterReset, enabled};
    check('the form submits name=value', JSON.stringify(initial) === JSON.stringify([['period', 'w']]), {initial});
    check('a choice is submitted', JSON.stringify(chosen) === JSON.stringify([['period', 'm']]), {chosen});
    check('a reset brings back the written value', reset.value === 'w' && reset.checked === 'w' && JSON.stringify(afterReset) === JSON.stringify([['period', 'w']]), {reset, afterReset});
    check('a disabled group is left out, and joins once enabled', JSON.stringify(enabled) === JSON.stringify([['period', 'w'], ['off', 'd']]), {enabled});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_GROUP_SEGMENTED_OK');
