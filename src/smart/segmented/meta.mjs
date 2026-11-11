// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfSegmentedMeta = {
  "tag": "sf-segmented",
  "source": "src/smart/segmented/component.json",
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
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
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
    "height": {
      "kind": "enum",
      "values": [
        "low",
        "default",
        "high",
        "highest"
      ],
      "default": "default",
      "description": "The control height (owner decision C27), as on sf-button: size sets the text, the icons and the inner scale, height picks the height from the size's tightness steps -- low, default, high, highest. The track stands as tall as an sf-button of the same size and height, and the buttons look draws sf-button with that height. A value outside the list reads as default, with one console warning."
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
      "description": "Deprecated (decision C27, until 2027-01-01): the side padding of the segments only -- compact, normal, comfortable or spacious -- at the same height. It keeps working as before with a console warning and is not turned into height; write height for a lower or higher control."
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
      "description": "Colour scheme for the selected button of the buttons look, and for the plate on the track when plate is scheme."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "track",
        "buttons"
      ],
      "default": "track",
      "description": "How the control looks (owner decision D11c). track, the default: a translucent track with a plate under the selected option. buttons: joined outlined buttons, the selected one filled -- for forms and toolbars on a plain surface, next to other buttons. The selection model, keyboard and events are the same. The old values segmented and default are dated aliases of track and buttons."
    },
    "plate": {
      "kind": "enum",
      "values": [
        "raised",
        "scheme"
      ],
      "default": "raised",
      "description": "The plate under the selected option on the track. raised, the default: a neutral raised surface with its shadow (white in the light theme; in the dark the fill's pressed step, lighter than the track on any place, C42). scheme: the scheme's fill, an accent for the one switch on a screen that needs it."
    },
    "backdrop": {
      "kind": "enum",
      "values": [
        "surface",
        "color",
        "media"
      ],
      "default": "surface",
      "description": "What the track stands on. surface, the default: a page, a card or a panel; the track is the surface container fill. color: a coloured place (a brand header, a coloured banner); the track and the labels take the place's ink (currentColor), so they read on any colour. media: a photo or a video; the track is a dark glass (black 48% with a blur) with white labels and a white plate, the same in both themes."
    },
    "full-width": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "On the track, the control fills its container and the options share the width equally."
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
      "description": "Corner radius, as on sf-button: empty is the UI radius. On the track the plate, a button-sized option, takes the radius a button of that value has, and the track is it plus the padding (rounded: both pills)."
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

export {sfSegmentedMeta};
export default sfSegmentedMeta;
