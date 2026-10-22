import SfBaseElement, {toNumber} from '../../core/js/smart-base';
import {fieldSize} from '../../component/field-size';
import {renderDatepickerTemplate} from './js/templates/default';
import BundledPosition from '../../core/js/position.js';
import {pageLocale, pageText} from '../../core/js/page-language';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEARS_PAGE_SIZE = 18;
let datepickerSequence = 0;

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function formatIsoDate(date) {
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatDateValue(date, format = 'YYYY.MM.DD') {
    if (!date) {
        return '';
    }

    const tokens = {
        YYYY: String(date.getFullYear()),
        YY: String(date.getFullYear()).slice(-2),
        MM: padDatePart(date.getMonth() + 1),
        DD: padDatePart(date.getDate()),
    };

    return String(format || 'YYYY.MM.DD').replace(
        /YYYY|YY|MM|DD/g,
        (token) => tokens[token] || token,
    );
}

function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

function parseDate(value) {
    if (!value) {
        return null;
    }

    const match = String(value).match(ISO_DATE_RE);
    if (!match) {
        return null;
    }

    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
    ) {
        return null;
    }

    return date;
}

function parseDateValue(value, format = 'DD.MM.YYYY') {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return isValidDate(value)
            ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
            : null;
    }

    const text = String(value).trim();
    const isoDate = parseDate(text);

    if (isoDate) {
        return isoDate;
    }

    const parts = text.match(/\d+/g);
    const tokens = String(format || 'DD.MM.YYYY').match(/YYYY|YY|MM|DD/g);

    if (!parts || !tokens || parts.length < 3 || tokens.length < 3) {
        return null;
    }

    const values = {};
    tokens.slice(0, 3).forEach((token, index) => {
        values[token] = Number(parts[index]);
    });

    let year = values.YYYY;
    if (!year && values.YY) {
        year = values.YY + 2000;
    }

    const month = values.MM;
    const day = values.DD;

    if (!year || !month || !day) {
        return null;
    }

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function normalizeMonth(value, fallback = 0) {
    const month = toNumber(value, fallback);

    if (!Number.isFinite(month)) {
        return fallback;
    }

    return Math.max(0, Math.min(11, month));
}

function sameDay(first, second) {
    return (
        first &&
        second &&
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function compareDates(first, second) {
    if (!first || !second) {
        return 0;
    }

    const firstTime = new Date(
        first.getFullYear(),
        first.getMonth(),
        first.getDate(),
    ).getTime();
    const secondTime = new Date(
        second.getFullYear(),
        second.getMonth(),
        second.getDate(),
    ).getTime();

    return firstTime - secondTime;
}

function shiftDateByMonth(date, direction) {
    const targetMonth = new Date(date.getFullYear(), date.getMonth() + direction, 1);
    const lastDay = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth() + 1,
        0,
    ).getDate();

    targetMonth.setDate(Math.min(date.getDate(), lastDay));
    return targetMonth;
}

function isBetweenDates(date, startDate, endDate) {
    if (!date || !startDate || !endDate) {
        return false;
    }

    return compareDates(date, startDate) > 0 && compareDates(date, endDate) < 0;
}

function normalizeLocale(value = '', node = null) {
    const locale = String(value || '').trim();

    if (locale) {
        return locale;
    }

    // The nearest [lang] first, then the document's: the rule every component
    // follows, rather than this one's own reading of it. A date picker inside a
    // region marked `lang="en"` on a Russian page used to name its months in
    // Russian, because only the document was ever consulted.
    //
    // The region is kept -- `pageLocale`, not `pageLanguage` -- because this
    // value also goes to Intl, and `ru-RU` and `en-GB` name months and start
    // weeks differently from `ru` and `en`. Below this there used to be a fall
    // back to the browser's own language and then to `ru-RU`: unreachable
    // wherever a document exists, and a Russian default everywhere else, which
    // is the opposite of the rule (peer session, 2026-10-11).
    return pageLocale(node ?? globalThis.document?.documentElement ?? null);
}

function capitalizeFirstLetter(value = '') {
    const text = String(value || '');

    if (!text) {
        return '';
    }

    return `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`;
}

function getMonthLabel(month, locale) {
    try {
        return capitalizeFirstLetter(
            new Intl.DateTimeFormat(locale, {month: 'long'}).format(
                new Date(2026, month, 1),
            ),
        );
    } catch {
        return String(month + 1);
    }
}

function getDateLabel(date, locale) {
    try {
        return new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    } catch {
        return formatIsoDate(date);
    }
}

function getWeekdays(locale, weekStart = 1) {
    const sunday = new Date(2026, 0, 4);
    return Array.from({length: 7}, (_, index) => {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + ((weekStart + index) % 7));
        try {
            return new Intl.DateTimeFormat(locale, {weekday: 'short'}).format(day);
        } catch {
            return String((weekStart + index) % 7);
        }
    });
}

// Quick ranges (owner, 2026-10-15). A relative one is resolved against today
// in the person's own time zone, every time it is drawn, so a host that stores
// «last 7 days» gets the last seven days tomorrow too. Weeks start where the
// grid starts them.
const RELATIVE_PRESETS = ['today', 'yesterday', 'last-7-days', 'last-30-days', 'this-week', 'this-month', 'last-month'];

