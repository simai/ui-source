import { html, nothing, render } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { noteDeprecated } from "../../core/js/deprecations";
import { instancePath, partId } from "../../core/js/instance-path";
import { renderModalTemplate } from "./js/templates/default";
import { trapModalFocus } from "../../component/modal/js/_focus";
import { freezeModalContent } from "../../component/modal/js/_closing";
import { scheduleModalClose, scheduleModalFrame } from "../../component/modal/js/_motion";
import { lockModalScroll, unlockModalScroll } from "../../component/modal/js/_scroll";
import { createInlineSpinner } from "../../component/spinner/js/_spinner-draw";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// A box that holds its own overlays (sf-modal, sf-drawer); the drawer's own
// name came first and is read until the change journal retires it.
const OVERLAY_CONTAINER = "[data-sf-overlay-container], [data-sf-drawer-container]";
import { getTopModalLayer, getModalLayerIndex, updateModalLayers, addModalLayer,
  removeModalLayer, raiseModalLayer, captureModalFocusAncestors, restoreModalLayerFocus,
  isTopModalLayer } from "../../component/modal/js/_stack";
import { carryLayerOrigin, layerZIndexAt } from "../../core/js/layer-stack";

// sf-modal from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8, §19): the settings are attributes and properties made by
// core/js/element-manifest.js, the words are lang/<locale>.json (the header's
// two actions, the untitled window's name and the loading state speak the
// page's language), and the old names -- title, blur, hide, unclose, the
// modal:* events, hide() and show() -- are dated aliases in aliases.json.
const ModalElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});

// The public variables the manifest declares; a window drawn at the end of the
// body carries their values from where its host stands (§19.1).
const MODAL_VARIABLES = Object.keys(manifest["css-variables"] || {});

// What retires without a new name (aliases.json rows with `to: null`): kept
// until the date, and each use is noted with it.
function noteRetired(kind, from) {
  noteDeprecated({ component: "sf-modal", tag: "sf-modal", kind, from, to: null,
    since: aliases.since, remove_after: aliases.remove_after });
}

// A lifecycle copy (modal:ready, modal:update) is still sent until its date; a
// listener that reads it is a use (§4.1, §16.13).
function retiredEvent(type, detail) {
  const event = new CustomEvent(type, { bubbles: true, composed: true, detail });
  let used = false;
  Object.defineProperty(event, "detail", {
    configurable: true,
    get() {
      if (!used) { used = true; noteRetired("event", type); }
      return detail;
    },
  });
  return event;
}

const OLD_EVENT_NAMES = {
  "modal:before-open": "open", "modal:after-open": "opened",
  "modal:before-close": "close", "modal:after-close": "closed",
  "modal:before-hide": "minimize", "modal:after-hide": "minimized",
  "modal:before-show": "expand", "modal:after-show": "expanded",
  "modal:before-content-upload": "content-upload",
  "modal:after-content-upload": "content-uploaded",
};

const applied = () => ({ outcome: "applied" });
const refused = (reason) => ({ outcome: "refused", reason });

