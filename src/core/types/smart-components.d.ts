export type SmartComponentState = Record<string, unknown>;
export type SmartComponentCreateChild =
    | Node
    | string
    | number
    | boolean
    | null
    | undefined;
export interface SmartComponentCreateParams extends Record<string, unknown> {
  attrs?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  dataset?: Record<string, unknown>;
  children?:
      | SmartComponentCreateChild
      | Array<SmartComponentCreateChild | SmartComponentCreateChild[]>;
  html?: string;
  textContent?: string | number;
}
export type SmartComponentEventHandler<TState = SmartComponentState> = (
    state: TState,
    detail?: Record<string, unknown>,
    event?: Event,
) => void;
export interface SmartComponentRenderDetail extends Record<string, unknown> {
  component: SmartComponentElement;
  tagName: string;
  template: string;
  changedAttributes?: string[];
  immediate?: boolean;
}
export type SmartComponentRenderHandler = (
    detail: SmartComponentRenderDetail,
    event?: Event | null,
) => void;
export interface SmartComponentStateCallbackDetail<
    TState = SmartComponentState,
    TPatch = unknown,
> extends Record<string, unknown> {
  component: SmartComponentElement<TState>;
  state: TState;
  patch?: TPatch;
  reason?: string;
  changed?: boolean;
  changedKeys?: string[];
  prevState?: TState;
  nextState?: TState;
  renderDetail?: SmartComponentRenderDetail;
}
export type SmartComponentStateCallback<
    TState = SmartComponentState,
    TPatch = unknown,
> = (detail: SmartComponentStateCallbackDetail<TState, TPatch>) => void;

export type SmartComponentCreateName =
    | 'avatars'
    | 'sf-avatars'
    | 'alert'
    | 'sf-alert'
    | 'reference-link'
    | 'sf-reference-link'
    | 'range-slider'
    | 'sf-range-slider'
    | 'toast'
    | 'sf-toast'
    | 'skeleton'
    | 'sf-skeleton'
    | 'spinner'
    | 'sf-spinner'
    | 'toggle'
    | 'sf-toggle'
    | 'steps'
    | 'sf-steps'
    | 'switch'
    | 'sf-switch'
    | 'radio'
    | 'sf-radio'
    | 'checkbox'
    | 'sf-checkbox'
    | 'button'
    | 'sf-button'
    | 'icon-button'
    | 'sf-icon-button'
    | 'slider'
    | 'sf-slider'
    | 'modal'
    | 'sf-modal'
    | 'gallery'
    | 'sf-gallery'
    | 'dropdown'
    | 'sf-dropdown'
    | 'context-menu'
    | 'sf-context-menu'
    | 'input'
    | 'sf-input'
    | 'textarea'
    | 'sf-textarea'
    | 'progress-bar'
    | 'sf-progress-bar'
    | 'progress-scale'
    | 'sf-progress-scale'
    | 'pagination'
    | 'sf-pagination'
    | 'tabs'
    | 'sf-tabs'
    | 'file-upload'
    | 'sf-file-upload';