function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function resolveRelativePreset(id, today, weekStart = 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    switch (id) {
        case 'today': return [day, day];
        case 'yesterday': return [addDays(day, -1), addDays(day, -1)];
        case 'last-7-days': return [addDays(day, -6), day];
        case 'last-30-days': return [addDays(day, -29), day];
        case 'this-week': return [addDays(day, -((day.getDay() - weekStart + 7) % 7)), day];
        case 'this-month': return [new Date(day.getFullYear(), day.getMonth(), 1), day];
        case 'last-month': return [new Date(day.getFullYear(), day.getMonth() - 1, 1), new Date(day.getFullYear(), day.getMonth(), 0)];
        default: return null;
    }
}

function presetTextKey(id) {
    return `preset_${String(id).replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase())}`;
}

// Every word this picker says, in the languages it ships with. A product adds
// any other through SF.language.register('sf-datepicker', code, words) -- which
// an if/else on «ru» did not allow at all.
const DATEPICKER_TEXT = {
    en: {
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        previousYears: 'Previous years',
        nextYears: 'Next years',
        chooseMonth: 'Choose a month',
        chooseYear: 'Choose a year',
        presets: 'Quick ranges',
        customRange: 'Custom range',
        preset_today: 'Today',
        preset_yesterday: 'Yesterday',
        preset_last7Days: 'Last 7 days',
        preset_last30Days: 'Last 30 days',
        preset_thisWeek: 'This week',
        preset_thisMonth: 'This month',
        preset_lastMonth: 'Last month',
    },
    ru: {
        previousMonth: 'Предыдущий месяц',
        nextMonth: 'Следующий месяц',
        previousYears: 'Предыдущие годы',
        nextYears: 'Следующие годы',
        chooseMonth: 'Выберите месяц',
        chooseYear: 'Выберите год',
        presets: 'Быстрый выбор',
        customRange: 'Свой период',
        preset_today: 'Сегодня',
        preset_yesterday: 'Вчера',
        preset_last7Days: 'Последние 7 дней',
        preset_last30Days: 'Последние 30 дней',
        preset_thisWeek: 'Эта неделя',
        preset_thisMonth: 'Этот месяц',
        preset_lastMonth: 'Прошлый месяц',
    },
};

function getLabels(node) {
    const keys = ['previousMonth', 'nextMonth', 'previousYears', 'nextYears', 'chooseMonth', 'chooseYear', 'presets', 'customRange'];
    return Object.fromEntries(keys.map((key) => [key, pageText(DATEPICKER_TEXT, key, node, 'sf-datepicker')]));
}

class SfDatepicker extends SfBaseElement {
    constructor() {
        super();
        this._input = null;
        this._documentClickHandler = this.handleDocumentClick.bind(this);
        this._documentKeydownHandler = this.handleDocumentKeydown.bind(this);
        this._viewportHandler = this.positionPanel.bind(this);
        this._focusCalendarOnOpen = false;
        this._focusDateAfterRender = false;
        this._panelId = `sf-datepicker-panel-${++datepickerSequence}`;

        this.state = {
            openAbove: false,
            yearPageStart: null,
            activeDate: '',
        }
        this.refs = {
            input: this.createRef(),
            datePickerRoot: this.createRef(),
            datePickerPanel: this.createRef(),
        }
    }

    static get props() {
        return {
            templateName: {attribute: 'template', default: 'default'},
            value: {default: ''},
            date: {default: ''},
            startValue: {attribute: 'start-value', default: ''},
            endValue: {attribute: 'end-value', default: ''},
            maxDate: {default: ''},
            minDate: {default: ''},
            range: {type: Boolean, default: false},
            month: {type: Number, default: null},
            year: {type: Number, default: null},
            context: {default: ''},
            // No default: the page's language says it (see get weekStart).
            weekStart: {type: Number, default: null},
            locale: {default: ''},
            format: {default: 'DD.MM.YYYY'},
            rootClass: {default: ''},
            closeOnSelect: {type: Boolean, default: true},
            input: {type: Boolean, default: true},
            open: {type: Boolean, default: false},
            portal: {type: Boolean, default: true},
            inputType: {attribute: 'input-type', default: 'bordered'},
            size: {default: '1'},
            inputSize: {attribute: 'input-size', default: '1'},
            inputName: {attribute: 'input-name', default: ''},
            // Read by inputName after input-name; declared so the manifest names it.
            name: {attribute: 'name', default: ''},
            placeholder: {default: ''},
            label: {default: ''},
            ariaLabel: {attribute: 'aria-label', default: ''},
            // A date can be typed; a host that wants the grid alone says so.
            readonly: {type: Boolean, default: false},
            disabled: {type: Boolean, default: false},
            required: {type: Boolean, default: false},
            iconStart: {type: String, attribute: 'icon-start', default: null},
            leftIcon: {attribute: 'left-icon', default: 'calendar_today'},
            inputRootClass: {attribute: 'input-root-class', default: ''},
            mask: {type: Boolean, default: false},
            maskPattern: {attribute: 'mask-pattern', default: ''},
            maskLazy: {attribute: 'mask-lazy', default: false},
            maskPlaceholderChar: {attribute: 'mask-placeholder-char', default: '_'},
            maskOptions: {attribute: 'mask-options', default: ''},
            // Quick ranges, range mode only: built-in ids, comma separated, or
            // the property as [{id, label, relative} | {id, label, range: [from, to]}].
            presets: {default: ''},
            // The chosen quick range. Set by a host, it wins over start-value and
            // end-value: a stored «last-7-days» is resolved when drawn.
            preset: {default: ''},
        };
    }

