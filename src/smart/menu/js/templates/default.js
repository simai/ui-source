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
// opens below it (down, up when open); a deeper panel of a row opens to the
// side and its glyph is always › (inline end; mirrored in RTL only): the
// panel's side follows the room, the glyph never turns (C30, R059); a
// column's branch opens in place (right, down when open).
function branchGlyph(context, level, open) {
  if (context.flyouts && level === 1) return open ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  if (context.flyouts) return 'chevron_right';
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
    : html`<span class="sf-badge sf-badge--tight">${item.badge}</span>`;
}

// An item's status: the class dot of its tone at the row's end, before the
// counter, and its word in the link's name («Адрес, внимание»), out of sight.
function renderStatus(context, item) {
  if (!item.status) return nothing;
  return html`<span class=${`sf-dot sf-dot--size-1/2 sf-dot--${item.status}`} aria-hidden="true"><span class="sf-dot-item"></span></span><span class="sf-menu-element-status">${context.statusWord(item.status)}</span>`;
}

// A link that leaves the site (C30 amended, R071): ↗ at the row's end, and
// in the link's name, out of sight, that it opens in a new tab when it does.
function renderExternal(context, item) {
  if (!item.external) return nothing;
  return html`<i class="sf-icon sf-menu-element-external" aria-hidden="true">arrow_outward</i>${item.target === '_blank' ? html`<span class="sf-menu-element-status">${context.newTabWords}</span>` : nothing}`;
}

// What a row holds, in the class order: an icon, the words, a status dot and a
// counter.
function renderWrapContent(context, item) {
  return html`${item.icon ? html`<i class="sf-icon sf-menu-element-icon" aria-hidden="true">${item.icon}</i>` : nothing}<span class="sf-menu-element-text">${item.label}</span>${renderStatus(context, item)}${renderBadge(item)}${renderExternal(context, item)}`;
}

// A link's own target: rel noopener for a new tab.
const targetOf = (item) => item.target || nothing;
const relOf = (item) => (item.target === '_blank' ? 'noopener' : nothing);

const renderWrap = (context, item) => html`<span class="sf-menu-element-wrap">${renderWrapContent(context, item)}</span>`;

// The branch's disclosure glyph as the class draws it inside a button row: an
// icon-button box hidden from assistive technology, the button being the row.
const renderTrailing = (glyph) => html`<span class="sf-icon-button" aria-hidden="true"><span class="sf-icon" aria-hidden="true">${glyph}</span></span>`;

// A first-level item a row with overflow more shows in its «Ещё» panel stays
// in the row as a placeholder, hidden: the same row, so its width is measured
// as it would be drawn, without the names and the controls of the real one.
function renderRow(context, item, level, branch, open, submenuId, placeholder = false) {
  const current = context.currentId === item.id;
  const own = (value) => (placeholder ? nothing : value);
  // A row with items under it that holds the current page and shows no list
  // -- a closed branch, a rail row -- takes the class menu's bar (C23).
  // In a row every level keeps the mark while its panel is open: the panel
  // is over the page, not the row, and an open path row keeps its medium
  // label and primary › on the select plate (C30, R057).
  const holds = item.children.length > 0 && context.holding.has(item.id) && (!open || context.flyouts);
  const classes = joinClasses(
    'sf-menu-element',
    levelClass(level),
    branch ? 'sf-menu-element--has-submenu' : '',
    open ? 'open' : '',
    holds ? 'sf-menu-element--holds-current' : '',
    item.disabled ? 'disabled' : '',
  );
  const linked = Boolean(item.href) && !item.disabled;

  if (!branch) {
    // A destination is a link; an unavailable one keeps its place as a link
    // without an address, out of the tab order. A row without an address is
    // words in the row's place.
    if (linked) {
      return html`<a class=${classes} href=${item.href} aria-current=${current ? 'page' : nothing}
                     target=${targetOf(item)} rel=${relOf(item)}
                     data-sf-menu-link=${own(item.id)}>${renderWrap(context, item)}</a>`;
    }
    if (item.disabled) return html`<a class=${classes} aria-disabled="true">${renderWrap(context, item)}</a>`;
    return html`<span class=${classes} aria-current=${current ? 'page' : nothing}>${renderWrap(context, item)}</span>`;
  }

  const glyph = branchGlyph(context, level, open);
  // A branch that is also a destination: the link and the disclosure button
  // are siblings inside the row, as the class menu documents.
  if (item.href) {
    return html`<div class=${classes}>
      ${linked
        ? html`<a class="sf-menu-element-wrap" href=${item.href} aria-current=${current ? 'page' : nothing}
                  target=${targetOf(item)} rel=${relOf(item)}
                  data-sf-menu-link=${own(item.id)}>${renderWrapContent(context, item)}</a>`
        : html`<a class="sf-menu-element-wrap" aria-disabled="true">${renderWrapContent(context, item)}</a>`}
      <button class="sf-icon-button" type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${own(submenuId)}
              aria-label=${context.subsectionsName(item.label)} ?disabled=${item.disabled}
              data-sf-menu-toggle=${own(item.id)}><span class="sf-icon" aria-hidden="true">${glyph}</span></button>
    </div>`;
  }
  return html`<button class=${classes} type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${own(submenuId)}
                      ?disabled=${item.disabled} data-sf-menu-toggle=${own(item.id)}>${renderWrap(context, item)}${renderTrailing(glyph)}</button>`;
}

