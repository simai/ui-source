import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  RICH_TEXT_ELEMENTS,
  parseHtml,
  richTextFromPlainText,
  richTextHref,
  sanitizeRichText,
} from '../src/smart/rich-text/js/rich-text-html.mjs';

// sf-rich-text keeps its value to the HTML subset of Larena's html@1 type:
// p h2 h3 h4 strong em a[href] ul ol li blockquote br, href only https:,
// mailto:, tel: or a /path on the site. These run the cleaner without a DOM
// (parseHtml, the reader a server or a test uses); the browser probe
// tests/browser/rich-text.browser.mjs runs the same vectors through the
// browser's own parser.

const root = new URL('..', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const clean = (html) => sanitizeRichText(html, {document: null});
const editor = (html) => sanitizeRichText(html, {document: null, mode: 'editor'});

// The vectors, shared with the browser probe.
export const VECTORS = JSON.parse(readFileSync(new URL('fixtures/rich-text-vectors.json', import.meta.url), 'utf8'));

test('each element of the subset is kept', () => {
  assert.deepEqual([...RICH_TEXT_ELEMENTS].sort(), ['a', 'blockquote', 'br', 'em', 'h2', 'h3', 'h4', 'li', 'ol', 'p', 'strong', 'ul']);
  assert.equal(clean('<p>a</p>'), '<p>a</p>');
  for (const tag of ['h2', 'h3', 'h4']) assert.equal(clean(`<${tag}>Title</${tag}>`), `<${tag}>Title</${tag}>`);
  assert.equal(clean('<p><strong>b</strong> <em>i</em></p>'), '<p><strong>b</strong> <em>i</em></p>');
  assert.equal(clean('<p><a href="https://simai.io/docs">x</a></p>'), '<p><a href="https://simai.io/docs">x</a></p>');
  assert.equal(clean('<ul><li>a</li><li>b</li></ul>'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(clean('<ol><li>a</li></ol>'), '<ol><li>a</li></ol>');
  assert.equal(clean('<blockquote><p>q</p></blockquote>'), '<blockquote><p>q</p></blockquote>');
  assert.equal(clean('<p>a<br>b</p>'), '<p>a<br>b</p>');
});

test('elements off the subset are unwrapped and their text kept', () => {
  assert.equal(clean('<p>a <span>b</span> <u>c</u> <code>d</code> <s>e</s> <font color="red">f</font></p>'), '<p>a b c d e f</p>');
  assert.equal(clean('<h1>Top</h1><h5>Low</h5><h6>Lower</h6>'), '<p>Top</p><p>Low</p><p>Lower</p>');
  assert.equal(clean('<div>one</div><div>two</div>'), '<p>one</p><p>two</p>');
  assert.equal(clean('<section><article>a</article></section>'), '<p>a</p>');
  assert.equal(clean('<table><tr><td>1</td><td>2</td></tr></table>'), '<p>1</p><p>2</p>');
  assert.equal(clean('<pre>line 1\nline 2</pre>'), '<p>line 1<br>line 2</p>');
  assert.equal(clean('<button>Press</button><label>Name</label>'), '<p>PressName</p>');
  assert.equal(clean('<li>loose</li>'), '<p>loose</p>');
});

test('script, style and other code containers go with their content', () => {
  assert.equal(clean('<p>a<script>alert(1)</script>b</p>'), '<p>ab</p>');
  assert.equal(clean('<style>p{color:red}</style><p>x</p>'), '<p>x</p>');
  assert.equal(clean('<SCRIPT>alert(1)</SCRIPT >x'), '<p>x</p>');
  assert.equal(clean('<template><p>t</p></template><svg><text>s</text></svg><math><mi>m</mi></math>keep'), '<p>keep</p>');
  assert.equal(clean('<iframe src="https://e.com">i</iframe><img src=x onerror=alert(1)><object>o</object>x'), '<p>x</p>');
  assert.equal(clean('<p>x</p><!-- secret -->'), '<p>x</p>');
});

test('every attribute but href on a link is stripped', () => {
  assert.equal(clean('<p class="lead" id="x" style="color:red" onclick="steal()" data-a="1" title="t">a</p>'), '<p>a</p>');
  assert.equal(clean('<a href="https://e.com/" target="_blank" rel="opener" onclick="x()" title="t">x</a>'), '<p><a href="https://e.com/">x</a></p>');
  assert.equal(clean('<strong style="color:red" class="c">b</strong>'), '<p><strong>b</strong></p>');
  assert.equal(clean('<ul type="square"><li value="3" class="x">a</li></ul>'), '<ul><li>a</li></ul>');
});

test('hrefs: https, mailto, tel and a site path are kept; everything else drops the link, not the text', () => {
  const kept = {
    'https://simai.io/docs?q=1#a': 'https://simai.io/docs?q=1#a',
    'HTTPS://SIMAI.IO': 'https://simai.io/',
    'mailto:team@simai.io': 'mailto:team@simai.io',
    'tel:+74951234567': 'tel:+74951234567',
    '/about': '/about',
    '/docs/a?b=1#c': '/docs/a?b=1#c',
    '  /trimmed  ': '/trimmed',
  };
  for (const [href, expected] of Object.entries(kept)) assert.equal(richTextHref(href), expected, href);
  const refused = [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
    'java\u0000script:alert(1)', 'data:text/html,<script>alert(1)</script>', 'DATA:image/png;base64,AAAA', 'vbscript:msgbox(1)',
    '//evil.example/x', '/\\evil.example', '/\t/evil.example', 'http://simai.io', 'ftp://simai.io', 'file:///etc/passwd',
    'relative/path', '#anchor', '?q=1', '', '   ', 'mailto:', 'https://', null, undefined, 42,
  ];
  for (const href of refused) assert.equal(richTextHref(href), null, JSON.stringify(href));
  assert.equal(clean('<a href="javascript:alert(1)">click</a>'), '<p>click</p>');
  assert.equal(clean('<a href="data:text/html,x">data</a>'), '<p>data</p>');
  assert.equal(clean('<a href="//evil.example">host</a>'), '<p>host</p>');
  assert.equal(clean('<a href="&#106;avascript:alert(1)">entity</a>'), '<p>entity</p>');
  assert.equal(clean('<a href="&#x6A;avascript&colon;alert(1)">hex</a>'), '<p>hex</p>');
  assert.equal(clean('<a>no href</a>'), '<p>no href</p>');
  assert.equal(clean('<a href="https://a.example"><a href="https://b.example">inner</a></a>'), '<p><a href="https://a.example/">inner</a></p>');
  assert.equal(clean('<a href="/x?a=1&amp;b=&quot;2&quot;">q</a>'), '<p><a href="/x?a=1&amp;b=&quot;2&quot;">q</a></p>');
});

test('lists nest, and loose items, nested lists and paragraphs in items are normalised', () => {
  assert.equal(clean('<ul><li>a<ul><li>b<ol><li>c</li></ol></li></ul></li><li>d</li></ul>'), '<ul><li>a<ul><li>b<ol><li>c</li></ol></li></ul></li><li>d</li></ul>');
  // An indent command's list right inside a list belongs to the item before it.
  assert.equal(clean('<ul><li>a</li><ul><li>b</li></ul></ul>'), '<ul><li>a<ul><li>b</li></ul></li></ul>');
  assert.equal(clean('<ol><li>one<li>two</ol>'), '<ol><li>one</li><li>two</li></ol>');
  assert.equal(clean('<ul>loose<li>a</li></ul>'), '<ul><li>loose</li><li>a</li></ul>');
  assert.equal(clean('<ul><li><p>a</p><p>b</p></li></ul>'), '<ul><li>a<br>b</li></ul>');
  assert.equal(clean('<ul><li>a</li></ul><ul><li>b</li></ul>'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(clean('<ul><li>a</li></ul><ol><li>b</li></ol>'), '<ul><li>a</li></ul><ol><li>b</li></ol>');
  assert.equal(clean('<ul><li></li><li> </li></ul>'), '');
});

test('loose text is wrapped in a paragraph and blocks are split, not nested', () => {
  assert.equal(clean('plain'), '<p>plain</p>');
  assert.equal(clean('a<p>b</p>c'), '<p>a</p><p>b</p><p>c</p>');
  assert.equal(clean('<p>a<ul><li>b</li></ul>c</p>'), '<p>a</p><ul><li>b</li></ul><p>c</p>');
  assert.equal(clean('<p>a<p>b'), '<p>a</p><p>b</p>');
  assert.equal(clean('<h2>a<p>b</p>c</h2>'), '<h2>a</h2><p>b</p><h2>c</h2>');
  assert.equal(clean('<blockquote>quoted<p>more</p></blockquote>'), '<blockquote><p>quoted</p><p>more</p></blockquote>');
  assert.equal(clean('<strong><p>x</p><p>y</p></strong>'), '<p><strong>x</strong></p><p><strong>y</strong></p>');
  assert.equal(clean('<p>a</p>\n  \n<p>b</p>'), '<p>a</p><p>b</p>');
  assert.equal(clean('<p>  a   <em> b </em>  </p>'), '<p>a <em>b</em></p>');
  assert.equal(clean('<em><strong>x</strong></em>'), '<p><strong><em>x</em></strong></p>');
  assert.equal(clean('<p><strong>a</strong><strong>b</strong></p>'), '<p><strong>ab</strong></p>');
});

test('an empty value is "", never an empty paragraph', () => {
  for (const html of ['', '<p></p>', '<p><br></p>', '<p> </p>', '<p>&nbsp;</p>', '<ul><li></li></ul>', '<blockquote></blockquote>', '<h2></h2><p><br><br></p>', '<script>x</script>', null, undefined]) {
    assert.equal(clean(html), '', JSON.stringify(html));
  }
  assert.equal(clean('<p>a</p><p></p><p><br></p>'), '<p>a</p>');
  assert.equal(clean('<p><br>a<br><br></p>'), '<p>a</p>');
  // The editing surface keeps a line for the caret.
  assert.equal(editor(''), '<p><br></p>');
  assert.equal(editor('<p>a</p><p></p>'), '<p>a</p><p><br></p>');
  assert.equal(editor('<p>a<br><br></p>'), '<p>a<br><br></p>');
});

test('word processor marks: b, i and bold or italic styles; a b that says normal is not bold', () => {
  assert.equal(clean('<b>b</b> <i>i</i>'), '<p><strong>b</strong> <em>i</em></p>');
  assert.equal(clean('<span style="font-weight:700">x</span><span style="font-style: italic">y</span>'), '<p><strong>x</strong><em>y</em></p>');
  assert.equal(clean('<b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="font-weight:700">B</span> text</p></b>'), '<p><strong>B</strong> text</p>');
  assert.equal(clean('<strong>a <span style="font-weight: 400">b</span></strong>'), '<p><strong>a </strong>b</p>');
});

test('entities are decoded and text is escaped on the way out', () => {
  assert.equal(clean('<p>a &amp; b &lt;c&gt; &quot;d&quot; &hellip; &#8212; &#x41;</p>'), '<p>a &amp; b &lt;c&gt; "d" \u2026 \u2014 A</p>');
  assert.equal(clean('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(clean('<p>a&nbsp;b</p>'), '<p>a&nbsp;b</p>');
  assert.equal(clean('<p>5 < 6 and 7 > 3</p>'), '<p>5 &lt; 6 and 7 &gt; 3</p>');
});

test('plain text paste: paragraphs on blank lines, a line break on a single newline', () => {
  assert.equal(richTextFromPlainText('one\ntwo\n\nthree'), '<p>one<br>two</p><p>three</p>');
  assert.equal(richTextFromPlainText('a\r\n\r\n\r\nb'), '<p>a</p><p>b</p>');
  assert.equal(richTextFromPlainText('<b>not markup</b> & more'), '<p>&lt;b&gt;not markup&lt;/b&gt; &amp; more</p>');
  assert.equal(richTextFromPlainText('\n\n'), '');
  assert.equal(richTextFromPlainText(''), '');
});

test('the cleaner is stable: its output cleans to itself', () => {
  for (const vector of VECTORS) {
    const once = clean(vector.input);
    assert.equal(once, vector.value, `value of ${JSON.stringify(vector.input)}`);
    assert.equal(clean(once), once, `stable: ${once}`);
    assert.equal(clean(editor(vector.input)), once, `editor form cleans to the value: ${vector.input}`);
  }
});

test('nothing off the subset survives any vector', () => {
  for (const vector of VECTORS) {
    const tree = parseHtml(clean(vector.input));
    const walk = (node) => {
      for (const child of node.children ?? []) {
        if (child.type !== 'element') continue;
        assert.ok(RICH_TEXT_ELEMENTS.includes(child.name), `${child.name} in ${vector.input}`);
        const attributes = Object.keys(child.attrs);
        assert.deepEqual(attributes, child.name === 'a' ? ['href'] : [], `${child.name} attributes in ${vector.input}`);
        if (child.name === 'a') assert.ok(richTextHref(child.attrs.href), child.attrs.href);
        walk(child);
      }
    };
    walk(tree);
  }
});

test('the manifest: a form field of the field family, its settings, events and words', () => {
  const component = json('src/smart/rich-text/component.json');
  const manifest = json('src/smart/rich-text/smart.manifest.json');
  const en = json('src/smart/rich-text/lang/en.json');
  const ru = json('src/smart/rich-text/lang/ru.json');
  assert.equal(component.tag, 'sf-rich-text');
  assert.equal(component.id, 'smart.rich-text');
  assert.equal(component.family, 'field');
  assert.deepEqual(Object.keys(component.settings).sort(), [
    'appearance', 'disabled', 'error-message', 'hint', 'invalid', 'label', 'max-rows', 'name', 'placeholder', 'readonly', 'required', 'rows', 'size',
  ]);
  assert.deepEqual(component.settings.size.values, ['1/2', '1', '2']);
  assert.deepEqual(component.values.value, {...component.values.value, type: 'string', default: ''});
  assert.deepEqual(Object.keys(component.events).sort(), ['change', 'input']);
  for (const event of Object.values(component.events)) assert.equal(event.carries, 'native');
  assert.equal(component.form.value, 'value');
  assert.equal(component.form.reset, 'default');
  assert.deepEqual(component.form.validity, ['value-missing', 'custom-error']);
  assert.equal(component.accessibility.role, 'textbox');
  for (const key of ['Mod+B', 'Mod+I', 'Mod+K', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Y']) assert.ok(component.keyboard.host[key], key);
  // The generated registry entry says the same.
  assert.equal(manifest.custom_element, 'sf-rich-text');
  assert.equal(manifest.inputs.properties.value.type, 'string');
  assert.ok(manifest.events.input && manifest.events.change);
  assert.ok(manifest.provenance.source_artifacts.some((artifact) => artifact.path === 'src/smart/rich-text/js/rich-text-html.mjs'));
  // The words: one key set in both languages, every toolbar word among them.
  assert.deepEqual(Object.keys(ru.runtime).sort(), Object.keys(en.runtime).sort());
  for (const key of ['toolbar', 'paragraph', 'heading-2', 'heading-3', 'heading-4', 'bold', 'italic', 'link', 'bulleted-list',
    'numbered-list', 'quote', 'undo', 'redo', 'link-address', 'link-invalid', 'link-apply', 'link-remove', 'value-missing']) {
    assert.ok(en.runtime[key] && ru.runtime[key] && en.runtime[key] !== ru.runtime[key], key);
  }
  // The rule is registered and the bundle has its own sheet.
  assert.match(readFileSync(new URL('src/core/js/rule.src.js', root), 'utf8'), /import '\.\.\/\.\.\/smart\/rich-text\/rule\.js';/u);
  const source = readFileSync(new URL('src/smart/rich-text/index.js', root), 'utf8');
  assert.match(source, /SfRichText\.define\('sf-rich-text'\)/u);
  assert.match(source, /import '\.\/scss\/index\.scss';/u);
});

test('the element makes no server call and puts no string on the page uncleaned', () => {
  const source = readFileSync(new URL('src/smart/rich-text/index.js', root), 'utf8')
    + readFileSync(new URL('src/smart/rich-text/js/templates/default.js', root), 'utf8');
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/u);
  assert.doesNotMatch(source, /unsafeHTML/u);
  // Every innerHTML written is the cleaner's output or a history entry of it.
  const writes = [...source.matchAll(/innerHTML = ([^;]+);/gu)].map((match) => match[1].trim());
  assert.deepEqual(writes, [
    "sanitizeRichText(String(html ?? ''), {mode: 'editor'})",
    'clean',
    'clean',
    'entry.html',
  ]);
});
