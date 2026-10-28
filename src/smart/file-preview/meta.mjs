// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfFilePreviewMeta = {
  "tag": "sf-file-preview",
  "source": "src/smart/file-preview/component.json",
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
    "file-name": {
      "kind": "custom",
      "valueType": "string",
      "default": "File"
    },
    "file-size": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The file's size as text, for example 12 KB."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "description"
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "kind": {
      "kind": "enum",
      "values": [
        "auto",
        "icon",
        "image"
      ],
      "default": "auto",
      "description": "What the preview shows: an icon, the image itself, or whichever suits the file."
    },
    "mime-type": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "image-url": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "surface": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "download": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "target": {
      "kind": "custom",
      "valueType": "string",
      "default": "_blank"
    },
    "actions": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "download-action": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "remove-action": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "download-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language (\"Download file\" in English)."
    },
    "remove-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language (\"Remove file\" in English)."
    },
    "compact": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Only the leading visual, as tall as a list row's line: the image, or the file's extension in a tile. For a file in a table cell."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Empty: the text of the page's language (\"File\" in English)."
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "File",
      "description": "Dated alias of file-name until 2026-12-01."
    },
    "size": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Legacy name for file-size: the file's own size as text (\"12 KB\"), not the size ladder. Still honoured; pass file-size."
    },
    "type": {
      "kind": "enum",
      "values": [
        "auto",
        "icon",
        "image"
      ],
      "default": "auto",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfFilePreviewMeta};
export default sfFilePreviewMeta;
