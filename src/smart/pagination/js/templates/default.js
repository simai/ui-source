import { html, nothing } from "lit";

// sf-pagination's markup (decision C97, 2026-11-12). The element is page
// navigation, in five appearances, each a named <nav> holding only the way
// between pages:
//
//   numbers   ‹ 1 … 4 [5] 6 … 12 ›  (sites, catalogues, search; up to seven
//             places, five on a phone; links when href is a template)
//   field     |‹ ‹ [3] из 12 › ›|   (a dense table)
//   arrows    ‹ Назад · Страница 3 · Далее ›  (the count is not known)
//   cursor    В начало · Дальше ›  (a cursor list: no number, no last page)
//   more      Показать ещё 20 / Показано 40 из 240  (its own look, never in
//             one row with the arrows)
//
// In every appearance a control at an end is disabled, not removed, so the row
// keeps its width while a person pages (PG-02).
//
// An element written without appearance draws the footer it drew before 1.5.0
// -- the range «41–60 из 240», the page-size button «По 20 ▾», the field, and
// Show more and the band of bulk controls when asked -- as a compatible
// composition until 2027-01-01. Those parts belong to the list that owns them
// (sf-view), which composes them beside an sf-pagination of its own appearance
// (change journal value-pagination-footer-parts-to-view).

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(" ");
}

const stepOf = (context) => (context.size === "1/2" ? "1/2" : "1");

// The page a person is on, and the way to any other. Its width is the width of
// the longest page number there is, so it does not grow while a person pages.
function renderPageField(context, component) {
  return html`
    <label
      class="sf-pagination-page-field flex items-cross-center"
      style=${`--sf-pagination-page-input--digits: ${context.fieldDigits}`}
    >
      <sf-input
        size=${context.size}
        appearance="bordered"
        root-class="sf-pagination-page-input"
        value=${String(context.current)}
        inputmode="numeric"
        aria-label=${context.pageFieldLabel}
        @input=${(event) => component.fitPageField(event.target)}
        @keydown=${(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          component.goToTypedPage(event.target?.value);
        }}
      ></sf-input>
    </label>
  `;
}

// An arrow. With an address template (href) it is a link to its page, so a
// server-printed list pages without the script and a reader or a crawler
// knows the neighbours: prev and next say rel (PG-10). The link wears the
// icon button's own classes (the ghost, on-surface look sf-button-icon draws
// here), because a link inside a button would be two controls in one.
// At an end it stays where it is, disabled (C97 point 4): a link loses its
// address and says aria-disabled, a button is disabled.
function renderDirection(context, {kind, icon, label, page, go, disabled = false}) {
  const href = context.href && !disabled ? context.component.pageHref(page) : "";
  if (context.href) {
    const size = stepOf(context);
    return html`
      <li class="sf-pagination-item">
        <a
          class=${joinClasses(
            `sf-pagination-direction sf-pagination-direction--${kind} sf-pagination-link`,
            `sf-icon-button sf-icon-button--size-${size} sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface flex items-cross-center`,
            href ? "" : "disabled",
          )}
          href=${href || nothing}
          role=${href ? nothing : "link"}
          aria-disabled=${href ? nothing : "true"}
          rel=${href && (kind === "prev" || kind === "next") ? kind : nothing}
          title=${label}
          aria-label=${label}
          @click=${(event) => (href ? context.component.followLink(event, page) : event.preventDefault())}
        ><sf-icon root-class="pointer-event-none" icon=${icon} weight="400" aria-hidden="true"></sf-icon></a>
      </li>
    `;
  }

  return html`
    <li class="sf-pagination-item">
      <sf-button-icon
        class=${`sf-pagination-direction sf-pagination-direction--${kind}`}
        size=${context.size}
        appearance="ghost"
        scheme="on-surface"
        icon=${icon}
        title=${label}
        aria-label=${label}
        ?disabled=${disabled}
        @click=${go}
      ></sf-button-icon>
    </li>
  `;
}

const first = (context, component) => renderDirection(context, {
  kind: "first",
  icon: "first_page",
  label: context.firstLabel,
  page: 1,
  disabled: !context.hasPrev,
  go: () => component.firstPage(),
});

const previous = (context, component) => renderDirection(context, {
  kind: "prev",
  icon: "keyboard_arrow_left",
  label: context.previousLabel,
  page: context.current - 1,
  disabled: !context.hasPrev,
  go: () => component.goToPage(context.current - 1),
});

const next = (context, component) => renderDirection(context, {
  kind: "next",
  icon: "keyboard_arrow_right",
  label: context.nextLabel,
  page: context.current + 1,
  disabled: !context.hasNext,
  go: () => component.goToPage(context.current + 1),
});

