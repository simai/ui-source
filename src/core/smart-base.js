// The shared Smart runtime as a script of its own: core/js/smart-base.js.
// Core loads it beside core.js the first time a Smart element is wanted; a
// page or a test may also include it by hand, before or after core.js. It
// publishes the modules the Smart bundles are built against, and the runtime's
// lookup when Core has not (a page that runs Smart elements without Core).
//
// The modules Core runs itself are handed out as Core's instances when Core is
// on the page (js/runtime.js SHARED_MODULES, js/core-modules.js).
import { RUNTIME_ABI, SHARED_MODULES as RUNTIME_MODULES, checkRuntimeAbi } from './js/runtime';
import './js/internal.js';

const SF = (window.SF = window.SF || {});
SF.__internal.runtimeAbi = RUNTIME_ABI;
SF.__internal.runtimeModules = RUNTIME_MODULES;
if (!SF.runtimeModule) {
  SF.runtimeModule = (id, abi) => {
    try {
      checkRuntimeAbi(id, abi, RUNTIME_ABI);
    } catch (error) {
      return Promise.reject(error);
    }
    return RUNTIME_MODULES[id]
      ? Promise.resolve(RUNTIME_MODULES[id])
      : Promise.reject(new Error(`SF runtime: no shared module "${id}"`));
  };
}
if (typeof SF.__internal.runtimeArrived === 'function') SF.__internal.runtimeArrived(RUNTIME_MODULES);
try {
  window.dispatchEvent(new CustomEvent('sf-runtime-ready', {detail: {modules: Object.keys(RUNTIME_MODULES), abi: RUNTIME_ABI}}));
} catch (error) {
  console.warn('sf-runtime-ready dispatch failed', error);
}
