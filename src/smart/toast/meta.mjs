// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfToastMeta = {
  "tag": "sf-toast",
  "source": "src/smart/toast/component.json",
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
    "status": {
      "kind": "enum",
      "values": [
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "neutral",
      "description": "What the message reports, in the shared status vocabulary. The words this component used before — default and primary — are still accepted and mean neutral and info."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional decorative icon name."
    },
    "heading": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "supporting-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Concise supporting text at the normal body size."
    },
    "action-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible label of the one optional action."
    },
    "action": {
      "kind": "custom",
      "valueType": "string",
      "default": "action",
      "description": "Stable action value emitted in sf-toast-action."
    },
    "actions-layout": {
      "kind": "enum",
      "values": [
        "auto",
        "under"
      ],
      "default": "auto",
      "description": "Where the action stands: auto puts it in the row with the text while the toast is wide enough and under the text when narrower (layout L3a); under keeps it under the text at every width, for a long text. Any other word is auto."
    },
    "closable": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Render an explicitly named close action."
    },
    "close-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Localized accessible name of the close action. Empty: the text of the page's language (\"Close message\" in English)."
    },
    "duration": {
      "kind": "custom",
      "valueType": "number",
      "default": 0,
      "minimum": 0,
      "description": "Explicit lifetime in milliseconds. Zero keeps the message until dismissed."
    },
    "title": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Short result heading."
    },
    "type": {
      "kind": "enum",
      "values": [
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "neutral",
      "description": "Legacy name for status, still honoured. See contracts/public-api-axes.json."
    },
    "role": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Live-region role for dynamically inserted feedback only."
    }
  }
};

export {sfToastMeta};
export default sfToastMeta;
