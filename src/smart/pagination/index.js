import SfBaseElement, {
  toAttributeName,
} from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { renderPaginationTemplate } from "./js/templates/default";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// sf-pagination from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8, §11): its settings are attributes and properties made by
// core/js/element-manifest.js, every word it says is lang/<locale>.json (an
// English page used to read «Всего:» under a list that had switched, owner
// 2026-10-10), and its events take the vocabulary's names; the old ones --
// sf-page-change, sf-show-more, … -- follow with their old detail until
// 2026-12-01 (aliases.json).
const PaginationElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});

// A word's key in the language files: pagesLabel → pages-label.
const wordKey = (key) => String(key).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

// An old event's detail (§16.20 split rows): the camelCase fields it had.
const camelDetail = (detail) => Object.fromEntries(
  Object.entries(detail).map(([key, value]) => [key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()), value]),
);

function parsePageSizes(value, fallback = [10, 20, 30, 40]) {
  const valid = (size) => Number.isInteger(size) && size > 0;
  if (Array.isArray(value)) {
    const sizes = value.map(Number).filter(valid);

    return sizes.length ? sizes : fallback;
  }

  // An absent attribute used to answer with a single size of zero rather than
  // the default: splitting "" yields one empty segment, Number("") is 0, and 0
  // is finite, so the list was never empty and the fallback was never reached.
  // A page size has to be a positive whole number, which is also what rules out
  // "20.5" and "-1".
  const parsed = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map(Number)
    .filter(valid);

  return parsed.length ? parsed : fallback;
}

function parseActions(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  const parsed = String(value || "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [valueTextPart, flagsPart = ""] = entry.split("::");
      const [rawValue, ...rawText] = valueTextPart.split(":");
      const value = String(rawValue || "").trim();
      const text = rawText.join(":").trim() || value;
      const flags = flagsPart
        .split(",")
        .map((flag) => flag.trim().toLowerCase())
        .filter(Boolean);

      return {
        value,
        text,
        disabled: flags.includes("disabled"),
        selected: flags.includes("selected"),
      };
    })
    .filter((item) => item.value || item.text)
    .map((item, index) => ({
      ...item,
      value: item.value || `action-${index + 1}`,
    }));

  return parsed.length ? parsed : fallback;
}

// The boolean settings that are on by default (component.json).
const DEFAULT_ON = new Set(
  Object.entries(manifest.settings)
    .filter(([, spec]) => spec.type === "boolean" && spec.default === true)
    .map(([name]) => name),
);

