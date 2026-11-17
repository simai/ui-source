import { pageText } from '../../../core/js/page-language.js';
import LANG_WORDS from '../lang/index.mjs';

(() => {
  // The single theme button (no data-theme) is the two-theme cycle of
  // <sf-button-icon theme-cycle="light dark"> (owner decision C244,
  // 2026-11-16): its glyph is the theme on screen -- a moon on a dark page, a
  // sun on a light one --, its name says that theme («Тема: тёмная») and its
  // tooltip what a press gives («Тема: тёмная. Нажмите — светлая»). It has no
  // pressed state: a pressed look beside a glyph of the other theme said two
  // different things. Only an icon left empty or already one of the two is
  // written, so an author's own glyph stays.
  const THEME_TEXT = LANG_WORDS;
  const THEME_GLYPHS = new Set(['light_mode', 'dark_mode']);
  const say = (button, key) => pageText(THEME_TEXT, key, button, 'sf-theme-button');
  const syncGlyph = (button, isDark) => {
    const glyph = isDark ? 'dark_mode' : 'light_mode';
    if (button.localName.includes('-')) {
      const icon = button.getAttribute('icon');
      if ((icon === null || icon === '' || THEME_GLYPHS.has(icon)) && icon !== glyph) button.setAttribute('icon', glyph);
      return;
    }
    const icon = button.querySelector(':scope > .sf-icon');
    const text = icon?.textContent.trim();
    if (icon && (text === '' || THEME_GLYPHS.has(text)) && text !== glyph) icon.textContent = glyph;
  };

  // The name and the tooltip of the single button. A Smart host
  // (sf-button-icon, sf-button) takes them on itself and hands them to the
  // button it draws, its title becoming its tooltip; a native button takes
  // them directly, the title as its tooltip, as the Smart cycle's is when its
  // own tooltip is off.
  const syncName = (button, isDark) => {
    const now = say(button, isDark ? 'theme-dark' : 'theme-light');
    const next = say(button, isDark ? 'theme-light' : 'theme-dark');
    const name = `${say(button, 'theme')}: ${now}`;
    const tooltip = say(button, 'cycle-next').replace('{name}', name).replace('{next}', next);
    if (button.getAttribute('aria-label') !== name) button.setAttribute('aria-label', name);
    if (button.getAttribute('title') !== tooltip) button.setAttribute('title', tooltip);
    button.removeAttribute('aria-pressed');
    button.removeAttribute('pressed');
    button.querySelector?.(':scope > .sf-button, :scope > .sf-icon-button')?.removeAttribute('aria-pressed');
  };

  // The theme a choice button asks for. An sf-icon-button or sf-button host
  // hands its data-* attributes to the button it draws, so once it has started
  // the request lives one level down; read on the host alone, a "dark" choice
  // turned into a toggle -- its glyph flipped and a click toggled the theme.
  const requestOf = (button) => button.dataset.theme ?? button.querySelector(':scope > [data-theme]')?.dataset.theme;

  const syncControls = () => {
    const isDark = document.documentElement.classList.contains('theme-dark');
    const preference = window.SF?.Loader?.themePreference;
    document.querySelectorAll('.sf-theme-button').forEach((button) => {
      const requested = requestOf(button);
      const pressed = requested === preference;
      if (!requested) {
        syncGlyph(button, isDark);
        syncName(button, isDark);
        button.classList.remove('active');
        button.querySelector?.(':scope > .sf-button, :scope > .sf-icon-button')?.classList.remove('active');
        return;
      }
      // A choice among system, light and dark is one option of a set, not a
      // toggle (rule C12): role radio and aria-checked, never aria-pressed,
      // so it keeps the chosen-segment look (.active) instead of a pressed
      // toggle's fill. On an sf-button host the attributes reach the button
      // it draws.
      button.removeAttribute('aria-pressed');
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(pressed));
      // The look says it too: a button shows itself chosen with .active, and
      // the ARIA state alone left the chosen mode looking unchosen (docs trial
      // 4, 2026-10-15). On an sf-button host the button is the one inside.
      button.classList.toggle('active', pressed);
      button.querySelector?.(':scope > .sf-button, :scope > .sf-icon-button')?.classList.toggle('active', pressed);
    });
  };

  const handleClick = (event) => {
    const button = event.target.closest?.('.sf-theme-button');
    if (!button || !button.isConnected) return;
    const requested = requestOf(button);
    if (requested !== undefined) {
      if (['system', 'light', 'dark'].includes(requested)) {
        window.SF?.Loader?.setTheme?.(requested);
      }
      return;
    }
    window.SF?.Loader?.changeTheme?.(button);
  };

  document.addEventListener('click', handleClick);
  window.addEventListener('sf-theme-change', syncControls);
  document.addEventListener('turbo:load', syncControls);
  syncControls();
})();
