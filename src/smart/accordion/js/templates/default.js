import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {BADGE_SIZE, REGION_LIMIT, markerGlyph} from '../../sections.mjs';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The class accordion's own classes: the size on the ladder, the appearance,
// the marker, and the states its runtime writes (active, static).
function sectionClasses(context, section, open) {
  return joinClasses(
    'sf-accordion',
    context.size ? `sf-accordion--size-${context.size}` : '',
    context.appearance && context.appearance !== 'default' ? `sf-accordion--${context.appearance}` : '',
    context.marker === 'plus-minus' ? 'sf-accordion--plus-minus' : '',
    context.isStatic ? 'sf-accordion--static' : '',
    section.disabled && !context.isStatic ? 'sf-accordion--disabled' : '',
    open ? 'active' : '',
  );
}

// The content: the host's markup from the slot the section names, else its
// text. Text is never parsed as markup.
function renderContent(context, section) {
  const {component} = context;
  if (section.slot && component?.hasSlotContent?.(section.slot)) return component.getSlotContent(section.slot);
  return section.content || nothing;
}

// What stands in the header: an icon before the title, the title, a badge
// after it, then the class accordion's marker.
function renderHeaderContent(context, section, open) {
  return html`
    ${section.icon ? html`<i class="sf-icon sf-accordion-lead" aria-hidden="true">${section.icon}</i>` : nothing}
    <span class="sf-accordion-title">${section.title}</span>
    ${section.badge
      ? html`<sf-badge class="sf-accordion-badge" size=${BADGE_SIZE[context.size] || '1/3'} text=${section.badge}></sf-badge>`
      : nothing}
    ${context.isStatic ? nothing : html`<i class="sf-icon" aria-hidden="true">${markerGlyph(context.marker, open)}</i>`}
  `;
}

function renderSection(context, section, index) {
  const open = context.open.has(section.id);
  const triggerId = `${context.id}--trigger-${index}`;
  const panelId = `${context.id}--panel-${index}`;
  // A landmark for each panel only while there are few of them.
  const region = context.sections.length <= REGION_LIMIT;
  // The single section is a plain section, as the class runtime draws it: a
  // plain element holding the title in the button's place, the content shown.
  const header = context.isStatic
    ? html`<span class="sf-accordion-trigger" id=${triggerId} data-sf-accordion-static>${renderHeaderContent(context, section, true)}</span>`
    : html`<button class="sf-accordion-trigger" type="button" id=${triggerId}
                   data-sf-accordion-section=${section.id}
                   aria-expanded=${open ? 'true' : 'false'} aria-controls=${panelId}
                   ?disabled=${section.disabled}>${renderHeaderContent(context, section, open)}</button>`;

  return html`
    <article class=${sectionClasses(context, section, open)} data-sf-accordion-init="1" data-sf-accordion-id=${section.id}>
      <div class="sf-accordion-heading" role="heading" aria-level=${context.headingLevel}>${header}</div>
      <div class="sf-accordion-content" id=${panelId}
           role=${region ? 'region' : nothing} aria-labelledby=${region ? triggerId : nothing}
           ?hidden=${!open}>${renderContent(context, section)}</div>
    </article>
  `;
}

// The sections stand in a column as wide as the element: a flex column, not a
// grid, whose auto track would widen to a long word and push the page
// sideways. Filled and outlined sections stand apart, flush ones meet.
export function renderAccordionTemplate(context) {
  const flush = context.appearance === 'flush';
  return html`
    <div class=${joinClasses('sf-accordion-group', 'sf-smart-accordion', 'flex', 'flex-col', flush ? '' : 'gap-2', context.rootClass)}
         style=${context.rootStyle || nothing}
         data-mode=${context.single ? 'single' : nothing}
         data-single-section=${context.isStatic ? nothing : context.sections.length === 1 ? 'toggle' : nothing}>
      ${repeat(context.sections, (section) => section.id, (section, index) => renderSection(context, section, index))}
    </div>
  `;
}
