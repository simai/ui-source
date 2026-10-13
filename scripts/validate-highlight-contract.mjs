import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [runtime, languages, lines, theme, defaults] = await Promise.all([
  readFile(new URL('../src/component/highlight/js/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/component/highlight/js/languages.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/component/highlight/js/line_numbers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/component/highlight/scss/_theme.scss', import.meta.url), 'utf8'),
  readFile(new URL('../src/component/highlight/scss/_default.scss', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(runtime, /from ['"]highlight\.js|require\(['"]highlight\.js/);
assert.match(runtime, /function escapeHtml/);
assert.match(runtime, /function highlightSource/);
assert.match(runtime, /highlightState/);
assert.match(runtime, /MutationObserver/);
assert.match(languages, /plaintext/);
assert.match(languages, /javascript/);
assert.match(lines, /sf-code-line__number/);
assert.match(theme, /--sf-highlight-background:\s*transparent/);
assert.match(defaults, /sf-code-surface/);

process.stdout.write(`${JSON.stringify({status: 'PASS', runtime: 'project-owned', externalRuntimeDependencies: 0})}\n`);
