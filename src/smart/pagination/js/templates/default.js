import { html, nothing } from "lit";

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(" ");
}

function renderPageItem(item, context) {
  const { component } = context;

  return html`
    <li
      class=${joinClasses(
        "sf-pagination-item",
        item.edge ? "sf-pagination-item--edge" : "",
        item.selected ? "sf-pagination-item--current" : "",
      )}
    >
      <button
        type="button"
        class=${joinClasses(
          "sf-page-number",
          "sf-page-number--square",
          item.selected ? "selected" : "",
        )}
        data-page=${String(item.value)}
        aria-current=${item.selected ? "page" : nothing}
        aria-label=${`${context.pageLabel} ${item.value}`}
        @click=${() => component.goToPage(item.value)}
      >
        ${item.value}
      </button>
    </li>
  `;
}

// The page a person is on, and the way to any other. It used to sit beside the
// row of numbers with a label of its own; it stands between the arrows now, and
// the label is for a reader rather than a line of text in the footer.
function renderPageField(context, component) {
  return html`
    <label
      class="sf-pagination-page-field flex items-cross-center"
      style=${`--sf-pagination-page-input--digits: ${String(context.current).length}`}
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

function renderDirection(context, {kind, icon, label, page}) {
  return html`
    <li class="sf-pagination-item">
      <sf-icon-button
        class=${`sf-pagination-direction sf-pagination-direction--${kind}`}
        size=${context.size}
        appearance="link"
        scheme="on-surface"
        icon=${icon}
        title=${label}
        aria-label=${label}
        @click=${page}
      ></sf-icon-button>
    </li>
  `;
}

export function renderPaginationTemplate(context) {
  const { component } = context;
  const rootClasses = joinClasses(
    "sf-pagination",
    `sf-pagination--size-${context.size === "1/2" ? "1/2" : "1"}`,
    "flex",
    "flex-col",
    context.rootClass,
  );
  const topClasses = joinClasses(
    "sf-pagination-top",
    "flex",
    "content-main-center",
    context.topClass,
  );
  const mainClasses = joinClasses(
    "sf-pagination-main",
    "flex",
    "items-cross-center",
    "content-main-between",
    context.mainClass,
  );
  // The row of bulk controls is a panel over the page while rows are marked,
  // not a row inside the pagination: the controls act on the selection, which
  // outlives the part of the page a person is looking at.
  // Only the band's own class: `sf-pagination-bottom` is the generic last row,
  // and it paints transparent at a higher specificity, so the band came out
  // see-through with the rows reading through it.
  const bottomClasses = joinClasses(
    "sf-pagination-actions",
    "flex",
    "items-cross-center",
    context.bottomClass,
  );

  return html`
    <nav
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      aria-label=${context.ariaLabel}
    >
      <!-- Show more had a row of its own above the footer. It is a page action
           like the arrows, so it stands in the footer beside them; the row it
           used to take was a line of empty space whenever there was nothing
           more to show. -->
      ${context.middle
        ? html`
            <div class=${mainClasses}>
              <!-- How many are marked is said by the band of bulk controls,
                   which only exists while something is marked. Saying it here
                   as well meant a footer counting a selection of none out of
                   the total at all times, and zero out of zero before the
                   first answer. -->
              <div class="sf-pagination-left flex items-cross-center">
                <!-- Three answers to "how many": the number, a short wait, or
                     an offer to find out. A host that cannot count is not
                     offered at all — a link that answers "unavailable" is worse
                     than no link. -->
                <div class="sf-pagination-total flex items-cross-center">
                  <!-- An estimate (total-exact false) reads «~N», and the
                       offer to find out stands beside it: the number is
                       there, but it is not one to act on. -->
                  ${context.countKnown
                    ? html`
                        <div class="sf-pagination-total-text flex items-cross-center">
                          ${context.totalLabel} ${context.shownTotal}
                          ${context.totalExact
                            ? ""
                            : context.counting
                              ? html`<sf-spinner size=${context.size} aria-label=${context.countingLabel}></sf-spinner>`
                              : context.canCount
                                ? html`
                                    <sf-button
                                      class="sf-pagination-count-request"
                                      size=${context.size}
                                      appearance="link"
                                      scheme="primary"
                                      text=${context.showCountLabel}
                                      @click=${() => component.requestCount("total")}
                                    ></sf-button>
                                  `
                                : ""}
                        </div>
                      `
                    : context.counting
                      ? html`
                          <div class="sf-pagination-total-text flex items-cross-center">
                            ${context.totalLabel}
                            <sf-spinner size=${context.size} aria-label=${context.countingLabel}></sf-spinner>
                          </div>
                        `
                      : context.canCount
                        ? html`
                            <div class="sf-pagination-total-text flex items-cross-center">
                              ${context.totalLabel}
                              <sf-button
                                class="sf-pagination-count-request"
                                size=${context.size}
                                appearance="link"
                                scheme="primary"
                                text=${context.showCountLabel}
                                @click=${() => component.requestCount("total")}
                              ></sf-button>
                            </div>
                          `
                        : ""}
                </div>
              </div>

              ${!context.countKnown || context.total > 0
                ? html`
                    <div class="sf-pagination-container flex items-cross-center">
                      <span class="sf-pagination-pages-label">${context.pagesLabel}</span>
                      <ol class="sf-pagination-list flex items-cross-center">
                        ${context.hasPrev
                          ? html`
                              ${renderDirection(context, {
                                kind: "first",
                                icon: "first_page",
                                label: context.firstLabel,
                                page: () => component.firstPage(),
                              })}
                              ${renderDirection(context, {
                                kind: "prev",
                                icon: "keyboard_arrow_left",
                                label: context.previousLabel,
                                page: () => component.goToPage(context.current - 1),
                              })}
                            `
                          : ""}
                        <!-- The field stands where the row of numbers stood: on
                             a page five of hundreds the numbers around it said
                             little, and the row they took changed width as the
                             person moved through the pages. -->
                        <li class="sf-pagination-item sf-pagination-item-field flex items-cross-center">
                          ${renderPageField(context, component)}
                        </li>
                        ${context.hasNext
                          ? html`
                              ${renderDirection(context, {
                                kind: "next",
                                icon: "keyboard_arrow_right",
                                label: context.nextLabel,
                                page: () => component.goToPage(context.current + 1),
                              })}
                              ${context.canJumpToLast
                                ? renderDirection(context, {
                                    kind: "last",
                                    icon: "last_page",
                                    label: context.lastLabel,
                                    page: () => component.lastPage(),
                                  })
                                : ""}
                            `
                          : ""}
                      </ol>
                    </div>
                  `
                : ""}

              ${context.top && context.hasNext
                ? html`
                    <div class="sf-pagination-more flex items-cross-center">
                      <sf-button
                        size=${context.size}
                        appearance="outline"
                        scheme="primary"
                        ?loading=${context.showMoreBusy}
                        ?disabled=${context.showMoreBusy}
                        @click=${(e) => component.showMore(e.target)}
                        text="${context.showMoreText}"
                      ></sf-button>
                    </div>
                  `
                : ""}

              ${context.showPageSize && (!context.countKnown || context.total > 0)
                ? html`
                    <div class="sf-pagination-count flex items-cross-center">
                      <span>${context.pageSizeLabel}</span>
                      <sf-dropdown
                        size=${context.size}
                        appearance="outlined"
                        search="false"
                        mode="select"
                        portal="true"
                        value=${String(context.pageSize)}
                        aria-label=${context.pageSizeLabel}
                        .options=${(context.pageSizes || []).map((size) => ({
                          type: "text",
                          size: context.size,
                          text: String(size),
                          value: String(size),
                          selected: Number(size) === Number(context.pageSize),
                        }))}
                        @change=${(event) =>
                          component.setPageSize(Number(event.detail.value))}
                      ></sf-dropdown>
                    </div>
                  `
                : ""}
            </div>
          `
        : ""}
      <!-- A page row on its own still carries the band. Inside a data view the
           card carries it instead, and the view turns this block off: a band
           sticky inside the page row could travel no further than the row. -->
      ${context.bottom && context.showActions && context.actions?.length && context.selectedCount > 0
        ? html`
            <div
              class=${bottomClasses}
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
                  // The list opens on a choice that is not an action. A select
                  // that starts on the first real action makes Apply pressable
                  // before anyone has chosen anything, and the first action in
                  // the list is as likely to be "delete for ever" as anything
                  // else.
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
              <sf-icon-button
                class="sf-pagination-actions-clear"
                size=${context.size}
                appearance="link"
                scheme="on-surface"
                icon="close"
                title=${context.clearSelectionLabel}
                aria-label=${context.clearSelectionLabel}
                @click=${() => component.clearSelection()}
              ></sf-icon-button>
            </div>
          `
        : ""}
    </nav>
  `;
}
