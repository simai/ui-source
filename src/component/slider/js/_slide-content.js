// Ignore source formatting, not authored slide boundaries. Non-Node values are
// retained for the existing Slider template context (including Lit results).
export function normalizeSlideContent(content) {
  const items = Array.isArray(content) ? content : [content];
  return items.filter((item) => {
    if (!(item instanceof Node)) return true;
    if (item.nodeType === Node.COMMENT_NODE) return false;
    return item.nodeType !== Node.TEXT_NODE || item.textContent.trim() !== '';
  });
}
