// sf-tile-metric: one number that matters on an admin or dashboard screen,
// with its change, its limit and its status -- server load, storage used of a
// quota, visitors against last week, queue depth, licence seats:
//
//   <sf-tile-metric label="Подкачка" value="83" max="100" format="unit-percent"
//     warning-at="80" error-at="95" hint="серверу не хватает памяти"></sf-tile-metric>
//
// The tile formats the value in the page language (core's formatNumber), works
// out the change from the previous value when the page gives no delta, and
// draws the limit as a meter with sf-progress-bar. Whether a rise is good
// (better), the thresholds (warning-at, error-at) and the status are the
// page's; the tile only compares. href makes the whole tile one link, openable
// one button that sends open; a chart comes from the page in slot="chart".
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8):
// the settings are made by core/js/element-manifest.js, the words are the
// language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {formatNumber} from '../../core/js/format-number.js';
import {renderTileMetricTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The label's id, one per tile on the page (the same on every render, so a
// first-paint snapshot is stable).
let sequence = 0;

const RANK = {warning: 1, error: 2};
export const STATUSES = ['neutral', 'success', 'warning', 'error', 'info'];
// sf-alert's status icons, by the shared status words.
export const ICONS = {success: 'check_circle', info: 'info', warning: 'warning', error: 'error', neutral: 'info'};
// The change's tone as an sf-badge status: better is success, worse is error.
const BADGE = {positive: 'success', negative: 'error', neutral: ''};
const ARROWS = {up: 'arrow_upward', down: 'arrow_downward', flat: 'remove'};

/** The threshold a share of the limit reached, in per cent: '', warning or error. */
export function thresholdStatus(percent, warningAt, errorAt) {
  if (!Number.isFinite(percent)) return '';
  if (Number.isFinite(errorAt) && percent >= errorAt) return 'error';
  if (Number.isFinite(warningAt) && percent >= warningAt) return 'warning';
  return '';
}

/** The more serious of the page's status and the threshold reached. */
export function drawnStatus(status, reached) {
  const given = STATUSES.includes(status) ? status : 'neutral';
  return (RANK[reached] ?? 0) > (RANK[given] ?? 0) ? reached : given;
}

/**
 * The change against the previous period: delta, else value − previous.
 * direction up|down|flat, tone positive|negative|neutral by `better`, and
 * the change's share of the previous value (null without one).
 */
export function changeOf({value = null, previous = null, delta = null, better = 'up'} = {}) {
  let change = delta;
  if (change === null && previous !== null && value !== null) change = value - previous;
  if (change === null || !Number.isFinite(change)) return null;
  const base = previous ?? (value !== null ? value - change : null);
  const share = base ? change / Math.abs(base) : null;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const tone = direction === 'flat' || better === 'none' ? 'neutral' : direction === better ? 'positive' : 'negative';
  return {change, share, direction, tone};
}

const TileMetricElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfTileMetric extends TileMetricElement {
  constructor() {
    super();
    this._uid = `sf-tile-metric-${++sequence}`;
  }

  words(key, vars) {
    return this.sfWord(key, vars ? {vars} : {});
  }

  // A number setting holds only where the page set it: an unset number reads 0.
  given(attribute) {
    if (!this.hasAttribute(attribute)) return null;
    const number = Number(this.getAttribute(attribute));
    return this.getAttribute(attribute).trim() !== '' && Number.isFinite(number) ? number : null;
  }

  say(value) {
    return formatNumber(value, this.format, {node: this, gap: this.words('no-value')});
  }

  change(value) {
    const found = changeOf({value, previous: this.given('previous'), delta: this.given('delta'), better: this.better});
    if (!found) return null;
    const sign = found.change > 0 ? '+' : found.change < 0 ? '−' : '';
    const absolute = `${sign}${this.say(Math.abs(found.change))}`;
    const percent = found.share === null ? '' : `${sign}${formatNumber(Math.abs(found.share), 'percent', {node: this})}`;
    const text = this.deltaFormat === 'absolute' || !percent ? absolute
      : this.deltaFormat === 'both' ? `${percent} (${absolute})` : percent;
    return {...found, text, badge: BADGE[found.tone], arrow: ARROWS[found.direction], word: this.words(`change-${found.direction}`)};
  }

  // The limit as a meter: «45 ГБ из 100 ГБ», 45 %, and the threshold it reached.
  meter(value) {
    const max = this.given('max');
    if (max === null || max <= 0 || value === null) return null;
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    const text = this.limitText || this.words('limit', {value: this.say(value), max: this.say(max)});
    return {
      max,
      value: Math.max(0, Math.min(max, value)),
      percent: Math.round(percent * 100) / 100,
      reached: thresholdStatus(percent, this.given('warning-at'), this.given('error-at')),
      warningAt: this.given('warning-at'),
      errorAt: this.given('error-at'),
      text,
      name: this.words('limit-name', {label: this.label || this.words('untitled')}),
    };
  }

  open() {
    this.sfEmit('open', {id: this.id || ''});
  }

  templateContext() {
    const loading = Boolean(this.loading);
    const value = loading ? null : this.given('value');
    const meter = loading ? null : this.meter(value);
    const status = drawnStatus(this.status, meter?.reached ?? '');
    const target = this.href ? 'link' : this.openable ? 'button' : '';
    const hasChart = this.hasSlotContent?.('chart') ?? false;
    this.sfHostState('data-status', status);
    this.sfHostState('data-loading', loading);
    let valueText = this.words('no-value');
    if (value !== null) valueText = this.valueText || this.say(value);
    else if (this.valueText && !loading) valueText = this.valueText;
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      uid: this._uid,
      size: ['1/2', '1', '2'].includes(this.size) ? this.size : '1',
      loading,
      target,
      href: this.href,
      labelShown: this.label || this.words('untitled'),
      valueShown: valueText,
      unit: this.unit,
      change: value === null ? null : this.change(value),
      periodText: this.periodText,
      meter,
      status,
      statusIcon: ICONS[status],
      statusWord: status === 'neutral' ? '' : this.words(`status-${status}`),
      hint: this.hint,
      hasChart,
      chart: hasChart ? this.getSlotContent('chart') : null,
      loadingWord: this.words('loading'),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderTileMetricTemplate(this.templateContext());
  }
}

SfTileMetric.define('sf-tile-metric');

export {SfTileMetric};
