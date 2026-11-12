import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { renderTreeRow, renderIcon } from '../../../tree-item/js/templates/row.js';
import './default.css';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The tree's entries, flat and keyed by id (standard 1.3.8 §18.4): a row that
// stays keeps its element, and only what changed in it is written. Over 300
// visible entries the rows outside the view are two spacers.
export function renderTreeTemplate(context) {
  const rootClasses = joinClasses('sf-tree flex flex-col', context.rootClass);
  const rows = context.tabStopDrawn || !context.rows.length
    ? context.rows
    : [{...context.rows[0], tabStop: true}, ...context.rows.slice(1)];

  return html`<div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role="tree"
      data-sf-tree-flat=${context.hasBranches ? nothing : 'true'}
      aria-label=${context.ariaLabel || nothing}
      aria-multiselectable=${context.selection === 'many' || context.selection === 'check' ? 'true' : nothing}
    >${context.before
        ? html`<div class="sf-tree-spacer" aria-hidden="true" style=${`block-size:${context.before}px`}></div>`
        : nothing}${repeat(rows, (row) => row.id, (row) => renderTreeRow(row))}${context.after
        ? html`<div class="sf-tree-spacer" aria-hidden="true" style=${`block-size:${context.after}px`}></div>`
        : nothing}</div>`;
}

// The static tree (owner decision C102 item 5; research §7 item 7): a
// structure shown in text -- a project's files in documentation. The class
// markup .sf-tree--static that Docara writes too: nested ul/li (list
// semantics, not role tree), no Tab stop, no chevrons, every level shown; a
// row is a text line with the type icon, the name, its note (a comment), a
// highlighted line (mark) and the «…» line (more).
function renderStaticNode(node) {
  const entry = node.entry;
  const classes = joinClasses(
    'sf-tree-item flex flex-col',
    node.folder ? 'sf-tree-item--folder' : 'sf-tree-item--file',
    // Every level is shown: a group shows under an .open item only.
    node.children.length ? 'open' : '',
    entry.mark ? 'sf-tree-item--mark' : '',
    entry.more ? 'sf-tree-item--more' : '',
    entry.hidden ? 'sf-tree-item--hidden' : '',
  );
  const icon = entry.more ? 'more_horiz' : node.nodeIcon;
  const name = entry.href
    ? html`<a class="sf-tree-item-name" href=${entry.href} target=${entry.target || nothing} rel=${entry.rel || nothing}>${entry.label}</a>`
    : html`<span class="sf-tree-item-name">${entry.label}</span>`;
  return html`<li class=${classes} data-value=${entry.value || nothing}><div class="sf-tree-item-container flex">${renderIcon(icon, 'sf-tree-node-icon')}${name}${entry.hidden && node.hiddenWord
      ? html`<span class="sf-tree-item-note sf-tree-item-hidden-word">${node.hiddenWord}</span>`
      : nothing}${entry.note ? html`<span class="sf-tree-item-note">${entry.note}</span>` : nothing}</div>${node.children.length
      ? html`<ul class="sf-tree-group" role="list">${node.children.map(renderStaticNode)}</ul>`
      : nothing}</li>`;
}

export function renderStaticTreeTemplate(context) {
  const rootClasses = joinClasses('sf-tree sf-tree--static flex flex-col', context.rootClass);
  return html`<div class=${rootClasses} style=${context.rootStyle || nothing}><ul
      class="sf-tree-group" role="list" aria-label=${context.ariaLabel || nothing}>${context.nodes.map(renderStaticNode)}</ul></div>`;
}
