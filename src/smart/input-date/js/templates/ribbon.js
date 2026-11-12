import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(' ');
}

// One day of the ribbon: the same cell, classes and names as the popup grid's
// (templates/default.js renderDay), so a day looks and reads the same in both.
function renderRibbonDay(day, context) {
    const classes = joinClasses('sf-datepicker-day', day.weekend ? 'sf-datepicker-day-off' : '',
        day.selected ? 'active' : '', day.rangeStart ? 'sf-datepicker-day-start' : '',
        day.rangeSelected ? 'sf-datepicker-day-selected' : '', day.rangeEnd ? 'sf-datepicker-day-end' : '',
        day.disabled ? 'disabled' : '');
    return html`
        <button class=${classes} type="button" role="gridcell" ?disabled=${day.disabled}
            data-date=${day.value} aria-label=${day.label}
            aria-current=${day.today ? 'date' : nothing}
            aria-selected=${day.selected || day.rangeSelected ? 'true' : 'false'} tabindex=${day.tabIndex}
            @click=${() => context.component.pickRibbonDay(day.value)}
            @keydown=${(event) => context.component.handleRibbonKeydown(event, day.value)}>
            <span class="sf-datepicker-day-date">${day.day}</span>
        </button>`;
}

// A month of the ribbon: its title, held over it while it is in view, then its
// weeks. The days before the first and after the last are empty cells, so the
// columns stay the weekdays'.
function renderRibbonMonth(month, context) {
    return html`
        <section class="sf-datepicker-ribbon-month" data-month=${month.key}>
            <div class="sf-datepicker-ribbon-title" aria-hidden="true">${month.label}</div>
            <div class="sf-datepicker-grid grid grid-col-7" role="grid" aria-label=${month.label}>
                <div class="sf-datepicker-week" role="row">
                    ${context.weekdayNames.map((name) => html`<span class="sr-only" role="columnheader">${name}</span>`)}
                </div>
                ${month.weeks.map((week) => html`<div class="sf-datepicker-week" role="row">${week.map((day) => (day
                    ? renderRibbonDay(day, context)
                    : html`<span class="sf-datepicker-day-empty" role="gridcell"></span>`))}</div>`)}
            </div>
        </section>`;
}

// The period on a phone (owner decision C62, ui-control prototypes/
// datepicker.html#lenta): a ribbon of months in a bottom sheet. The weekday
// row is pinned above the ribbon, the months stand one under another and
// scroll with a finger, and the period chosen and «Готово» are pinned under
// it. The sheet is the Framework's (sf-drawer placement="bottom"); this is
// its content.
export function renderDatepickerRibbon(context) {
    const summary = context.summary;
    return html`
        <div class="sf-datepicker-sheet-weekdays" aria-hidden="true">
            ${context.weekdays.map((weekday) => html`<span class="sf-datepicker-weekday">${weekday}</span>`)}
        </div>
        <div class="sf-datepicker-ribbon" @scroll=${() => context.component.handleRibbonScroll()}>
            ${repeat(context.months, (month) => month.key, (month) => renderRibbonMonth(month, context))}
        </div>
        <div class="sf-datepicker-sheet-foot">
            <div class="sf-datepicker-sheet-summary" aria-live="polite">
                ${summary.strong ? html`<b>${summary.strong}</b>` : nothing}
                ${summary.note ? html`<span>${summary.note}</span>` : nothing}
            </div>
            <sf-button class="sf-datepicker-sheet-done" size="1" appearance="default" scheme="primary" full-width
                text=${context.labels.done} ?disabled=${!context.complete}
                @click=${() => context.component.commitRibbon()}></sf-button>
        </div>`;
}
