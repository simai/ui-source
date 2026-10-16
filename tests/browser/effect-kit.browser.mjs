#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The simai.effect 1.0.0 kit (scripts/effect-kit.mjs) on the built core: an
// effect that keeps the rules passes every check, and one that breaks them --
// it asks the network, draws through reduced motion and a hidden tab, leaves
// its node behind -- fails exactly those.
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runEffectKit} from '../../scripts/effect-kit.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const failures = [];
const good = await runEffectKit(join(fixtures, 'effect-sample'), out);
if (!good.ok) failures.push({case: 'a rule-keeping effect passes', got: good.results.filter((result) => !result.ok)});
const bad = await runEffectKit(join(fixtures, 'effect-bad'), out);
const failed = bad.results.filter((result) => !result.ok).map((result) => result.id).sort();
const expected = ['cleanup', 'hidden-tab', 'no-network', 'still-motion'];
if (failed.join() !== expected.join()) failures.push({case: 'a rule-breaking effect fails those rules', got: failed, expected});
console.log(JSON.stringify({good: good.results, bad: bad.results}));
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('EFFECT_KIT_OK');
