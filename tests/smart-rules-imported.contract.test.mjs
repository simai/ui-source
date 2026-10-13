// Every Smart component's rule is registered when Core starts.
//
// A Smart component has two lists to be in: the generated rule list
// (distr/rule/rule.json), which tools read, and the imports in
// src/core/js/rule.src.js, which put the rule into SF.RuleLoader on the page.
// The Loader only knows a tag through the second, so a component missing there
// is listed, built and shipped -- and never loads. sf-page-header shipped that
// way in ui-9fb0297bb5c2, and sf-file-preview had been missing since the
// component foundation was consolidated; nothing checked that the two lists
// agree.
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const imports = readFileSync(join(root, 'src/core/js/rule.src.js'), 'utf8');

test('every Smart component rule in the source is imported by Core', () => {
  const missing = readdirSync(join(root, 'src/smart'), {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(join(root, 'src/smart', entry.name, 'rule.js')))
    .map((entry) => entry.name)
    .filter((name) => !imports.includes(`import '../../smart/${name}/rule.js';`));
  assert.deepEqual(missing, [], 'a Smart rule Core does not import is a tag the Loader never loads');
});

// The same holds for components: kbd, link, outline and file-preview had rules
// that Core never imported, so <kbd> and .sf-file-preview never got their CSS.
test('every component rule in the source is imported by Core', () => {
  const missing = readdirSync(join(root, 'src/component'), {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(join(root, 'src/component', entry.name, 'rule.js')))
    .map((entry) => entry.name)
    .filter((name) => !imports.includes(`import '../../component/${name}/rule.js';`));
  assert.deepEqual(missing, [], 'a component rule Core does not import is a class the Loader never styles');
});
