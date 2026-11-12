import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The notice's action and close (owner decision C35): the action is an
// unsized (size 1) low button -- 32, compact and phone 28 -- whose label is
// the notice's text size, tonal primary, its plate starting at the text edge;
// the close a size-1 low icon button, 32 / 28 / 28, centred on the first line.
// The same classes as the class toast (component/toast/js/_toast.js).
const TOAST_ACTION_CLASSES = 'sf-button sf-button--tonal sf-button--primary sf-button--size-1 sf-button--height-low flex items-cross-center';
const TOAST_CLOSE_CLASSES = 'sf-icon-button sf-icon-button--close sf-icon-button--variant-close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center';

// The actions (owner decision C50, the model of SF.Toast.create): one light
// navigation action -- action-text with action-href and no secondary action --
// is a link at the end of the text; undo, retry, extend and two actions are
// buttons under the text (C35, C46). Never both.
export function toastActions(context) {
  const first = String(context.actionText ?? '').trim();
  const second = String(context.secondaryActionText ?? '').trim();
  const href = String(context.actionHref ?? '').trim();
  if (first && href && !second) return { link: { text: first, href, action: context.action || 'action' }, buttons: [] };
  const buttons = [];
  if (first) buttons.push({ text: first, action: context.action || 'action' });
  if (second) buttons.push({ text: second, action: context.secondaryAction || 'secondary' });
  return { link: null, buttons };
}

// A no-break space keeps the link with the text's last word: after a plain
// space a full line sent the link alone onto a line of its own (T2, C50
// acceptance r3). It is written into the text's own node, not a node of its
// own: a text node of white space alone is the template's indentation to the
// first-paint snapshot, which prints it as one plain space (group build
// 2026-11-12, toast/link).
const LINK_SPACE = '\u00a0';

function renderLink(link) {
  return html`<a
    class="sf-toast-link"
    href=${link.href}
    data-action=${link.action}
    data-toast-action=${link.action}
  >${link.text}</a>`;
}

export function renderToastTemplate(context) {
  const { link, buttons } = toastActions(context);
  const rootClasses = joinClasses(
    'sf-toast',
    // The component normalises the legacy words, so the template sees only the
    // shared vocabulary.
    `sf-toast--${['neutral', 'info', 'success', 'warning', 'error'].includes(context.status ?? context.type)
      ? (context.status ?? context.type)
      : 'neutral'}`,
    'flex',
    'items-cross-start',
    context.rootClass,
  );

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role=${context.role || nothing}
      data-duration=${context.duration > 0 ? context.duration : nothing}
    >
      ${context.icon
        // The status icon is an sf-icon, as the alert's is (1.2.1): it asks
        // the Loader for its own glyph. A bare <i class="sf-icon"> was found
        // only by the Loader's page scan, so a toast drawn where the scan
        // does not look (a data-sf-observer="ignore" region, a shadow root)
        // kept an empty box for a glyph the page had not asked for yet.
        ? html`<sf-icon icon=${context.icon} aria-hidden="true"></sf-icon>`
        : nothing}

      <div class="sf-toast-container flex flex-col flex-1">
        <div class="sf-toast-wrap flex flex-col">
          ${context.title
            ? html`<div class="sf-toast-text">${link && !context.supportingText ? `${context.title}${LINK_SPACE}` : context.title}${link && !context.supportingText ? renderLink(link) : nothing}</div>`
            : nothing}
          ${context.supportingText || (link && !context.title)
            ? html`<div class="sf-toast-supporting-text">${link && context.supportingText ? `${context.supportingText}${LINK_SPACE}` : context.supportingText}${link ? renderLink(link) : nothing}</div>`
            : nothing}
        </div>

        ${buttons.length
          ? html`
              <div class="sf-toast-bottom flex items-center">
                ${buttons.map((button) => html`
                  <button
                    type="button"
                    class=${TOAST_ACTION_CLASSES}
                    data-action=${button.action}
                    data-toast-action=${button.action}
                  >
                    <span class="sf-button-text-container">${button.text}</span>
                  </button>
                `)}
              </div>
            `
          : nothing}
      </div>

      ${context.closable
        ? html`
            <button
              type="button"
              class=${TOAST_CLOSE_CLASSES}
              aria-label=${context.closeLabel || 'Close message'}
              data-close
              data-toast-close
            >
              <span
                class="sf-close sf-close--size-1 flex justify-center items-center"
                aria-hidden="true"
              >
                <span class="sf-close-icon"></span>
              </span>
            </button>
          `
        : nothing}
    </div>
  `;
}
