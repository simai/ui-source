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
  assert.equal(JSON.parse(read('src/component/icon-buttons/passport.json')).version, '1.21.0'); // GB21 A: the name tooltip beside a rail row // FS-11: the name tooltip serves a marked control // GB19 touch size (C428)
  assert.equal(JSON.parse(read('src/component/buttons/passport.json')).version, '1.22.5'); // GB19 VL-77: the join line
});

test('G14: the Smart twins say what the sheets draw -- an outline toggle keeps its edge when pressed', () => {
  for (const [path, version] of [['src/smart/button/component.json', '1.18.2'], ['src/smart/button-icon/component.json', '1.14.2']]) { // GB19 touch size (C428)
    const manifest = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
    assert.equal(manifest.version, version, path);
    const text = JSON.stringify(manifest);
    assert.match(text, /an outline toggle's edge kept \(group build 16 G14, C393/u, path);
    assert.doesNotMatch(text, /the primary container fill, its ink, no visible edge/u, path);
  }
});
