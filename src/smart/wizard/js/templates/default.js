import {html, nothing} from 'lit';

// sf-wizard's markup (scss/ draws it on one rung of the ladder).
//
//   .sf-wizard (region, the container the queries read)
//     .sf-wizard-head      the heading, «Шаг N из M», «Продолжить позже»;
//                          the row (sf-steps) or the compact line (the
//                          step's label, sf-progress-bar, «Все шаги») and
//                          the list of all steps on demand
//     .sf-wizard-main      the column of steps (progress column: as tall as
//                          the body, never taller -- it scrolls inside, an
//                          sf-scrollbar in standard mode) and the body:
//                          the step's title (heading, the focus target), its
//                          «why», the running line, the result, the steps
//                          themselves (data-sf-live: the page's live nodes,
//                          printed once in the first paint), the question
//                          before closing
//     .sf-wizard-footer    Back · (Skip) · one primary
//     a visually hidden status region that says where a move went
//
// Place modal draws the same frame inside an sf-modal, place drawer inside an
// sf-drawer; under the footer a quiet line says when the draft was kept
// (C179 (6)). Place pages makes the
// primary and Skip native submit buttons of the step's form (sf-button
// 1.5.0 form, name, value) and Back a link.

const STATE_ICONS = {done: 'check_circle', skipped: 'do_not_disturb_on', running: 'progress_activity', error: 'error'};
const ALERT_STATUS = {done: 'success', error: 'error'};

// The row is sf-steps 1.4 (owner decision C101): a row always (the wizard
// draws its own compact head when narrow), the steps the wizard's rule lets a
// person reach as buttons (navigation free over the wizard's own reachable),
// each step's state in sf-steps' words.
function stepsRow(context) {
  const {steps, index, size, words, component} = context;
  const items = steps.map((step) => ({
    label: step.label,
    ...(step.state || !step.current ? {state: STAGES[step.state || '']} : {}),
    ...(step.reachable ? {} : {disabled: true}),
  }));
  return html`<sf-steps class="sf-wizard-steps" size=${size} current=${String(index)} aria-label=${words.steps}
    layout="row" navigation="free"
    items=${JSON.stringify(items)} @sf-steps-change=${(event) => component.onProgress(event)}></sf-steps>`;
}

// sf-steps' word for each state of a wizard step.
const STAGES = {done: 'done', skipped: 'skipped', running: 'running', error: 'error', '': 'ahead'};

function stepList(context, extra = '') {
  const {steps, component, words, id} = context;
  return html`<ol class=${['sf-wizard-list', extra].filter(Boolean).join(' ')} id=${extra ? nothing : `${id}-list`} aria-label=${words.steps}>
    ${steps.map((step) => html`<li class="sf-wizard-list-item" data-state=${step.state || nothing}>
      <button type="button" class="sf-wizard-list-step" ?disabled=${!step.reachable}
        aria-current=${step.current ? 'step' : nothing}
        aria-label=${step.stateWord ? `${step.index + 1}. ${step.label}, ${step.stateWord}` : nothing}
        @click=${() => component.goTo(step.index)}>
        <span class="sf-wizard-list-mark" aria-hidden="true">${STATE_ICONS[step.state]
          ? html`<i class="sf-icon">${STATE_ICONS[step.state]}</i>` : html`<span class="sf-wizard-list-number">${step.index + 1}</span>`}</span>
        <span class="sf-wizard-list-label">${step.label}</span>
      </button>
    </li>`)}
  </ol>`;
}

function compact(context) {
  const {index, count, size, words, listOpen, component, id} = context;
  const value = count ? Math.round(((index + 1) / count) * 100) : 0;
  return html`<div class="sf-wizard-compact">
    <div class="sf-wizard-compact-line">
      <span class="sf-wizard-compact-label">${words.position}</span>
      <sf-button class="sf-wizard-all" size=${size === '1' ? '1/2' : '1/3'} appearance="ghost" scheme="on-surface-variant"
        text=${listOpen ? words.hideSteps : words.allSteps} expanded=${listOpen ? 'true' : 'false'} aria-controls=${`${id}-list`}
        @click=${() => component.toggleList()}></sf-button>
    </div>
    <sf-progress-bar class="sf-wizard-bar" size="1/3" value=${String(value)} label=${words.progress} value-text=${words.position}></sf-progress-bar>
  </div>`;
}

function head(context) {
  const {heading, words, offerLater, laterHref, size, shape, listOpen, component} = context;
  return html`<div class="sf-wizard-head">
    <div class=${heading || offerLater ? 'sf-wizard-top' : 'sf-wizard-top sf-wizard-top--bare'}>
      ${heading ? html`<p class="sf-wizard-heading">${heading}</p>` : nothing}
      <span class="sf-wizard-position">${words.position}</span>
      ${offerLater ? html`<sf-button class="sf-wizard-later" size=${size === '1' ? '1/2' : '1/3'} appearance="ghost" scheme="on-surface-variant"
        text=${words.later} href=${laterHref || nothing} @click=${(event) => component.continueLater(event)}></sf-button>` : nothing}
    </div>
    ${shape === 'row' ? stepsRow(context) : nothing}
    ${compact(context)}
    ${listOpen ? stepList(context) : nothing}
  </div>`;
}

function result(step) {
  const status = ALERT_STATUS[step?.state];
  if (!status || !step.message) return nothing;
  return html`<sf-alert class="sf-wizard-result" status=${status} supporting-text=${step.message}></sf-alert>`;
}

