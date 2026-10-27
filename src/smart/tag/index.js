import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations.js';
import { fieldSize } from '../../component/field-size';
import { renderTagTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const TAG_KINDS = ['checkbox', 'icon', 'default', 'color', 'avatar'];
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
      inline: this.inline,
      line: this.line,
      component: this,
      rootClass: this.rootClass,
      closable: this.closable,
      interactive: this.interactive,
      closeLabel: this.closeLabel,
      active: this.active,
      ariaLabel: this.getAttribute('aria-label') || '',
    });
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

  template() {
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
