import {html, nothing} from "lit";
import {optionBadgeProps} from "../helpers/option-badge.js";
import {pageText} from "../../core/js/page-language";

// The Framework's field renderers, addressed by a property type and a template
// rather than by a control name.
//
// Larena asked for one set of renderers shared by the record view and the
// table's cells (their request of 2026-10-05, part B6). The Framework already
// had type-aware rendering in exactly one place -- the table's filter controls
// -- and a second map would have drifted from it, so this module is that map
// with the filter controls moved into it unchanged. The table now asks the set
// instead of answering itself.
//
// The renderers take a host rather than `this`: a small interface the caller
// implements, so the same function serves a table's filter window, a record
// view and anything else that renders a field.
//
//   getFilterControlValue(key)            the value a control shows
//   patchTempFilterValue(key, patch)      the value a control writes
//   getFilterOperatorLabel(operator)      the word for an operator
//   getFilterOptionSearch(key)            what is typed in an option search
//   patchTempFilterOptionSearch(key, s)   what that search writes
//   getVisibleFilterOptions(field)        the options to draw
//   renderFilterOption(field, option)     one option row
//   getEndpointFilterPage(field)          the page of options a host returned
//   loadEndpointFilterPage(field, cursor, search)   ask the host for a page
//
// Every prop below names the axis it answers -- appearance, status, kind -- and
// never `type`, which contracts/public-api-axes.json retires. The names were
// read from each component's description rather than from the property's name:
// `size` on sf-file-preview is the file's size as text, not a rung of the
// ladder, and `type` on sf-list-item answers `kind` while on sf-input it
// answers `appearance`.

// The filter controls take the size of the list they filter: the table's
// size, when it has one. They were written at 1, so a table at the dense
// step 1/2 opened filter fields, buttons and tabs a step larger than itself.
function filterSize(host) {
    const size = String(host?.size || '').trim();
    return size || '1';
}

function renderTextFilterControl(field, host) {
    const value = host.getFilterControlValue(field.key);

    return html`
        <sf-input
                size=${filterSize(host)}
                appearance="filled"
                placeholder="${setText(host, 'searchInList')}"
                value="${value.value || ''}"
                name="sf_filter_${field.key || 'text'}"
                @change=${(event) => {
                    host.patchTempFilterValue(field.key, {
                        value: event.target?.value || '',
                        operator: value.operator || field.filter?.defaultOperator || 'contains',
                    });
                }}
        ></sf-input>
    `;
}

function renderRangeFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key);
    const operators = field.filter?.operators || ['eq'];
    const selectedOperator = control.operator || field.filter?.defaultOperator || operators[0];
    const isBetween = selectedOperator === 'between';
    const rangeValue = isBetween
        ? control.value
        : Array.isArray(control.value)
            ? control.value[0]
            : control.value;

    return html`
        <div class="flex gap-1/3 flex-col">
            <div class="sf-filter-operator-range flex gap-1/3 items-cross-center">
                <sf-range-slider
                        id="smart-range-slider-single"
                        min="0"
                        label="tooltip"
                        suffix="%"
                        max="100"
                        multiple=${String(isBetween)}
                        .value=${rangeValue}
                        @onSliderEnd=${(e) => {
                            host.patchTempFilterValue(field.key, {
                                value: isBetween
                                    ? e.detail.values || []
                                    : e.detail.value,
                                operator: selectedOperator,
                            });
                        }}
                ></sf-range-slider>
            </div>
            <sf-dropdown
                    size=${filterSize(host)}
                    appearance="outlined"
                    mode="select"
                    placeholder="${setText(host, 'operator')}"
                    root-class="flex-1"
                    search="false"
                    @change=${(event) => {
                        const operator =
                                event.detail?.values?.[0] ||
                                event.detail?.value ||
                                selectedOperator;
                        host.patchTempFilterValue(field.key, {operator});
                    }}
            >
                ${operators.map((operator) => html`
                    <sf-list-item
                            kind="text"
                            size=${filterSize(host)}
                            text="${host.getFilterOperatorLabel(operator)}"
                            value="${operator}"
                            ?selected=${operator === selectedOperator}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
        </div>
    `;
}

function renderNumberFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key);
    const operators = field.filter?.operators || ['eq'];
    const selectedOperator = control.operator || field.filter?.defaultOperator || operators[0];
    const isBetween = selectedOperator === 'between';
    const rawValue = control.value;
    const rangeValue = Array.isArray(rawValue)
        ? rawValue
        : [rawValue || '', ''];
    const patchNumberValue = (index, nextInputValue) => {
        if (!isBetween) {
            host.patchTempFilterValue(field.key, {
                value: nextInputValue || '',
                operator: selectedOperator,
            });
            return;
        }

        const nextValue = [...rangeValue];
        nextValue[index] = nextInputValue || '';

        host.patchTempFilterValue(field.key, {
            value: nextValue,
            operator: selectedOperator,
        });
    };

    return html`
        <div class="flex gap-1/3 flex-col">
            <div class="sf-filter-operator-inputs flex gap-1/3 items-cross-center">
                <sf-input
                        size=${filterSize(host)}
                        appearance="bordered"
                        root-class="flex-1 min-w-0"
                        label="${isBetween ? setText(host, 'rangeFrom') : host.getFilterOperatorLabel(selectedOperator)}"
                        value="${isBetween ? rangeValue[0] || '' : rawValue || ''}"
                        name="sf_filter_${field.key || 'number'}"
                        @change=${(event) => {
                            patchNumberValue(0, event.target?.value);
                        }}
                ></sf-input>
                ${isBetween ? html`
                    <sf-input
                            size=${filterSize(host)}
                            appearance="bordered"
                            label="${setText(host, 'rangeTo')}"
                            root-class="flex-1 min-w-0"
                            value="${rangeValue[1] || ''}"
                            name="sf_filter_${field.key || 'number'}_second"
                            @change=${(event) => {
                                patchNumberValue(1, event.target?.value);
                            }}
                    ></sf-input>` : nothing}
            </div>
            <sf-dropdown
                    size=${filterSize(host)}
                    appearance="outlined"
                    mode="select"
                    placeholder="${setText(host, 'operator')}"
                    root-class="flex-1"
                    search="false"
                    @change=${(event) => {
                        const operator =
                                event.detail?.values?.[0] ||
                                event.detail?.value ||
                                selectedOperator;
                        host.patchTempFilterValue(field.key, {operator});
                    }}
            >
                ${operators.map((operator) => html`
                    <sf-list-item
                            kind="text"
                            size=${filterSize(host)}
                            text="${host.getFilterOperatorLabel(operator)}"
                            value="${operator}"
                            ?selected=${operator === selectedOperator}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
        </div>
    `;
}

function renderDateFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key);
    const operators = field.filter?.operators || ['eq'];
    const selectedOperator = control.operator || field.filter?.defaultOperator || operators[0];
    const isBetween = selectedOperator === 'between';
    const dateValue = isBetween && Array.isArray(control.value)
        ? control.value
        : isBetween
            ? ['', '']
            : control.value || '';

    return html`
        <div class="flex flex-col gap-1/3">
            <sf-datepicker
                    .value=${dateValue}
                    ?range=${isBetween}
                    name="sf_filter_${field.key || 'date'}"
                    locale="ru-Ru"
                    @change=${(event) => {
                        host.patchTempFilterValue(field.key, {
                            value: event.detail.value,
                            operator: selectedOperator,
                        });
                    }}
            ></sf-datepicker>
            <sf-dropdown
                    size=${filterSize(host)}
                    appearance="outlined"
                    mode="select"
                    placeholder="${setText(host, 'operator')}"
                    root-class="flex-1"
                    search="false"
                    @change=${(event) => {
                        const operator =
                                event.detail?.values?.[0] ||
                                event.detail?.value ||
                                selectedOperator;
                        host.patchTempFilterValue(field.key, {operator});
                    }}
            >
                ${operators.map((operator) => html`
                    <sf-list-item
                            kind="text"
                            size=${filterSize(host)}
                            text="${host.getFilterOperatorLabel(operator)}"
                            value="${operator}"
                            ?selected=${operator === selectedOperator}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
        </div>
    `;
}

function renderMultiSelectFilterControl(field, host) {
    const endpointPage = host.getEndpointFilterPage(field);
    const options = host.getVisibleFilterOptions(field);
    const value = host.getFilterControlValue(field.key);
    const search = host.getFilterOptionSearch(field.key);
    const selected = new Set(value.values || []);

    return html`
        <div class="flex flex-col gap-1/2">
            ${field.filter?.searchable && (!endpointPage || endpointPage.searchable) ? html`
                <sf-input
                        size=${filterSize(host)}
                        appearance="filled"
                        placeholder="${setText(host, 'searchInList')}"
                        value="${search}"
                        name="sf_filter_${field.key || 'list'}_search"
                        @input=${(event) => {
                            host.patchTempFilterOptionSearch(
                                    field.key,
                                    event.target?.value || '',
                            );
                        }}
                        @change=${(event) => {
                            host.patchTempFilterOptionSearch(
                                    field.key,
                                    event.target?.value || '',
                            );
                        }}
                ></sf-input>
            ` : ''}
            <div class="flex flex-col gap-1/2" data-size="4.5">
                ${options.map((option) => host.renderFilterOption(field, option, selected))}
            </div>
            ${endpointPage ? html`
                <div role="status" aria-live="polite" class="sf-text-1">
                    ${endpointPage.status === 'loading' ? setText(host, 'loadingOptions') : endpointPage.status === 'error' ? setText(host, 'optionsError') : ''}
                </div>
                ${endpointPage.status === 'error' ? html`<sf-button appearance="outline" size=${filterSize(host)} text="${setText(host, 'retry')}"
                    @click=${() => host.loadEndpointFilterPage(field, null, search)}></sf-button>` : ''}
                ${endpointPage.nextCursor && endpointPage.status !== 'error' ? html`<sf-button appearance="outline" size=${filterSize(host)} text="${setText(host, 'loadMore')}"
                    ?disabled=${endpointPage.status === 'loading'}
                    @click=${() => host.loadEndpointFilterPage(field, endpointPage.nextCursor, search)}></sf-button>` : ''}
            ` : ''}
        </div>
    `;
}

function renderEntityMultiSelectFilterControl(field, host) {
    // The host travels with the call. It was lost here when these functions were
    // moved out of the table: as a method, `this.renderMultiSelectFilterControl(field)`
    // carried the receiver by itself, and as a function it has to be handed on.
    // The source suite renders no entity control, so nothing in it noticed; the
    // filter-endpoint probe did, with "Cannot read properties of undefined".
    return renderMultiSelectFilterControl(field, host);
}

// The filter template, addressed by the property type. The nine control names
// the table used are kept as aliases of the types they serve, so a host that
// declares a control by name keeps working while a host that declares a
// property type gets the same renderer.
export const FILTER_RENDERERS = {
    text: renderTextFilterControl,
    string: renderTextFilterControl,
    number: renderNumberFilterControl,
    integer: renderNumberFilterControl,
    date: renderDateFilterControl,
    datetime: renderDateFilterControl,
    range: renderRangeFilterControl,
    'date-range': renderDateFilterControl,
    'multi-select': renderMultiSelectFilterControl,
    'single-select': renderMultiSelectFilterControl,
    choice: renderMultiSelectFilterControl,
    choices: renderMultiSelectFilterControl,
    boolean: renderMultiSelectFilterControl,
    user: renderMultiSelectFilterControl,
    'entity-multi-select': renderEntityMultiSelectFilterControl,
    'entity-single-select': renderEntityMultiSelectFilterControl,
    record: renderEntityMultiSelectFilterControl,
    relation: renderEntityMultiSelectFilterControl,
};

// What a field asks to be filtered by: its own declared control if it has one,
// otherwise its property type, otherwise text.
export function renderFilterField(field = {}, host) {
    const asked = field.filter?.control || field.propertyType || field.type || field.dataType || 'text';
    const renderer = FILTER_RENDERERS[asked] || FILTER_RENDERERS.text;

    return renderer(field, host);
}


// The cell template. A cell is text unless the Framework has a component that
// says more than the text would, and the set renders one only when it can state
// the shape the value must have. Anything else falls back to the value itself,
// so a host that stores a plain string keeps seeing a plain string.
//
// The value shapes are the consumer's, agreed with Larena on 2026-10-06: a
// renderer cannot turn an opaque reference into a name, and resolving one needs
// an access check, so the host sends what it has resolved.
//
//   choice              a value matching one of the column's options
//   integer / number    a number, and with the `scale` variant a number 0..100
//   boolean             true or false
//   user                {value, label, avatarText}
//   record / relation   {value, label, href?} -- href only when it may be opened
//   file                {value, label, mime?, href?} -- an icon from the mime
//                       type and the label, a link when it may be opened
//   choices             a list of option values; one tag per value on the line
//
// Every element here takes `line`, not `size`: a line element is the row's text
// line, where a control height would make the row grow. That was measured --
// with size-1/2 components a default row went from 57 to 61 on desktop and 45 to
// 51 on mobile.
const CELL_LINE = '1/2';

// A choice badge in a cell is tonal, not the filled default. sf-badges defaults
// appearance to `main`, so the cells shipped filled and the consumer's owner
// asked for the calmer one -- and a table row is the place for it: a column of
// filled badges reads as a column of buttons. A field may still ask for another
// of the three, which is the same arrangement as the boolean's words: the set
// carries a sensible default, not a decision nobody can change.
//
// It composes with colour rather than replacing it. A scheme name reaches the
// scheme's tonal badge; a hex colour already writes --sf-badge--background-color
// as a 24% mix and its own text colour, so the tint survives the appearance
// untouched. Both are measured on the built bytes.
const CELL_BADGE_APPEARANCE = 'tonal';

// A file cell is a reference link with an icon chosen from the mime type: the
// consumer asked for an icon and the label and nothing else -- no size as text
// and no download button, which the record view will carry -- and the component
// that owns that shape already exists. sf-file-preview detects only image/*, so
// this small map lives here until a second caller needs it, which is the session
// that owns that component's own judgement.
const FILE_ICONS = [
    [/^image\//u, 'image'],
    [/^video\//u, 'movie'],
    [/^audio\//u, 'audiotrack'],
    [/^text\/(csv|tab-separated-values)$/u, 'table'],
    [/^text\//u, 'description'],
    [/pdf$/u, 'picture_as_pdf'],
    [/(zip|compressed|tar|rar|7z)/u, 'folder_zip'],
    [/(sheet|excel|spreadsheet)/u, 'table'],
    [/(word|document)$/u, 'description'],
    [/(presentation|powerpoint)/u, 'slideshow'],
];

function fileIcon(mime) {
    const value = String(mime || '').toLowerCase();
    const match = FILE_ICONS.find(([pattern]) => pattern.test(value));

    return match ? match[1] : 'attach_file';
}

// A colour has the same four faces as every other property. It was absent while a
// running Larena site declares fourteen colours, so a theme colour had nowhere to
// be shown and nowhere to be changed.
//
// `inheritedValue` matters here as much as the value: the site's own colours are
// inherited from the theme until somebody chooses one, and a cell that drew the
// inherited colour as the value would say a record had decided something it had
// not.
function renderColorCell(field, value) {
    const hex = scalarValue(value);
    if (!hex) return nothing;
    // The component, not a span with classes of its own: the renderer set has no
    // stylesheet, so markup invented here would reach no rules at all -- and a
    // colour should look the same in a cell as it does in a card, which is what a
    // general part is for.
    return html`
        <sf-color size="1/2" appearance="plain" value=${String(hex)}
                  label=${field.label || field.key || ''} disabled></sf-color>
    `;
}

// Reads what port 1.8.0 declares: `inherited` says a value comes from somewhere
// else, `inheritedValue` says what it is. A view that drew the inherited colour as
// the value would make «not set» and «set to the same colour» look identical, and
// only the first follows the theme when the theme moves.
function renderColorView(field, value) {
    const hex = scalarValue(value);
    const inherited = field.inheritedValue ?? '';
    if (!hex && !inherited) return nothing;
    return html`
        <sf-color
                size="1"
                appearance="plain"
                value=${hex ? String(hex) : nothing}
                inherited-value=${inherited ? String(inherited) : nothing}
                label=${field.label || field.key || ''}
                disabled
        ></sf-color>
    `;
}

function renderColorEdit(field, value, host) {
    const hex = scalarValue(value);
    const inherited = field.inheritedValue ?? '';
    return html`
        <sf-color
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${hex ? String(hex) : nothing}
                inherited-value=${inherited ? String(inherited) : nothing}
                swatches=${field.swatches ? String(field.swatches) : nothing}
                ?clearable=${Boolean(inherited) || field.required !== true}
                ?disabled=${field.readonly === true}
                label=${field.label || field.key || ''}
                @change=${(event) => host.setFieldValue(field, event.detail?.value ?? '')}
        ></sf-color>
    `;
}

function renderFileCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;
    // A column the host says holds images shows each as a thumbnail; any other
    // file as a tile with its extension. Which files are images is the host's
    // to say through the variant, never guessed from a name.
    if (isImageField(field)) return renderFilePreviewCell(value);

    return {
        component: {
            type: 'reference-link',
            props: {
                line: CELL_LINE,
                label: String(value.label),
                icon: fileIcon(value.mime),
                ...(value.href ? {href: String(value.href)} : {}),
            },
        },
    };
}

// A file as a thumbnail on the row's line: the image when the host gave its
// address and its type is an image, the extension in a tile otherwise. It is
// sf-file-preview told to show nothing but its leading visual, so a file looks
// the same in a row as in the record that holds it.
function renderFilePreviewCell(value) {
    const mime = String(value.mime ?? value.mimeType ?? '');
    const image = Boolean(value.href) && /^image\//u.test(mime);
    return {
        component: {
            type: 'file-preview',
            props: {
                compact: true,
                fileName: String(value.label),
                mimeType: mime,
                icon: fileIcon(mime),
                ...(value.href ? {href: String(value.href)} : {}),
                ...(image ? {imageUrl: String(value.href), kind: 'image'} : {kind: 'icon'}),
                actions: false,
                downloadAction: false,
                removeAction: false,
            },
        },
    };
}

// Several values in one cell: one tag per value, each on the row's text line.
// The tag's `line` resolves its own size and inline mode, so neither is passed
// -- the session that owns it fixed the template to read the resolved values
// rather than the attributes, which is what makes that true.
function renderChoicesCell(field, value) {
    if (!Array.isArray(value) || !value.length) return null;
    if (String(field.variant ?? '') === 'badges') return renderChoicesBadgesCell(field, value);
    const options = field.options || field.filter?.options || field.constraints?.options;
    const label = (item) => {
        const option = Array.isArray(options)
            ? options.find((candidate) => String(candidate?.value) === String(item))
            : null;

        return String(option?.label ?? option?.text ?? item);
    };

    return value.map((item) => ({
        component: {type: 'tag', props: {line: CELL_LINE, kind: 'default', text: label(item)}},
    }));
}

// Several values as tonal badges, each coloured by its option's scheme -- a
// page's publication in each language. A value may be {value, text}: the host
// says more in that one cell than the option's label («ru · 14.10 09:00»), which
// is the host's to format, so the set does not.
function renderChoicesBadgesCell(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    return value.map((item) => {
        const key = item && typeof item === 'object' ? item.value : item;
        const option = Array.isArray(options)
            ? options.find((candidate) => String(candidate?.value) === String(key))
            : null;
        const badge = option ? optionBadgeProps(option) : null;
        const text = item && typeof item === 'object' && item.text !== undefined
            ? String(item.text)
            : String(option?.label ?? option?.text ?? key);
        return {
            component: {
                type: 'badge',
                props: {
                    line: CELL_LINE,
                    text,
                    appearance: field.badgeAppearance ?? CELL_BADGE_APPEARANCE,
                    ...(badge?.scheme ? {scheme: badge.scheme} : {}),
                    ...(badge?.rootStyle ? {rootStyle: badge.rootStyle} : {}),
                },
            },
        };
    });
}

const CELL_RENDERERS = {
    // A date in a row used to be whatever the host had stored, printed --
    // «2026-09-25T07:12:00+03:00» beside the same value reading «25 сентября
    // 2026» in the record panel, with no way for a consumer to change the
    // first. These two ask the host and fall through to the stored value when
    // it has nothing to say.
    date: renderHostFormattedCell,
    datetime: renderHostFormattedCell,
    boolean: renderBooleanCell,
    choices: renderChoicesCell,
    file: renderFileCell,
    color: renderColorCell,
    include: renderIncludeCell,
    choice: renderChoiceCell,
    integer: renderNumericCell,
    number: renderNumericCell,
    user: renderUserCell,
    record: renderReferenceCell,
    relation: renderReferenceCell,
};

// A consumer found this on their stand: the words were written into the set, so
// an English admin saw «Да». The set must not decide what a value is called in
// anyone's language. They come from the field, which is where the rest of the
// Framework keeps its text -- sf-table declares fourteen such inputs -- and the
// Russian stays only as the fallback, so nothing already published changes.
// The field's own words win, as they must: what «true» is called belongs to
// whoever owns the interface. The fallback used to be Russian whatever the page
// was -- an English admin saw «Да» -- so it follows the page's language now.
function booleanWords(field, host) {
    return {
        yes: field.trueText ?? field.labels?.true ?? setText(host, 'yes'),
        no: field.falseText ?? field.labels?.false ?? setText(host, 'no'),
    };
}

function renderBooleanCell(field, value, host) {
    if (typeof value !== 'boolean') return null;

    const words = booleanWords(field, host);

    return value ? words.yes : words.no;
}

function renderChoiceCell(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    if (!Array.isArray(options)) return null;
    const option = options.find((item) => String(item?.value) === String(value));
    if (!option) return null;

    const badge = optionBadgeProps(option);

    return {
        component: {
            type: 'badge',
            props: {
                line: CELL_LINE,
                text: option.label ?? option.text ?? String(value),
                appearance: field.badgeAppearance ?? CELL_BADGE_APPEARANCE,
                ...(badge?.scheme ? {scheme: badge.scheme} : {}),
                ...(badge?.rootStyle ? {rootStyle: badge.rootStyle} : {}),
            },
        },
    };
}

// The scale is the `scale` variant of a number, and sf-progress-scale takes a
// value between 0 and 100 with no bounds of its own -- which is why the request
// asks for the variant on a field declaring exactly min 0 and max 100. A value
// outside that range is left as text rather than clamped: a clamped number is a
// wrong number drawn confidently.
// A cell the host has formatted. Null when it has not, so the value falls
// through to the plain one the table already prints: the set does not invent a
// format, and «798700» is a better answer than a thousands separator somebody
// did not ask for. What it does not do is leave a consumer no way to say
// «798 700 ₽» -- which was the state of a list until the host reached the cells.
function renderHostFormattedCell(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    return typeof formatted === 'string' && formatted !== '' ? formatted : null;
}

function renderNumericCell(field, value, host) {
    const variant = field.variant || field.filter?.variant;
    const number = Number(scalarValue(value));
    if (variant !== 'scale' || !Number.isFinite(number)) {
        return renderHostFormattedCell(field, value, host);
    }
    if (number < 0 || number > 100) return null;

    return {
        component: {
            type: 'progress-scale',
            props: {line: CELL_LINE, value: String(number)},
        },
    };
}

// A reference in a cell is a link and nothing else: the arrow a reference card
// carries said «goes somewhere» a second time beside a label that is already a
// link, and on a dense row it was the widest thing in the cell. Without an href
// the label is plain text -- a link that leads nowhere is not drawn as one.
function referenceLink(value) {
    return {
        component: {
            type: 'reference-link',
            props: {
                line: CELL_LINE,
                appearance: 'plain',
                icon: '',
                label: String(value.label),
                ...(value.href ? {href: String(value.href)} : {}),
            },
        },
    };
}

// A person: the avatar and the name, the name a link to the profile when the
// host gives its href.
function renderUserCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;

    return [
        {component: {type: 'avatar', props: {line: CELL_LINE, text: value.avatarText || ''}}},
        value.href ? referenceLink(value) : String(value.label),
    ];
}

function renderReferenceCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;

    return referenceLink(value);
}

// What a cell should hold for a field, in the same shape a host would pass: a
// string, an object with a component, or a list of those. Null means the value
// is better off as itself. Returning the host's own shape is deliberate -- the
// table renders it through the path it already had, so the set adds no second
// way to draw a cell.
export function renderCellField(field = {}, value, host) {
    const asked = field.propertyType || field.type || field.dataType;
    const renderer = CELL_RENDERERS[asked];
    if (!renderer) return null;

    // `host` is for one thing, as in the view: formatFieldValue, where a
    // consumer's own formatting of a number or a date belongs. A cell had no way
    // to reach it, so a list could not be formatted at all while the record
    // panel beside it could.
    const rendered = renderer(field, value, host);

    return rendered === null || typeof rendered === 'undefined' ? null : rendered;
}


// The edit template. A field being edited is a control of the form scale, not of
// a row: these take `size`, where the cell template takes `line`.
//
// The host supplies the value and takes the change, through two methods, because
// a renderer must not decide where a value lives:
//
//   getFieldValue(field)          what the control shows
//   setFieldValue(field, value)   what the control writes
//
// Every event bound here is `change`, and that is a rule now rather than a
// coincidence: contracts/public-api-axes.json `change_event` says every form
// value control reports a committed change as `change` on its host, once per
// change the user makes, with each older name kept as an alias the manifest
// marks `alias_of`. So the set binds the canonical name for all of them --
// sf-input, sf-textarea, sf-switch, sf-dropdown, sf-button-group and
// sf-datepicker -- where it bound three different alias names before. The one
// event this file still binds under its own name is sf-file-upload:select,
// which is not a value change but a selection; the `change` on that component
// is its inner input's.
// The size the controls are drawn at: 1, or 1/2 when the host asks for it
// with renderEditField(…, {size: '1/2'}) -- a record view beside a table at
// 1/2 read a step larger than it (owner, 2026-10-14). Set for the duration of
// one synchronous render.
let EDIT_SIZE = '1';

const EDIT_RENDERERS = {
    record: renderRecordPicker,
    relation: renderRecordPicker,
    user: renderRecordPicker,
    string: renderTextEdit,
    text: renderTextAreaEdit,
    integer: renderNumberEdit,
    number: renderNumberEdit,
    date: renderDateEdit,
    datetime: renderDateEdit,
    boolean: renderBooleanEdit,
    choice: renderChoiceEdit,
    choices: renderChoicesEdit,
    file: renderFileEdit,
    color: renderColorEdit,
    include: renderIncludeEdit,
};

function fieldName(field) {
    return `sf_field_${field.key || 'value'}`;
}

// A telephone is a string with a shape, not a type of its own: the Framework
// already has a control that knows country codes, dial prefixes and masks, so a
// `string` whose variant is `phone` gets it and everything else about a string
// stays true. Counted on a running Larena site, which declares one.
function renderPhoneEdit(field, value, host) {
    return html`
        <sf-country-code
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                value=${scalarValue(value) ?? ''}
                label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?disabled=${field.readonly === true}
                use-mask="true"
                show-code="true"
                @change=${(event) => host.setFieldValue(field, event.detail?.value ?? event.target?.value ?? '')}
        ></sf-country-code>
    `;
}

// A file shown as what it is. The site keeps logos, so a file whose variant says
// image is drawn as the image rather than as a row with a paperclip -- the same
// stored file, told apart by the host rather than guessed from a file name.
const IMAGE_VARIANTS = new Set(['image', 'image-card', 'image-list']);

function isImageField(field) {
    return IMAGE_VARIANTS.has(String(field.variant ?? ''));
}

// A block of text or code the host keeps in a file: six of them on a running
// Larena site -- scripts in the head, an included area. It is a property like any
// other, so it is shown and edited here rather than behind a separate screen.
//
// `language` is the host's, never guessed from the text: a component that decided
// a file was JavaScript because it saw a brace would be wrong about every template
// that contains one. Without a language it is plain text and says so by looking
// like text.
//
// No syntax colouring. That needs an editor component, which is its own part with
// its own decision; a monospace area that keeps indentation is honest, usable and
// does not pretend to be more.
function renderIncludeView(field, value) {
    const text = scalarValue(value);
    if (!text) return nothing;
    return html`
        <pre class="sf-field-include" data-language=${field.language ? String(field.language) : nothing}><code>${String(text)}</code></pre>
    `;
}

function renderIncludeEdit(field, value, host) {
    return html`
        <sf-textarea
                size=${EDIT_SIZE}
                appearance="bordered"
                class="sf-field-include-edit"
                name=${fieldName(field)}
                value=${scalarValue(value) ?? ''}
                rows="8"
                spellcheck="false"
                aria-label=${field.label || field.key || ''}
                ?disabled=${field.readonly === true}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-textarea>
    `;
}

function renderIncludeCell(field, value) {
    const text = scalarValue(value);
    if (!text) return nothing;
    // One line in a cell: a script in a table row is a fact about the record, not
    // something to read there.
    const first = String(text).split('\n')[0];
    return html`<code>${first.length > 60 ? `${first.slice(0, 60)}…` : first}</code>`;
}

function renderTextEdit(field, value, host) {
    if (String(field.variant ?? '') === 'phone') return renderPhoneEdit(field, value, host);
    value = scalarValue(value);
    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-input>
    `;
}

