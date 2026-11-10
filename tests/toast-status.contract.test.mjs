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

test('the status colour reaches the toast own icon only (C35 acceptance A-F1)', () => {
  const css = readFileSync(new URL('../src/component/toast/scss/_css__toast.scss', import.meta.url), 'utf8');
  for (const status of ['success', 'warning', 'error']) {
    assert.match(css, new RegExp(`\\.sf-toast\\.sf-toast--${status} > \\.sf-icon,\\s*\\.sf-toast\\.sf-toast--${status} > sf-icon > \\.sf-icon\\s*\\{\\s*--sf-icon--color: var\\(--sf-${status}\\)`));
  }
  // No descendant rule colours an icon inside an action button.
  assert.doesNotMatch(css, /\.sf-toast[^{,>]* \.sf-icon\s*\{[^}]*--sf-icon--color/);
  assert.doesNotMatch(css, /\.sf-toast \.sf-icon\s*\{[^}]*\bcolor:/);
});

test('the neutral toast icon is the theme quiet ink, not its popup place role (C35 x C43)', () => {
  const css = readFileSync(new URL('../src/component/toast/scss/_css__toast.scss', import.meta.url), 'utf8');
  const at = css.indexOf('.sf-toast:is(.sf-toast--neutral, .sf-toast--default) > sf-icon > .sf-icon {');
  assert.ok(at > 0, 'the neutral icon rule');
  const declaration = css.slice(at).split('\n')[1].trim();
  assert.equal(declaration, "--sf-icon--color: #{string.unquote(map.get(places.$sf-place-theme-roles, 'on-surface-container-variant'))};");
});
