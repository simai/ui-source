import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations.js';
import { fieldSize } from '../../component/field-size';
import { renderTagTemplate } from './js/templates/default';
import { preloadControlIcons } from '../helpers/cycle';
import { instancePath, partId } from '../../core/js/instance-path.js';
import { tagInRow, tagLeftRow } from './js/tag-row.js';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const TAG_KINDS = ['checkbox', 'icon', 'default', 'color', 'avatar'];

// The glyphs the template draws in sf-icon: an icon tag's icon (sell when
// none is named) and an avatar tag's placeholder; a slot drawn instead asks
// for nothing. Read from the element, so it can be asked before it draws.
function drawnIcons(host) {
  const slotted = (name) => host.hasSlotContent?.(name);
  if (host.type === 'icon' && !slotted('leading')) return [host.icon || 'sell'];
  if (host.type === 'avatar' && !slotted('avatar') && !host.avatarImageUrl && !host.avatarText) return ['person'];
  return [];
}

// Asked for when the tag connects, before it draws (R074 F3, the remedy
// sf-segmented got in 2f588136): the inner sf-icon told the Loader its name
// only once the tag had drawn, a task or more after the tag was defined, and
// the page's first icon request, which waits a frame after the definitions,
// went without it; a second request followed 50-140 ms later, and on a slow
// service the tag's icon was blank until the full font arrived. Asked again
// when it draws (a name set later); one request per distinct list.
const preloadTagIcons = (host) =>
  preloadControlIcons(host, drawnIcons(host).map((icon) => ({icon, filled: false})));

const TAG_STATUSES = ['', 'info', 'success', 'warning', 'error'];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// `type` answered two questions from one list: what the tag carries (kind)
// and what it reports (status). It is not a setting any more and not a dated
// alias either -- an alias names one target and cannot split -- so the routing
// stays here, and each use is noted with the dates of journal
// attribute-tag-type-split. `quantity` was renamed to `default` before either
// axis was named: a dated value alias of kind (aliases.json), still read here
// for type="quantity".
const TYPE_SPLIT = {since: '2026-10-27', remove_after: '2026-12-01'};

function legacyType(element, axis) {
  const legacy = normalize(element?.getAttribute?.('type'));
  if (!legacy) return '';
  const kind = legacy === 'quantity' ? 'default' : legacy;
  const fits = axis === 'kind' ? TAG_KINDS.includes(kind) : TAG_STATUSES.includes(kind);
  if (fits) noteDeprecated({component: 'sf-tag', tag: 'sf-tag', kind: 'attribute', from: 'type', to: axis, ...TYPE_SPLIT});
  return fits ? kind : '';
}

// height (1.4.0, decision C27; docs precheck TG-02): the size's tightness
// steps, as on sf-button. spacing is its former name until 2027-01-01
// (journal attribute-tag-spacing-to-height): compact, comfortable and spacious
// draw as low, high and highest, and height wins when both are given.
const TAG_HEIGHTS = ['low', 'default', 'high', 'highest'];
const SPACING_HEIGHT = Object.freeze({compact: 'low', comfortable: 'high', spacious: 'highest'});

function tagHeight(element) {
  const raw = String(element.getAttribute('height') ?? '').trim().toLowerCase();
  if (raw && raw !== 'default') {
    if (TAG_HEIGHTS.includes(raw)) return raw;
    if (!element._sfHeightWarned) {
      element._sfHeightWarned = true;
      globalThis.console?.warn?.(`[SIMAI Framework] sf-tag: height="${raw}" is not a height; write low, default, high or highest (the size's steps). Read as default.`);
    }
    return 'default';
  }
  if (raw === 'default') return 'default';
  if (!element.hasAttribute('spacing')) return 'default';
  if (!element._sfSpacingNoted) {
    element._sfSpacingNoted = true;
    noteDeprecated({component: 'sf-tag', tag: 'sf-tag', kind: 'attribute', from: 'spacing', to: 'height', since: '2026-11-10', remove_after: '2027-01-01'});
  }
  return SPACING_HEIGHT[String(element.getAttribute('spacing')).trim().toLowerCase()] || 'default';
}

