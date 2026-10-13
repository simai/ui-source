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

test('Swiper Loader rule recognizes only the canonical root class', async () => {
  const sandbox = { SF: { RuleLoader: {} } };
  vm.createContext(sandbox);
  vm.runInContext(await read('src/component/swiper/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader.swiper;

  assert.equal(rule.regex.test('class="swiper"'), true);
  assert.equal(rule.regex.test('id="example" class="surface swiper overflow-hidden" role="region"'), true);
  assert.equal(rule.regex.test('class="swiper theme-light"'), true);
  assert.equal(rule.regex.test('class="swiper-slide"'), false);
  assert.equal(rule.regex.test('class="my-swiper"'), false);
  assert.equal(rule.regex.test('class="swiper-pagination"'), false);
});

test('Slider engine is project-owned and initialized only by its consumers', async () => {
  const entry = await read('src/component/swiper/js/index.js');
  assert.match(entry, /class SimaiSlider/);
  assert.match(entry, /window\.Swiper = SimaiSlider/);
  assert.match(entry, /slideNext\(\)/);
  assert.match(entry, /destroy\(deleteInstance/);
  assert.match(entry, /100 \/ slidesPerView/);
  assert.match(entry, /this\.originalParams/);
  assert.doesNotMatch(entry, /swiper-bundle|https?:\/\//);
});

test('supported direct styles include pagination and accessibility with semantic color', async () => {
  const index = await read('src/component/swiper/scss/index.scss');
  assert.match(index, /contain: inline-size/);
  assert.match(index, /inline-size: 100%/);
  assert.match(index, /min-inline-size: 0/);
  assert.match(index, /--sf-opacity-disabled/);
  assert.doesNotMatch(index, /@font-face|base64/);
});

test('owner documentation fixes the adapter and lifecycle boundaries', async () => {
  const docs = await read('src/component/swiper/docs/docs.md');

  for (const phrase of ['Project-owned', 'navigation', 'pagination', 'keyboard', 'autoplay', 'lifecycle']) {
    assert.match(docs, new RegExp(phrase, 'i'));
  }
});

test('ui-doc presents the supported scenarios as live Framework-only examples', async () => {
  const page = await readUiDoc('content/ru/components/overlays-media/swiper.md');
  const examplePaths = ['overview', 'responsive', 'lifecycle'];

  for (const id of examplePaths) {
    assert.match(page, new RegExp(`components/swiper/${id}`));
    const html = await readUiDoc(`examples/components/swiper/${id}/index.html`);
    const script = await readUiDoc(`examples/components/swiper/${id}/index.js`);
    // The root is a named region the keyboard can reach; the engine clips the
    // ribbon itself (.swiper owns overflow) and labels the slides on its own,
    // so only keyboard control is opted into (true or { enabled: true }).
    assert.match(html, /class="swiper" role="region" aria-label="[^"]+" tabindex="0"/);
    assert.match(script, /new window\.Swiper/);
    assert.match(script, /keyboard: (?:true|\{ enabled: true[^}]*\})/);
    assert.doesNotMatch(html, /<style|style=/);
    assert.doesNotMatch(`${html}\n${script}`, /https?:\/\//);
  }
});
