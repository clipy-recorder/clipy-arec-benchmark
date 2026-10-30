import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, client] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
]);

assert.match(html, /<h1 id="hero-title">[^<]+<\/h1>/);
assert.match(html, /id="start-free"/);
assert.match(html, /id="see-how"/);
assert.equal((html.match(/data-assurance=/g) ?? []).length, 3);
assert.match(html, /data-nav="resources"/);
assert.match(html, /class="proof-grid"/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(client, /setCapturePointerMode/);

console.log('Fixture smoke checks passed.');
