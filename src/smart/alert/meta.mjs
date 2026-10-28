// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfAlertMeta = {
  "tag": "sf-alert",
  "source": "src/smart/alert/component.json",
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
      "description": "What the alert reports, in the shared status vocabulary. The words this component used before — clear and danger — are still accepted and mean neutral and error."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "default",
        "outlined",
        "flat"
      ],
      "default": "default",
      "description": "How the alert looks: a filled surface, an outline, or flat."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional icon override. Use none to hide the semantic icon."
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
      "description": "Supporting body text at the normal text size."
    },
    "action-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible label of the primary optional action."
    },
    "action": {
      "kind": "custom",
      "valueType": "string",
      "default": "action",
      "description": "Stable action value emitted in sf-alert-action."
    },
    "secondary-action-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible label of the secondary optional action."
    },
    "secondary-action": {
      "kind": "custom",
      "valueType": "string",
      "default": "secondary",
      "description": "Stable secondary action value emitted in sf-alert-action."
    },
    "closable": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Render an explicitly named close action."
    },
    "close-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Localized accessible name of the close action. Empty: the text of the page's language (\"Close alert\" in English)."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "title": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Short message heading."
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
    "variant": {
      "kind": "enum",
      "values": [
        "default",
        "outlined",
        "flat"
      ],
      "default": "default",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfAlertMeta};
export default sfAlertMeta;
