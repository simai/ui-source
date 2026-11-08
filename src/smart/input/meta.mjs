// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfInputMeta = {
  "tag": "sf-input",
  "source": "src/smart/input/component.json",
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
      "description": "The step of the control ladder the field stands on, the height of sf-button and sf-button-icon of the same size. sf-input keeps the outer steps 1/3 and 3 (a compact toolbar search, a hero search); the other fields stay on 1/2, 1 and 2."
    },
    "radius": {
      "kind": "enum",
      "values": [
        "",
        "default",
        "square",
        "rounded"
      ],
      "default": "",
      "description": "The field's corners, as sf-button's radius names them: empty and default are the controls' rounded square, square has none, rounded is a pill (a search field beside rounded buttons). --sf-input-radius still wins."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "bordered",
        "filled",
        "hidden"
      ],
      "default": "bordered",
      "description": "How the field looks: a bordered box, a filled one, or hidden."
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
    "input-type": {
      "kind": "enum",
      "values": [
        "text",
        "email",
        "password",
        "search",
        "tel",
        "url",
        "number"
      ],
      "default": "text"
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
      "valueType": "string",
      "default": ""
    },
    "maxlength": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "pattern": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "min": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The smallest number a number field (input-type number) takes, as the native input's min; below it the field is invalid (range underflow). Not written on other types."
    },
    "max": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The largest number a number field takes, as the native input's max; above it the field is invalid (range overflow). Not written on other types."
    },
    "step": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The step of a number field, as the native input's step: 1 when empty, any for any number; a value off the step is invalid (step mismatch). Not written on other types."
    },
    "hint": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "default-value": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-start": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "text-end": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "hint-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
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
    "mask-lazy": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "mask-placeholder-char": {
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
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name for a field rendered without a visible label; it lands on the native input."
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
        "hidden"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "left-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-start until 2026-12-01."
    },
    "right-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of text-end until 2026-12-01."
    }
  }
};

export {sfInputMeta};
export default sfInputMeta;
