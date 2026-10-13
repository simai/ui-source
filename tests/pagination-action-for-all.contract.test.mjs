import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const template = read('src/smart/pagination/js/templates/default.js');
const element = read('src/smart/pagination/index.js');

test('the action-for-all checkbox follows its state, not a click on the label', () => {
    const block = template.split('${context.showActionForAll')[1].split('</sf-checkbox>')[0];
    assert.match(block, /@change=\$\{\(event\) =>\s*component\.setActionForAll\(Boolean\(event\.target\?\.checked\)\)\}/);
    assert.doesNotMatch(block, /@click=/);
    assert.doesNotMatch(block, /!context\.actionForAll/);
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
        emitComponentEvent(name, detail) { this.events.push({name, detail}); }};
    setActionForAll.call(owner, true);
    setActionForAll.call(owner, true);
    setActionForAll.call(owner, false);
    assert.deepEqual(owner.events.map((event) => event.detail.actionForAll), [true, false]);
    assert.deepEqual(owner.counts, ['action-for-all'], 'asked once, and not when the box is cleared');
});
