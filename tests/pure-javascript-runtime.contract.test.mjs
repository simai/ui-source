import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function exists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

test('Framework 4 vendor code is absent from the current source tree', async () => {
  for (const path of [
    'loader/',
    'src/component/jquery/',
    'src/component/fancybox/',
    'src/component/waves/',
    'src/component/monaco/',
    'src/component/theme-builder/',
    'src/core/js/loader_old.js',
    'src/cl/component_loader_back.js',
  ]) {
    assert.equal(await exists(path), false, `${path} must not be active source`);
  }

  assert.equal(await exists('legacy/'), false, 'legacy source must remain only in immutable release history');
});

test('developer editor dependencies stay outside Framework source', async () => {
  const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const register = await readFile(new URL('src/component/register.js', root), 'utf8');
  const rules = await readFile(new URL('src/core/js/rule.src.js', root), 'utf8');

  assert.equal(packageJson.dependencies?.['monaco-editor'], undefined);
  assert.equal(packageJson.dependencies?.['@material/material-color-utilities'], undefined);
  assert.equal(packageJson.dependencies?.['vanilla-picker'], undefined);
  assert.equal(packageJson.dependencies?.colorthief, undefined);
  assert.doesNotMatch(register, /monaco/u);
  assert.doesNotMatch(rules, /component\/monaco/u);
});

test('JavaScript Loader does not call the retired PHP Loader', async () => {
  const loader = await readFile(new URL('src/core/js/loader.js', root), 'utf8');

  assert.doesNotMatch(loader, /\/simai\/loader\/(?:loader|templateLoader)\.php/);
  assert.match(loader, /this\.standAlone = true;/);
});
