import assert from 'node:assert/strict';
import test from 'node:test';
import { generateToken, verifyToken } from '../lib/db.ts';

const originalSecret = process.env.JWT_SECRET;

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

test('refuses to generate a token without JWT_SECRET', () => {
  delete process.env.JWT_SECRET;
  assert.throws(() => generateToken(1, 'admin'), /JWT_SECRET/);
});

test('refuses a weak JWT_SECRET', () => {
  process.env.JWT_SECRET = 'short-secret';
  assert.throws(() => generateToken(1, 'admin'), /JWT_SECRET/);
});

test('signs and verifies with a strong JWT_SECRET', () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  assert.equal(verifyToken(generateToken(7, 'admin'))?.uid, 7);
});
