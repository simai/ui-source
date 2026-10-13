// The smallest component a package can carry: it says where it was loaded
// from, so the probe can tell the package base from the Smart base.
(() => {
  const from = document.currentScript ? document.currentScript.src : '';
  if (customElements.get('sf-probe-badge')) return;
  customElements.define('sf-probe-badge', class extends HTMLElement {
    connectedCallback() {
      this.dataset.loadedFrom = from;
      this.textContent = 'package badge';
    }
  });
})();
