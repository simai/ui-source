SF.RuleLoader['buttons'] = {
                regex: /class\s*=\s*["'][^"']*\bsf-button\b/i,
                type: 'component',
                css: true,
                js: true,
                // The spinner a loading button shows, fetched after the page is ready.
                relation: [{ name: 'spinner', lazy: true }],
            };
