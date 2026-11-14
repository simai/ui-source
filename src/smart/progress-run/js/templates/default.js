import {html, nothing} from 'lit';
import {unsafeStatic, html as staticHtml} from 'lit/static-html.js';

// sf-progress-run's markup (scss/ draws it on one rung of the ladder).
//
// look full (C34): a region named by label, in groups the sheet spaces by
// meaning (R073):
// - head: the title, a heading of heading-level, with the state badge on its
//   first line and the caption under it;
// - progress: the overall sf-progress-bar (indeterminate while the size is
//   unknown) and the figures line «N из M · %» with the time left (not live);
// - results: once ended, the result line and the counts as one line of text,
//   a non-zero error count a link to the error list;
// - errors: the first errors, a list the error link moves to;
// - steps: an ordered list: the state glyph (sf-steps' set, running turning),
//   the title with its state said in words (visually hidden), the step's
//   figures and text, and the time at the end; the running one is
//   aria-current; a step with a log is a toggle (aria-expanded,
//   aria-controls) over its log;
// - output: once there is output, a toggle (sf-button, aria-expanded,
//   aria-controls); open, a pre in a scroller of role log (not live,
//   focusable to scroll), with copy (sf-button-copy, the pre as its target)
//   and download. A job with no output has no toggle;
// - actions: «Ещё N ошибок» at the start, then Minimize, Pause/Continue,
//   Cancel, Retry and Hide, as their states allow.
// The result line is the status live region: it says the result and the
// state changes. A second region, polite and visually hidden, says the count
// while the job runs, at most every ANNOUNCE_MS (index.js); nothing else is
// live.
//
// look row (a table row; compact is its dated former name, C134): one line --
// the bar and «62 % · 3 мин» while it runs, the badge once it stopped -- and
// icon actions. look notice: the mark in the icon field (the ring, or the
// state's icon), the name and a line of figures, and Expand.

// The rung below the run's: texts, times, the output, the badges and the
// buttons. A size the template gives is relative to the run's (density, C22).
const BELOW = {'1/2': '1/3', 1: '1/2'};

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-progress-run-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

function badge(context, size) {
  const {stateLook, badgeText} = context;
  return html`<sf-badge class="sf-progress-run-badge" size=${size} appearance="tonal"
    activity=${stateLook.activity || nothing} status=${stateLook.status || nothing} icon-start=${stateLook.icon || nothing}
    text=${badgeText || nothing}></sf-badge>`;
}

function bar(context, extra = '') {
  return html`<sf-progress-bar class=${['sf-progress-run-bar', extra].filter(Boolean).join(' ')} value=${String(context.barValue)}
    status=${context.barStatus} ?indeterminate=${context.indeterminate} ?paused=${context.state === 'paused'}
    text-position="none" label=${context.regionLabel}></sf-progress-bar>`;
}

function heading(context) {
  const {ids, label, caption, headingLevel} = context;
  if (!label && !caption) return nothing;
  const tag = unsafeStatic(`h${headingLevel}`);
  const below = BELOW[context.size];
  return html`<div class="sf-progress-run-head">
    ${label ? staticHtml`<${tag} class="sf-progress-run-heading" id=${ids.heading}>${label}</${tag}>` : nothing}
    <span class="sf-progress-run-state">${badge(context, below)}</span>
    ${caption ? html`<p class="sf-progress-run-caption">${caption}</p>` : nothing}
  </div>`;
}

function progress(context) {
  // A run of steps alone (1.2's look) has no overall bar while it waits or
  // once it ended: its steps say it. While it runs with no size, the bar runs.
  if (!context.showBar) return nothing;
  return html`<div class="sf-progress-run-progress">
    ${context.showBar ? bar(context) : nothing}
    ${context.figures || context.time ? html`<div class="sf-progress-run-figures">
      ${context.figures ? html`<span class="sf-progress-run-done">${context.figures}</span>` : nothing}
      ${context.time ? html`<span class="sf-progress-run-eta">${context.time}</span>` : nothing}
    </div>` : nothing}
  </div>`;
}

