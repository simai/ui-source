import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

/* global URL, Event, setTimeout */

const source = await readFile(new URL('../src/component/quantity/js/_quantity.js', import.meta.url), 'utf8');
function setup(options = {}) {
  class Button { disabled = false; addEventListener() {} removeEventListener() {} }
  const listeners = new Map(), rootListeners = new Map(), resets = [];
  const rootClasses = new Set();
  const buttons = [new Button(), new Button()];
  const input = {value:'2', defaultValue:'2', min:'0', max:'10000', step:'1', disabled:false, readOnly:false,
    classList:{contains:()=>false},
    dataset:{locale:'en-US'}, ...options,
    addEventListener(type, cb) { listeners.set(type, cb); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  };
  const root = {dataset:{}, classList:{
      contains:name=>rootClasses.has(name),
      add:name=>rootClasses.add(name),
      remove:name=>rootClasses.delete(name),
      toggle(name,force){ if (force) rootClasses.add(name); else rootClasses.delete(name); },
    },
    querySelector: selector => selector === '.sf-quantity-wrap input' ? input : null,
    querySelectorAll: () => buttons,
    addEventListener(type,cb){ rootListeners.set(type,cb); },
    removeEventListener(type){ rootListeners.delete(type); },
    contains(node){ return node===input || buttons.includes(node); },
  };
  const observers = [];
  const context = vm.createContext({
    window:{setTimeout}, document:{activeElement:null}, navigator:{language:'en-US'}, HTMLButtonElement:Button, Event,
    syncFieldContract() {}, retireFieldSizeClass() {},
    bindFormReset(control, callback) { assert.equal(control,input); resets.push(callback); return () => resets.splice(resets.indexOf(callback),1); },
    MutationObserver:class { constructor(callback) { this.callback=callback; this.disconnected=false; observers.push(this); } observe() {} disconnect() { this.disconnected=true; } },
  });
  vm.runInContext(source.slice(source.indexOf('const QUANTITY_SELECTOR'), source.indexOf('\nclass Quantity')), context);
  return {context, root, input, buttons, resets, observers, rootClasses, rootListeners};
}

test('readonly blocks button mutations and disabled state follows live native attributes', () => {
  const e=setup({readOnly:true}); e.context.bindQuantity(e.root);
  assert.ok(e.buttons.every(b=>b.disabled));
  e.context.adjustValue(e.root,1); assert.equal(e.input.value,'2');
  e.input.readOnly=false; e.observers[0].callback(); assert.ok(e.buttons.every(b=>!b.disabled));
  e.input.disabled=true; e.observers[0].callback(); assert.ok(e.buttons.every(b=>b.disabled));
});
test('empty and intermediate input never resurrects stale numeric cache on blur', () => {
  const e=setup(); e.context.bindQuantity(e.root);
  for (const value of ['', '-', '.', '-.']) {
    e.input.dataset.allowNegative='true'; e.input.dataset.allowDecimal='true';
    e.input.dataset.rawValue='9'; e.input.value=value;
    e.input.dispatchEvent(new Event('input')); e.context.syncFormattedValue(e.root);
    assert.equal(e.input.value,value); assert.equal(e.input.dataset.rawValue,undefined);
  }
});
test('button-generated grouped change preserves raw numeric value', () => {
  const e=setup({value:'1234.5', dataset:{locale:'en-US',precision:'2'}}); e.context.bindQuantity(e.root);
  e.context.adjustValue(e.root,1);
  assert.equal(e.input.value,'1,235.50'); assert.equal(e.input.dataset.rawValue,'1235.5');
  e.context.adjustValue(e.root,1);
  assert.equal(e.input.value,'1,236.50'); assert.equal(e.input.dataset.rawValue,'1236.5');
});
test('reset reads native default instead of old raw cache and releases subscriptions', () => {
  const e=setup(); e.context.bindQuantity(e.root);
  e.context.adjustValue(e.root,5); e.input.value=e.input.defaultValue;
  assert.equal(e.resets.length,1); e.resets[0]();
  assert.equal(e.input.dataset.rawValue,'2'); e.context.adjustValue(e.root,1); assert.equal(e.input.value,'3');
  e.context.unbindQuantity(e.root); assert.equal(e.resets.length,0); assert.ok(e.observers[0].disconnected);
});
test('reset updates mask value and allows an empty default', () => {
  const e=setup(); e.context.bindQuantity(e.root);
  const mask = {typedValue:9, set value(v) { e.input.value=v; this.typedValue=Number(v); }};
  e.root.__sfQuantityMask=mask; e.input.value='2';
  assert.equal(e.resets.length,1); e.resets[0](); assert.equal(mask.typedValue,2);
  e.input.value=''; e.resets[0](); assert.equal(e.input.value,''); assert.equal(e.input.dataset.rawValue,undefined);
});
test('step precision includes a valid exponent and constructor stores defaultValue', () => {
  const e=setup();
  for (const [step, precision] of [['1e-3',3],['2.5e-2',3],['0.01',2],['1e2',0],['any',0]]) {
    assert.equal(e.context.inferPrecisionFromStep(step),precision);
  }
  assert.match(source,/input\.defaultValue = String\(initialValue\)/);
});

test('buttons follow numeric boundaries and do not emit a no-op change', () => {
  const e=setup({value:'0',min:'0',max:'2'}); e.context.bindQuantity(e.root);
  assert.equal(e.buttons[0].disabled,true); assert.equal(e.buttons[1].disabled,false);
  e.context.adjustValue(e.root,-1); assert.equal(e.input.value,'0');
  e.context.adjustValue(e.root,1); assert.equal(e.input.dataset.rawValue,'1');
  assert.equal(e.buttons[0].disabled,false); assert.equal(e.buttons[1].disabled,false);
  e.context.adjustValue(e.root,1); assert.equal(e.input.dataset.rawValue,'2');
  assert.equal(e.buttons[1].disabled,true);
});

test('blur clamps direct input to min and max without snapping to step', () => {
  const e=setup({value:'11',min:'1',max:'10',step:'3',dataset:{locale:'en-US',allowNegative:'true'}}); e.context.bindQuantity(e.root);
  assert.equal(e.input.value,'10');
  e.input.value='2'; e.input.dispatchEvent(new Event('input'));
  e.context.syncFormattedValue(e.root);
  assert.equal(e.input.value,'2');
  e.input.value='-5'; e.input.dispatchEvent(new Event('input'));
  e.context.syncFormattedValue(e.root);
  assert.equal(e.input.value,'1');
});

test('composite pointer focus is quiet and keyboard focus restores the ring contract', () => {
  const e=setup(); e.context.bindQuantity(e.root);
  e.rootListeners.get('pointerdown')();
  assert.ok(e.rootClasses.has('sf-quantity--pointer-focus'));
  e.rootListeners.get('keydown')();
  assert.ok(!e.rootClasses.has('sf-quantity--pointer-focus'));
  e.rootListeners.get('focusout')({relatedTarget:{}});
  assert.ok(!e.rootClasses.has('sf-quantity--pointer-focus'));
});

test('constructor bounds size and exposes native readonly plus localized button labels', () => {
  assert.match(source,/const normalizedSize = fieldSize\(size, 'sf-quantity'\);/);
  assert.match(source,/input\.readOnly = Boolean\(readonly\)/);
  assert.match(source,/minus\.setAttribute\('aria-label', String\(decrementLabel\)\)/);
  assert.match(source,/plus\.setAttribute\('aria-label', String\(incrementLabel\)\)/);
});

test('localized formatted numbers round-trip through user input without changing magnitude', () => {
  for (const locale of ['en-US', 'de-DE', 'fr-FR', 'ru-RU', 'en-IN', 'ar-EG', 'fa-IR', 'en-US-u-nu-mathbold']) {
    const e=setup({value:'-1234567.5', min:'', dataset:{locale,precision:'2',allowNegative:'true'}}); e.context.bindQuantity(e.root);
    const formatted = e.input.value;
    e.input.dispatchEvent(new Event('input'));
    assert.equal(e.input.dataset.rawValue, '-1234567.5', `${locale}: ${formatted}`);
    e.context.syncFormattedValue(e.root);
    assert.equal(e.input.value, formatted, locale);
  }
});

test('strict editing recognizes grouped numbers and rejects invalid combined paste', () => {
  const e=setup({value:'1234.5', dataset:{locale:'en-US',precision:'2',inputMode:'strict'}});
  e.context.bindQuantity(e.root);
  e.input.selectionStart=e.input.selectionEnd=e.input.value.length;
  let prevented=false;
  e.root.__sfQuantityBeforeInputHandler({inputType:'insertText',data:'1',preventDefault(){prevented=true;}});
  assert.equal(prevented,false,'valid edit of localized display');
  e.input.value='1.2'; e.input.selectionStart=e.input.selectionEnd=3;
  e.root.__sfQuantityPasteHandler({clipboardData:{getData:()=>'.3'},preventDefault(){}});
  assert.equal(e.input.value,'1.2','paste must validate whole resulting value');
  const german=setup({value:'0',dataset:{locale:'de-DE',precision:'3',inputMode:'strict'}});
  german.context.bindQuantity(german.root);
  german.input.selectionStart=0; german.input.selectionEnd=german.input.value.length;
  german.root.__sfQuantityPasteHandler({clipboardData:{getData:()=> '1,234'},preventDefault(){}});
  german.input.dispatchEvent(new Event('change'));
  assert.equal(german.input.dataset.rawValue,'1.234','canonical decimal must not become a group on change');
  assert.equal(german.input.value,'1,234');
});

test('numeric limits cannot throw or overflow finite input and negative steps do not reverse buttons', () => {
  const e=setup({value:'1e300',max:'',dataset:{locale:'invalid_locale',precision:'999'}});
  assert.doesNotThrow(()=>e.context.bindQuantity(e.root));
  assert.ok(Number.isFinite(Number(e.input.dataset.rawValue)));
  const negative=setup({step:'-1'}); negative.context.bindQuantity(negative.root);
  negative.context.adjustValue(negative.root,1);
  assert.equal(negative.input.dataset.rawValue,'3');
});
