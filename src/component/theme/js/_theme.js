(() => {
  const syncControls = () => {
    const isDark = document.documentElement.classList.contains('theme-dark');
    const preference = window.SF?.Loader?.themePreference;
    document.querySelectorAll('.sf-theme-button').forEach((button) => {
      const requested = button.dataset.theme;
      const pressed = requested ? requested === preference : isDark;
      button.setAttribute('aria-pressed', String(pressed));
      // The look says it too: a button shows itself pressed with .active, and
      // aria-pressed alone left the chosen mode looking unchosen (docs trial
      // 4, 2026-10-15). On an sf-button host the button is the one inside.
      button.classList.toggle('active', pressed);
      button.querySelector?.(':scope > .sf-button')?.classList.toggle('active', pressed);
    });
  };

  const handleClick = (event) => {
    const button = event.target.closest?.('.sf-theme-button');
    if (!button || !button.isConnected) return;
    const requested = button.dataset.theme;
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
