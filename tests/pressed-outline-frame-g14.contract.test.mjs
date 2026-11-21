import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Group build 16 G14 (DEV return SEG-1, C393: a pressed toggle shows a fill and
// a frame): a pressed outline toggle keeps its frame over the fill, so a group
// of outline segments has no gap; only ghost and link toggles drop the edge.
for (const [file, block] of [['src/component/icon-buttons/scss/_css_icon_buttons_custom.scss', 'sf-icon-button'], ['src/component/buttons/scss/_css__buttons_custom.scss', 'sf-button']]) {
  test(`G14: a pressed outline ${block} keeps its frame`, () => {
    const sheet = read(file);
    const pressed = new RegExp(`:is\\(\\.${block}--outline, \\.${block}--ghost, \\.${block}--link\\)[^{]*:is\\(\\.${block}--pressed, \\[aria-pressed="true"\\]\\):not\\(:disabled, \\[aria-disabled="true"\\]\\):not\\(\\.disabled\\) \\{([^}]*)\\}`, 'u');
    const rule = sheet.match(pressed);
    assert.ok(rule, 'the pressed toggle rule');
    assert.doesNotMatch(rule[1], /border-color/u, 'the shared rule leaves the frame alone');
    assert.match(sheet, new RegExp(`:is\\(\\.${block}--ghost, \\.${block}--link\\)[^{]*:is\\(\\.${block}--pressed, \\[aria-pressed="true"\\]\\)[^{]*\\{\\s*--${block}--border-color: transparent;\\s*\\}`, 'u'));
  });
}

test('G14: versions', () => {
  assert.equal(JSON.parse(read('src/component/icon-buttons/passport.json')).version, '1.20.1');
  assert.equal(JSON.parse(read('src/component/buttons/passport.json')).version, '1.22.4');
});
