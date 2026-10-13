SF.RuleLoader['menu'] = {
                regex: /class\s*=\s*["'][^"']*\bsf-menu\b/i,
                type: 'component',
                css: true,
                js: true,
                relation: [{ name: 'icons' }, { name: 'icon-buttons' }],
            };
