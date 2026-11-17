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
        "bordered"
      ],
      "default": "bordered",
      "description": "How the field looks: bordered (the default, the field look of every field, FM-9) or filled. outlined, the former name of bordered, draws the same until 2027-01-01 (a dated alias, SF.deprecations)."
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
        "bordered"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfDropdownMeta};
export default sfDropdownMeta;