// The last page is a jump to a number: drawn where the jump can be answered
// (the count exact, or a host that can count it first; PG-11). A link only to
// a page that is known: an estimate asks for the count first.
const last = (context, component) => (context.canJumpToLast
  ? renderDirection(context, {
    kind: "last",
    icon: "last_page",
    label: context.lastLabel,
    page: context.exactCount ? context.pageCount : null,
    disabled: !context.hasNext,
    go: () => component.lastPage(),
  })
  : nothing);

// field: |‹ ‹ [3] из 12 › ›|. «из 12» only for an exact count; an estimate
// reads «из ~23», and no count says nothing after the field.
function renderField(context, component) {
  return html`
    <ol class="sf-pagination-list flex items-cross-center">
      ${first(context, component)}
      ${previous(context, component)}
      <li class="sf-pagination-item sf-pagination-item-field flex items-cross-center">
        ${renderPageField(context, component)}
        ${context.ofPages ? html`<span class="sf-pagination-of" aria-hidden="true">${context.ofPages}</span>` : nothing}
      </li>
      ${next(context, component)}
      ${last(context, component)}
    </ol>
  `;
}

// A page number of numbers: the button's own look (ghost, on-surface; the
// current page tonal, primary) on a link when href is a template, else on a
// button. The current page says aria-current="page".
function renderPageSlot(context, component, slot) {
  if (slot.type === "gap") {
    return html`<li class="sf-pagination-item sf-pagination-slot sf-pagination-slot--gap" aria-hidden="true"><span class="sf-pagination-gap">…</span></li>`;
  }
  const classes = joinClasses(
    "sf-pagination-page",
    "sf-button",
    `sf-button--size-${stepOf(context)}`,
    slot.selected ? "sf-button--tonal sf-button--primary sf-pagination-page--current" : "sf-button--ghost sf-button--link sf-button--on-surface",
    "flex",
    "items-cross-center",
  );
  const label = `${context.pageLabel} ${slot.value}`;
  const text = html`<span class="sf-button-text-container text-center pointer-event-none flex-1">${slot.value}</span>`;
  const href = context.href ? component.pageHref(slot.value) : "";
  const body = href
    ? html`<a
        class=${classes}
        href=${href}
        aria-label=${label}
        aria-current=${slot.selected ? "page" : nothing}
        data-page=${String(slot.value)}
        @click=${(event) => (slot.selected ? event.preventDefault() : component.followLink(event, slot.value))}
      >${text}</a>`
    : html`<button
        type="button"
        class=${classes}
        aria-label=${label}
        aria-current=${slot.selected ? "page" : nothing}
        data-page=${String(slot.value)}
        @click=${() => component.goToPage(slot.value)}
      >${text}</button>`;

  return html`<li class="sf-pagination-item sf-pagination-slot">${body}</li>`;
}

// numbers: ‹ 1 … 4 [5] 6 … 12 ›, up to seven places (five on a phone), the
// first and the last page always, the ellipsis not a control.
function renderNumbers(context, component) {
  return html`
    <ol class="sf-pagination-list flex items-cross-center" style=${`--sf-pagination--digits: ${context.slotDigits}`}>
      ${previous(context, component)}
      ${context.pageSlots.map((slot) => renderPageSlot(context, component, slot))}
      ${next(context, component)}
    </ol>
  `;
}

// A text button of arrows and cursor: the button's own element, a link when
// href is a template (sf-button drops the address while it is disabled).
function textButton(context, component, {kind, text, page, disabled, appearance = "ghost", scheme = "on-surface", iconStart, iconEnd, go}) {
  const href = context.href && !disabled ? component.pageHref(page) : "";
  return html`
    <li class="sf-pagination-item">
      <sf-button
        class=${`sf-pagination-direction sf-pagination-direction--${kind}`}
        size=${context.size}
        appearance=${appearance}
        scheme=${scheme}
        text=${text}
        icon-start=${iconStart || nothing}
        icon-end=${iconEnd || nothing}
        href=${href || nothing}
        rel=${href && (kind === "prev" || kind === "next") ? kind : nothing}
        ?disabled=${disabled}
        @click=${(event) => (href ? component.followLink(event, page) : go())}
      ></sf-button>
    </li>
  `;
}

// arrows: ‹ Назад · Страница 3 · Далее ›, for a total that is not known or
// only estimated: no last page and no number to type.
function renderArrows(context, component) {
  return html`
    <ol class="sf-pagination-list flex items-cross-center">
      ${textButton(context, component, {
        kind: "prev",
        text: context.previousText,
        page: context.current - 1,
        disabled: !context.hasPrev,
        iconStart: "chevron_left",
        go: () => component.goToPage(context.current - 1),
      })}
      <li class="sf-pagination-item sf-pagination-place" role="status">${context.placeText}</li>
      ${textButton(context, component, {
        kind: "next",
        text: context.nextText,
        page: context.current + 1,
        disabled: !context.hasNext,
        iconEnd: "chevron_right",
        go: () => component.goToPage(context.current + 1),
      })}
    </ol>
  `;
}

