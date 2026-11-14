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
      "default": "",
      "description": "Classes added to the root element the component draws."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
    },
    "file-name": {
      "kind": "custom",
      "valueType": "string",
      "default": "File",
      "description": "The file's name, shown as the title of the row and used as its accessible name and as the download's file name."
    },
    "file-size": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The file's size: a number of bytes (2457600), drawn in the page's language and units by the core's size format (2,3 МБ; decision C25) and said with the unit as a word (2,3 мегабайта; C51); text a host already wrote (12 KB) is drawn as written."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "description",
      "description": "The glyph in the holder when no picture is shown (a Material Symbols name). Unset: the glyph of the file's type -- from mime-type, else from the name's extension (PDF, a sheet, slides, an archive, ... each its own; decision C81), else description."
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The file's address: the name is a link to it (decision C51; it downloads in the same tab, or opens in target when download is false) and the download action fetches it. Empty: the name is text and the download action does nothing."
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
      "default": "",
      "description": "The file's MIME type, which helps kind=\"auto\" tell an image from another file."
    },
    "image-url": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A picture to show in the holder for an image (kind image or auto): the thumbnail's address; empty uses href."
    },
    "surface": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Draws the row on a fill, as a block of its own: the size 3 control height around the holder (56 on a desktop, 52 on a phone)."
    },
    "download": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "true (the default): the download action saves the file under file-name, in the same tab. false: it opens the file instead, in target -- the same tab unless a target is given (C25)."
    },
    "target": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Where an opened file goes when download is false and where the name link goes: empty (the default) is the same tab, as C25 asks for a file link; _blank opens a new tab and the action shows the new-tab sign."
    },
    "actions": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Shows the action buttons at the row's end (download and remove, as download-action and remove-action allow)."
    },
    "download-action": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Shows the download action among the actions."
    },
    "remove-action": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Shows the remove action among the actions; it asks the page to detach the file (the detach event)."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Makes the row unavailable: the actions do nothing and the row takes the disabled look."
    },
    "state": {
      "kind": "enum",
      "values": [
        "ready",
        "uploading",
        "error"
      ],
      "default": "ready",
      "description": "The file's state, as the upload core's rows (decision C81). ready: the file is there -- the name is its link, the size under it, download and remove. uploading: the name as text, under it the upload row's bar with its per cent at the end (value; no value: the bar runs), aria-busy; remove stays (the host cancels), download is not offered. error: the name as text, under it «Не загрузился» and error-text in the error colour, «Повторить» (the retry event) at the end of the row -- under the text in a narrow row, where decision C88 places it -- and remove."
    },
    "value": {
      "kind": "custom",
      "valueType": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "While uploading: the share sent, per cent (0 to 100, clamped), drawn by the bar and its per cent. Absent: the bar runs without a share."
    },
    "error-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Why the file did not upload, after «Не загрузился:» in a failed row (state error)."
    },
    "download-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language with the file's name («Скачать Отчёт.pdf», \"Download Report.pdf\" in English; decision C51)."
    },
    "remove-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language with the file's name («Удалить Отчёт.pdf», \"Remove Report.pdf\" in English; decision C51)."
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
