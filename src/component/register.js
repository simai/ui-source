/* global registerSfComponent */
// Lazy component loaders used by loader.js to register only the components
// that were actually detected on the page.

export const componentLoaders = {
  buttons: () => import('./buttons/js/_buttons'),
  badges: () => import('./badges/js/_badges'),
  clipboard: () => import('./clipboard/js/index'),
  emoji: () => import('./emoji/js/_emoji'),
  fab: () => import('./fab/js/_fab'),
  highlight: () => import('./highlight/js/index'),
  'icon-buttons': () => import('./icon-buttons/js/_icon-buttons'),
  radio: () => import('./radio/js/_radio'),
  skeleton: () => import('./skeleton/js/_skeleton'),
  switch: () => import('./switch/js/_switch'),
  tab: () => import('./tab/js/_tabs'),
  ajax: () => import('./sf-system/js/ajax/_ajax'),
};

export async function loadAndRegister(name) {
  const loader = componentLoaders[name];
  if (!loader) return false;
  if (window.SF?.ComponentRegistry?.[name]) return true;

  const mod = await loader();
  if (!mod) return false;

  const Cmp = mod.default || mod;
  const cname = Cmp?.componentName || Cmp?.name || name;
  if (!cname) return false;

  if (window.SF?.Loader?.registerComponent) {
    window.SF.Loader.registerComponent(cname, Cmp);
  } else if (typeof registerSfComponent === 'function') {
    registerSfComponent(cname, Cmp);
  } else {
    window.SF = window.SF || {};
    window.SF.ComponentRegistry = window.SF.ComponentRegistry || {};
    window.SF.ComponentRegistry[cname] = Cmp;
  }
  return true;
}
