import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// Group build 18: a host's forward to its control sets values in place.
// Removing every forwarded name and setting it again moved each one behind
// what others had written on the control since (sf-tabs' semantics, the
// tooltip's aria-describedby), so the attribute order depended on who ran last
// (ui-control control/evidence/2026-11-23-gb18-tabs, VO-1 residual).
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const forwardBody = async () => {
  const base = await read('src/core/js/smart-base.js');
  const start = base.indexOf('  forwardHostAttributes(target, options = {}) {');
  assert.ok(start > 0, 'forwardHostAttributes is in smart-base');
  const end = base.indexOf('\n  }\n', start);
  return base.slice(start, end);
};

test('a forward removes only the names the host no longer gives', async () => {
  const body = await forwardBody();
  assert.match(body, /previous\.forEach\(\(name\) => \{\s*if \(!next\.has\(name\)\) \{\s*target\.removeAttribute\(name\);\s*\}\s*\}\);/u);
  assert.doesNotMatch(body, /previous\.forEach\(\(name\) => \{\s*target\.removeAttribute\(name\);\s*\}\);/u, 'no unconditional remove');
});

test('a forward writes a value only when it differs, and before nothing else writes', async () => {
  const body = await forwardBody();
  assert.match(body, /next\.forEach\(\(value, name\) => \{\s*if \(target\.getAttribute\(name\) !== value\) \{\s*target\.setAttribute\(name, value\);\s*\}\s*\}\);/u);
  // the host attributes and the record are collected first, then applied once
  const collect = body.indexOf('next.set(name, value);');
  const apply = body.indexOf('next.forEach((value, name)');
  const remove = body.indexOf('previous.forEach((name)');
  assert.ok(collect > 0 && remove > collect && apply > remove, 'collect, remove the gone, then set');
  assert.equal((body.match(/target\.setAttribute\(/gu) || []).length, 1, 'one place writes the control');
});

// The same steps run on a stand-in element: a second forward with nothing new
// keeps the order the control had, whoever wrote after the first one.
test('a repeated forward keeps the control\'s attribute order', () => {
  class El {
    constructor() { this.list = []; }
    getAttribute(n) { const a = this.list.find((x) => x[0] === n); return a ? a[1] : null; }
    setAttribute(n, v) { const a = this.list.find((x) => x[0] === n); if (a) a[1] = v; else this.list.push([n, v]); }
    removeAttribute(n) { this.list = this.list.filter((x) => x[0] !== n); }
    names() { return this.list.map((x) => x[0]).join(' '); }
  }
  const forward = (target, next, previous) => {
    previous.forEach((name) => { if (!next.has(name)) target.removeAttribute(name); });
    next.forEach((value, name) => { if (target.getAttribute(name) !== value) target.setAttribute(name, value); });
    return new Set(next.keys());
  };
  const button = new El();
  let keys = forward(button, new Map([['data-tooltip', 'Подсказка'], ['data-sf-tab-index', '2']]), new Set());
  button.setAttribute('aria-describedby', 'tip-1');
  const before = button.names();
  keys = forward(button, new Map([['data-tooltip', 'Подсказка'], ['data-sf-tab-index', '2']]), keys);
  assert.equal(button.names(), before);
  keys = forward(button, new Map([['data-tooltip', 'Другая'], ['data-sf-tab-index', '2']]), keys);
  assert.equal(button.names(), before, 'a changed value stays where it was');
  assert.equal(button.getAttribute('data-tooltip'), 'Другая');
  forward(button, new Map([['data-sf-tab-index', '2'], ['data-probe', '1']]), keys);
  assert.equal(button.names(), 'data-sf-tab-index aria-describedby data-probe', 'a gone name leaves, a new one is appended');
});
