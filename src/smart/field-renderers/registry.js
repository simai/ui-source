// The registry of universal properties (owner, 2026-10-15): every property
// type the Framework renders, its variants and the parameters a field of it
// reads -- one list a host (Larena's fields and settings), the property
// workbench and the documentation read, instead of each learning the types
// from the renderers' source. Which modes a type has is not written here: it
// is read from the renderer maps themselves (modesOf), so the registry cannot
// claim a mode the set does not draw. A contract keeps the two the same.

export const PROPERTY_TYPES = Object.freeze([
    {type: 'string', label: {ru: 'Строка', en: 'String'},
        variants: [{id: 'phone', label: {ru: 'Телефон', en: 'Phone'}}],
        params: ['placeholder', 'required', 'readonly', 'constraints']},
    {type: 'text', label: {ru: 'Текст', en: 'Text'},
        variants: [],
        params: ['placeholder', 'required', 'readonly', 'constraints']},
    {type: 'integer', label: {ru: 'Целое число', en: 'Integer'},
        variants: [],
        params: ['unit', 'required', 'readonly', 'constraints']},
    {type: 'number', label: {ru: 'Число', en: 'Number'},
        variants: [{id: 'scale', label: {ru: 'Шкала 0–100', en: 'Scale 0–100'}}],
        params: ['unit', 'required', 'readonly', 'constraints']},
    {type: 'date', label: {ru: 'Дата', en: 'Date'},
        variants: [],
        params: ['required', 'readonly', 'constraints']},
    {type: 'datetime', label: {ru: 'Дата и время', en: 'Date and time'},
        variants: [],
        params: ['required', 'readonly', 'constraints']},
    {type: 'boolean', label: {ru: 'Да или нет', en: 'Yes or no'},
        variants: [],
        params: ['trueText', 'falseText', 'readonly']},
    {type: 'choice', label: {ru: 'Одно из списка', en: 'One of a list'},
        variants: [],
        params: ['options', 'badgeAppearance', 'required', 'readonly']},
    {type: 'choices', label: {ru: 'Несколько из списка', en: 'Several of a list'},
        variants: [{id: 'badges', label: {ru: 'Значками', en: 'As badges'}}],
        params: ['options', 'badgeAppearance', 'required', 'readonly']},
    {type: 'user', label: {ru: 'Пользователь', en: 'User'},
        variants: [],
        params: ['options', 'multiple', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'record', label: {ru: 'Запись', en: 'Record'},
        variants: [],
        params: ['options', 'multiple', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'relation', label: {ru: 'Связь', en: 'Relation'},
        variants: [],
        params: ['options', 'multiple', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'file', label: {ru: 'Файл', en: 'File'},
        variants: [
            {id: 'image', label: {ru: 'Изображение', en: 'Image'}},
            {id: 'image-card', label: {ru: 'Изображение карточкой', en: 'Image card'}},
            {id: 'image-list', label: {ru: 'Изображения списком', en: 'Image list'}},
        ],
        params: ['accept', 'multiple', 'formats', 'uploadText', 'uploadSupportingText', 'uploadHint', 'required', 'readonly']},
    {type: 'color', label: {ru: 'Цвет', en: 'Colour'},
        variants: [],
        params: ['swatches', 'formats', 'required', 'readonly']},
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
