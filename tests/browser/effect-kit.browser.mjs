#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The simai.effect 1.1.0 kit (scripts/effect-kit.mjs) on the built core: an
// effect that keeps the rules passes every check, and one that breaks them --
// it asks the network, draws through reduced motion and a hidden tab, leaves
// its node behind -- fails exactly those. A two-scheme, windows-capable effect
// passes each scheme, its contrast, the switch and the windows mode; the same
// effect made mask-unsafe (it rewrites its host's style) fails windows alone.
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runEffectKit} from '../../scripts/effect-kit.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const failures = [];
const ids = (run) => run.results.map((result) => result.id).sort();
const failed = (run) => run.results.filter((result) => !result.ok).map((result) => result.id).sort();

const good = await runEffectKit(join(fixtures, 'effect-sample'), out);
if (!good.ok) failures.push({case: 'a rule-keeping effect passes', got: good.results.filter((result) => !result.ok)});
const eleven = ['accessibility', 'cleanup', 'defaults', 'hidden-tab', 'manifest', 'mounts', 'no-network', 'pixel-ratio', 'remount', 'still-motion', 'update'];
if (ids(good).join() !== eleven.join()) failures.push({case: 'a 1.0 manifest gets the eleven 1.0 checks alone', got: ids(good)});

const bad = await runEffectKit(join(fixtures, 'effect-bad'), out);
const expected = ['cleanup', 'hidden-tab', 'no-network', 'still-motion'];
if (failed(bad).join() !== expected.join()) failures.push({case: 'a rule-breaking effect fails those rules', got: failed(bad), expected});

const schemes = await runEffectKit(join(fixtures, 'effect-schemes'), out);
const declared = ['contrast-dark', 'contrast-light', 'scheme-dark', 'scheme-light', 'scheme-switch', 'windows'];
if (!schemes.ok) failures.push({case: 'a two-scheme, windows-capable effect passes', got: schemes.results.filter((result) => !result.ok)});
if (!declared.every((id) => ids(schemes).includes(id))) failures.push({case: 'the 1.1 checks run for what the manifest declares', got: ids(schemes), expected: declared});

// Mask-unsafe: the same scene, but the effect rewrites its host's style and so
// drops the mask the windows mode laid on it.
const unsafe = mkdtempSync(join(tmpdir(), 'effect-windows-unsafe-'));
try {
  cpSync(join(fixtures, 'effect-schemes'), unsafe, {recursive: true});
  const module = join(unsafe, 'sample-bands.js');
  const source = readFileSync(module, 'utf8');
  const anchor = "  host.append(canvas);\n";
  if (!source.includes(anchor)) throw new Error('the mask-unsafe variant needs its anchor in sample-bands.js');
  writeFileSync(module, source.replace(anchor, `${anchor}  host.style.cssText = 'position:absolute;inset:0;pointer-events:none';\n`));
  const masked = await runEffectKit(unsafe, out);
  if (failed(masked).join() !== 'windows') failures.push({case: 'a mask-unsafe effect fails windows alone', got: failed(masked)});
} finally {
  rmSync(unsafe, {recursive: true, force: true});
}

console.log(JSON.stringify({good: good.results, bad: bad.results, schemes: schemes.results}));
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('EFFECT_KIT_OK');
