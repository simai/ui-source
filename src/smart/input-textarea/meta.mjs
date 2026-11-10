// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfInputTextareaMeta = {
  "tag": "sf-input-textarea",
  "source": "src/smart/input-textarea/component.json",
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
        "1/2",
        "1",
        "2"
      ],
      "default": "1",
      "description": "The step of the control ladder the field stands on: the text size, the side padding and the height of one row are those of sf-input of the same size."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "bordered",
        "filled",
        "flush"
      ],
      "default": "bordered",
      "description": "How the field looks: a bordered box, a filled one, or flush -- no box of its own, inside a composite control that draws the box and the focus."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The visible label above the field; it names the native control. Without it, give aria-label."
    },
    "required": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The field must hold a value: the label gets the required mark and the native control the required constraint."
    },
    "placeholder": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Example text shown in the empty field in the quiet ink; it disappears with the first character and is not a label."
    },
    "autocomplete": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The autofill hint the browser reads, as the native autocomplete (email, tel, current-password, off). Empty: not written."
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
      "default": "",
      "description": "Which on-screen keyboard a phone opens, as the native inputmode (numeric, decimal, tel, email, url, search). Empty: the keyboard of the type."
    },
    "minlength": {
      "kind": "custom",
      "valueType": "number",
      "description": "The fewest characters the text may have, as the native minlength; a shorter text is invalid (too short). Unset: no limit."
    },
    "maxlength": {
      "kind": "custom",
      "valueType": "number",
      "description": "The most characters the text may have, as the native maxlength: the field takes no more. Unset: no limit."
    },
    "spell-check": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Whether the browser checks spelling in the text, as the native spellcheck. On by default; turn it off for codes and identifiers."
    },
    "wrap": {
      "kind": "enum",
      "values": [
        "soft",
        "hard"
      ],
      "default": "soft",
      "description": "How the text is sent: soft sends it as typed; hard also sends the line breaks the field draws at its width, as the native wrap."
    },
    "hint": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The help line under the field; on an error the error message takes its place."
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name the value is sent under in a form, as the native name."
    },
    "rows": {
      "kind": "custom",
      "valueType": "number",
      "default": 3,
      "description": "How many lines of text the field shows; longer text scrolls inside. Ignored with auto-grow."
    },
    "auto-grow": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The field follows its text between min-rows and max-rows and scrolls inside past max-rows. CSS field-sizing where supported, a script fallback elsewhere; rows is then ignored."
    },
    "min-rows": {
      "kind": "custom",
      "valueType": "number",
      "default": 1,
      "description": "With auto-grow: the fewest rows the field shows. One row is the height of an input of the same size."
    },
    "max-rows": {
      "kind": "custom",
      "valueType": "number",
      "description": "With auto-grow: the most rows before the field scrolls inside. Unset means no cap; a value below min-rows is min-rows."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The field takes no input, no focus and is not sent with the form; it draws the disabled look."
    },
    "readonly": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The value can be read, selected and copied but not changed; it is sent with the form. The field draws the region line instead of the control border."
    },
    "invalid": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Marks the value as wrong: the error border, aria-invalid on the native control and error-message under the field."
    },
    "error-message": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The text shown under the field while it is invalid, in the error colour, in place of the hint; it is the control's error message for assistive technology."
    },
    "mask": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Turns on the input mask: typing is held to mask-pattern (or mask-options) and the fixed characters are drawn by the mask."
    },
    "mask-pattern": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The mask with mask on: 0 a digit, a a letter, * any character, {...} a fixed part kept in the value, [ ] an optional tail, \\ escapes the next character; any other character is shown only. Example: +{7} (000) 000-00-00."
    },
    "mask-options": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The full mask configuration as JSON, for what mask-pattern cannot say; it wins over mask-pattern. Invalid JSON is ignored."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The current text. Written by the page, it controls the field; the value property reads what is typed."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name for a textarea drawn without a visible label; it lands on the native textarea. A visible label wins."
    },
    "spellcheck": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Dated alias of spell-check until 2026-12-01."
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
        "flush"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "aria-labelledby": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Ids of the elements that name the textarea; it lands on the native textarea."
    }
  }
};

export {sfInputTextareaMeta};
export default sfInputTextareaMeta;