export type SmartComponentCreateResult<TName extends string> =
    TName extends 'avatars' | 'sf-avatars'
        ? HTMLSfAvatarsElement
        : TName extends 'alert' | 'sf-alert'
            ? HTMLSfAlertElement
            : TName extends 'reference-link' | 'sf-reference-link'
                ? HTMLSfReferenceLinkElement
                : TName extends 'range-slider' | 'sf-range-slider'
                    ? HTMLSfRangeSliderElement
                    : TName extends 'toast' | 'sf-toast'
                        ? HTMLSfToastElement
                        : TName extends 'skeleton' | 'sf-skeleton'
                            ? HTMLSfSkeletonElement
                            : TName extends 'spinner' | 'sf-spinner'
                                ? HTMLSfSpinnerElement
                                : TName extends 'toggle' | 'sf-toggle'
                                    ? HTMLSfToggleElement
                                    : TName extends 'steps' | 'sf-steps'
                                        ? HTMLSfStepsElement
                                        : TName extends 'switch' | 'sf-switch'
                                            ? HTMLSfSwitchElement
                                            : TName extends 'radio' | 'sf-radio'
                                                ? HTMLSfRadioElement
                                                : TName extends 'checkbox' | 'sf-checkbox'
                                                    ? HTMLSfCheckboxElement
                                                    : TName extends 'button' | 'sf-button'
                                                        ? HTMLSfButtonElement
                                                        : TName extends 'icon-button' | 'sf-icon-button'
                                                            ? HTMLSfIconButtonElement
                                                            : TName extends 'slider' | 'sf-slider'
                                                                ? HTMLSfSliderElement
                                                                : TName extends 'modal' | 'sf-modal'
                                                                    ? HTMLSfModalElement
                                                                    : TName extends 'gallery' | 'sf-gallery'
                                                                        ? HTMLSfGalleryElement
                                                                        : TName extends 'dropdown' | 'sf-dropdown'
                                                                            ? HTMLSfDropdownElement
                                                                            : TName extends 'context-menu' | 'sf-context-menu'
                                                                                ? HTMLSfContextMenuElement
                                                                                : TName extends 'input' | 'sf-input'
                                                                                    ? HTMLSfInputElement
                                                                                    : TName extends 'textarea' | 'sf-textarea'
                                                                                        ? HTMLSfTextareaElement
                                                                                        : TName extends 'progress-bar' | 'sf-progress-bar'
                                                                                            ? HTMLSfProgressBarElement
                                                                                            : TName extends 'progress-scale' | 'sf-progress-scale'
                                                                                                ? HTMLSfProgressScaleElement
                                                                                                : TName extends 'pagination' | 'sf-pagination'
                                                                                                    ? HTMLSfPaginationElement
                                                                                                    : TName extends 'tabs' | 'sf-tabs'
                                                                                                        ? HTMLSfTabsElement
                                                                                                        : TName extends 'file-upload' | 'sf-file-upload'
                                                                                                            ? HTMLSfFileUploadElement
                                                                                                            : HTMLElement;

