#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Gate 20 of standard simai.smart-component 1.3.8 for the navigation family
// built from its component.json (sf-menu, sf-tabs, sf-accordion,
// sf-breadcrumbs, sf-steps, sf-pagination): each folder's probe.json, run on
// the built bytes with the real Loader by the overlay family's runner
// (overlays-manifest.browser.mjs, the stands/15-scenarios format), with
// SF_OVERLAYS naming these folders.
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

if (!process.argv[2]) throw new Error('Build output root is required');
const runner = join(dirname(fileURLToPath(import.meta.url)), 'overlays-manifest.browser.mjs');
const folders = process.env.SF_NAVIGATION || 'menu,tabs,accordion,breadcrumbs,steps,pagination';
execFileSync(process.execPath, [runner, resolve(process.argv[2])], {stdio: 'inherit', env: {...process.env, SF_OVERLAYS: folders}});
