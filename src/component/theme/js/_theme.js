(() => {
  // A toggle (no data-theme) shows the theme it switches to: a sun on a dark
  // page, a moon on a light one. Each project swapped the glyph on
  // sf-theme-change itself (ui-effects site, 2026-10-28). Only an icon left
  // empty or already one of the two is written, so an author's own glyph
  // stays.
  const THEME_GLYPHS = new Set(['light_mode', 'dark_mode']);
  const syncGlyph = (button, isDark) => {
    const glyph = isDark ? 'light_mode' : 'dark_mode';
    if (button.localName.includes('-')) {
      const icon = button.getAttribute('icon');
      if ((icon === null || icon === '' || THEME_GLYPHS.has(icon)) && icon !== glyph) button.setAttribute('icon', glyph);
      return;
    }
    const icon = button.querySelector(':scope > .sf-icon');
    const text = icon?.textContent.trim();
    if (icon && (text === '' || THEME_GLYPHS.has(text)) && text !== glyph) icon.textContent = glyph;
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
      const pressed = requested ? requested === preference : isDark;
      if (!requested) syncGlyph(button, isDark);
      button.setAttribute('aria-pressed', String(pressed));
      // The look says it too: a button shows itself pressed with .active, and
      // aria-pressed alone left the chosen mode looking unchosen (docs trial
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
