import {html, nothing} from 'lit';

// One list drawn four ways. The root is a <nav> named by the label: a heading
// line, the compact view's button and progress line, and an ordered list of
// in-page links, the current one aria-current="location". Which parts show is
// the sheet's (scss/): column shows the heading and the list; compact the
// button and the progress, and the list as a raised panel while open; rail the
// list as strokes; bar the list as a row. layout auto is column or compact by a
// media rule, so the printed markup is right before the script arrives.
export function renderContentsTemplate(context) {
  const {component, id, layout, collapse, size, sticky, open, compact, label, sections, current, progress, rootClass} = context;
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
    rootClass,
  ].filter(Boolean).join(' ');
  return html`<nav class=${classes} style=${context.rootStyle || nothing} aria-label=${label}
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
    <span class="sf-contents-label" aria-hidden="true">${label}</span>
    <ol class="sf-contents-list" id=${listId} role="list">
      ${sections.map((section) => html`<li class="sf-contents-item" data-depth=${Math.max(0, section.level - (Number.isFinite(top) ? top : section.level))}>
        <a class="sf-contents-link" href=${`#${section.id}`} aria-current=${section.id === current ? 'location' : nothing}
          @click=${(event) => component.choose(event, section.id)}><span class="sf-contents-mark" aria-hidden="true"></span><span class="sf-contents-text">${section.text}</span></a>
      </li>`)}
    </ol>
  </nav>`;
}
