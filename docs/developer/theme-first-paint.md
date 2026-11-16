# Theme at the first paint

The Loader sets the theme class (`theme-light` or `theme-dark` on `html`) from
the deferred `core.js`, after the page has painted once. Two things keep that
first frame in the reader's theme.

## Without a class: the device's theme (core.css)

While `html` has neither class, core.css declares the colour roles on `:root`
with `color-scheme: light dark`, so `light-dark()` resolves by the device's
`prefers-color-scheme`. A reader with a dark device and no saved choice sees a
dark first frame; the Loader's class then arrives with the same theme and
nothing changes. A class, whoever writes it, wins over this fallback.

## A saved choice: the server or a head script

A person who chose a theme against the device's (cookie `sf-theme=light` or
`sf-theme=dark`, path `/`, written by `SF.Loader.setTheme`) would still see
the device's theme for one frame. Put the class on `html` before the first
paint, in one of two ways. Neither is required; without them the page works
as before.

1. The server prints it. Read the `sf-theme` cookie and write the class:

   ```php
   <?php $theme = $_COOKIE['sf-theme'] ?? ''; ?>
   <html lang="ru"<?= in_array($theme, ['light', 'dark'], true) ? ' class="theme-' . $theme . '"' : '' ?>>
   ```

   A cookie of `system`, or none, prints no class: core.css follows the device.

2. A script in `<head>`, before the stylesheets, does the same in the browser:

   ```html
   <script>
     (function () {
       var m = document.cookie.match(/(?:^|; )sf-theme=(light|dark)(?:;|$)/);
       if (m) document.documentElement.classList.add('theme-' + m[1]);
     })();
   </script>
   ```

   A Content Security Policy that forbids inline scripts needs its hash or a
   nonce for it.

A page whose host owns the theme (`SF_BOOT_CONFIG.theme = false`) writes its
own class the same way; the Loader then never touches it.
