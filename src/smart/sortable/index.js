// Smart entry for sf-sortable. The loader fetches this bundle only when the
// page has an <sf-sortable> list, so pages without an editor keep core.js small.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the list is defined over the class core/js/composition/manifest-host.mjs
// makes from it -- the settings' properties, the words, the dated aliases --
// and asks sf-sortable-move (vocabulary 1.1.5 §5 move), the old
// sf-sortable-intent following until 2026-12-01.
import { SORTABLE_INTENT_EVENT, SORTABLE_MOVE_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attachSortable, defineSortable, registerSortableDropTarget, sortableIndexAt } from '../../core/js/composition/sortable.mjs';
import { SORTABLE_INSERT_EVENT, inserterRegistry } from '../../core/js/composition/sortable-inserter.mjs';
import { manifestHost } from '../../core/js/composition/manifest-host.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import enFile from './lang/en.json';
import ruFile from './lang/ru.json';
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};
import './scss/index.scss';

// Defined with its insertion point and inserter (inserter-items, opt-in). They
// come with this bundle only: the composition overlay carries the drag module
// too and has no use for them.
defineSortable(inserterRegistry(), {base: manifestHost(manifest, {lang: {en, ru}, source: 'ru', aliases})});

globalThis.SF = globalThis.SF || {};
// attach: sf-sortable's pointer behaviour on any container (the column mode).
globalThis.SF.Sortable = Object.freeze({ SORTABLE_INSERT_EVENT, SORTABLE_INTENT_EVENT, SORTABLE_MOVE_EVENT, SORTABLE_STATE_EVENT, activeSortableSession, attach: attachSortable, attachSortable, registerSortableDropTarget, sortableIndexAt });