// appearance (1.4.0, docs precheck smart content, applied decision d): the
// faint fill with a hairline edge is outline, a name of C15's vocabulary;
// surface, the word C15 retired, is its former name until 2027-01-01 (journal
// value-tag-appearance-surface-to-outline) and draws the same.
function tagAppearance(element) {
  const raw = String(element.getAttribute('appearance') ?? '').trim().toLowerCase();
  if (raw !== 'surface') return ['default', 'outline', 'ghost'].includes(raw) ? raw : 'default';
  if (!element._sfSurfaceNoted) {
    element._sfSurfaceNoted = true;
    noteDeprecated({component: 'sf-tag', tag: 'sf-tag', kind: 'value', attribute: 'appearance', from: 'surface', to: 'outline', since: '2026-11-10', remove_after: '2027-01-01'});
  }
  return 'outline';
}

function resolveTagKind(element, raw, fallback) {
  const requested = normalize(raw);
  if (requested) {
    return requested === 'quantity' ? 'default' : (TAG_KINDS.includes(requested) ? requested : fallback);
  }
  return legacyType(element, 'kind') || fallback;
}

function resolveTagStatus(element, raw, fallback) {
  const requested = normalize(raw);
  if (requested) {
    return TAG_STATUSES.includes(requested) ? requested : fallback;
  }
  return legacyType(element, 'status') || fallback;
}