class SfPagination extends PaginationElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: "template", default: "default" },
      // The step of the size ladder its controls and labels take: 1, or the
      // dense 1/2 of an admin, where a page row stands beside 32px controls.
      size: { default: "1", values: ["1/2", "1"] },
      top: { type: Boolean, default: true },
      middle: { type: Boolean, default: true },
      bottom: { type: Boolean, default: true },
      topClass: { default: "" },
      mainClass: { default: "" },
      bottomClass: { default: "" },
      ariaLabel: {
        attribute: "aria-label",
        default: "",
      },
      pagesLabel: { attribute: "pages-label", default: "" },
      pageLabel: { attribute: "page-label", default: "" },
      previousLabel: {
        attribute: "previous-label",
        default: "",
      },
      nextLabel: {
        attribute: "next-label",
        default: "",
      },
      lastLabel: { attribute: "last-label", default: "" },
      firstLabel: { attribute: "first-label", default: "" },
      pageFieldLabel: { attribute: "page-field-label", default: "" },
      totalLabel: { attribute: "total-label", default: "" },
      selectedLabel: { attribute: "selected-label", default: "" },
      selectedCount: {
        attribute: "selected-count",
        type: Number,
        default: 0,
      },
      showMoreText: { attribute: "show-more-text", default: "" },
      countKnown: { attribute: "count-known", type: Boolean, default: true },
      totalExact: { attribute: "total-exact", type: Boolean, default: true },
      canCount: { attribute: "can-count", type: Boolean, default: false },
      counting: { type: Boolean, default: false },
      hasNextPage: { attribute: "has-next", type: Boolean, default: false },
      showCountLabel: {
        attribute: "show-count-label",
        default: "",
      },
      countingLabel: { attribute: "counting-label", default: "" },
      showMoreBusy: { attribute: "show-more-busy", type: Boolean, default: false },
      current: { type: Number, default: 1 },
      total: { type: Number, default: 10 },
      pageSize: { attribute: "page-size", type: Number, default: 10 },
      pageSizes: {
        attribute: "page-sizes",
        default: [10, 20, 30, 40],
        parser(value, defaultValue) {
          return parsePageSizes(value, defaultValue);
        },
      },
      showPageSize: {
        attribute: "show-page-size",
        type: Boolean,
        default: true,
      },
      pageSizeLabel: {
        attribute: "page-size-label",
        default: "",
      },
      showActions: { attribute: "show-actions", type: Boolean, default: true },
      actions: {
        default: [],
        parser(value, defaultValue) {
          return parseActions(value, defaultValue);
        },
      },
      action: { default: "" },
      actionApplyText: { attribute: "action-apply-text", default: "" },
      showActionForAll: {
        attribute: "show-action-for-all",
        type: Boolean,
        default: false,
      },
      actionForAll: {
        attribute: "action-for-all",
        type: Boolean,
        default: false,
      },
      actionForAllLabel: {
        attribute: "action-for-all-label",
        default: "",
      },
      actionChooseLabel: {
        attribute: "action-choose-label",
        default: "",
      },
      actionsRegionLabel: {
        attribute: "actions-region-label",
        default: "",
      },
      clearSelectionLabel: {
        attribute: "clear-selection-label",
        default: "",
      },
      actionsLabel: {
        attribute: "actions-label",
        default: "",
      },
    };
  }

  get top() {
    return this.getBooleanAttr("top", true);
  }

  get middle() {
    return this.getBooleanAttr("middle", true);
  }

  get bottom() {
    return this.getBooleanAttr("bottom", true);
  }

  get topClass() {
    return this.getAttribute("top-class") || "";
  }

  get mainClass() {
    return this.getAttribute("main-class") || "";
  }

  get bottomClass() {
    return this.getAttribute("bottom-class") || "";
  }

  get showMoreText() {
    return this.getAttribute("show-more-text") || this.sfWord("show-more-text");
  }

  get ariaLabel() {
    return this.getAttribute("aria-label") || this.sfWord("aria-label");
  }

  get pagesLabel() {
    return this.getAttribute("pages-label") || this.sfWord("pages-label");
  }

  get pageLabel() {
    return this.getAttribute("page-label") || this.sfWord("page-label");
  }

  get previousLabel() {
    return this.getAttribute("previous-label") || this.sfWord("previous-label");
  }

  get nextLabel() {
    return this.getAttribute("next-label") || this.sfWord("next-label");
  }

  get firstLabel() {
    return this.getAttribute("first-label") || this.sfWord("first-label");
  }

  get pageFieldLabel() {
    return this.getAttribute("page-field-label") || this.sfWord("page-field-label");
  }

  get lastLabel() {
    return this.getAttribute("last-label") || this.sfWord("last-label");
  }

  get totalLabel() {
    return this.getAttribute("total-label") || this.sfWord("total-label");
  }

  get selectedLabel() {
    return this.getAttribute("selected-label") || this.sfWord("selected-label");
  }

  // How many rows are marked. It is capped by the total only when there is a
  // total: with the count unknown the cap was zero, so a marked row read as
  // none and the panel of bulk controls never appeared at all.
  get selectedCount() {
    const parsed = Math.trunc(this.getNumberAttr("selected-count", 0));
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    const atLeastNone = Math.max(parsed, 0);

    return this.countKnown && this.totalExact ? Math.min(atLeastNone, this.total) : atLeastNone;
  }

  get total() {
    const parsed = Math.trunc(this.getNumberAttr("total", 10));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
  }

  // Whether the number of records is known at all. A host that does not count
  // every answer says so, and then the view shows a link in place of the number
  // and asks what is behind it only when someone wants it.
  get countKnown() {
    return this.getBooleanAttr("count-known", true);
  }

  // Whether the total is the number itself or an estimate (vocabulary 1.1.5
  // total-exact; standard 1.3.8 gate 29). sf-data-view says false from the
  // port's `total_exact`: the row then reads «~N», and neither the last page
  // nor the page count is offered as a fact; the count link asks for the
  // number when the host can count.
  get totalExact() {
    return this.getBooleanAttr("total-exact", true);
  }

  // The number is known and exact: the only case in which the view derives a
  // last page and a page count from it.
  get exactCount() {
    return this.countKnown && this.totalExact;
  }

  // The total as it is shown: «~450» for an estimate.
  get shownTotal() {
    return this.totalExact ? String(this.total) : `~${this.total}`;
  }

  // Whether the host can count when asked. Without it the view offers nothing:
  // a link that answers "unavailable" is worse than no link.
  get canCount() {
    return this.getBooleanAttr("can-count", false);
  }

  get counting() {
    return this.getBooleanAttr("counting", false);
  }

  // Said by the host when it sends no total. It is the only thing that moves
  // forward and Show more then, so the view never derives a page count it was
  // not given.
  get hasNextPage() {
    return this.getBooleanAttr("has-next", false);
  }

  // With an estimate the estimated page count says there is more, and so does
  // has_next: the estimate may be short of the truth.
  get hasNext() {
    if (this.exactCount) return this.current < this.pageCount;
    if (this.countKnown) return this.current < this.pageCount || this.hasNextPage;
    return this.hasNextPage;
  }

  get showCountLabel() {
    return this.getAttribute("show-count-label") || this.sfWord("show-count-label");
  }

  // The next portion is on its way. It is answered inside the button that asked
  // for it, not by a loader over the whole table: the rows on screen are not
  // going anywhere.
  get showMoreBusy() {
    return this.getBooleanAttr("show-more-busy", false);
  }

  get countingLabel() {
    return this.getAttribute("counting-label") || this.sfWord("counting-label");
  }

  get pageSize() {
    const parsed = Math.trunc(this.getNumberAttr("page-size", 10));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  }

  set pageSize(value) {
    this.setAttribute("page-size", String(Math.trunc(Number(value)) || 10));
  }

  get pageCount() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pageSizes() {
    return parsePageSizes(this.getAttribute("page-sizes"), [10, 20, 30, 40]);
  }

  get showPageSize() {
    return this.getBooleanAttr("show-page-size", true);
  }

  get pageSizeLabel() {
    return this.getAttribute("page-size-label") || this.sfWord("page-size-label");
  }

  get showActions() {
    return this.getBooleanAttr("show-actions", true);
  }

  get actions() {
    return parseActions(this.getAttribute("actions"), []);
  }

  // No action until one is chosen. This used to fall through to the first
  // enabled action in the list, which made Apply pressable the moment a row was
  // marked — and the first action in a host's list is as likely to be "delete
  // for ever" as anything else. A host that does want a starting action says so
  // with the attribute or by marking one selected.
  get action() {
    const attrValue = this.getAttribute("action") || "";
    if (attrValue) {
      return attrValue;
    }

    return this.actions.find((item) => item.selected && !item.disabled)?.value || "";
  }

  get actionApplyText() {
    return this.getAttribute("action-apply-text") || this.sfWord("action-apply-text");
  }

  get showActionForAll() {
    return this.getBooleanAttr("show-action-for-all", false);
  }

  get actionForAll() {
    return this.getBooleanAttr("action-for-all", false);
  }

  get actionForAllLabel() {
    return this.getAttribute("action-for-all-label") || this.sfWord("action-for-all-label");
  }

  get actionsLabel() {
    return this.getAttribute("actions-label") || this.sfWord("actions-label");
  }

  // The labels are read through getters, like every other word this component
  // shows: the template context is built from `this.<name>`, so a declared prop
  // without a getter reaches the template as undefined. The first attempt at
  // the panel left the list's placeholder empty for exactly that reason.
  get actionChooseLabel() {
    return this.getAttribute("action-choose-label") || this.sfWord("action-choose-label");
  }

  get actionsRegionLabel() {
    return this.getAttribute("actions-region-label") || this.sfWord("actions-region-label");
  }

  get clearSelectionLabel() {
    return this.getAttribute("clear-selection-label") || this.sfWord("clear-selection-label");
  }

  // The page being read. It is held inside the page count only when there is a
  // count: without one the count is one page, and that clamp pinned every page
  // to the first — the switcher showed a single place on page three, and
  // nothing else could move.
  get current() {
    const parsed = Math.trunc(this.getNumberAttr("current", 1));
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    const atLeastFirst = Math.max(parsed, 1);

    return this.exactCount ? Math.min(atLeastFirst, this.pageCount) : atLeastFirst;
  }

  // The page as a setting (§4.3): written from outside it is not reported (§8).
  set current(value) {
    this.setAttribute("current", String(Math.trunc(Number(value)) || 1));
  }

  // How many pages there are, when that is known at all. Said out loud rather
  // than reported as one page, so a host is not told a count the view does not
  // have.
  // An estimate gives no page count either: a count derived from «~450» would
  // be reported to the host as fact.
  get knownPageCount() {
    return this.exactCount ? this.pageCount : null;
  }

  // A window of at most five numbers around the page being read, the current one
  // in the middle where there is room for it.
  //
  // The scheme before this one showed 1, 2, a gap and the two pages behind the
  // current one, and the gap jumped into the middle of what it hid. The
  // consumer's owner replaced it on 2026-10-04: the ends are reached by the
  // first and last buttons, any page by the number field, and a window around
  // the current page is what a person actually reads. Pages ahead are shown only
  // when they exist — with a count that is arithmetic, and without one only the
  // next page is known to be there, from `has_next`.
  get pageItems() {
    // Without a count there is no empty-set case to answer: the host has said
    // there are records and whether more follow, and the window is built from
    // the page being read, so the row is the same in both modes.
    if (this.exactCount && this.total === 0) {
      return [];
    }

    const window = 5;
    const current = this.current;
    // The last page a number may name: the last one there is when it is known,
    // and otherwise the next one, which `has_next` says exists.
    // With an estimate, as far as the estimate reaches or the next page.
    const furthest = this.exactCount
      ? this.pageCount
      : this.countKnown
        ? Math.max(this.pageCount, current + (this.hasNextPage ? 1 : 0))
        : current + (this.hasNextPage ? 1 : 0);
    const start = Math.max(1, Math.min(current - 2, furthest - window + 1));
    const end = Math.min(furthest, start + window - 1);

    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => ({
      type: "page",
      value: start + index,
      selected: start + index === current,
      edge: start + index === 1 || start + index === furthest,
    }));
  }

  firstPage() {
    return this.goToPage(1);
  }

  // The field takes any page and is held to what exists: a number outside the
  // range is brought back to it rather than refused, because a person typing 99
  // into a view of twelve pages means the end.
  goToTypedPage(value) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
      return this;
    }
    const furthest = this.exactCount ? this.pageCount : parsed;

    return this.goToPage(Math.min(Math.max(parsed, 1), Math.max(1, furthest)));
  }

  // The field grows with the number being typed. It is done to the element
  // rather than through the state on purpose: a re-render on every keystroke
  // would take the caret with it, which is a defect this component has had.
  fitPageField(input) {
    const field = input?.closest?.(".sf-pagination-page-field");
    if (!field) return this;
    const digits = String(input.value ?? "").replace(/\D/gu, "").length;
    field.style.setProperty("--sf-pagination-page-input--digits", String(Math.max(digits, 1)));

    return this;
  }

  /**
   * One of this pagination's words, in the page's language. An attribute wins
   * over both: a consumer who names a word has named it.
   */
  text(key, attribute) {
    return (attribute && this.getAttribute(attribute)) || this.sfWord(wordKey(key));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      ariaLabel: this.text("ariaLabel", "aria-label"),
      pagesLabel: this.text("pagesLabel", "pages-label"),
      pageLabel: this.text("pageLabel", "page-label"),
      previousLabel: this.text("previousLabel", "previous-label"),
      nextLabel: this.text("nextLabel", "next-label"),
      lastLabel: this.text("lastLabel", "last-label"),
      totalLabel: this.text("totalLabel", "total-label"),
      selectedLabel: this.text("selectedLabel", "selected-label"),
      showMoreText: this.text("showMoreText", "show-more-text"),
      pageSizeLabel: this.text("pageSizeLabel", "page-size-label"),
      actionApplyText: this.text("actionApplyText", "action-apply-text"),
      actionForAllLabel: this.text("actionForAllLabel", "action-for-all-label"),
      actionsLabel: this.text("actionsLabel", "actions-label"),
      actionChooseLabel: this.text("actionChooseLabel", "action-choose-label"),
      actionsRegionLabel: this.text("actionsRegionLabel", "actions-region-label"),
      clearSelectionLabel: this.text("clearSelectionLabel", "clear-selection-label"),
      showCountLabel: this.text("showCountLabel", "show-count-label"),
      countingLabel: this.text("countingLabel", "counting-label"),
      firstLabel: this.text("firstLabel", "first-label"),
      pageFieldLabel: this.text("pageFieldLabel", "page-field-label"),

      rootClass: this.getRootClass(),
      ariaLabel: this.ariaLabel,
      pagesLabel: this.pagesLabel,
      pageLabel: this.pageLabel,
      previousLabel: this.previousLabel,
      nextLabel: this.nextLabel,
      lastLabel: this.lastLabel,
      firstLabel: this.firstLabel,
      pageFieldLabel: this.pageFieldLabel,
      totalLabel: this.totalLabel,
      selectedLabel: this.selectedLabel,
      selectedCount: this.selectedCount,
      showMoreText: this.showMoreText,
      current: this.current,
      total: this.total,
      pageCount: this.knownPageCount,
      hasPrev: this.current > 1,
      hasNext: this.hasNext,
      countKnown: this.countKnown,
      totalExact: this.totalExact,
      shownTotal: this.shownTotal,
      // The last page is a jump to a number: offered when the number is
      // exact, or when the host can count it first. Without a count at all
      // the button asks for one, as it always has.
      canJumpToLast: this.exactCount || this.canCount || !this.countKnown,
      canCount: this.canCount,
      counting: this.counting,
      showCountLabel: this.showCountLabel,
      countingLabel: this.countingLabel,
      showMoreBusy: this.showMoreBusy,
      pageItems: this.pageItems,
      pageSize: this.pageSize,
      pageSizes: this.pageSizes,
      showPageSize: this.showPageSize,
      pageSizeLabel: this.pageSizeLabel,
      showActions: this.showActions,
      actions: this.actions,
      action: this.action,
      actionApplyText: this.actionApplyText,
      showActionForAll: this.showActionForAll,
      actionForAll: this.actionForAll,
      actionForAllLabel: this.actionForAllLabel,
      actionsLabel: this.actionsLabel,
      actionChooseLabel: this.actionChooseLabel,
      actionsRegionLabel: this.actionsRegionLabel,
      clearSelectionLabel: this.clearSelectionLabel,
    });
  }

  template() {
    return renderPaginationTemplate(this.templateContext());
  }

  getTopSection() {
    return this.querySelector(".sf-pagination-top");
  }

  getMainSection() {
    return this.querySelector(".sf-pagination-main");
  }

  getBottomSection() {
    return this.querySelector(".sf-pagination-bottom");
  }

  // The action go-to-page {page} (§4.4): answers an outcome. A page the person
  // asked for (a number, an arrow, the field) or a host finishing what a
  // person started (the last page once the count arrives) is reported as
  // sf-pagination-change.
  goToPage(page) {
    if (this.exactCount && this.total === 0) {
      return { outcome: "refused", reason: "empty" };
    }

    const parsed = Number.parseInt(String(page?.page ?? page ?? ""), 10);
    if (!Number.isFinite(parsed)) {
      return { outcome: "refused", reason: "invalid" };
    }

    const previous = this.current;
    // With no count there is no last page to clamp against. The host answers a
    // page that has run out with no records, which is honest; clamping to a
    // page count derived from nothing would not be.
    const next = this.exactCount
      ? Math.min(Math.max(parsed, 1), this.pageCount)
      : Math.max(parsed, 1);

    if (next === previous) {
      return { outcome: "refused", reason: "current" };
    }

    this.setState({ current: next });

    this.sfEmit("change", {
      previous,
      current: next,
      total: this.total,
      "page-count": this.knownPageCount,
      "page-size": this.pageSize,
    });

    return { outcome: "applied" };
  }

  // The last page needs a number, and without a count nobody has one yet. So
  // the number is asked for, and the jump happens when it arrives — which is
  // why the request carries the reason. Counting on every answer instead is
  // exactly what this mode exists to avoid.
  // An estimate is no number to jump to either: the jump waits for the count.
  lastPage() {
    if (!this.exactCount) {
      return this.requestCount("last-page");
    }

    return this.goToPage(this.pageCount);
  }

  // Asked when there is no number, or only an estimate of it.
  requestCount(reason = "total") {
    if (this.exactCount || !this.canCount || this.counting) {
      return this;
    }

    this.setState({ counting: true });
    this.sfEmit("count", {
      reason,
      current: this.current,
      "page-size": this.pageSize,
    });

    return this;
  }

  // The panel's cross drops the selection. The pagination does not hold it —
  // the rows do — so this is an announcement, not a mutation, and the view
  // passes it to the table.
  clearSelection() {
    this.sfEmit("selection-clear", {
      "selected-count": this.selectedCount,
      total: this.total,
    });

    return this;
  }

  // The action show-more (§4.4), vocabulary §5 load-more {direction: after}.
  // The button the person pressed was `item`; it is no data (§8), so only
  // the old name sf-show-more still carries it.
  showMore(item = null) {
    this._showMoreItem = item;
    try {
      this.sfEmit("load-more", {
        direction: "after",
        current: this.current,
        total: this.total,
        "page-size": this.pageSize,
        "page-count": this.knownPageCount,
        "has-next": this.hasNext,
      });
    } finally {
      this._showMoreItem = null;
    }

    return { outcome: "applied" };
  }

  setPageSize(size) {
    const parsed = Math.trunc(Number(size));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return this;
    }

    const previous = this.pageSize;
    if (parsed === previous) {
      return this;
    }

    const pageCount = Math.max(1, Math.ceil(this.total / parsed));
    const current = this.exactCount ? Math.min(this.current, pageCount) : this.current;

    this.setState({
      pageSize: parsed,
      current,
    });

    this.sfEmit("size-change", {
      previous,
      "page-size": parsed,
      current,
      total: this.total,
      "page-count": this.exactCount ? pageCount : null,
    });

    return this;
  }

  setAction(action) {
    const previous = this.action;
    const value = String(action || "").trim();
    // An empty value is the choice at the top of the list, so it has to be able
    // to put the chooser back where it started and take Apply out of reach
    // again; before, it was ignored and a chosen action could not be undone.
    if (value === previous) {
      return this;
    }

    this.setState({ action: value });
    this.sfEmit("action-change", {
      previous,
      action: value,
    });

    return this;
  }

  setActionForAll(value) {
    const previous = this.actionForAll;
    const next = Boolean(value);
    if (next === previous) {
      return this;
    }

    this.setState({ actionForAll: next });
    this.sfEmit("action-for-all-change", {
      previous,
      "action-for-all": next,
    });
    // An action under the filter is applied against a confirmed total, so
    // marking the box is the moment the number is needed. Asking for it here
    // and not at Apply means the person sees what they are about to touch
    // before they press anything.
    if (next) {
      this.requestCount("action-for-all");
    }

    return this;
  }

  applyAction() {
    if (!this.action) {
      return this;
    }

    // vocabulary §5 apply: the scope is the marked rows, or everything under
    // the filter when «for all» is on.
    this.sfEmit("apply", {
      action: this.action,
      scope: this.actionForAll ? "filter" : "selection",
      current: this.current,
      total: this.total,
      "page-size": this.pageSize,
      "page-count": this.knownPageCount,
    });

    return this;
  }

  get state() {
    return {
      topClass: this.topClass,
      mainClass: this.mainClass,
      bottomClass: this.bottomClass,
      top: this.top,
      middle: this.middle,
      bottom: this.bottom,
      rootClass: this.getRootClass(),
      ariaLabel: this.ariaLabel,
      pagesLabel: this.pagesLabel,
      pageLabel: this.pageLabel,
      previousLabel: this.previousLabel,
      nextLabel: this.nextLabel,
      lastLabel: this.lastLabel,
      totalLabel: this.totalLabel,
      selectedLabel: this.selectedLabel,
      selectedCount: this.selectedCount,
      showMoreText: this.showMoreText,
      current: this.current,
      total: this.total,
      totalExact: this.totalExact,
      pageCount: this.knownPageCount,
      pageSize: this.pageSize,
      pageSizes: this.pageSizes,
      showPageSize: this.showPageSize,
      pageSizeLabel: this.pageSizeLabel,
      showActions: this.showActions,
      actions: this.actions,
      action: this.action,
      actionApplyText: this.actionApplyText,
      showActionForAll: this.showActionForAll,
      actionForAll: this.actionForAll,
      actionForAllLabel: this.actionForAllLabel,
      actionsLabel: this.actionsLabel,
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      // Off for a boolean that is on by default is written, not removed:
      // without the attribute it reads as on again. sf-data-view sends
      // countKnown and totalExact false this way.
      if (value === false && DEFAULT_ON.has(attr)) {
        this.setAttribute(attr, "false");
        return;
      }

      if (
        value === false ||
        value === null ||
        value === undefined ||
        value === ""
      ) {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, "");
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }

  // The old names keep their old detail (§16.20 split rows): the element, its
  // template and the camelCase fields were in it.
  sfAliasAdapters() {
    const old = (detail) => ({
      component: this,
      tagName: this.componentTagName,
      template: this.componentTemplateName,
      ...camelDetail(detail),
    });
    return {
      "sf-page-change": old,
      "sf-page-size-change": old,
      "sf-count-request": old,
      "sf-selection-clear": old,
      "sf-action-change": old,
      "sf-action-for-all-change": old,
      "sf-action-apply": (detail) => ({ ...old(detail), actionForAll: detail.scope === "filter" }),
      "sf-show-more": (detail) => ({ ...old(detail), item: this._showMoreItem ?? null }),
    };
  }

  onPageChange(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener(
        this.sfEventName("change"),
        // The new detail, with the camelCase names a handler of the old one
        // read (pageSize, pageCount) beside the vocabulary's.
        (event) => {
          handler(event.detail?.current, { ...camelDetail(event.detail ?? {}), ...event.detail }, event);
        },
        options,
      );
    }

    return this;
  }

  onShowMore(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener(
        this.sfEventName("load-more"),
        (event) => {
          handler({ ...camelDetail(event.detail ?? {}), ...event.detail }, event);
        },
        options,
      );
    }

    return this;
  }
}

SfPagination.define("sf-pagination");
