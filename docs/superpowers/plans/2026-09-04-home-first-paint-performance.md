# Almfrje Home First-Paint Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إظهار الرئيسية من ملخص صغير موثّق، ثم تحميل الشجرة المصرح بها مرة واحدة في الخلفية، مع خفض وسيط الظهور البارد 30% على الأقل.

**Architecture:** تضيف قاعدة البيانات دالة تجميع خادمة لا يستطيع العميل تنفيذها، ويعرض مسار مسجل أو `guest-bootstrap` نموذجًا موحدًا خاليًا من الحقول الحساسة. تفصل الواجهة حالة ملخص الرئيسية عن حالة الشجرة، وتستخدم وعد تحميل واحدًا وفهرسة لاحقة، بينما تبقى الشاشات المعتمدة على الشجرة والبحث في حالة تجهيز واضحة.

**Tech Stack:** Next.js Route Handlers، TypeScript، Supabase/PostgreSQL JSON aggregation، JavaScript الواجهة الحالية، Node `node:test`، Playwright باستخدام Chrome المثبت للقياس.

---

## Prerequisite gate

لا تبدأ هذه الخطة إلا بعد اكتمال `docs/superpowers/plans/2026-09-04-almfrje-security-hardening.md` ونجاح `npm.cmd run verify:almfrje-access` على النسخة المنشورة. أي فشل صلاحيات يعيد العمل إلى الخطة الأمنية ولا يعالج بتوسيع القراءة.

## File structure

- `lib/almfrje-home-summary.ts` — نوع الملخص وقائمة الحقول ومدقق الاستجابة النقي.
- `lib/almfrje-schema.ts` — دالة SQL التي تجمع ملخص الرئيسية داخل PostgreSQL وتمنع تنفيذ العميل.
- `app/api/almfrje-home-summary/route.ts` — ملخص المستخدم المسجل بعد التحقق من العضوية.
- `app/api/almfrje-guest-bootstrap/route.ts` — يضم الملخص نفسه إلى استجابة الزائر الموثق.
- `public/almfrje/app.js` — حالة الملخص، وعد الشجرة الواحد، وعرض الرئيسية قبل اكتمال الشجرة.
- `public/almfrje/app.css` — الحالة المعطلة للبحث ومؤشر تجهيز الشاشات التابعة.
- `test/almfrje-home-summary.test.mjs` — عقد الحقول والمدقق ومنع الحقول الحساسة.
- `test/almfrje-home-performance.test.mjs` — عقود عدم انتظار `loadAll()` وعدم تكرار الطلب.
- `scripts/measure-almfrje-home.mjs` — خمس جولات متطابقة واحتساب الوسيط.
- `package.json` / `package-lock.json` — أمر القياس واعتماد Playwright التطويري.
- `DEPLOY.md` — بوابة قياس الأداء والنشر والرجوع.

### Task 1: Define and validate the home summary contract

**Files:**
- Create: `lib/almfrje-home-summary.ts`
- Create: `test/almfrje-home-summary.test.mjs`

- [ ] **Step 1: Write failing contract tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHomeSummary } from '../lib/almfrje-home-summary.ts';

const valid = {
  totalPersons: 1511,
  liveBranchCount: 18,
  maxGeneration: 9,
  branchGroups: [{ rootId: 1, rootName: 'فراج', total: 900, branches: [{ id: 3, name: 'فرع', count: 80 }] }],
  recentPersons: [{ id: 1511, name: 'اسم', branchId: 3, createdAt: '2026-09-04T00:00:00.000Z' }],
  recentCount: 1,
  generatedAt: '2026-09-04T00:00:00.000Z',
};

test('accepts the exact public summary shape', () => {
  assert.deepEqual(parseHomeSummary(valid), valid);
});

