import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// RG-B-53 follow-up (queue item 198): a utility hint is a markup requirement
// (ui-doc's layout map reads it). Measured on the reviewed docs (ui-doc.test,
// every element of the class in every frame, 1440 light), these seven rules
// are never drawn as a flex box -- the hint was a Figma frame that, written,
// redraws them (the accordion put content beside its heading). They carry no
// hint; the rule's own declarations stay unchanged.
const FALSE = [
  ['src/component/accordion/scss/_css__accordion.scss', '.sf-accordion {'],
  ['src/component/inputs/scss/_css__inputs.scss', '.sf-input .sf-input-hint-text-wrap {'],
  ['src/component/range-slider/scss/_css__thumbs.scss', '.sf-thumb {'],
  ['src/component/slider/scss/_css__slider_arrows.scss', '.sf-slider-arrows {'],
  ['src/component/tags/scss/_css__tags.scss', '.sf-tag .sf-tag-container {'],
  ['src/component/textarea/scss/_css__textarea.scss', '.sf-textarea .sf-textarea-hint-text-wrap {'],
  ['src/component/tooltip/scss/_css__tooltip.scss', '.sf-tooltip {'],
];

test('the seven measured-false utility hints are gone, their rules stay', () => {
  for (const [path, selector] of FALSE) {
    const lines = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').split('\n');
    const at = lines.findIndex((line) => line.trim() === selector);
    assert.ok(at > 0, `${path}: ${selector}`);
    assert.doesNotMatch(lines[at - 1], /utility-hint:/u, `${path}: ${selector} carries no hint`);
  }
});
