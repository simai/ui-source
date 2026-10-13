// The shared Smart runtime as a script of its own: core/js/smart-base.js.
// Core loads it beside core.js the first time a Smart element is wanted; a
// page or a test may also include it by hand, before or after core.js. It
// publishes the modules the Smart bundles are built against, and the runtime's
// lookup when Core has not (a page that runs Smart elements without Core).
import { RUNTIME_MODULES } from './js/runtime';

const SF = (window.SF = window.SF || {});
SF.runtimeModules = RUNTIME_MODULES;
if (!SF.runtimeModule) {
  SF.runtimeModule = (id) => (RUNTIME_MODULES[id]
    ? Promise.resolve(RUNTIME_MODULES[id])
    : Promise.reject(new Error(`SF runtime: no shared module "${id}"`)));
}
if (typeof SF.runtimeArrived === 'function') SF.runtimeArrived(RUNTIME_MODULES);
try {
  window.dispatchEvent(new CustomEvent('sf-runtime-ready', {detail: {modules: Object.keys(RUNTIME_MODULES)}}));
} catch (error) {
  console.warn('sf-runtime-ready dispatch failed', error);
}
