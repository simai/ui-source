// RG-VR-1..5 (2026-11-16, DEV msg-e7fdc64d; owner decisions C82, C153). The
// class verification field (src/component/verification) drew its caret after
// the last character whatever the real caret did, painted no selection and no
// hovered cell, labelled the code in the hint ink at 12 on a phone, ringed the
// current cell outside it, and sent verification:complete on page load. This
// test holds the fix in the source and, when the gate names a build
// (UI_CORE_ROOT=<ui root>, distr/ beside), in the built sheet and script too.
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\s+/gu, ' ').replace(/\s*([{}:;,])\s*/gu, '$1');

// The declarations of every rule whose selector list holds `selector`.
function declarations(css, selector) {
  const want = selector.replace(/\s+/gu, ' ').trim();
  const found = [];
  for (const match of flat(css).matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = match[1].split(',').map((one) => one.replace(/\s+/gu, ' ').trim());
    if (selectors.includes(want)) found.push(match[2]);
  }
  return found.join(';');
}

const source = {
  script: read('src/component/verification/js/_verification.js'),
  sheet: read('src/component/verification/scss/_css__verification.scss'),
  form: read('src/component/verification/scss/_css__verification-form.scss'),
};

const built = (() => {
  const root = process.env.UI_CORE_ROOT;
  if (!root) return null;
  const dir = join(resolve(root), 'distr/component/verification');
  const pick = (...names) => names.map((name) => join(dir, name)).find(existsSync);
  const css = pick('css/verification.css', 'css/verification.min.css');
  const js = pick('js/verification.js', 'js/verification.min.js');
  assert.ok(css && js, `built verification files under ${dir}`);
  return {css: readFileSync(css, 'utf8'), js: readFileSync(js, 'utf8')};
})();

const CURRENT = '.sf-verification:has(.sf-verification-input:enabled:focus) .sf-verification-cell.current';

function checkSheet(css, form) {
  // RG-VR-5 (C153 (4)): one focus look, a 2 px edge inside the current cell.
  const focus = declarations(css, CURRENT);
  assert.match(focus, /outline:var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/u);
  assert.match(focus, /outline-offset:calc\(-1 ?\* ?var\(--sf-focus--width\)\)/u);
  assert.doesNotMatch(flat(css), /sf-verification--pointer-focus\)/u, 'no second focus look for a pointer');
  // RG-VR-3 (C153 (4)): the hovered cell's border is the text ink.
  assert.match(declarations(css, '.sf-verification-cell.hover'), /border-color:var\(--sf-on-surface\)/u);
  // RG-VR-2: a selection is painted.
  assert.match(declarations(css, '.sf-verification:has(.sf-verification-input:enabled:focus) .sf-verification-cell.selected'), /background:var\(--sf-primary-container\)/u);
  // RG-VR-4 (C153 (1)): the label is in the text ink, 14 on a phone at size 1.
  assert.match(declarations(form, '.sf-verification-form-label'), /color:var\(--sf-on-surface\)/u);
  assert.match(flat(form), /@media not all and \(min-width:60rem\)\{\.sf-verification-form--size-1 \.sf-verification-form-label,[^{]*\{font-size:var\(--sf-text-size-1\);line-height:var\(--sf-text-height-1\)/u);
}

function checkScript(js) {
  // RG-VR-1: the caret's cell is read from the real caret.
  assert.match(js, /selectionStart/u);
  assert.match(js, /setSelectionRange/u);
  // RG-VR-2 / RG-VR-3: the runtime sets the classes the sheet draws.
  assert.match(js, /['"]selected['"]/u);
  assert.match(js, /['"]hover['"]/u);
  assert.match(js, /pointermove/u);
}

test('RG-VR-1/2/3: the class runtime draws the real caret, the selection and the hovered cell', () => {
  checkScript(source.script);
  assert.match(source.script, /const at = focused \? \(input\.selectionStart \?\? value\.length\) : value\.length;/u);
  assert.match(source.script, /const selected = focused && !one && index >= start && index < end;\n\s+cell\.classList\.toggle\('selected', selected\);/u);
  assert.match(source.script, /cell\.classList\.toggle\('hover', index === state\.hover && !selected && !\(focused && one && index === current\)\);/u);
  assert.match(source.script, /cell\.classList\.toggle\('caret', bare && index === current\);/u);
  assert.doesNotMatch(source.script, /const current = Math\.min\(value\.length, state\.length - 1\);/u, 'the caret no longer follows the length');
});

test('verification:complete answers the person only, never a field that loads whole', () => {
  assert.match(source.script, /function renderCanonical\(root, state, fromUser = false\)/u);
  assert.match(source.script, /if \(fromUser\) \{\n\s+root\.dispatchEvent\(new CustomEvent\('verification:complete'/u);
  assert.match(source.script, /completedValue: loaded\.length === length \? loaded : ''/u);
  assert.match(source.script, /renderCanonical\(root, state, true\);/u);
});

test('RG-VR-2..5: the source sheets draw the text field look', () => {
  checkSheet(source.sheet, source.form);
});

test('RG-VR-1..5: the built sheet and script carry the fix', {skip: built ? false : 'UI_CORE_ROOT not set'}, () => {
  checkScript(built.js);
  checkSheet(built.css, built.css);
});
