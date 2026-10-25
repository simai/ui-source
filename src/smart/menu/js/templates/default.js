import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {LEVEL_LIMIT, badgeCount} from '../../items.mjs';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The class menu's level classes: four levels, a deeper one drawn as the
// fourth.
const levelClass = (level) => `sf-menu-element--level-${Math.min(Math.max(level, 1), LEVEL_LIMIT)}`;

// The glyph the class runtime writes on a branch: a top-level panel of a row
// opens below it (down, up when open), every other branch opens to its inline
// end (right, down when open; mirrored in RTL by the class sheet).
function branchGlyph(context, level, open) {
  if (context.flyouts && level === 1) return open ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  return open ? 'keyboard_arrow_down' : 'chevron_right';
}

// A count is the class counter: a .sf-badge with data-count, which the badges
// runtime caps at 99+, hides at 0 and names after the label. Any other badge
// is a short label in the same place.
function renderBadge(item) {
  if (!item.badge) return nothing;
  const count = badgeCount(item.badge);
  return count !== null
    ? html`<span class="sf-badge" data-count=${count}></span>`
    : html`<span class="sf-badge">${item.badge}</span>`;
}

// What a row holds, in the class order: an icon, the words, a counter.
function renderWrapContent(item) {
  return html`${item.icon ? html`<i class="sf-icon sf-menu-element-icon" aria-hidden="true">${item.icon}</i>` : nothing}<span class="sf-menu-element-text">${item.label}</span>${renderBadge(item)}`;
}

const renderWrap = (item) => html`<span class="sf-menu-element-wrap">${renderWrapContent(item)}</span>`;

// The branch's disclosure glyph as the class draws it inside a button row: an
// icon-button box hidden from assistive technology, the button being the row.
const renderTrailing = (glyph) => html`<span class="sf-icon-button" aria-hidden="true"><span class="sf-icon" aria-hidden="true">${glyph}</span></span>`;

function renderRow(context, item, level, branch, open, submenuId) {
  const current = context.currentId === item.id;
  const classes = joinClasses(
    'sf-menu-element',
    levelClass(level),
    branch ? 'sf-menu-element--has-submenu' : '',
    open ? 'open' : '',
    item.disabled ? 'disabled' : '',
  );
  const linked = Boolean(item.href) && !item.disabled;

  if (!branch) {
    // A destination is a link; an unavailable one keeps its place as a link
    // without an address, out of the tab order. A row without an address is
    // words in the row's place.
    if (linked) {
      return html`<a class=${classes} href=${item.href} aria-current=${current ? 'page' : nothing}
                     data-sf-menu-link=${item.id}>${renderWrap(item)}</a>`;
    }
    if (item.disabled) return html`<a class=${classes} aria-disabled="true">${renderWrap(item)}</a>`;
    return html`<span class=${classes} aria-current=${current ? 'page' : nothing}>${renderWrap(item)}</span>`;
  }

  const glyph = branchGlyph(context, level, open);
  // A branch that is also a destination: the link and the disclosure button
  // are siblings inside the row, as the class menu documents.
  if (item.href) {
    return html`<div class=${classes}>
      ${linked
        ? html`<a class="sf-menu-element-wrap" href=${item.href} aria-current=${current ? 'page' : nothing}
                  data-sf-menu-link=${item.id}>${renderWrapContent(item)}</a>`
        : html`<a class="sf-menu-element-wrap" aria-disabled="true">${renderWrapContent(item)}</a>`}
      <button class="sf-icon-button" type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${submenuId}
              aria-label=${item.label} ?disabled=${item.disabled}
              data-sf-menu-toggle=${item.id}><span class="sf-icon" aria-hidden="true">${glyph}</span></button>
    </div>`;
  }
  return html`<button class=${classes} type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${submenuId}
                      ?disabled=${item.disabled} data-sf-menu-toggle=${item.id}>${renderWrap(item)}${renderTrailing(glyph)}</button>`;
}

function renderItem(context, item, level) {
  // A compact rail opens no branch: its rows are the first level alone.
  const branch = item.children.length > 0 && !context.compact;
  const open = branch && context.open.has(item.id);
  const submenuId = `${context.id}-menu-${context.domId(item.id)}`;
  return html`
    <li class=${joinClasses('sf-menu-item', branch ? 'sf-menu-item--has-submenu' : '', open ? 'open' : '')}
        data-sf-menu-item=${item.id} data-sf-menu-level=${level}>
      ${renderRow(context, item, level, branch, open, submenuId)}
      ${branch
        ? html`<ul class="sf-menu" id=${submenuId} ?hidden=${!open}>${renderItems(context, item.children, level + 1)}</ul>`
        : nothing}
    </li>
  `;
}

function renderItems(context, items, level) {
  return repeat(items, (item) => item.id, (item) => renderItem(context, item, level));
}

// The button a row that does not fit becomes: a class menu row (a size 1
// control, as every row), the menu glyph and its words, the disclosure glyph
// at its end.
function renderPanelToggle(context) {
  const open = context.panelOpen;
  return html`<button class=${joinClasses('sf-menu-element', 'sf-menu-element--level-1', 'sf-menu-element--has-submenu', 'sf-smart-menu-toggle', open ? 'open' : '')}
                      type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${`${context.id}-list`}
                      data-sf-menu-panel-toggle>
    <span class="sf-menu-element-wrap"><i class="sf-icon sf-menu-element-icon" aria-hidden="true">menu</i><span class="sf-menu-element-text">${context.toggleLabel}</span></span>
    ${renderTrailing(open ? 'keyboard_arrow_up' : 'keyboard_arrow_down')}
  </button>`;
}

// The class markup inside a named <nav>: ul.sf-menu > li.sf-menu-item > the
// row and the nested ul.sf-menu. The whole of it carries data-sf-menu-owned,
// so the class runtime, loaded beside it for the sheet, leaves it to the
// element.
export function renderMenuTemplate(context) {
  const listClasses = joinClasses(
    'sf-menu',
    context.flyouts ? 'sf-menu--horizontal' : '',
    context.appearance !== 'default' ? `sf-menu--${context.appearance}` : '',
  );
  return html`
    <nav class=${joinClasses('sf-smart-menu', context.collapsed ? 'sf-smart-menu--collapsed' : '', context.rootClass)}
         style=${context.rootStyle || nothing}
         aria-label=${context.label || nothing}
         data-orientation=${context.flyouts ? 'horizontal' : 'vertical'}
         data-sf-menu-owned>
      ${context.collapsed ? renderPanelToggle(context) : nothing}
      <ul class=${listClasses} id=${`${context.id}-list`} ?hidden=${context.collapsed && !context.panelOpen}>
        ${renderItems(context, context.items, 1)}
      </ul>
    </nav>
  `;
}
