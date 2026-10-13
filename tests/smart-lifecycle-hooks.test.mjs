import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const base = readFileSync('src/core/js/smart-base.js', 'utf8');

test('base owns native lifecycle and exposes bounded connect/disconnect hooks', () => {
    assert.match(base, /connectedCallback\(\)[\s\S]*this\._isMounted = true;\s*this\.onConnected\(\);/);
    assert.match(base, /disconnectedCallback\(\)[\s\S]*this\.onDisconnected\(\);[\s\S]*this\._releaseExternalTemplate\(\);/);
    assert.match(base, /\bonConnected\(\) \{\}/);
});

