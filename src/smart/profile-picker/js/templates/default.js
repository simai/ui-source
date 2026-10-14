import {html, nothing} from 'lit';

const icon = (name, className = '') => html`<i class="sf-icon ${className}" aria-hidden="true">${name}</i>`;
const kindIcon = (profile) => (profile?.shared ? 'group' : 'person');
const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);

function renderRow(context, profile) {
  const {component, state, text} = context;
  const id = String(profile.id);
  const current = String(context.currentProfile?.id ?? '') === id;
  const may = component.mayChange(profile);

  if (state.mode === 'rename' && state.target === id) {
    let value = profile.label ?? '';
    return html`<div class="sf-profile-picker-edit" data-id=${id}>
      <input class="sf-profile-picker-field" .value=${value} aria-label=${text('name')}
             @input=${(event) => { value = event.target.value; }}
             @keydown=${(event) => { if (event.key === 'Enter') { event.preventDefault(); component.submitRename(id, event.target.value); } }}>
      <button type="button" class="sf-profile-picker-icon-button" title=${text('save')} aria-label=${text('save')}
              @click=${(event) => component.submitRename(id, event.currentTarget.parentElement.querySelector('input').value)}>${icon('check')}</button>
      <button type="button" class="sf-profile-picker-icon-button" title=${text('cancel')} aria-label=${text('cancel')}
              @click=${() => component.setMode(null)}>${icon('close')}</button>
    </div>`;
  }

  if (state.mode === 'delete-confirm' && state.target === id) {
    return html`<div class="sf-profile-picker-confirm" role="alertdialog" aria-label=${fill(text('removeQuestion'), {name: profile.label ?? id})}>
      <div>${fill(text('removeQuestion'), {name: profile.label ?? id})}${profile.shared ? html` ${text('removeShared')}` : nothing}</div>
      <div class="sf-profile-picker-buttons">
        <sf-button size=${context.size} status="error" text=${text('remove')} @click=${() => component.submitDelete(id)}></sf-button>
        <sf-button size=${context.size} appearance="outline" scheme="on-surface" text=${text('cancel')} @click=${() => component.setMode(null)}></sf-button>
      </div>
    </div>`;
  }

  return html`<div class="sf-profile-picker-row" role="menuitemradio" tabindex="-1" data-id=${id}
                   aria-checked=${String(current)} @click=${(event) => { if (!event.target.closest('button')) component.choose(id); }}>
    <span class="sf-profile-picker-check">${current ? icon('check') : nothing}</span>
    ${icon(kindIcon(profile), 'sf-profile-picker-kind')}
    <span class="sf-profile-picker-text">
      <span class="sf-profile-picker-label">${profile.label ?? id}</span>
      <span class="sf-profile-picker-caption">${profile.shared ? text('shared') : text('personal')}${profile.builtin ? ` · ${text('builtin')}` : ''}</span>
    </span>
    ${may
      ? html`<span class="sf-profile-picker-actions">
          <button type="button" class="sf-profile-picker-icon-button" tabindex="-1" title=${`${text('rename')} (F2)`}
                  aria-label=${`${text('rename')}: ${profile.label ?? id}`} @click=${() => component.setMode('rename', id)}>${icon('edit')}</button>
          <button type="button" class="sf-profile-picker-icon-button sf-profile-picker-danger" tabindex="-1" title=${text('remove')}
                  aria-label=${`${text('remove')}: ${profile.label ?? id}`} @click=${() => component.setMode('delete-confirm', id)}>${icon('delete')}</button>
        </span>`
      : profile.editable === false ? html`<span class="sf-profile-picker-lock" title=${text('locked')}>${icon('lock')}</span>` : nothing}
  </div>`;
}

function renderCreate(context) {
  const {component, state, text, rights} = context;
  const create = rights.create ?? {};
  if (state.mode !== 'create') {
    if (!component.canCreate()) return nothing;
    return html`<div class="sf-profile-picker-row sf-profile-picker-add" role="menuitem" tabindex="-1"
                     @click=${() => component.setMode('create')}>
      <span class="sf-profile-picker-check"></span>${icon('add', 'sf-profile-picker-kind')}
      <span class="sf-profile-picker-text"><span class="sf-profile-picker-label">${text('newProfile')}</span></span>
    </div>`;
  }
  const shared = create.personal ? state.draft.shared : true;
  const choose = (value) => { component.state = {...state, draft: {...state.draft, shared: value}}; component.requestComponentUpdate('draft'); };
  return html`<div class="sf-profile-picker-form">
    <input class="sf-profile-picker-field" placeholder=${text('name')} aria-label=${text('name')} .value=${state.draft.name}
           @input=${(event) => { state.draft.name = event.target.value; }}
           @keydown=${(event) => { if (event.key === 'Enter') { event.preventDefault(); component.submitCreate(event.target.value, shared); } }}>
    <div class="sf-profile-picker-segmented" role="group">
      <button type="button" aria-pressed=${String(!shared)} ?disabled=${!create.personal}
              title=${create.personal ? nothing : text('personalTaken')} @click=${() => choose(false)}>${icon('person')}${text('personal')}</button>
      <button type="button" aria-pressed=${String(shared)} ?disabled=${!create.shared}
              title=${create.shared ? nothing : text('sharedDenied')} @click=${() => choose(true)}>${icon('group')}${text('shared')}</button>
    </div>
    <div class="sf-profile-picker-hint">${fill(text('copyOf'), {name: context.currentProfile?.label ?? ''})} ${shared ? text('seenByAll') : text('seenByYou')}</div>
    <div class="sf-profile-picker-buttons">
      <sf-button size=${context.size} text=${text('create')}
                 @click=${(event) => component.submitCreate(event.target.closest('.sf-profile-picker-form').querySelector('input').value, shared)}></sf-button>
      <sf-button size=${context.size} appearance="outline" scheme="on-surface" text=${text('cancel')} @click=${() => component.setMode(null)}></sf-button>
    </div>
  </div>`;
}

export function renderProfilePickerTemplate(context) {
  const {component, state, text} = context;
  const current = context.currentProfile;
  return html`
    <div class=${['sf-profile-picker', `sf-profile-picker--size-${context.size === '1' ? '1' : '1-2'}`, context.rootClass].filter(Boolean).join(' ')}>
      <button type="button" class="sf-profile-picker-trigger" aria-haspopup="menu" aria-expanded=${String(state.open)}
              ?disabled=${context.disabled} @click=${() => component.toggle()}>
        ${icon(kindIcon(current), 'sf-profile-picker-kind')}
        <span class="sf-profile-picker-name">${context.heading}: <b>${current?.label ?? ''}</b></span>
        ${icon('expand_more', 'sf-profile-picker-chevron')}
      </button>
      <div class="sf-profile-picker-panel" role="menu" aria-label=${context.heading} ?hidden=${!state.open}
           @keydown=${(event) => component.handleKeyDown(event)}>
        ${state.open ? html`
          ${context.profiles.map((profile) => renderRow(context, profile))}
          <div class="sf-profile-picker-separator" role="separator"></div>
          ${renderCreate(context)}
          ${context.message ? html`<p class="sf-profile-picker-message" role="alert">${context.message}</p>` : nothing}
          ${context.resettable && component.mayChange({...current, builtin: false})
            ? html`<div class="sf-profile-picker-footer">
                <sf-button size=${context.size} appearance="outline" scheme="on-surface" icon-start="restart_alt"
                           text=${text('reset')} @click=${() => component.reset()}></sf-button>
              </div>`
            : nothing}
        ` : nothing}
      </div>
    </div>
  `;
}
