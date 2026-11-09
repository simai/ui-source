// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfTooltipMeta = {
  "tag": "sf-tooltip",
  "source": "src/smart/tooltip/component.json",
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
      "description": "Framework utility classes for the visible surface root."
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
        "light",
        "dark"
      ],
      "default": "dark",
      "description": "How the tooltip looks: dark is the inverse surface (the plain tooltip, the default), light a raised surface."
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
      "default": "1/3",
      "description": "Framework typography and spacing scale; 1/3, the default, is the plain tooltip: the small text step, regular, 4 x 8."
    },
    "arrow": {
      "kind": "enum",
      "values": [
        "none",
        "top-center",
        "bottom-center",
        "inline-start",
        "inline-end",
        "bottom-inline-start",
        "bottom-inline-end"
      ],
      "default": "none",
      "description": "Logical tail placement."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Short primary description."
    },
    "supporting-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional secondary description."
    },
    "shortcut": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The trigger's key combination (mod+b, shift+/), drawn after the text as quiet keys by the kbd component."
    },
    "type": {
      "kind": "enum",
      "values": [
        "light",
        "dark"
      ],
      "default": "dark",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfTooltipMeta};
export default sfTooltipMeta;
