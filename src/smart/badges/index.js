import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import {
  BADGE_SCHEMES,
  BADGE_SIZES,
  BADGE_TYPES,
  normalizeBadgeContract,
} from '../../component/badges/js/contract';
import { renderBadgeTemplate } from './js/templates/default';


const BADGE_COLOUR_ROLES = ['neutral', 'primary', 'secondary', 'tertiary', 'on-surface'];
const BADGE_STATUSES = ['', 'info', 'success', 'warning', 'error'];
const BADGE_STATUS_LEGACY = {error: 'danger'};

const normalizeName = (value) => String(value ?? '').trim().toLowerCase();

function resolveBadgeScheme(element, raw, fallback) {
  const requested = normalizeName(raw) || normalizeName(element?.getAttribute?.('scheme'));

  return BADGE_COLOUR_ROLES.includes(requested) ? requested : fallback;
}

// A status may arrive as `status`, or as the legacy `scheme` that carried both
// colour roles and status words in one list. `danger` remains accepted.
function resolveBadgeStatus(element, raw, fallback) {
  const canonical = (value) => {
    const name = normalizeName(value);
    for (const [status, legacy] of Object.entries(BADGE_STATUS_LEGACY)) {
      if (name === legacy) {
        return status;
      }
    }

    return BADGE_STATUSES.includes(name) && name !== '' ? name : '';
  };

  return canonical(raw) || canonical(element?.getAttribute?.('scheme')) || fallback;
}

class SfBadge extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1/3', values: BADGE_SIZES },
      line: { default: '' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: {default: 'main', values: BADGE_TYPES, aliases: ['type']},
      // `scheme` answered two questions at once: which semantic colour the badge
      // takes, and what it reports. A status word given as a scheme still works
      // and is routed to the status axis.
      scheme: {
        default: 'neutral',
        values: BADGE_COLOUR_ROLES,
        parser: (raw, fallback, element) => resolveBadgeScheme(element, raw, fallback),
      },
      status: {
        default: '',
        values: BADGE_STATUSES,
        parser: (raw, fallback, element) => resolveBadgeStatus(element, raw, fallback),
      },
      text: { default: '' },
      icon: { default: '' },
      iconStart: {type: String, default: null},
      iconEnd: {type: String, default: null},
      iconLeft: { default: '' },
      iconRight: { default: '' },
      iconPosition: { default: 'start' },
      ariaLabel: { default: '' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return this.getEnumAttr('size', BADGE_SIZES, '1/3');
  }

  // In a row or a table cell the element takes the text line of a form size,
  // so the row keeps its control height.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-badge line') : '';
  }


  get appearance() {
    return normalizeBadgeContract({
      type: this.getProp('appearance'),
      scheme: this.paintedScheme,
      size: this.getEnumAttr('size', BADGE_SIZES, '1/3'),
    }).type;
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.appearance;
  }

  get scheme() {
    return this.getProp('scheme');
  }

  get status() {
    return this.getProp('status');
  }

  // One colour name reaches the class list, because the styles are written that
  // way: the status when one is set, the colour role otherwise.
  get paintedScheme() {
    return this.status || this.scheme;
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get icon() {
    return this.getAttribute('icon') || '';
  }

  get iconLeft() {
    return this.getAttribute('icon-start') ?? this.getAttribute('icon-left') ?? '';
  }

  get iconRight() {
    return this.getAttribute('icon-end') ?? this.getAttribute('icon-right') ?? '';
  }

  get iconStart() {
    return this.iconLeft;
  }

  get iconEnd() {
    return this.iconRight;
  }

  get iconPosition() {
    return this.getAttribute('icon-position') || 'start';
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();
    const variant = normalizeBadgeContract(props);

    return this.createTemplateContext({
      ...props,
      iconLeft: props.iconStart ?? props.iconLeft,
      iconRight: props.iconEnd ?? props.iconRight,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      ...variant,
      component: this,
    });
  }

  template() {
    return renderBadgeTemplate(this.templateContext());
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      line: this.line,
      appearance: this.appearance,
      type: this.type,
      scheme: this.scheme,
      status: this.status,
      text: this.text,
      icon: this.icon,
      iconLeft: this.iconLeft,
      iconRight: this.iconRight,
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      iconPosition: this.iconPosition,
      ariaLabel: this.ariaLabel,
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfBadge.define('sf-badge');
