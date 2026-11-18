// Children a page writes into a panel's host after the panel connected
// (Larena LF-3, 2026-11-18): sf-modal and sf-drawer took their content once,
// when they connected, so a body fetched and written while the panel was
// open stayed in the host -- out of the panel, and on the page itself, as the
// host draws no box of its own. The panel watches its host instead: what the
// page writes there later is handed to `take`, in the order written, once per
// batch of changes (one task's writes arrive together).
//
// Not content: static markup (a picture of the element, §5.4), a settings
// island, a comment and white space.
export function isLateContent(node) {
  if (node.nodeType === 3) return node.textContent.trim() !== '';
  if (node.nodeType !== 1) return false;
  if (node.hasAttribute('data-sf-static')) return false;
  return !(node.localName === 'script' && node.hasAttribute('data-sf-settings'));
}

export function watchLateChildren(host, take) {
  const observer = new MutationObserver((records) => {
    const added = [];
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.parentNode === host && !added.includes(node) && isLateContent(node)) added.push(node);
      }
    }
    if (added.length) take(added);
  });
  observer.observe(host, {childList: true});
  return observer;
}
