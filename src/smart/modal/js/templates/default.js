import {html, nothing} from 'lit';

function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ').trim();
}

function overlayClasses(context) {
    const blurClass = context.blur
        ? `backdrop-blur-${context.blurType}`
        : context.overlayPreset === 'focus'
            ? 'backdrop-blur-small'
            : '';

    return joinClasses(
        `sf-modal-overlay--${context.overlayPreset}`,
        blurClass,
    );
}

export function renderModalTemplate(context) {
    const isInline = context.display === 'inline';
    const hasRemoteContent =
        Boolean(context.src) &&
        (context.mode === 'ajax' || context.mode === 'iframe');
    const showHeader = context.showHeader !== false;
    const hasHeaderSlot = context.hasHeaderContent;
    const titleId = `${context.modalId}-title`;
    const accessibleLabel =
        context.ariaLabel || (hasHeaderSlot || !showHeader ? context.title : '');
    const hasContentSlot = context.hasContentContent;
    const hasFooterSlot = context.hasFooterContent && context.showFooter;
    const panelStyle = [
        context.width ? `--sf-modal-width:${context.width}` : '',
        context.height ? `--sf-modal-height:${context.height}` : '',
    ]
        .filter(Boolean)
        .join(';');
    const surfaceStyle = [
        context.surfacePadding
            ? `--sf-modal-surface-padding:${context.surfacePadding}`
            : '',
    ]
        .filter(Boolean)
        .join(';');
    const modalStyle = [
        context.modalZIndex ? `z-index:${context.modalZIndex}` : '',
    ]
        .filter(Boolean)
        .join(';');

    return html`
        <div
                id=${context.modalId}
                class=${joinClasses(
                        'sf-modal',
                        `sf-modal--position-${context.position}`,
                        // Legacy alias: the misspelt class the modal wrote before;
                        // kept until contracts/changes/journal.json removes it.
                        `sf-modal--positon-${context.position}`,
                        isInline
                                ? 'sf-modal--inline inline-block w-full'
                                : 'fixed top-0 inline-start-0 w-full h-full z-9 p-3 items-cross-center content-main-center',
                        context.open ? 'flex' : 'hidden',
                        !isInline && context.animate && 'animate',
                        context.rootClass
                )}
                style=${modalStyle}
                role=${isInline ? 'region' : 'dialog'}
                aria-modal=${isInline || context.minimized ? 'false' : 'true'}
                aria-hidden=${context.open && !context.minimized ? 'false' : 'true'}
                ?inert=${!context.open || context.minimized}
                aria-label=${accessibleLabel || nothing}
                aria-labelledby=${accessibleLabel ? nothing : titleId}
                data-sf-modal-id=${context.modalId}
                data-sf-modal-position=${context.position}
                data-sf-modal-fullscreen=${String(context.fullscreen)}
                data-sf-modal-display=${context.display}
                data-sf-modal-state=${isInline ? 'inline' : context.modalState}
                data-sf-modal-hidden=${String(context.minimized)}
                data-sf-modal-overlay-preset=${context.overlayPreset}
        >
            <div
                    class=${joinClasses(
                            'absolute top-0 inline-start-0 w-full h-full',
                            overlayClasses(context),
                            context.overlayClass,
                            (!context.overlay || isInline) && 'hidden',
                    )}
                    data-sf-modal-overlay
                    data-sf-modal-overlay-preset=${context.overlayPreset}
            ></div>

            <section
                    class=${joinClasses('relative overflow-visible', context.panelClass)}
                    style=${panelStyle}
                    data-sf-modal-panel
                    ?data-sf-modal-has-width=${Boolean(context.width)}
                    ?data-sf-modal-has-height=${Boolean(context.height)}
                    tabindex="-1"
            >
                <div
                        class=${joinClasses(
                                'sf-modal-surface flex flex-col',
                                !isInline && 'sf-modal-surface--elevated',
                                context.surfaceClass,
                        )}
                        style=${surfaceStyle}
                        data-sf-modal-surface
                >
                    ${showHeader
                            ? html`
                                <header
                                        class=${joinClasses(
                                                'sf-modal-header flex items-start min-w-0',
                                                context.headerClass,
                                        )}
                                >
                                    <div class="sf-modal-header-content">${hasHeaderSlot
                                            ? context.headerContent
                                            : html`<h2 id=${titleId} class="title-3 m-0">${context.title}</h2>`}</div>
                                    ${context.hide && !isInline
                                            ? html`
                                                <button
                                                        type="button"
                                                        class=${joinClasses(
                                                                'sf-icon-button sf-icon-button--icon sf-modal-header-action sf-modal-hide-button sf-modal-hide-button--inline-end sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1/3 m-0',
                                                                context.hideModifier,
                                                        )}
                                                        aria-label=${context.minimizeText}
                                                        data-sf-modal-hide=${context.modalId}
                                                        @click=${context.onHideClick}
                                                >
                                                    <span class="sf-modal-hide-icon" aria-hidden="true"></span>
                                                </button>
                                            `
                                            : nothing}
                                    ${context.showClose
                                            ? html`
                                                <button
                                                        type="button"
                                                        class=${joinClasses(
                                                                'sf-icon-button sf-modal-header-action sf-modal-close-button sf-modal-close-button--inline-end sf-icon-button--close sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1/3 m-0',
                                                                context.closeClass,
                                                        )}
                                                        aria-label=${context.closeText}
                                                        data-sf-modal-close=${context.modalId}
                                                        @click=${context.onCloseClick}
                                                >
                          <span
                                  class="sf-close sf-close--size-1/3 flex justify-center items-center"
                                  aria-hidden="true"
                          >
                            <span class="sf-close-icon"></span>
                          </span>
                                                </button>
                                            `
                                            : nothing}
                                </header>
                            `
                            : nothing}

                    <div
                            class="sf-modal-body flex flex-col gap-1 min-w-0 overflow-visible"
                            data-sf-modal-body
                    >
                        <div
                                class="sf-modal-body-viewport min-w-0 overflow-visible"
                                data-sf-modal-body-viewport
                        >
                            <div
                                    class=${joinClasses(
                                            'sf-modal-body-scroll h-full min-w-0 overflow-y-auto flex flex-col gap-1 p-1/4',
                                            context.bodyClass,
                                    )}
                                    data-sf-modal-body-scroll
                            >
                                ${hasRemoteContent
                                        ? html`
                                            <div
                                                    class="sf-modal-content-placeholder flex flex-col gap-2 min-h-8 items-cross-center content-main-center"
                                                    data-sf-modal-content-placeholder
                                            >
                                                ${context.remoteContent}
                                            </div>
                                        `
                                        : hasContentSlot
                                                ? html`
                                                    <div
                                                            class=${joinClasses(
                                                                    'sf-modal-content flex flex-col gap-2',
                                                                    context.contentClass,
                                                            )}
                                                    >
                                                        ${context.contentContent}
                                                    </div>
                                                `
                                                : html`<p class="m-0 text-2">${context.text}</p>`}
                            </div>
                        </div>

                        ${hasFooterSlot
                                ? html`
                                    <div
                                            class=${joinClasses(
                                                    'sf-modal-footer flex flex-wrap gap-2',
                                                    context.footerClass,
                                            )}
                                    >
                                        ${context.footerContent}
                                    </div>
                                `
                                : nothing}
                    </div>
                </div>
            </section>
        </div>
    `;
}
