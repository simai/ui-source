// A headless stand for the assembly runtime: an assembly's bus with fake
// parts, no DOM. A fake part records what it is told and answers its actions
// from `behaviours[tag][action]` (an outcome, or a function of the args).
/* global setTimeout */

import {AssemblyCore, compile, interfaces, journal} from '../../../src/core/js/assembly/index.mjs';

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A promise and the hands that settle it. */
export function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
}

export function registerParts(map) {
  for (const [tag, iface] of Object.entries(map)) interfaces.register(tag, iface);
}

let counter = 0;

export function mount(manifest, {settings = {}, children = [], behaviours = {}, locale = 'en', lang = {}, view = null} = {}) {
  journal.force(true);
  const parts = new Map();
  const createLink = (rec, context) => {
    const fake = {rec, context, sets: [], calls: [], ports: [], values: {}, started: false, disposed: false, valid: undefined};
    parts.set(rec.instanceId, fake);
    return {
      set: (name, value) => fake.sets.push([name, value]),
      get: (name) => fake.values[name],
      valid: () => fake.valid,
      act(action, args, options) {
        fake.calls.push({action, args, options});
        const answer = behaviours[rec.def.tag]?.[action];
        return typeof answer === 'function' ? answer(args, options, fake) : answer;
      },
      connectPort: (port) => fake.ports.push(port),
      start: () => { fake.started = true; },
      dispose: () => { fake.disposed = true; },
    };
  };
  const definitions = new Map(children.map((child) => [child.tag, compile(child)]));
  const definition = compile(manifest, {lang});
  const out = {values: [], events: [], errors: []};
  const id = `page/t${++counter}`;
  const baseView = {
    interfaceOf: (tag) => interfaces.of(tag),
    isAssembly: (tag) => definitions.has(tag),
    roleFlags: () => [],
    locale: () => locale,
    error: (kind, text) => out.errors.push(`${kind}: ${text}`),
  };
  const core = new AssemblyCore(definition, {
    instanceId: id, settings, definitions,
    view: {...baseView, createPart: headlessCreate(createLink, definitions, locale, out), ...(view ?? {})},
    frame: {
      report: (values, options = {}) => out.values.push({values, origin: options.origin ?? null}),
      emit: (verb, detail, options = {}) => { out.events.push({verb, detail, chain: options.chain ?? []}); },
    },
  });
  core.start();
  const fakeOf = (path) => parts.get(`${id}/${path}`);
  return {
    core, parts, out, definition, id,
    part: fakeOf,
    emit: (path, verb, detail = {}, options) => fakeOf(path).context.emit(verb, detail, options),
    report: (path, values) => fakeOf(path).context.report(values),
    lastSet: (path, name) => fakeOf(path)?.sets.filter(([member]) => member === name).at(-1)?.[1],
    setsOf: (path, name) => fakeOf(path)?.sets.filter(([member]) => member === name).map(([, value]) => value) ?? [],
    errors: () => journal.entries(`${id}`).concat(journal.entries(`${id}/`)).filter((entry) => entry.level === 'error').map((entry) => entry.text),
  };
}

function headlessCreate(createLink, definitions, locale, out) {
  return function createPart(rec, context) {
    const child = definitions.get(rec.def.tag);
    if (!child) return createLink(rec, context);
    const core = new AssemblyCore(child, {
      instanceId: rec.instanceId, signal: context.signal, definitions,
      view: {interfaceOf: (tag) => interfaces.of(tag), isAssembly: (tag) => definitions.has(tag), roleFlags: () => [], locale: () => locale,
        error: (kind, text) => out.errors.push(`${kind}: ${text}`), createPart: headlessCreate(createLink, definitions, locale, out)},
      frame: {report: (values) => context.report(values), emit: (verb, detail, options) => context.emit(verb, detail, options)},
    });
    rec.child = core;
    return {
      set: (name, value) => { core.setSetting(name, value); },
      get: (name) => core.value(name),
      act: (action, args, options = {}) => core.act(action, args, options),
      connectPort: (port) => { core.connectPort(port); },
      start: () => { core.start(); },
      dispose: () => { core.dispose(); },
    };
  };
}
