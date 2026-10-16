// A kit fixture that breaks the rules on purpose: it asks the network, draws
// on through reduced motion and a hidden tab, and leaves its node behind.
export function mount(host) {
  const node = document.createElement('div');
  host.append(node);
  fetch('/phone-home').catch(() => {});
  const tick = () => { requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return {update() {}, pause() {}, resume() {}, destroy() { document.body.append(node); }};
}
