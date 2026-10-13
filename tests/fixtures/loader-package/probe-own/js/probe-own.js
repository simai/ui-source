// A package element named with its owner's prefix rather than sf-
// (standard simai.component-package, own-element-prefix).
(() => {
  const from = document.currentScript ? document.currentScript.src : '';
  if (customElements.get('pr-own')) return;
  customElements.define('pr-own', class extends HTMLElement {
    connectedCallback() {
      this.dataset.loadedFrom = from;
      this.textContent = 'own prefix';
    }
  });
})();
