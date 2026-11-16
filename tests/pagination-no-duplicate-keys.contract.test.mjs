import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {ESLint} from 'eslint';

// sf-pagination's template context listed twenty of its words twice: first
// through text(key, attribute), then through the getters. In an object
// literal the later key wins, so the first twenty lines were dead and eslint
// reported no-dupe-keys on every run of the lint. The getters stay (they read
// the attribute first, then the page language, as text() did).
test('sf-pagination index.js has no duplicate keys (eslint no-dupe-keys)', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const eslint = new ESLint({cwd: root});
  const [result] = await eslint.lintFiles(['src/smart/pagination/index.js']);
  const dupes = result.messages.filter((message) => message.ruleId === 'no-dupe-keys');
  assert.deepEqual(dupes.map((message) => `${message.line}: ${message.message}`), []);
});
