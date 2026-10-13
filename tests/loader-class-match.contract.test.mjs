import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';
import vm from 'node:vm';

/* A loader rule decides from the markup whether a component's script and
   styles load. The tree and tree-item rules matched a class only after
   whitespace or "^" -- and without the m flag "^" is the start of the whole
   document, not of the attribute. class="sf-tree" or class="sf-tree flex", the
   way the documentation and most markup write it, never matched: the tree's
   script did not load, so no group roles, no aria-expanded, no keyboard. It was
   like that from the day the rule was written. */
const SRC = new URL('../src/', import.meta.url);

async function rules(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) out.push(...await rules(next));
    else if (entry.name === 'rule.js') out.push(next);
  }
  return out;
}

function load(source) {
  const sandbox = {SF: {RuleLoader: {}}};
  vm.runInNewContext(source, sandbox);
  return sandbox.SF.RuleLoader;
}

test('loader: no rule anchors a class on "^" inside an attribute value', async () => {
  const offenders = [];
  for (const url of await rules(SRC)) {
    const source = await readFile(url, 'utf8');
    if (/\[\^"'\]\*\(\?:\^\|\\s\)/.test(source)) offenders.push(url.pathname.slice(url.pathname.indexOf('/src/') + 5));
  }
  assert.deepEqual(offenders, []);
});

test('loader: the tree rules match their class wherever it stands in the attribute', async () => {
  for (const [file, name, cls] of [['component/tree/rule.js', 'tree', 'sf-tree'], ['component/tree-item/rule.js', 'tree-item', 'sf-tree-item']]) {
    const rule = load(await readFile(new URL(file, SRC), 'utf8'))[name];
    for (const markup of [`<div class="${cls}">`, `<div class="${cls} flex">`, `<div class="flex ${cls}">`, `<div class='flex ${cls} gap-1'>`]) {
      assert.ok(rule.regex.test(markup), `${name}: ${markup}`);
    }
  }
  const tree = load(await readFile(new URL('component/tree/rule.js', SRC), 'utf8')).tree;
  assert.ok(!tree.regex.test('<div class="sf-tree-item">'), 'tree must not claim a lone tree item');
});
