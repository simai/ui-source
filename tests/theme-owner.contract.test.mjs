import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('Theme Loader rule recognizes only the canonical control root', async () => {
  const sandbox = { SF: { RuleLoader: {} } };
  vm.createContext(sandbox);
  vm.runInContext(await read('src/component/theme/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader.theme;

  assert.equal(rule.regex.test('class="sf-theme-button"'), true);
  assert.equal(rule.regex.test('class="sf-icon-button sf-theme-button"'), true);
  assert.equal(rule.regex.test('class="sf-theme-builder"'), false);
  assert.equal(rule.regex.test('data-name="sf-theme-button"'), false);
  assert.equal(rule.regex.test('class="sf-theme-button-copy"'), false);
});

test('Theme control delegates clicks and synchronizes toggle state', async () => {
  const source = await read('src/component/theme/js/_theme.js');

  assert.match(source, /document\.addEventListener\('click'/);
  assert.match(source, /closest\?\.\('\.sf-theme-button'\)/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /sf-theme-change/);
  assert.match(source, /button\.dataset\.theme/);
  assert.doesNotMatch(source, /sfThemeBound|MutationObserver|document\.cookie|prefers-color-scheme/);
});

test('Loader owns the closed preference API and live system changes', async () => {
  const loader = await read('src/core/js/loader.js');

  assert.match(loader, /prototype\.setTheme = function \(preference\)/);
  assert.match(loader, /\['system', 'light', 'dark'\]/);
  assert.match(loader, /prototype\.ensureThemePreferenceListener/);
  assert.match(loader, /addEventListener\('change'/);
  assert.match(loader, /Sandboxed documents retain the session theme/);
  assert.match(loader, /this\.themeSessionPreference = persisted \? null : preference/);
  assert.match(loader, /\['system', 'light', 'dark'\]\.includes\(sessionPreference\)/);
  assert.match(loader, /new CustomEvent\('sf-theme-change'/);
  assert.match(loader, /detail: \{ theme, preference \}/);
});

test('Core early paint and native controls use the same theme contract', async () => {
  const [core, styles] = await Promise.all([
    read('src/core/js/index.js'),
    read('src/core/scss/_sf_css__theme.scss'),
  ]);

  assert.match(core, /SF_BOOT_CONFIG\?\.theme === false/);
  assert.match(core, /try \{\s*savedTheme = decodeURIComponent/);
  assert.match(core, /\['light', 'dark'\]\.includes\(savedTheme\)/);
  assert.match(styles, /\.theme-light \{\s*color-scheme: light;/);
  assert.match(styles, /\.theme-dark \{\s*color-scheme: dark;/);
});

test('Theme documentation demonstrates toggle and closed preference ownership', async () => {
  // The examples are markup only: their scripts held the documentation
  // sandbox's own theme switch-on, which readers copied (ui-doc b9b0b912), and
  // the buttons work on an ordinary page with no extra code.
  const [docs, page, overviewHtml, preferencesHtml] =
    await Promise.all([
      read('src/component/theme/docs/docs.md'),
      readUiDoc('content/ru/components/tools/theme.md'),
      readUiDoc('examples/components/theme/overview/index.html'),
      readUiDoc('examples/components/theme/preferences/index.html'),
    ]);

  assert.match(docs, /setTheme\('system'\)/);
  assert.match(docs, /sf-theme-change/);
  assert.match(page, /components\/theme\/overview/);
  assert.match(page, /components\/theme\/preferences/);
  assert.match(overviewHtml, /class="sf-theme-button [^"]+"[^>]+aria-label="Тёмная тема"[^>]+aria-pressed="false"/);
  for (const preference of ['system', 'light', 'dark']) {
    assert.match(preferencesHtml, new RegExp(`data-theme="${preference}"`));
  }
  assert.equal((preferencesHtml.match(/sf-theme-button/g) || []).length, 3);
  assert.doesNotMatch(`${overviewHtml}\n${preferencesHtml}`, /<style|style=/);
});