function counts(context) {
  const {component, counters, ids, errors} = context;
  if (!counters.length) return nothing;
  return html`<p class="sf-progress-run-counts">${counters.map((counter) => {
    if (counter.error && !counter.zero) {
      return html`<span class="sf-progress-run-count sf-progress-run-count--error" data-id=${counter.id || nothing}><a class="sf-progress-run-count-link"
        href=${errors.length ? `#${ids.errors}` : '#'} @click=${(event) => component.onReport(event)}>${counter.words}</a></span>`;
    }
    return html`<span class=${`sf-progress-run-count${counter.zero ? ' sf-progress-run-count--zero' : ''}`} data-id=${counter.id || nothing}>${counter.words}</span>`;
  })}</p>`;
}

// The result line is the run's one status live region, always there (1.2
// kept its class and role): once ended it shows the result with its icon;
// before, it is visually hidden and holds only a state change to say
// (paused, going on), so the percentages are never read.
function result(context) {
  const {ended, state, icons, resultShown} = context;
  if (!ended) return html`<div class=${`sf-progress-run-result sf-progress-run-result--${state} sr-only`} role="status">${context.announcement}</div>`;
  return html`<div class=${`sf-progress-run-result sf-progress-run-result--${state}`} role="status">
    ${icon(icons[state], `sf-progress-run-icon--${state}`)}<span class="sf-progress-run-result-text">${resultShown}</span>
  </div>`;
}

function results(context) {
  if (!context.ended && !context.counters.length) return result(context);
  return html`<div class="sf-progress-run-results">
    ${result(context)}
    ${counts(context)}
  </div>`;
}

function errorList(context) {
  const {errors, ids, words} = context;
  if (!errors.length) return nothing;
  return html`<ul class="sf-progress-run-errors" id=${ids.errors} tabindex="-1" aria-label=${words.errorsList}>
    ${errors.map((error) => html`<li class="sf-progress-run-error">
      <span class="sf-progress-run-error-where">${error.where}</span>
      <span class="sf-progress-run-error-key">${error.key}</span>
      <span class="sf-progress-run-error-text">${error.text}</span>
    </li>`)}
  </ul>`;
}

function step(context, item) {
  const {component, ids, words} = context;
  const logId = `${ids.log}-${item.id}`;
  const body = html`${icon(context.icons[item.state], `sf-progress-run-icon--${item.state}`)}
    <span class="sf-progress-run-step-text">
      <span class="sf-progress-run-step-title">${item.title}<span class="sr-only">, ${item.stateWord}</span></span>
      ${item.figures ? html`<span class="sf-progress-run-step-supporting sf-progress-run-step-figures">${item.figures}</span>` : nothing}
      ${item.text ? html`<span class="sf-progress-run-step-supporting">${item.text}</span>` : nothing}
    </span>`;
  return html`<li class=${`sf-progress-run-step sf-progress-run-step--${item.state}${item.log ? ' sf-progress-run-step--log' : ''}`} data-id=${item.id} data-state=${item.state}
      aria-current=${item.state === 'running' ? 'step' : nothing}>
    ${item.log
      ? html`<button type="button" class="sf-progress-run-step-toggle" aria-expanded=${item.logOpen ? 'true' : 'false'} aria-controls=${logId}
          title=${words.stepLog} @click=${() => component.toggleStepLog(item.id)}>${body}${icon(item.logOpen ? 'expand_less' : 'expand_more', 'sf-progress-run-icon--chevron')}</button>`
      : body}
    ${item.time ? html`<span class="sf-progress-run-time">${item.time}</span>` : nothing}
    ${item.log && item.logOpen ? html`<pre class="sf-progress-run-step-log" id=${logId} role="log" aria-live="off" aria-label=${`${words.stepLog}: ${item.title}`} tabindex="0">${item.log}</pre>` : nothing}
  </li>`;
}

