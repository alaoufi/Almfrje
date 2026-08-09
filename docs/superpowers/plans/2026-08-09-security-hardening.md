# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the forgeable legacy JWT fallback, establish baseline browser security headers, and refresh vulnerable production dependencies.

**Architecture:** The legacy authentication module remains the single source of token signing and verification, but it will require a strong environment secret and fail closed. The Next.js configuration remains responsible for shared browser headers, while Node's built-in test runner protects both contracts without adding a test framework.

**Tech Stack:** Next.js, TypeScript, Node.js built-in `node:test`, npm audit.

---

## File structure

- `lib/db.ts` — legacy API JWT signing and verification; remove the insecure fallback.
- `next.config.mjs` — add common browser security headers without changing API cache directives.
- `test/legacy-jwt.test.mjs` — regression tests for missing, weak, and valid JWT secrets.
- `test/security-headers.test.mjs` — regression test for required headers emitted by Next.js configuration.
- `package.json` / `package-lock.json` — expose the test command and refresh patched dependencies.
- `DEPLOY.md` — document the required deployment-time JWT secret rotation.

### Task 1: Lock down legacy JWT configuration

**Files:**
- Create: `test/legacy-jwt.test.mjs`
- Modify: `lib/db.ts:22-28`

- [ ] **Step 1: Write the failing tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

async function legacyAuth() {
  return import(`../lib/db.ts?test=${Date.now()}-${Math.random()}`);
}

test('refuses to generate a token without JWT_SECRET', async () => {
  delete process.env.JWT_SECRET;
  const { generateToken } = await legacyAuth();
  assert.throws(() => generateToken(1, 'admin'), /JWT_SECRET/);
});

test('refuses a weak JWT_SECRET', async () => {
  process.env.JWT_SECRET = 'short-secret';
  const { generateToken } = await legacyAuth();
  assert.throws(() => generateToken(1, 'admin'), /JWT_SECRET/);
});

test('signs and verifies with a strong JWT_SECRET', async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  const { generateToken, verifyToken } = await legacyAuth();
  assert.equal(verifyToken(generateToken(7, 'admin'))?.uid, 7);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --experimental-strip-types --test test/legacy-jwt.test.mjs`

Expected: the missing- and weak-secret assertions fail because the current code signs with a hard-coded fallback.

- [ ] **Step 3: Implement the minimal fail-closed secret lookup**

```ts
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}
```

- [ ] **Step 4: Re-run the test and verify it passes**

Run: `node --experimental-strip-types --test test/legacy-jwt.test.mjs`

Expected: 3 passing tests and 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts test/legacy-jwt.test.mjs
git commit -m "fix: require secure legacy jwt secret"
```

### Task 2: Add browser security header regression tests

**Files:**
- Create: `test/security-headers.test.mjs`
- Modify: `next.config.mjs:52-88`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../next.config.mjs';

test('applies browser security headers to all routes', async () => {
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === '/:path*');
  const headers = Object.fromEntries(globalRule.headers.map(({ key, value }) => [key, value]));
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/security-headers.test.mjs`

Expected: failure because no global `/:path*` security-header rule exists.

- [ ] **Step 3: Add the global header rule**

```js
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
];
```

Return `{ source: '/:path*', headers: securityHeaders }` before the route-specific cache rules.

- [ ] **Step 4: Re-run the test and verify it passes**

Run: `node --test test/security-headers.test.mjs`

Expected: 1 passing test and 0 failures.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs test/security-headers.test.mjs
git commit -m "feat: add baseline security headers"
```

### Task 3: Refresh dependencies and document deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add the test command**

```json
"test": "node --experimental-strip-types --test test/*.test.mjs"
```

- [ ] **Step 2: Refresh patched dependencies**

Run: `npm audit fix --package-lock-only`

Expected: lockfile resolves patched production packages without source changes.

- [ ] **Step 3: Document secret rotation**

Add a deployment note requiring a fresh random `JWT_SECRET` of at least 32 characters and a redeploy; note that all legacy sessions are invalidated.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm run check:boundaries && npm run build && npm audit --omit=dev --package-lock-only`

Expected: tests, boundary check, and build exit 0; audit reports no high or critical production vulnerabilities.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json DEPLOY.md
git commit -m "chore: update secure production dependencies"
```
