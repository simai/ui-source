import {html, nothing} from 'lit';

// sf-form's markup (scss/ draws it with the space system).
//
// - The root is a native form (novalidate: the form says the errors in its
//   own words, never the browser's bubble), named by label so it is a form
//   landmark; Enter in a one-line field submits it through «Сохранить», its
//   submit button. Under apply instant and in view it has no submit button.
// - «* — обязательные поля» over a form with a required field (C153 (2)).
// - From two errors after a submit, the errors summary: role alert,
//   tabindex -1 (it takes the focus), «Исправьте N поля» and one link per
//   error to its field (C182 (6)).
// - The groups: with two or more, each a fieldset named by its legend, else
//   a plain block. Each field: the label row (label, «*» hidden from a screen
//   reader, «?» as sf-help-mark), the control the field renderers drew, then
//   the hint or the error the control does not say itself. A pressed label
//   moves the focus to its control (the control is named by the same words
//   through its aria-label).
// - The footer under the fields: «Сохранить» first at the start, «Отмена»
//   after it (C159 (4)), «Есть несохранённые изменения» under them as a
//   polite status; in view «Изменить». footer="sticky" makes it a bar at the
//   bottom of the scrolling place.
// - apply answer (C291 (3)): «Отправить» first, «Отмена» after it, at the
//   form's size; the status line under them is always in the page (a polite
//   live region that appears with its words is not heard) and takes the focus
//   when the buttons go. pending locks the fields and the pressed button
//   waits; accepted is the read view with the line «Отправлено» and its glyph,
//   no «Изменить»; expired is the line alone; declined draws nothing.

function labelRow(field) {
  if (!field.labelRow) return nothing;
  return html`<div class="sf-form-label">
    <span class="sf-form-label-text" @click=${field.focus}>${field.label}${field.required ? html`<span class="sf-form-required" aria-hidden="true">*</span>` : nothing}</span>
    ${field.help ? html`<sf-help-mark class="sf-form-help" size="1/2" text=${field.help} label=${field.helpLabel}></sf-help-mark>` : nothing}
  </div>`;
}

function fieldBlock(field) {
  return html`<div class="sf-form-field" id=${field.id} data-key=${field.key} data-width=${field.width || nothing}>
    ${labelRow(field)}
    <div class="sf-form-control">${field.control}</div>
    ${field.error
      ? html`<p class="sf-form-error" id=${field.errorId}>${field.error}</p>`
      : field.hint ? html`<p class="sf-form-hint" id=${field.hintId}>${field.hint}</p>` : nothing}
  </div>`;
}

function groupBlock(group) {
  if (group.legend) {
    return html`<fieldset class="sf-form-group">
      <legend class="sf-form-legend">${group.legend}</legend>
      <div class="sf-form-fields">${group.fields.map(fieldBlock)}</div>
    </fieldset>`;
  }
  return html`<div class="sf-form-group"><div class="sf-form-fields">${group.fields.map(fieldBlock)}</div></div>`;
}

function summaryBlock(context) {
  if (!context.errorList) return nothing;
  return html`<div class="sf-form-summary" role="alert" tabindex="-1">
    <p class="sf-form-summary-title">${context.words.errorsTitle}</p>
    <ul class="sf-form-summary-list">${context.errorList.map((error) => (error.href ? html`<li><a href=${error.href}
      @click=${(event) => {
        event.preventDefault();
        context.component.focusField(error.key);
      }}>${error.message}</a></li>` : html`<li>${error.message}</li>`))}</ul>
  </div>`;
}

function answerFooter(context) {
  const answer = context.answer;
  const line = html`<p class="sf-form-state sf-form-mark" role="status" tabindex="-1" data-state=${answer.state}>${answer.text
    ? html`<sf-icon class="sf-form-mark-icon" icon=${answer.icon} size="1/2" aria-hidden="true"></sf-icon><span>${answer.text}</span>`
    : nothing}</p>`;
  if (answer.state === 'declined') return nothing;
  if (!answer.open && !answer.pending) return html`<div class="sf-form-footer">${line}</div>`;
  return html`<div class="sf-form-footer" data-sticky=${context.footer === 'sticky' ? '' : nothing}>
    <div class="sf-form-actions">
      <sf-button class="sf-form-submit" scheme="primary" size=${context.size === '1/2' ? '1/2' : nothing} native-type="submit" text=${context.words.send}
        ?loading=${answer.pressed === true} ?disabled=${answer.pending && answer.pressed !== true}></sf-button>
      <sf-button class="sf-form-cancel" appearance="ghost" scheme="on-surface" size=${context.size === '1/2' ? '1/2' : nothing} text=${context.words.cancel}
        ?loading=${answer.pressed === false} ?disabled=${answer.pending && answer.pressed !== false}
        @click=${() => context.component.cancel()}></sf-button>
    </div>
    ${line}
  </div>`;
}

function footerBlock(context) {
  if (context.instant) return nothing;
  if (context.answer) return answerFooter(context);
  if (!context.editing) {
    return html`<div class="sf-form-footer">
      <sf-button class="sf-form-edit" appearance="outline" scheme="primary" text=${context.words.edit}
        @click=${() => context.component.toEdit()}></sf-button>
    </div>`;
  }
  return html`<div class="sf-form-footer" data-sticky=${context.footer === 'sticky' ? '' : nothing}>
    <div class="sf-form-actions">
      <sf-button class="sf-form-submit" scheme="primary" size=${context.size === '1/2' ? '1/2' : nothing} native-type="submit" text=${context.words.submit}></sf-button>
      <sf-button class="sf-form-cancel" appearance="ghost" scheme="on-surface" size=${context.size === '1/2' ? '1/2' : nothing} text=${context.words.cancel}
        @click=${() => context.component.cancel()}></sf-button>
    </div>
    <p class="sf-form-state" role="status">${context.dirty ? context.words.unsaved : nothing}</p>
  </div>`;
}

export function renderFormTemplate(context) {
  const classes = ['sf-form', context.rootClass].filter(Boolean).join(' ');
  return html`<form class=${classes} novalidate
    aria-label=${context.label || nothing}
    data-labels=${context.labels}
    data-apply=${context.answer ? 'answer' : context.instant ? 'instant' : 'submit'}
    data-size=${context.size === '1/2' ? '1/2' : nothing}>
    ${context.editing && context.requiredNote ? html`<p class="sf-form-note">${context.words.requiredNote}</p>` : nothing}
    ${summaryBlock(context)}
    ${context.answer && !context.groups.length ? nothing
      : html`<div class="sf-form-body" ?inert=${Boolean(context.answer?.pending)}>${context.groups.map(groupBlock)}</div>`}
    ${footerBlock(context)}
  </form>`;
}