function output(context) {
  const {component, ids, size, outputOpen, words} = context;
  // No output, no toggle: an empty «Вывод» is a button that opens nothing.
  // The first chunk brings it.
  if (!context.outputShown) return nothing;
  const below = BELOW[size];
  return html`<div class="sf-progress-run-output-block">
    <div class="sf-progress-run-output-bar">
      <sf-button class="sf-progress-run-toggle" size=${below} appearance="ghost" text=${context.outputLabel}
        icon-end=${outputOpen ? 'expand_less' : 'expand_more'} expanded=${outputOpen ? 'true' : 'false'} aria-controls=${ids.output}
        @click=${() => component.toggleOutput()}></sf-button>
      ${outputOpen ? html`<span class="sf-progress-run-output-tools">
        <sf-button-copy class="sf-progress-run-copy" size=${below} appearance="ghost" target=${`#${ids.output}-text`} label=${words.copy}></sf-button-copy>
        <sf-button-icon class="sf-progress-run-download" size=${below} appearance="ghost" icon="download"
          aria-label=${words.download} title=${words.download} @click=${() => component.onDownload()}></sf-button-icon>
      </span>` : nothing}
    </div>
    ${outputOpen ? html`<div class="sf-progress-run-output" id=${ids.output} role="log" aria-live="off" aria-label=${context.outputLabel} tabindex="0">
      <pre class="sf-progress-run-output-text" id=${`${ids.output}-text`}>${context.outputShown}</pre>
    </div>` : nothing}
  </div>`;
}

function actions(context) {
  const {component, size, words, showCancel, showRetry, showHide, showPause, showResume, showMinimize, moreErrors} = context;
  if (!showCancel && !showRetry && !showHide && !showPause && !showResume && !showMinimize && !moreErrors) return nothing;
  const below = BELOW[size];
  return html`<div class="sf-progress-run-actions">
    ${moreErrors ? html`<sf-button class="sf-progress-run-more" size=${below} appearance="ghost" text=${words.moreErrors}
      @click=${() => component.onReport()}></sf-button>` : nothing}
    ${showMinimize ? html`<sf-button class="sf-progress-run-minimize" size=${below} appearance="ghost" icon-start="close_fullscreen" text=${words.minimize}
      @click=${() => component.onMinimize()}></sf-button>` : nothing}
    ${showPause ? html`<sf-button class="sf-progress-run-pause" size=${below} appearance="outline" icon-start="pause" text=${words.pause}
      @click=${() => component.onPause()}></sf-button>` : nothing}
    ${showResume ? html`<sf-button class="sf-progress-run-resume" size=${below} appearance="outline" icon-start="play_arrow" text=${words.resume}
      @click=${() => component.onResume()}></sf-button>` : nothing}
    ${showCancel ? html`<sf-button class="sf-progress-run-cancel" size=${below} appearance="outline" status="danger" text=${words.cancel}
      @click=${() => component.onCancel()}></sf-button>` : nothing}
    ${showRetry ? html`<sf-button class="sf-progress-run-retry" size=${below} appearance=${context.state === 'cancelled' ? 'outline' : 'default'} icon-start="replay" text=${context.retryWord}
      data-scope=${context.state === 'partial' ? 'failed' : 'all'} data-from=${context.retryFrom || nothing}
      @click=${() => component.onRetry()}></sf-button>` : nothing}
    ${showHide ? html`<sf-button class="sf-progress-run-hide" size=${below} appearance="ghost" text=${words.hide}
      @click=${() => component.onHide()}></sf-button>` : nothing}
  </div>`;
}

// The icon actions of the compact and notice looks.
function iconActions(context) {
  const {component, size, words, showCancel, showRetry, showPause, showResume, view, regionLabel} = context;
  const below = BELOW[size];
  const one = (name, glyph, label, press) => html`<sf-button-icon class=${`sf-progress-run-${name}`} size=${below} appearance="ghost" scheme="on-surface-variant"
    icon=${glyph} aria-label=${label} title=${label} @click=${press}></sf-button-icon>`;
  return html`<span class="sf-progress-run-icon-actions">
    ${showPause ? one('pause', 'pause', words.pause, () => component.onPause()) : nothing}
    ${showResume ? one('resume', 'play_arrow', words.resume, () => component.onResume()) : nothing}
    ${showCancel && view === 'row' ? one('cancel', 'close', words.cancel, () => component.onCancel()) : nothing}
    ${showRetry && view === 'row' ? one('retry', 'replay', context.retryWord, () => component.onRetry()) : nothing}
    ${view === 'notice' ? one('expand', 'open_in_full', `${words.expand}: ${regionLabel}`, () => component.onExpand()) : nothing}
  </span>`;
}

