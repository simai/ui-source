import { dismissAlertElement } from '../dismiss';

const BINDING_KEY = '__sfAlertDocumentClickHandler';

function isDisabled(trigger) {
  return trigger.matches(':disabled, [aria-disabled="true"]');
}

function belongsToSmartAlert(alert) {
  return alert.parentElement?.matches('sf-alert') === true;
}

function dispatchAction(alert, trigger) {
  alert.dispatchEvent(new CustomEvent('sf-alert-action', {
    bubbles: true,
    detail: {
      action: trigger.getAttribute('data-action')
        || trigger.getAttribute('data-alert-action')
        || '',
      alert,
      trigger,
    },
  }));
}

function dispatchClose(alert, trigger) {
  alert.dispatchEvent(new CustomEvent('sf-alert-close', {
    bubbles: true,
    detail: { alert, trigger },
  }));
}

function handleDocumentClick(event) {
  const trigger = event.target?.closest?.(
    '[data-close], [data-alert-close], [data-action], [data-alert-action], .sf-alert--close',
  );
  const alert = trigger?.closest?.('.sf-alert');

  if (!trigger || !alert || isDisabled(trigger) || belongsToSmartAlert(alert)) {
    return;
  }

  if (trigger.matches('[data-close], [data-alert-close], .sf-alert--close')) {
    event.preventDefault();
    dispatchClose(alert, trigger);
    dismissAlertElement(alert);
    return;
  }

  dispatchAction(alert, trigger);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window[BINDING_KEY]) {
  window[BINDING_KEY] = handleDocumentClick;
  document.addEventListener('click', handleDocumentClick);
}