function body(context) {
  const {step, level, words, busy, id, stepNodes, size} = context;
  return html`<div class="sf-wizard-body" aria-busy=${busy ? 'true' : nothing}>
    <div class="sf-wizard-step-head">
      <div class="sf-wizard-title" id=${`${id}-title`} role="heading" aria-level=${String(level)} tabindex="-1">${step?.heading ?? ''}</div>
      ${step?.why ? html`<p class="sf-wizard-why">${step.why}</p>` : nothing}
    </div>
    ${busy ? html`<div class="sf-wizard-running" role="status">
      <sf-spinner class="sf-wizard-spinner" size=${size} label=${words.running}></sf-spinner>
    </div>` : nothing}
    ${result(step)}
    <div class="sf-wizard-live" data-sf-live>${stepNodes}</div>
  </div>`;
}

function footer(context) {
  const {first, step, size, words, primary, busy, component, form, place, actionName, last} = context;
  const pages = place === 'pages';
  const back = first || step?.type === 'result' ? nothing : html`<sf-button class="sf-wizard-back" size=${size}
    appearance="outline" scheme="on-surface" text=${words.back} icon-start="arrow_back" ?disabled=${busy}
    href=${pages && context.backHref && !busy ? context.backHref : nothing}
    @click=${(event) => component.onFooter(event, 'back')}></sf-button>`;
  const skip = step?.optional && step.state !== 'done' && step.type !== 'result' ? html`<sf-button class="sf-wizard-skip" size=${size}
    appearance="ghost" scheme="on-surface" text=${words.skip} ?disabled=${busy}
    native-type=${pages && form ? 'submit' : 'button'} form=${pages && form ? form.id : nothing}
    name=${pages && form ? actionName : nothing} value=${pages && form ? 'skip' : nothing}
    href=${pages && !form && context.nextHref ? context.nextHref : nothing}
    @click=${(event) => component.onFooter(event, 'skip')}></sf-button>` : nothing;
  const primaryHref = pages && !form ? (primary.action === 'done' || last ? context.doneHref : context.nextHref) : '';
  return html`<div class="sf-wizard-footer">
    ${back}
    <span class="sf-wizard-footer-end">
      ${skip}
      <sf-button class="sf-wizard-primary" size=${size} appearance="default" scheme="primary" text=${primary.text}
        ?loading=${busy}
        native-type=${pages && form ? 'submit' : 'button'} form=${pages && form ? form.id : nothing}
        name=${pages && form ? actionName : nothing} value=${pages && form ? primary.action : nothing}
        href=${primaryHref || nothing}
        @click=${(event) => component.onFooter(event, 'primary')}></sf-button>
    </span>
  </div>`;
}

function frame(context) {
  const {shape, size, name, place, announce, busy} = context;
  const classes = [
    'sf-wizard',
    `sf-wizard--size-${size === '1' ? '1' : 'half'}`,
    `sf-wizard--progress-${shape}`,
    `sf-wizard--place-${place}`,
    place === 'modal' || place === 'drawer' ? 'sf-wizard--window' : '',
    busy ? 'sf-wizard--busy' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<div class=${classes} data-sf-wizard=${context.id} style=${context.rootStyle || nothing} role="region" aria-label=${name || nothing}>
    ${head(context)}
    <div class="sf-wizard-main">
      ${shape === 'column' ? html`<nav class="sf-wizard-column sf-scrollbar" data-mode="standard" aria-label=${context.words.steps}>
        <div class="sf-wizard-column-scroll sf-scrollbar__viewport">${stepList(context, 'sf-wizard-list--column')}</div>
      </nav>` : nothing}
      ${body(context)}
    </div>
    ${footer(context)}
    ${context.saved ? html`<p class="sf-wizard-saved"><i class="sf-icon" aria-hidden="true">cloud_done</i><span>${context.saved}</span></p>` : nothing}
    <div class="sf-wizard-announce sr-only" role="status">${announce}</div>
  </div>`;
}

export function renderWizardTemplate(context) {
  const {place, name} = context;
  if (place === 'drawer') {
    // Place drawer (owner decision C179 (3)): a short wizard of two to four
    // steps in a side panel 30rem wide (sf-drawer size 2, C157 (2)) at the
    // end edge; the panel's title is the wizard's name, its × closes it
    // (= continue later, C179 (6)). On a phone the panel takes the screen
    // (C157 (4)).
    return html`<sf-drawer class="sf-wizard-drawer" heading=${name} size="2" placement="inline-end">
      <div class="sf-wizard-window" slot="content">${frame({...context, heading: ''})}</div>
    </sf-drawer>`;
  }
  if (place !== 'modal') return frame(context);
  // Place modal: the frame in an sf-modal; closed, nothing is drawn of it.
  // A window of the Framework (owner decisions C159, C179 (3), (4)): a size
  // by name -- form, 36rem (32rem compact), wide 48rem only with the column
  // of steps, the whole screen on a phone -- and the window's header with
  // the wizard's name as its title on the h4 step (C159 (5), C179 (2)) and
  // the ×; the frame draws no name of its own inside (heading: '').
  const size = context.phone ? 'full' : context.shape === 'column' ? 'wide' : 'form';
  return html`<sf-modal class="sf-wizard-modal" heading=${name} size=${size}>
    <div class="sf-wizard-window" slot="content">${frame({...context, heading: ''})}</div>
  </sf-modal>`;
}
