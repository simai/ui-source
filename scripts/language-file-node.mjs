// Runs a Framework language file's script form (src/core/lang/<code>.js) in
// Node.js, as a page that includes it before core does (owner decision C282,
// 2026-11-17: the bundles say English; Russian is a language file). Its words
// go into the shared word registry (globalThis.__sfPageLanguage) beneath the
// words already registered, so a script that renders Russian outside a
// browser (a contract generator, the conformance kit, a host's server-side
// render) says what a Russian page says.
//
//   import {registerLanguageFile} from './language-file-node.mjs';
//   registerLanguageFile('ru');
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Registers the words of src/core/lang/<code>.js; false when there is no such file. */
export function registerLanguageFile(code = 'ru', root = ROOT) {
  const file = resolve(root, `src/core/lang/${code}.js`);
  if (!existsSync(file)) return false;
  vm.runInThisContext(readFileSync(file, 'utf8'), {filename: file});
  return true;
}
