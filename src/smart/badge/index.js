import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { fieldSize } from '../../component/field-size';
import {
  BADGE_SCHEMES,
  BADGE_SIZES,
  normalizeBadgeContract,
} from '../../component/badges/js/contract';
import { renderBadgeTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';


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

// sf-badge from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest; type, icon-left and
// icon-right, and the values danger, left and right, are dated aliases
// (aliases.json, until 2026-12-01). scheme and status keep their parsers: a
// status word written as a scheme still reaches the status axis
// (journal attribute-badge-scheme-to-status), and scheme stays the colour role.
const BadgeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfBadge extends BadgeElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
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
    };
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
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

  // Null when the attribute is not there, '' when it is there and empty: an
  // empty icon-start suppresses the icon shortcut, an absent one lets it
  // through. icon-left and icon-right write these through the dated aliases.
  get iconStart() {
    return this.getAttribute('icon-start');
  }

  set iconStart(value) {
    super.iconStart = value;
  }

  get iconEnd() {
    return this.getAttribute('icon-end');
  }

  set iconEnd(value) {
    super.iconEnd = value;
  }

  templateContext() {
    const props = this.getPropsContext();
    const variant = normalizeBadgeContract(props);

    return this.createTemplateContext({
      ...props,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      ...variant,
      appearance: this.appearance,
      ariaLabel: this.getAttribute('aria-label') || '',
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
      type: this.appearance,
      scheme: this.scheme,
      status: this.status,
      text: this.text,
      icon: this.icon,
      iconLeft: this.iconStart ?? '',
      iconRight: this.iconEnd ?? '',
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      iconPosition: this.iconPosition,
      ariaLabel: this.getAttribute('aria-label') || '',
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfBadge.define('sf-badge');
