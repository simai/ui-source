// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfInputMeta = {
  "tag": "sf-input",
  "source": "src/smart/input/component.json",
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
      "description": "The step of the control ladder the field stands on, the height of sf-button and sf-button-icon of the same size. sf-input and every field of the family (lookup, quantity, date, code, colour, phone, textarea, rich text, dropdown, file upload, image) stand on all five steps."
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
      "description": "The field's corners, as sf-button's radius names them: empty and default are the controls' rounded square, square has none, rounded is a pill (a search field beside rounded buttons). --sf-input-radius still wins."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "bordered",
        "filled",
        "hidden",
        "plain"
      ],
      "default": "bordered",
      "description": "How the field looks: a bordered box, a filled one, or hidden. plain (owner decision C313 (4)): no frame, no fill and no radius, the text at the field's edge, under the focus a primary line at its foot -- a value standing where a panel's search stands (the filter field window's value row)."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The visible label above the field, in the text ink a step below the value (14 beside a 16 value, 14 on a phone too; C153 (1)); it names the native control. Without it, give aria-label."
    },
    "required": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The field must hold a value: the label gets the required mark, «*» in the label's ink (C153 (2); the form says once what it means, «* — обязательные поля»), and the native control the required constraint."
    },
    "placeholder": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Example text shown in the empty field in the quiet ink; it disappears with the first character and is not a label."
    },
    "input-type": {
      "kind": "enum",
      "values": [
        "text",
        "email",
        "password",
        "search",
        "tel",
        "url",
        "number"
      ],
      "default": "text",
      "description": "The kind of text the field takes, the native input type: text, email, password, search, tel, url or number (with min, max and step). A number field draws no browser arrows and digits of one width (C153 (7)); exact numbers with a unit or steps belong to sf-input-quantity (steppers=\"none\")."
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
      "valueType": "string",
      "default": "",
      "description": "The fewest characters the value may have, as the native minlength; a shorter value is invalid (too short). Empty: no limit."
    },
    "maxlength": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The most characters the value should have (C153 (10), C141 (1)). The count shows from 80 % of it at the end of the message line; past it the count and the frame turn to the error colour and the field is invalid (too-long), so the form is not sent. The text is never cut, as the native maxlength would; a masked field keeps the native limit. Empty: no limit, no count."
    },
    "counter": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "With maxlength: the count shows always, not only from 80 % of the limit (C153 (10), C141 (1))."
    },
    "pattern": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A regular expression the whole value must match, as the native pattern; a value that does not match is invalid (pattern mismatch)."
    },
    "min": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The smallest number a number field (input-type number) takes, as the native input's min; below it the field is invalid (range underflow). Not written on other types."
    },
    "max": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The largest number a number field takes, as the native input's max; above it the field is invalid (range overflow). Not written on other types."
    },
    "step": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The step of a number field, as the native input's step: 1 when empty, any for any number; a value off the step is invalid (step mismatch). Not written on other types."
    },
    "hint": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The help line under the field; on an error the error message takes its place."
    },
    "help": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The explanation behind a «?» (sf-help-mark, C133's look) after the label text (C153 (8)): a step below the value as the label, --sf-space-1/4 after its last word; the label row keeps its height. The mark is named by its subject («Подробнее: <label>»). Empty: no mark."
    },
    "default-value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The value the field starts with and returns to on a form reset, without controlling it afterwards. Empty: value is used."
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name the value is sent under in a form, as the native name."
    },
    "icon-start": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name of an icon drawn at the start of the field, before the value (a search glass, an envelope). Empty: no icon."
    },
    "text-start": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A short text drawn at the start of the field, before the value, the twin of text-end (C153 (9)): «https://», «@», «+7». In the hint's ink, on the C77 inset, not part of the value; the native control is described by it. Empty: no text."
    },
    "text-end": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A short text drawn at the end of the field, after the value: a unit or a currency (kg, ₽, %). Empty: no text."
    },
    "shortcut": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A key combination drawn at the end of the field as the kbd component's soft caps in the muted ink (owner decisions C04, C38): words joined by +, e.g. mod+k (⌘K on a Mac, Ctrl K elsewhere), shift+mod+p, / or escape; mod is Cmd on Apple platforms and Ctrl elsewhere. The keys take the text step one below the value's (size 1 a plate of 20 with letters of 14). Written as aria-keyshortcuts on the native input. A hint only: the field does not listen to it. Empty: no keys"
    },
    "hint-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name of an icon drawn at the end of the field as a hint (info, help). Empty: no icon."
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
    "clearable": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A clear glyph (×) at the field's end while the field holds a value (C123), named «Очистить»: a press empties the field, says so with input and change and gives the focus back to it. It is no Tab stop (C153 (6)): Escape in the field empties it instead, and an empty field lets Escape go on. A search field (input-type search) has both without the setting, in place of the browser's own."
    },
    "invalid": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Marks the value as wrong from the page: the error border, aria-invalid on the native control and error-message under the field. Without it the field shows its own errors (C153 (3)): after a failed submit on every wrong field (the first takes the focus), then on leaving a field the person changed, gone the moment the value is right, in the component's words; never the browser's bubble."
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
    "mask-lazy": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "With mask: true (or empty) shows the fixed characters only as they are reached, false shows the whole mask with placeholder characters from the start."
    },
    "mask-placeholder-char": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "With mask and mask-lazy false: the character that stands for a position still to be typed. Empty: the mask's own, _."
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
      "description": "The current value. Written by the page, it controls the field; the value property reads what is typed."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name for a field rendered without a visible label; it lands on the native input."
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
        "hidden",
        "plain"
      ],
      "default": "bordered",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "left-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-start until 2026-12-01."
    },
    "right-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of text-end until 2026-12-01."
    }
  }
};

export {sfInputMeta};
export default sfInputMeta;