function renderTextAreaEdit(field, value, host) {
    value = scalarValue(value);
    return html`
        <sf-textarea
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-textarea>
    `;
}

function renderNumberEdit(field, value, host) {
    const decimal = (field.propertyType || field.type) === 'number';
    value = scalarValue(value);

    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                inputmode=${decimal ? 'decimal' : 'numeric'}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => {
                    const next = event.target?.value ?? '';
                    host.setFieldValue(field, next === '' ? null : Number(next));
                }}
                @change=${(event) => {
                    const next = event.target?.value ?? '';
                    host.setFieldValue(field, next === '' ? null : Number(next));
                }}
        ></sf-input>
    `;
}

// A date control has no clock. `sf-datepicker` declares a format and a date,
// and its parser is anchored (`^\d{4}-\d{2}-\d{2}$`), so a datetime value
// falls through to a loose digit scan that reads `2026-11-27T13:26:00` as day
// 2026 of month 11 in year 27 -- an impossible date, which renders as an empty
// input. Split the value instead: the control edits the day, and the time the
// record already held is put back on the way out. Without that, editing the day
// of a datetime would write a value with the clock silently zeroed, which is
// worse than the empty control, because it looks like it worked.
const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2})?$/;

function splitDateTime(value) {
    const match = typeof value === 'string' ? value.trim().match(DATE_TIME_RE) : null;
    if (!match) {
        return {date: value, suffix: ''};
    }

    return {date: match[1], suffix: `T${match[2]}${match[3] || ''}`};
}

function renderDateEdit(field, value, host) {
    value = scalarValue(value);
    const {date, suffix} = splitDateTime(value);
    return html`
        <sf-datepicker
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                value=${date ?? ''}
                label=${field.label || ''}
                @change=${(event) => {
                    const next = event.detail?.value ?? event.target?.value ?? null;
                    host.setFieldValue(field, next && suffix ? `${next}${suffix}` : next);
                }}
        ></sf-datepicker>
    `;
}

// A required boolean is a switch: two states are all it has. An optional one is
// a pair of buttons with nothing chosen while the value is absent -- the
// consumer owner's decision of 2026-10-06, and the reason is that a switch
// cannot say «не задано»: rendering one over an absent value would write false
// on the first save, a value nobody chose.
function renderBooleanEdit(field, value, host) {
    const optional = field.required !== true;

    if (!optional) {
        return html`
            <sf-switch
                    size=${EDIT_SIZE}
                    name=${fieldName(field)}
                    ?checked=${value === true}
                    label=${field.label || ''}
                    @change=${(event) => host.setFieldValue(field, Boolean(event.target?.checked))}
            ></sf-switch>
        `;
    }

    const words = booleanWords(field, host);
    const items = JSON.stringify([
        {value: 'yes', label: words.yes},
        {value: 'no', label: words.no},
    ]);

    return html`
        <sf-button-group
                size=${EDIT_SIZE}
                items=${items}
                value=${value === true ? 'yes' : value === false ? 'no' : nothing}
                aria-label=${field.label || field.key || ''}
                @change=${(event) => {
                    const next = event.detail?.value;
                    host.setFieldValue(field, next === 'yes' ? true : next === 'no' ? false : null);
                }}
        ></sf-button-group>
    `;
}

function editOptions(field, value, multiple) {
    const options = field.options || field.filter?.options || field.constraints?.options || [];
    const chosen = multiple
        ? new Set((Array.isArray(value) ? value : []).map((item) => String(item)))
        : new Set([String(value ?? '')]);

    return options.map((option) => ({
        type: 'text',
        size: '1',
        text: option.label ?? option.text ?? String(option.value),
        value: String(option.value),
        selected: chosen.has(String(option.value)),
    }));
}

function renderChoiceEdit(field, value, host) {
    value = scalarValue(value);
    return html`
        <sf-dropdown
                size=${EDIT_SIZE}
                appearance="outlined"
                mode="select"
                search="false"
                name=${fieldName(field)}
                value=${value ?? ''}
                aria-label=${field.label || field.key || ''}
                .options=${editOptions(field, value, false)}
                @change=${(event) => host.setFieldValue(field, event.detail?.value ?? null)}
        ></sf-dropdown>
    `;
}

function renderChoicesEdit(field, value, host) {
    return html`
        <sf-dropdown
                size=${EDIT_SIZE}
                appearance="outlined"
                mode="select"
                multiple
                search="false"
                name=${fieldName(field)}
                aria-label=${field.label || field.key || ''}
                .options=${editOptions(field, value, true)}
                @change=${(event) => {
                    const next = event.detail?.values ?? event.detail?.value;
                    host.setFieldValue(field, Array.isArray(next) ? next : next ? [next] : []);
                }}
        ></sf-dropdown>
    `;
}

// The record picker: what a record, a relation or a user is edited with.
//
// It is the entity-select the filter already has, pointed at records instead of
// options and holding one value rather than several. The three cases that break
// a picker are the ones it is built around, and the ones the probe measures
// against the consumer's 448-target field:
//
//   search   hundreds of targets never fit a list, so the search is the way in
//   paging   a page arrives with a cursor and the next is asked for
//   off-page the chosen record is usually not on the page in front of you, so
//            the picker shows what is chosen whether or not the page holds it
//
// The host does the fetching, because a page of records is a query with an
// access check, and the renderer must not make one:
//
//   getFieldOptionsPage(field)                  the page the host holds
//   loadFieldOptions(field, {cursor, search})   ask for a page
//   getFieldOptionSearch(field) / setFieldOptionSearch(field, text)
//
// The value is the resolved object the consumer sends: {value, label}. The
// picker writes the same shape back, so a host never has to re-resolve what it
// already knew.
// The text the set shows beyond a value: a status line, a retry, a load-more, a
// remove label. These belong to whoever owns the interface, not to the set, so
// the host supplies them and the Russian is only the fallback -- the same
// arrangement as `booleanWords`, and the same reason. A host that passes nothing
// keeps exactly what was published.
const SET_TEXT = {
    en: {
        yes: 'Yes',
        no: 'No',
        searchInList: 'Find in the list',
        operator: 'Operator',
        rangeFrom: 'From',
        rangeTo: 'To',
        loadingOptions: 'Loading the options',
        optionsError: 'The options could not be loaded',
        pickRecord: 'Choose a record',
        searchRecords: 'Find a record',
        loadingRecords: 'Loading records',
        recordsError: 'The records could not be loaded',
        retry: 'Try again',
        loadMore: 'Load more',
        removeFile: 'Remove',
    },
    ru: {
        yes: 'Да',
        no: 'Нет',
        searchInList: 'Найти в списке',
        operator: 'Оператор',
        rangeFrom: 'От',
        rangeTo: 'До',
        loadingOptions: 'Загрузка вариантов',
        optionsError: 'Не удалось загрузить варианты',
        pickRecord: 'Выберите запись',
        searchRecords: 'Найти запись',
        loadingRecords: 'Загрузка записей',
        recordsError: 'Не удалось загрузить записи',
        retry: 'Повторить',
        loadMore: 'Загрузить ещё',
        removeFile: 'Удалить',
    },
};

// The host's word wins, as it always did; the set's own fallback now follows
// the page's language instead of being Russian whatever the page is. `host` is
// the component that called the set, which is the node the rule reads from.
// The set is not an element, so it is named here rather than taken from the
// node: `host` is whichever component called it, and words registered for the
// set should apply wherever it draws rather than once per host.
const SET_NAME = 'sf-field-renderers';

function setText(host, key) {
    return host?.getFieldText?.(key) ?? pageText(SET_TEXT, key, host ?? null, SET_NAME);
}

function renderRecordPicker(field, value, host) {
    if (!host.loadFieldOptions || !host.getFieldOptionsPage) return null;

    const page = host.getFieldOptionsPage(field) || null;
    // A host that refused this field's candidates has none to give, now or ever.
    // Returning nothing here puts the field on the read-only fallback, which shows
    // the value it holds -- rather than an empty picker and a retry that cannot
    // succeed, over a value that is actually there.
    if (page?.status === 'unsupported') return null;
    const search = host.getFieldOptionSearch?.(field) ?? '';
    const chosen = value && typeof value === 'object' ? value : null;
    const items = Array.isArray(page?.items) ? page.items : [];
    // What is chosen stays in the list even when the page does not hold it --
    // the common case at 448 targets, and the one that makes a picker look like
    // it has forgotten the answer.
    const options = [
        ...(chosen && !items.some((item) => String(item.value) === String(chosen.value)) ? [chosen] : []),
        ...items,
    ].map((item) => ({
        type: 'text',
        size: '1',
        text: String(item.label ?? item.value),
        value: String(item.value),
        selected: Boolean(chosen && String(chosen.value) === String(item.value)),
    }));

    const pick = (next) => {
        if (!next) {
            host.setFieldValue(field, null);
            return;
        }
        const found = [chosen, ...items].find((item) => item && String(item.value) === String(next));
        host.setFieldValue(field, found ? {value: found.value, label: found.label} : {value: next});
    };

    return html`
        <div class="sf-field-picker flex flex-col gap-1/3" data-field-picker=${field.key || nothing}>
            <sf-dropdown
                    size=${EDIT_SIZE}
                    appearance="outlined"
                    mode="select"
                    search="true"
                    name=${fieldName(field)}
                    value=${chosen ? String(chosen.value) : ''}
                    placeholder=${field.placeholder || setText(host, 'pickRecord')}
                    search-placeholder=${field.searchPlaceholder || setText(host, 'searchRecords')}
                    aria-label=${field.label || field.key || ''}
                    .options=${options}
                    @change=${(event) => pick(event.detail?.value ?? null)}
                    @input=${(event) => {
                        const text = event.target?.value ?? '';
                        host.setFieldOptionSearch?.(field, text);
                        host.loadFieldOptions(field, {cursor: null, search: text});
                    }}
            ></sf-dropdown>
            ${page ? html`
                <div class="sf-field-picker-state flex items-cross-center gap-1/3">
                    <div role="status" aria-live="polite" class="sf-text-1">
                        ${page.status === 'loading' && !page.quiet ? setText(host, 'loadingRecords')
                            : page.status === 'error' ? setText(host, 'recordsError') : ''}
                    </div>
                    ${page.status === 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'retry')}
                                @click=${() => host.loadFieldOptions(field, {cursor: null, search})}
                        ></sf-button>
                    ` : nothing}
                    ${page.nextCursor && page.status !== 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'loadMore')}
                                ?disabled=${page.status === 'loading'}
                                @click=${() => host.loadFieldOptions(field, {cursor: page.nextCursor, search})}
                        ></sf-button>
                    ` : nothing}
                </div>
            ` : nothing}
        </div>
    `;
}

// The `file` edit control, composed from the two halves that already exist:
// sf-file-preview for what is stored, sf-file-upload for what is arriving. They
// are not interchangeable and the split is not cosmetic -- the preview carries
// href, download and remove, the upload zone carries progress, retry and the
// selection itself. Neither renders the other's state, so a field that both
// holds files and accepts new ones needs both.
//
// sf-file-upload transfers no bytes. It selects files, keeps an `items` list of
// {state, progress, name, fileSize, errorMessage}, and emits events; the
// transfer is the host's, which is why this renderer asks the host for it
// rather than inventing an endpoint inside the set:
//
//   host.startFieldUpload(field, items)  -- begin transferring; the host writes
//                                           the stored value when a file lands
//   host.getFieldUploads(field)          -- the items in flight, upload-shaped
//   host.retryFieldUpload(field, index)  -- optional; without it, no retry
//   host.setFieldValue(field, next)      -- as every edit renderer
//
// Without the first two the zone is not rendered at all and the stored files
// stay editable, because removing a file that is already there needs no
// transfer. A zone that cannot upload is worse than no zone.
//
// `items` has one writer, and that is the host. The component fills its own
// list the moment files are chosen, but every render writes the host's list
// over it -- so a host that records what `startFieldUpload` was handed sees the
// files it selected, and a host that ignores them watches its own selection
// disappear on the next render. The selected items arrive already in the
// component's own shape, each carrying the real File in `.file`, so recording
// them is a push and not a conversion.
function storedFiles(value) {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
    return value && typeof value === 'object' ? [value] : [];
}

function renderFileEdit(field, value, host) {
    const files = storedFiles(value);
    const multiple = field.multiple === true || Array.isArray(value);
    const canUpload = Boolean(host.startFieldUpload && host.getFieldUploads);
    const uploads = canUpload ? host.getFieldUploads(field) : null;
    const items = Array.isArray(uploads) ? uploads : [];

    const drop = (index) => {
        const next = files.filter((_, position) => position !== index);
        host.setFieldValue(field, multiple ? next : (next[0] ?? null));
    };

    // download-action and remove-action both read true when the attribute is
    // absent, so a file with no href has to say false rather than drop it.
    return html`
        <div class="sf-field-file flex flex-col">
            ${files.map((file, index) => html`
                <sf-file-preview
                        file-name=${String(file.label ?? file.name ?? 'File')}
                        file-size=${String(file.size ?? '')}
                        icon=${fileIcon(file.mime ?? file.mimeType)}
                        mime-type=${String(file.mime ?? file.mimeType ?? '')}
                        href=${file.href ? String(file.href) : nothing}
                        download-action=${file.href ? 'true' : 'false'}
                        remove-action="true"
                        remove-label=${`${setText(host, 'removeFile')} ${file.label ?? file.name ?? ''}`.trim()}
                        @sf-file-preview:remove=${() => drop(index)}
                ></sf-file-preview>
            `)}

            ${canUpload
                    ? html`
                        <sf-file-upload
                                size=${EDIT_SIZE}
                                name=${fieldName(field)}
                                accept=${String(field.accept ?? '')}
                                formats=${String(field.formats ?? '')}
                                link-text=${field.uploadText || nothing}
                                text=${field.uploadHint || nothing}
                                supporting-text=${field.uploadSupportingText || nothing}
                                ?multiple=${multiple}
                                ?disabled=${field.readonly === true}
                                aria-label=${field.label || field.key || ''}
                                .items=${items}
                                @sf-file-upload:select=${(event) => {
                                    const picked = event.detail?.files;
                                    const list = Array.isArray(picked) ? picked : [];
                                    if (list.length) host.startFieldUpload(field, list);
                                }}
                                @sf-file-upload:retry=${(event) => {
                                    host.retryFieldUpload?.(field, Number(event.detail?.index ?? -1));
                                }}
                        ></sf-file-upload>
                    `
                    : nothing}
        </div>
    `;
}


// The control a field is edited with, or null when the set has none for that
// type yet.
const sizeOption = (options) => (options?.size === '1/2' ? '1/2' : '1');

export function renderEditField(field = {}, value, host, options = {}) {
    const asked = field.propertyType || field.type || field.dataType;
    const renderer = EDIT_RENDERERS[asked];
    if (!renderer || !host?.setFieldValue) return null;

    const outer = EDIT_SIZE;
    EDIT_SIZE = sizeOption(options);
    try {
        return renderer(field, value, host);
    } finally {
        EDIT_SIZE = outer;
    }
}


// The view template: a field shown and not edited, which is the fourth of the
// four the assignment names and the last one the set was missing.
//
// It renders lit templates rather than the host-shaped values the cell template
// returns, because its consumer is a record view rendering into its own layout,
// exactly as the edit template's is. The cell template returns host shapes only
// because sf-table already had a path for those.
//
// `line` and not `size` for everything that sits beside a label on one text
// line -- a badge, a tag, an avatar, a reference link. A size would give those a
// control's height and stand them taller than the words next to them, which is
// the mistake the cell template already avoids one rung down. The two that are
// not inline keep their own scale: a scale bar is a control, and a file preview
// has no visual size at all, its `size` being a legacy name for the file's size
// as text.
// The line a viewed value is drawn on: 1, or 1/2 with {size: '1/2'}, as above.
let VIEW_LINE = '1';

// A scalar may arrive as the value itself or as {value, text}: the data and the
// host's own formatting of it. The consumer asked for the second and they are
// right -- the Framework has no locale and should not acquire one through a field
// renderer. They already hold the localised text, the viewer's locale and the
// format rules, and a second formatter here would disagree with theirs the first
// time a format setting changed. `text` is the formatted value alone; a unit
// stays its own field so a column of numbers can align its units.
function carriesText(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        && typeof value.text === 'string';
}

function scalarValue(value) {
    return carriesText(value) ? value.value : value;
}

function viewText(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    if (typeof formatted === 'string') return formatted;
    if (carriesText(value)) return value.text;
    const plain = scalarValue(value);
    return plain === null || typeof plain === 'undefined' ? '' : String(plain);
}

function renderTextView(field, value, host) {
    const text = viewText(field, value, host);
    return text ? html`<span class="sf-field-view">${text}</span>` : nothing;
}

// A number carries its unit when the field declares one, and nothing when it
// does not -- the set does not guess at a unit, and «42» with an invented «шт»
// beside it is a worse answer than «42».
function renderNumberView(field, value, host) {
    if (value === null || typeof value === 'undefined' || value === '') return nothing;
    const variant = field.variant || field.filter?.variant;
    // The scale needs the number, not the host's text for it.
    const number = Number(scalarValue(value));

    if (variant === 'scale' && Number.isFinite(number) && number >= 0 && number <= 100) {
        return html`<sf-progress-scale size="1" value=${String(number)}></sf-progress-scale>`;
    }

    const text = viewText(field, value, host);
    return html`<span class="sf-field-view">${field.unit ? `${text} ${field.unit}` : text}</span>`;
}

// A date is the host's to format. The set has no locale and will not invent one:
// without formatFieldValue it shows what it was given, which is at worst the
// stored form and never a wrong date confidently rendered.
function renderDateView(field, value, host) {
    const text = viewText(field, value, host);
    return text ? html`<span class="sf-field-view">${text}</span>` : nothing;
}

function renderBooleanView(field, value, host) {
    if (typeof value !== 'boolean') return nothing;
    const words = booleanWords(field, host);
    return html`<span class="sf-field-view">${value ? words.yes : words.no}</span>`;
}

function renderChoiceView(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    const option = Array.isArray(options)
        ? options.find((item) => String(item?.value) === String(value))
        : null;
    if (!option) return nothing;
    const badge = optionBadgeProps(option);

    return html`
        <sf-badge
                line=${VIEW_LINE}
                appearance=${field.badgeAppearance ?? CELL_BADGE_APPEARANCE}
                scheme=${badge.scheme}
                style=${badge.rootStyle || nothing}
                text=${String(option.label ?? option.text ?? value)}
        ></sf-badge>
    `;
}

function renderChoicesView(field, value) {
    if (!Array.isArray(value) || !value.length) return nothing;
    const options = field.options || field.filter?.options || field.constraints?.options;
    const label = (item) => {
        const option = Array.isArray(options)
            ? options.find((candidate) => String(candidate?.value) === String(item))
            : null;
        return String(option?.label ?? option?.text ?? item);
    };

    return html`
        <span class="sf-field-view flex items-cross-center gap-1/3">
            ${value.map((item) => html`<sf-tag line=${VIEW_LINE} kind="default" text=${label(item)}></sf-tag>`)}
        </span>
    `;
}

// A person, as in a cell: the name links to the person when the host gives
// the href -- every value that points at a record opens it (owner,
// 2026-10-14). Plain, as a reference read in a record's field is.
function renderUserView(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return nothing;

    return html`
        <span class="sf-field-view flex items-cross-center gap-1/3">
            <sf-avatar line=${VIEW_LINE} text=${value.avatarText || ''}></sf-avatar>
            ${value.href
                ? html`<sf-reference-link appearance="plain" icon="" line=${VIEW_LINE}
                        label=${String(value.label)} href=${String(value.href)}></sf-reference-link>`
                : html`<span>${String(value.label)}</span>`}
        </span>
    `;
}

function renderReferenceView(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return nothing;

    // Plain, and without the arrow: a reference read inside a record's field is
    // a value on a line, not a card. The card's frame and fill drew a second box
    // around a value that already sits in one, and the arrow said «go» beside a
    // word that is already a link (owner, 2026-10-08).
    return html`
        <sf-reference-link
                appearance="plain"
                icon=""
                line=${VIEW_LINE}
                label=${String(value.label)}
                href=${value.href ? String(value.href) : nothing}
        ></sf-reference-link>
    `;
}

// The one place the view template is not a smaller edit control: a stored file
// is shown with its own preview, which carries the download the view wants and
// not the remove an edit does.
function renderFileView(field, value) {
    const files = storedFiles(value);
    if (!files.length) return nothing;

    // An image is shown as the image. `image-url` and `kind` are inputs the file
    // preview already has, so this is the same component told what it is holding
    // rather than a second way of drawing a file. Which files are images is the
    // host's to say through the variant: guessing from a file name would be wrong
    // for every stored file whose name does not end in a familiar three letters.
    const asImage = isImageField(field);
    const card = String(field.variant ?? '') === 'image-card';

    return html`
        <span class="sf-field-view flex ${card ? 'flex-row' : 'flex-col'} gap-1/3">
            ${files.map((file) => html`
                <sf-file-preview
                        file-name=${String(file.label ?? file.name ?? 'File')}
                        file-size=${String(file.size ?? '')}
                        icon=${fileIcon(file.mime ?? file.mimeType)}
                        mime-type=${String(file.mime ?? file.mimeType ?? '')}
                        href=${file.href ? String(file.href) : nothing}
                        image-url=${asImage && file.href ? String(file.href) : nothing}
                        kind=${asImage ? 'image' : nothing}
                        download-action=${file.href ? 'true' : 'false'}
                        remove-action="false"
                ></sf-file-preview>
            `)}
        </span>
    `;
}

const VIEW_RENDERERS = {
    string: renderTextView,
    text: renderTextView,
    integer: renderNumberView,
    number: renderNumberView,
    date: renderDateView,
    datetime: renderDateView,
    boolean: renderBooleanView,
    choice: renderChoiceView,
    choices: renderChoicesView,
    user: renderUserView,
    record: renderReferenceView,
    relation: renderReferenceView,
    file: renderFileView,
    color: renderColorView,
    include: renderIncludeView,
};

// A field shown rather than edited. `host` is optional and used for one thing
// only -- formatFieldValue, where a consumer's own formatting of a number or a
// date belongs. Null when the set has no view for that type.
export function renderViewField(field = {}, value, host, options = {}) {
    const asked = field.propertyType || field.type || field.dataType;
    const renderer = VIEW_RENDERERS[asked];
    if (!renderer) return null;

    const outer = VIEW_LINE;
    VIEW_LINE = sizeOption(options);
    try {
        return renderer(field, value, host);
    } finally {
        VIEW_LINE = outer;
    }
}


// A host has to be able to reach the set, and a module is not an element: there
// is no tag to place and no attribute to set. The Framework already has one
// place for what a page may call -- window.SF, where the base element, `html`,
// `nothing` and `render` live -- so the set publishes itself there under its own
// name. Without this the module is built, bundled and unreachable: the consumer
// could read the mapping and not call it, which was true of this set until now.
//
// This is the runtime half of the discoverability question. The other half --
// describing the module in the registry, so a host learns what it offers without
// reading our source -- is with the registry's owner.
if (typeof window !== 'undefined') {
    window.SF = window.SF || {};
    window.SF.fieldRenderers = {
        ...(window.SF.fieldRenderers || {}),
        renderCellField,
        renderEditField,
        renderFilterField,
        renderViewField,
        FILTER_RENDERERS,
    };
}