// sf-tag from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest; kind and status keep
// their parsers for the split of type. change keeps the browser's name with
// {active}; close is sf-tag-close, the old name close its dated alias.
const TagElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfTag extends TagElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // One closed list used to answer two questions: what the tag carries and
      // what it reports. They are separate axes now, and `type` keeps answering
      // both — see contracts/public-api-axes.json. The routing lives in the prop
      // rather than in a getter, because the template reads the props context.
      kind: {
        default: 'checkbox',
        values: TAG_KINDS,
        parser: (raw, fallback, element) => resolveTagKind(element, raw, fallback),
      },
      status: {
        default: '',
        values: TAG_STATUSES,
        parser: (raw, fallback, element) => resolveTagStatus(element, raw, fallback),
      },
    };
  }


  get componentName() {
    return 'tag';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get kind() {
    return this.getProp('kind');
  }

  set kind(value) {
    super.kind = value;
  }

  get status() {
    return this.getProp('status');
  }

  set status(value) {
    super.status = value;
  }

  // The legacy name, which answered both questions from one list: a status when
  // one is set, the kind otherwise.
  get type() {
    return this.status || this.kind;
  }

  set size(value) {
    super.size = value;
  }

  get size() {
    // On a text line the tag is one size down, the step a dropdown's size 1/2
    // field takes for its tags, so its label sits on the line.
    const line = this.line;
    if (line) return ({ '1/2': '1/3', '1': '1/2', '2': '1' })[line];
    return super.size;
  }

  // In a table cell or beside other text the tag takes the text line of a form
  // size, so the row keeps its control height.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-tag line') : '';
  }

  set line(value) {
    super.line = value;
  }

  get inline() {
    return Boolean(this.line) || super.inline;
  }

  set inline(value) {
    super.inline = value;
  }

  get rootClass() {
    return this.getRootClass();
  }

  // A checkbox tag removes only when asked: it is the default kind, and a remove
  // action on every filter chip would be a surprise. Asked, it is honoured --
  // it used to be dropped without a word (documentation trial, 2026-10-12).
  set closable(value) {
    super.closable = value;
  }

  get closable() {
    if (this.type === 'checkbox') return this.hasAttribute('closable') && this.getBooleanAttr('closable', true);

    if (this.hasAttribute('closable')) {
      return this.getBooleanAttr('closable', true);
    }

    return ['icon', 'color', 'avatar'].includes(this.type);
  }

  // An interactive tag (for example a filter chip that opens a menu) renders
  // its label as a real button next to the remove action, so both are
  // reachable and operable from the keyboard. Checkbox tags are buttons already.
  get interactive() {
    return this.type !== 'checkbox' && super.interactive;
  }

  set interactive(value) {
    super.interactive = value;
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      // A tag on a line resolves its size and inline mode from the line; the
      // kind is resolved too, so the canonical kind="checkbox" is interactive,
      // not only the legacy type="checkbox".
      kind: this.kind,
      type: this.type,
      size: this.size,
      height: tagHeight(this),
      appearance: tagAppearance(this),
      inline: this.inline,
      line: this.line,
      component: this,
      rootClass: this.rootClass,
      closable: this.closable,
      interactive: this.interactive,
      closeLabel: this.closeLabel,
      active: this.active,
      ariaLabel: this.getAttribute('aria-label') || '',
      // A name cut with an ellipsis has its whole text as the tag's tooltip
      // (C58; TG-1), the Framework's plain tooltip.
      cutTooltipId: this._sfCut ? partId(instancePath(this, {kind: 'sf-tag'}), 'name') : '',
      cutText: this._sfCut ? this.cutText() : '',
    });
  }

  // The label's whole text, as the tooltip says it.
  cutText() {
    const label = this.querySelector(':scope > .sf-tag .sf-tag-container');
    return String(label?.textContent ?? this.text ?? '').trim();
  }

  // Whether the drawn label is cut: read from the label, since the column,
  // the font and the row decide it, not the length of the text.
  measureCut() {
    const label = this.querySelector(':scope > .sf-tag .sf-tag-container');
    const cut = Boolean(label && label.scrollWidth - label.clientWidth > 0.5);
    if (cut === Boolean(this._sfCut)) return;
    this._sfCut = cut;
    this.requestComponentUpdate('cut');
  }

  watchCut() {
    const label = this.querySelector(':scope > .sf-tag .sf-tag-container');
    if (!label || typeof ResizeObserver === 'undefined') return;
    if (this._sfCutLabel === label) return;
    this._sfCutObserver?.disconnect();
    this._sfCutLabel = label;
    this._sfCutObserver = new ResizeObserver(() => this.measureCut());
    this._sfCutObserver.observe(label);
  }

  afterRender(changed) {
    const result = super.afterRender(changed);
    this.watchCut();
    this.measureCut();
    // The row the tag stands in shows what fits and «+N», and walks closable
    // tags in a field by keys (js/tag-row.js).
    if (!this.hasAttribute('data-sf-tag-more')) tagInRow(this);
    this._sfRow = this.parentElement;
    return result;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._sfCutObserver?.disconnect();
    this._sfCutObserver = null;
    this._sfCutLabel = null;
    tagLeftRow(this._sfRow);
    this._sfRow = null;
  }

  onToggle() {
    if (this.disabled || this.type !== 'checkbox') return;

    const active = !this.active;
    this.toggleAttribute('active', active);
    // §8: a person's change, under the browser's name, with data only.
    this.sfEmit('change', { active });
  }

  onClose() {
    if (this.disabled || !this.closable) return;

    // sf-tag-close (§8); the shim sends the old name close after it.
    this.sfEmit('close', {});
  }

  connectedCallback() {
    super.connectedCallback();
    // After the base has read the slots and the settings, before the update
    // it requested draws the tag.
    if (this.isConnected) preloadTagIcons(this);
  }

  template() {
    preloadTagIcons(this);
    return renderTagTemplate(this.templateContext());
  }

  get value() {
    return {
      template: this.templateName,
      kind: this.kind,
      status: this.status,
      type: this.type,
      appearance: this.appearance,
      size: this.size,
      spacing: this.spacing,
      inline: this.inline,
      line: this.line,
      text: this.text,
      count: this.count,
      icon: this.icon,
      colorClass: this.colorClass,
      avatarImageUrl: this.avatarImageUrl,
      avatarText: this.avatarText,
      avatarStatus: this.avatarStatus,
      rootClass: this.rootClass,
      active: this.active,
      disabled: this.disabled,
      closable: this.closable,
      ariaLabel: this.getAttribute('aria-label') || '',
      closeLabel: this.closeLabel,
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfTag.define('sf-tag');
