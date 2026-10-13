import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../src/core/js/loader.js', import.meta.url),
  'utf8',
);
const assignment = 'SFLoaderPlugin.prototype.doesRuleMatchAttributes = function (';
const start = source.indexOf(assignment);
const end = source.indexOf('\n};', start) + 3;

test('Loader matches exact Utility rules against individual class tokens', () => {
  assert.ok(start >= 0 && end > start, 'attribute matcher source is missing');

  const context = {result: null};
  vm.createContext(context);
  vm.runInContext(
    `function SFLoaderPlugin() {}\n${source.slice(start, end)}\n` +
      `const loader = new SFLoaderPlugin();\n` +
      `result = {\n` +
      `  exact: loader.doesRuleMatchAttributes(/^(?:flex|grid)$/, 'class="toolbar flex gap-1"', 'toolbar flex gap-1'),\n` +
      `  exactInvalid: loader.doesRuleMatchAttributes(/^(?:flex|grid)$/, 'class="toolbar flex-invalid"', 'toolbar flex-invalid'),\n` +
      `  legacy: loader.doesRuleMatchAttributes(/content-main-/, 'class="content-main-between"', 'content-main-between'),\n` +
      `  globalFirst: loader.doesRuleMatchAttributes(/^flex$/g, 'class="flex"', 'flex'),\n` +
      `  globalSecond: loader.doesRuleMatchAttributes(/^flex$/g, 'class="flex"', 'flex'),\n` +
      `};`,
    context,
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.result)),
    {
      exact: true,
      exactInvalid: false,
      legacy: true,
      globalFirst: true,
      globalSecond: true,
    },
  );
});
