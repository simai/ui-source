import {html, nothing} from 'lit';

const icon = (name, className = '') => html`<i class="sf-icon ${className}" aria-hidden="true">${name}</i>`;
const kindIcon = (profile) => (profile?.shared ? 'group' : 'person');
const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);
// A row's icon buttons are one step below the picker's size, so they sit in
// its row (sf-button-icon, PP-5; they were own buttons with raw glyphs).
const BUTTON_SIZE = {'1': '1/2', '1/2': '1/3'};
const iconButton = (context, {icon: name, label, title, danger = false, onClick}) => html`<sf-button-icon class="sf-profile-picker-icon-button"
  icon=${name} size=${BUTTON_SIZE[context.size] ?? '1/2'} appearance="ghost" scheme="on-surface" status=${danger ? 'danger' : nothing}
  aria-label=${label} title=${title ?? nothing} @click=${onClick}></sf-button-icon>`;

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
      ${iconButton(context, {icon: 'check', label: text('save'), title: text('save'),
        onClick: (event) => component.submitRename(id, event.currentTarget.closest('.sf-profile-picker-edit').querySelector('input').value)})}
      ${iconButton(context, {icon: 'close', label: text('cancel'), title: text('cancel'), onClick: () => component.setMode(null)})}
    </div>`;
  }

  if (state.mode === 'delete-confirm' && state.target === id) {
    return html`<div class="sf-profile-picker-confirm" role="alertdialog" aria-label=${fill(text('removeQuestion'), {name: profile.label ?? id})}>
      <div>${fill(text('removeQuestion'), {name: profile.label ?? id})}${profile.shared ? html` ${text('removeShared')}` : nothing}</div>
      <div class="sf-profile-picker-buttons">
        <sf-button size=${context.size} status="danger" text=${text('remove')} @click=${() => component.submitDelete(id)}></sf-button>
        <sf-button size=${context.size} appearance="ghost" scheme="on-surface" text=${text('cancel')} @click=${() => component.setMode(null)}></sf-button>
      </div>
    </div>`;
  }

  // The profile in use is the row's fill alone (owner decisions C08, C106
  // (3): a single choice is the fill, no check); aria-checked says it.
  return html`<div class="sf-profile-picker-row" role="menuitemradio" tabindex="-1" data-id=${id}
                   aria-checked=${String(current)} @click=${(event) => { if (!event.target.closest('button, .sf-profile-picker-icon-button')) component.choose(id); }}>
    ${icon(kindIcon(profile), 'sf-profile-picker-kind')}
    <span class="sf-profile-picker-text">
      <span class="sf-profile-picker-label">${profile.label ?? id}</span>
      <span class="sf-profile-picker-caption">${profile.shared ? text('shared') : text('personal')}${profile.builtin ? ` · ${text('builtin')}` : ''}</span>
    </span>
    ${may
      ? html`<span class="sf-profile-picker-actions">
          ${iconButton(context, {icon: 'edit', label: `${text('rename')}: ${profile.label ?? id}`, title: `${text('rename')} (F2)`,
            onClick: () => component.setMode('rename', id)})}
          ${iconButton(context, {icon: 'delete', label: `${text('remove')}: ${profile.label ?? id}`, title: `${text('remove')} (Delete)`, danger: true,
            onClick: () => component.setMode('delete-confirm', id)})}
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
      ${icon('add', 'sf-profile-picker-kind')}
      <span class="sf-profile-picker-text"><span class="sf-profile-picker-label">${text('newProfile')}</span></span>
    </div>`;
  }
  const shared = create.personal ? state.draft.shared : true;
  const choose = (value) => { component.state = {...state, draft: {...state.draft, shared: value}}; component.requestComponentUpdate('draft'); };
  return html`<div class="sf-profile-picker-form">
    <input class="sf-profile-picker-field" placeholder=${text('name')} aria-label=${text('name')} .value=${state.draft.name}
           @input=${(event) => { state.draft.name = event.target.value; }}
           @keydown=${(event) => { if (event.key === 'Enter') { event.preventDefault(); component.submitCreate(event.target.value, shared); } }}>
    <sf-segmented class="sf-profile-picker-kinds" size=${context.size} full-width aria-label=${text('kind')}
                  items=${JSON.stringify([
                    {value: 'personal', label: text('personal'), icon: 'person', disabled: !create.personal},
                    {value: 'shared', label: text('shared'), icon: 'group', disabled: !create.shared},
                  ])}
                  value=${shared ? 'shared' : 'personal'}
                  @change=${(event) => { event.stopPropagation(); choose(event.detail?.value === 'shared'); }}></sf-segmented>
    <div class="sf-profile-picker-hint">${fill(text('copyOf'), {name: context.currentProfile?.label ?? ''})} ${shared ? text('seenByAll') : text('seenByYou')}${
      // Why a kind cannot be chosen: said under the switch (a disabled
      // segment takes no pointer, so its tooltip never showed).
      !create.personal ? ` ${text('personalTaken')}.` : !create.shared ? ` ${text('sharedDenied')}.` : ''}</div>
    <div class="sf-profile-picker-buttons">
      <sf-button size=${context.size} text=${text('create')}
                 @click=${(event) => component.submitCreate(event.target.closest('.sf-profile-picker-form').querySelector('input').value, shared)}></sf-button>
      <sf-button size=${context.size} appearance="ghost" scheme="on-surface" text=${text('cancel')} @click=${() => component.setMode(null)}></sf-button>
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
      <div class=${`sf-profile-picker-panel${state.sheet ? ' sf-profile-picker-panel--sheet' : ''}`} role="menu" aria-label=${context.heading} ?hidden=${!state.open}
           @keydown=${(event) => component.handleKeyDown(event)}>
        ${state.open && state.sheet ? html`<div class="sf-profile-picker-sheet-head" role="presentation">
          <span class="sf-profile-picker-sheet-title">${context.heading}</span>
          <sf-button-icon class="sf-profile-picker-sheet-close" icon="close" appearance="ghost" scheme="on-surface"
                          aria-label=${text('close')} @click=${() => component.close()}></sf-button-icon>
        </div>` : nothing}
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
