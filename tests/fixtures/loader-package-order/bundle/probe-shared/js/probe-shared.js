// sf-probe-shared from package order-bundle: it says which copy the page got.
(() => {
  if (customElements.get('sf-probe-shared')) return;
  customElements.define('sf-probe-shared', class extends HTMLElement {
    connectedCallback() {
      this.dataset.package = 'order-bundle';
      this.textContent = 'order-bundle';
    }
  });
})();
