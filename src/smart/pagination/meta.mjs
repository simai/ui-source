// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfPaginationMeta = {
  "tag": "sf-pagination",
  "source": "src/smart/pagination/component.json",
  "attributes": {
    "template": {
      "kind": "custom",
      "valueType": "string",
      "default": "default",
      "description": "Template name."
    },
    "root-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Classes added to the root element the component draws."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "field",
        "numbers",
        "arrows",
        "cursor",
        "more"
      ],
      "default": "field",
      "description": "The look of the navigation (decision C97): field, |‹ ‹ [3] из 12 › ›| for a dense table; numbers, ‹ 1 … 4 [5] 6 … 12 › with up to seven places (five below the sm step) for sites, catalogues and search, links with href; arrows, ‹ Назад · Страница 3 · Далее › where the count is not known; cursor, «В начало · Дальше ›» for a cursor list, never a last page; more, «Показать ещё 20» with «Показано 40 из 240» and a thin bar. A control at an end is disabled, never removed, so the row keeps its width. Not written: the compatible footer of 1.4 (range «41–60 из 240», the page-size button «По 20 ▾», the field, Show more on its own line, the band), until 2027-01-01 (change journal value-pagination-footer-parts-to-view); a list composes those parts itself."
    },
    "top": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal value-pagination-show-more-to-more): Show more of the compatible footer, drawn on a line of its own above the page row (never beside the arrows); write appearance=\"more\". Show the compatible show-more section."
    },
    "middle": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Show page navigation and collection summary."
    },
    "bottom": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Allow the compatible batch-action section."
    },
    "top-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal value-pagination-show-more-to-more): classes of the Show more line of the compatible footer. Framework utility classes for the show-more section."
    },
    "main-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Framework utility classes for the navigation section."
    },
    "bottom-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Framework utility classes for the batch-action section."
    },
    "pages-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal attribute-pagination-footer-labels): written by an author, the compatible footer keeps its «Страницы:» label; the word is no longer drawn by default. Visible label before page controls. Empty: the text of the page's language (\"Pages:\" in English)."
    },
    "page-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible prefix for a numbered page action. Empty: the text of the page's language (\"Page\" in English)."
    },
    "previous-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible name of the previous-page action. Empty: the text of the page's language (\"Previous page\" in English)."
    },
    "next-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible name of the next-page action. Empty: the text of the page's language (\"Next page\" in English)."
    },
    "last-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Visible label of the compatible last-page action. Empty: the text of the page's language (\"Last\" in English)."
    },
    "total-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal attribute-pagination-footer-labels): written by an author, the compatible footer keeps its 1.4 line «Всего: 240» in place of the range «41–60 из 240». Visible label for the total item count. Empty: the text of the page's language (\"Total:\" in English)."
    },
    "selected-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Visible label for the selected item count. Empty: the text of the page's language (\"Selected:\" in English)."
    },
    "selected-count": {
      "kind": "custom",
      "valueType": "integer",
      "default": 0,
      "minimum": 0,
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Selected item count, clamped between zero and total."
    },
    "show-more-text": {
      "kind": "custom",
      "valueType": "string",
      "description": "Label of the compatible show-more action. Empty: the text of the page's language (\"Show more\" in English)."
    },
    "total": {
      "kind": "custom",
      "valueType": "integer",
      "default": 10,
      "minimum": 0,
      "description": "Non-negative total item count."
    },
    "page-size": {
      "kind": "custom",
      "valueType": "integer",
      "default": 10,
      "minimum": 1,
      "description": "Positive number of items per page."
    },
    "page-sizes": {
      "kind": "custom",
      "valueType": "string",
      "default": "10,20,30,40",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal value-pagination-footer-parts-to-view): the sizes of the compatible footer's page-size menu; a list composes «По 20 ▾» itself (sf-button and sf-menu-context). Comma-separated positive page-size choices."
    },
    "show-page-size": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal value-pagination-footer-parts-to-view): the page-size part of the compatible footer. Show the page-size selector for a non-empty collection."
    },
    "page-size-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Visible and accessible label of the page-size selector. Empty: the text of the page's language (\"Per page:\" in English)."
    },
    "show-actions": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Show batch actions when actions are supplied."
    },
    "actions": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Pipe-separated compatible batch-action definitions."
    },
    "action": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Selected batch-action value."
    },
    "action-apply-text": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Label of the batch-action apply button. Empty: the text of the page's language (\"Apply\" in English)."
    },
    "show-action-for-all": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Show the compatible all-items toggle."
    },
    "action-for-all": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Current all-items toggle value."
    },
    "action-for-all-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Label of the all-items toggle. Empty: the text of the page's language (\"For all\" in English)."
    },
    "actions-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Accessible name of the batch-action selector. Empty: the text of the page's language (\"Action for the selected records\" in English)."
    },
    "action-choose-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Placeholder of the batch-action selector, shown until an action is chosen. Empty: the text of the page's language (\"Choose an action\" in English)."
    },
    "actions-region-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Accessible name of the panel that appears while rows are marked. Empty: the text of the page's language (\"Actions for the selected\" in English)."
    },
    "clear-selection-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Deprecated until 2027-01-01 (decision C97, change journal setting-pagination-band-to-view): the band of bulk controls belongs to sf-view, which draws it itself. Accessible name and tooltip of the control that drops the selection. Empty: the text of the page's language (\"Clear the selection\" in English)."
    },
    "count-known": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Whether the number of records is known. A host that does not count every answer sets it false, and the view offers the number instead of showing it."
    },
    "total-exact": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "false when total is an estimate: the row reads «~N», the last page and the page count are not offered as exact, and the count link asks for the number (vocabulary 1.1.5 total-exact; gate 29)"
    },
    "can-count": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Whether the host can count on request. Without it the view offers nothing and asks for nothing."
    },
    "counting": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A count is on its way; the view shows a short wait in place of the number."
    },
    "has-next": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Whether a further page exists. It is what moves forward and Show more when no total was sent."
    },
    "show-count-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Text of the control that asks the host for the number. Empty: the text of the page's language (\"Show the number\" in English)."
    },
    "counting-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible name of the short wait shown while the count is on its way. Empty: the text of the page's language (\"Counting\" in English)."
    },
    "first-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible name and tooltip of the control that goes to the first page. Empty: the text of the page's language (\"First\" in English)."
    },
    "page-field-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Label of the field that takes a page number. Empty: the text of the page's language (\"Page:\" in English)."
    },
    "show-more-busy": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Mark the Show more control as working while the host fetches the next portion; it is disabled and shows a loader."
    },
    "size": {
      "kind": "enum",
      "values": [
        "1/2",
        "1"
      ],
      "default": "1",
      "description": "The step of the size ladder its fields, buttons, labels and page numbers take: 1, or the dense 1/2 of an admin."
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The address of a page as a template, {page} for its number and {page-size} for the page size («?page={page}»). Set, the arrows are links with rel prev/next and a page typed in the field is opened by its address; a listener that cancels sf-pagination-change takes the move in place and the link is not followed. Empty: the arrows are buttons."
    },
    "page-param": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name of the address's query parameter that holds the page («page»). Set, the page is read from the address when the element is placed and on Back and Forward (reported as sf-pagination-change), and a move writes it as a new history entry; page 1 is the address without it. Empty: the address is not touched."
    },
    "page-in-title": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Add the page to the document title («Новости — Страница 3»); page 1 and a removed element leave the title as it was. One pagination of a document says it."
    },
    "current": {
      "kind": "custom",
      "valueType": "integer",
      "default": 1,
      "minimum": 1,
      "description": "the page being read, from 1 (vocabulary 1.1.5 page)"
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name of the navigation landmark. Empty: the text of the page's language (\"Result pages\" in English)."
    }
  }
};

export {sfPaginationMeta};
export default sfPaginationMeta;