function isBlurTypeValue(value) {
  return ["none", "small", "medium", "large"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

class SfModal extends ModalElement {
  static registry = new Map();
  static globalBound = false;
  static stack = [];
  static openCount = 0;
  static lockState = null;
  // Kept for code that reads it: the z-index comes from the one layer scale of
  // the core now (--sf-z-index-layer, whose default is this same 9000).
  static baseZIndex = 9000;

  static defaultTrueAttributes = new Set([
    "overlay",
    "show-close",
    "show-footer",
    "close-on-esc",
    "close-on-overlay",
    "preserve-scroll-gap",
    "preload",
    "dismissible",
  ]);

  static getTopModal() {
    return getTopModalLayer();
  }

  // Whether this modal is the top layer of the document: a drawer or a list
  // opened from it stands above it and takes the keys while it does.
  static isTopModal(modal) {
    return isTopModalLayer(modal);
  }

  static getStackIndex(modal) {
    return getModalLayerIndex(modal);
  }

  static addToStack(modal) {
    if (!modal || modal.display === "inline") {
      return;
    }

    SfModal.stack = SfModal.stack.filter((item) => item !== modal);
    SfModal.stack.push(modal);
    SfModal.openCount = SfModal.stack.length;

    // Keep the open-instance registry, but only visible dialogs own page focus
    // and the document scroll lock.
    if (!modal.hiddenState) {
      addModalLayer(modal, SfModal);
    }
  }

  static removeFromStack(modal) {
    if (!modal || modal.display === "inline") {
      return;
    }

    SfModal.stack = SfModal.stack.filter((item) => item !== modal);
    SfModal.openCount = SfModal.stack.length;

    removeModalLayer(modal);
  }

  static bringToFront(modal) {
    if (
      !modal ||
      modal.display === "inline" ||
      !SfModal.stack.includes(modal)
    ) {
      return;
    }

    SfModal.stack = SfModal.stack.filter((item) => item !== modal);
    SfModal.stack.push(modal);
    raiseModalLayer(modal);
  }

  static updateStackStyles() {
    updateModalLayers();
  }

  // The manifest's settings, and the base's own template name.
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: "template", default: "default" },
      rootClass: { default: "" },
    };
  }

  constructor() {
    super();
    this._modalId = "";
    this._syncingOpenAttribute = false;
    this._portalRoot = null;
    this._renderTarget = null;
    this._hostClearedForPortal = false;
    this._slotEventHandlers = new Map();
    this._slotEventId = 0;
    this._readyDetail = null;
    this._hasEmittedReady = false;
    this._hasAutoloaded = false;
    this._isOpen = false;
    this._isHidden = false;
    this._modalState = "closed";
    this._animatePanel = false;
    this._stackIndex = -1;
    this._closeTimer = null;
    this._closeTransitionAbort = null;
    this._lastActive = null;
    this._fetchController = null;
    this._remoteHtml = "";
    this._remoteError = "";
    this._isLoadingRemote = false;
    this._remoteLoaded = false;
    this._asks = [];
    this._answer = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);
    this.handleHideClick = this.handleHideClick.bind(this);
  }

  connectedCallback() {
    if (!this._modalId) {
      // A window without modal-id or id takes its path id (§7.1.1): sf-modal-<n>
      // in document order, not a module counter (simai/ui-source#41).
      this._modalId =
        this.getAttribute("modal-id") || this.id || partId(instancePath(this));
    }

    super.connectedCallback();
    SfModal.registry.set(this.modalId, this);
    SfModal.bindGlobalEvents();
  }

  // The old modal:* names keep their old detail (§16.20 split rows): the new
  // names carry data only (§8), the old ones also the element and its window.
  sfAliasAdapters() {
    const add = (detail) => ({ ...detail, component: this, modal: this, root: this._root() });
    return Object.fromEntries(Object.keys(OLD_EVENT_NAMES).map((name) => [name, add]));
  }

  // What the author writes inside <sf-modal> without a slot is the window's
  // content, after anything slotted as content -- as sf-drawer takes it. It
  // used to be dropped without a word: an unslotted paragraph gave an empty
  // window (owner, 2026-10-18).
  captureSlotTemplates() {
    const first = !this._slotTemplatesCaptured;
    super.captureSlotTemplates();
    if (!first) return;
    const loose = Array.from(this.childNodes).filter((node) =>
      node.nodeType === Node.ELEMENT_NODE
        ? node.tagName.toLowerCase() !== "template"
        : node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "");
    if (!loose.length) return;
    if (!this._liveSlotNodes.has("content")) this._liveSlotNodes.set("content", []);
    this._liveSlotNodes.get("content").push(...loose);
    loose.forEach((node) => node.remove());
  }

  disconnectedCallback() {
    this.teardownModal();
    SfModal.registry.delete(this.modalId);
    super.disconnectedCallback();
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  get modalId() {
    return this.getAttribute("modal-id") || this._modalId || this.id || "";
  }

  // An inline window stands in the page's flow, so it is shown without
  // `open` until close() puts it away; it needed the attribute to show at all,
  // while the script Modal opens an inline one by itself (owner, 2026-10-18).
  get openState() {
    return this._isOpen || this.hasAttribute("open") ||
      (this.display === "inline" && !this._inlineClosed);
  }

  // dismissible=false turns off Escape and the overlay (§19.3); `unclose` is
  // its old, inverted name, read until its date.
  get dismissible() {
    if (this.hasAttribute("unclose") && this.getAttribute("unclose") !== "false") {
      noteDeprecated({ component: "sf-modal", tag: "sf-modal", kind: "attribute", attribute: "unclose",
        from: "unclose", to: "dismissible", since: aliases.since, remove_after: aliases.remove_after });
      return false;
    }
    return this.getBooleanAttr("dismissible", true);
  }

  set dismissible(value) {
    if (value === false) this.setAttribute("dismissible", "false");
    else this.removeAttribute("dismissible");
  }

  get unclose() {
    return !this.dismissible;
  }

  get hiddenState() {
    return this.display !== "inline" && (this._isHidden || this.hasAttribute("minimized"));
  }

  // The value minimized (§4): the window is open but out of the visible stack.
  // The attribute's presence says so, whatever it holds, as the template reads.
  get minimized() {
    return this.hiddenState;
  }

  set minimized(value) {
    this.toggleAttribute("minimized", Boolean(value));
  }

  get showClose() {
    const showClose = this.getBooleanAttr("show-close", true);
    return showClose && this.dismissible;
  }

  // backdrop-blur="small" turns the blur on and names its type;
  // backdrop-blur="false" turns it off. Its old name is `blur`, a method of
  // every element (§3.1), mapped by the alias table.
  get hasBackdropBlur() {
    const value = this.getAttribute("backdrop-blur");
    return isBlurTypeValue(value) || this.getBooleanAttr("backdrop-blur", false);
  }

  get blurType() {
    const blurValue = this.getAttribute("backdrop-blur");
    const value =
      this.getAttribute("blur-type") ||
      (isBlurTypeValue(blurValue) ? blurValue : "medium");
    return this.normalizeEnum(
      value,
      ["none", "small", "medium", "large"],
      "medium",
    );
  }

  get hasCustomBlurType() {
    return (
      this.hasAttribute("blur-type") ||
      isBlurTypeValue(this.getAttribute("backdrop-blur"))
    );
  }

  // The rendered window: the component's own, not a reader of the interface.
  _root() {
    return this._renderTarget?.querySelector?.(".sf-modal") || null;
  }

  get modalRoot() {
    return this._root();
  }

  get state() {
    return {
      modalId: this.modalId,
      heading: this.heading,
      ariaLabel: this.getAttribute("aria-label") || "",
      text: this.text,
      open: this.openState,
      autoload: this.autoload,
      dismissible: this.dismissible,
      unsaved: this.unsaved,
      minimizable: this.minimizable,
      hideModifier: this.hideModifier,
      minimized: this.hiddenState,
      overlay: this.overlay,
      showHeader: this.showHeader,
      showClose: this.showClose,
      showFooter: this.showFooter,
      closeOnEsc: this.closeOnEsc,
      closeOnOverlay: this.closeOnOverlay,
      preserveScrollGap: this.preserveScrollGap,
      position: this.position,
      mode: this.mode,
      display: this.display,
      src: this.src,
      preload: this.preload,
      fullscreen: this.fullscreen,
      width: this.width,
      height: this.height,
      backdropBlur: this.hasBackdropBlur,
      blurType: this.blurType,
      overlayPreset: this.overlayPreset,
      overlayClass: this.overlayClass,
      closeClass: this.closeClass,
      surfaceClass: this.surfaceClass,
      surfacePadding: this.surfacePadding,
      panelClass: this.panelClass,
      headerClass: this.headerClass,
      bodyClass: this.bodyClass,
      contentClass: this.contentClass,
      footerClass: this.footerClass,
      lifecycle: this.renderModalState,
      remote: {
        error: this._remoteError,
        status: this._isLoadingRemote
          ? "loading"
          : this._remoteError
            ? "error"
            : this._remoteLoaded
              ? "success"
              : "idle",
      },
      stackIndex: this._stackIndex,
    };
  }

  get renderOpenState() {
    return this.openState || this._modalState === "closing";
  }

  get renderModalState() {
    if (this.display === "inline") {
      return this.openState ? "open" : "closed";
    }

    if (this.renderOpenState && this._modalState === "closed") {
      return "open";
    }

    return this._modalState;
  }

  get modalZIndex() {
    if (this.display === "inline" || this._stackIndex < 0) {
      return "";
    }

    return layerZIndexAt(this._stackIndex);
  }

  get remoteContent() {
    if (this.mode === "iframe" && this.src) {
      return html`
        <iframe
          class="sf-modal-iframe w-full border-0 radius-surface"
          src=${this.src}
          data-sf-modal-iframe
          allowfullscreen
          style="min-height:var(--sf-modal-iframe-min-height);height:100%;"
          @load=${this.handleIframeLoad}
          @error=${this.handleIframeError}
        ></iframe>
      `;
    }

    if (this._remoteError) {
      return html`
        <div
          class="sf-modal-error flex flex-col gap-2 items-cross-center content-main-center p-4"
          data-sf-modal-state="error"
        >
          <div class="sf-modal-error-icon text-4 color-error">!</div>
          <p class="sf-modal-error-text m-0 text-2 color-error">
            ${this._remoteError}
          </p>
        </div>
      `;
    }

    if (this._remoteHtml) {
      return html`<div class="sf-modal-content flex flex-col gap-2">
        ${unsafeHTML(this._remoteHtml)}
      </div>`;
    }

    if (this._isLoadingRemote) {
      // The Framework's one spinner, in the page's look (simai/ui-source#11),
      // kept across renders so its motion does not restart; the modal sheet
      // draws its slot. The words are the page's language's, and the state
      // is a status region named by them, so it is announced, not only seen.
      const loading = this.sfWord("loading");
      return html`
        <div
          class="sf-modal-loading flex flex-col gap-2 items-cross-center content-main-center p-4"
          data-sf-modal-state="loading"
          role="status"
          aria-label=${loading}
        >
          ${this._loadingSpinnerNode()}
          <p class="m-0 text-2 color-on-surface-variant">${loading}</p>
        </div>
      `;
    }

    return nothing;
  }

  _loadingSpinnerNode() {
    if (!this._loadingSpinner) {
      this._loadingSpinner = createInlineSpinner({ className: "sf-modal-spinner" });
    }
    return this._loadingSpinner;
  }

  templateContext() {
    this._slotEventHandlers.clear();
    this._slotEventId = 0;
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      closeText: this.sfWord("close"),
      minimizeText: this.sfWord("minimize"),
      // The heading, or the page language's word for an untitled window.
      title: this.heading,
      ariaLabel: this.getAttribute("aria-label") || "",
      modalId: this.modalId,
      // The ids the template writes are the path's (§7.1.1), not the modal id's.
      titleId: partId(instancePath(this), "title"),
      // The window's root takes the modal id only when the element does not
      // already hold it: <sf-modal id="x"> gave the page two elements with id x
      // (simai/ui-source#42).
      rootId: this.id === this.modalId ? "" : this.modalId,
      open: this.renderOpenState,
      modalState: this.renderModalState,
      animate: this._animatePanel && this.display !== "inline",
      modalZIndex: this.modalZIndex,
      hide: this.minimizable,
      minimized: this.hiddenState,
      showClose: this.showClose,
      blur: this.hasBackdropBlur,
      blurType: this.blurType,
      hasCustomBlurType: this.hasCustomBlurType,
      hasHeaderContent: this.hasSlotContent("header"),
      hasContentContent: this.hasSlotContent("content"),
      hasFooterContent: this.hasSlotContent("footer"),
      // The page's own nodes, placed and not copied (standard 1.3.8 §4.5): a
      // listener, a property and the node itself survive opening and closing
      // (simai/ui-source#42). They used to be serialised through outerHTML.
      headerContent: this.slotNodes("header"),
      contentContent: this.slotNodes("content"),
      footerContent: this.slotNodes("footer"),
      remoteContent: this.remoteContent,
      onCloseClick: this.handleCloseClick,
      onHideClick: this.handleHideClick,
    });
  }

  // What a slot shows: the page's live nodes, then the content of a
  // <template slot> stamped once and kept, so a redraw does not replace it.
  slotNodes(name) {
    const live = this._liveSlotNodes.get(name) || [];
    const templates = this._slotTemplates.get(name) || [];
    if (!templates.length) return live;
    this._stampedSlots ??= new WeakMap();
    if (!this._stampedSlots.has(templates)) {
      this._stampedSlots.set(templates, templates.map((node) => node.cloneNode(true)));
    }
    return [...live, ...this._stampedSlots.get(templates)];
  }

  // The page's nodes go back into the element when it leaves the page, so
  // they travel with it and are placed again when it returns.
  returnSlotNodes() {
    for (const nodes of this._liveSlotNodes.values()) {
      for (const node of nodes) {
        if (node.parentNode !== this) this.append(node);
      }
    }
  }

  // The HTML of a slot's content, for reading. Drawing does not use it: the
  // window places the nodes themselves. A reader retires (§4.4, §16.13): kept
  // until its date, each call noted.
  getSlotHtml(name) {
    noteRetired("action", "getSlotHtml");
    const slotContent = [
      ...(this._liveSlotNodes.get(name) || []),
      ...(this._slotTemplates.get(name) || []),
    ];
    return slotContent
      .map((node) => {
        if (node instanceof HTMLElement) {
          const clone = node.cloneNode(true);
          this.copyRuntimeData(node, clone);
          this.assignSlotEventIds(clone);
          this.cleanNestedSmartComponentRender(clone);
          return clone.outerHTML;
        }

        return node.textContent || "";
      })
      .join("");
  }

  assignSlotEventIds(root) {
    const nodes = [root, ...Array.from(root.querySelectorAll?.("*") || [])];

    nodes.forEach((node) => {
      if (!node.__sfCreateEventHandlers?.length) {
        return;
      }

      const id = `sf-modal-slot-event-${++this._slotEventId}`;
      node.setAttribute("data-sf-runtime-event-id", id);
      this._slotEventHandlers.set(id, node.__sfCreateEventHandlers.slice());
    });
  }

  cleanNestedSmartComponentRender(root) {
    const nodes = [root, ...Array.from(root.querySelectorAll?.("*") || [])];

    nodes.forEach((node) => {
      const tagName = node.tagName?.toLowerCase?.() || "";
      if (!tagName.startsWith("sf-")) {
        return;
      }

      Array.from(node.childNodes).forEach((child) => {
        if (
          child instanceof HTMLElement &&
          (child.hasAttribute("slot") ||
            child.tagName.toLowerCase() === "slot" ||
            child.tagName.toLowerCase().startsWith("sf-"))
        ) {
          return;
        }

        child.remove();
      });
    });
  }

  template() {
    return renderModalTemplate(this.templateContext());
  }

  async renderComponent(changedAttributes = []) {
    const renderToken = ++this._renderToken;

    if (!this._isMounted) {
      return;
    }

    this.beforeRender(changedAttributes);
    this.emitComponentEvent("before-render", { changedAttributes });
    this.runExternalHook("beforeRender", {
      changedAttributes,
      root: this,
    });

    const templateResult = await this.resolveTemplateResult(changedAttributes);

    if (!this._isMounted || renderToken !== this._renderToken) {
      return;
    }

    render(templateResult, this.resolveRenderTarget());
    this.afterRender(changedAttributes);
    this.runExternalHook("afterRender", {
      changedAttributes,
      root: this,
    });
    this.emitComponentEvent("after-render", { changedAttributes });
  }

  resolveRenderTarget() {
    if (this.display === "inline") {
      this.clearPortal();
      this._hostClearedForPortal = false;
      this._renderTarget = this;
      return this;
    }

    if (!this._hostClearedForPortal) {
      render(nothing, this);
      this._hostClearedForPortal = true;
    }

    if (!this._portalRoot) {
      this._portalRoot = this.resolvePortalRoot();
    }

    this.dedupePortalRoots();
    // The portal stands at the end of the body; it speaks and looks as the
    // element does where it stands (standard 1.3.8 §19.1): lang, dir and the
    // theme of its area, and the values of the public variables its manifest
    // declares, by name: a prefix would also carry what an outer window sets
    // on its own panel (--sf-modal-width) into a window opened from it.
    carryLayerOrigin(this._portalRoot, this, { variables: MODAL_VARIABLES });
    this._renderTarget = this._portalRoot;
    return this._portalRoot;
  }

  // The box the modal is rendered into: the end of the body, above the page --
  // or, when the modal stands inside a [data-sf-overlay-container], the end of
  // that box, which then frames its backdrop and surface (contain: layout makes
  // it their containing block) and whose page is not locked: a documentation
  // example or an editor pane holds its own modal (DEV, 2026-10-18).
  get overlayHome() {
    return this.closest(OVERLAY_CONTAINER) || document.body;
  }

  get inContainer() {
    return this.overlayHome !== document.body;
  }

  resolvePortalRoot() {
    const home = this.overlayHome;
    const existingPortal = home.querySelector(
      `[data-sf-modal-portal="${this.modalId}"]`,
    );

    if (existingPortal) {
      return existingPortal;
    }

    const portal = document.createElement("div");
    portal.setAttribute("data-sf-modal-portal", this.modalId);
    home.append(portal);
    return portal;
  }

  dedupePortalRoots() {
    const portals = Array.from(
      document.querySelectorAll(
        `[data-sf-modal-portal="${this.modalId}"]`,
      ),
    );

    portals.forEach((portal) => {
      if (portal === this._portalRoot) {
        return;
      }

      render(nothing, portal);
      portal.remove();
    });

    if (!this._portalRoot.isConnected) {
      this._portalRoot.setAttribute("data-sf-modal-portal", this.modalId);
      this.overlayHome.append(this._portalRoot);
    }
  }

  applyStackPosition(index = SfModal.getStackIndex(this)) {
    this._stackIndex = index;

    const root = this._root();
    if (!root || this.display === "inline") {
      return this;
    }

    if (index < 0) {
      root.style.removeProperty("z-index");
      root.style.removeProperty("--sf-modal-stack-index");
      return this;
    }

    root.style.setProperty("--sf-modal-stack-index", String(index));
    root.style.zIndex = String(this.modalZIndex);
    return this;
  }

  // Opens the window, or raises an open one to the top. Answers an outcome
  // (§4.4): refused when a listener prevents sf-modal-open. Asked by an
  // assembly -- a call that hands a signal -- it answers when the window
  // closes, with the person's answer {accepted, reason, value} (§19.4).
  open(options = {}, { signal } = {}) {
    const { animate = true } =
      typeof options === "boolean" ? { animate: options } : (options || {});
    const wasClosing = this._modalState === "closing";
    const asked = Boolean(signal);

    if ((this._isOpen || (this.display === "inline" && this.openState)) && !wasClosing) {
      this.cancelCloseTransition();
      SfModal.bringToFront(this);
      return asked ? this.waitForAnswer(signal) : applied();
    }

    if (!this.emitModalEvent("open", { cancelable: true, phase: "before-open" })) {
      return refused("prevented");
    }

    if (!wasClosing) {
      this._lastActive = document.activeElement;
      this._focusReturnAncestors = captureModalFocusAncestors(this._lastActive);
    }
    if (wasClosing) {
      this.cancelCloseTransition();
      this._releaseClosingContent?.();
      this._releaseClosingContent = null;
    }

    this._isOpen = true;
    this._closeReason = "";
    this._answer = null;
    this._inlineClosed = false;
    this._animatePanel = Boolean(animate);
    this._modalState =
      animate && this.display !== "inline" ? "opening" : "open";
    this.syncOpenAttribute(true);

    if (this.display !== "inline" && !wasClosing) {
      SfModal.addToStack(this);
    } else if (this.display !== "inline") {
      SfModal.bringToFront(this);
    }

    this.requestComponentUpdate("open");

    scheduleModalFrame(() => {
      if (!this._isOpen || this._modalState === "closing") {
        return;
      }

      this._modalState = "open";
      const projected = new Promise((resolve) => {
        const onUpdated = (event) => {
          if (!event.detail?.changedAttributes?.includes("open-state")) {
            return;
          }
          this.removeEventListener("sf-updated", onUpdated);
          resolve();
        };
        this.addEventListener("sf-updated", onUpdated);
      });
      this.requestComponentUpdate("open-state");
      void projected.then(() => {
        if (!this._isOpen || this._modalState !== "open") {
          return;
        }
        this.focusFirst();
        this.emitModalEvent("opened", { phase: "after-open" });
        this.loadRemoteContentIfNeeded();
      });
    });

    return asked ? this.waitForAnswer(signal) : applied();
  }

  // The person's answer to an assembly's ask (§19.4), when the window closes:
  // {accepted, reason, value}. A scope that ends first answers cancelled.
  waitForAnswer(signal) {
    return new Promise((resolve) => {
      const ask = { resolve };
      this._asks.push(ask);
      signal?.addEventListener?.("abort", () => {
        this._asks = this._asks.filter((one) => one !== ask);
        resolve({ outcome: "cancelled" });
      }, { once: true });
    });
  }

  settleAsks(reason) {
    const value = {
      accepted: Boolean(this._answer?.accepted),
      reason,
      value: this._answer?.value ?? null,
    };
    const asks = this._asks;
    this._asks = [];
    for (const ask of asks) ask.resolve({ outcome: "applied", value });
  }

  // options.reason says why (standard 1.3.8 §19.3): close (its own close
  // control), escape, outside (the overlay), cancelled (a page control that
  // closes it) or api, the default. A listener that prevents sf-modal-close
  // keeps it open, and the action answers refused (§8).
  close(options = {}) {
    if (!this.openState || this._modalState === "closing") {
      return refused("closed");
    }

    const reason = typeof options?.reason === "string" ? options.reason : "api";
    if (!this.emitModalEvent("close", {
      cancelable: true, phase: "before-close", reason, unsaved: Boolean(this.unsaved),
    })) {
      this._answer = null;
      return refused("prevented");
    }
    this._closeReason = reason;

    if (this.display === "inline") {
      this.finishClose();
      return applied();
    }

    this._modalState = "closing";
    this._isOpen = false;
    this.requestComponentUpdate("close");

    const panel = this._root()?.querySelector("[data-sf-modal-panel]");
    this._releaseClosingContent = freezeModalContent(panel, SfModal.isTopModal(this));
    this._closeTransitionAbort = scheduleModalClose(
      () => this._root(), () => this.finishClose(),
    );
    return applied();
  }

  // The person accepts: the window closes and an assembly's ask answers
  // {accepted: true, reason: "close", value} (§19.4). A page button reaches it
  // with data-sf-action="<id>.confirm".
  confirm(params = {}) {
    if (!this.openState) return refused("closed");
    this._answer = { accepted: true, value: params?.value ?? null };
    return this.close({ reason: "close" });
  }

  // Minimizes an open window (vocabulary §5 minimize; its old name is hide()).
  minimize() {
    if (!this.openState || this.display === "inline" || this.hiddenState) {
      return refused(this.openState ? "minimized" : "closed");
    }

    if (!this.emitModalEvent("minimize", { cancelable: true, phase: "before-hide" })) {
      return refused("prevented");
    }

    this._isHidden = true;
    this.setAttribute("minimized", "");
    this.requestComponentUpdate("hide");
    this.emitModalEvent("minimized", { phase: "after-hide" });
    return applied();
  }

  // Brings a minimized window back (its old name is show()).
  expand() {
    if (!this.openState || this.display === "inline" || !this.hiddenState) {
      return refused(this.openState ? "expanded" : "closed");
    }

    if (!this.emitModalEvent("expand", { cancelable: true, phase: "before-show" })) {
      return refused("prevented");
    }

    this._isHidden = false;
    this.removeAttribute("minimized");
    this.requestComponentUpdate("show");
    this.emitModalEvent("expanded", { phase: "after-show" });
    return applied();
  }

  syncMinimizedLayer() {
    if (!this._isMounted || !this.openState || this.display === "inline" ||
        this._modalState === "closed" || this._modalState === "closing") {
      return;
    }
    const root = this._root();
    if (this.hiddenState) {
      const wasTop = SfModal.isTopModal(this);
      removeModalLayer(this);
      this.applyStackPosition();
      restoreModalLayerFocus(wasTop, this._lastActive, this._focusReturnAncestors);
      if (root) {
        root.inert = true;
        root.setAttribute("aria-hidden", "true");
      }
    } else {
      if (root) {
        root.inert = false;
        root.setAttribute("aria-hidden", "false");
      }
      addModalLayer(this, SfModal);
      SfModal.bringToFront(this);
      requestAnimationFrame(() => this.focusFirst());
    }
  }

  toggle() {
    return this.openState ? this.close() : this.open();
  }

  finishClose() {
    if (this.display !== "inline" && this._modalState !== "closing") {
      return this;
    }
    const wasTop = SfModal.isTopModal(this);
    this.cancelCloseTransition();
    this._isOpen = false;
    if (this.display === "inline") this._inlineClosed = true;
    this._isHidden = false;
    this._modalState = "closed";
    this.removeAttribute("minimized");
    this.syncOpenAttribute(false);

    const root = this._root();
    if (root) {
      root.inert = true;
      root.setAttribute("aria-hidden", "true");
    }
    this._releaseClosingContent?.();
    this._releaseClosingContent = null;

    if (this.display !== "inline") {
      SfModal.removeFromStack(this);
    }

    if (this.display !== "inline") {
      restoreModalLayerFocus(wasTop, this._lastActive, this._focusReturnAncestors);
    }

    this.requestComponentUpdate("after-close");
    const reason = this._closeReason || "api";
    this.emitModalEvent("closed", { phase: "after-close", reason, accepted: Boolean(this._answer?.accepted) });
    this.settleAsks(reason);
    this._answer = null;
    return this;
  }

  cancelCloseTransition() {
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    if (this._closeTransitionAbort) {
      this._closeTransitionAbort();
      this._closeTransitionAbort = null;
    }
  }

  setSrc(newSrc) {
    this.setAttribute("src", newSrc || "");
    this.resetRemoteContent();
    this.loadRemoteContentIfNeeded();
    return this;
  }

  reloadContent() {
    this.resetRemoteContent();
    this.loadRemoteContentIfNeeded(true);
    return applied();
  }

  // A reader retires (§4.4, §16.13): kept until its date, each call noted.
  getModalRoot() {
    noteRetired("action", "getModalRoot");
    return this._root();
  }

  afterRender() {
    this.bindRenderedEvents();
    this.bindSlotEventHandlers();
    if (this._modalState === "closing") {
      this._releaseClosingContent?.();
      this._releaseClosingContent = freezeModalContent(
        this._root()?.querySelector("[data-sf-modal-panel]"), SfModal.isTopModal(this),
      );
    }

    this._readyDetail = {
      component: this,
      modal: this,
      modalId: this.modalId,
      root: this._root(),
    };

    // Lifecycle copies retire (§4.1, §16.13): sf-after-render is the base's.
    // They are still sent until their date, and a listener that reads one is
    // noted.
    if (!this._hasEmittedReady) {
      this._hasEmittedReady = true;
      this.dispatchEvent(retiredEvent("modal:ready", this._readyDetail));
    } else {
      this.dispatchEvent(retiredEvent("modal:update", this._readyDetail));
    }

    if (this.hasAttribute("open") && !this._isOpen && this._modalState !== "closing") {
      this._isOpen = true;
      this._modalState = "open";
      if (this.display !== "inline") {
        SfModal.addToStack(this);
      }
      this.focusFirst();
      this.loadRemoteContentIfNeeded();
    }

    this.applyStackPosition();
    // Projection can replace the panel while an existing layer remains open.
    updateModalLayers();

    if (this.autoload && !this.openState && !this._hasAutoloaded) {
      this._hasAutoloaded = true;
      requestAnimationFrame(() => this.open({ animate: false }));
    }
  }

  // Escape and Tab reach the window through the document layer stack, and
  // only while it is the top layer (layer-stack.js).
  bindRenderedEvents() {
    const root = this._root();
    if (!root) {
      return;
    }

    root.removeEventListener("click", this.handleOverlayClick);
    root.addEventListener("click", this.handleOverlayClick);
  }

  bindSlotEventHandlers() {
    const root = this._root();
    if (!root || !this._slotEventHandlers.size) {
      return;
    }

    this._slotEventHandlers.forEach((handlers, id) => {
      const node = root.querySelector(`[data-sf-runtime-event-id="${id}"]`);
      if (!node) {
        return;
      }

      handlers.forEach(({ eventName, handler }) => {
        node.addEventListener(eventName, handler);
      });
    });
  }

  handleOverlayClick(event) {
    const isOverlay =
      event.target ===
      this._root()?.querySelector("[data-sf-modal-overlay]");
    // A press outside is the top layer's only.
    if (isOverlay && this.closeOnOverlay && this.dismissible && SfModal.isTopModal(this)) {
      this.close({ reason: "outside" });
    }
  }

  handleCloseClick(event) {
    event.preventDefault();
    if (this.dismissible) {
      this.close({ reason: "close" });
    }
  }

  handleHideClick(event) {
    event.preventDefault();
    this.minimize();
  }

  // The layer stack hands the window Escape and Tab while it is the top layer
  // -- above a drawer it was opened from, below a list or a drawer opened from
  // it. Answers true when it took Escape; the stack then stops the press.
  onKeyDown(event) {
    if ((!this.openState && this._modalState !== "closing") || this.display === "inline") {
      return false;
    }

    if (!SfModal.isTopModal(this)) {
      return false;
    }

    if (this.hiddenState) {
      return false;
    }

    if (event.key === "Escape" && this.closeOnEsc && this.dismissible && this._modalState !== "closing" && !event.defaultPrevented) {
      this.close({ reason: "escape" });
      return true;
    }

    if (event.key === "Tab") {
      this.trapFocus(event);
    }
    return false;
  }

  trapFocus(event) {
    if (!SfModal.isTopModal(this)) {
      return;
    }

    if (this.hiddenState) {
      return;
    }

    const panel = this._root()?.querySelector("[data-sf-modal-panel]");
    trapModalFocus(panel, event);
  }

  focusFirst() {
    if (this.display === "inline") {
      return;
    }
    if (this.display !== "inline" && !SfModal.isTopModal(this)) {
      return;
    }

    if (this.hiddenState) {
      return;
    }

    const panel = this._root()?.querySelector("[data-sf-modal-panel]");
    if (panel) {
      panel.focus();
    }
  }

  resetRemoteContent() {
    this._remoteHtml = "";
    this._remoteError = "";
    this._remoteLoaded = false;
    this._isLoadingRemote = false;
    this.abortRemoteContent();
  }

  abortRemoteContent() {
    if (this._fetchController) {
      this._fetchController.abort();
      this._fetchController = null;
    }
  }

  loadRemoteContentIfNeeded(force = false) {
    if (!this.src || (this.mode !== "ajax" && this.mode !== "iframe")) {
      return;
    }

    if (!this.preload && !this.openState && !force) {
      return;
    }

    if (this.mode === "iframe") {
      this._remoteLoaded = true;
      this.requestComponentUpdate("remote-content");
      return;
    }

    if (this._remoteLoaded && !force) {
      return;
    }

    void this.loadAjaxContent();
  }

  async loadAjaxContent() {
    this.abortRemoteContent();
    this._isLoadingRemote = true;
    this._remoteError = "";
    let aborted = false;
    this.requestComponentUpdate("remote-loading");
    this.emitContentEvent("content-upload");
    const controller = new AbortController();
    this._fetchController = controller;

    try {
      if (this.src.startsWith("#")) {
        const source = document.querySelector(this.src);
        if (!source) {
          throw new Error(`Element not found: ${this.src}`);
        }

        this._remoteHtml = source.innerHTML;
      } else {
        const response = await fetch(this.src, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this._remoteHtml = await response.text();
      }

      this._remoteLoaded = true;
    } catch (error) {
      if (error.name === "AbortError") {
        aborted = true;
      } else {
        this._remoteError = error.message || this.sfWord("load-failed");
      }
    } finally {
      // A load aborted by a newer one leaves the state to it: clearing it here
      // took the loading state down while the newer load was still waiting.
      const superseded = aborted && this._fetchController && this._fetchController !== controller;
      if (!superseded) {
        this._fetchController = null;
        this._isLoadingRemote = false;
        this.requestComponentUpdate("remote-content");
        if (!aborted) {
          this.emitContentEvent("content-uploaded");
        }
      }
    }
  }

  handleIframeLoad = () => {
    this._remoteLoaded = true;
    this.emitContentEvent("content-uploaded");
  };

  handleIframeError = () => {
    this._remoteError = this.sfWord("frame-failed");
    this.requestComponentUpdate("remote-content");
  };

  // The content events are the component's own verbs (lang events.*.label).
  emitContentEvent(verb) {
    this.sfEmit(verb, { modalId: this.modalId, src: this.src, remote: this.state.remote });
  }

  // Sends one of the window's events by its verb (§8): the new name
  // (sf-modal-<verb>) first, then its old modal:* name with the old detail
  // through the alias table. Data only in detail; answers false when a
  // listener refused a cancelable one.
  emitModalEvent(verb, { cancelable = false, ...detail } = {}) {
    return this.sfEmit(verb, { modalId: this.modalId, ...detail }, { cancelable });
  }

  syncOpenAttribute(isOpen) {
    this._syncingOpenAttribute = true;

    if (isOpen) {
      this.setAttribute("open", "");
    } else {
      this.removeAttribute("open");
    }

    this._syncingOpenAttribute = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._syncingOpenAttribute && name === "open") {
      return;
    }

    if (name === "open" && oldValue !== newValue) {
      if (!this._isMounted) {
        super.attributeChangedCallback(name, oldValue, newValue);
        return;
      }

      if (newValue === null) {
        this.close();
        // close() may be a no-op before an asynchronous render is committed.
        // Removing the attribute still invalidates the pending open snapshot.
        this.requestComponentUpdate("open-attribute");
      } else {
        this.open();
      }
      return;
    }

    if (["src", "mode", "preload"].includes(name) && oldValue !== newValue) {
      this.resetRemoteContent();
    }

    if (name === "minimized" && oldValue !== newValue) {
      this._isHidden = newValue !== null;
      this.syncMinimizedLayer();
    }

    super.attributeChangedCallback(name, oldValue, newValue);
  }

  teardownModal() {
    const wasTop = SfModal.isTopModal(this);
    this.abortRemoteContent();
    this.cancelCloseTransition();

    if (this.display !== "inline") {
      SfModal.removeFromStack(this);
    }

    this._isOpen = false;
    this._modalState = "closed";
    this.clearPortal();
    // An inline window draws in the element itself; its nodes are there.
    if (this.display !== "inline") this.returnSlotNodes();
    this._releaseClosingContent?.();
    this._releaseClosingContent = null;
    restoreModalLayerFocus(wasTop, this._lastActive, this._focusReturnAncestors);
  }

  clearPortal() {
    if (!this._portalRoot) {
      return;
    }

    render(nothing, this._portalRoot);
    this._portalRoot.remove();
    this._portalRoot = null;
  }

  // Modal events bubble like the base modal component and sf-drawer; the on*
  // helpers keep their meaning and receive only this modal's own events, by
  // their new names (§8).
  ownModalHandler(handler) {
    return (event) => {
      if (event.target === this) handler.call(this, event);
    };
  }

  onModalEvent(verb, handler, options) {
    if (typeof handler === "function") {
      this.addEventListener(this.sfEventName(verb), this.ownModalHandler(handler), options);
    }
    return this;
  }

  onBeforeOpen(handler, options) { return this.onModalEvent("open", handler, options); }

  onAfterOpen(handler, options) { return this.onModalEvent("opened", handler, options); }

  onBeforeClose(handler, options) { return this.onModalEvent("close", handler, options); }

  onAfterClose(handler, options) { return this.onModalEvent("closed", handler, options); }

  onBeforeHide(handler, options) { return this.onModalEvent("minimize", handler, options); }

  onAfterHide(handler, options) { return this.onModalEvent("minimized", handler, options); }

  onBeforeShow(handler, options) { return this.onModalEvent("expand", handler, options); }

  onAfterShow(handler, options) { return this.onModalEvent("expanded", handler, options); }

  onModalReady(handler, options) {
    if (typeof handler !== "function") {
      return this;
    }

    if (this._readyDetail) {
      handler(retiredEvent("modal:ready", this._readyDetail));
      return this;
    }

    this.addEventListener("modal:ready", this.ownModalHandler(handler), options);
    return this;
  }

  onModalUpdate(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:update", this.ownModalHandler(handler), options);
    }
    return this;
  }

  static bindGlobalEvents() {
    if (SfModal.globalBound || typeof document === "undefined") {
      return;
    }

    // The window's own page triggers, aliases of data-sf-action (§8, §16.10):
    // data-sf-modal-open="<modal id>" is data-sf-action="<id>.open", and so on.
    document.addEventListener("click", (event) => {
      const openEl = event.target.closest("[data-sf-modal-open]");
      if (openEl) {
        SfModal.registry.get(openEl.getAttribute("data-sf-modal-open"))?.open();
        return;
      }

      const showEl = event.target.closest("[data-sf-modal-show]");
      if (showEl) {
        SfModal.registry.get(showEl.getAttribute("data-sf-modal-show"))?.expand();
        return;
      }

      const hideEl = event.target.closest("[data-sf-modal-hide]");
      if (hideEl) {
        SfModal.registry.get(hideEl.getAttribute("data-sf-modal-hide"))?.minimize();
        return;
      }

      const closeEl = event.target.closest("[data-sf-modal-close]");
      if (!closeEl) {
        return;
      }

      const id =
        closeEl.getAttribute("data-sf-modal-close") ||
        closeEl.closest(".sf-modal")?.getAttribute("data-sf-modal-id");
      // The window's own close button closed it already, as `close`; a page
      // control that closes it is a cancel.
      SfModal.registry.get(id)?.close({ reason: "cancelled" });
    });

    SfModal.globalBound = true;
  }

  static lockPage(preserveScrollGap = true) {
    if (!SfModal.lockState) SfModal.lockState = lockModalScroll(preserveScrollGap);
  }

  static unlockPage() {
    unlockModalScroll(SfModal.lockState);
    SfModal.lockState = null;
  }
}

SfModal.define("sf-modal");
