// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfSpinnerMeta = {
  "tag": "sf-spinner",
  "source": "src/smart/spinner/component.json",
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
      "description": "The size ladder: at each step the spinner is the icon of an sf-button of the same size (diameter and stroke), so it can stand in for that icon."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language (\"Loading…\" in English)."
    },
    "delay": {
      "kind": "custom",
      "valueType": "integer",
      "default": 1000,
      "minimum": 0,
      "description": "Milliseconds before the spinner shows (owner decision C130 (8); the name is final by C138): a wait shorter than that shows nothing. 0 shows at once. Written as data-delay; without the attribute the sheet's 1 s holds."
    },
    "label-hidden": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The label is said and not shown (SP-07; the name is final by C138): it stays the spinner's name for a screen reader (and what announce says) while the page shows the ring alone. label=\"\" takes the words from both."
    },
    "kind": {
      "kind": "enum",
      "values": [
        "",
        "arc"
      ],
      "default": "",
      "description": "One look, the arc (owner decision C130 (5)). breathing, comet and dots are former values until 2027-01-01 and draw the arc; so does a page's data-sf-spinner."
    },
    "dots": {
      "kind": "custom",
      "valueType": "integer",
      "default": 8,
      "minimum": 1
    },
    "filled": {
      "kind": "custom",
      "valueType": "integer",
      "default": 3,
      "minimum": 0
    },
    "infinite": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "announce": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "direction": {
      "kind": "enum",
      "values": [
        "clockwise",
        "counterclockwise"
      ],
      "default": "clockwise"
    },
    "variant": {
      "kind": "enum",
      "values": [
        "",
        "arc"
      ],
      "default": "",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfSpinnerMeta};
export default sfSpinnerMeta;
