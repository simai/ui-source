SF.RuleLoader['slider'] = {
                // The class token (sf-slider and its parts), not the name
                // anywhere in the attributes: sf-slider-range's field label id
                // "sf-slider-range-field-1" fetched the carousel's sheets and
                // swiper on a page without a slider.
                regex: /class\s*=\s*["'](?:[^"']*\s)?sf-slider(?:[\s"']|-)/i,
                type: 'component',
                css: true,
                js: true,
                relation: [{ name: 'swiper' }],
            };
