import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A label is attached to a control, and a control does not change size with the
// width of the screen, so neither does its label. The two smaller steps already
// held to that; the large one stood on the adaptive --sf-text--size-1/2, grew
// like a paragraph, and so came out identical to the text-small utility and out
// of step with its own family.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const primitives = () => {
  const source = read('src/core/scss/vars/_sf_var__size.scss');
  const values = {};
  let range = null;
  for (const line of source.split('\n')) {
    const header = line.match(/^\s*([a-i]):\s*\(/u);
    if (header) { range = header[1]; continue; }
    const step = line.match(/^\s*([0-9]):\s*([0-9.]+)rem/u);
    if (step && range) values[`--sf-${range}${step[1]}`] = Number(step[2]) * 16;
  }
  return values;
};

// Narrow values come first in each file and are repeated inside the min-width
// block, so the first match is narrow and the last is wide.
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const bothModes = (path, name) => {
  const found = [...read(path).matchAll(new RegExp(`${escape(name)}:\\s*var\\((--sf-[^)]+)\\)`, 'gu'))]
    .map(([, token]) => token);
  return found.length === 0 ? null : { narrow: found[0], wide: found[found.length - 1] };
};

const ROLES = 'src/core/figma_variables/figma_typography_roles.scss';
const SIZES = 'src/core/figma_variables/figma_text_text_size.scss';
const HEIGHTS = 'src/core/figma_variables/figma_text_body_text_height.scss';

// A role either points straight at a primitive, which is one value in both
// modes, or at a step of the text ladder, which has one value per mode.
const measure = (px, token) => {
  if (px[token] !== undefined) return { narrow: px[token], wide: px[token] };
  for (const file of [SIZES, HEIGHTS]) {
    const nested = bothModes(file, token);
    if (nested) return { narrow: px[nested.narrow], wide: px[nested.wide] };
  }
  return null;
};

test('a label keeps its size on a wider screen', () => {
  const px = primitives();
  const offenders = [];
  for (const step of ['small', 'medium', 'large']) {
    for (const axis of ['size', 'height']) {
      const role = bothModes(ROLES, `--sf-label-${step}--${axis}`);
      assert.ok(role, `--sf-label-${step}--${axis} is not declared`);
      const narrow = measure(px, role.narrow);
      const wide = measure(px, role.wide);
      if (!narrow || !wide) continue;
      if (narrow.narrow !== wide.wide) {
        offenders.push(`label-${step} ${axis}: ${narrow.narrow} narrow, ${wide.wide} wide`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'a label follows its control, and a control does not resize with the screen');
});

test('body text does grow with the screen', () => {
  const px = primitives();
  const role = bothModes(ROLES, '--sf-text-small--size');
  assert.ok(role, '--sf-text-small--size is not declared');
  const narrow = measure(px, role.narrow);
  const wide = measure(px, role.wide);
  assert.ok(narrow && wide, 'the body size has to resolve in both modes');
  assert.ok(wide.wide > narrow.narrow,
    `body text is meant to grow: ${narrow.narrow} narrow, ${wide.wide} wide`);
});
