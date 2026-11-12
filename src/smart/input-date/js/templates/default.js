import {html, nothing} from 'lit';
import {ref} from 'lit/directives/ref.js';

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(' ');
}

function renderYearTop(context) {
    return html`
        <div class="sf-datepicker-top flex content-main-between items-cross-center">
            <sf-button-icon appearance="ghost" scheme="on-surface" size="1/2" ?disabled=${context.disabled}
                icon=${context.previousIcon} aria-label=${context.labels.previousYears}
                @click=${() => context.component.shiftYearPage(-1)}></sf-button-icon>
            <div class="sf-datepicker-range-title" aria-live="polite">
                ${context.yearPageStart}–${context.yearPageEnd}
            </div>
            <sf-button-icon appearance="ghost" scheme="on-surface" size="1/2" ?disabled=${context.disabled}
                icon=${context.nextIcon} aria-label=${context.labels.nextYears}
                @click=${() => context.component.shiftYearPage(1)}></sf-button-icon>
        </div>`;
}

function renderTop(context) {
    if (context.context === 'year') return renderYearTop(context);

    return html`
        <div class="sf-datepicker-top grid items-cross-center">
            <sf-button-icon appearance="ghost" scheme="on-surface" size="1/2" ?disabled=${context.disabled}
                icon=${context.previousIcon} aria-label=${context.labels.previousMonth}
                @click=${() => context.component.shiftMonth(-1)}></sf-button-icon>
            <div class="sf-datepicker-period flex content-main-center items-cross-center gap-1/4">
                <!-- The toggles are size 1/2, as tall as the compact size 1 they were:
                     density no longer changes a button's height (C01). The arrows
                     beside them are the same size: one band of buttons, one height
                     (audit G4: 40 and 32 in one row). -->
                <sf-button class="sf-datepicker-month-toggle" size="1/2" appearance="ghost" scheme="on-surface"
                    ?disabled=${context.disabled}
                    text=${context.monthLabel}
                    aria-expanded=${context.context === 'month' ? 'true' : 'false'}
                    @click=${() => context.component.toggleContext('month')}></sf-button>
                <sf-button class="sf-datepicker-year-toggle" size="1/2" appearance="ghost" scheme="on-surface"
                    ?disabled=${context.disabled}
                    text=${String(context.year)}
                    aria-expanded="false"
                    @click=${() => context.component.toggleContext('year')}></sf-button>
            </div>
            <sf-button-icon appearance="ghost" scheme="on-surface" size="1/2" ?disabled=${context.disabled}
                icon=${context.nextIcon} aria-label=${context.labels.nextMonth}
                @click=${() => context.component.shiftMonth(1)}></sf-button-icon>
        </div>`;
}

// The month or year list is one tab stop: the chosen item, or the first one
// that can be chosen; the arrows move in it (handleContextKeydown).
function focusItem(items) {
    return items.find((item) => item.selected && !item.disabled) ?? items.find((item) => !item.disabled);
}

function renderMonthContext(context) {
    const focusable = focusItem(context.months);
    return html`
        <div class="sf-datepicker-context absolute top-0 bottom-0 inline-start-0 inline-end-0 grid grid-col-3 overflow-auto gap-1/4"
             role="group" aria-label=${context.labels.chooseMonth}
             @keydown=${(event) => context.component.handleContextKeydown(event)}>
            ${context.months.map((month) => html`
                <button class=${joinClasses('sf-datepicker-text flex content-main-center items-cross-center', month.selected ? 'active' : '', month.disabled ? 'disabled' : '')}
                    ?disabled=${month.disabled} aria-pressed=${month.selected ? 'true' : 'false'}
                    tabindex=${month === focusable ? '0' : '-1'}
                    type="button" @click=${() => context.component.selectMonth(month)}>
                    <span class="sf-datepicker-text-date">${month.label}</span>
                </button>`)}
        </div>`;
}

function renderYearContext(context) {
    const focusable = focusItem(context.years);
    return html`
        <div class="sf-datepicker-context absolute top-0 bottom-0 inline-start-0 inline-end-0 grid grid-col-3 overflow-auto gap-1/4"
             role="group" aria-label=${context.labels.chooseYear}
             @keydown=${(event) => context.component.handleContextKeydown(event)}>
            ${context.years.map((year) => html`
                <button class=${joinClasses('sf-datepicker-text flex content-main-center items-cross-center', year.selected ? 'active' : '', year.disabled ? 'disabled' : '')}
                    type="button" ?disabled=${year.disabled} aria-pressed=${year.selected ? 'true' : 'false'}
                    tabindex=${year === focusable ? '0' : '-1'}
                    @click=${() => context.component.selectYear(year)}>
                    <span class="sf-datepicker-text-date">${year.year}</span>
                </button>`)}
        </div>`;
}

function renderContext(context) {
    if (context.context === 'month') return renderMonthContext(context);
    if (context.context === 'year') return renderYearContext(context);
    return nothing;
}