    connectedCallback() {
        this.upgradeProperty('value');
        this.upgradeProperty('presets');
        super.connectedCallback();
    }

    upgradeProperty(name) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
            return;
        }

        const value = this[name];
        delete this[name];
        this[name] = value;
    }

    get componentName() {
        return 'datepicker';
    }

    get templateName() {
        return this.getAttribute('template') || 'default';
    }

    get selectedDate() {
        return parseDateValue(this.date, this.format);
    }

    get primaryDate() {
        const preset = this.activePreset;
        if (preset) return preset.to;
        return this.selectedDate || this.startDate;
    }

    get presets() {
        return this._presetList ?? (this.getAttribute('presets') || '');
    }

    set presets(next) {
        if (Array.isArray(next)) {
            this._presetList = next;
            this.requestComponentUpdate('presets');
            return;
        }
        this._presetList = null;
        this.setState({presets: next ? String(next) : ''});
    }

    get preset() {
        return this.getAttribute('preset') || '';
    }

    set preset(next) {
        this.setState({preset: next ? String(next) : ''});
    }

    // Each quick range resolved for today: its dates, clamped to min and max,
    // and disabled when nothing of it is left.
    get presetItems() {
        if (!this.range) return [];
        const raw = Array.isArray(this.presets)
            ? this.presets
            : String(this.presets).split(/[\s,]+/).filter(Boolean);
        const today = new Date();
        const min = this.setMinDate();
        const max = this.setMaxDate();
        return raw.map((entry) => {
            const item = typeof entry === 'string' ? {id: entry, relative: entry} : {...entry};
            if (!item?.id) return null;
            let dates = null;
            if (item.relative) dates = resolveRelativePreset(item.relative, today, this.weekStart);
            else if (Array.isArray(item.range)) {
                const from = parseDateValue(item.range[0], this.format);
                const to = parseDateValue(item.range[1], this.format);
                if (from && to) dates = compareDates(from, to) <= 0 ? [from, to] : [to, from];
            }
            if (!dates) return null;
            let [from, to] = dates;
            if (min && compareDates(from, min) < 0) from = min;
            if (max && compareDates(to, max) > 0) to = max;
            const disabled = compareDates(from, to) > 0;
            const label = item.label
                || (RELATIVE_PRESETS.includes(item.id) ? pageText(DATEPICKER_TEXT, presetTextKey(item.id), this, 'sf-datepicker') : item.id);
            return {id: String(item.id), label, relative: item.relative || null, from, to, disabled,
                pressed: this.preset === String(item.id)};
        }).filter(Boolean);
    }

    get activePreset() {
        const id = this.preset;
        if (!id || !this.range) return null;
        const item = this.presetItems.find((one) => one.id === id);
        return item && !item.disabled ? item : null;
    }

    get startDate() {
        return parseDateValue(this.startValue, this.format);
    }

    get endDate() {
        return parseDateValue(this.endValue, this.format);
    }

    get date() {
        return this.getAttribute('date') || this.getAttribute('value') || '';
    }

    get value() {
        return this.range ? [this.startValue, this.endValue] : this.date;
    }

    set value(nextValue) {
        if (Array.isArray(nextValue)) {
            const [startValue = '', endValue = ''] = nextValue;
            this.setState({
                date: startValue || '',
                startValue: startValue || '',
                endValue: endValue || '',
            });
            return;
        }

        if (nextValue && typeof nextValue === 'object') {
            const startValue =
                nextValue.start || nextValue.startValue || nextValue.date || '';
            const endValue = nextValue.end || nextValue.endValue || '';
            this.setState({
                date: nextValue.date || startValue || '',
                startValue,
                endValue,
            });
            return;
        }

        this.setState({
            date: nextValue ? String(nextValue) : '',
            startValue: '',
            endValue: '',
        });
    }

    setMaxDate() {
        return parseDateValue(this.maxDate, this.format);
    }

    setMinDate() {
        return parseDateValue(this.minDate, this.format);
    }

    get maxDate() {
        return this.getAttribute('max-date') || '';
    }

    get minDate() {
        return this.getAttribute('min-date') || '';
    }

    set date(nextValue) {
        this.setState({
            date: nextValue ? String(nextValue) : '',
        })
    }

    get startValue() {
        const preset = this.activePreset;
        if (preset) return formatIsoDate(preset.from);
        return this.getAttribute('start-value') || '';
    }

    set startValue(nextValue) {
        this.setState({
            startValue: nextValue ? String(nextValue) : '',
        })
    }

    get endValue() {
        const preset = this.activePreset;
        if (preset) return formatIsoDate(preset.to);
        return this.getAttribute('end-value') || '';
    }

    set endValue(nextValue) {
        this.setState({
            endValue: nextValue ? String(nextValue) : '',
        })
    }

    get range() {
        return this.getBooleanAttr('range', false);
    }

    get input() {
        return this.getBooleanAttr('input', true);
    }

    get open() {
        return this.getBooleanAttr('open', false);
    }

    get portal() {
        return this.getBooleanAttr('portal', true);
    }

    get inputType() {
        return this.getAttribute('input-type') || 'bordered';
    }

    // `size` is the canonical name, as on every field; `input-size` is its
    // legacy name and still honoured. The canonical name wins when both are set.
    get size() {
        return fieldSize(this.getAttribute('size') || this.getAttribute('input-size') || '1', 'sf-datepicker');
    }

    get inputSize() {
        return this.size;
    }

    get inputName() {
        return this.getAttribute('input-name') || this.getAttribute('name') || '';
    }

    get placeholder() {
        return this.getAttribute('placeholder') || '';
    }

    get label() {
        return this.getAttribute('label') || '';
    }

    get disabled() {
        return this.getBooleanAttr('disabled', false);
    }

    get required() {
        return this.getBooleanAttr('required', false);
    }

    get closeOnSelect() {
        return this.getBooleanAttr('close-on-select', true);
    }

    get leftIcon() {
        if (this.hasAttribute('icon-start')) return this.getAttribute('icon-start');
        return this.getAttribute('left-icon') || 'calendar_today';
    }

    get iconStart() {
        return this.leftIcon;
    }

    get inputRootClass() {
        return this.getAttribute('input-root-class') || '';
    }

    get mask() {
        return this.getBooleanAttr('mask', false);
    }

    get maskPattern() {
        return this.getAttribute('mask-pattern') || this.formatToMask(this.format);
    }

    get maskLazy() {
        return this.hasAttribute('mask-lazy')
            ? this.getBooleanAttr('mask-lazy', false)
            : false;
    }

    get maskPlaceholderChar() {
        return this.getAttribute('mask-placeholder-char') || '_';
    }

    get maskOptions() {
        return this.getAttribute('mask-options') || '';
    }

    get year() {
        const primaryDate = this.primaryDate;
        const fallback = primaryDate ? primaryDate.getFullYear() : new Date().getFullYear();

        return this.hasAttribute('year') ? this.getNumberAttr('year', fallback) : fallback;
    }

    set year(nextValue) {
        this.setState({
            year:
                nextValue === null || typeof nextValue === 'undefined' || nextValue === ''
                    ? ''
                    : String(toNumber(nextValue, new Date().getFullYear())),
        })
    }

    get month() {
        const primaryDate = this.primaryDate;
        const fallback = primaryDate ? primaryDate.getMonth() : new Date().getMonth();

        return this.hasAttribute('month')
            ? normalizeMonth(this.getAttribute('month'), fallback)
            : fallback;
    }

    set month(nextValue) {
        this.setState({
            month:
                nextValue === null || typeof nextValue === 'undefined' || nextValue === ''
                    ? ''
                    : String(normalizeMonth(nextValue, new Date().getMonth())),
        })
    }

    get contextMode() {
        return this.getEnumAttr('context', ['month', 'year', ''], '');
    }

    // The week starts where the page's language starts it when the attribute
    // does not say: Monday for ru, Sunday for en-US (docs trial 4: a
    // Sunday-first locale needed a manual attribute).
    // Any day may open the week, 0 Sunday to 6 Saturday: the grid counts from
    // it modulo seven. Only Sunday and Monday were kept, so a Saturday-first
    // locale (ar-EG, fa-IR) got Monday (documentation trial 6, 2026-10-18).
    get weekStart() {
        if (this.hasAttribute('week-start')) {
            const day = this.getNumberAttr('week-start', 1);
            return Number.isInteger(day) && day >= 0 && day <= 7 ? day % 7 : 1;
        }
        try {
            const locale = new Intl.Locale(this.locale);
            const info = typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo;
            if (info?.firstDay) return info.firstDay % 7;
        } catch {
            // An unknown locale keeps the Monday the grid always had.
        }
        return 1;
    }

    get locale() {
        return normalizeLocale(this.getAttribute('locale'), this);
    }

    get format() {
        return this.getAttribute('format') || 'DD.MM.YYYY';
    }

    // The name for a field whose label is drawn outside it -- a record panel
    // prints the label itself, and passing it to the control printed it twice.
    get ariaLabel() {
        return this.getProp('ariaLabel') || '';
    }

    get readonly() {
        return this.getBooleanAttr('readonly', false);
    }

    // A date can be typed. The field was hard-readonly, so a host that edits a
    // date could only pick one on the grid -- and the mask properties beside it
    // reached a field nobody could type in (Larena storage QA, 2026-10-22).
    // A range is still chosen on the grid: one field holding two dates has no
    // single format to read back.
    get typed() {
        return !this.range && !this.readonly && !this.disabled;
    }

    get formattedValue() {
        return formatDateValue(this.selectedDate, this.format);
    }

    get formattedStartValue() {
        return formatDateValue(this.startDate, this.format);
    }

    get formattedEndValue() {
        return formatDateValue(this.endDate, this.format);
    }

    get displayValue() {
        if (!this.range) {
            return this.formattedValue;
        }

        if (this.formattedStartValue && this.formattedEndValue) {
            return `${this.formattedStartValue} - ${this.formattedEndValue}`;
        }

        return this.formattedStartValue || this.formattedEndValue || '';
    }

    get displayDate() {
        return new Date(this.year, this.month, 1);
    }

    get isRtl() {
        return (this.closest('[dir]')?.getAttribute('dir') || document.documentElement?.dir) === 'rtl';
    }

    get labels() {
        return getLabels(this);
    }

    get weekdays() {
        return getWeekdays(this.locale, this.weekStart);
    }

    get calendarLabel() {
        try {
            return new Intl.DateTimeFormat(this.locale, {
                month: 'long',
                year: 'numeric',
            }).format(this.displayDate);
        } catch {
            return `${this.month + 1}.${this.year}`;
        }
    }

    get activeDate() {
        const candidate = parseDate(this.state.activeDate) || this.primaryDate || this.displayDate;
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        if (minDate && compareDates(candidate, minDate) < 0) return minDate;
        if (maxDate && compareDates(candidate, maxDate) > 0) return maxDate;
        return candidate;
    }

    get normalizedRange() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        if (!startDate || !endDate) {
            return {startDate, endDate};
        }

        if (compareDates(startDate, endDate) <= 0) {
            return {startDate, endDate};
        }

        return {
            startDate: endDate,
            endDate: startDate,
        };
    }

    get days() {
        const firstDay = new Date(this.year, this.month, 1);
        const firstWeekDay = firstDay.getDay();
        const offset = (firstWeekDay - this.weekStart + 7) % 7;
        const gridStartDate = new Date(this.year, this.month, 1 - offset);
        const {startDate, endDate} = this.normalizedRange;
        const hasRangeEnd = Boolean(this.startValue && this.endValue);
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        const activeDate = this.activeDate;
        const today = new Date();
        return Array.from({length: 42}).map((_, index) => {
            const date = new Date(
                gridStartDate.getFullYear(),
                gridStartDate.getMonth(),
                gridStartDate.getDate() + index,
            );
            const time = date.getTime();

            const disabled = Boolean(
                (minDate && time < minDate.getTime()) ||
                (maxDate && time > maxDate.getTime()),
            );
            return {
                date,
                value: formatIsoDate(date),
                formattedValue: formatDateValue(date, this.format),
                label: getDateLabel(date, this.locale),
                day: date.getDate(),
                today: sameDay(date, today),
                currentMonth: date.getMonth() === this.month,
                weekend: [0, 6].includes(date.getDay()),
                disabled: disabled,
                selected: this.range
                    ? sameDay(date, startDate) || sameDay(date, endDate)
                    : sameDay(date, this.selectedDate),
                rangeStart: this.range && hasRangeEnd && sameDay(date, startDate),
                rangeEnd: this.range && hasRangeEnd && sameDay(date, endDate),
                rangeSelected: this.range && hasRangeEnd && isBetweenDates(date, startDate, endDate),
                tabIndex: !disabled && sameDay(date, activeDate) ? 0 : -1,
            };
        });
    }

    get months() {
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        const minMonth = minDate
            ? new Date(minDate.getFullYear(), minDate.getMonth(), 1)
            : null;
        const maxMonth = maxDate
            ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
            : null;

        return Array.from({length: 12}).map((_, index) => {
            const date = new Date(this.year, index, 1);
            const time = date.getTime();

            const disabled = Boolean(
                (minMonth && time < minMonth.getTime()) ||
                (maxMonth && time > maxMonth.getTime()),
            );
            return {
                index,
                label: getMonthLabel(index, this.locale),
                selected: index === this.month,
                disabled
            }
        });
    }

    get years() {
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        const start = this.yearPageStart;

        return Array.from({length: YEARS_PAGE_SIZE}).map((_, index) => {

            const year = start + index;

            const disabled = Boolean(
                (minDate && year < minDate.getFullYear()) ||
                (maxDate && year > maxDate.getFullYear()),
            );
            return {
                year,
                disabled: disabled,
                selected: year === this.year,
            };
        });
    }

    get yearPageStart() {
        return this.state.yearPageStart ?? this.getYearPageStart(this.year);
    }

    get yearPageEnd() {
        return this.yearPageStart + YEARS_PAGE_SIZE - 1;
    }

    getYearPageStart(year = this.year) {
        const normalizedYear = toNumber(year, new Date().getFullYear());
        return normalizedYear - (normalizedYear % YEARS_PAGE_SIZE);
    }

    formatToMask = (format) => {
        let mask = String(format).replace(/[A-Za-z]/g, '0');
        if (this.range) {
            mask += ` - ${mask}`;
        }
        return mask;
    };

    setContext(nextContext = '') {
        this.setState({
            context: nextContext || '',
        })
        return this;
    }

    toggleContext(nextContext) {
        const nextMode = this.contextMode === nextContext ? '' : nextContext;
        const nextState = {
            context: nextMode,
        };

        if (nextMode === 'year') {
            nextState.yearPageStart = this.getYearPageStart(this.year);
        }

        this.setState(nextState);
        return this;
    }

    shiftYearPage(direction = 1) {
        this.set({
            yearPageStart: this.yearPageStart + YEARS_PAGE_SIZE * direction,
        });

        return this;
    }

    shiftMonth(direction = 1) {
        const next = new Date(this.year, this.month + direction, 1);
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        if (minDate && next < new Date(minDate.getFullYear(), minDate.getMonth(), 1)) return this;
        if (maxDate && next > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)) return this;
        this.setState({
            year: next.getFullYear(),
            month: next.getMonth(),
            context: '',
        });
        this.set({activeDate: formatIsoDate(next)});
        return this;
    }

    setActiveDate(value) {
        const date = parseDate(value);
        if (!date || this.state.activeDate === value) return this;
        this.set({activeDate: formatIsoDate(date)});
        return this;
    }

    moveActiveDate(days) {
        const next = new Date(this.activeDate);
        next.setDate(next.getDate() + days);
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        if (minDate && compareDates(next, minDate) < 0) return this;
        if (maxDate && compareDates(next, maxDate) > 0) return this;
        this._focusDateAfterRender = true;
        this.setState({
            year: next.getFullYear(),
            month: next.getMonth(),
            context: '',
        });
        this.set({activeDate: formatIsoDate(next)});
        return this;
    }

    openPanel({focusCalendar = false} = {}) {
        if (this.disabled) return this;
        this._focusCalendarOnOpen = focusCalendar;
        if (!this.state.activeDate) {
            this.set({activeDate: formatIsoDate(this.activeDate)});
        }
        if (this.open) {
            this.positionPanel();
            return this;
        }
        this.setState({
            open: true
        })
        return this;
    }

    closePanel({restoreFocus = false} = {}) {
        if (!this.open) {
            return this;
        }

        this.setState({
            open: false,
            context: '',
        });
        if (restoreFocus) requestAnimationFrame(() => this._input?.focus?.());
        return this;
    }

    togglePanel() {
        return this.open ? this.closePanel() : this.openPanel();
    }

    // What is typed is read through the declared format, so «14.10.2026» and
    // «2026-10-14» both land. Text that is not a date, or a date outside the
    // allowed range, puts the field back to the value it held: a half-typed date
    // must not clear a stored one. An emptied field clears the value, because
    // deleting the text is how a person says there is no date.
    handleInputChange(event) {
        if (!this.typed) return;
        const field = event?.target;
        const text = String(field?.value ?? '').trim();
        const restore = () => {
            const input = field?.querySelector?.('input') || field;
            if (input && 'value' in input) input.value = this.displayValue;
        };

        if (!text) {
            if (!this.date) return;
            this.setState({date: '', context: ''});
            this.emitChange();
            return;
        }

        const date = parseDateValue(text, this.format);
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();
        const outOfRange = Boolean(date)
            && ((minDate && compareDates(date, minDate) < 0)
                || (maxDate && compareDates(date, maxDate) > 0));

        if (!date || outOfRange) {
            restore();
            return;
        }

        const value = formatIsoDate(date);
        if (value === this.date) {
            restore();
            return;
        }

        this.setState({
            year: date.getFullYear(),
            month: date.getMonth(),
            date: value,
            context: '',
        });
        this.set({activeDate: value});
        this.emitChange();
    }

    handleInputClick(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        this.openPanel();
    }

    handleInputKeydown(event) {
        // In a field that can be typed in, Enter commits the text and the space
        // bar belongs to the text; ArrowDown still opens the grid.
        if (this.typed) {
            if (event.key !== 'ArrowDown' && event.key !== 'Enter') return;
            event.preventDefault();
            if (event.key === 'Enter') {
                this.handleInputChange(event);
                return;
            }
            this.openPanel({focusCalendar: true});
            return;
        }
        if (!['ArrowDown', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        this.openPanel({focusCalendar: true});
    }

    handleDayKeydown(event, day) {
        const horizontal = this.isRtl ? -1 : 1;
        const keySteps = {
            ArrowLeft: -horizontal,
            ArrowRight: horizontal,
            ArrowUp: -7,
            ArrowDown: 7,
        };
        if (Object.prototype.hasOwnProperty.call(keySteps, event.key)) {
            event.preventDefault();
            this.moveActiveDate(keySteps[event.key]);
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const date = day?.date || this.activeDate;
            const offset = (date.getDay() - this.weekStart + 7) % 7;
            this.moveActiveDate(event.key === 'Home' ? -offset : 6 - offset);
            return;
        }
        if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault();
            const direction = event.key === 'PageUp' ? -1 : 1;
            let next = shiftDateByMonth(this.activeDate, direction);
            const minDate = this.setMinDate();
            const maxDate = this.setMaxDate();
            if (minDate && compareDates(next, minDate) < 0) next = minDate;
            if (maxDate && compareDates(next, maxDate) > 0) next = maxDate;
            this._focusDateAfterRender = true;
            this.setState({
                year: next.getFullYear(),
                month: next.getMonth(),
            });
            this.set({activeDate: formatIsoDate(next)});
        }
    }

    handlePanelClick(event) {
        event?.stopPropagation?.();
    }

    handleDocumentClick(event) {
        if (!this.open) {
            return;
        }

        const target = event.target;
        if (this.contains(target) || this.refs.datePickerPanel.value?.contains?.(target)) {
            return;
        }
        this.closePanel();
    }

    handleDocumentKeydown(event) {
        if (!this.open || event.key !== 'Escape') {
            return;
        }

        event.preventDefault();

        if (this.contextMode) {
            this.setContext('');
            return;
        }

        this.closePanel();
        requestAnimationFrame(() => this._input?.focus?.());
    }

    syncOverlayListeners() {
        if (this.input && this.open) {
            document.addEventListener('click', this._documentClickHandler);
            document.addEventListener('keydown', this._documentKeydownHandler);
            return;
        }

        this.removeOverlayListeners();
    }

    removeOverlayListeners() {
        document.removeEventListener('click', this._documentClickHandler);
        document.removeEventListener('keydown', this._documentKeydownHandler);
        this.stopPanelPosition();
        window.removeEventListener('resize', this._viewportHandler);
        document.removeEventListener('scroll', this._viewportHandler, true);
        window.visualViewport?.removeEventListener('resize', this._viewportHandler);
        window.visualViewport?.removeEventListener('scroll', this._viewportHandler);
    }

    positionPanel() {
        const panel = this.refs.datePickerPanel.value;
        // Anchor to the visible field frame, not the bare text input inside it.
        const trigger = this._input?.closest('.sf-input-field') || this._input || this.querySelector('sf-input');
        // A deferred call after disconnect must not start tracking detached nodes.
        if (!this.isConnected || !this.input || !this.portal || !this.open || !panel?.isConnected || !trigger) {
            this.stopPanelPosition();
            return;
        }
        // Shared Framework geometry (SF.Position on Floating UI): below the
        // field, flipped above when it does not fit, shifted and height-limited
        // inside the viewport, following scroll and resize on its own.
        if (!this._panelAnchor || this._panelAnchorPanel !== panel || this._panelAnchorTrigger !== trigger) {
            this.stopPanelPosition();
            Object.assign(panel.style, {overflowY: 'auto', zIndex: 'var(--sf-z-index-9)'});
            this._panelAnchorPanel = panel;
            this._panelAnchorTrigger = trigger;
            this._panelAnchor = (globalThis.SF?.Position || BundledPosition).anchor(trigger, panel, {
                side: 'block-end',
                align: 'start',
                onPosition: ({side}) => {
                    const openAbove = side === 'block-start';
                    if (Boolean(this.state.openAbove) !== openAbove) this.set({openAbove});
                },
            });
            return;
        }
        this._panelAnchor.update();
    }

    stopPanelPosition() {
        this._panelAnchor?.stop();
        this._panelAnchor = null;
        this._panelAnchorPanel = null;
        this._panelAnchorTrigger = null;
    }

    selectDate(day) {
        if (!day?.date || day.disabled) {
            return this;
        }

        if (this.range) {
            this.selectRangeDate(day);
            return this;
        }

        this.setState({
            year: day.date.getFullYear(),
            month: day.date.getMonth(),
            date: day.value,
            context: '',
        });
        this.set({activeDate: day.value});
        this.emitChange();
        if (this.closeOnSelect) this.closePanel({restoreFocus: true});
        return this;
    }

    selectRangeDate(day) {
        if (!this.startValue || (this.startValue && this.endValue)) {
            this.setState({
                year: day.date.getFullYear(),
                month: day.date.getMonth(),
                startValue: day.value,
                endValue: '',
                date: day.value,
                context: '',
                preset: '',
            });
            this.set({activeDate: day.value});
            this.emitChange();
            return this;
        }

        const startDate = this.startDate;
        const nextState = {
            year: day.date.getFullYear(),
            month: day.date.getMonth(),
            context: '',
            preset: '',
        };

        if (startDate && compareDates(day.date, startDate) < 0) {
            nextState.startValue = day.value;
            nextState.endValue = this.startValue;
            nextState.date = day.value;
        } else {
            nextState.endValue = day.value;
            nextState.date = this.startValue;
        }

        this.setState(nextState);
        this.set({activeDate: day.value});
        this.emitChange();
        if (this.closeOnSelect) this.closePanel({restoreFocus: true});
        return this;
    }

    // A quick range: its dates, the grid on the month it ends in, and the change
    // said once, by the person's choice -- never by a render.
    choosePreset(item) {
        if (!item || item.disabled) return this;
        const from = formatIsoDate(item.from);
        const to = formatIsoDate(item.to);
        this.setState({
            preset: item.id,
            startValue: from,
            endValue: to,
            date: from,
            year: item.to.getFullYear(),
            month: item.to.getMonth(),
            context: '',
        });
        this.set({activeDate: to});
        this.emitChange();
        if (this.closeOnSelect) this.closePanel({restoreFocus: true});
        return this;
    }

    // «Свой период»: the quick range lets go and the person picks on the grid.
    chooseCustomRange() {
        if (this.preset) this.setState({preset: '', startValue: '', endValue: '', date: ''});
        this._focusDateAfterRender = true;
        this.requestComponentUpdate('custom-range');
        return this;
    }

    // The list is one tab stop: arrows move along it, Tab goes on to the grid.
    handlePresetKeydown(event) {
        const keys = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1};
        if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
        const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        if (!buttons.length) return;
        event.preventDefault();
        const index = buttons.indexOf(event.target);
        let next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + keys[event.key];
        if (this.isRtl && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) next = index - keys[event.key];
        next = (next + buttons.length) % buttons.length;
        buttons.forEach((button, at) => button.setAttribute('tabindex', at === next ? '0' : '-1'));
        buttons[next].focus();
    }

    selectMonth(month) {
        if (!month || month.disabled) {
            return this;
        }

        this.setState({
            month: month.index,
            context: '',
        });
        this.set({activeDate: formatIsoDate(new Date(this.year, month.index, 1))});

        return this;
    }

    selectYear(year) {
        if (!year || year.disabled) {
            return this;
        }

        const nextState = {
            year: year.year,
            context: '',
        };

        const nextMonth = this.getClosestEnabledMonth(year.year, this.month);
        if (nextMonth !== this.month) {
            nextState.month = nextMonth;
        }

        this.setState(nextState);
        this.set({activeDate: formatIsoDate(new Date(year.year, nextMonth, 1))});
        return this;
    }

    getClosestEnabledMonth(year, month) {
        const minDate = this.setMinDate();
        const maxDate = this.setMaxDate();

        if (minDate && year === minDate.getFullYear() && month < minDate.getMonth()) {
            return minDate.getMonth();
        }

        if (maxDate && year === maxDate.getFullYear() && month > maxDate.getMonth()) {
            return maxDate.getMonth();
        }

        return month;
    }

    emitChange() {
        // date and isoValue mean one thing in both modes: the ISO value. For a
        // range that is the ISO 8601 interval start/end (the start alone while
        // the end is not chosen); they were the formatted range and the start
        // (docs trial 4).
        const interval = this.startValue && this.endValue ? `${this.startValue}/${this.endValue}` : (this.startValue || '');
        const detail = this.range
            ? {
                value: [this.startValue, this.endValue],
                date: interval,
                startValue: this.startValue,
                endValue: this.endValue,
                formattedValue: this.displayValue,
                formattedStartValue: this.formattedStartValue,
                formattedEndValue: this.formattedEndValue,
                isoValue: interval,
                startIsoValue: this.startValue,
                endIsoValue: this.endValue,
                range: true,
                format: this.format,
                // The quick range chosen, so a host can store «last 7 days»
                // rather than the dates it meant today.
                preset: this.activePreset
                    ? (this.activePreset.relative ? {id: this.activePreset.id, relative: this.activePreset.relative} : {id: this.activePreset.id})
                    : null,
            }
            : {
                value: this.date,
                date: this.date,
                formattedValue: this.formattedValue,
                isoValue: this.date,
                range: false,
                format: this.format,
            };

        this.dispatchEvent(
            new CustomEvent('change', {
                bubbles: true,
                composed: true,
                detail,
            }),
        );

        this.dispatchEvent(
            new CustomEvent('sf-datepicker-change', {
                bubbles: true,
                composed: true,
                detail,
            }),
        );

        // The legacy sf-change carries the change detail, as its manifest says; it
        // carried the whole state (open, portal, locale, month...), which no
        // handler of a change wants and which changed with every refactor.
        this.emitComponentEvent('change', detail);
    }

    templateContext() {
        const props = this.getPropsContext();

        return this.createTemplateContext({
            ...props,
            component: this,
            date: this.date,
            formattedValue: this.formattedValue,
            displayValue: this.displayValue,
            startValue: this.startValue,
            formattedStartValue: this.formattedStartValue,
            endValue: this.endValue,
            formattedEndValue: this.formattedEndValue,
            range: this.range,
            format: this.format,
            selectedDate: this.selectedDate,
            startDate: this.startDate,
            endDate: this.endDate,
            year: this.year,
            month: this.month,
            monthLabel: getMonthLabel(this.month, this.locale),
            calendarLabel: this.calendarLabel,
            labels: this.labels,
            weekdays: this.weekdays,
            panelId: this._panelId,
            previousIcon: this.isRtl ? 'chevron_right' : 'chevron_left',
            nextIcon: this.isRtl ? 'chevron_left' : 'chevron_right',
            context: this.contextMode,
            locale: this.locale,
            days: this.days,
            presetItems: this.presetItems,
            months: this.months,
            years: this.years,
            yearPageStart: this.yearPageStart,
            yearPageEnd: this.yearPageEnd,
            rootClass: this.getRootClass(),
            rootStyle: this.getRootStyle(),
            openAbove: Boolean(this.state.openAbove),
            input: this.input,
            open: this.open,
            portal: this.portal,
            inputType: this.inputType,
            inputSize: this.inputSize,
            inputName: this.inputName,
            placeholder: this.placeholder,
            label: this.label,
            ariaLabel: this.ariaLabel,
            readonly: !this.typed,
            disabled: this.disabled,
            required: this.required,
            leftIcon: this.leftIcon,
            iconStart: this.leftIcon,
            inputRootClass: this.inputRootClass,
            mask: this.mask,
            maskPattern: this.maskPattern,
            maskLazy: this.maskLazy,
            maskPlaceholderChar: this.maskPlaceholderChar,
            maskOptions: this.maskOptions,
        });
    }

    template() {
        return renderDatepickerTemplate(this.templateContext());
    }


    afterRender() {
        this._input = this.refs.input?.value?.querySelector('input') || null;
        if (this._input) {
            this._input.setAttribute('aria-haspopup', 'dialog');
            this._input.setAttribute('aria-expanded', this.open ? 'true' : 'false');
            this._input.setAttribute('aria-controls', this._panelId);
        }
        const monthToggle = this.querySelector('.sf-datepicker-month-toggle button');
        const yearToggle = this.querySelector('.sf-datepicker-year-toggle button');
        monthToggle?.setAttribute('aria-expanded', this.contextMode === 'month' ? 'true' : 'false');
        yearToggle?.setAttribute('aria-expanded', this.contextMode === 'year' ? 'true' : 'false');
        this.syncOverlayListeners();
        requestAnimationFrame(() => {
            this.positionPanel();
            if (this._focusCalendarOnOpen || this._focusDateAfterRender) {
                const active = this.querySelector(`.sf-datepicker-day[data-date="${formatIsoDate(this.activeDate)}"]`);
                active?.focus?.();
                this._focusCalendarOnOpen = false;
                this._focusDateAfterRender = false;
            }
        });
    }


    onDisconnected() {
        this.removeOverlayListeners();
        super.onDisconnected();
    }

    get data() {
        return {
            value: this.value,
            date: this.date,
            formattedValue: this.formattedValue,
            displayValue: this.displayValue,
            startValue: this.startValue,
            formattedStartValue: this.formattedStartValue,
            endValue: this.endValue,
            formattedEndValue: this.formattedEndValue,
            range: this.range,
            format: this.format,
            year: this.year,
            month: this.month,
            context: this.contextMode,
            maxDate: this.maxDate,
            minDate: this.minDate,
            locale: this.locale,
            input: this.input,
            open: this.open,
            portal: this.portal,
            mask: this.mask,
            maskPattern: this.maskPattern,
            maskOptions: this.maskOptions,
            presets: this.presetItems.map(({id, label, relative, disabled}) => ({id, label, relative, disabled})),
            preset: this.preset,
        };
    }
}

SfDatepicker.define('sf-datepicker');
