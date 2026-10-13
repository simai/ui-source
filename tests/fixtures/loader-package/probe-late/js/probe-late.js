// Registered by the probe after the page is up, while the element is already
// in the document: the Loader has to read the page again to load it.
(() => {
  const from = document.currentScript ? document.currentScript.src : '';
  if (customElements.get('sf-probe-late')) return;
  customElements.define('sf-probe-late', class extends HTMLElement {
    connectedCallback() {
      this.dataset.loadedFrom = from;
      this.textContent = 'late package element';
    }
  });
})();
