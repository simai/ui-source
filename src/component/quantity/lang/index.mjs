// The component's words for the bundle and for Node alike (localization study
// LC-4/LC-5): the runtime words of its language files, by language.
import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };

export default { en: en.runtime, ru: ru.runtime };
