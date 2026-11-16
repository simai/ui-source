// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfBadgeMeta = {
  "tag": "sf-badge",
  "source": "src/smart/badge/component.json",
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
        "1"
      ],
      "default": "1/3"
    },
    "line": {
      "kind": "enum",
      "values": [
        "",
        "1/2",
        "1",
        "2",
        "text"
      ],
      "default": "",
      "description": "Takes the text line of this form size, for a table cell or a row of fields, so the row keeps its control height. text takes the line of the text it stands beside: the text's own size and line height, inherited, no block padding, so a count in a contents entry, a tab or a list row is as high as that row's line and one figure is a circle (owner decision C95 point 6)."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "main",
        "tonal",
        "outline"
      ],
      "default": "tonal",
      "description": "How the badge looks: tonal (the default, a calm fill of its colour), outline (a mark beside a title: a version, a type), or main, the filled look, which belongs to the attention count alone (with status error). main with any other colour draws tonal; that spelling is noted in SF.deprecations until 2027-01-01 (owner decision C140)."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "neutral",
        "primary",
        "secondary",
        "tertiary",
        "on-surface"
      ],
      "default": "neutral",
      "description": "Which semantic colour the badge takes. A status word given here still works and reaches the status axis."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "",
      "description": "What the badge reports, in the shared status vocabulary. The word this component used before, danger, is still accepted and means error."
    },
    "activity": {
      "kind": "enum",
      "values": [
        "",
        "running",
        "waiting",
        "done",
        "stopped",
        "failed",
        "paused",
        "queued"
      ],
      "default": "",
      "description": "Where a run stands: running draws a spinner in the icon's place, waiting (needs a person's input), done, stopped, failed, paused (stopped and will go on) and queued (in a queue) an icon of their own, each with its word and colour role. Wins over status and scheme for the icon, the text and the colour; text and icon override it."
    },
    "icon-only": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Shows the icon alone, for a tight list row; the text stays as the accessible name and the box closes to a square. Needs an icon to show: without one the text stays visible. The appearance is untouched. The former boolean compact still draws it until 2027-01-01 (owner decision C134: compact means density only; each use noted in SF.deprecations, journal attribute-badge-compact-to-icon-only)."
    },
    "tight": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Keeps a narrow side room, for dense places: a table, a counter, a chip in a row -- --sf-space-1/3, one space step under the default --sf-space-1/2 (8 · 4 compact · 8 phone; BG-9: the room is a space step, no longer the button's text inset)."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-start": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-end": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-position": {
      "kind": "enum",
      "values": [
        "start",
        "end"
      ],
      "default": "start"
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "type": {
      "kind": "enum",
      "values": [
        "main",
        "tonal",
        "outline"
      ],
      "default": "tonal",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "icon-left": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-start until 2026-12-01."
    },
    "icon-right": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-end until 2026-12-01."
    },
    "compact": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Dated alias of icon-only until 2027-01-01 (owner decision C134: compact means density only), still honoured and noted in SF.deprecations."
    }
  }
};

export {sfBadgeMeta};
export default sfBadgeMeta;
