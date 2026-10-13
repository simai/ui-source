import {html, nothing} from 'lit';
import {fieldSize} from '../../../../component/field-size';

function normalizeSize(value) {
    return fieldSize(value, 'sf-file-upload');
}

function normalizeState(value) {
    const normalized = String(value || '').toLowerCase();
    const supported = ['process', 'done', 'error'];
    return supported.includes(normalized) ? normalized : 'process';
}

function normalizeProgress(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, Math.min(100, parsed));
}

function renderUploadItem(item, size, index, retryText) {
    const state = normalizeState(item.state || item.status);
    const progress = normalizeProgress(item.progress ?? (state === 'done' ? 100 : 0));
    const icon = item.icon || 'cloud_upload';
    const name = item.name || item.fileName || 'File';
    const fileSize = item.fileSize || item.sizeText || '';
    const errorMessage = item.errorMessage || item.retryText || retryText;

    return html`
        <div
                class="sf-upload-progress sf-upload-progress--size-${size} sf-upload-progress--${state} flex items-main-start items-cross-start"
                data-index=${String(index)}
        >
            <i class="sf-icon">${icon}</i>
            <div class="sf-upload-progress-content flex flex-col flex-1">
                <div class="sf-upload-progress-top flex content-main-between">
                    <div class="sf-upload-progress-left flex flex-col">
                        <div class="sf-upload-progress-name">${name}</div>
                        <div class="sf-upload-progress-text">${fileSize}</div>
                    </div>

                    ${state === 'done'
                            ? html`<i class="sf-icon sf-icon-solid">check_circle</i>`
                            : html`
                                <button
                                        type="button"
                                        class="sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${size} flex items-cross-center content-main-center self-cross-start"
                                        data-action="remove"
                                >
                                    <i class="sf-icon">delete</i>
                                </button>
                            `}
                </div>

                ${state === 'error'
                        ? html`
                            <button
                                    type="button"
                                    class="sf-upload-progress-repeat self-cross-start"
                                    data-action="retry"
                            >
                                ${errorMessage}
                            </button>
                        `
                        : html`
                            <sf-progress-bar
                                    size=${size}
                                    value=${String(progress)}
                                    text-position="inline-end"
                            ></sf-progress-bar>
                        `}
            </div>
        </div>
    `;
}

export function renderFileUploadTemplate(context) {
    const size = normalizeSize(context.size);
    const rootClasses = [
        'sf-file-upload',
        `sf-file-upload--size-${size}`,
        context.disabled ? 'disabled' : '',
        'flex',
        'flex-col',
        'items-cross-center',
        'cursor-pointer',
        context.rootClass,
    ].filter(Boolean);

    const featuredIconClasses = [
        'sf-featured-icon',
        `sf-featured-icon--size-${size}`,
        'sf-featured-icon--soft',
        'sf-featured-icon--circle',
        'sf-featured-icon--neutral',
    ].join(' ');

    return html`
        <div
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                data-render-managed="1"
                data-accept=${context.accept || nothing}
                data-multiple=${context.multiple ? 'true' : 'false'}
                ?multiple=${context.multiple}
                ?disabled=${context.disabled}
                aria-label=${context.ariaLabel || nothing}
        >
            <div class=${featuredIconClasses}>
                <i class="sf-icon">${context.icon}</i>
            </div>

            <div class="sf-file-upload-bottom flex flex-col items-cross-center">
                <div class="sf-file-upload-block flex">
                    <div class="sf-file-upload-block-text">
                        <span class="sf-file-upload-link">${context.linkText}</span>
                        ${context.text ? html` ${context.text}` : nothing}
                    </div>
                </div>

                ${context.supportingText
                        ? html`<span class="sf-file-upload-text">${context.supportingText}</span>`
                        : nothing}
            </div>
        </div>

        <div class="sf-file-upload-files grid grid-col-1 gap-1 w-full">
            ${Array.isArray(context.items)
                    ? context.items.map((item, index) => renderUploadItem(item, size, index, context.retryText))
                    : nothing}
        </div>
    `;
}
