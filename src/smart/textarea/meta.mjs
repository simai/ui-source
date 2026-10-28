// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfTextareaMeta = {
  "tag": "sf-textarea",
  "source": "src/smart/textarea/component.json",
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
      "default": ""
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "size": {
      "kind": "enum",
      "values": [
        "1/2",
        "1",
        "2"
      ],
      "default": "1"
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "bordered",
        "filled",
        "flush"
      ],
      "default": "bordered",
      "description": "How the field looks: a bordered box, a filled one, or flush -- no box of its own, inside a composite control that draws the box and the focus."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "required": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "placeholder": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "autocomplete": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "inputmode": {
      "kind": "enum",
      "values": [
        "",
        "none",
        "text",
        "tel",
        "url",
        "email",
        "numeric",
        "decimal",
        "search"
      ],
      "default": ""
    },
    "minlength": {
      "kind": "custom",
      "valueType": "number"
    },
    "maxlength": {
      "kind": "custom",
      "valueType": "number"
    },
    "spell-check": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "wrap": {
      "kind": "enum",
      "values": [
        "soft",
        "hard"
      ],
      "default": "soft"
    },
    "hint": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "rows": {
      "kind": "custom",
      "valueType": "number",
      "default": 3
    },
    "auto-grow": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The field follows its text between min-rows and max-rows and scrolls inside past max-rows. CSS field-sizing where supported, a script fallback elsewhere; rows is then ignored."
    },
    "min-rows": {
      "kind": "custom",
      "valueType": "number",
      "default": 1,
      "description": "With auto-grow: the fewest rows the field shows. One row is the height of an input of the same size."
    },
    "max-rows": {
      "kind": "custom",
      "valueType": "number",
      "description": "With auto-grow: the most rows before the field scrolls inside. Unset means no cap; a value below min-rows is min-rows."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "readonly": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "invalid": {
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
      "default": ""
    },
    "mask": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "mask-pattern": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "mask-options": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "spellcheck": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Dated alias of spell-check until 2026-12-01."
    },
    "error": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Dated alias of invalid until 2026-12-01."
    },
    "type": {
      "kind": "enum",
      "values": [
        "bordered",
        "filled",
        "flush"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfTextareaMeta};
export default sfTextareaMeta;
