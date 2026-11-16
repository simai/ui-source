// sf-scrollbar since owner decision C210 (2026-11-15): a wrapper around one
// scrolling area whose bar is the Framework's one bar, drawn by core
// (core/js/scrollbars.js). The component gives the area its keyboard stop and
// name, the edge fade (C91) and turns data-mode words into the bar's modifier
// classes; the C208 modes are dated aliases (tests/scrollbar-c210.contract.test.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const cssPath = 'src/component/scrollbar/scss/_css__scrollbar.scss';
const jsPath = 'src/component/scrollbar/js/_scrollbar.js';

test('scrollbar component reads data-mode, data-axis and their legacy spellings', () => {
  const runtime = read(jsPath);

  assert.match(runtime, /getAttribute\('data-mode'\)/);
  assert.match(runtime, /getAttribute\('data-sf-scrollbar'\)/);
  assert.match(runtime, /getAttribute\('data-axis'\)/);
  assert.match(runtime, /getAttribute\('data-sf-scrollbar-axis'\)/);
  assert.match(runtime, /SF\?\.scrollbars\?\.refresh\?\.\(this\.viewport\)/);
});

test('the area is the keyboard stop and a named region; the component follows its life', () => {
  const runtime = read(jsPath);

  assert.match(runtime, /viewport\.tabIndex = 0/);
  assert.match(runtime, /setAttribute\('role', 'region'\)/);
  assert.match(runtime, /pageText\(SCROLLBAR_TEXT, 'scroll'/);
  assert.match(runtime, /ResizeObserver/);
  assert.match(runtime, /MutationObserver/);
  assert.match(runtime, /removedNodes/);
  assert.doesNotMatch(runtime, /setInterval/);
});

test('scrollbar presentation preserves accessibility fallbacks', () => {
  const css = read(cssPath);
  const core = read('src/core/scss/_sf_css__scroll.scss');

  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /scrollbar-color:\s*auto/);
  assert.match(core, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(core, /\(pointer:\s*coarse\)/);
});

test('scrollbar supports a horizontal axis and normalises the RTL position for the fade', () => {
  const css = read(cssPath);
  const runtime = read(jsPath);

  assert.match(runtime, /VALID_AXES = new Set\(\['vertical', 'horizontal'\]\)/);
  assert.match(runtime, /scrollLeft/);
  assert.match(runtime, /scrollWidth/);
  assert.match(runtime, /direction === 'rtl' \? -raw : raw/);
  assert.match(css, /--sf-scrollbar--fade-direction:\s*to left/);
});

test('scrollbar contains only its managed axis and preserves cross-axis page scrolling', () => {
  const css = read(cssPath);

  assert.match(
    css,
    /\.sf-scrollbar__viewport\s*\{[^}]*overscroll-behavior-block:\s*contain;[^}]*overscroll-behavior-inline:\s*auto;/s,
  );
  assert.match(
    css,
    /data-axis="horizontal"[\s\S]*?\.sf-scrollbar__viewport\s*\{[^}]*overscroll-behavior-block:\s*auto;[^}]*overscroll-behavior-inline:\s*contain;/,
  );
  assert.doesNotMatch(css, /overscroll-behavior:\s*contain;/);
});

test('RuleLoader detects public component markup', () => {
  const sandbox = {SF: {RuleLoader: {}}};
  vm.runInNewContext(read('src/component/scrollbar/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader.scrollbar;

  assert.equal(rule.regex.test('<div class="sf-scrollbar">'), true);
  assert.equal(rule.regex.test('<div data-sf-scrollbar="persistent">'), true);
  assert.equal(rule.regex.test('<div class="scroll-subtle">'), false);
  assert.equal(rule.css, true);
  assert.equal(rule.js, true);
});