function row(context) {
  const {state, ended, size} = context;
  const running = state === 'running' || state === 'paused';
  const short = state === 'paused'
    ? [context.badgeText, context.figuresShort].filter(Boolean).join(' · ')
    : [context.figuresShort, context.timeShort].filter(Boolean).join(' · ');
  return html`<div class="sf-progress-run-line">
    ${running
      ? html`<span class="sf-progress-run-inline">${bar(context)}${short ? html`<span class="sf-progress-run-figures-short">${short}</span>` : nothing}</span>`
      : badge(context, BELOW[size])}
    ${ended || running ? iconActions(context) : nothing}
  </div>`;
}

function notice(context) {
  const {state, ended, component, ids, regionLabel, icons, errors} = context;
  const running = state === 'running' || state === 'paused';
  const mark = running
    ? html`<sf-progress-ring class="sf-progress-run-ring" size="1/2" value=${String(context.barValue)} status=${context.barStatus}
        ?indeterminate=${context.indeterminate} label=${regionLabel}></sf-progress-ring>`
    : icon(icons[state] ?? icons.waiting, `sf-progress-run-icon--${state}`);
  let line;
  if (state === 'partial') {
    line = html`${context.figuresPlain ? html`${context.figuresPlain} · ` : nothing}<a class="sf-progress-run-count-link" href=${errors.length ? `#${ids.errors}` : '#'}
      @click=${(event) => component.onReport(event)}>${context.words.errorsCount}</a>`;
  } else if (ended) {
    line = context.resultShown;
  } else if (state === 'paused') {
    line = [context.badgeText, context.figuresShort].filter(Boolean).join(' · ');
  } else if (state === 'waiting') {
    line = context.badgeText;
  } else {
    line = [context.figuresShort || context.caption, context.time].filter(Boolean).join(' · ');
  }
  return html`<div class="sf-progress-run-line">
    <span class="sf-progress-run-mark">${mark}</span>
    <span class="sf-progress-run-notice-text">
      <span class="sf-progress-run-notice-title">${regionLabel}</span>
      <span class="sf-progress-run-notice-figures">${line}</span>
    </span>
    ${iconActions(context)}
  </div>`;
}

export function renderProgressRunTemplate(context) {
  const {size, state, view, ids, label} = context;
  const classes = [
    'sf-progress-run',
    `sf-progress-run--size-${size === '1/2' ? 'half' : '1'}`,
    `sf-progress-run--${state}`,
    `sf-progress-run--view-${view}`,
    // The row writes its former class beside its own until 2027-01-01, so a
    // page selector that reached sf-progress-run--view-compact still does
    // (C134; journal value-progress-run-look-compact-to-row).
    view === 'row' ? 'sf-progress-run--view-compact' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const live = html`<div class="sf-progress-run-live sr-only" aria-live="polite" aria-atomic="true">${context.spoken}</div>`;
  if (view === 'row' || view === 'notice') {
    return html`<div class=${classes} style=${context.rootStyle || nothing} role="group" aria-label=${context.regionLabel}>
      ${view === 'row' ? row(context) : notice(context)}
      <div class=${`sf-progress-run-result sf-progress-run-result--${state} sr-only`} role="status">${context.announcement}</div>
      ${view === 'notice' ? live : nothing}
    </div>`;
  }
  return html`<section class=${classes} style=${context.rootStyle || nothing}
      aria-labelledby=${label ? ids.heading : nothing} aria-label=${label ? nothing : context.regionLabel}>
    ${heading(context)}
    ${progress(context)}
    ${results(context)}
    ${errorList(context)}
    ${context.steps.length ? html`<ol class="sf-progress-run-steps" aria-label=${context.words.steps}>${context.steps.map((item) => step(context, item))}</ol>` : nothing}
    ${output(context)}
    ${actions(context)}
    ${live}
  </section>`;
}
