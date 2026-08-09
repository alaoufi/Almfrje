import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Netlify applies browser security headers to static assets', () => {
  const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

  assert.match(config, /\[\[headers\]\]\s+for = "\/\*"/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Frame-Options = "SAMEORIGIN"/);
  assert.match(config, /X-Content-Type-Options = "nosniff"/);
  assert.match(config, /Referrer-Policy = "strict-origin-when-cross-origin"/);
  assert.match(config, /Permissions-Policy/);
});
