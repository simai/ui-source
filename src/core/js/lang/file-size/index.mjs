// The unit words of a file size (localization study LC-3), for the bundle and
// for Node alike: the runtime words of the language files, by language.
import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };

export default { en: en.runtime, ru: ru.runtime };