// A region's own row: a link, or the words of an item without an address, in
// the class row of its place (head, link or small link).
function renderRegionLink(context, item, part) {
  const current = context.currentId === item.id;
  const classes = joinClasses('sf-menu-element', `sf-menu-region-${part}`, item.disabled ? 'disabled' : '');
  if (item.href && !item.disabled) {
    return html`<a class=${classes} href=${item.href} aria-current=${current ? 'page' : nothing}
                   data-sf-menu-link=${item.id}>${renderWrap(context, item)}</a>`;
  }
  return html`<span class=${classes} aria-disabled=${item.disabled ? 'true' : nothing}>${renderWrap(context, item)}</span>`;
}

// The region a row's branch opens without a template of its own: a column per
// child that has children of its own -- its row the column's head, its
// children the links, their children the small links under each -- and the
// children without any in a line under the columns.
function renderRegionColumns(context, item) {
  const columns = item.children.filter((child) => child.children.length);
  const loose = item.children.filter((child) => !child.children.length);
  return html`
    ${columns.length ? html`<div class="sf-menu-region-columns">${repeat(columns, (column) => column.id, (column) => html`
      <div class="sf-menu-region-column">
        ${renderRegionLink(context, column, 'head')}
        <ul class="sf-menu-region-list">${repeat(column.children, (child) => child.id, (child) => html`
          <li>${renderRegionLink(context, child, 'link')}${child.children.length
            ? html`<ul class="sf-menu-region-list sf-menu-region-list--small">${repeat(child.children, (small) => small.id, (small) => html`<li>${renderRegionLink(context, small, 'small')}</li>`)}</ul>`
            : nothing}</li>`)}
        </ul>
      </div>`)}</div>` : nothing}
    ${loose.length ? html`<ul class="sf-menu-region-list sf-menu-region-foot">
      ${repeat(loose, (child) => child.id, (child) => html`<li>${renderRegionLink(context, child, 'link')}</li>`)}
    </ul>` : nothing}
  `;
}

// A row's first-level branch with a region (a mega menu): a panel as wide as
// the header under it, holding the template the host wrote for it -- any
// markup -- or the item's children as columns.
function renderRegion(context, item, open, submenuId) {
  const content = context.regionContent(item.region);
  return html`<div class=${joinClasses('sf-menu-region', content ? 'sf-menu-region--template' : '')} id=${submenuId}
                   role="group" aria-label=${item.label} data-sf-menu-region=${item.region} ?hidden=${!open}>
    ${content || renderRegionColumns(context, item)}
  </div>`;
}

function renderItem(context, item, level) {
  // A compact rail opens no branch: its rows are the first level alone.
  const branch = item.children.length > 0 && !context.compact;
  // A first-level item of a row that went to «Ещё»: its placeholder.
  if (level === 1 && context.hidden.has(item.id)) {
    return html`
      <li class=${joinClasses('sf-menu-item', branch ? 'sf-menu-item--has-submenu' : '')} hidden inert
          data-sf-menu-placeholder=${item.id} data-sf-menu-level="1">
        ${renderRow(context, item, level, branch, false, '', true)}
      </li>
    `;
  }
  const open = branch && context.open.has(item.id);
  const submenuId = `${context.id}--menu-${context.domId(item.id)}`;
  const region = branch && context.flyouts && level === 1 && item.region;
  // The «Ещё» branch draws the items that left the row as rows of its panel:
  // the second level, so their branches open to the side.
  const more = item.id === context.moreId;
  return html`
    <li class=${joinClasses('sf-menu-item', branch ? 'sf-menu-item--has-submenu' : '', open ? 'open' : '',
      region ? 'sf-menu-item--has-region' : '', more ? 'sf-menu-item--more' : '')}
        data-sf-menu-item=${item.id} data-sf-menu-level=${level} ?hidden=${more && !context.moreShown}>
      ${renderRow(context, item, level, more || branch, open, submenuId)}
      ${!branch && !more
        ? nothing
        : region
          ? renderRegion(context, item, open, submenuId)
          : html`<ul class="sf-menu" id=${submenuId} ?hidden=${!open}>${renderItems(context, item.children, level + 1)}</ul>`}
    </li>
  `;
}

