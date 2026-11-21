// Owner decision C183 (2026-11-14): sf-time 1.3.0, sf-confirm-change 1.9.0.
// Research ui-control control/research/2026-11-14-change-time.md, prototype
// prototypes/change-time-study.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarDayOffset, formatDate, msUntilNextDay, timeZoneOffset} from '../src/core/js/format-date.js';
import {formatRelativeDay} from '../src/core/js/format-relative.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('C183 (3): core formats and counts days on a named zone\'s clock', () => {
  const at = new Date('2026-11-13T16:40:00Z');
  const now = new Date('2026-11-14T09:00:00Z');
  assert.equal(formatDate(at, {date: null, time: 'short', timeZone: 'Asia/Vladivostok', locale: 'ru'}), '02:40');
  assert.equal(formatDate(at, {date: null, time: 'short', timeZone: 'America/New_York', locale: 'ru'}), '11:40');
  assert.equal(calendarDayOffset(at, {now, timeZone: 'Asia/Vladivostok'}), 0);
  assert.equal(calendarDayOffset(at, {now, timeZone: 'Europe/Moscow'}), -1);
  assert.equal(timeZoneOffset(at, {timeZone: 'Europe/Moscow'}), 180);
  assert.equal(timeZoneOffset(at, {timeZone: 'Asia/Kolkata'}), 330);
  assert.equal(timeZoneOffset(at, {timeZone: 'America/New_York'}), -300);
  assert.equal(msUntilNextDay(now, {timeZone: 'Europe/Moscow'}), 12 * 3600000);
  assert.equal(formatRelativeDay(at, {now, weekday: false, timeZone: 'Asia/Vladivostok', locale: 'ru'}), 'сегодня');
  // An unknown zone is the reader's: nothing throws.
  assert.equal(typeof formatDate(at, {timeZone: 'Mars/Olympus', locale: 'ru'}), 'string');
});

test('C183: sf-time 1.3.0 -- just now, the time-zone setting, list times off the Tab order, the future mirrors the past', () => {
  const manifest = json('src/smart/time/component.json');
  assert.equal(manifest.version, '1.8.4'); // C278 follow-up: words through the registry aliases // group build 8: C204 (fix/time-table-c183) above GB7's 1.6.0 // 1.7.1: zone words of any language (C177 follow-up #113) // C282: 1.7.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.8.1 moved on by the merged branches or a GB10 patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.deepEqual(manifest.settings['time-zone'], {type: 'string', default: '', summary: manifest.settings['time-zone'].summary});
  const ru = json('src/smart/time/lang/ru.json').runtime;
  const en = json('src/smart/time/lang/en.json').runtime;
  assert.equal(ru['just-now'], 'только что');
  assert.equal(en['just-now'], 'just now');
  assert.equal(ru['zone-europe-moscow'], 'Москва');
  assert.equal(ru['zone-asia-vladivostok'], 'Владивосток');
  assert.deepEqual(Object.keys(ru).filter((key) => key.startsWith('zone-')), Object.keys(en).filter((key) => key.startsWith('zone-')));
  const source = read('src/smart/time/index.js');
  // (1) no seconds: under a minute past «только что», ahead the language's «now».
  assert.match(source, /return seconds > 0 \? 'soon' : 'just';/u);
  // (2) a list item, a feed or a log: no Tab stop, the full moment spoken.
  assert.match(source, /export const IN_LIST = 'li, \[role="listitem"\], \[role="feed"\], \[role="log"\], td, th, \[role="cell"\], \[role="gridcell"\], \[role="rowheader"\], \[role="columnheader"\]';/u);
  assert.match(source, /focusable: hasTip && !nested && !inList,/u);
  assert.match(read('src/smart/time/js/templates/default.js'), /<span class="sr-only">, \$\{said\.tip\}<\/span>/u);
  // (3) the tooltip names the zone.
  assert.match(source, /tip: where \? `\$\{full\}, \$\{where\}` : full/u);
  // (4) later today «сегодня, 14:00», tomorrow «завтра, 10:00».
  assert.match(source, /if \(day === 0\) shown = ahead \? joinWords\(words\.dateAt, relativeDay\(\), time\(\)\) : time\(\);/u);
  assert.match(source, /else if \(day === 1\) shown = joinWords\(words\.dateAt, relativeDay\(\), time\(\)\);/u);
  // The snapshots are taken on one clock, so the zone they print is the same everywhere.
  assert.match(read('scripts/snapshot-first-paint.mjs'), /const SNAPSHOT_TIME_ZONE = 'Europe\/Moscow';/u);
});

test('C183: sf-confirm-change 1.9.0 -- the main answer filled, the deadline an sf-time under the answers', () => {
  const manifest = json('src/smart/confirm-change/component.json');
  assert.equal(manifest.version, '1.10.7'); // group build 9: 1.9.1 moved on by the merged branches or a GB9 patch // C282: 1.9.2 moved on by the language-file patch (Russian is a language file) // group build 10: 1.10.1 moved on by the merged branches or a GB10 patch // group build 13: 1.10.5 moved on by the merged branches or a GB11 merge // group build 14: 1.10.6 moved on by the merged branches or the C278 language patch
  assert.ok(manifest.relations.some((relation) => relation.name === 'cl-time'));
  assert.match(read('src/smart/confirm-change/rule.js'), /\{ name: 'cl-time' \}/u);
  const source = read('src/smart/confirm-change/index.js');
  assert.match(source, /format=\$\{today \? "time" : "auto"\} threshold="PT0S"/u);
  const docs = read('src/smart/confirm-change/docs.md');
  assert.match(docs, /## Где спрашивать/u);
  assert.match(docs, /sf-confirm appearance="inline"/u);
});
