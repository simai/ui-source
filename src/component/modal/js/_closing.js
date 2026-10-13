// Keep the closing dialog itself meaningful while its visible content becomes
// non-interactive. Restore only temporary inert attributes owned by this lease.
function freezeModalContent(panel, focusPanel = false) {
  if (!panel) return () => {};
  const owned = new Set();
  const freeze = () => {
    for (const child of panel.children) {
      if (!child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        owned.add(child);
      }
    }
  };
  if (focusPanel) panel.focus({ preventScroll: true });
  freeze();
  const observer = new panel.ownerDocument.defaultView.MutationObserver(freeze);
  observer.observe(panel, { childList: true });
  return () => {
    observer.disconnect();
    for (const child of owned) {
      if (child.getAttribute('inert') === '') child.removeAttribute('inert');
    }
    owned.clear();
  };
}

export { freezeModalContent };
