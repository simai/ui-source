import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const template = read('src/smart/pagination/js/templates/default.js');
const element = read('src/smart/pagination/index.js');

test('«for all» is the bar\'s offer: «Выбрать все N» and «Только эта страница» set it, the bar shows its state (C295)', () => {
    const block = template.split('<sf-bulk-actions')[1].split('></sf-bulk-actions>')[0];
    assert.match(block, /@sf-bulk-actions-select-all=\$\{\(\) => component\.setActionForAll\(true\)\}/);
    assert.match(block, /@sf-bulk-actions-select-page=\$\{\(\) => component\.setActionForAll\(false\)\}/);
    assert.match(block, /\?all-selected=\$\{Boolean\(context\.showActionForAll && context\.actionForAll\)\}/);
    assert.doesNotMatch(template, /<sf-checkbox/);
});

test('BA-3: a changed selected-count takes «for all» back', () => {
    assert.match(element, /name === "selected-count" && this\.isConnected && oldValue !== null && oldValue !== newValue && this\.actionForAll\) \{\n\s+this\.setActionForAll\(false\);/);
});

test('setActionForAll stays idempotent, so a repeated state emits nothing', () => {
    const body = element.split('  setActionForAll(value) {')[1].split('\n  }\n')[0];
    const setActionForAll = new Function('value', body);
    // Marking the box now also asks for the count, because an action under the
    // filter is applied against a confirmed total. The stub answers for that
    // too, so the test says what the method does rather than what it used to.
    const owner = {actionForAll: false, events: [], counts: [],
        setState(patch) { Object.assign(this, patch); },
        requestCount(reason) { this.counts.push(reason); },
        // The band's events are noted as deprecated (C97 point 5); a no-op here.
        noteFooterEvent() {},
        // The manifest's event sender (core element-manifest.js); the detail is the vocabulary's.
        sfEmit(verb, detail) { this.events.push({name: verb, detail}); return true; }};
    setActionForAll.call(owner, true);
    setActionForAll.call(owner, true);
    setActionForAll.call(owner, false);
    assert.deepEqual(owner.events.map((event) => event.detail['action-for-all']), [true, false]);
    assert.deepEqual(owner.counts, ['action-for-all'], 'asked once, and not when the box is cleared');
});
