// GB17 L3: the Loader appends its scripts after the sheets asked for in the
// same task, so on an HTTP/1.1 origin (six connections) the first paint's
// sheets are not queued behind the scripts (the drawer and the site header
// drew no frame before their code in the first-paint gate, which holds every
// component script 400 ms).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const loader = readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');

test('insertScript appends through the microtask queue, in order', () => {
  const start = loader.indexOf('SFLoaderPlugin.prototype.insertScript = function');
  const end = loader.indexOf('function queueScriptInsert(insert)');
  assert.ok(start > 0 && end > start);
  const body = loader.slice(start, end);
  assert.match(body, /queueScriptInsert\(\(\) => \{[\s\S]*?head\.append\(script\);\n\s+\}\);/u);
  assert.doesNotMatch(body.replace(/queueScriptInsert\(\(\) => \{[\s\S]*?\}\);/u, ''), /head\.append\(script\)/u);
  const queue = loader.slice(end, end + 400);
  assert.match(queue, /scriptInserts\.push\(insert\);/u);
  assert.match(queue, /queueMicrotask\(\(\) => \{\n\s+while \(scriptInserts\.length\) scriptInserts\.shift\(\)\(\);/u);
});
