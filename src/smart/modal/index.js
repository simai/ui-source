import { html, nothing, render } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import SfBaseElement from "../../core/js/smart-base";
import { pageText } from "../../core/js/page-language";
import { renderModalTemplate } from "./js/templates/default";
import { trapModalFocus } from "../../component/modal/js/_focus";
import { freezeModalContent } from "../../component/modal/js/_closing";
import { scheduleModalClose, scheduleModalFrame } from "../../component/modal/js/_motion";
import { lockModalScroll, unlockModalScroll } from "../../component/modal/js/_scroll";

// A box that holds its own overlays (sf-modal, sf-drawer); the drawer's own
// name came first and is read until the change journal retires it.
const OVERLAY_CONTAINER = "[data-sf-overlay-container], [data-sf-drawer-container]";
import { getTopModalLayer, getModalLayerIndex, updateModalLayers, addModalLayer,
  removeModalLayer, raiseModalLayer, captureModalFocusAncestors, restoreModalLayerFocus } from "../../component/modal/js/_stack";

// The header's two actions, named in the page's language: they were English on
// every page (documentation trial, 2026-10-12).
const MODAL_TEXT = {
  en: { close: "Close", minimize: "Minimize", title: "Dialog" },
  ru: { close: "Закрыть", minimize: "Свернуть", title: "Окно" },
};

let modalUid = 0;

