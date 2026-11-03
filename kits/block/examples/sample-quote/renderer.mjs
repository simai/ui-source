// sample.quote: a quote with its author, drawn from the SIMAI Framework block
// author kit's template (kits/block/template/). It shows the parts a block
// brings: a closed data and props schema, a slot of paragraphs (their inline
// text, links and marks stay the Framework's), an address checked by the
// renderer itself, and its own sheet as an asset (sample/quote, style.css).
//
// A renderer is a pure function: the node in, a string of HTML out. It escapes
// every value it writes, writes no script and no handler, and leaves the node
// as it came.

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// The Document's URL rule (relative, a fragment, http(s), mailto, tel). The
// Composition validator applies it to the SIMAI Framework's own types; a
// product type's data is its renderer's to check.
function safeUrl(value) {
  if (typeof value !== 'string') return null;
  if (/^(?:\/|\.?\.\/|#)/u.test(value)) return value.startsWith('//') || value.includes('\\') ? null : value;
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

export default function renderQuote({ node, slots }) {
  const { author, role, source } = node.data;
  const align = node.props?.align ?? 'start';
  const size = node.props?.size ?? 'default';
  const href = safeUrl(source);
  const classes = ['sample-quote', `sample-quote--${align}`, `sample-quote--${size}`].map(escapeHtml).join(' ');
  const name = href ? `<a class="sample-quote-author" href="${escapeHtml(href)}">${escapeHtml(author)}</a>` : `<span class="sample-quote-author">${escapeHtml(author)}</span>`;
  const roleText = role ? `<span class="sample-quote-role">${escapeHtml(role)}</span>` : '';
  const cite = href ? ` cite="${escapeHtml(href)}"` : '';
  return `<figure class="${classes}" data-sf-composition-id="${escapeHtml(node.id)}"><blockquote class="sample-quote-text"${cite}>${slots.default || ''}</blockquote><figcaption class="sample-quote-caption">${name}${roleText}</figcaption></figure>`;
}
