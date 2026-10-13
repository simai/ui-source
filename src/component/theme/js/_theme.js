(() => {
  const syncControls = () => {
    const isDark = document.documentElement.classList.contains('theme-dark');
    const preference = window.SF?.Loader?.themePreference;
    document.querySelectorAll('.sf-theme-button').forEach((button) => {
      const requested = button.dataset.theme;
      const pressed = requested ? requested === preference : isDark;
      button.setAttribute('aria-pressed', String(pressed));
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
