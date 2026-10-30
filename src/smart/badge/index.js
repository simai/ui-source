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

// What each run state draws. A spinner has no icon name; the words are in
// lang/ (runtime activity-*). The role is the colour class, the same classes a
// status or a colour role paints with, so every appearance holds for it.
const BADGE_ACTIVITIES = {
  running: {role: 'neutral', spinner: true, word: 'activity-running'},
  waiting: {role: 'warning', icon: 'pending_actions', word: 'activity-waiting'},
  done: {role: 'success', icon: 'check_circle', word: 'activity-done'},
  stopped: {role: 'neutral', icon: 'stop_circle', word: 'activity-stopped'},
  failed: {role: 'error', icon: 'error', word: 'activity-failed'},
};

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

  // What the run state draws, null without one.
  get activityMark() {
    return BADGE_ACTIVITIES[this.activity] ?? null;
  }

  // One colour name reaches the class list, because the styles are written that
  // way: the run state's role when one is set, then the status, then the colour
  // role. status and scheme stay as the host set them.
  get paintedScheme() {
    return this.activityMark?.role || this.status || this.scheme;
  }

  // The text the badge draws: the host's, else the run state's word.
  get drawnText() {
    const mark = this.activityMark;
    return this.text || (mark ? this.sfWord(mark.word) : '');
  }

  // The icon shortcut the badge draws: the host's, else the run state's.
  get drawnIcon() {
    return this.icon || this.activityMark?.icon || '';
  }

  // The spinner stands in the icon's place only while the host gave no icon.
  get activitySpinner() {
    return Boolean(this.activityMark?.spinner && !this.icon);
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
      paintedScheme: this.paintedScheme,
      drawnText: this.drawnText,
      drawnIcon: this.drawnIcon,
      activitySpinner: this.activitySpinner,
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
      activity: this.activity,
      compact: this.compact,
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
