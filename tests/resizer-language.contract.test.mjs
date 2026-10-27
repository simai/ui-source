// sf-resizer speaks the page's language through the shared reader.
//
// Until 2026-10-21 the handle kept a private pageLanguage() over its own
// two-language dictionary, so SF.language.use() did not reach it, a word
// registered for 'sf-resizer' was never read, a third language could not be
// taught to it at all, and a language announced after it had drawn itself left
// the old aria-label and title on the page. A real consumer found it in the
// source (ui-mail feedback ui-mail.resizer-language, simai/ui-mail M0).
//
// The element is loaded from its own source with the stylesheet import removed
// and its neighbours' specifiers made absolute -- a node run has no bundler --
// the way tests/modal-closing.test.mjs loads its module. What is checked is the
// element the bundler ships, not a copy of its logic.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const here = (path) => new URL(path, import.meta.url);
const raw = await readFile(here('../src/smart/resizer/index.js'), 'utf8');
// Standard 1.3.8: the element is made from its component.json and speaks its
// language files; the bundler inlines the JSON, so the test does too.
const inline = async (name, file) => `const ${name} = ${await readFile(here(`../src/smart/resizer/${file}`), 'utf8')};`;
const source = raw
  .replace(/^import '\.\/scss\/index\.scss';$/mu, '')
  .replace(/^import manifest from '\.\/component\.json';$/mu, await inline('manifest', 'component.json'))
  .replace(/^import aliases from '\.\/aliases\.json';$/mu, await inline('aliases', 'aliases.json'))
  .replace(/^import en from '\.\/lang\/en\.json';$/mu, await inline('en', 'lang/en.json'))
  .replace(/^import ru from '\.\/lang\/ru\.json';$/mu, await inline('ru', 'lang/ru.json'))
  .replace("'./engine.mjs'", JSON.stringify(here('../src/smart/resizer/engine.mjs').href))
  .replace("'../../core/js/page-language'", JSON.stringify(here('../src/core/js/page-language.js').href))
  .replace("'../../core/js/element-manifest'", JSON.stringify(here('../src/core/js/element-manifest.js').href))
  .replace("'../../core/js/aliases.js'", JSON.stringify(here('../src/core/js/aliases.js').href))
  .replace("'../../core/js/preferences.js'", JSON.stringify(here('../src/core/js/preferences.js').href));

class StubElement {
  constructor() {
    this.attributes = new Map();
    this.dataset = {};
    this.isConnected = true;
    // The tag the words are registered under, as the browser gives it.
    this.localName = 'sf-resizer';
  }

  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); }
  // The shared reader looks for the nearest [lang] and past shadow roots; this
  // handle has neither, so the page's own language answers.
  closest() { return null; }
  getRootNode() { return this; }
}

globalThis.HTMLElement = StubElement;
globalThis.customElements = {get: () => undefined, define: () => {}};
globalThis.document = {documentElement: {lang: 'ru', getAttribute: () => null, setAttribute() {}, removeAttribute() {}}};
globalThis.requestAnimationFrame = () => 0;
globalThis.addEventListener = globalThis.addEventListener ?? (() => {});
globalThis.removeEventListener = globalThis.removeEventListener ?? (() => {});

const {SfResizer} = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const {language} = await import('../src/core/js/page-language.js');

const connected = (attributes = {}) => {
  const handle = new SfResizer();
  for (const [name, value] of Object.entries(attributes)) handle.setAttribute(name, value);
  handle.connectedCallback();
  return handle;
};

test('sf-resizer: the page language names the handle, and a live switch renames it', (t) => {
  t.after(() => language.forget());
  const handle = connected();
  assert.equal(handle.getAttribute('aria-label'), 'Изменить ширину', 'a Russian page');
  assert.match(handle.title, /^Тяните или нажимайте стрелки/u);

  // The switch a product makes while the page stands: the handle is already
  // drawn, and nothing reloads.
  language.use('en');
  assert.equal(handle.getAttribute('aria-label'), 'Resize', 'after SF.language.use("en")');
  assert.match(handle.title, /^Drag, or use the arrow keys/u);

  language.use(null);
  assert.equal(handle.getAttribute('aria-label'), 'Изменить ширину', 'back to following the page');
});

test('sf-resizer: a language the Framework never shipped can be registered for it', (t) => {
  t.after(() => language.forget());
  const handle = connected();
  language.register('sf-resizer', 'tr', {label: 'Boyutlandır', hint: 'Sürükleyin veya ok tuşlarını kullanın.'});
  assert.equal(handle.getAttribute('aria-label'), 'Изменить ширину', 'Turkish is registered, not yet chosen');

  language.use('tr');
  assert.equal(handle.getAttribute('aria-label'), 'Boyutlandır');
  assert.equal(handle.title, 'Sürükleyin veya ok tuşlarını kullanın.');

  // A word registered for one language only still falls back to English for
  // the rest, never to the key.
  language.use('de');
  assert.equal(handle.getAttribute('aria-label'), 'Resize', 'a language nothing was registered for');
});

test('sf-resizer: a named label is the consumer\'s and no language changes it', (t) => {
  t.after(() => language.forget());
  const handle = connected({label: 'Ширина меню'});
  assert.equal(handle.getAttribute('aria-label'), 'Ширина меню');
  assert.equal(handle.title, 'Ширина меню. Тяните или нажимайте стрелки; двойной щелчок возвращает ширину.');

  language.use('en');
  assert.equal(handle.getAttribute('aria-label'), 'Ширина меню', 'the name a consumer gave stays');
  assert.equal(handle.title, 'Ширина меню. Drag, or use the arrow keys; a double click restores the width.');
});

test('sf-resizer: a handle taken out of the page stops listening', (t) => {
  t.after(() => language.forget());
  const handle = connected();
  handle.disconnectedCallback();
  handle.isConnected = false;
  language.use('en');
  assert.equal(handle.getAttribute('aria-label'), 'Изменить ширину', 'a detached handle is not redrawn');
});

test('sf-resizer: no private reading of the page language is left in the source', () => {
  assert.doesNotMatch(raw, /function pageLanguage\(/u, 'a private reading of [lang]');
  assert.doesNotMatch(raw, /documentElement\.lang/u, 'the page language is the shared reader\'s to resolve');
  assert.match(raw, /import \{language\} from '\.\.\/\.\.\/core\/js\/page-language'/u);
  // The words are its language files, read by the shared reader (sfWord).
  assert.match(raw, /this\.sfWord\('label'\)/u);
  assert.match(raw, /lang: \{en, ru\}/u);
  assert.match(raw, /language\.onChange\(/u, 'the announce refresh');
});
