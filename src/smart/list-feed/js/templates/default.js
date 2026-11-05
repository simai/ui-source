import {html, nothing} from "lit";
import "./default.css";

// The frame of the feed, drawn in the component's light DOM like every Smart
// component: a document stylesheet does not cross a shadow boundary, and the
// entries a host draws carry their own classes from the page's sheets.
//
// Three names, deliberately different: the scrolling region («Лента», or the
// host's label), the log inside it («Записи») and the announcer, which has
// none. Two «Записи» in a row tell a screen reader nothing.
//
// The column is one node the component owns and keeps (see index.js); lit
// places it once and leaves it alone, so prepending history and redrawing an
// entry never move the scroll anchor.
//
// The two buttons sit in wrappers that are hidden instead of the buttons: a
// Smart button's host is display: contents, and `hidden` on it does nothing.
export function renderListFeedTemplate(context) {
    const {component} = context;
    return html`
        <div
                class="sf-list-feed ${context.empty ? "sf-list-feed--empty" : ""}"
                role="region"
                aria-label=${context.regionLabel}
                tabindex="0"
                @scroll=${() => component.onScroll()}
        >
            <div class="sf-list-feed__earlier" ?hidden=${!context.hasMore}>
                <sf-button
                        appearance="link"
                        scheme="on-surface"
                        size="1/2"
                        icon="expand_less"
                        text=${context.earlierText}
                        ?disabled=${context.loadingEarlier}
                        data-action="earlier"
                        @click=${() => component.requestEarlier()}
                ></sf-button>
            </div>
            <div class="sf-list-feed__empty" ?hidden=${!context.empty || !context.emptyContent}>
                ${context.emptyContent ?? nothing}
            </div>
            ${context.column}
            <div class="sf-list-feed__jump" hidden>
                <sf-button-icon
                        appearance="surface"
                        scheme="on-surface"
                        size="1"
                        radius="rounded"
                        icon="arrow_downward"
                        data-action="latest"
                        title=${context.latestLabel}
                        aria-label=${context.latestLabel}
                        @click=${() => component.scrollToLatest({focus: true})}
                ></sf-button-icon>
            </div>
            <div class="sf-list-feed__announcer sr-only" aria-live="polite"></div>
        </div>
    `;
}
