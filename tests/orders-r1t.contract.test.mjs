// View round 1, table group orders (ui-control control/evidence/2026-11-17-view-r1-table):
// SF.Sortable.attach's row mode (D1, row reorder) and SF.menu.open's end
// alignment. The browser half is the probe in
// control/evidence/2026-11-17-orders-r1t/probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// A page with just enough of a document for SF.menu.open to reach the menu.
function fakePage() {
  const calls = [];
  const element = (tag) => ({
    tag, attributes: {}, children: [], parentNode: null, isOpen: false, style: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    hasAttribute(name) { return name in this.attributes; },
    addEventListener() {}, closest() { return null; }, append(child) { child.parentNode = this; },
    openFor(anchor, options) { calls.push({how: 'openFor', options}); return Promise.resolve({outcome: 'refused'}); },
    openAt(x, y, options) { calls.push({how: 'openAt', options}); return Promise.resolve({outcome: 'refused'}); },
  });
  const body = element('body');
  let menu = null;
  globalThis.Element = function Element() {};
  globalThis.document = {
    body, documentElement: element('html'),
    querySelector: () => menu,
    createElement: (tag) => { const made = element(tag); if (tag === 'sf-menu-context') menu = made; return made; },
  };
  globalThis.customElements = { get: () => true };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.SF = {};
  return calls;
}

test('SF.menu.open lines the menu up with the end edge when asked, start otherwise', async () => {
  const calls = fakePage();
  const { menuOpen } = await import('../src/core/js/menu-open.js');
  const anchor = Object.assign(Object.create(globalThis.Element.prototype), {
    closest: () => null, getAttribute: () => null, hasAttribute: () => false, parentElement: null, isConnected: true,
  });
  await menuOpen({ anchor, entries: [{ id: 'a', text: 'A' }], align: 'end' });
  await menuOpen({ anchor, entries: [{ id: 'a', text: 'A' }] });
  await menuOpen({ anchor, entries: [{ id: 'a', text: 'A' }], align: 'right' });
  await menuOpen({ x: 10, y: 20, entries: [{ id: 'a', text: 'A' }], align: 'end' });
  assert.deepEqual(calls.map((call) => `${call.how}:${call.options.align}`), ['openFor:end', 'openFor:start', 'openFor:start', 'openAt:end']);
  // Flip and shift are the menu's own (position.anchor): the end alignment keeps them.
  assert.match(read('src/smart/menu-context/index.js'), /side, align, alignmentOffset, flip: true, shift: true, fitHeight: true/);
  // Start and end are logical: a right-to-left page mirrors them.
  assert.match(read('src/core/js/position.js'), /placement: physicalPlacement\(settings\.side, settings\.align, rtl\)/);
  const api = JSON.parse(read('src/core/contracts/public-js-api.json'));
  const entry = api.entries ? api.entries.find((item) => item.name === 'SF.menu') : JSON.stringify(api);
  assert.match(JSON.stringify(entry), /returnTo, align\}\)/);
});

test('SF.Sortable.attach has a row mode with the column mode left as it was', () => {
  const core = read('src/core/js/composition/sortable.mjs');
  assert.match(core, /const vertical = options\.orientation === 'vertical';/);
  // One 2 px line across the extent by default for rows (C171 (4)); the outline for columns.
  assert.match(core, /options\.preview : \(vertical \? 'line' : 'column'\)/);
  assert.match(core, /\? \{left: `\$\{extent\.left\}px`, top: `\$\{at\}px`, width: `\$\{extent\.width\}px`, height: `\$\{length\}px`\}/);
  // A finger takes a row without a handle after a long press (C171 (2)).
  assert.match(core, /const longPress = vertical && !handle && event\.pointerType === 'touch';/);
  // sf-sortable's keys, said in the live region, the keys named through aria-describedby.
  assert.match(core, /const keyboard = vertical && options\.keyboard !== false;/);
  assert.match(core, /say\(format\(messages\(\)\.picked, /);
  assert.match(core, /say\(format\(messages\(\)\.moved, /);
  assert.match(core, /item\.setAttribute\('aria-describedby', \[\.\.\.described, help\.id\]\.join\(' '\)\)/);
  // The column mode stays quiet: state events in the row mode only.
  assert.equal((core.match(/if \(vertical\) container\.dispatchEvent/g) || []).length, 2);
  const menu = read('src/core/js/composition/sortable-move-menu.mjs');
  // The handle's menu is the page's one menu, with the C171 (1) rows.
  assert.match(menu, /const choice = await menuOpen\(\{\n\s*anchor: control,\n\s*entries: moveMenuEntries\(index, peers\.length\),/);
  assert.match(menu, /detach\.move\(found\.item, moveMenuTarget\(id, from, now\.length\)\)/);
  const entry = read('src/smart/sortable/index.js');
  assert.match(entry, /attach: attachSortableWithMenu, attachSortable: attachSortableWithMenu/);
});