function isBlurTypeValue(value) {
  return ["none", "small", "medium", "large"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

class SfModal extends SfBaseElement {
  static registry = new Map();
  static globalBound = false;
  static stack = [];
  static openCount = 0;
  static lockState = null;
  static baseZIndex = 9000;

  static defaultTrueAttributes = new Set([
    "overlay",
    "show-close",
    "show-footer",
    "close-on-esc",
    "close-on-overlay",
    "preserve-scroll-gap",
    "preload",
  ]);

  static getTopModal() {
    return getTopModalLayer();
  }

  static isTopModal(modal) {
    return SfModal.getTopModal() === modal;
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

  static get props() {
    return {
      templateName: { attribute: "template", default: "default" },
      modalId: { default: "" },
      title: { default: "" },
      ariaLabel: { attribute: "aria-label", default: "" },
      text: { default: "" },
      open: { type: Boolean, default: false },
      autoload: { type: Boolean, default: false },
      unclose: { type: Boolean, default: false },
      hide: { type: Boolean, default: false },
      hideModifier: { default: "" },
      minimized: { type: Boolean, default: false },
      overlay: { type: Boolean, default: true },
      showHeader: { type: Boolean, default: true },
      showClose: { type: Boolean, default: true },
      showFooter: { type: Boolean, default: true },
      closeOnEsc: { type: Boolean, default: true },
      closeOnOverlay: { type: Boolean, default: true },
      preserveScrollGap: { type: Boolean, default: true },
      position: {
        default: "center",
        values: [
          "center",
          "left",
          "right",
          "inline-start",
          "inline-end",
          "top",
          "bottom",
        ],
      },
      mode: { default: "inline", values: ["inline", "ajax", "iframe"] },
      display: { default: "modal", values: ["modal", "inline"] },
      src: { default: "" },
      rootClass: { default: "" },
      preload: { type: Boolean, default: true },
      fullscreen: { type: Boolean, default: false },
      width: { default: "" },
      height: { default: "" },
      blur: { default: "" },
      blurType: {
        default: "medium",
        values: ["none", "small", "medium", "large"],
      },
      overlayPreset: {
        default: "default",
        values: ["default", "focus"],
      },
      overlayClass: { default: "" },
      closeClass: { default: "" },
      surfaceClass: { default: "" },
      surfacePadding: { default: "" },
      panelClass: { default: "" },
      headerClass: { default: "" },
      bodyClass: { default: "" },
      contentClass: { default: "" },
      footerClass: { default: "" },
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
    this.onKeyDown = this.onKeyDown.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);
    this.handleHideClick = this.handleHideClick.bind(this);
  }

  connectedCallback() {
    if (!this._modalId) {
      this._modalId =
        this.getAttribute("modal-id") || this.id || `sf-modal-${++modalUid}`;
    }

    super.connectedCallback();
    SfModal.registry.set(this.modalId, this);
    SfModal.bindGlobalEvents();
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

  get title() {
    // An untitled window was headed and named «Modal» on every page; it
    // takes the page language's word instead.
    return this.getAttribute("title") || pageText(MODAL_TEXT, "title", this);
  }

  get ariaLabel() {
    return this.getAttribute("aria-label") || "";
  }

  get text() {
    return this.getAttribute("text") || "";
  }

  get openState() {
    return this._isOpen || this.hasAttribute("open");
  }

  get autoload() {
    return this.getBooleanAttr("autoload", false);
  }

  get unclose() {
    return this.getBooleanAttr("unclose", false);
  }

  get hideButton() {
    return this.getBooleanAttr("hide", false);
  }

  get hideModifier() {
    return this.getAttribute("hide-modifier") || "";
  }

  get hiddenState() {
    return this.display !== "inline" && (this._isHidden || this.hasAttribute("minimized"));
  }

  get overlay() {
    return this.getBooleanAttr("overlay", true);
  }

  get closeOnEsc() {
    return this.getBooleanAttr("close-on-esc", true);
  }

  get showClose() {
    const showClose = this.getBooleanAttr("show-close", true);
    return showClose && !this.unclose;
  }

  get showHeader() {
    return this.getBooleanAttr("show-header", true);
  }

  get showFooter() {
    return this.getBooleanAttr("show-footer", true);
  }

  get closeOnOverlay() {
    return this.getBooleanAttr("close-on-overlay", true);
  }

  get preserveScrollGap() {
    return this.getBooleanAttr("preserve-scroll-gap", true);
  }

  get position() {
    return this.getEnumAttr(
      "position",
      [
        "center",
        "left",
        "right",
        "inline-start",
        "inline-end",
        "top",
        "bottom",
      ],
      "center",
    );
  }

  get mode() {
    return this.getEnumAttr("mode", ["inline", "ajax", "iframe"], "inline");
  }

  get display() {
    return this.getEnumAttr("display", ["modal", "inline"], "modal");
  }

  get src() {
    return this.getAttribute("src") || "";
  }

  get preload() {
    return this.getBooleanAttr("preload", true);
  }

  get fullscreen() {
    return this.getBooleanAttr("fullscreen", false);
  }

  get width() {
    return this.getAttribute("width") || "";
  }

  get height() {
    return this.getAttribute("height") || "";
  }

  // blur="small" turns the blur on and names its type; blur="false" turns it
  // off. The template used to read the raw attribute, so any value, "false"
  // included, turned the blur on.
  get blur() {
    return (
      isBlurTypeValue(this.getAttribute("blur")) ||
      this.getBooleanAttr("blur", false)
    );
  }

  get blurType() {
    const blurValue = this.getAttribute("blur");
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
      isBlurTypeValue(this.getAttribute("blur"))
    );
  }

  get overlayPreset() {
    return this.normalizeEnum(
      this.getAttribute("overlay-preset") || "default",
      ["default", "focus"],
      "default",
    );
  }

  get headerClass() {
    return this.getAttribute("header-class") || "";
  }

  get overlayClass() {
    return this.getAttribute("overlay-class") || "";
  }

  get closeClass() {
    return this.getAttribute("close-class") || "";
  }

  get surfaceClass() {
    return this.getAttribute("surface-class") || "";
  }

  get surfacePadding() {
    return this.getAttribute("surface-padding") || "";
  }

  get panelClass() {
    return this.getAttribute("panel-class") || "";
  }

  get bodyClass() {
    return this.getAttribute("body-class") || "";
  }

  get contentClass() {
    return this.getAttribute("content-class") || "";
  }

  get footerClass() {
    return this.getAttribute("footer-class") || "";
  }

  get modalRoot() {
    return this._renderTarget?.querySelector?.(".sf-modal") || null;
  }

  get state() {
    return {
      modalId: this.modalId,
      title: this.title,
      ariaLabel: this.ariaLabel,
      text: this.text,
      open: this.openState,
      autoload: this.autoload,
      unclose: this.unclose,
      hide: this.hideButton,
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
      blur: this.blur,
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

    return SfModal.baseZIndex + this._stackIndex * 2;
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
      return html`
        <div
          class="sf-modal-loading flex flex-col gap-2 items-cross-center content-main-center p-4"
          data-sf-modal-state="loading"
        >
          <div
            class="sf-modal-spinner animate-spin border-2 border-t-transparent border-outline-variant rounded-full w-8 h-8"
          ></div>
          <p class="m-0 text-2 color-on-surface-variant">Loading...</p>
        </div>
      `;
    }

    return nothing;
  }

  templateContext() {
    this._slotEventHandlers.clear();
    this._slotEventId = 0;
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      closeText: pageText(MODAL_TEXT, "close", this),
      minimizeText: pageText(MODAL_TEXT, "minimize", this),
      // The props context holds the declared default; the getter holds the
      // page language's word for an untitled window.
      title: this.title,
      modalId: this.modalId,
      open: this.renderOpenState,
      modalState: this.renderModalState,
      animate: this._animatePanel && this.display !== "inline",
      modalZIndex: this.modalZIndex,
      hide: this.hideButton,
      minimized: this.hiddenState,
      showClose: this.showClose,
      blur: this.blur,
      blurType: this.blurType,
      hasCustomBlurType: this.hasCustomBlurType,
      hasHeaderContent: this.hasSlotContent("header"),
      hasContentContent: this.hasSlotContent("content"),
      hasFooterContent: this.hasSlotContent("footer"),
      headerContent: unsafeHTML(this.getSlotHtml("header")),
      contentContent: unsafeHTML(this.getSlotHtml("content")),
      footerContent: unsafeHTML(this.getSlotHtml("footer")),
      remoteContent: this.remoteContent,
      onCloseClick: this.handleCloseClick,
      onHideClick: this.handleHideClick,
    });
  }

  getSlotHtml(name) {
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

    const root = this.getModalRoot();
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

  open(options = {}) {
    const { animate = true } =
      typeof options === "boolean" ? { animate: options } : options;
    const wasClosing = this._modalState === "closing";

    if (this._isOpen && !wasClosing) {
      this.cancelCloseTransition();
      SfModal.bringToFront(this);
      return this;
    }

    if (!this.emitBeforeOpen()) {
      return this;
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
        this.emitAfterOpen();
        this.loadRemoteContentIfNeeded();
      });
    });

    return this;
  }

  close() {
    if (!this.openState || this._modalState === "closing") {
      return this;
    }

    if (!this.emitBeforeClose()) {
      return this;
    }

    if (this.display === "inline") {
      this.finishClose();
      return this;
    }

    this._modalState = "closing";
    this._isOpen = false;
    this.requestComponentUpdate("close");

    const panel = this.getModalRoot()?.querySelector("[data-sf-modal-panel]");
    this._releaseClosingContent = freezeModalContent(panel, SfModal.isTopModal(this));
    this._closeTransitionAbort = scheduleModalClose(
      () => this.getModalRoot(), () => this.finishClose(),
    );
    return this;
  }

  hide() {
    if (!this.openState || this.display === "inline" || this.hiddenState) {
      return this;
    }

    if (!this.emitBeforeHide()) {
      return this;
    }

    this._isHidden = true;
    this.setAttribute("minimized", "");
    this.requestComponentUpdate("hide");
    this.emitAfterHide();
    return this;
  }

  show() {
    if (!this.openState || this.display === "inline" || !this.hiddenState) {
      return this;
    }

    if (!this.emitBeforeShow()) {
      return this;
    }

    this._isHidden = false;
    this.removeAttribute("minimized");
    this.requestComponentUpdate("show");
    this.emitAfterShow();
    return this;
  }

  syncMinimizedLayer() {
    if (!this._isMounted || !this.openState || this.display === "inline" ||
        this._modalState === "closed" || this._modalState === "closing") {
      return;
    }
    const root = this.getModalRoot();
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
    this._isHidden = false;
    this._modalState = "closed";
    this.removeAttribute("minimized");
    this.syncOpenAttribute(false);

    const root = this.getModalRoot();
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
    this.emitAfterClose();
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
    return this;
  }

  getModalRoot() {
    return this.modalRoot;
  }

  afterRender() {
    this.bindRenderedEvents();
    this.bindSlotEventHandlers();
    if (this._modalState === "closing") {
      this._releaseClosingContent?.();
      this._releaseClosingContent = freezeModalContent(
        this.getModalRoot()?.querySelector("[data-sf-modal-panel]"), SfModal.isTopModal(this),
      );
    }

    this._readyDetail = {
      component: this,
      modal: this,
      modalId: this.modalId,
      root: this.getModalRoot(),
    };

    if (!this._hasEmittedReady) {
      this._hasEmittedReady = true;
      this.dispatchEvent(
        new CustomEvent("modal:ready", {
          bubbles: true,
          composed: true,
          detail: this._readyDetail,
        }),
      );
    } else {
      this.dispatchEvent(
        new CustomEvent("modal:update", {
          bubbles: true,
          composed: true,
          detail: this._readyDetail,
        }),
      );
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

  bindRenderedEvents() {
    const root = this.getModalRoot();
    if (!root) {
      return;
    }

    root.removeEventListener("click", this.handleOverlayClick);
    root.addEventListener("click", this.handleOverlayClick);
    document.removeEventListener("keydown", this.onKeyDown);
    document.addEventListener("keydown", this.onKeyDown);
  }

  bindSlotEventHandlers() {
    const root = this.getModalRoot();
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
      this.getModalRoot()?.querySelector("[data-sf-modal-overlay]");
    if (isOverlay && this.closeOnOverlay && !this.unclose) {
      this.close();
    }
  }

  handleCloseClick(event) {
    event.preventDefault();
    if (!this.unclose) {
      this.close();
    }
  }

  handleHideClick(event) {
    event.preventDefault();
    this.hide();
  }

  onKeyDown(event) {
    if ((!this.openState && this._modalState !== "closing") || this.display === "inline") {
      return;
    }

    if (!SfModal.isTopModal(this)) {
      return;
    }

    if (this.hiddenState) {
      return;
    }

    // An open popover takes Escape first; the window behind it stays.
    if (event.key === "Escape" && this.closeOnEsc && !this.unclose && this._modalState !== "closing" && !event.defaultPrevented && !document.documentElement?.dataset?.sfPopoverOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
      return;
    }

    if (event.key === "Tab") {
      this.trapFocus(event);
    }
  }

  trapFocus(event) {
    if (!SfModal.isTopModal(this)) {
      return;
    }

    if (this.hiddenState) {
      return;
    }

    const panel = this.getModalRoot()?.querySelector("[data-sf-modal-panel]");
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

    const panel = this.getModalRoot()?.querySelector("[data-sf-modal-panel]");
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
    this.emitContentEvent("modal:before-content-upload");
    this._fetchController = new AbortController();

    try {
      if (this.src.startsWith("#")) {
        const source = document.querySelector(this.src);
        if (!source) {
          throw new Error(`Element not found: ${this.src}`);
        }

        this._remoteHtml = source.innerHTML;
      } else {
        const response = await fetch(this.src, {
          signal: this._fetchController.signal,
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
        this._remoteError = error.message || "Failed to load content";
      }
    } finally {
      this._fetchController = null;
      this._isLoadingRemote = false;
      this.requestComponentUpdate("remote-content");
      if (!aborted) {
        this.emitContentEvent("modal:after-content-upload");
      }
    }
  }

  handleIframeLoad = () => {
    this._remoteLoaded = true;
    this.emitContentEvent("modal:after-content-upload");
  };

  handleIframeError = () => {
    this._remoteError = "Failed to load iframe content";
    this.requestComponentUpdate("remote-content");
  };

  emitContentEvent(eventName) {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
          composed: true,
        detail: {
          component: this,
          modal: this,
          modalId: this.modalId,
          src: this.src,
          remote: this.state.remote,
        },
      }),
    );
  }

  emitModalEvent(eventName, { cancelable = false, detail = {} } = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
          composed: true,
      cancelable,
      detail: {
        component: this,
        modal: this,
        modalId: this.modalId,
        root: this.getModalRoot(),
        ...detail,
      },
    });

    this.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  emitBeforeOpen() {
    return this.emitModalEvent("modal:before-open", {
      cancelable: true,
      detail: { phase: "before-open" },
    });
  }

  emitAfterOpen() {
    this.emitModalEvent("modal:after-open", {
      detail: { phase: "after-open" },
    });
  }

  emitBeforeClose() {
    return this.emitModalEvent("modal:before-close", {
      cancelable: true,
      detail: { phase: "before-close" },
    });
  }

  emitAfterClose() {
    this.emitModalEvent("modal:after-close", {
      detail: { phase: "after-close" },
    });
  }

  emitBeforeHide() {
    return this.emitModalEvent("modal:before-hide", {
      cancelable: true,
      detail: { phase: "before-hide" },
    });
  }

  emitAfterHide() {
    this.emitModalEvent("modal:after-hide", {
      detail: { phase: "after-hide" },
    });
  }

  emitBeforeShow() {
    return this.emitModalEvent("modal:before-show", {
      cancelable: true,
      detail: { phase: "before-show" },
    });
  }

  emitAfterShow() {
    this.emitModalEvent("modal:after-show", {
      detail: { phase: "after-show" },
    });
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
    document.removeEventListener("keydown", this.onKeyDown);

    if (this.display !== "inline") {
      SfModal.removeFromStack(this);
    }

    this._isOpen = false;
    this._modalState = "closed";
    this.clearPortal();
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
  // helpers keep their meaning and receive only this modal's own events.
  ownModalHandler(handler) {
    return (event) => {
      if (event.detail?.modal === this) handler.call(this, event);
    };
  }

  onBeforeOpen(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:before-open", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onAfterOpen(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:after-open", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onBeforeClose(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:before-close", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onAfterClose(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:after-close", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onBeforeHide(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:before-hide", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onAfterHide(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:after-hide", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onBeforeShow(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:before-show", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onAfterShow(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("modal:after-show", this.ownModalHandler(handler), options);
    }
    return this;
  }

  onModalReady(handler, options) {
    if (typeof handler !== "function") {
      return this;
    }

    if (this._readyDetail) {
      handler(new CustomEvent("modal:ready", { detail: this._readyDetail }));
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

    document.addEventListener("click", (event) => {
      const openEl = event.target.closest("[data-sf-modal-open]");
      if (openEl) {
        SfModal.registry.get(openEl.getAttribute("data-sf-modal-open"))?.open();
        return;
      }

      const showEl = event.target.closest("[data-sf-modal-show]");
      if (showEl) {
        SfModal.registry.get(showEl.getAttribute("data-sf-modal-show"))?.show();
        return;
      }

      const hideEl = event.target.closest("[data-sf-modal-hide]");
      if (hideEl) {
        SfModal.registry.get(hideEl.getAttribute("data-sf-modal-hide"))?.hide();
        return;
      }

      const closeEl = event.target.closest("[data-sf-modal-close]");
      if (!closeEl) {
        return;
      }

      const id =
        closeEl.getAttribute("data-sf-modal-close") ||
        closeEl.closest(".sf-modal")?.getAttribute("data-sf-modal-id");
      SfModal.registry.get(id)?.close();
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
