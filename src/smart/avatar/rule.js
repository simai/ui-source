SF.RuleLoader['cl-avatar'] = {
                tags: ['sf-avatar'],
                type: 'smart',
                mode: 'smart',
                js: true,
                // The badge sheet places a count or a dot on the avatar
                // (simai/ui-source#12).
                relation: [{ name: 'avatars' }, { name: 'badges' }]
            };