test('rejects sensitive or malformed data', () => {
  assert.equal(parseHomeSummary({ ...valid, phone: '0500000000' }), null);
  assert.equal(parseHomeSummary({ ...valid, totalPersons: -1 }), null);
  assert.equal(parseHomeSummary({ ...valid, recentPersons: [{ ...valid.recentPersons[0], notes: 'x' }] }), null);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-home-summary.test.mjs`

Expected: FAIL because `lib/almfrje-home-summary.ts` does not exist.

- [ ] **Step 3: Implement the strict parser**

```ts
export interface HomeSummary {
  totalPersons: number;
  liveBranchCount: number;
  maxGeneration: number;
  branchGroups: Array<{ rootId: number | null; rootName: string; total: number; branches: Array<{ id: number; name: string; count: number }> }>;
  recentPersons: Array<{ id: number; name: string; branchId: number | null; createdAt: string | null }>;
  recentCount: number;
  generatedAt: string;
}

const topKeys = new Set(['totalPersons','liveBranchCount','maxGeneration','branchGroups','recentPersons','recentCount','generatedAt']);
const nonNegative = (v: unknown) => Number.isInteger(v) && Number(v) >= 0;

export function parseHomeSummary(value: unknown): HomeSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (Object.keys(o).some((key) => !topKeys.has(key))) return null;
  if (!nonNegative(o.totalPersons) || !nonNegative(o.liveBranchCount) || !nonNegative(o.maxGeneration) || !nonNegative(o.recentCount)) return null;
  if (!Array.isArray(o.branchGroups) || !Array.isArray(o.recentPersons) || typeof o.generatedAt !== 'string') return null;
  for (const group of o.branchGroups as Array<Record<string, unknown>>) {
    if (!group || Object.keys(group).some((k) => !['rootId','rootName','total','branches'].includes(k))) return null;
    if (group.rootId !== null && !Number.isInteger(group.rootId)) return null;
    if (typeof group.rootName !== 'string' || !nonNegative(group.total) || !Array.isArray(group.branches)) return null;
    for (const branch of group.branches as Array<Record<string, unknown>>) {
      if (Object.keys(branch).some((k) => !['id','name','count'].includes(k))) return null;
      if (!Number.isInteger(branch.id) || typeof branch.name !== 'string' || !nonNegative(branch.count)) return null;
    }
  }
  for (const person of o.recentPersons as Array<Record<string, unknown>>) {
    if (!person || Object.keys(person).some((k) => !['id','name','branchId','createdAt'].includes(k))) return null;
    if (!Number.isInteger(person.id) || typeof person.name !== 'string') return null;
    if (person.branchId !== null && !Number.isInteger(person.branchId)) return null;
    if (person.createdAt !== null && typeof person.createdAt !== 'string') return null;
  }
  return o as unknown as HomeSummary;
}
```

- [ ] **Step 4: Re-run tests**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-home-summary.test.mjs`

Expected: 2 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-home-summary.ts test/almfrje-home-summary.test.mjs
git commit -m "test: define safe home summary contract"
```

### Task 2: Aggregate the summary inside PostgreSQL

**Files:**
- Modify: `lib/almfrje-schema.ts`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing SQL privilege assertions**

```js
test('home summary RPC is service-only and has a fixed search path', async () => {
  const sql = await readFile(new URL('../lib/almfrje-schema.ts', import.meta.url), 'utf8');
  assert.match(sql, /FUNCTION public\.almfrje_home_summary\(\)/);
  assert.match(sql, /SECURITY DEFINER SET search_path = public/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.almfrje_home_summary\(\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.almfrje_home_summary\(\) TO service_role/i);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL because the RPC does not exist.

- [ ] **Step 3: Add the service-only aggregation function**

Bump `ALMFRJE_SCHEMA_VERSION` to `2026-09-04-2` and append:

```sql
CREATE OR REPLACE FUNCTION public.almfrje_home_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
WITH RECURSIVE
branch_counts AS (
  SELECT branch_id, count(*)::int AS n FROM public.almfrje_persons
  WHERE branch_id IS NOT NULL GROUP BY branch_id
),
lineage AS (
  SELECT b.id AS branch_id, b.name AS branch_name, p.id AS person_id, p.name AS person_name,
         p.father_id, 0 AS depth
  FROM public.almfrje_branches b LEFT JOIN public.almfrje_persons p ON p.id = b.root_id
  UNION ALL
  SELECT l.branch_id, l.branch_name, p.id, p.name, p.father_id, l.depth + 1
  FROM lineage l JOIN public.almfrje_persons p ON p.id = l.father_id WHERE l.depth < 80
),
top_roots AS (
  SELECT DISTINCT ON (branch_id) branch_id, branch_name, person_id AS root_id, person_name AS root_name
  FROM lineage ORDER BY branch_id, depth DESC
),
live_branches AS (
  SELECT t.root_id, coalesce(t.root_name, 'فروع') AS root_name, t.branch_id AS id,
         t.branch_name AS name, c.n AS count
  FROM top_roots t JOIN branch_counts c ON c.branch_id = t.branch_id WHERE c.n > 1
),
groups AS (
  SELECT root_id, root_name, sum(count)::int AS total,
         jsonb_agg(jsonb_build_object('id',id,'name',name,'count',count) ORDER BY count DESC) AS branches
  FROM live_branches GROUP BY root_id, root_name
),
recent_cfg AS (
  SELECT
    coalesce((SELECT value = 'true'::jsonb FROM public.almfrje_settings WHERE key='recent_show'), true) AS shown,
    (SELECT nullif(value #>> '{}','')::timestamptz FROM public.almfrje_settings WHERE key='recent_since') AS since_at
),
recent_rows AS (
  SELECT p.id,p.name,p.branch_id,p.created_at
  FROM public.almfrje_persons p, recent_cfg c
  WHERE c.shown AND (c.since_at IS NULL OR p.created_at >= c.since_at)
  ORDER BY p.id DESC LIMIT 12
)
SELECT jsonb_build_object(
  'totalPersons', (SELECT count(*)::int FROM public.almfrje_persons),
  'liveBranchCount', (SELECT count(*)::int FROM live_branches),
  'maxGeneration', coalesce((SELECT max(generation)::int FROM public.almfrje_persons),0),
  'branchGroups', coalesce((SELECT jsonb_agg(jsonb_build_object('rootId',root_id,'rootName',root_name,'total',total,'branches',branches) ORDER BY total DESC) FROM groups),'[]'::jsonb),
  'recentPersons', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'branchId',branch_id,'createdAt',created_at) ORDER BY id DESC) FROM recent_rows),'[]'::jsonb),
  'recentCount', (SELECT CASE WHEN NOT shown OR since_at IS NULL THEN 0 ELSE (SELECT count(*)::int FROM public.almfrje_persons WHERE created_at >= since_at) END FROM recent_cfg),
  'generatedAt', now()
); $func$;
REVOKE ALL ON FUNCTION public.almfrje_home_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.almfrje_home_summary() TO service_role;
```

- [ ] **Step 4: Run contracts and boundary checks**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd run check:boundaries`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-schema.ts test/almfrje-security-contract.test.mjs
git commit -m "feat: aggregate almfrje home summary"
```

### Task 3: Serve the summary only after identity verification

**Files:**
- Create: `app/api/almfrje-home-summary/route.ts`
- Modify: `app/api/almfrje-guest-bootstrap/route.ts`
- Modify: `test/almfrje-home-performance.test.mjs`

- [ ] **Step 1: Add failing route contracts**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('registered summary authenticates before service RPC', async () => {
  const source = await readFile(new URL('../app/api/almfrje-home-summary/route.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf('requireActiveMember') < source.indexOf("rpc('almfrje_home_summary')"));
  assert.match(source, /parseHomeSummary/);
  assert.match(source, /private, no-store/);
});

test('guest bootstrap verifies its view cookie before summary RPC', async () => {
  const source = await readFile(new URL('../app/api/almfrje-guest-bootstrap/route.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf("verifyGuestToken") < source.indexOf("rpc('almfrje_home_summary')"));
  assert.match(source, /Vary.*Cookie/);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test test/almfrje-home-performance.test.mjs`

Expected: FAIL because the registered route does not exist and guest bootstrap lacks the RPC.

- [ ] **Step 3: Add the registered member route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseHomeSummary } from '@/lib/almfrje-home-summary';
import { AlmfrjeHttpError, requireActiveMember } from '@/lib/almfrje-server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireActiveMember(request);
    const { data, error } = await admin.rpc('almfrje_home_summary');
    if (error) return NextResponse.json({ ok: false, error: 'تعذّر تحميل الملخص' }, { status: 500 });
    const summary = parseHomeSummary(data);
    if (!summary) return NextResponse.json({ ok: false, error: 'استجابة ملخص غير صالحة' }, { status: 500 });
    return NextResponse.json({ ok: true, summary }, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' } });
  } catch (error) {
    const status = error instanceof AlmfrjeHttpError ? error.status : 500;
    return NextResponse.json({ ok: false, error: status === 500 ? 'تعذّر تحميل الملخص' : (error as Error).message }, { status });
  }
}
```

- [ ] **Step 4: Add the same validated summary to guest bootstrap**

After `verifyGuestToken` succeeds and before returning, use the same strict parser:

```ts
const { data, error } = await admin.rpc('almfrje_home_summary');
const summary = error ? null : parseHomeSummary(data);
if (!summary) return NextResponse.json({ ok: false, error: 'تعذّر تحميل الملخص' }, { status: 500 });
return NextResponse.json({ ok: true, guest, settings, summary }, {
  headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' },
});
```

Never fall back to a table-wide service read.

- [ ] **Step 5: Run route contracts and TypeScript**

Run: `node --test test/almfrje-home-performance.test.mjs; npx.cmd tsc --noEmit`

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add app/api/almfrje-home-summary app/api/almfrje-guest-bootstrap test/almfrje-home-performance.test.mjs
git commit -m "feat: serve authorized home summaries"
```

### Task 4: Separate home-summary state from full-tree state

**Files:**
- Modify: `public/almfrje/app.js:200-280,434-525,1001-1122,7020-7104`
- Modify: `public/almfrje/app.css`
- Modify: `test/almfrje-home-performance.test.mjs`

- [ ] **Step 1: Add failing client flow assertions**

```js
test('cold start renders summary before one background tree load', async () => {
  const app = await readFile(new URL('../public/almfrje/app.js', import.meta.url), 'utf8');
  assert.match(app, /let homeSummary = null/);
  assert.match(app, /let treeReady = false/);
  assert.match(app, /let treeLoadPromise = null/);
  assert.match(app, /function ensureTreeLoaded/);
  assert.match(app, /جارٍ تجهيز البحث/);
  assert.doesNotMatch(app, /try \{ await loadAll\(\); \}[\s\S]{0,250}render\(\)/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/almfrje-home-performance.test.mjs`

Expected: FAIL because the client has only `C.persons` and waits for `loadAll()` on cold start.

- [ ] **Step 3: Add the state and single-flight loader**

```js
let homeSummary = null;
let treeReady = false;
let treeLoadPromise = null;

function resetHomeData() {
  homeSummary = null; treeReady = false; treeLoadPromise = null;
}

function ensureTreeLoaded(force = false) {
  if (treeReady && !force) return Promise.resolve();
  if (treeLoadPromise) return treeLoadPromise;
  const generation = identityGeneration;
  treeLoadPromise = loadTreeData().then(async () => {
    if (generation !== identityGeneration) return;
    treeReady = true;
    if (!isGuestUser() && _authUid) await saveCache(_authUid);
    const active = document.activeElement;
    const typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName || '');
    const editing = /#\/(person-edit|bulk|texts|aboutedit|settings|profile)/.test(location.hash || '');
    if (!typing && !editing) render();
  }).finally(() => { if (generation === identityGeneration) treeLoadPromise = null; });
  return treeLoadPromise;
}
```

Rename the current `loadAll()` body to `loadTreeData()` and fetch persons/branches only. Load member rosters through their existing protected route only when an admin/staff screen requires them.

- [ ] **Step 4: Render home from either model**

Add a strict browser-side shape check before assigning server data:

```js
function validHomeSummary(s) {
  return !!s && Number.isInteger(s.totalPersons) && s.totalPersons >= 0 &&
    Number.isInteger(s.liveBranchCount) && s.liveBranchCount >= 0 &&
    Number.isInteger(s.maxGeneration) && s.maxGeneration >= 0 &&
    Array.isArray(s.branchGroups) && Array.isArray(s.recentPersons);
}
```

In `screenHome`, derive `total`, live branch count, maximum generation, branch groups, recent rows, and recent count from `treeReady ? C : homeSummary`. When `treeReady` is false, render the same cards from `homeSummary`, disable `#q`, set its placeholder to `جارٍ تجهيز البحث…`, and make recent rows call `ensureTreeLoaded()` before opening the person. Other routes that require the tree use this wrapper:

```js
async function withTreeReady(screen, arg) {
  const generation = identityGeneration;
  view().innerHTML = '<div class="screen-spin"><span class="ss-sp"></span><span>… جارٍ تجهيز الشجرة</span></div>';
  await ensureTreeLoaded();
  if (generation === identityGeneration) screen(arg);
}
```

- [ ] **Step 5: Start background loading after first render**

For registered users without a valid identity-bound cache, use:

```js
const generation = identityGeneration;
const response = await fetch('/api/almfrje-home-summary', { headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store' });
const body = await response.json().catch(() => ({}));
if (generation !== identityGeneration) return;
if (!response.ok || !validHomeSummary(body.summary)) throw new Error('تعذّر تحميل ملخص الرئيسية');
homeSummary = body.summary;
meResolved = true;
showLoading(false);
render();
ensureTreeLoaded().catch(() => toast('تعذّر تجهيز البحث والشجرة'));
```

For guests use the summary already returned by `guest-bootstrap` and load `/api/almfrje-guest-tree` through `loadTreeData()`. With a valid registered cache, set `treeReady=true`, render immediately, then call `ensureTreeLoaded(true)` for a generation-safe refresh.

- [ ] **Step 6: Style the disabled search without layout movement**

```css
.search input:disabled { cursor: progress; opacity: .72; background: color-mix(in srgb, var(--card) 88%, var(--brand) 12%); }
```

- [ ] **Step 7: Run focused and full tests**

Run: `node --test test/almfrje-home-performance.test.mjs; npm.cmd test; npm.cmd run check:boundaries`

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```powershell
git add public/almfrje/app.js public/almfrje/app.css test/almfrje-home-performance.test.mjs
git commit -m "perf: render home before full tree load"
```

### Task 5: Prevent stale identity responses and sensitive caches

**Files:**
- Modify: `public/almfrje/app.js:884-908,7020-7205`
- Modify: `test/almfrje-home-performance.test.mjs`

- [ ] **Step 1: Add failing cache isolation assertions**

```js
test('cache and responses are bound to the current user generation', async () => {
  const app = await readFile(new URL('../public/almfrje/app.js', import.meta.url), 'utf8');
  assert.match(app, /identityGeneration/);
  assert.match(app, /cacheOwner/);
  assert.match(app, /crypto\.subtle\.digest/);
  assert.match(app, /generation !== identityGeneration/);
  assert.doesNotMatch(app, /scope:\s*_cacheScope\(\),\s*persons/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/almfrje-home-performance.test.mjs`

Expected: FAIL until the legacy role-only cache is replaced.

- [ ] **Step 3: Bind cache to a one-way user digest**

Before cache access, compute `cacheOwner = base64url(SHA-256(session.user.id))`; persist `{ version: 2, owner: cacheOwner, scope, t, persons, branches }`. Reject a missing/mismatched owner/version, reject age over seven days, and keep the existing strict field projection without `phone`, `email`, `notes`, `field_audit`, actor names, or signed media URLs. Guests never read or write this cache.

- [ ] **Step 4: Invalidate asynchronous work on identity changes**

Extend the existing `beginIdentityChange()` to call `resetHomeData()`. Call `beginIdentityChange()` before assigning a new `_authUid`, on registered logout, on guest logout, on `401/403`, and before rendering a pending account. Each summary/tree/media response captures `identityGeneration` before the request and discards the result when it differs.

- [ ] **Step 5: Run tests and build**

Run: `node --test test/almfrje-home-performance.test.mjs; npm.cmd test; npx.cmd tsc --noEmit; npm.cmd run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add public/almfrje/app.js test/almfrje-home-performance.test.mjs
git commit -m "fix: isolate home data by identity"
```

### Task 6: Add repeatable cold-path measurement

**Files:**
- Create: `scripts/measure-almfrje-home.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add Playwright and the command**

Run: `npm.cmd install --save-dev playwright`

Add:

```json
"measure:almfrje-home": "node scripts/measure-almfrje-home.mjs"
```

- [ ] **Step 2: Implement five identical guest-cookie rounds**

```js
import { chromium } from 'playwright';

const baseURL = process.env.ALMFRJE_PERF_BASE_URL;
const guestName = process.env.ALMFRJE_PERF_GUEST_NAME;
if (!baseURL || !guestName) throw new Error('ALMFRJE_PERF_BASE_URL and ALMFRJE_PERF_GUEST_NAME are required');
const browser = await chromium.launch({ channel: process.env.ALMFRJE_PERF_BROWSER_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
await page.getByTestId('guest-name').fill(guestName);
await page.getByTestId('guest-submit').click();
await page.getByText('إجمالي الأفراد', { exact: true }).waitFor();

const values = [];
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => { localStorage.removeItem('almfrje_pcache_v2'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('home-total').waitFor();
  values.push(Math.round(await page.evaluate(() => performance.now())));
}
await browser.close();
values.sort((a, b) => a - b);
console.log(JSON.stringify({ roundsMs: values, medianMs: values[2] }));
```

The security plan already adds stable `guest-name`, `guest-submit`, and `home-total` test ids, so the identical script works against the security-only baseline and the performance candidate.

- [ ] **Step 3: Document the comparison rule**

In `DEPLOY.md`, record baseline and candidate JSON from the same machine/network/browser channel. Compute `improvement = (baselineMedian - candidateMedian) / baselineMedian`; require at least `0.30`, and separately confirm cached reload does not regress by more than 10%.

- [ ] **Step 4: Run local verification**

Run: `npm.cmd test; npm.cmd run check:boundaries; npx.cmd tsc --noEmit; npm.cmd run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/measure-almfrje-home.mjs package.json package-lock.json DEPLOY.md
git commit -m "test: measure almfrje home first paint"
```

### Task 7: Back up, deploy performance, and verify the public result

**Files:**
- No source changes expected.

- [ ] **Step 1: Confirm the security gate still passes**

Run: `npm.cmd run verify:almfrje-access`

Expected: every probe prints `PASS`; any failure stops this plan.

- [ ] **Step 2: Record a fresh rollback point and backup**

Run the authenticated private backup endpoint, verify `ok=true` and counts without logging content, then tag the currently live security release as `backup/pre-almfrje-home-perf-YYYYMMDD-HHMM`.

Expected: the backup object exists and the tag resolves to the live commit.

- [ ] **Step 3: Capture the five-round baseline before deployment**

Run: `npm.cmd run measure:almfrje-home`

Expected: JSON containing exactly five timings and a median; save it as release evidence without the guest name.

- [ ] **Step 4: Deploy and apply schema version `2026-09-04-2`**

Deploy the tested commit through the configured Cloudflare/OpenNext path, call authenticated `POST /api/almfrje-setup`, and verify the public asset fingerprint changed to the new commit.

Expected: deployment and schema setup return success.

- [ ] **Step 5: Capture candidate timings and calculate acceptance**

Run the same `npm.cmd run measure:almfrje-home` command from the same machine/network, calculate the median improvement, and require at least 30%.

Expected: candidate median meets the threshold; otherwise roll back or continue diagnosis without declaring success.

- [ ] **Step 6: Verify live behavior and permissions again**

Check guest and registered cold starts, cached registered start, disabled-to-active search transition, branches, recent persons, tree navigation, editing screens without input loss, media, presence, replies, and logout. Then rerun `npm.cmd run verify:almfrje-access`.

Expected: UI behavior is intact, one tree request sequence occurs per identity, and every authorization probe still prints `PASS`.
