// Smart entry for sf-sortable. The loader fetches this bundle only when the
// page has an <sf-sortable> list, so pages without an editor keep core.js small.
import { SORTABLE_INTENT_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attachSortable, defineSortable, registerSortableDropTarget, sortableIndexAt } from '../../core/js/composition/sortable.mjs';
import { SORTABLE_INSERT_EVENT, inserterRegistry } from '../../core/js/composition/sortable-inserter.mjs';
import './scss/index.scss';

// Defined with its insertion point and inserter (inserter-items, opt-in). They
// come with this bundle only: the composition overlay carries the drag module
// too and has no use for them.
defineSortable(inserterRegistry());

globalThis.SF = globalThis.SF || {};
// attach: sf-sortable's pointer behaviour on any container (the column mode).
globalThis.SF.Sortable = Object.freeze({ SORTABLE_INSERT_EVENT, SORTABLE_INTENT_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attach: attachSortable, attachSortable, registerSortableDropTarget, sortableIndexAt });
