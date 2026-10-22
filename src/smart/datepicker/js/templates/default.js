import {html, nothing} from 'lit';
import {ref} from 'lit/directives/ref.js';

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(' ');
}

function renderYearTop(context) {
    return html`
        <div class="sf-datepicker-top flex content-main-between items-cross-center">
            <sf-icon-button appearance="link" scheme="on-surface" size="1"
                icon=${context.previousIcon} aria-label=${context.labels.previousYears}
                @click=${() => context.component.shiftYearPage(-1)}></sf-icon-button>
            <div class="sf-datepicker-range-title" aria-live="polite">
                ${context.yearPageStart}–${context.yearPageEnd}
            </div>
            <sf-icon-button appearance="link" scheme="on-surface" size="1"
                icon=${context.nextIcon} aria-label=${context.labels.nextYears}
                @click=${() => context.component.shiftYearPage(1)}></sf-icon-button>
        </div>`;
}

function renderTop(context) {
    if (context.context === 'year') return renderYearTop(context);

    return html`
        <div class="sf-datepicker-top grid items-cross-center">
            <sf-icon-button appearance="link" scheme="on-surface" size="1"
                icon=${context.previousIcon} aria-label=${context.labels.previousMonth}
                @click=${() => context.component.shiftMonth(-1)}></sf-icon-button>
            <div class="sf-datepicker-period flex content-main-center items-cross-center gap-1/4">
                <sf-button class="sf-datepicker-month-toggle" appearance="link" scheme="on-surface" spacing="compact"
                    text=${context.monthLabel}
                    aria-expanded=${context.context === 'month' ? 'true' : 'false'}
                    @click=${() => context.component.toggleContext('month')}></sf-button>
                <sf-button class="sf-datepicker-year-toggle" appearance="link" scheme="on-surface" spacing="compact"
                    text=${String(context.year)}
                    aria-expanded="false"
                    @click=${() => context.component.toggleContext('year')}></sf-button>
            </div>
            <sf-icon-button appearance="link" scheme="on-surface" size="1"
                icon=${context.nextIcon} aria-label=${context.labels.nextMonth}
                @click=${() => context.component.shiftMonth(1)}></sf-icon-button>
        </div>`;
}

function renderMonthContext(context) {
    return html`
        <div class="sf-datepicker-context absolute top-0 bottom-0 inline-start-0 inline-end-0 grid grid-col-3 content-cross-start items-cross-start overflow-auto gap-1/4"
             aria-label=${context.labels.chooseMonth}>
            ${context.months.map((month) => html`
                <button class=${joinClasses('sf-datepicker-text flex content-main-center items-cross-center', month.selected ? 'active' : '', month.disabled ? 'disabled' : '')}
                    ?disabled=${month.disabled} aria-pressed=${month.selected ? 'true' : 'false'}
                    type="button" @click=${() => context.component.selectMonth(month)}>
                    <span class="sf-datepicker-text-date">${month.label}</span>
                </button>`)}
        </div>`;
}

