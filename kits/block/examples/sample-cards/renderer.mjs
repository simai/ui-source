// sample.cards: cards from a host's source, made from the SIMAI Framework
// block author kit. It shows the one block editor's parts a block brings:
//
// - layout parameters as utilities: `cols` and `gap` declare the SIMAI
//   Framework utility they become (x-simai-utility). The renderer writes no
//   grid class of its own; the Composition runtime adds grid-col-* and gap-*
//   per screen to the element that carries the node id;
// - a named place: the `intro` slot takes text blocks only (groups: text);
// - data: `items` takes the `cards` shape from a host binding. The block never
//   fetches; it draws what it is given in each state (loading, empty, error,
//   ready, preview), and a failing source stays inside it;
// - a runtime state: it publishes `pagination` from its items, which a
//   pagination block in the same section binds to.

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function safeUrl(value) {
  if (typeof value !== 'string') return null;
  if (/^(?:\/|\.?\.\/|#)/u.test(value)) return value.startsWith('//') || value.includes('\\') ? null : value;
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

const EMPTY = { en: 'Nothing here yet', ru: 'Здесь пока пусто' };
const FAILED = { en: 'The cards cannot be shown now', ru: 'Карточки сейчас не показать' };

function card(item) {
  const href = safeUrl(item.url);
  const src = item.image && safeUrl(item.image.src);
  const picture = src ? `<img class="sample-cards-picture" src="${escapeHtml(src)}" alt="${escapeHtml(item.image.alt ?? '')}" loading="lazy">` : '';
  const title = href ? `<a href="${escapeHtml(href)}">${escapeHtml(item.title)}</a>` : escapeHtml(item.title);
  const text = item.text ? `<p class="sample-cards-text">${escapeHtml(item.text)}</p>` : '';
  return `<article class="sample-cards-card">${picture}<h3 class="sample-cards-title">${title}</h3>${text}</article>`;
}

export default function renderCards({ node, slots, resolvedBindings = {}, bindingStates = {}, locale }) {
  const tone = node.props?.tone ?? 'plain';
  const state = bindingStates.items ?? 'loading';
  const language = locale === 'ru' ? 'ru' : 'en';
  const settings = node.extensions?.['simai.composition:data']?.items;
  const intro = slots.intro ? `<div class="sample-cards-intro">${slots.intro}</div>` : '';
  let body;
  if (state === 'ready' || state === 'preview') body = resolvedBindings.items.items.map(card).join('');
  else if (state === 'empty') body = `<p class="sample-cards-state">${escapeHtml(settings?.empty_text ?? EMPTY[language])}</p>`;
  else if (state === 'error') body = `<p class="sample-cards-state" role="status">${escapeHtml(FAILED[language])}</p>`;
  else body = '<div class="sample-cards-card sample-cards-card--loading" aria-busy="true"></div>';
  const preview = state === 'preview' ? ' data-preview=""' : '';
  return `<section class="sample-cards sample-cards--${escapeHtml(tone)} grid" data-state="${escapeHtml(state)}"${preview} data-sf-composition-id="${escapeHtml(node.id)}">${intro}${body}</section>`;
}
