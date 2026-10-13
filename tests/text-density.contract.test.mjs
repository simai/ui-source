import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Compact density moves the default body text on desktop to the step a phone
// already reads, so a dense application asks for it by attribute instead of
// overriding --sf-text--size with a pixel value of its own.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const contract = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json'));

const rule = () => {
  const source = read('src/core/scss/_sf_css__typograpy.scss');
  const match = source.match(/\[data-sf-density="compact"\]\s*\{([^}]*)\}/u);
  assert.ok(match, 'the compact density rule is declared');
  return Object.fromEntries(
    [...match[1].matchAll(/(--sf-text--(?:size|height)):\s*var\(--sf-text--(size|height)-([0-9\\/]+)\)/gu)]
      .map(([, name, , step]) => [name, step.replace('\\/', '/')]),
  );
};

test('compact density lands on the mobile body size and line height', () => {
  const steps = rule();
  const { sizes, lineHeights } = contract.typography;
  assert.equal(sizes[steps['--sf-text--size']].desktop, sizes['1'].mobile);
  assert.equal(lineHeights[steps['--sf-text--height']].desktop, lineHeights['1'].mobile);
});

test('compact density applies only at the desktop breakpoint', () => {
  const source = read('src/core/scss/_sf_css__typograpy.scss');
  const at = source.indexOf('[data-sf-density="compact"]');
  const media = source.lastIndexOf('@media', at);
  // The threshold is written in rem since the breakpoints became ladder steps;
  // the contract keeps the pixel value it equals.
  assert.match(source.slice(media, at), new RegExp(`min-width:\\s*${contract.modes.desktop.minWidthPx / 16}rem`, 'u'));
});

test('compact density never sets the root font size, which would move rem', () => {
  const source = read('src/core/scss/_sf_css__typograpy.scss');
  for (const [, selector, body] of source.matchAll(/(\[data-sf-density="compact"\][^{]*)\{([^}]*)\}/gu)) {
    if (/font-size/u.test(body)) assert.match(selector, /:not\(:root\)/u);
  }
});
