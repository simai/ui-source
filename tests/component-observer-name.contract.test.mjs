import assert from 'node:assert/strict';
import test from 'node:test';

// Components name themselves with a static field; the lifecycle events read the
// instance, which had no such property, so every component announced
// `undefined:beforeRender`, `undefined:render` and `undefined:destroy`.

test('a component announces its lifecycle under its own name', async () => {
  const events = [];
  globalThis.window = {dispatchEvent: (event) => events.push(event.type)};
  globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  const {ComponentObserver} = await import('../src/core/js/ComponentObserver.js');
  class Modal extends ComponentObserver { static componentName = 'Modal'; }
  new Modal({});
  assert.deepEqual(events, ['Modal:beforeRender']);
});

// The Loader writes the name on the prototype when it registers a class; that
// assignment must keep working (an accessor on the base made it throw, and no
// component announced component:ready).
test('the Loader can still write a component name on the prototype', async () => {
  const {ComponentObserver} = await import('../src/core/js/ComponentObserver.js');
  class Toast extends ComponentObserver { static componentName = 'Toast'; }
  assert.doesNotThrow(() => { Toast.prototype.componentName = 'Toast'; });
});
