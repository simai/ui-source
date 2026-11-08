#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/distr
//
// Package modules of the shared runtime (core/js/package-modules.js,
// core.runtime 1.38.0) in a real browser. The node contract test imports two
// copies of the module into one process; this probe loads separately built
// bundles into one page, which is where module-scope state would split:
//
// - core/js/core.js and core/js/smart-base.js, as the release builds them,
//   each with its own copy of package-modules.js;
// - a package core bundle and a component bundle, each a classic script with
//   its own copy of src/core/js/package-modules.js (as ui-builder inlines one
//   into every bundle that imports it).
//
// Every way of asking resolves the one module instance; a bundle built for
// another ABI of the package is refused with a clear error, and so is a
// second copy of the package's core with another ABI. Both script orders.
import {readFileSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('distr root is required');
const distrRoot = resolve(process.argv[2]);
const source = readFileSync(fileURLToPath(new URL('../../src/core/js/package-modules.js', import.meta.url)), 'utf8');
for (const file of ['core.js', 'smart-base.js']) {
  if (!readFileSync(join(distrRoot, 'core', 'js', file), 'utf8').includes('__sfRuntimePackages')) {
    throw new Error(`${file} of ${distrRoot} carries no package registry (core.runtime >= 1.38.0 needed)`);
  }
}

// A bundle of its own: the module's source as a classic script, its exports
// on one name. The rewrite must touch every export, or the copy is not one.
const exportsCount = (source.match(/^export /gmu) || []).length;
const body = source.replace(/^export (?=(?:const|function) )/gmu, '');
const names = [...source.matchAll(/^export (?:const|function) ([A-Za-z_$][A-Za-z0-9_$]*)/gmu)].map((match) => match[1]);
if (!exportsCount || names.length !== exportsCount || /^export /mu.test(body)) {
  throw new Error(`package-modules.js export rewrite matched ${names.length} of ${exportsCount} exports`);
}
const bundle = (global, tail) => `(() => {\n${body}\nwindow.${global} = {${names.join(', ')}};\n${tail}\n})();\n`;
// The package core: registers through the page's SF.runtimeModule.register,
// as a ui-builder package core does.
const PACKAGE_CORE = bundle('__probeCoreCopy', `
const scale = {linearScale: (domain) => domain.map((value) => value * 2)};
window.__probeRegistered = SF.runtimeModule.register('probe', 1, {scale});
`);
// A component of the package: asks its own copy of the module, not SF.
const COMPONENT = bundle('__probeComponentCopy', `
window.__probeComponentAsk = (abi) => window.__probeComponentCopy.packageModule('probe/scale', abi);
`);

const ORIGIN = 'http://probe.test';
const TYPES = {'.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8'};
const failures = [];
const browser = await chromium.launch();
try {
  for (const order of [['core.js', 'smart-base.js'], ['smart-base.js', 'core.js']]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text().split('\n')[0]);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    await page.route(`${ORIGIN}/**`, (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      if (path === '/') return route.fulfill({status: 200, contentType: TYPES['.html'], body: '<!doctype html><meta charset="utf-8"><title>probe</title>'});
      if (path === '/package-core.js') return route.fulfill({status: 200, contentType: TYPES['.js'], body: PACKAGE_CORE});
      if (path === '/component.js') return route.fulfill({status: 200, contentType: TYPES['.js'], body: COMPONENT});
      const file = resolve(distrRoot, `.${path}`);
      if (!file.startsWith(distrRoot + sep)) return route.fulfill({status: 404, body: ''});
      try {
        return route.fulfill({status: 200, contentType: TYPES[extname(file)] || 'application/octet-stream', body: readFileSync(file)});
      } catch {
        return route.fulfill({status: 404, body: ''});
      }
    });
    await page.goto(`${ORIGIN}/`);
    const lookups = [];
    for (const file of order) {
      await page.addScriptTag({url: `${ORIGIN}/core/js/${file}`});
      lookups.push(await page.evaluate((name) => {
        (window.__probeLookups ||= {})[name] = window.SF.runtimeModule;
        return name;
      }, file));
    }
    // The component asks before the package core has run: it waits.
    await page.addScriptTag({url: `${ORIGIN}/component.js`});
    await page.evaluate(() => {
      window.__probeEarly = window.__probeComponentAsk(1);
      window.__probeEarlySettled = false;
      window.__probeEarly.then(() => { window.__probeEarlySettled = true; });
    });
    await page.waitForTimeout(20);
    const settledBefore = await page.evaluate(() => window.__probeEarlySettled);
    await page.addScriptTag({url: `${ORIGIN}/package-core.js`});

    const result = await page.evaluate(async () => {
      const SF = window.SF;
      const early = await window.__probeEarly;
      const viaPage = await SF.runtimeModule('probe/scale', 1);
      const viaCore = await window.__probeLookups['core.js']('probe/scale', 1);
      const viaBase = await window.__probeLookups['smart-base.js']('probe/scale', 1);
      const viaComponent = await window.__probeComponentAsk(1);
      const viaPackageCopy = await window.__probeCoreCopy.packageModule('probe/scale', 1);
      const instances = [early, viaPage, viaCore, viaBase, viaComponent, viaPackageCopy];
      const reason = async (run) => {
        try {
          await run();
          return null;
        } catch (error) {
          return String(error && error.message);
        }
      };
      return {
        registered: window.__probeRegistered,
        copies: new Set([window.__probeCoreCopy.packageRegistry, window.__probeComponentCopy.packageRegistry]).size,
        oneRegistry: window.__probeCoreCopy.packageRegistry() === window.__probeComponentCopy.packageRegistry(),
        sameInstance: instances.every((module) => module === viaPage),
        works: viaPage.linearScale([1, 2]).join(','),
        coreStill: Boolean(await SF.runtimeModule('smart-base', SF.__internal.runtimeAbi)),
        abiAsk: await reason(() => SF.runtimeModule('probe/scale', 2)),
        abiAskComponent: await reason(() => window.__probeComponentAsk(2)),
        abiRegister: await reason(() => SF.runtimeModule.register('probe', 2, {scale: {}})),
        sameAbiKeeps: (SF.runtimeModule.register('probe', 1, {scale: {other: true}}), (await SF.runtimeModule('probe/scale', 1)) === viaPage),
        shadow: await reason(() => SF.runtimeModule.register('lit', 1, {x: {}})),
        missing: await reason(() => SF.runtimeModule('probe/axis', 1)),
      };
    });
    await page.close();

    const label = order.join(' then ');
    const expect = (ok, what) => { if (!ok) failures.push(`${label}: ${what}`); };
    expect(settledBefore === false, 'the early ask settled before the package core ran');
    expect(JSON.stringify(result.registered) === '["probe/scale"]', `registered ${JSON.stringify(result.registered)}`);
    expect(result.copies === 2, 'the two classic bundles do not carry two copies of the module');
    expect(result.oneRegistry, 'two copies of the module see two registries');
    expect(result.sameInstance, 'the asks resolved different module instances');
    expect(result.works === '2,4', `the module does not work: ${result.works}`);
    expect(result.coreStill, 'a Core runtime id no longer resolves');
    expect(/built for ABI 2 of package "probe".*ABI 1/u.test(result.abiAsk || ''), `ABI 2 ask through SF: ${result.abiAsk}`);
    expect(/built for ABI 2 of package "probe".*ABI 1/u.test(result.abiAskComponent || ''), `ABI 2 ask through the component copy: ${result.abiAskComponent}`);
    expect(/already registered with ABI 1; a copy with ABI 2 is refused/u.test(result.abiRegister || ''), `ABI 2 registration: ${result.abiRegister}`);
    expect(result.sameAbiKeeps, 'a second registration with the same ABI replaced the first instance');
    expect(/named after a namespace of the runtime/u.test(result.shadow || ''), `lit registration: ${result.shadow}`);
    expect(/has no shared module "axis"/u.test(result.missing || ''), `missing module: ${result.missing}`);
    // The refusals say so on the console, and nothing else does.
    const expected = [/built for ABI 2/u, /built for ABI 2/u, /a copy with ABI 2 is refused/u, /named after a namespace/u, /has no shared module/u];
    const unexpected = errors.filter((text) => !expected.some((pattern) => pattern.test(text)));
    expect(unexpected.length === 0, `console: ${JSON.stringify(unexpected)}`);
    expect(errors.length === expected.length, `expected ${expected.length} refusals on the console, saw ${errors.length}: ${JSON.stringify(errors)}`);
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
process.stdout.write('Package runtime modules: PASS — core.js, smart-base.js and two package bundles resolve one instance in both orders; ABI 2 refused on ask and on registration\n');