// cursor: В начало · Дальше ›. The host knows only whether there is more
// (has-next); there is no page number to show and never a last page (Larena
// msg-0852f1a2). «В начало» is page 1, «Дальше» the next portion.
function renderCursor(context, component) {
  return html`
    <ol class="sf-pagination-list flex items-cross-center">
      ${textButton(context, component, {
        kind: "first",
        text: context.firstLabel,
        page: 1,
        disabled: !context.hasPrev,
        iconStart: "first_page",
        go: () => component.firstPage(),
      })}
      ${textButton(context, component, {
        kind: "next",
        text: context.cursorNextText,
        page: context.current + 1,
        disabled: !context.hasNext,
        appearance: "outline",
        scheme: "primary",
        iconEnd: "chevron_right",
        go: () => component.goToPage(context.current + 1),
      })}
    </ol>
  `;
}

// more: «Показать ещё 20», then «Показано 40 из 240» and a thin bar. It adds a
// portion (sf-pagination-load-more); current is the number of portions shown.
// When everything is shown the button goes and the line stays.
function renderMore(context, component) {
  return html`
    <div class="sf-pagination-more flex flex-col items-cross-center">
      ${context.hasNext
        ? html`
            <sf-button
              class="sf-pagination-more-button"
              size=${context.size}
              appearance="outline"
              scheme="primary"
              text=${context.showMoreCountText}
              ?loading=${context.showMoreBusy}
              ?disabled=${context.showMoreBusy}
              @click=${(event) => component.showMore(event.target)}
            ></sf-button>
          `
        : nothing}
      ${context.shownText
        ? html`
            <span class="sf-pagination-shown" role="status">${context.shownText}</span>
            ${context.shownPercent === null
              ? nothing
              : html`<sf-progress-bar
                  class="sf-pagination-progress"
                  size="1/3"
                  value=${String(context.shownPercent)}
                  text-position="none"
                  label=${context.shownText}
                ></sf-progress-bar>`}
          `
        : nothing}
    </div>
  `;
}

const VIEWS = {field: renderField, numbers: renderNumbers, arrows: renderArrows, cursor: renderCursor, more: renderMore};

// The range part of the compatible footer: «41–60 из 240», «41–60 из многих»,
// «41–60 из ~450» with an offer to count, and a short wait while it does. A
// host that cannot count is not offered the count at all. A total-label the
// author wrote keeps the «Всего: 240» line until 2027-01-01.
function renderRange(context, component) {
  const countButton = html`
    <sf-button
      class="sf-pagination-count-request"
      size=${context.size}
      appearance="ghost"
      scheme="primary"
      text=${context.showCountLabel}
      @click=${() => component.requestCount("total")}
    ></sf-button>
  `;
  const spinner = html`<sf-spinner size=${context.size} aria-label=${context.countingLabel}></sf-spinner>`;
  const offer = context.exactCount ? nothing : context.counting ? spinner : context.canCount ? countButton : nothing;

  return html`
    <div class="sf-pagination-left flex items-cross-center">
      <div class="sf-pagination-total flex items-cross-center">
        ${context.rangeText
          ? html`<span class="sf-pagination-range" role="status">${context.rangeText}</span>`
          : nothing}
        ${offer}
      </div>
    </div>
  `;
}

// The page-size part of the compatible footer: a quiet button «По 20 ▾» that
// opens a menu of radio rows (C97 point 3), not a labelled select. Its name
// says what it is: «На странице: 20».
function renderPageSize(context, component) {
  return html`
    <div class="sf-pagination-count flex items-cross-center">
      <sf-button
        class="sf-pagination-size"
        size=${context.size}
        appearance="ghost"
        scheme="on-surface"
        icon-end="arrow_drop_down"
        text=${context.pageSizeText}
        aria-label=${`${context.pageSizeLabel} ${context.pageSize}`.trim()}
        aria-haspopup="menu"
        @click=${(event) => component.togglePageSizeMenu(event.currentTarget)}
      ></sf-button>
      <sf-menu-context
        class="sf-pagination-size-menu"
        popup
        size=${context.size}
        aria-label=${context.pageSizeLabel}
        @sf-menu-context-select=${(event) => component.choosePageSize(event)}
      ></sf-menu-context>
    </div>
  `;
}