export interface SmartComponentElement<TState = SmartComponentState>
    extends HTMLElement {
  value: unknown;
  readonly isRendered: boolean;
  refresh(reason?: string): this;
  requestComponentUpdate(reason?: string): void;
  getState(): TState;
  setState(
      nextState?: Partial<TState> | Record<string, unknown>,
      callback?: SmartComponentStateCallback<TState>,
  ): this;
  patchState(
      nextState?:
          | Partial<TState>
          | Record<string, unknown>
          | ((
          prevState: TState,
      ) => Partial<TState> | Record<string, unknown> | TState | null | undefined),
      reason?: string | SmartComponentStateCallback<TState>,
      callback?: SmartComponentStateCallback<TState>,
  ): this;
  set(
      nextState?:
          | Partial<TState>
          | Record<string, unknown>
          | ((
          prevState: TState,
      ) => Partial<TState> | Record<string, unknown> | TState | null | undefined),
      reason?: string | SmartComponentStateCallback<TState>,
      callback?: SmartComponentStateCallback<TState>,
  ): this;
  getProp<TValue = unknown>(key: string, fallbackConfig?: unknown): TValue;
  getPropsContext(props?: Record<string, unknown>): Record<string, unknown>;
  createRef<TValue = unknown>(): { value?: TValue | null };
  registerRefEffect<TValue = unknown>(
      ref: { value?: TValue | null },
      callback: (
          value: TValue,
          detail: {
            component: SmartComponentElement<TState>;
            ref: { value?: TValue | null };
            value: TValue;
          },
      ) => void | (() => void),
      options?: { once?: boolean },
  ): this;
  flushRefEffects(): this;
  getAttributeValue(name?: string, fallback?: string): string;
  setAttributeValue(name?: string, nextValue?: unknown): this;
  setValueAttributes(
      nextValue?: Record<string, unknown>,
      options?: { prefix?: string; removeMissing?: boolean },
  ): this;
  getRootClass(): string;
  getRootStyle(): string;
  setRootClass(nextValue?: string): this;
  setRootStyle(nextValue?: string): this;
  addRootClass(...tokens: Array<string | string[]>): this;
  removeRootClass(...tokens: Array<string | string[]>): this;
  toggleRootClass(token: string, force?: boolean): this;
  getBooleanAttr(name: string, fallback?: boolean): boolean;
  getNumberAttr(name: string, fallback?: number): number;
  getEnumAttr<TValue extends string>(
      name: string,
      allowed: readonly TValue[],
      fallback?: TValue,
  ): TValue | string;
  setHidden(hidden?: boolean): this;
  isHidden(): boolean;
  setAttributes(attributes?: Record<string, unknown>): this;
  removeAttributes(attributes?: string[]): this;
  hasSlotContent(name: string): boolean;
  getSlotContent(name: string): unknown;
  setSlot(name: string, ...elements: Array<Node | string>): this;
  clearSlot(name: string): this;
  emitComponentEvent(name: string, detail?: Record<string, unknown>): void;
  whenRendered(
      callback?: SmartComponentRenderHandler | null,
      options?: { next?: boolean },
  ): Promise<SmartComponentRenderDetail>;
  onAfterRender(
      callback: SmartComponentRenderHandler,
      options?: { immediate?: boolean; once?: boolean },
  ): () => void;
  afterRender(callback: SmartComponentRenderHandler): Promise<SmartComponentRenderDetail>;
  onUpdate(
      handler: SmartComponentEventHandler<TState>,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onPropChange(
      handler: SmartComponentEventHandler<TState>,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfAvatarsElement extends SmartComponentElement {}

export interface HTMLSfButtonElement extends SmartComponentElement {
  disabled: boolean;
  setDisabled(nextValue?: boolean): this;
  onClick(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onMouseEnter(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onMouseLeave(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfAlertElement extends SmartComponentElement {
  dismiss(): this;
  close(): this;
  onAction(
      handler: (
          action: string,
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onClose(
      handler: (
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfReferenceLinkElement extends SmartComponentElement {
  onClick(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfContextMenuElement extends SmartComponentElement {}

export interface HTMLSfRangeSliderEventDetail {
  component?: HTMLElement;
  rangeSlider?: HTMLSfRangeSliderElement;
  values: number[];
  value: number | number[];
  handleCount: number;
  handle?: number;
  sourceEvent?: Event;
}

export type HTMLSfRangeSliderEvent = CustomEvent<HTMLSfRangeSliderEventDetail>;

export type HTMLSfRangeSliderHandler = (
    value: number | number[] | null,
    detail?: HTMLSfRangeSliderEventDetail,
    event?: Event,
) => void;

export interface HTMLSfRangeSliderElement extends SmartComponentElement {
  disabled: boolean;
  multiple: boolean;
  value: string;
  getSliderRoot(): HTMLElement | null;
  getValue(): number | number[] | null;
  setValue(nextValue: number | string | Array<number | string>): this;
  setDisabled(nextValue?: boolean): this;
  onUpdateValue(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSliderUpdate(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onChange(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSliderChange(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSet(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSliderSet(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onStart(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSliderStart(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onEnd(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onSliderEnd(
      handler: HTMLSfRangeSliderHandler,
      options?: AddEventListenerOptions | boolean,
  ): this;
  addEventListener(
      type:
          | 'sf-range-slider-update'
          | 'sf-range-slider-change'
          | 'sf-range-slider-set'
          | 'sf-range-slider-start'
          | 'sf-range-slider-end'
          | 'slider-update'
          | 'slider-change'
          | 'slider-set'
          | 'slider-start'
          | 'slider-end',
      listener: (event: HTMLSfRangeSliderEvent) => void,
      options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
      type:
          | 'sf-range-slider-update'
          | 'sf-range-slider-change'
          | 'sf-range-slider-set'
          | 'sf-range-slider-start'
          | 'sf-range-slider-end'
          | 'slider-update'
          | 'slider-change'
          | 'slider-set'
          | 'slider-start'
          | 'slider-end',
      listener: (event: HTMLSfRangeSliderEvent) => void,
      options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
  ): void;
}

export interface HTMLSfGalleryElement extends SmartComponentElement {
  open(index?: number | null): this;
  close(): this;
  toggle(index?: number | null): this;
  goTo(index: number | string): this;
  next(): this;
  prev(): this;
  getModal(): HTMLSfModalElement | null;
  getInlineSlider(): HTMLElement | null;
  getLightboxSlider(): HTMLElement | null;
}

export interface HTMLSfToastElement extends SmartComponentElement {
  dismiss(): this;
  close(): this;
  onAction(
      handler: (
          action: string,
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onClose(
      handler: (
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfTagValue extends Record<string, unknown> {
  template?: string;
  type?: string;
  size?: string;
  text?: string | number;
  count?: string | number;
  icon?: string;
  colorClass?: string;
  avatarImageUrl?: string;
  avatarText?: string;
  avatarStatus?: string;
  rootClass?: string;
  active?: boolean;
  disabled?: boolean;
  closable?: boolean;
  ariaLabel?: string;
}

export type HTMLSfTagCloseEvent = CustomEvent<{
  component?: HTMLElement;
}>;

export interface HTMLSfTagElement extends SmartComponentElement<HTMLSfTagValue> {
  value: HTMLSfTagValue;
  type: string;
  size: string;
  text: string;
  count: string;
  icon: string;
  colorClass: string;
  avatarImageUrl: string;
  avatarText: string;
  avatarStatus: string;
  rootClass: string;
  active: boolean;
  disabled: boolean;
  closable: boolean;
  ariaLabel: string;
  onClose(item: HTMLElement): void;
  addEventListener(
      type: 'close',
      listener: (event: HTMLSfTagCloseEvent) => void,
      options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
      type: 'close',
      listener: (event: HTMLSfTagCloseEvent) => void,
      options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
  ): void;
}

export interface HTMLSfSkeletonElement extends SmartComponentElement {}

export interface HTMLSfSpinnerElement extends SmartComponentElement {
  getSpinnerRoot(): HTMLElement | null;
  refreshSpinner(): this;
}

export interface HTMLSfToggleState extends SmartComponentState {
  type: string;
  size: string;
  checked: boolean;
  disabled: boolean;
  name: string;
  value: string;
  icon: string;
  label: string;
}

export interface HTMLSfToggleElement
    extends SmartComponentElement<HTMLSfToggleState> {
  size: string;
  type: string;
  label: string;
  icon: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  value: string;
  getInputElement(): HTMLInputElement | null;
  isChecked(): boolean;
  setChecked(nextValue?: boolean): this;
  setDisabled(nextValue?: boolean): this;
  onChange(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfStepsElement extends SmartComponentElement {
  goToStep(index: number | string): this;
  onStepChange(
      handler: (
          step: number,
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfSwitchElement extends SmartComponentElement {
  checked: boolean;
  disabled: boolean;
  value: string;
  getInputElement(): HTMLInputElement | null;
  isChecked(): boolean;
  setChecked(nextValue?: boolean): this;
  setDisabled(nextValue?: boolean): this;
  onChange(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfRadioElement extends SmartComponentElement {
  checked: boolean;
  disabled: boolean;
  value: string;
  getInputElement(): HTMLInputElement | null;
  isChecked(): boolean;
  setChecked(nextValue?: boolean): this;
  setDisabled(nextValue?: boolean): this;
  onChange(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfCheckboxElement extends SmartComponentElement {
  checked: boolean;
  disabled: boolean;
  indeterminate: boolean;
  value: string;
  getInputElement(): HTMLInputElement | null;
  isChecked(): boolean;
  setChecked(nextValue?: boolean): this;
  setIndeterminate(nextValue?: boolean): this;
  setDisabled(nextValue?: boolean): this;
  onChange(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfIconButtonElement extends SmartComponentElement {
  disabled: boolean;
  setDisabled(nextValue?: boolean): this;
  onClick(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onMouseEnter(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onMouseLeave(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfSliderElement extends SmartComponentElement {
  getSlider(): unknown | null;
  slideNext(): this;
  slidePrev(): this;
  refresh(): this;
}

/** An action's answer (standard simai.smart-component 1.3.8 §4.4). */
export interface SmartOutcome {
  outcome: 'applied' | 'refused' | 'cancelled' | 'conflict' | 'unavailable';
  reason?: string;
  value?: unknown;
}

export interface HTMLSfModalElement extends SmartComponentElement {
  /** Asked by an assembly (a signal given) it answers when the window closes, value {accepted, reason, value} (§19.4). */
  open(options?: {animate?: boolean} | boolean, context?: {signal?: AbortSignal}): SmartOutcome | Promise<SmartOutcome>;
  close(options?: {reason?: 'close' | 'escape' | 'outside' | 'cancelled' | 'api'}): SmartOutcome;
  confirm(params?: {value?: unknown}): SmartOutcome;
  minimize(): SmartOutcome;
  expand(): SmartOutcome;
  toggle(): SmartOutcome | Promise<SmartOutcome>;
  /** @deprecated since 2026-10-27, until 2026-12-01: minimize(). */
  hide(): SmartOutcome;
  /** @deprecated since 2026-10-27, until 2026-12-01: expand(). */
  show(): SmartOutcome;
  /** @deprecated since 2026-10-27, until 2026-12-01: a reader retires (§4.4). */
  getModalRoot(): HTMLElement | null;
  setSrc(src: string): this;
  reloadContent(): SmartOutcome;
  onModalReady(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onModalUpdate(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBeforeOpen(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onAfterOpen(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBeforeClose(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onAfterClose(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBeforeHide(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onAfterHide(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBeforeShow(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onAfterShow(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfDropdownElement extends SmartComponentElement {
  onFocus?(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur?(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfInputElement extends SmartComponentElement {
  getInputElement(): HTMLInputElement | null;
  onInput(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onChange(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onKeyUp(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onKeyDown(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFocus(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onBlur(
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfTextareaElement extends SmartComponentElement {}

export interface HTMLSfProgressBarElement extends SmartComponentElement {
  getProgress(): number;
  setProgress(value: number | string): this;
  setTextPosition(position: string): this;
}

export interface HTMLSfProgressScaleElement extends SmartComponentElement {
  getProgress(): number;
  setProgress(value: number | string): this;
}

export interface HTMLSfPaginationElement extends SmartComponentElement {
  getTopSection(): HTMLElement | null;
  getMainSection(): HTMLElement | null;
  getBottomSection(): HTMLElement | null;
  top: boolean;
  middle: boolean;
  bottom: boolean;
  goToPage(page: number | string): this;
  lastPage(): this;
  onPageChange(
      handler: (
          page: number,
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfTabsComponentDescriptor {
  type: string;
  props?: Record<string, unknown>;
}

export interface HTMLSfTabsItem extends Record<string, unknown> {
  label?: string;
  text?: string;
  title?: string;
  disabled?: boolean;
  icon?: string;
  iconLeft?: string;
  iconRight?: string;
  component?: HTMLSfTabsComponentDescriptor | null;
}

export interface HTMLSfTabsPanel extends Record<string, unknown> {
  text?: string;
  component?: HTMLSfTabsComponentDescriptor | null;
}

export interface HTMLSfTabsData {
  tabs?: HTMLSfTabsItem[];
  items?: HTMLSfTabsItem[];
  panels?: HTMLSfTabsPanel[];
  content?: HTMLSfTabsPanel[];
  [key: string]: unknown;
}

export interface HTMLSfTabsElement
    extends SmartComponentElement<{ data?: HTMLSfTabsData }> {
  getData(): HTMLSfTabsData;
  setData(
      data?:
          | Partial<HTMLSfTabsData>
          | ((currentData: HTMLSfTabsData) => Partial<HTMLSfTabsData>),
      reason?: string,
  ): this;
  setItems(
      items?:
          | HTMLSfTabsItem[]
          | ((currentItems: HTMLSfTabsItem[]) => HTMLSfTabsItem[]),
      reason?: string,
  ): this;
  addItems(items?: HTMLSfTabsItem | HTMLSfTabsItem[], reason?: string): this;
  setPanels(
      panels?:
          | HTMLSfTabsPanel[]
          | ((currentPanels: HTMLSfTabsPanel[]) => HTMLSfTabsPanel[]),
      reason?: string,
  ): this;
  addPanels(panels?: HTMLSfTabsPanel | HTMLSfTabsPanel[], reason?: string): this;
  goTo(index: number | string): this;
  onTabChange(
      handler: (
          index: number,
          detail?: Record<string, unknown>,
          event?: Event,
      ) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface HTMLSfFileUploadElement extends SmartComponentElement {
  getItems(): unknown[];
  setItems(items: unknown[]): this;
  clear(): this;
  removeItem(index: number): this;
  onFileAdd(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFileRemove(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFileError(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFileComplete(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onFileRetry(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
  onComplete(
      handler: (event: CustomEvent) => void,
      options?: AddEventListenerOptions | boolean,
  ): this;
}

export interface SFGlobal {
  create<TName extends string>(
      name: TName,
      params?: SmartComponentCreateParams,
  ): SmartComponentCreateResult<TName>;
  createAsync<TName extends string>(
      name: TName,
      params?: SmartComponentCreateParams,
  ): Promise<SmartComponentCreateResult<TName>>;
  whenDefine(name: string): Promise<string[]>;
  whenDefine(names: string[]): Promise<string[]>;
  whenDefined(name: string): Promise<string[]>;
  whenDefined(names: string[]): Promise<string[]>;
  Loader?: unknown;
  RuleLoader?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  var SF: SFGlobal;

  interface HTMLElementTagNameMap {
    'sf-avatars': HTMLSfAvatarsElement;
    'sf-alert': HTMLSfAlertElement;
    'sf-reference-link': HTMLSfReferenceLinkElement;
    'sf-range-slider': HTMLSfRangeSliderElement;
    'sf-toast': HTMLSfToastElement;
    'sf-tag': HTMLSfTagElement;
    'sf-skeleton': HTMLSfSkeletonElement;
    'sf-spinner': HTMLSfSpinnerElement;
    'sf-toggle': HTMLSfToggleElement;
    'sf-steps': HTMLSfStepsElement;
    'sf-switch': HTMLSfSwitchElement;
    'sf-radio': HTMLSfRadioElement;
    'sf-checkbox': HTMLSfCheckboxElement;
    'sf-button': HTMLSfButtonElement;
    'sf-icon-button': HTMLSfIconButtonElement;
    'sf-slider': HTMLSfSliderElement;
    'sf-modal': HTMLSfModalElement;
    'sf-gallery': HTMLSfGalleryElement;
    'sf-dropdown': HTMLSfDropdownElement;
    'sf-input': HTMLSfInputElement;
    'sf-textarea': HTMLSfTextareaElement;
    'sf-progress-bar': HTMLSfProgressBarElement;
    'sf-progress-scale': HTMLSfProgressScaleElement;
    'sf-pagination': HTMLSfPaginationElement;
    'sf-tabs': HTMLSfTabsElement;
    'sf-file-upload': HTMLSfFileUploadElement;
  }

  interface Window {
    SF: SFGlobal;
  }
}
