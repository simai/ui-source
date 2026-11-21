import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

// Group build 16 G13 (Pro C161, ui-control control/evidence/2026-11-21-pro-gb15):
// Pro moves sf-chat-window's head onto SIMAI Framework's sf-header-page, so
// the package reference lists smart.header-page among cl-chat-window's
// requirements -- without it the Pro package receipt is refused
// (PACKAGE_RECEIPT_ERROR). The larena alias keeps the same entry.
for (const name of ['pro', 'larena']) {
  test(`G13: ${name}.package.json lets smart.chat-window require smart.header-page`, () => {
    const reference = read(`src/core/contracts/packages/${name}.package.json`);
    const entry = reference.provides.find((unit) => unit.id === 'smart.chat-window');
    assert.ok(entry, 'smart.chat-window is in the reference');
    assert.ok(entry.requires.includes('smart.header-page'));
    assert.deepEqual(entry.requires, [...entry.requires].sort(), 'requirements stay sorted');
    assert.ok(reference.provides.every((unit) => unit.id !== 'smart.header-page'), 'header-page is the Framework\'s, not a Pro unit');
  });
}

test('G13: pro and larena references agree on smart.chat-window', () => {
  const [pro, larena] = ['pro', 'larena'].map((name) => read(`src/core/contracts/packages/${name}.package.json`).provides.find((unit) => unit.id === 'smart.chat-window'));
  assert.deepEqual(pro.requires, larena.requires);
});
