// Smart entry for sf-sortable. The loader fetches this bundle only when the
// page has an <sf-sortable> list, so pages without an editor keep core.js small.
import { SORTABLE_INTENT_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attachSortable, defineSortable, registerSortableDropTarget, sortableIndexAt } from '../../core/js/composition/sortable.mjs';
import './scss/index.scss';

defineSortable();

globalThis.SF = globalThis.SF || {};
// attach: sf-sortable's pointer behaviour on any container (the column mode).
globalThis.SF.Sortable = Object.freeze({ SORTABLE_INTENT_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attach: attachSortable, attachSortable, registerSortableDropTarget, sortableIndexAt });
