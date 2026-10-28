// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfButtonGroupMeta = {
  "tag": "sf-button-group",
  "source": "src/smart/button-group/component.json",
  "attributes": {
    "template": {
      "kind": "custom",
      "valueType": "string",
      "default": "default",
      "description": "Template variant name."
    },
    "root-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Extra classes applied to the group root."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Native form field name: the group submits its value with its form, a form reset restores the initial value, and a disabled group is left out."
    },
    "theme-switch": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A ready theme switch: the group draws its own three icon-only items (system, light, dark) named in the page language, selects SF.Loader's theme preference and follows sf-theme-change, and a choice calls SF.Loader.setTheme. items is ignored."
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
      "description": "Shared button size token."
    },
    "spacing": {
      "kind": "enum",
      "values": [
        "compact",
        "normal",
        "comfortable",
        "spacious"
      ],
      "default": "normal",
      "description": "Shared semantic internal spacing profile."
    },
    "tightness": {
      "kind": "enum",
      "values": [
        "",
        "low",
        "high",
        "highest"
      ],
      "default": "",
      "description": "Compatibility alias for spacing."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "primary",
        "secondary",
        "on-surface"
      ],
      "default": "primary",
      "description": "Color scheme for the selected button, and for the selected plate in the segmented appearance."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "default",
        "segmented"
      ],
      "default": "default",
      "description": "How the group looks. default joins outlined buttons into one perimeter; segmented draws a sunken track with borderless segments and a plate under the selected one. The selection model, keyboard and events are the same."
    },
    "plate": {
      "kind": "enum",
      "values": [
        "scheme",
        "raised"
      ],
      "default": "scheme",
      "description": "The selected segment's plate in the segmented appearance: the scheme's fill, or a raised neutral surface with its shadow."
    },
    "full-width": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "In the segmented appearance, the track fills its container and the segments share the width equally."
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
      "description": "Corner radius, as on sf-button: empty is the UI radius. In the segmented appearance the plate, a button-sized segment, takes the radius a button of that value has, and the track is it plus the padding (rounded: both pills)."
    },
    "orientation": {
      "kind": "enum",
      "values": [
        "horizontal",
        "vertical"
      ],
      "default": "horizontal",
      "description": "Layout and keyboard navigation orientation."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Disables the whole group."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Currently selected item value."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name for the group."
    }
  }
};

export {sfButtonGroupMeta};
export default sfButtonGroupMeta;
