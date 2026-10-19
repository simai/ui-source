SF.RuleLoader['quantity'] = {
                regex: /sf-quantity/,
                type: 'component',
                css: true,
                js: true,
                // Its steppers are icon buttons the script draws: a page planned
                // from markup alone had no icon-button styles for them, and the
                // browser's grey button showed through (2026-10-19).
                relation: [{name: 'icon-buttons'}],
            };
