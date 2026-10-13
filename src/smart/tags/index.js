import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { renderTagTemplate } from './js/templates/default';
import { pageText } from '../../core/js/page-language';

const TAG_TEXT = { en: { remove: 'Remove' }, ru: { remove: 'Удалить' } };

const TAG_KINDS = ['checkbox', 'icon', 'default', 'color', 'avatar'];
const TAG_STATUSES = ['', 'info', 'success', 'warning', 'error'];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// `quantity` was renamed to `default` before either axis was named, and it is
// still accepted.
function resolveTagKind(element, raw, fallback) {
  const requested = normalize(raw);
  if (requested) {
    return requested === 'quantity' ? 'default' : (TAG_KINDS.includes(requested) ? requested : fallback);
  }
  const legacy = normalize(element?.getAttribute?.('type'));
  if (legacy === 'quantity') {
    return 'default';
  }

  return TAG_KINDS.includes(legacy) ? legacy : fallback;
}

function resolveTagStatus(element, raw, fallback) {
  const requested = normalize(raw);
  if (requested) {
    return TAG_STATUSES.includes(requested) ? requested : fallback;
  }
  const legacy = normalize(element?.getAttribute?.('type'));

  return TAG_STATUSES.includes(legacy) && legacy !== '' ? legacy : fallback;
}

class SfTag extends SfBaseElement {
  static get props() {
    return {
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
      appearance: { default: 'default', values: ['default', 'surface', 'ghost'] },
      size: { default: '1/2', values: ['1/3', '1/2', '1', '2', '3'] },
      spacing: { default: 'normal', values: ['compact', 'normal', 'comfortable', 'spacious'] },
      inline: { type: Boolean, default: false },
      line: { default: '' },
      text: { default: '' },
      count: { default: '' },
      icon: { default: '' },
      colorClass: { default: '' },
      avatarImageUrl: { default: '' },
      avatarText: { default: '' },
      rootClass: { default: '' },
      avatarStatus: { default: '' },
      active: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      closable: { type: Boolean, default: false },
      interactive: { type: Boolean, default: false },
      ariaLabel: { default: '' },
      closeLabel: { default: '' },
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

  get status() {
    return this.getProp('status');
  }

  // The legacy name, which answered both questions from one list: a status when
  // one is set, the kind otherwise.
  get type() {
    return this.status || this.kind;
  }

  // The appearance is its own axis: what the tag looks like, not what it carries.
  get appearance() {
    return this.getEnumAttr('appearance', ['default', 'surface', 'ghost'], 'default');
  }

  get size() {
    // On a text line the tag is one size down, the step a dropdown's size 1/2
    // field takes for its tags, so its label sits on the line.
    const line = this.line;
    if (line) return ({ '1/2': '1/3', '1': '1/2', '2': '1' })[line];
    return this.getEnumAttr('size', ['1/3', '1/2', '1', '2', '3'], '1/2');
  }

  // In a table cell or beside other text the tag takes the text line of a form
  // size, so the row keeps its control height.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-tag line') : '';
  }

  get spacing() {
    return this.getEnumAttr('spacing', ['compact', 'normal', 'comfortable', 'spacious'], 'normal');
  }

  get inline() {
    return Boolean(this.line) || this.getBooleanAttr('inline', false);
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get count() {
    return this.getAttribute('count') || '';
  }

  get icon() {
    return this.getAttribute('icon') || '';
  }

  get colorClass() {
    return this.getAttribute('color-class') || '';
  }

  get avatarImageUrl() {
    return this.getAttribute('avatar-image-url') || '';
  }

  get avatarText() {
    return this.getAttribute('avatar-text') || '';
  }

  get avatarStatus() {
    return this.getAttribute('avatar-status') || '';
  }

  get rootClass() {
    return this.getRootClass();
  }

  get active() {
    return this.getBooleanAttr('active', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  // A checkbox tag removes only when asked: it is the default kind, and a remove
  // action on every filter chip would be a surprise. Asked, it is honoured --
  // it used to be dropped without a word (documentation trial, 2026-10-12).
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
    return this.type !== 'checkbox' && this.getBooleanAttr('interactive', false);
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  get closeLabel() {
    return this.getAttribute('close-label') || pageText(TAG_TEXT, 'remove', this);
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
    });
  }

  onToggle() {
    if (this.disabled || this.type !== 'checkbox') return;

    const active = !this.active;
    this.toggleAttribute('active', active);
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { active, component: this },
    }));
  }

  onClose() {
    if (this.disabled || !this.closable) return;

    this.dispatchEvent(new CustomEvent('close', {
      bubbles: true,
      composed: true,
      detail: { component: this },
    }));
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
      ariaLabel: this.ariaLabel,
      closeLabel: this.closeLabel,
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfTag.define('sf-tag');
