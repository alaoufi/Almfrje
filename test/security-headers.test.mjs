import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../next.config.mjs';

test('applies browser security headers to all routes', async () => {
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === '/:path*');
  assert.ok(globalRule, 'expected a global security-header rule');

  const headers = Object.fromEntries(globalRule.headers.map(({ key, value }) => [key, value]));
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
});
