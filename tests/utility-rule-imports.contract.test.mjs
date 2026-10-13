import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const src = fileURLToPath(new URL('../src/', import.meta.url));
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});

test('every Utility rule is imported into executable Core, not only JSON metadata', () => {
  const core = path.join(src, 'core/js/rule.src.js');
  const imports = [...fs.readFileSync(core, 'utf8').matchAll(/^import\s+['"]([^'"]+)['"]/gm)]
    .map(([, name]) => path.resolve(path.dirname(core), name));
  const expected = walk(path.join(src, 'utility')).filter(name => name.endsWith('/rule.js'));
  assert.ok(expected.length > 0);
  for (const name of expected) assert.equal(imports.filter(item => item === name).length, 1, path.relative(src, name));
  for (const name of imports.filter(name => name.includes('/utility/')))
    assert.ok(fs.existsSync(name), `Missing imported rule: ${name}`);
});
