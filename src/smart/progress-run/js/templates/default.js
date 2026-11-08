import {html, nothing} from 'lit';

// sf-progress-run's markup (scss/ draws it on one rung of the ladder).
//
// - The root is a region named by label; with a label the label is its
//   heading line.
// - The steps are an ordered list: the state glyph (sf-steps' set, running
//   turning), the title with its state said in words (visually hidden), a
//   line of text, and the time at the end. The running step is aria-current.
// - The result line is a status live region that is always there, so the
//   result is read when the job ends; it holds text only then.
// - The output: a toggle (sf-button, aria-expanded, aria-controls); open, a
//   pre in a scroller of role log (not live, focusable to scroll), with copy
//   (sf-button-copy, the pre as its target) and download.
// - The actions Cancel, Retry and Hide, as their states allow.

// The rung below the run's: texts, times, the output and the buttons.
const BELOW = {'1/2': '1/3', 1: '1/2'};

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-progress-run-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

function step(context, item) {
  return html`<li class=${`sf-progress-run-step sf-progress-run-step--${item.state}`} data-id=${item.id} data-state=${item.state}
      aria-current=${item.state === 'running' ? 'step' : nothing}>
    ${icon(context.icons[item.state], `sf-progress-run-icon--${item.state}`)}
    <div class="sf-progress-run-step-text">
      <span class="sf-progress-run-step-title">${item.title}<span class="sr-only">, ${item.stateWord}</span></span>
      ${item.text ? html`<span class="sf-progress-run-step-supporting">${item.text}</span>` : nothing}
    </div>
    ${item.time ? html`<span class="sf-progress-run-time">${item.time}</span>` : nothing}
  </li>`;
}

function output(context) {
  const {component, ids, size, outputOpen, words} = context;
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
      ${context.outputShown ? nothing : html`<span class="sf-progress-run-output-empty">${words.emptyOutput}</span>`}
    </div>` : nothing}
  </div>`;
}

function actions(context) {
  const {component, size, words, showCancel, showRetry, showHide} = context;
  if (!showCancel && !showRetry && !showHide) return nothing;
  const below = BELOW[size];
  return html`<div class="sf-progress-run-actions">
    ${showCancel ? html`<sf-button class="sf-progress-run-cancel" size=${below} appearance="outline" text=${words.cancel}
      @click=${() => component.onCancel()}></sf-button>` : nothing}
    ${showRetry ? html`<sf-button class="sf-progress-run-retry" size=${below} appearance="outline" text=${words.retry}
      @click=${() => component.onRetry()}></sf-button>` : nothing}
    ${showHide ? html`<sf-button class="sf-progress-run-hide" size=${below} appearance="ghost" text=${words.hide}
      @click=${() => component.onHide()}></sf-button>` : nothing}
  </div>`;
}

export function renderProgressRunTemplate(context) {
  const {size, state, ended, ids, label, icons} = context;
  const classes = [
    'sf-progress-run',
    `sf-progress-run--size-${size === '1/2' ? 'half' : '1'}`,
    `sf-progress-run--${state}`,
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<section class=${classes} style=${context.rootStyle || nothing}
      aria-labelledby=${label ? ids.heading : nothing} aria-label=${label ? nothing : context.regionLabel}>
    ${label ? html`<div class="sf-progress-run-heading" id=${ids.heading}>${label}</div>` : nothing}
    ${context.steps.length ? html`<ol class="sf-progress-run-steps" aria-label=${context.words.steps}>${context.steps.map((item) => step(context, item))}</ol>` : nothing}
    <div class=${`sf-progress-run-result sf-progress-run-result--${state}`} role="status">
      ${ended ? html`${icon(icons[state], `sf-progress-run-icon--${state}`)}<span class="sf-progress-run-result-text">${context.resultShown}</span>` : nothing}
    </div>
    ${output(context)}
    ${actions(context)}
  </section>`;
}
