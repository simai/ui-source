import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../src/component/', import.meta.url));
function walk(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.scss') ? [file] : [];
  });
}

// This bounded gate covers literal one-pixel borders only, not the complete
// token-only policy. Bundled Fancybox is a separate third-party migration scope.
test('owned component one-pixel borders reference the system primitive', () => {
  const failures = [];
  let declarations = 0;
  for (const file of walk(root)) {
    if (path.relative(root, file).startsWith(`fancybox${path.sep}`)) continue;
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const match of source.matchAll(/(?:^|[;{}\n])\s*((?:--[\w-]*border[\w-]*|border[\w-]*))\s*:\s*([^;{}]+);/g)) {
      declarations++;
      if (/(?<![\w.-])1px\b/.test(match[2])) failures.push(`${path.relative(root, file)}: ${match[1]}: ${match[2]}`);
    }
  }
  assert.ok(declarations > 100, 'must inspect the real component perimeter declarations');
  assert.deepEqual(failures, []);
});
