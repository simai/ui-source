import {html, nothing} from 'lit';

// One list drawn four ways. The root is a <nav> named by the label: a heading
// line, the compact view's button and progress line, and an ordered list of
// in-page links, the current one aria-current="location". Which parts show is
// the sheet's (scss/): column shows the heading and the list; compact the
// button and the progress, and the list as a raised panel while open; rail the
// list as strokes; bar the list as a row. layout auto is column or compact by a
// media rule, so the printed markup is right before the script arrives.
//
// The heading is a heading (role heading at heading-level) that names the
// navigation (aria-labelledby): shown in the column, hidden in the other
// layouts, where it still names the landmark (CT-09). The bar with overflow
// more ends in «Ещё (n)», which the element lays out (CT-05).
//
// C95 (owner, 2026-11-12): line says who draws the line -- the element (own),
// its host's divider (edge) or nobody (none); expand current folds the deeper
// entries outside the current branch; an entry with a count or a status
// carries a badge on the line of its text (sf-badge line="text") and says it
// in its name; the compact view's veil stands behind the open list, which is a
// bottom sheet on a phone.
const STATUSES = ['error', 'warning', 'success'];
const STATUS_ICONS = {error: 'error', warning: 'warning', success: 'check_circle'};

// The entries of the current branch: the top-level entry at or before the
// current one, and every deeper entry under it. Without a current entry, the
// first branch.
export function currentBranch(sections, current) {
  const depthOf = (section) => section.level - Math.min(...sections.map((one) => one.level));
  const at = Math.max(0, sections.findIndex((section) => section.id === current));
  let start = at;
  while (start > 0 && depthOf(sections[start]) > 0) start -= 1;
  const open = new Set();
  for (let index = start; index < sections.length; index += 1) {
    if (index > start && depthOf(sections[index]) === 0) break;
    open.add(sections[index].id);
  }
  return open;
}

export function renderContentsTemplate(context) {
  const {component, id, layout, collapse, size, sticky, open, compact, label, sections, current, progress, rootClass} = context;
  const labelId = `${id}-label`;
  const level = Math.min(6, Math.max(2, Math.round(Number(context.headingLevel)) || 2));
  const more = layout === 'bar' && context.overflow !== 'scroll';
  const listId = `${id}-list`;
  const currentSection = sections.find((section) => section.id === current) ?? sections[0];
  const currentText = currentSection?.text ?? '';
  const top = sections.reduce((lowest, section) => Math.min(lowest, section.level), Infinity);
  const line = ['edge', 'none'].includes(context.line) ? context.line : 'own';
  const folding = context.expand === 'current';
  const branch = folding ? currentBranch(sections, current) : null;
  const statusOf = (section) => (STATUSES.includes(section.status) ? section.status : '');
  const countOf = (section) => (Number.isFinite(section.count) && section.count > 0 ? Math.round(section.count) : 0);
  const classes = [
    'sf-contents',
    `sf-contents--layout-${layout}`,
    layout === 'auto' ? `sf-contents--collapse-${collapse}` : '',
    `sf-contents--size-${size === '1' ? '1' : 'half'}`,
    sticky ? 'sf-contents--sticky' : '',
    open ? 'sf-contents--open' : '',
    more ? 'sf-contents--overflow-more' : '',
    line !== 'own' ? `sf-contents--line-${line}` : '',
    folding ? 'sf-contents--expand-current' : '',
    rootClass,
  ].filter(Boolean).join(' ');
  return html`<nav class=${classes} style=${context.rootStyle || nothing} aria-labelledby=${labelId}
      @keydown=${(event) => component.onKeydown(event)}>
    <div class="sf-contents-head">
      <sf-button class="sf-contents-toggle" appearance="outline" scheme="on-surface" size=${size}
        icon-start="toc" icon-end="expand_more" text=${currentText || label} text-position="start" root-class="w-full"
        aria-label=${currentText ? `${label}: ${currentText}` : label} aria-controls=${listId}
        expanded=${compact && open ? '' : 'false'}
        @click=${() => component.toggle()}></sf-button>
      <span class="sf-contents-progress" aria-hidden="true"><span class="sf-contents-progress-value"
        style=${`--sf-contents--progress: ${progress}`}></span></span>
    </div>
    <div class="sf-contents-label" id=${labelId} role="heading" aria-level=${String(level)}>${label}</div>
    <span class="sf-contents-veil" aria-hidden="true" @click=${() => component.closeList({restoreFocus: true})}></span>
    <ol class="sf-contents-list" id=${listId} role="list">
      ${sections.map((section) => {
        const depth = Math.max(0, section.level - (Number.isFinite(top) ? top : section.level));
        const status = statusOf(section);
        const count = countOf(section);
        const marked = status || count;
        const folded = branch && depth > 0 && !branch.has(section.id);
        return html`<li class=${folded ? 'sf-contents-item sf-contents-folded' : 'sf-contents-item'} data-depth=${depth}>
        <a class=${marked ? 'sf-contents-link sf-contents-link--marked' : 'sf-contents-link'} href=${`#${section.id}`}
          aria-current=${section.id === current ? 'location' : nothing}
          aria-label=${marked ? component.markedName(section.text, {count, status}) : nothing}
          data-status=${status || nothing}
          @click=${(event) => component.choose(event, section.id)}><span class="sf-contents-mark" aria-hidden="true"></span><span class="sf-contents-text">${section.text}</span>${marked ? html`<sf-badge class="sf-contents-count" line="text"
            status=${status || nothing} appearance=${status ? 'main' : 'tonal'} text=${count ? String(count) : nothing}
            icon=${!count && status ? STATUS_ICONS[status] : nothing} icon-only=${!count && status ? '' : nothing}
            aria-hidden="true"></sf-badge>` : nothing}</a>
      </li>`;
      })}
    </ol>
    ${more ? html`<sf-button class="sf-contents-more" appearance="ghost" scheme="on-surface" size=${size}
      icon-end="expand_more" text=${context.moreText} aria-haspopup="menu"
      @click=${(event) => component.openMore(event.currentTarget)}></sf-button>` : nothing}
  </nav>`;
}
