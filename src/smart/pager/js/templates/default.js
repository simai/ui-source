import { html, nothing } from 'lit';

// sf-pager's markup, one <nav> per appearance (scss/ draws them on the one
// ladder). cards and row are plain links from string settings, so the build
// snapshot of them is the markup a server prints and it works without the
// script; a side with no address is a button that moves in items. steps,
// course and counter are drawn with sf-button and sf-icon-button of the
// pager's size. Every place line («Шаг 2 из 5») is text in a polite live
// region; the track and the dots beside it are aria-hidden pictures of it.

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-pager-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

// One side of cards or row: a link with its address, else a button that
// moves in items; nothing when the side is empty (its place is kept by the
// grid or by the next side holding the inline end).
function side(context, which, body) {
  const target = context[which];
  if (!target) return nothing;
  const classes = `sf-pager-side sf-pager-side--${which}`;
  const onClick = (event) => context.component.onSide(event, which);
  if (target.href) {
    return html`<a class=${classes} href=${target.href} rel=${which} @click=${onClick}>${body}</a>`;
  }
  return html`<button class=${classes} type="button" @click=${onClick}>${body}</button>`;
}

function renderCards(context) {
  const {prev, next, prevLabel, nextLabel} = context;
  return html`
    ${side(context, 'prev', html`<span class="sf-pager-direction">${icon('chevron_left')}<span>${prevLabel}</span></span><span class="sf-pager-title">${prev?.title}</span>`)}
    ${side(context, 'next', html`<span class="sf-pager-direction"><span>${nextLabel}</span>${icon('chevron_right')}</span><span class="sf-pager-title">${next?.title}</span>`)}
  `;
}

function renderRow(context) {
  const {prev, next, prevLabel, nextLabel} = context;
  return html`
    ${side(context, 'prev', html`${icon('arrow_back')}<span class="sr-only">${prevLabel}: </span><span class="sf-pager-title">${prev?.title}</span>`)}
    ${side(context, 'next', html`<span class="sr-only">${nextLabel}: </span><span class="sf-pager-title">${next?.title}</span>${icon('arrow_forward')}`)}
  `;
}

function renderSteps(context) {
  const {component, items, current, complete, size, prevLabel, nextLabel, doneLabel, place} = context;
  const last = current >= items.length - 1;
  const item = items[current];
  return html`
    <sf-button class="sf-pager-back" size=${size} appearance="outline" scheme="on-surface" text=${prevLabel}
      icon-start="chevron_left" ?disabled=${current <= 0} @click=${() => component.press('prev')}></sf-button>
    <div class="sf-pager-middle">
      <span class="sf-pager-place" role="status">${place}${item?.title ? html`<span class="sf-pager-place-title"> · ${item.title}</span>` : nothing}</span>
      <span class="sf-pager-track" aria-hidden="true">${items.map((_, index) => html`<span class=${`sf-pager-segment${complete || index <= current ? ' sf-pager-segment--done' : ''}`}></span>`)}</span>
    </div>
    <sf-button class="sf-pager-forward" size=${size} text=${last ? doneLabel : nextLabel}
      icon-end=${last ? nothing : 'chevron_right'} ?disabled=${!items.length || (last && complete)} @click=${() => component.press('next')}></sf-button>
  `;
}

function lessonCard(context) {
  const {component, items, current, complete, size, doneLabel, words} = context;
  if (complete) {
    return html`<div class="sf-pager-lesson sf-pager-lesson--finished">
      ${icon('check_circle', 'sf-pager-lesson-mark')}
      <span class="sf-pager-lesson-text"><span class="sf-pager-title">${words.finished}</span></span>
      <sf-button class="sf-pager-lesson-action" size=${size} appearance="outline" scheme="on-surface" text=${words.restart}
        @click=${() => component.press('restart')}></sf-button>
    </div>`;
  }
  const last = current >= items.length - 1;
  const index = last ? current : current + 1;
  const lesson = items[index];
  if (!lesson) return nothing;
  const note = [last ? words.lastLesson : words.nextLesson, lesson.meta].filter(Boolean).join(' · ');
  return html`<div class="sf-pager-lesson">
    <span class="sf-pager-lesson-number" aria-hidden="true">${index + 1}</span>
    <span class="sf-pager-lesson-text"><span class="sf-pager-meta">${note}</span><span class="sf-pager-title">${lesson.title}</span></span>
    <sf-button class="sf-pager-lesson-action" size=${size} text=${last ? doneLabel : words.start}
      icon-end=${last ? nothing : 'arrow_forward'} @click=${() => component.press('next')}></sf-button>
  </div>`;
}

function renderCourse(context) {
  const {items, current, complete, place} = context;
  const stage = (index) => (complete || index < current ? 'done' : index === current ? 'current' : 'ahead');
  return html`
    <div class="sf-pager-progress">
      <span class="sf-pager-dots" aria-hidden="true">${items.map((item, index) => html`<span class=${`sf-pager-dot sf-pager-dot--${stage(index)}`} title=${item.title || nothing}></span>`)}</span>
      <span class="sf-pager-place" role="status">${place}</span>
    </div>
    ${lessonCard(context)}
  `;
}

function renderCounter(context) {
  const {component, items, current, size, place, words} = context;
  return html`
    <sf-icon-button class="sf-pager-back" size=${size} appearance="outline" scheme="on-surface" icon="chevron_left"
      aria-label=${words.prevItem} ?disabled=${current <= 0} @click=${() => component.press('prev')}></sf-icon-button>
    <span class="sf-pager-place" role="status">${place}</span>
    <sf-icon-button class="sf-pager-forward" size=${size} appearance="outline" scheme="on-surface" icon="chevron_right"
      aria-label=${words.nextItem} ?disabled=${current >= items.length - 1} @click=${() => component.press('next')}></sf-icon-button>
  `;
}

const VIEWS = {cards: renderCards, row: renderRow, steps: renderSteps, course: renderCourse, counter: renderCounter};

export function renderPagerTemplate(context) {
  const appearance = VIEWS[context.appearance] ? context.appearance : 'cards';
  const classes = [
    'sf-pager',
    `sf-pager--${appearance}`,
    `sf-pager--size-${context.size === '1/2' ? 'half' : '1'}`,
    context.complete ? 'sf-pager--complete' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<nav class=${classes} style=${context.rootStyle || nothing} aria-label=${context.label || nothing}>${VIEWS[appearance](context)}</nav>`;
}