function renderDatepickerInput(context) {
    return html`
        <sf-input class="sf-datepicker-input" ${ref(context.component.refs.input)}
            appearance=${context.inputType} size=${context.inputSize}
            label=${context.label || nothing} name=${context.boxName || nothing}
            aria-label=${context.label ? nothing : (context.ariaLabel || nothing)}
            placeholder=${context.placeholder || nothing} icon-start=${context.iconStart || nothing}
            root-class=${context.inputRootClass || nothing} value=${context.displayValue || ''}
            ?disabled=${context.disabled} ?required=${context.required} ?invalid=${context.invalid}
            error-message=${context.errorMessage || nothing}
            hint=${context.hint || nothing} hint-icon=${context.hintIcon || nothing}
            ?mask=${context.mask}
            mask-pattern=${context.maskPattern || nothing} mask-lazy=${String(context.maskLazy)}
            mask-placeholder-char=${context.maskPlaceholderChar || nothing}
            mask-options=${context.maskOptions || nothing} ?readonly=${context.readonly}
            @click=${(event) => context.component.handleInputClick(event)}
            @change=${(event) => context.component.handleInputChange(event)}
            @input=${(event) => context.component.handleInputInput(event)}
            @keydown=${(event) => context.component.handleInputKeydown(event)}></sf-input>`;
}

function renderDay(day, context) {
    const classes = joinClasses('sf-datepicker-day', day.weekend ? 'sf-datepicker-day-off' : '',
        day.selected ? 'active' : '', day.rangeStart ? 'sf-datepicker-day-start' : '',
        day.rangeSelected ? 'sf-datepicker-day-selected' : '', day.rangeEnd ? 'sf-datepicker-day-end' : '',
        day.currentMonth ? '' : 'sf-datepicker-another-month', day.disabled ? 'disabled' : '');

    return html`
        <button class=${classes} type="button" role="gridcell" ?disabled=${day.disabled}
            data-date=${day.value} aria-label=${day.label}
            aria-current=${day.today ? 'date' : nothing}
            aria-selected=${day.selected || day.rangeSelected ? 'true' : 'false'} tabindex=${day.tabIndex}
            @click=${() => context.component.selectDate(day)}
            @focus=${() => context.component.setActiveDate(day.value)}
            @keydown=${(event) => context.component.handleDayKeydown(event, day)}>
            <span class="sf-datepicker-day-date">${day.day}</span>
        </button>`;
}

// The days are an ARIA grid (APG date picker dialog; audit S18a): a row of
// column headers with the weekdays' full names for a screen reader (the
// drawn short names above stay out of the accessibility tree), then a row per
// week. The rows are display: contents, so the days stay the CSS grid's own
// cells; the headers are visually hidden, out of the flow.
function renderGrid(context) {
    const weeks = [];
    for (let at = 0; at < context.days.length; at += 7) weeks.push(context.days.slice(at, at + 7));
    return html`
        <div class="sf-datepicker-grid grid grid-col-7" role="grid" aria-label=${context.calendarLabel}>
            <div class="sf-datepicker-week" role="row">
                ${context.weekdayNames.map((name) => html`<span class="sr-only" role="columnheader">${name}</span>`)}
            </div>
            ${weeks.map((week) => html`<div class="sf-datepicker-week" role="row">${week.map((day) => renderDay(day, context))}</div>`)}
        </div>`;
}

function renderPresets(context) {
    const items = context.presetItems;
    if (!items.length) return nothing;
    // One tab stop: the pressed range, or the first one that can be chosen.
    // A disabled field disables every quick range and «Свой период» with them.
    const focusable = context.disabled ? null
        : items.find((item) => item.pressed && !item.disabled) ?? items.find((item) => !item.disabled);
    // «Свой период» is pressed for a range picked on the grid, not for no range.
    const custom = !items.some((item) => item.pressed) && Boolean(context.startValue);
    return html`
        <div class="sf-datepicker-presets flex flex-col gap-1/4" role="group" aria-label=${context.labels.presets}
            @keydown=${(event) => context.component.handlePresetKeydown(event)}>
            ${items.map((item) => html`
                <button class=${joinClasses('sf-datepicker-text sf-datepicker-preset flex items-cross-center', item.pressed ? 'active' : '')}
                    type="button" ?disabled=${item.disabled || context.disabled} aria-pressed=${item.pressed ? 'true' : 'false'}
                    tabindex=${item === focusable ? '0' : '-1'} data-preset=${item.id}
                    @click=${() => context.component.choosePreset(item)}>${item.label}</button>`)}
            <button class=${joinClasses('sf-datepicker-text sf-datepicker-preset flex items-cross-center', custom ? 'active' : '')}
                type="button" ?disabled=${context.disabled} aria-pressed=${custom ? 'true' : 'false'} tabindex=${focusable || context.disabled ? '-1' : '0'} data-preset=""
                @click=${() => context.component.chooseCustomRange()}>${context.labels.customRange}</button>
        </div>`;
}

// A stepper beside a time part: the class markup of an icon button at the
// field's size 1, out of the tab order as the APG spinbutton has its buttons --
// the arrow keys already do what it does. Still a real, named button.
const TIME_STEPPER = 'sf-datepicker-time-step sf-icon-button sf-icon-button--size-1 sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface flex items-cross-center content-main-center';

