import {html, nothing} from 'lit';
import {fieldSize} from '../../../../component/field-size';
import {describeUploadItem} from '../../../../component/file-upload/js/_file_upload';

function normalizeSize(value) {
    return fieldSize(value, 'sf-file-upload');
}

// The row is the class row (describeUploadItem): ready, process, done and
// error say the same words and offer the same buttons in both.
function renderUploadItem(item, size, index, owner) {
    const row = describeUploadItem(item, owner, 'process');
    const {state} = row;

    return html`
        <div
                class="sf-upload-progress sf-upload-progress--size-${size} sf-upload-progress--${state} flex items-main-start items-cross-start"
                data-index=${String(index)}
        >
            <i class="sf-icon" aria-hidden="true">${row.icon}</i>
            <div class="sf-upload-progress-content flex flex-col flex-1">
                <div class="sf-upload-progress-top flex content-main-between">
                    <div class="sf-upload-progress-left flex flex-col">
                        <div class="sf-upload-progress-name">${row.name}</div>
                        <div class="sf-upload-progress-text">${row.line}</div>
                    </div>

                    ${state === 'done'
                            ? html`<i class="sf-icon sf-icon-solid sf-upload-progress-mark" aria-hidden="true">check_circle</i>`
                            : nothing}
                    <button
                            type="button"
                            class="sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${size} flex items-cross-center content-main-center self-cross-start"
                            data-action="remove"
                    >
                        <i class="sf-icon" aria-hidden="true">delete</i>
                    </button>
                </div>

                ${state === 'error'
                        ? html`
                            <button
                                    type="button"
                                    class="sf-upload-progress-repeat self-cross-start"
                                    data-action="retry"
                            >
                                ${row.retryText}
                            </button>
                        `
                        : nothing}
                ${state === 'process'
                        ? html`
                            <sf-progress-bar
                                    size=${size}
                                    value=${row.progress === null ? nothing : String(row.progress)}
                                    ?indeterminate=${row.progress === null}
                                    text-position="inline-end"
                            ></sf-progress-bar>
                        `
                        : nothing}
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
                data-max-size=${context.maxSize > 0 ? String(context.maxSize) : nothing}
                data-min-size=${context.minSize > 0 ? String(context.minSize) : nothing}
                data-max-files=${context.maxFiles > 0 ? String(context.maxFiles) : nothing}
                data-max-total-size=${context.maxTotalSize > 0 ? String(context.maxTotalSize) : nothing}
                ?multiple=${context.multiple}
                ?disabled=${context.disabled}
                aria-label=${context.ariaLabel || nothing}
        >
            <div class=${featuredIconClasses}>
                <i class="sf-icon" aria-hidden="true">${context.icon}</i>
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

        <div class="sf-file-upload-message" role="status" hidden></div>

        <div class="sf-file-upload-files grid grid-col-1 gap-1 w-full">
            ${Array.isArray(context.items)
                    ? context.items.map((item, index) => renderUploadItem(item, size, index, context.component))
                    : nothing}
        </div>
    `;
}
