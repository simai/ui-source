// Simple helper to register a component in one call.
// Usage inside component bundle:
//   import register from './register-helper';
//   register('Buttons', Buttons);

export function registerComponent(name, cls) {
  if (!name || !cls) return;

  if (
    typeof window !== 'undefined' &&
    typeof window.registerSfComponent === 'function'
  ) {
    window.registerSfComponent(name, cls);
    return;
  }

  if (typeof window !== 'undefined' && window.SF?.Loader?.registerComponent) {
    window.SF.Loader.registerComponent(name, cls);
    return;
  }

  if (typeof window !== 'undefined') {
    const pending = (window.SF_PENDING_COMPONENTS =
      window.SF_PENDING_COMPONENTS || []);
    pending.push([name, cls]);
  }
}

export default registerComponent;
