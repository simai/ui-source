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
export function renderContentsTemplate(context) {
  const {component, id, layout, collapse, size, sticky, open, compact, label, sections, current, progress, rootClass} = context;
  const labelId = `${id}-label`;
  const level = Math.min(6, Math.max(2, Math.round(Number(context.headingLevel)) || 2));
  const more = layout === 'bar' && context.overflow !== 'scroll';
  const listId = `${id}-list`;
  const currentSection = sections.find((section) => section.id === current) ?? sections[0];
  const currentText = currentSection?.text ?? '';
  const top = sections.reduce((lowest, section) => Math.min(lowest, section.level), Infinity);
  const classes = [
    'sf-contents',
    `sf-contents--layout-${layout}`,
    layout === 'auto' ? `sf-contents--collapse-${collapse}` : '',
    `sf-contents--size-${size === '1' ? '1' : 'half'}`,
    sticky ? 'sf-contents--sticky' : '',
    open ? 'sf-contents--open' : '',
    more ? 'sf-contents--overflow-more' : '',
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
    <ol class="sf-contents-list" id=${listId} role="list">
      ${sections.map((section) => html`<li class="sf-contents-item" data-depth=${Math.max(0, section.level - (Number.isFinite(top) ? top : section.level))}>
        <a class="sf-contents-link" href=${`#${section.id}`} aria-current=${section.id === current ? 'location' : nothing}
          @click=${(event) => component.choose(event, section.id)}><span class="sf-contents-mark" aria-hidden="true"></span><span class="sf-contents-text">${section.text}</span></a>
      </li>`)}
    </ol>
    ${more ? html`<sf-button class="sf-contents-more" appearance="ghost" scheme="on-surface" size=${size}
      icon-end="expand_more" text=${context.moreText} aria-haspopup="menu"
      @click=${(event) => component.openMore(event.currentTarget)}></sf-button>` : nothing}
  </nav>`;
}
