import assert from 'node:assert/strict';

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';
const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });

assert.ok(
  response.status === 307 || response.status === 308,
  `Expected the root URL to redirect, received ${response.status}`,
);
assert.equal(
  response.headers.get('location'),
  '/almfrje/',
  'Expected the root URL to redirect to the canonical Almfrje path',
);

console.log('Root redirect verified.');
