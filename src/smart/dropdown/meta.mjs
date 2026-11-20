// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfDropdownMeta = {
  "tag": "sf-dropdown",
  "source": "src/smart/dropdown/component.json",
  "attributes": {
    "template": {
      "kind": "custom",
      "valueType": "string",
      "default": "default",
      "description": "Template variant name for SfBaseElement external templates."
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
        "filled",
        "bordered",
        "band"
      ],
      "default": "bordered",
      "description": "How the field looks: bordered (the default, the field look of every field, FM-9) or filled; band (owner decision C313 (1), FF-11): a grey band across its place with no frame and no radius, the height of a dropping panel's search header (48, 44 on a phone), a hairline under it, its text and chevron where the open list's rows put theirs, grey under the pointer (darker), with the list open and after a choice; --sf-dropdown-background-color tints it, --sf-dropdown-band-edge lets it reach past its place (a sheet's inset). outlined, the former name of bordered, draws the same until 2027-01-01 (a dated alias, noted in SF.deprecations and said once per page in the console)."
    },
    "columns": {
      "kind": "custom",
      "valueType": "number",
      "default": 6,
      "description": "How many options a row holds in the grid layout. Ignored in a list."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "error-message": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The text shown under the field while it is invalid, in the error colour, in the field-message style; it is the trigger's error message for assistive technology (aria-describedby, aria-errormessage)."
    },
    "invalid": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Marks the choice as wrong: the error border (filled: the error fill), aria-invalid on the trigger and error-message under the field. No error icon is drawn."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "hint": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The help line under the field, as sf-input's hint (field parity): the hint's ink, a step below the value, and the trigger's description (aria-describedby); on an error the error message takes its place."
    },
    "help": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The explanation behind a «?» (sf-help-mark, C133's look) after the label text (C153 (8)): a step below the value as the label; the label row keeps its height. The mark is named by its subject («Подробнее: <label>»). Empty: no mark."
    },
    "layout": {
      "kind": "enum",
      "values": [
        "list",
        "grid"
      ],
      "default": "list",
      "description": "How the options are laid out. A list is one option a row; a grid puts several in a row, which is the only way a hundred glyphs can be looked at -- a column of them is a column nobody scrolls to the end of. In a grid an option shows its picture and keeps its text as the name a search reads and a pointer sees."
    },
    "list-width": {
      "kind": "enum",
      "values": [
        "field",
        "list",
        "trigger"
      ],
      "default": "field",
      "description": "How wide the open list is. field: at least the field and up to the list's step by its longest option (C32). list: the list's step (--sf-popup-list-max-width) whatever the field, for a list opened from a narrow button such as a filter's; never narrower than the field, never wider than the screen. trigger (FF-10): exactly the trigger's width, edges flush with it -- the field's or a trigger handed in -- for a trigger as wide as its place, such as the filter window's condition band."
    },
    "mode": {
      "kind": "enum",
      "values": [
        "tag",
        "select"
      ],
      "default": "select"
    },
    "multiple": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Allow several values while preserving their serialized selection order. Tag mode is multiple by default."
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Native form field name for the selected machine value."
    },
    "placeholder": {
      "kind": "custom",
      "valueType": "string",
      "description": "What the field reads while nothing is chosen. Empty: the text of the page's language (\"Not selected\" in English, «Не выбрано» in Russian). Nothing is chosen for the person: the value stays empty until they pick."
    },
    "portal": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Anchor the popup with the shared Framework positioning (SF.Position): native top layer, flip, shift and viewport-limited height. On by default; portal=\"false\" keeps the in-flow list."
    },
    "required": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "search": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "search-placeholder": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language (\"Search\" in English)."
    },
    "size": {
      "kind": "enum",
      "values": [
        "1/3",
        "1/2",
        "1",
        "2",
        "3"
      ],
      "default": "1",
      "description": "The step of the field ladder, as sf-input's (1/3, 1/2, 1, 2, 3): the field as tall as sf-input, sf-button and sf-button-icon of the size (28 / 32 / 40 / 48 / 56 on a desktop), the value on the size's text, the label, help and message a step below, the open list's rows a control of the size."
    },
    "width": {
      "kind": "enum",
      "values": [
        "",
        "short",
        "medium",
        "long"
      ],
      "default": "",
      "description": "How wide the field is, by the value it is made for (owner decision C396): short, 20 characters of the width ladder (--sf-field--width-short; a date, a number, a code), medium, 28 (a name, a phone), or long, 44 (a path, an e-mail, an address). The field is at most that wide and the container's width below it; the characters follow the text size, the density and the phone (160 / 224 / 352 px at text 16, 140 / 196 / 308 compact and on a phone). Empty, the default: the container's whole width."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Selected machine value, or a comma-separated list of values for multiple selection."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "type": {
      "kind": "enum",
      "values": [
        "filled",
        "bordered",
        "band"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfDropdownMeta};
export default sfDropdownMeta;
