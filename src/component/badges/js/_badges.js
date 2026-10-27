import {ComponentObserver} from "../../../core/js/ComponentObserver";
import badgeUtility from '../json/badge.utility.json';
import registerComponent from "../../register-helper";
import {BADGE_SCHEME_ALIASES, normalizeBadgeContract} from './contract';
import {noteDeprecated} from '../../../core/js/deprecations.js';

class Badges extends ComponentObserver {
    static componentName = 'Badges';
    html = null;

    constructor(props) {
        super(props);
        const {
            text = '',
            icon,
            iconLeft,
            iconRight,
            iconPosition = 'start',
        } = this.params || {};
        // The same axes as sf-badge: appearance (type is its former name) and
        // the status, or the colour role in scheme. A former scheme name such as
        // danger draws its canonical class and is noted in SF.deprecations.
        const params = this.params || {};
        const requestedScheme = params.status || params.scheme;
        const formerScheme = String(requestedScheme ?? '').trim().toLowerCase();
        if (BADGE_SCHEME_ALIASES[formerScheme]) {
            noteDeprecated({
                component: 'badges',
                kind: 'value',
                attribute: 'scheme',
                from: formerScheme,
                to: BADGE_SCHEME_ALIASES[formerScheme],
            });
        }
        const {size, type, scheme} = normalizeBadgeContract({
            type: params.appearance ?? params.type,
            scheme: requestedScheme,
            size: params.size,
        });
        const className = this.attrs.class || this.attrs.className;
        const accessibleLabel = this.attrs['aria-label'] || '';
        this.badge = document.createElement('span');
        if (this.id) {
            this.badge.id = this.id;
        }
        this.badge.classList.add(
            'sf-badge',
            `sf-badge--size-${size}`,
            `sf-badge--${type}`,
            `sf-badge--${scheme}`,
        );
        if (className) {
            this.badge.classList.add(...`${className}`.split(' ').filter(Boolean));
        }
        Object.entries(this.attrs)
            .filter(([attr]) => !['class', 'className', 'aria-label'].includes(attr))
            .forEach(([attr, value]) => {
                if (value === undefined || value === null) {
                    return;
                }
                this.badge.setAttribute(attr, value);
            });
        const startIcon = iconLeft ?? (icon && iconPosition !== 'end' ? icon : null);
        const endIcon = iconRight ?? (icon && iconPosition === 'end' ? icon : null);

        this.iconContainerLeft = this.createIcon(startIcon);
        this.iconContainerRight = this.createIcon(endIcon);

        this.accessibleText = null;
        if (accessibleLabel) {
            this.accessibleText = document.createElement('span');
            this.accessibleText.classList.add('sr-only');
            this.accessibleText.textContent = accessibleLabel;
        }

        this.textContainer = null;
        this.textElement = null;
        if (text !== undefined && text !== null && String(text).length > 0) {
            this.textContainer = document.createElement('span');
            this.textContainer.classList.add('sf-badge-text-container');
            this.textElement = document.createElement('span');
            this.textElement.classList.add('sf-badge-text');
            this.textElement.textContent = text;
            this.textContainer.append(this.textElement);
            if (accessibleLabel) {
                this.textContainer.setAttribute('aria-hidden', 'true');
            }
        }

        if (!accessibleLabel && !this.textContainer) {
            this.badge.setAttribute('aria-hidden', 'true');
        }

        this.applyLayoutUtilities(this.badge, '.sf-badge');
        this.applyLayoutUtilities(this.iconContainerLeft, '.sf-badge .sf-badge-icon-container');
        this.applyLayoutUtilities(this.iconContainerRight, '.sf-badge .sf-badge-icon-container');
        this.applyLayoutUtilities(this.textContainer, '.sf-badge .sf-badge-text-container');
        this.applyLayoutUtilities(this.textElement, '.sf-badge .sf-badge-text');

        this.applyUtilities(this.badge, this.params?.utilities?.badge ?? this.params?.utilities);
        this.applyUtilities(this.iconContainerLeft, this.params?.utilities?.iconContainer ?? this.params?.utilities?.icon);
        this.applyUtilities(this.iconContainerRight, this.params?.utilities?.iconContainer ?? this.params?.utilities?.icon);
        this.applyUtilities(this.textContainer, this.params?.utilities?.textContainer);
        this.applyUtilities(this.textElement, this.params?.utilities?.text);

        if (this.accessibleText) {
            this.badge.append(this.accessibleText);
        }
        if (this.iconContainerLeft) {
            this.badge.append(this.iconContainerLeft);
        }
        if (this.textContainer) {
            this.badge.append(this.textContainer);
        }
        if (this.iconContainerRight) {
            this.badge.append(this.iconContainerRight);
        }
        this.template = this.badge;
    }

    createIcon(iconName) {
        if (!iconName) {
            return null;
        }
        const container = document.createElement('span');
        container.classList.add('sf-badge-icon-container');
        const icon = document.createElement('i');
        icon.classList.add('sf-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconName;
        container.append(icon);
        return container;
    }

    applyUtilities(target, utilities) {
        if (!target || !utilities) {
            return;
        }
        const normalize = (value) => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') return value.split(' ');
            if (Array.isArray(value?.classes)) return value.classes;
            if (typeof value?.classes === 'string') return value.classes.split(' ');
            if (Array.isArray(value?.badge)) return value.badge;
            if (typeof value?.badge === 'string') return value.badge.split(' ');
            return [];
        };
        normalize(utilities).filter(Boolean).forEach(cls => target.classList.add(cls));
    }

    init() {
    }
}

Badges.utilityMap = badgeUtility;

registerComponent('Badges', Badges);
