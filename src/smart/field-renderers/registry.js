// The registry of universal properties (owner, 2026-10-15): every property
// type the Framework renders, its variants and the parameters a field of it
// reads -- one list a host (Larena's fields and settings), the property
// workbench and the documentation read, instead of each learning the types
// from the renderers' source. Which modes a type has is not written here: it
// is read from the renderer maps themselves (modesOf), so the registry cannot
// claim a mode the set does not draw. A contract keeps the two the same.
//
// `params` are the field keys the type's renderers read -- each one, and no
// other (the probe field-renderer-params calls them with a field that records
// what is read). A record, a relation and a user hold one value and take their
// candidates from the host, not from `options`; a constraint other than a
// choice's options is the host's to enforce, not a renderer's.

export const PROPERTY_TYPES = Object.freeze([
    {type: 'string', label: {ru: 'Строка', en: 'String'},
        // password: write-only. The host never sends the password; the value it
        // sends is {set: true} or {set: false} (null reads as not set), and the
        // set shows only «задан»/«не задан». An edit writes the typed text through
        // setFieldValue and writes nothing for a field nobody typed in.
        variants: [{id: 'phone', label: {ru: 'Телефон', en: 'Phone'}},
            {id: 'password', label: {ru: 'Пароль', en: 'Password'}, writeOnly: true}],
        // mask (property-view port 1.16.0): the Framework mask grammar of
        // sf-input's mask-pattern; the value is the text as shown, fixed parts
        // included, and an incomplete one is reported, not written as a value.
        // nullable: false makes a cleared masked field write "" instead of null.
        // Read by the plain string alone: phone and password keep their controls.
        params: ['placeholder', 'mask', 'nullable', 'required', 'readonly']},
    {type: 'text', label: {ru: 'Текст', en: 'Text'},
        variants: [],
        params: ['placeholder', 'required', 'readonly']},
    // html (property-view port 1.17.0): formatted text, an HTML string of
    // sf-rich-text's subset. Edited with sf-rich-text, shown cleaned by that
    // component's own rule, a cell its text on one line, filtered as text.
    {type: 'html', label: {ru: 'Форматированный текст', en: 'Formatted text'},
        variants: [],
        params: ['placeholder', 'required', 'readonly']},
    // stepper: edited with sf-quantity, «−» and «+» and the arrow keys; min,
    // max and step (and a number's precision) are read by that variant alone.
    {type: 'integer', label: {ru: 'Целое число', en: 'Integer'},
        variants: [{id: 'stepper', label: {ru: 'Кнопками «−» и «+»', en: 'With steppers'}}],
        params: ['unit', 'min', 'max', 'step', 'required', 'readonly']},
    {type: 'number', label: {ru: 'Число', en: 'Number'},
        variants: [{id: 'scale', label: {ru: 'Шкала 0–100', en: 'Scale 0–100'}},
            {id: 'stepper', label: {ru: 'Кнопками «−» и «+»', en: 'With steppers'}}],
        params: ['unit', 'min', 'max', 'step', 'precision', 'required', 'readonly']},
    {type: 'date', label: {ru: 'Дата', en: 'Date'},
        variants: [],
        params: ['required', 'readonly']},
    {type: 'datetime', label: {ru: 'Дата и время', en: 'Date and time'},
        variants: [],
        params: ['required', 'readonly']},
    {type: 'boolean', label: {ru: 'Да или нет', en: 'Yes or no'},
        variants: [],
        params: ['trueText', 'falseText', 'required', 'readonly']},
    // buttons (property-view port 1.16.0): one segmented button group, a
    // button per option, sized by `size` on the ladder ("1/2", "1", "2"; absent,
    // the field's); pressing the chosen one again clears a field that is not
    // required. The dropdown stays the default.
    {type: 'choice', label: {ru: 'Одно из списка', en: 'One of a list'},
        variants: [{id: 'buttons', label: {ru: 'Кнопками', en: 'As buttons'}}],
        params: ['options', 'badgeAppearance', 'size', 'required', 'readonly']},
    {type: 'choices', label: {ru: 'Несколько из списка', en: 'Several of a list'},
        // badges: the view; checklist and select: the edit control (a list of
        // 13 or more is a checklist unless select is asked for).
        variants: [{id: 'badges', label: {ru: 'Значками', en: 'As badges'}},
            {id: 'checklist', label: {ru: 'Флажками', en: 'As a checklist'}},
            {id: 'select', label: {ru: 'Выпадающим списком', en: 'As a dropdown'}}],
        params: ['options', 'badgeAppearance', 'required', 'readonly']},
    {type: 'user', label: {ru: 'Пользователь', en: 'User'},
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'record', label: {ru: 'Запись', en: 'Record'},
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'relation', label: {ru: 'Связь', en: 'Relation'},
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    // lookup: a value chosen from a reference list the host keeps -- a country,
    // a status, a contract type (Larena, 2026-10-23). It is not a record: the
    // value is {value, label} and nothing opens from it. Small lists arrive as
    // `options` and are chosen from in place; anything larger is paged and
    // searched by the host, from the source the field names (`source`, which the
    // host reads and no renderer does).
    {type: 'lookup', label: {ru: 'Из справочника', en: 'From a reference list'},
        variants: [],
        params: ['options', 'multiple', 'placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'file', label: {ru: 'Файл', en: 'File'},
        variants: [
            {id: 'image', label: {ru: 'Изображение', en: 'Image'}},
            {id: 'image-card', label: {ru: 'Изображение карточкой', en: 'Image card'}},
            {id: 'image-list', label: {ru: 'Изображения списком', en: 'Image list'}},
        ],
        // required: read by the image variant alone, whose control is
        // sf-image-field -- a required, empty one keeps its form from submitting.
        params: ['accept', 'multiple', 'formats', 'uploadText', 'uploadSupportingText', 'uploadHint', 'required', 'readonly']},
    {type: 'color', label: {ru: 'Цвет', en: 'Colour'},
        variants: [],
        params: ['swatches', 'required', 'readonly']},
    {type: 'include', label: {ru: 'Код', en: 'Code'},
        variants: [],
        params: ['language', 'required', 'readonly']},
]);

// The modes a type has, read from the renderer maps: view and edit (a record),
// cell (a table) and filter -- `own` when the set has a filter control for the
// type, `text` when a filter falls back to a text search.
export function modesOf(type, maps) {
    return {
        view: Boolean(maps.view?.[type]),
        edit: Boolean(maps.edit?.[type]),
        cell: maps.cell?.[type] ? 'own' : 'text',
        filter: maps.filter?.[type] ? 'own' : 'text',
    };
}
