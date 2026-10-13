import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// SF.Toast.show took only default/primary/success/warning/error and drew the
// shared status words neutral and info as default.

const source = readFileSync(new URL('../src/component/toast/js/_toast.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('const TOAST_TYPES'), source.indexOf('function readDuration')), context);

test('the toast takes the shared status words and maps the old ones onto them', () => {
  const normalize = vm.runInContext('normalizeType', context);
  for (const status of ['neutral', 'info', 'success', 'warning', 'error']) assert.equal(normalize(status), status);
  assert.equal(normalize('default'), 'neutral');
  assert.equal(normalize('primary'), 'info');
  assert.equal(normalize('anything'), 'neutral');
});

test('every status has its styles', () => {
  const css = readFileSync(new URL('../src/component/toast/scss/_css__toast.scss', import.meta.url), 'utf8');
  for (const status of ['neutral', 'info', 'success', 'warning', 'error']) assert.match(css, new RegExp(`sf-toast--${status}\\b`, 'u'), status);
});
