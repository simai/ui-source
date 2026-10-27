import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { renderTreeRow } from '../../../tree-item/js/templates/row.js';
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
      aria-multiselectable=${context.selection === 'many' ? 'true' : nothing}
    >${context.before
        ? html`<div class="sf-tree-spacer" aria-hidden="true" style=${`block-size:${context.before}px`}></div>`
        : nothing}${repeat(rows, (row) => row.id, (row) => renderTreeRow(row))}${context.after
        ? html`<div class="sf-tree-spacer" aria-hidden="true" style=${`block-size:${context.after}px`}></div>`
        : nothing}</div>`;
}
