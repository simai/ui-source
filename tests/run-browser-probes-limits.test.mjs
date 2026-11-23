import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'scripts', 'run-browser-probes.mjs'), 'utf8');

// GB17A-2 (2026-11-23): with Node's 1 MiB default the runner killed a probe that
// prints one PASS line per check and reported it red with nothing said.
test('the probe runner lifts the child output limit for every probe it runs', () => {
  const calls = source.match(/execFileSync\(process\.execPath[^;]*?\}\)/gsu) ?? [];
  assert.ok(calls.length >= 2, 'both probe calls are found');
  for (const call of calls) assert.match(call, /maxBuffer: PROBE_OUTPUT_LIMIT/u, call.slice(0, 80));
  const limit = Number(eval(source.match(/const PROBE_OUTPUT_LIMIT = ([^;]+);/u)[1]));
  assert.ok(limit >= 64 * 1024 * 1024, `limit ${limit} is at least 64 MiB`);
});

test('a child the runner stopped is reported as killed, not as a silent red', () => {
  assert.match(source, /error\.code === 'ENOBUFS'/u);
  assert.match(source, /error\.signal \? `killed by signal/u);
  assert.match(source, /killed \? \{killed: true\} : \{\}/u);
});
