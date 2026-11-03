// product.block-name: the SIMAI Framework block author kit's template
// (docs/developer/block-author-guide.md). Rename it with
// `node kits/block/new.mjs <product>.<name> <folder>`, then change the data,
// the parameters and the HTML; `node kits/block/check.mjs <folder>` says what
// the block still needs.
//
// A renderer is a pure function: the node in, a string of HTML out. It escapes
// every value it writes, writes no script and no handler, places each slot it
// declares, marks its element with the node's id, and leaves the node as it
// came.

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export default function renderBlock({ node, slots }) {
  const tone = node.props?.tone ?? 'neutral';
  return `<section class="product-block-name product-block-name--${escapeHtml(tone)}" data-sf-composition-id="${escapeHtml(node.id)}"><h3 class="product-block-name-title">${escapeHtml(node.data.title)}</h3>${slots.default || ''}</section>`;
}
