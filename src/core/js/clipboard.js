// Copying text, with the fallback (reuse audit 2026-11-02, finding 11). The
// clipboard class component and sf-copy-button each wrote this, and
// chat-message a third time; the order is theirs: the Clipboard API on a
// secure page, and execCommand('copy') over a hidden field where the API is
// absent or refused. A secure page whose clipboard permission is denied -- a
// policy, an embedded frame, a browser that asked and was answered no -- has
// the API and still refuses it; reading "present" as "allowed" left the
// fallback that exists for exactly this unreached (component/clipboard,
// 2026-10).

/**
 * Copies `text`. Settles with how it was copied, 'native' or 'legacy', or
 * rejects: Error('copy_unsupported') when the fallback copied nothing, or the
 * platform's own error (NotAllowedError, SecurityError) when it threw.
 * `document` is the document whose body holds the fallback field: the
 * element's own, for a component in another frame.
 */
export async function copyText(text, {document: documentRef = globalThis.document} = {}) {
  const value = String(text ?? '');
  const view = documentRef?.defaultView ?? globalThis;
  if (view.isSecureContext && view.navigator?.clipboard?.writeText) {
    try {
      await view.navigator.clipboard.writeText(value);
      return 'native';
    } catch {
      // Refused: the fallback is for exactly this.
    }
  }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') throw new Error('copy_unsupported');
  const area = documentRef.createElement('textarea');
  // The class is the clipboard component's (its sheet hides it); the inline
  // style keeps the field out of sight on a page without that sheet.
  area.className = 'sf-clipboard-fallback';
  area.value = value;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;inset-inline-start:-9999px;inset-block-start:0;opacity:0';
  documentRef.body.append(area);
  area.select();
  // iOS selects nothing on select() alone.
  area.setSelectionRange?.(0, value.length);
  let copied = false;
  try {
    copied = documentRef.execCommand('copy');
  } finally {
    area.remove();
  }
  if (!copied) throw new Error('copy_unsupported');
  return 'legacy';
}

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it. SF.Clipboard (capital C)
// is the clipboard component's script API; this is the bare function.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.copyText) globalThis.SF.copyText = copyText;
}

export default copyText;