function renderYearContext(context) {
    return html`
        <div class="sf-datepicker-context absolute top-0 bottom-0 inline-start-0 inline-end-0 grid grid-col-3 content-cross-start items-cross-start overflow-auto gap-1/4"
             aria-label=${context.labels.chooseYear}>
            ${context.years.map((year) => html`
                <button class=${joinClasses('sf-datepicker-text flex content-main-center items-cross-center', year.selected ? 'active' : '', year.disabled ? 'disabled' : '')}
                    type="button" ?disabled=${year.disabled} aria-pressed=${year.selected ? 'true' : 'false'}
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
            label=${context.label || nothing} name=${context.inputName || nothing}
            aria-label=${context.label ? nothing : (context.ariaLabel || nothing)}
            placeholder=${context.placeholder || nothing} icon-start=${context.iconStart || nothing}
            root-class=${context.inputRootClass || nothing} value=${context.displayValue || ''}
            ?disabled=${context.disabled} ?required=${context.required} ?mask=${context.mask}
            mask-pattern=${context.maskPattern || nothing} mask-lazy=${String(context.maskLazy)}
            mask-placeholder-char=${context.maskPlaceholderChar || nothing}
            mask-options=${context.maskOptions || nothing} ?readonly=${context.readonly}
            @click=${(event) => context.component.handleInputClick(event)}
            @change=${(event) => context.component.handleInputChange(event)}
            @keydown=${(event) => context.component.handleInputKeydown(event)}></sf-input>`;
}

function renderDay(day, context) {
    const classes = joinClasses('sf-datepicker-day', day.weekend ? 'sf-datepicker-day-off' : '',
        day.selected ? 'active' : '', day.rangeStart ? 'sf-datepicker-day-start' : '',
        day.rangeSelected ? 'sf-datepicker-day-selected' : '', day.rangeEnd ? 'sf-datepicker-day-end' : '',
        day.currentMonth ? '' : 'sf-datepicker-another-month', day.disabled ? 'disabled' : '');

    return html`
        <button class=${classes} type="button" ?disabled=${day.disabled}
            data-date=${day.value} aria-label=${day.label}
            aria-current=${day.today ? 'date' : nothing}
            aria-pressed=${day.selected ? 'true' : 'false'} tabindex=${day.tabIndex}
            @click=${() => context.component.selectDate(day)}
            @focus=${() => context.component.setActiveDate(day.value)}
            @keydown=${(event) => context.component.handleDayKeydown(event, day)}>
            <span class="sf-datepicker-day-date">${day.day}</span>
        </button>`;
}

function renderPresets(context) {
    const items = context.presetItems;
    if (!items.length) return nothing;
    // One tab stop: the pressed range, or the first one that can be chosen.
    const focusable = items.find((item) => item.pressed && !item.disabled) ?? items.find((item) => !item.disabled);
    // «Свой период» is pressed for a range picked on the grid, not for no range.
    const custom = !items.some((item) => item.pressed) && Boolean(context.startValue);
    return html`
        <div class="sf-datepicker-presets flex flex-col gap-1/4" role="group" aria-label=${context.labels.presets}
            @keydown=${(event) => context.component.handlePresetKeydown(event)}>
            ${items.map((item) => html`
                <button class=${joinClasses('sf-datepicker-text sf-datepicker-preset flex items-cross-center', item.pressed ? 'active' : '')}
                    type="button" ?disabled=${item.disabled} aria-pressed=${item.pressed ? 'true' : 'false'}
                    tabindex=${item === focusable ? '0' : '-1'} data-preset=${item.id}
                    @click=${() => context.component.choosePreset(item)}>${item.label}</button>`)}
            <button class=${joinClasses('sf-datepicker-text sf-datepicker-preset flex items-cross-center', custom ? 'active' : '')}
                type="button" aria-pressed=${custom ? 'true' : 'false'} tabindex=${focusable ? '-1' : '0'} data-preset=""
                @click=${() => context.component.chooseCustomRange()}>${context.labels.customRange}</button>
        </div>`;
}

function renderDatepickerPanel(context) {
    const rootClasses = joinClasses('sf-datepicker inline-flex', context.presetItems.length ? 'sf-datepicker--presets' : '', context.rootClass);

    return html`
        <div ${ref(context.component.refs.datePickerPanel)} id=${context.panelId}
            class=${rootClasses} style=${context.rootStyle || nothing}
            role=${context.input ? 'dialog' : 'group'} aria-label=${context.calendarLabel}
            @click=${(event) => context.component.handlePanelClick(event)}>
            ${renderPresets(context)}
            <div class="sf-datepicker-container flex flex-col">
                ${renderTop(context)}
                <div class="sf-datepicker-weekdays grid grid-col-7" aria-hidden="true">
                    ${context.weekdays.map((weekday) => html`<span class="sf-datepicker-weekday">${weekday}</span>`)}
                </div>
                <div class="sf-datepicker-main relative">
                    ${renderContext(context)}
                    <div class="sf-datepicker-grid grid grid-col-7">
                        ${context.days.map((day) => renderDay(day, context))}
                    </div>
                </div>
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
