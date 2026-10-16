import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import test from 'node:test';

// Every edition of every host port pins its conformance kit: the digest of the
// kit's files and the number of cases. The data-view port 1.12.0 was released
// with 1.11.0's digest and count copied over; only a consumer's test saw it
// (2026-10-16). The check is the consumers' (larena-ui
// tests/host-port.contract.test.mjs), here at the source.
const PORTS = 'src/core/contracts/ports';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const kitDigest = (directory) => {
  const lines = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else lines.push(`${relative(directory, full)} ${sha256(readFileSync(full))}\n`);
    }
  };
  walk(directory);
  lines.sort();
  return sha256(lines.join(''));
};

test('every port edition pins the kit beside it, by digest and case count', () => {
  let checked = 0;
  for (const port of readdirSync(PORTS, {withFileTypes: true}).filter((entry) => entry.isDirectory())) {
    for (const edition of readdirSync(join(PORTS, port.name), {withFileTypes: true}).filter((entry) => entry.isDirectory())) {
      const at = join(PORTS, port.name, edition.name);
      if (!existsSync(join(at, 'port.json'))) continue;
      const document = JSON.parse(readFileSync(join(at, 'port.json'), 'utf8'));
      if (!document.conformance?.kit) continue;
      const kit = join(at, document.conformance.kit);
      const manifest = JSON.parse(readFileSync(join(kit, 'manifest.json'), 'utf8'));
      assert.equal(document.version, edition.name, `${at}: the version is the directory`);
      assert.equal(manifest.version, document.version, `${at}: the kit is this edition's`);
      assert.equal(manifest.cases.length, document.conformance.cases, `${at}: the case count`);
      assert.equal(kitDigest(kit), document.conformance.sha256, `${at}: the kit digest`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'at least one port edition pins a kit');
});
