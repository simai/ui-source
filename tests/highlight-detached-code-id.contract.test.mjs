// A code block highlighted before it is placed (ui-control evidence
// 2026-11-18-pro-over-1ed6: sf-chat-message enhances an answer's code before it
// puts the answer on the page). ensureCodeId asked the document for the block
// itself, which a detached block never is, and looped for ever (100 % CPU).
// The id is now taken when it is free: in the document and in the detached
// tree the block stands in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const runtime = readFileSync(new URL('../src/component/highlight/js/index.js', import.meta.url), 'utf8');
const start = runtime.indexOf('function idTaken(');
const end = runtime.indexOf('\n}\n', runtime.indexOf('function ensureCodeId(')) + 3;
assert.ok(start > 0 && end > start, 'idTaken and ensureCodeId are in the runtime');
const source = `let codeId = 0;\n${runtime.slice(start, end)}\nthis.ensureCodeId = ensureCodeId;`;

const load = () => {
  const sandbox = {};
  vm.runInNewContext(source, sandbox);
  return sandbox.ensureCodeId;
};

// A document whose getElementById answers from `placed` and refuses to be
// asked more than `limit` times: the old loop fails here instead of hanging.
function fakeDocument(placed = new Map(), limit = 1000) {
  let asked = 0;
  return {
    getElementById(id) {
      asked += 1;
      if (asked > limit) throw new Error('getElementById asked over and over: the loop does not end');
      return placed.get(id) ?? null;
    },
    get asked() { return asked; },
  };
}

function fakeElement(doc, {id = '', children = []} = {}) {
  const element = {
    id,
    ownerDocument: doc,
    parent: null,
    getRootNode() {
      let node = this;
      while (node.parent) node = node.parent;
      return node;
    },
    querySelector(selector) {
      const wanted = /^\[id="(.+)"\]$/u.exec(selector)?.[1];
      const walk = (node) => {
        for (const child of node.children) {
          if (child.id === wanted) return child;
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
    children,
  };
  for (const child of children) child.parent = element;
  return element;
}

test('a detached block gets an id and the loop ends', () => {
  const ensureCodeId = load();
  const doc = fakeDocument();
  const block = fakeElement(doc);
  const pre = fakeElement(doc, {children: [block]});
  assert.equal(pre.getRootNode(), pre);
  assert.equal(ensureCodeId(block), 'sf-highlight-code-1');
  assert.equal(block.id, 'sf-highlight-code-1');
  assert.ok(doc.asked < 5, `asked ${doc.asked} times`);
});

test('a detached block skips an id the page or its own tree already holds', () => {
  const ensureCodeId = load();
  const other = {id: 'sf-highlight-code-1'};
  const doc = fakeDocument(new Map([['sf-highlight-code-1', other]]));
  const sibling = fakeElement(doc, {id: 'sf-highlight-code-2'});
  const block = fakeElement(doc);
  fakeElement(doc, {children: [sibling, block]});
  assert.equal(ensureCodeId(block), 'sf-highlight-code-3');
});

test('a placed block keeps the old answer, and an id it has is kept', () => {
  const ensureCodeId = load();
  const placed = new Map();
  const doc = fakeDocument(placed);
  const block = fakeElement(doc);
  block.getRootNode = () => doc;
  placed.set('sf-highlight-code-1', {id: 'sf-highlight-code-1'});
  assert.equal(ensureCodeId(block), 'sf-highlight-code-2');
  const named = fakeElement(doc, {id: 'given'});
  assert.equal(ensureCodeId(named), 'given');
});
