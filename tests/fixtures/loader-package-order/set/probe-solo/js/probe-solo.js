// A component only the set defines: it loads whichever package keeps the shared one.
(() => {
  if (customElements.get('sf-probe-solo')) return;
  customElements.define('sf-probe-solo', class extends HTMLElement {
    connectedCallback() { this.textContent = 'solo'; }
  });
})();