function renderTimeStepper(context, part, direction) {
    const labels = context.labels;
    const label = part === 'hours'
        ? (direction < 0 ? labels.earlierHour : labels.laterHour)
        : (direction < 0 ? labels.earlierMinute : labels.laterMinute);
    return html`
        <button type="button" class=${TIME_STEPPER} tabindex="-1" aria-label=${label}
            ?disabled=${context.disabled || context.timeParts.empty}
            @click=${() => context.component.stepTime(part, direction)}
        ><i class="sf-icon" aria-hidden="true">${direction < 0 ? 'remove' : 'add'}</i></button>`;
}

function renderTimePart(context, part) {
    const parts = context.timeParts;
    const value = parts[part];
    const shown = value === null ? '--' : String(value).padStart(2, '0');
    return html`
        <div class="sf-datepicker-time-part flex items-cross-center">
            ${renderTimeStepper(context, part, -1)}
            <span class="sf-datepicker-text sf-datepicker-time-value flex content-main-center items-cross-center"
                role="spinbutton" data-time-part=${part}
                tabindex=${context.disabled ? '-1' : '0'}
                aria-label=${part === 'hours' ? context.labels.hours : context.labels.minutes}
                aria-valuemin=${part === 'hours' ? parts.hoursMin : 0}
                aria-valuemax=${part === 'hours' ? parts.hoursMax : parts.minutesMax}
                aria-valuenow=${value === null ? nothing : value}
                aria-valuetext=${value === null ? context.labels.timeNotSet : shown}
                aria-disabled=${context.disabled ? 'true' : nothing}
                @keydown=${(event) => context.component.handleTimeKeydown(event, part)}>${shown}</span>
            ${renderTimeStepper(context, part, 1)}
        </div>`;
}

// The time of day: hours and minutes, each a spinbutton between its two
// steppers, on one row at the control height of size 1 -- under the grid in
// datetime mode, the whole panel in time mode.
function renderTime(context) {
    if (!context.timeParts) return nothing;
    return html`
        <div class="sf-datepicker-time flex content-main-center items-cross-center gap-1/4" role="group"
            aria-label=${context.labels.time} dir="ltr">
            ${renderTimePart(context, 'hours')}
            <span class="sf-datepicker-time-separator" aria-hidden="true">:</span>
            ${renderTimePart(context, 'minutes')}
        </div>`;
}

// The weekday row lies in the main box with the days, so a month or year
// choice covers both: above the box it labelled columns that were not there,
// and the choice had a row less of height than the panel gives it.
function renderDatepickerPanel(context) {
    const rootClasses = joinClasses('sf-datepicker inline-flex', context.input ? '' : 'sf-datepicker--inline',
        context.presetItems.length ? 'sf-datepicker--presets' : '',
        context.mode !== 'date' ? `sf-datepicker--${context.mode}` : '', context.rootClass);

    if (context.mode === 'time') {
        return html`
            <div ${ref(context.component.refs.datePickerPanel)} id=${context.panelId}
                class=${rootClasses} style=${context.rootStyle || nothing}
                role=${context.input ? 'dialog' : 'group'} aria-label=${context.labels.time}
                aria-disabled=${context.disabled ? 'true' : nothing}
                @click=${(event) => context.component.handlePanelClick(event)}>
                ${renderTime(context)}
            </div>`;
    }

    return html`
        <div ${ref(context.component.refs.datePickerPanel)} id=${context.panelId}
            class=${rootClasses} style=${context.rootStyle || nothing}
            role=${context.input ? 'dialog' : 'group'} aria-label=${context.calendarLabel}
            aria-disabled=${context.disabled ? 'true' : nothing}
            @click=${(event) => context.component.handlePanelClick(event)}>
            ${renderPresets(context)}
            <div class="sf-datepicker-container flex flex-col">
                <!-- The shown month, said when it changes (audit S18c); the year
                     page says its own range in its title. -->
                <div class="sr-only" aria-live="polite" aria-atomic="true">${context.context === 'year' ? '' : context.calendarLabel}</div>
                ${renderTop(context)}
                <div class="sf-datepicker-main relative">
                    ${renderContext(context)}
                    <div class="sf-datepicker-weekdays grid grid-col-7" aria-hidden="true">
                        ${context.weekdays.map((weekday) => html`<span class="sf-datepicker-weekday">${weekday}</span>`)}
                    </div>
                    ${renderGrid(context)}
                </div>
                ${renderTime(context)}
            </div>
        </div>`;
}

export function renderDatepickerTemplate(context) {
    if (!context.input) return renderDatepickerPanel(context);

    return html`
        <div class=${joinClasses('sf-datepicker-wrap inline-flex flex-col relative',
                context.open ? 'is-open' : '',
                context.openAbove ? 'sf-datepicker-wrap--drop-up' : 'sf-datepicker-wrap--drop-down')}
            ${ref(context.component.refs.datePickerRoot)} data-portal=${context.portal ? 'true' : 'false'}>
            ${renderDatepickerInput(context)}
            ${context.open ? renderDatepickerPanel(context) : nothing}
        </div>`;
}