// The band of bulk controls, kept for a pagination that carries it until
// 2027-01-01 (C97 point 5: it belongs to sf-view, which draws it itself).
function renderBand(context, component) {
  return html`
    <div
      class=${joinClasses("sf-pagination-actions", "flex", "items-cross-center", context.bottomClass)}
      role="region"
      aria-label=${context.actionsRegionLabel}
    >
      <span class="sf-pagination-actions-count">
        ${context.selectedLabel} ${context.selectedCount}
      </span>
      <span class="sf-pagination-actions-separator" aria-hidden="true"></span>
      <sf-dropdown
        size=${context.size}
        appearance="outlined"
        search="false"
        mode="select"
        value=${context.action}
        placeholder=${context.actionChooseLabel}
        aria-label=${context.actionsLabel}
        .options=${[
          // The list opens on a choice that is not an action: Apply is not
          // pressable before anyone has chosen anything.
          {
            type: "text",
            size: context.size,
            text: context.actionChooseLabel,
            value: "",
            selected: !context.action,
          },
          ...context.actions.map((action) => ({
            type: "text",
            size: context.size,
            text: action.text,
            value: action.value,
            selected: action.value === context.action,
            disabled: Boolean(action.disabled),
          })),
        ]}
        @change=${(event) => component.setAction(event.detail.value)}
      ></sf-dropdown>
      <sf-button
        size=${context.size}
        appearance="default"
        scheme="primary"
        text=${context.actionApplyText}
        ?disabled=${!context.action}
        @click=${() => component.applyAction()}
      ></sf-button>
      ${context.showActionForAll
        ? html`
            <span class="sf-pagination-actions-separator" aria-hidden="true"></span>
            <sf-checkbox
              label=${context.countKnown
                ? `${context.actionForAllLabel} (${context.shownTotal})`
                : context.actionForAllLabel}
              ?checked=${Boolean(context.actionForAll)}
              @change=${(event) =>
                component.setActionForAll(Boolean(event.target?.checked))}
            ></sf-checkbox>
          `
        : ""}
      <sf-button-icon
        class="sf-pagination-actions-clear"
        size=${context.size}
        appearance="ghost"
        scheme="on-surface"
        icon="close"
        title=${context.clearSelectionLabel}
        aria-label=${context.clearSelectionLabel}
        @click=${() => component.clearSelection()}
      ></sf-button-icon>
    </div>
  `;
}

// The compatible footer (no appearance written): one row «41–60 из 240 · По 20
// ▾ · ‹ [3] из 12 ›» -- the sf-view admin footer of C97 point 5 -- with Show
// more on a line of its own above it (never in one row with the arrows) and
// the band below.
function renderFooter(context, component) {
  const mainClasses = joinClasses(
    "sf-pagination-main",
    "flex",
    "items-cross-center",
    "content-main-between",
    context.mainClass,
  );
  const hasPages = !context.countKnown || context.total > 0;

  return html`
    ${context.top && context.hasNext
      ? html`
          <div class=${joinClasses("sf-pagination-top", "flex", "content-main-center", context.topClass)}>
            <sf-button
              class="sf-pagination-more-button"
              size=${context.size}
              appearance="outline"
              scheme="primary"
              ?loading=${context.showMoreBusy}
              ?disabled=${context.showMoreBusy}
              @click=${(event) => component.showMore(event.target)}
              text=${context.showMoreText}
            ></sf-button>
          </div>
        `
      : nothing}
    ${context.middle
      ? html`
          <div class=${mainClasses}>
            ${renderRange(context, component)}
            ${hasPages
              ? html`
                  <div class="sf-pagination-container flex items-cross-center">
                    ${context.pagesLabelShown ? html`<span class="sf-pagination-pages-label">${context.pagesLabel}</span>` : nothing}
                    ${renderField(context, component)}
                  </div>
                `
              : nothing}
            ${context.showPageSize && hasPages ? renderPageSize(context, component) : nothing}
          </div>
        `
      : nothing}
    ${context.bottom && context.showActions && context.actions?.length && context.selectedCount > 0
      ? renderBand(context, component)
      : nothing}
  `;
}

export function renderPaginationTemplate(context) {
  const { component } = context;
  const appearance = context.footer ? "footer" : (VIEWS[context.appearance] ? context.appearance : "field");
  const rootClasses = joinClasses(
    "sf-pagination",
    `sf-pagination--size-${stepOf(context)}`,
    `sf-pagination--${appearance}`,
    "flex",
    context.footer ? "flex-col" : "items-cross-center",
    context.rootClass,
  );

  return html`
    <nav
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      aria-label=${context.ariaLabel}
    >
      ${context.footer ? renderFooter(context, component) : VIEWS[appearance](context, component)}
    </nav>
  `;
}
