import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
for (const [name, renderer] of [['button','renderButtonTemplate'], ['badge','renderBadgeTemplate']]) {
  const source = fs.readFileSync(new URL(`../src/smart/${name}/js/templates/default.js`, import.meta.url), 'utf8');
  const html = (parts, ...values) => parts.reduce((result, part, index) => result + part + (values[index] ?? ''), '');
  const render = vm.runInNewContext(source.replace(/^import .*;$/gm, '').replace('export function', 'function') + `\n${renderer};`, {html, nothing: ''});
  const component = {createIcon: name => name || '', hasSlotContent: () => false};
  const base = {component, text:'Label', size:'1', scheme:'primary', type:'default', iconLeft:'OLD_START', iconRight:'OLD_END'};
  test(`${name}: canonical icons win, including empty suppression, while absent properties preserve legacy`, () => {
    const canonical = render({...base, iconStart:'NEW_START', iconEnd:'NEW_END'});
    assert.match(canonical, /NEW_START/); assert.match(canonical, /NEW_END/);
    assert.doesNotMatch(canonical, /OLD_START|OLD_END/);
    const empty = render({...base, iconStart:'', iconEnd:'', icon:'GENERIC'});
    assert.doesNotMatch(empty, /OLD_START|OLD_END|GENERIC/);
    const legacy = render({...base, iconStart:null, iconEnd:null});
    assert.match(legacy, /OLD_START/); assert.match(legacy, /OLD_END/);
    assert.match(render({...base, iconLeft:'', iconRight:'', icon:'GENERIC'}), /GENERIC/);
  });
  test(`${name}: canonical slots take precedence without requiring a second rendered copy`, () => {
    const slots = {'icon-start':'START_SLOT', 'icon-end':'END_SLOT', 'icon-left':'OLD_SLOT_START', 'icon-right':'OLD_SLOT_END'};
    const output = render({...base, component:{...component, hasSlotContent: name => Object.hasOwn(slots,name), getSlotContent: name => slots[name]}});
    assert.match(output, /START_SLOT/); assert.match(output, /END_SLOT/);
    assert.doesNotMatch(output, /OLD_SLOT|OLD_START|OLD_END/);
    delete slots['icon-start']; delete slots['icon-end'];
    const legacy = render({...base, component:{...component, hasSlotContent: name => Object.hasOwn(slots,name), getSlotContent: name => slots[name]}});
    assert.match(legacy, /OLD_SLOT_START/); assert.match(legacy, /OLD_SLOT_END/);
  });
}
