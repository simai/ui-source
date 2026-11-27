#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.5 interactive, on the built core: an effect whose manifest
// says interactive: true takes pointer events in its own layer
// ([data-sf-effect-layer] pointer-events auto); one that does not keeps
// pointer-events none, as every effect before 1.5 (GB20, Docara's hero live
// scene, msg-e1b4fbe2). Checked with real input -- the mouse, the wheel and a
// touch through the DevTools protocol -- at a free point of each area:
// - the interactive effect's canvas hears pointerover/pointermove (hover),
//   pointerdown/click (press), wheel and a touch pointerdown; the area's own
//   content over it (a button) still takes its press, the effect does not;
// - the default effect's canvas hears nothing: every event lands on the area;
// - the interactive layer adds nothing to the tab order (no tabindex, aria-
//   hidden kept);
// - destroy gives the layer back none; a manifest with interactive other than
//   a boolean is refused by checkEffectManifest.
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};

const area = (id, effect) => `<section id="${id}" data-sf-effect="${effect}" style="display:block;inline-size:480px;block-size:200px;padding:16px;box-sizing:border-box;margin-block-end:16px">
  <button id="${id}-button" type="button">Button</button>
</section>`;
const body = area('live', 'touch-bands') + area('still', 'sample-bands');
// Every event, as each target hears it: the canvas of each effect and each area.
const head = `<script>window.__heard = [];
for (const type of ['pointerover', 'pointermove', 'pointerdown', 'click', 'wheel']) addEventListener(type, (event) => {
  const layer = event.target.closest?.('[data-sf-effect-layer]');
  const where = layer ? 'effect:' + layer.parentElement.id : (event.target.id || event.target.localName);
  window.__heard.push(type + (event.pointerType ? '/' + event.pointerType : '') + '@' + where);
}, true);</script>`;

const browser = await chromium.launch();
try {
  const {page, errors} = await openPage(browser, out, {theme: 'theme-light', body, head});
  await page.waitForFunction(() => ['live', 'still'].every((id) => document.getElementById(id).getAttribute('data-sf-effect-state') === 'running'
    && document.querySelector(`#${id} [data-sf-effect-layer] canvas`)), null, {timeout: 20000});
  const layerStyle = (id) => page.evaluate((id) => {
    const layer = document.querySelector(`#${id} [data-sf-effect-layer]`);
    return {pointer: getComputedStyle(layer).pointerEvents, hidden: layer.getAttribute('aria-hidden'), tabindex: layer.getAttribute('tabindex')};
  }, id);
  expect('interactive: the layer takes pointer events', await layerStyle('live'), {pointer: 'auto', hidden: 'true', tabindex: null});
  expect('default: the layer takes none', await layerStyle('still'), {pointer: 'none', hidden: 'true', tabindex: null});

  const corner = (id) => page.evaluate((id) => {
    const box = document.getElementById(id).getBoundingClientRect();
    return {x: Math.round(box.right - 24), y: Math.round(box.bottom - 24)};
  }, id);
  const centreOf = (selector) => page.evaluate((selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return {x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2)};
  }, selector);
  const heard = async (act) => {
    await page.evaluate(() => { window.__heard = []; });
    await act();
    await page.waitForTimeout(120);
    return page.evaluate(() => [...new Set(window.__heard)]);
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1});
  const touch = async ({x, y}) => {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  };

  for (const [id, mine] of [['live', true], ['still', false]]) {
    const at = await corner(id);
    const where = mine ? `effect:${id}` : id;
    await page.mouse.move(at.x - 40, at.y - 40);
    const hover = await heard(() => page.mouse.move(at.x, at.y, {steps: 4}));
    expect(`${id}: hover reaches ${where}`, hover.filter((x) => x.startsWith('pointermove/mouse')), [`pointermove/mouse@${where}`]);
    const press = await heard(() => page.mouse.click(at.x, at.y));
    expect(`${id}: press and click reach ${where}`, press.filter((x) => /^(pointerdown|click)/u.test(x)), [`pointerdown/mouse@${where}`, `click/mouse@${where}`]);
    const wheel = await heard(() => page.mouse.wheel(0, 40));
    expect(`${id}: the wheel reaches ${where}`, wheel.filter((x) => x.startsWith('wheel')), [`wheel/mouse@${where}`]);
    const tapped = await heard(() => touch(at));
    expect(`${id}: a touch reaches ${where}`, tapped.filter((x) => x.startsWith('pointerdown')), [`pointerdown/touch@${where}`]);
    // Content over the effect keeps its own press.
    const button = await heard(async () => { const c = await centreOf(`#${id}-button`); await page.mouse.click(c.x, c.y); });
    expect(`${id}: the button over the effect takes its press`, button.filter((x) => x.startsWith('click')), [`click/mouse@${id}-button`]);
  }

  // Tab goes button to button: the layer is not in the tab order.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press('Tab');
  const second = await page.evaluate(() => document.activeElement?.id);
  expect('the tab order is the buttons only', [first, second], ['live-button', 'still-button']);

  // destroy gives the layer back none; a bad flag is refused.
  const after = await page.evaluate(async () => {
    const {checkEffectManifest, mountEffect} = window.SF.Effects;
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inline-size:40px;block-size:40px';
    document.body.append(host);
    const manifest = {schema: 'simai.effect', schema_version: 1, id: 'probe-touch', version: '1.0.0', label: {en: 'probe'}, entry: 'index.js', surfaces: ['hero'], settings: [], needs: {network: false}, interactive: true};
    const handle = mountEffect(host, {manifest, module: {mount: () => ({})}});
    const during = host.style.pointerEvents;
    handle.destroy();
    const refused = checkEffectManifest({...manifest, interactive: 'yes'});
    const plain = mountEffect(host, {manifest: {...manifest, interactive: false}, module: {mount: () => ({})}});
    const off = host.style.pointerEvents;
    plain.destroy();
    host.remove();
    return {during, afterDestroy: '' + host.style.pointerEvents, refused, off};
  });
  expect('mountEffect: interactive host, none after destroy, a non-boolean refused, false is none', after,
    {during: 'auto', afterDestroy: 'none', refused: ['interactive: true or false'], off: 'none'});
  if (errors.length) failures.push({case: 'no page errors', got: errors});
  await page.context().close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_INTERACTIVE_OK');