// A group of a column: its heading -- words, or the button that opens and
// closes it when it is collapsible -- over a list of first-level rows that the
// heading names.
function renderGroup(context, item) {
  const open = context.open.has(item.id);
  const listId = `${context.id}--menu-${context.domId(item.id)}`;
  const headingId = `${listId}-heading`;
  const heading = item.collapsible
    ? html`<button class="sf-menu-group-heading" type="button" id=${headingId}
                   aria-expanded=${open ? 'true' : 'false'} aria-controls=${listId}
                   ?disabled=${item.disabled} data-sf-menu-toggle=${item.id}>
        <span class="sf-menu-group-label">${item.label}</span>${renderStatus(context, item)}${renderBadge(item)}
        <span class="sf-icon" aria-hidden="true">${open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
      </button>`
    : html`<span class="sf-menu-group-heading" id=${headingId}>
        <span class="sf-menu-group-label">${item.label}</span>${renderStatus(context, item)}${renderBadge(item)}
      </span>`;
  return html`
    <li class=${joinClasses('sf-menu-item', 'sf-menu-item--group', open ? 'open' : '')}
        data-sf-menu-item=${item.id} data-sf-menu-group>
      ${heading}
      <ul class="sf-menu" id=${listId} aria-labelledby=${headingId} ?hidden=${!open}>${renderItems(context, item.children, 1)}</ul>
    </li>
  `;
}

function renderItems(context, items, level) {
  return repeat(items, (item) => item.id, (item) => (item.group ? renderGroup(context, item) : renderItem(context, item, level)));
}

// The button a row that does not fit becomes: a class menu row (a size 1
// control, as every row), the menu glyph and its words, the disclosure glyph
// at its end.
// A selector (collapse narrow) shows the current item instead -- its icon and
// words -- and is named by the menu and that item: «Разделы: Адрес».
function renderPanelToggle(context) {
  const open = context.panelOpen;
  const selected = context.selector ? context.selectedItem : null;
  const icon = selected ? selected.icon : 'menu';
  return html`<button class=${joinClasses('sf-menu-element', 'sf-menu-element--level-1', 'sf-menu-element--has-submenu', 'sf-smart-menu-toggle', open ? 'open' : '')}
                      type="button" aria-expanded=${open ? 'true' : 'false'} aria-controls=${`${context.id}--list`}
                      aria-label=${selected ? `${context.label || context.toggleLabel}: ${selected.label}` : nothing}
                      data-sf-menu-panel-toggle>
    <span class="sf-menu-element-wrap">${icon ? html`<i class="sf-icon sf-menu-element-icon" aria-hidden="true">${icon}</i>` : nothing}<span class="sf-menu-element-text">${selected ? selected.label : context.toggleLabel}</span></span>
    ${renderTrailing(open ? 'keyboard_arrow_up' : 'keyboard_arrow_down')}
  </button>`;
}

// A column's search (C30 amended, R071 a): a field over the rows -- the
// Framework's sf-input, filled and rounded, its magnifier over the rows'
// icons (C06) -- and a polite live region that says how many matched. The
// field stands still; the rows under it scroll.
function renderSearch(context) {
  return html`<div class="sf-smart-menu-search">
    <sf-input class="sf-smart-menu-search-field" input-type="search" appearance="filled" radius="rounded" icon-start="search"
              placeholder=${context.searchPlaceholder} aria-label=${context.searchPlaceholder}
              autocomplete="off" data-sf-menu-search></sf-input>
    <span class="sf-menu-element-status" role="status" aria-live="polite" aria-atomic="true">${context.searchStatus}</span>
  </div>`;
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
    // The row's current section: a line on the header's edge (default) or,
    // with indicator fill, the C23 plate (C30).
    context.flyouts && context.indicator === 'fill' ? 'sf-menu--indicator-fill' : '',
    // A column with a border of its own: the path's line lies on it (R072 e).
    !context.flyouts && context.bordered ? 'sf-menu--bordered' : '',
  );
  return html`
    <nav class=${joinClasses('sf-smart-menu', context.collapsed ? 'sf-smart-menu--collapsed' : '', context.search ? 'sf-smart-menu--search' : '', context.rootClass)}
         style=${context.rootStyle || nothing}
         aria-label=${context.label || nothing}
         data-orientation=${context.flyouts ? 'horizontal' : 'vertical'}
         data-overflow=${context.moreItem ? 'more' : nothing}
         data-sf-menu-owned>
      ${context.collapsed ? renderPanelToggle(context) : nothing}
      ${context.search ? renderSearch(context) : nothing}
      <ul class=${listClasses} id=${`${context.id}--list`} ?hidden=${(context.collapsed && !context.panelOpen) || context.searchEmpty}>
        ${renderItems(context, context.items, 1)}${context.moreItem ? renderItem(context, context.moreItem, 1) : nothing}
      </ul>
      ${context.search && context.searchEmpty ? html`<p class="sf-smart-menu-search-empty">${context.searchEmptyWords}</p>` : nothing}
    </nav>
  `;
}
