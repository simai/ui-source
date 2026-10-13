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

test('scrollbar component exposes the four preset contract', () => {
  const css = read(cssPath);
  const runtime = read(jsPath);

  for (const preset of ['overlay', 'standard', 'persistent', 'hidden']) {
    assert.match(css, new RegExp(`data-mode="${preset}"`));
    assert.match(runtime, new RegExp(`['"]${preset}['"]`));
  }

  assert.match(runtime, /getAttribute\('data-mode'\)/);
  assert.match(runtime, /getAttribute\('data-sf-scrollbar'\)/);
  assert.match(runtime, /getAttribute\('data-axis'\)/);
  assert.match(runtime, /getAttribute\('data-sf-scrollbar-axis'\)/);
  assert.match(runtime, /const IDLE_DELAY = 900/);
  assert.match(css, /--sf-scrollbar-rest-size:\s*var\(--sf-a2\)/);
  assert.match(css, /--sf-scrollbar-active-size:\s*var\(--sf-a6\)/);
  assert.match(css, /--sf-scrollbar-hit-size:\s*var\(--sf-b6\)/);
  assert.match(css, /--sf-scrollbar-min-thumb-size:\s*var\(--sf-d1\)/);
  assert.match(css, /--sf-scrollbar-keyboard-step:\s*var\(--sf-d0\)/);
  assert.doesNotMatch(runtime, /Math\.max\(44/);
  assert.doesNotMatch(runtime, /const line = 40/);
});

test('managed presets support activity, drag, keyboard and cleanup', () => {
  const runtime = read(jsPath);

  assert.match(runtime, /addEventListener\(type, listener, options\)/);
  assert.match(runtime, /'scroll'/);
  assert.match(runtime, /'pointerdown'/);
  assert.match(runtime, /setPointerCapture/);
  assert.match(runtime, /ArrowUp/);
  assert.match(runtime, /PageDown/);
  assert.match(runtime, /ResizeObserver/);
  assert.match(runtime, /MutationObserver/);
  assert.match(runtime, /removedNodes/);
  assert.match(runtime, /clearTimeout/);
  assert.doesNotMatch(runtime, /setInterval/);
});

test('scrollbar presentation preserves accessibility fallbacks', () => {
  const css = read(cssPath);
  const runtime = read(jsPath);

  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /scrollbar-color:\s*auto/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(pointer:\s*coarse\)/);
  assert.match(runtime, /role', 'scrollbar'/);
  assert.match(runtime, /aria-controls/);
  assert.match(runtime, /aria-valuenow/);
  assert.doesNotMatch(runtime, /track\.setAttribute\('aria-hidden'/);
  assert.match(runtime, /!VALID_PRESETS\.has\(requestedPreset\)/);
});

test('scrollbar supports a horizontal managed axis without reserving native space', () => {
  const css = read(cssPath);
  const runtime = read(jsPath);

  assert.match(runtime, /data-axis/);
  assert.match(runtime, /VALID_AXES = new Set\(\['vertical', 'horizontal'\]\)/);
  assert.match(runtime, /aria-orientation', axis/);
  assert.match(runtime, /scrollLeft/);
  assert.match(runtime, /scrollWidth/);
  assert.match(css, /sf-scrollbar__track--horizontal/);
  assert.match(css, /sf-scrollbar__thumb--horizontal/);
  assert.match(css, /transform:\s*translateX\(var\(--sf-scrollbar-thumb-offset/);
});

test('horizontal scrollbar normalizes logical position in RTL', () => {
  const runtime = read(jsPath);

  assert.match(runtime, /isHorizontalRtl\(\)/);
  assert.match(runtime, /-this\.viewport\.scrollLeft/);
  assert.match(runtime, /this\.isHorizontalRtl\(\)\s*\?\s*1 - thumbOffset \/ maxThumbOffset/);
  assert.match(runtime, /this\.isHorizontalRtl\(\)\s*\?\s*-boundedPosition/);
  assert.match(runtime, /this\.isHorizontalRtl\(\) \? -1 : 1/);
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
