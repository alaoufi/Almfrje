# Almfrje Authorization and Guest Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إغلاق تجاوز بوابة الزائر وفرض صلاحيات الأدوار والفروع والوسائط من الخادم وقاعدة البيانات قبل نشر أي تحسين للأداء.

**Architecture:** تبقى جلسات Supabase للمستخدمين المسجلين، لكن يشتق الخادم الدور والفروع من صف عضوية مفعّل في كل مسار يستخدم `service_role`. يحصل الزائر بعد مطابقة الاسم على ملفي ارتباط موقّعين `HttpOnly` منفصلين للعرض والتسجيل، ويقرأ الشجرة المنقاة عبر API فقط؛ وتصبح بيانات الأشخاص الكاملة والإعدادات الداخلية والوسائط الخاصة محمية بسياسات قاعدة البيانات ومسارات توقيع محددة.

**Tech Stack:** Next.js 16 Route Handlers، TypeScript، Supabase Auth/PostgREST/Storage، PostgreSQL RLS، Web Crypto HMAC-SHA256، Node `node:test`.

---

## File structure

- `lib/almfrje-access.ts` — أنواع الأدوار وحساب نطاق الفروع وقرارات الوصول النقية القابلة للاختبار.
- `lib/almfrje-server-auth.ts` — التحقق المركزي من Bearer token والعضوية المفعلة وإنشاء عميل الخدمة.
- `lib/almfrje-guest-token.ts` — توقيع والتحقق من رموز الزائر ذات الغرض المحدد.
- `lib/almfrje-public-settings.ts` — قائمة السماح الوحيدة للإعدادات العامة.
- `app/api/almfrje-public-settings/route.ts` — إعدادات شاشة الدخول العامة بلا كشف جدول الإعدادات.
- `app/api/almfrje-guest-verify/route.ts` — مطابقة الاسم، حد المحاولات، وضبط ملفات الارتباط الآمنة.
- `app/api/almfrje-guest-session/route.ts` — إنهاء جلسة الزائر ومسح ملفات ارتباطها.
- `app/api/almfrje-guest-bootstrap/route.ts` — هوية الزائر والإعدادات العامة بعد التحقق.
- `app/api/almfrje-guest-tree/route.ts` — قائمة سماح ثابتة لحقول الشجرة والفروع.
- `app/api/almfrje-media/route.ts` — التحقق من المورد ثم إصدار رابط وسائط قصير العمر.
- `app/api/almfrje-{admin,backup,create-user,delete-person,feedback,presence,setup,signup,upload}/route.ts` — استعمال حارس العضوية المركزي والتحقق من المورد الهدف.
- `lib/almfrje-schema.ts` — RLS المقيد بالفروع، حصر الإعدادات، تعطيل دوال الترقية الذاتية/الضيف، وحد محاولات الزائر.
- `app/api/almfrje-setup/route.ts` — تحويل حاوية `almfrje` إلى خاصة وإلغاء سياسات التخزين المباشرة.
- `public/almfrje/app.js` — إزالة الحساب المشترك وربط الواجهة بمسارات الزائر والوسائط الآمنة ومنع التخزين المتقاطع.
- `test/almfrje-access.test.mjs` — مصفوفة الدور والفرع.
- `test/almfrje-guest-token.test.mjs` — الغرض والتوقيع والانتهاء والتلاعب.
- `test/almfrje-security-contract.test.mjs` — عقود المخطط والمسارات والملف العام.
- `scripts/verify-almfrje-access.mjs` — فحوص تكامل حقيقية لا تطبع أجسام البيانات.
- `DEPLOY.md` — الأسرار المطلوبة وترتيب النسخ الاحتياطي والنشر والرجوع.

### Task 1: Encode the role and branch authorization matrix

**Files:**
- Create: `lib/almfrje-access.ts`
- Create: `test/almfrje-access.test.mjs`

- [ ] **Step 1: Write the failing matrix tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { memberScope, canManageBranch, canReadFullPerson } from '../lib/almfrje-access.ts';

const member = (role, branch_id = null, branch_ids = [], perms = {}) =>
  ({ user_id: 'u1', role, branch_id, branch_ids, perms, is_active: true, person_id: 91 });

test('viewer never receives a managed branch or full person row', () => {
  const scope = memberScope(member('viewer', 4, [4]));
  assert.equal(canManageBranch(scope, 4), false);
  assert.equal(canReadFullPerson(scope, 4), false);
});

test('branch manager is confined to assigned branches', () => {
  const scope = memberScope(member('branch_manager', 3, [3, 5], { info: true }));
  assert.equal(canReadFullPerson(scope, 3), true);
  assert.equal(canReadFullPerson(scope, 5), true);
  assert.equal(canReadFullPerson(scope, 6), false);
});

test('general manager without assignments covers all branches', () => {
  const scope = memberScope(member('general_manager'));
  assert.equal(canReadFullPerson(scope, 999), true);
});

test('inactive member and forged role fail closed', () => {
  assert.equal(memberScope({ ...member('admin'), is_active: false }), null);
  assert.equal(memberScope(member('owner')), null);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-access.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/almfrje-access.ts`.

- [ ] **Step 3: Implement the pure access model**

```ts
export const ALMFRJE_ROLES = ['admin', 'general_manager', 'branch_manager', 'viewer'] as const;
export type AlmfrjeRole = typeof ALMFRJE_ROLES[number];

export interface AlmfrjeMemberRow {
  user_id: string;
  role: string;
  branch_id?: number | null;
  branch_ids?: unknown;
  perms?: unknown;
  is_active: boolean;
  person_id?: number | null;
}

export interface AlmfrjeScope {
  userId: string;
  role: AlmfrjeRole;
  branchIds: ReadonlySet<number>;
  allBranches: boolean;
  perms: Readonly<Record<string, boolean>>;
  personId: number | null;
}

const positiveId = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function memberScope(row: AlmfrjeMemberRow): AlmfrjeScope | null {
  if (!row?.is_active || !ALMFRJE_ROLES.includes(row.role as AlmfrjeRole)) return null;
  const ids = new Set<number>();
  const single = positiveId(row.branch_id);
  if (single) ids.add(single);
  if (Array.isArray(row.branch_ids)) for (const value of row.branch_ids) {
    const id = positiveId(value);
    if (id) ids.add(id);
  }
  const perms: Record<string, boolean> = {};
  if (row.perms && typeof row.perms === 'object' && !Array.isArray(row.perms)) {
    for (const [key, value] of Object.entries(row.perms)) if (typeof value === 'boolean') perms[key] = value;
  }
  return {
    userId: row.user_id,
    role: row.role as AlmfrjeRole,
    branchIds: ids,
    allBranches: row.role === 'admin' || (row.role === 'general_manager' && ids.size === 0),
    perms,
    personId: positiveId(row.person_id),
  };
}

export const isSupervisor = (scope: AlmfrjeScope) =>
  scope.role === 'branch_manager' || scope.role === 'general_manager';

export function canManageBranch(scope: AlmfrjeScope | null, branchId: unknown): boolean {
  if (!scope) return false;
  const id = positiveId(branchId);
  return !!id && (scope.allBranches || scope.branchIds.has(id));
}

export function hasPermission(scope: AlmfrjeScope, permission: string): boolean {
  if (scope.role === 'admin') return true;
  return Object.keys(scope.perms).length === 0 || scope.perms[permission] === true;
}

export function canReadFullPerson(scope: AlmfrjeScope | null, branchId: unknown): boolean {
  return !!scope && (scope.role === 'admin' || (isSupervisor(scope) && canManageBranch(scope, branchId)));
}
```

- [ ] **Step 4: Re-run the matrix test**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-access.test.mjs`

Expected: 4 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-access.ts test/almfrje-access.test.mjs
git commit -m "test: define almfrje authorization matrix"
```

### Task 2: Centralize server-side member authentication

**Files:**
- Create: `lib/almfrje-server-auth.ts`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Write a failing source contract test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('server auth derives identity and scope from Supabase', async () => {
  const source = await readFile(new URL('../lib/almfrje-server-auth.ts', import.meta.url), 'utf8');
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /almfrje_members/);
  assert.match(source, /memberScope/);
  assert.doesNotMatch(source, /body\.(role|branch_id|user_id)/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL because `lib/almfrje-server-auth.ts` does not exist.

- [ ] **Step 3: Add the central server guard**

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { almfrjeEnv, almfrjeEnvOk } from './almfrje-env';
import { AlmfrjeRole, AlmfrjeScope, memberScope } from './almfrje-access';

export class AlmfrjeHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface MemberContext {
  admin: SupabaseClient;
  scope: AlmfrjeScope;
}

export async function requireActiveMember(
  request: NextRequest,
  allowed?: readonly AlmfrjeRole[],
): Promise<MemberContext> {
  const env = almfrjeEnv();
  if (!almfrjeEnvOk(env)) throw new AlmfrjeHttpError(500, 'إعداد الخادم ناقص');
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AlmfrjeHttpError(401, 'غير مصرّح');
  const caller = createClient(env.url!, env.anon!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new AlmfrjeHttpError(401, 'جلسة غير صالحة');
  const admin = createClient(env.url!, env.service!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row, error: memberError } = await admin.from('almfrje_members')
    .select('user_id,role,branch_id,branch_ids,perms,is_active,person_id')
    .eq('user_id', data.user.id).maybeSingle();
  if (memberError) throw new AlmfrjeHttpError(500, 'تعذّر التحقق من الصلاحية');
  const scope = row ? memberScope(row) : null;
  if (!scope) throw new AlmfrjeHttpError(403, 'الحساب غير مفعّل');
  if (allowed && !allowed.includes(scope.role)) throw new AlmfrjeHttpError(403, 'غير مصرّح');
  return { admin, scope };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd test`

Expected: the focused contract and the existing suite pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-server-auth.ts test/almfrje-security-contract.test.mjs
git commit -m "feat: centralize almfrje member authorization"
```

### Task 3: Add purpose-bound guest tokens

**Files:**
- Create: `lib/almfrje-guest-token.ts`
- Create: `test/almfrje-guest-token.test.mjs`
- Modify: `lib/almfrje-env.ts:12-35`

- [ ] **Step 1: Write failing token tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { signGuestToken, verifyGuestToken } from '../lib/almfrje-guest-token.ts';

const secret = 's'.repeat(48);
const now = 1_800_000_000_000;

test('accepts the correct purpose before expiry', async () => {
  const token = await signGuestToken({ aud: 'view', pid: 17, branch: 4, jti: 'j1' }, secret, now);
  const payload = await verifyGuestToken(token, 'view', secret, now + 1000);
  assert.equal(payload?.pid, 17);
  assert.equal(payload?.branch, 4);
});

test('rejects tampering, expiry, and cross-purpose replay', async () => {
  const token = await signGuestToken({ aud: 'register', pid: 17, branch: 4, jti: 'j2' }, secret, now);
  assert.equal(await verifyGuestToken(token + 'x', 'register', secret, now), null);
  assert.equal(await verifyGuestToken(token, 'view', secret, now), null);
  assert.equal(await verifyGuestToken(token, 'register', secret, now + 3_600_001), null);
});

test('rejects weak secrets', async () => {
  await assert.rejects(() => signGuestToken({ aud: 'view', pid: 1, branch: null, jti: 'j3' }, 'short', now), /32/);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-guest-token.test.mjs`

Expected: FAIL because the token module does not exist.

- [ ] **Step 3: Implement HMAC tokens with an injectable clock**

```ts
export type GuestAudience = 'view' | 'register';
export interface GuestTokenPayload {
  v: 1; aud: GuestAudience; pid: number; branch: number | null;
  iat: number; exp: number; jti: string;
}

const TTL_MS = 60 * 60 * 1000;
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const unb64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));

function requireSecret(secret: string): string {
  if (secret.trim().length < 32) throw new Error('ALMFRJE_GUEST_TOKEN_SECRET must contain at least 32 characters');
  return secret;
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(requireSecret(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signGuestToken(
  input: Omit<GuestTokenPayload, 'v' | 'iat' | 'exp'>,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const payload: GuestTokenPayload = { v: 1, ...input, iat: now, exp: now + TTL_MS };
  const body = b64(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64(await hmac(body, secret))}`;
}

export async function verifyGuestToken(
  token: unknown, aud: GuestAudience, secret: string, now = Date.now(),
): Promise<GuestTokenPayload | null> {
  try {
    const [body, signature, extra] = String(token || '').split('.');
    if (!body || !signature || extra) return null;
    if (!equal(unb64(signature), await hmac(body, secret))) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64(body))) as GuestTokenPayload;
    if (payload.v !== 1 || payload.aud !== aud || !Number.isInteger(payload.pid) || payload.pid <= 0) return null;
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.iat > now + 30_000 || now > payload.exp) return null;
    return payload;
  } catch { return null; }
}
```

Add the secret without a fallback to another project secret:

```ts
export interface AlmfrjeEnv {
  url?: string; anon?: string; service?: string; pat?: string;
  guestTokenSecret?: string;
  isolated: boolean;
}

const guestTokenSecret = process.env.ALMFRJE_GUEST_TOKEN_SECRET;
return { url, anon, service, pat, guestTokenSecret, isolated };
```

Keep `almfrjeEnvOk()` describing the three Supabase values; guest routes separately require `guestTokenSecret` and return `500` when it is absent.

- [ ] **Step 4: Re-run tests**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-guest-token.test.mjs`

Expected: 3 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-guest-token.ts lib/almfrje-env.ts test/almfrje-guest-token.test.mjs
git commit -m "feat: add purpose-bound guest tokens"
```

### Task 4: Harden database policies and guest rate limiting

**Files:**
- Modify: `lib/almfrje-schema.ts:6,145-185,296-326,348-391,473-491`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing schema assertions**

```js
test('schema scopes full rows and removes client bootstrap privileges', async () => {
  const sql = await readFile(new URL('../lib/almfrje-schema.ts', import.meta.url), 'utf8');
  assert.match(sql, /almfrje_is_admin\(\) OR \(public\.almfrje_is_supervisor\(\) AND public\.almfrje_manages_branch\(branch_id\)\)/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.almfrje_claim_admin\(\) FROM[^;]*authenticated/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.almfrje_ensure_guest\(\) FROM[^;]*authenticated/i);
  assert.match(sql, /almfrje_consume_guest_attempt/);
  assert.doesNotMatch(sql, /persons_pub[\s\S]{0,500}field_audit/i);
  assert.doesNotMatch(sql, /persons_pub[\s\S]{0,500}created_by_name/i);
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL on the unscoped `persons_sel`, client grants, and unsafe view columns.

- [ ] **Step 3: Apply the minimal SQL hardening**

Bump `ALMFRJE_SCHEMA_VERSION` to `2026-09-04-1`, then replace the final policies/view and add the service-only limiter:

```sql
CREATE TABLE IF NOT EXISTS public.almfrje_guest_attempts (
  attempt_key text primary key,
  window_started timestamptz not null default now(),
  attempts int not null default 0,
  blocked_until timestamptz
);
ALTER TABLE public.almfrje_guest_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.almfrje_guest_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.almfrje_consume_guest_attempt(k text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE r public.almfrje_guest_attempts; now_at timestamptz := now();
BEGIN
  INSERT INTO public.almfrje_guest_attempts(attempt_key, window_started, attempts)
  VALUES (k, now_at, 0) ON CONFLICT (attempt_key) DO NOTHING;
  SELECT * INTO r FROM public.almfrje_guest_attempts WHERE attempt_key = k FOR UPDATE;
  IF r.blocked_until IS NOT NULL AND r.blocked_until > now_at THEN RETURN false; END IF;
  IF r.window_started < now_at - interval '10 minutes' THEN
    UPDATE public.almfrje_guest_attempts SET window_started=now_at, attempts=1, blocked_until=NULL WHERE attempt_key=k;
    RETURN true;
  END IF;
  IF r.attempts >= 8 THEN
    UPDATE public.almfrje_guest_attempts SET blocked_until=now_at + interval '30 minutes' WHERE attempt_key=k;
    RETURN false;
  END IF;
  UPDATE public.almfrje_guest_attempts SET attempts=attempts+1, blocked_until=NULL WHERE attempt_key=k;
  DELETE FROM public.almfrje_guest_attempts WHERE window_started < now_at - interval '2 days';
  RETURN true;
END $func$;
REVOKE ALL ON FUNCTION public.almfrje_consume_guest_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.almfrje_consume_guest_attempt(text) TO service_role;

DROP POLICY IF EXISTS persons_sel ON public.almfrje_persons;
CREATE POLICY persons_sel ON public.almfrje_persons FOR SELECT USING (
  public.almfrje_is_admin() OR
  (public.almfrje_is_supervisor() AND public.almfrje_manages_branch(branch_id))
);

DROP VIEW IF EXISTS public.almfrje_persons_pub;
CREATE VIEW public.almfrje_persons_pub WITH (security_barrier=true) AS
SELECT id,name,father_id,branch_id,generation,sex,status,birth,death,city,nickname,work,sort,created_at
FROM public.almfrje_persons WHERE public.almfrje_is_member();
REVOKE ALL ON public.almfrje_persons_pub FROM PUBLIC, anon;
GRANT SELECT ON public.almfrje_persons_pub TO authenticated;

DROP POLICY IF EXISTS settings_sel ON public.almfrje_settings;
CREATE POLICY settings_sel ON public.almfrje_settings FOR SELECT USING (
  public.almfrje_is_admin() OR key = ANY (ARRAY[
    'guest_open','guest_verify_gens','guest_hide','status_labels','recent_since','recent_show',
    'banner_text','banner_size','doc_title','doc_caption','tribe_docs','share_title','share_text',
    'feedback_thanks','guest_welcome_ok','guest_welcome_fail','site_title','site_powered','home_hero',
    'feedback_card_text','feedback_card_title','guest_prompt','about_html','occasion_text','occasion_color',
    'congrats','hints_overrides'
  ])
);

REVOKE ALL ON FUNCTION public.almfrje_claim_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.almfrje_ensure_guest() FROM authenticated;
```

- [ ] **Step 4: Run schema contract and boundary checks**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd run check:boundaries`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/almfrje-schema.ts test/almfrje-security-contract.test.mjs
git commit -m "fix: enforce database authorization boundaries"
```

### Task 5: Replace the shared guest account with secure guest routes

**Files:**
- Create: `lib/almfrje-public-settings.ts`
- Create: `app/api/almfrje-public-settings/route.ts`
- Create: `app/api/almfrje-guest-session/route.ts`
- Create: `app/api/almfrje-guest-bootstrap/route.ts`
- Create: `app/api/almfrje-guest-tree/route.ts`
- Modify: `app/api/almfrje-guest-verify/route.ts:1-156`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing route contracts**

```js
test('guest routes use HttpOnly purpose-bound cookies and safe columns', async () => {
  const verify = await readFile(new URL('../app/api/almfrje-guest-verify/route.ts', import.meta.url), 'utf8');
  const tree = await readFile(new URL('../app/api/almfrje-guest-tree/route.ts', import.meta.url), 'utf8');
  assert.match(verify, /almfrje_consume_guest_attempt/);
  assert.match(verify, /httpOnly:\s*true/);
  assert.match(verify, /sameSite:\s*'strict'/);
  assert.doesNotMatch(verify, /regToken[,}]/);
  assert.match(tree, /id,name,father_id,branch_id,generation,sex,status,birth,death,city,nickname,work,sort,created_at/);
  assert.doesNotMatch(tree, /phone|email|notes|field_audit|created_by_name|photo_url/);
});
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL because guest cookies and guest data routes do not exist.

- [ ] **Step 3: Add the shared public settings allowlist**

```ts
export const ALMFRJE_PUBLIC_SETTING_KEYS = [
  'guest_open','guest_prompt','guest_welcome_ok','guest_welcome_fail','site_title','site_powered',
  'home_hero','feedback_card_text','feedback_card_title','banner_text','banner_size','doc_title',
  'doc_caption','tribe_docs','share_title','share_text','feedback_thanks','about_html','occasion_text',
  'occasion_color','congrats','status_labels','recent_since','recent_show','guest_hide','hints_overrides',
] as const;
```

`almfrje-public-settings` creates a service client and selects only this list:

```ts
export async function GET() {
  const { url, service } = almfrjeEnv();
  if (!url || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from('almfrje_settings').select('key,value').in('key', [...ALMFRJE_PUBLIC_SETTING_KEYS]);
  if (error) return NextResponse.json({ ok: false, error: 'تعذّر تحميل الإعدادات' }, { status: 500 });
  const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  return NextResponse.json({ ok: true, settings }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}
```

The allowlist contains no `presence`, `visit_stats`, or `reply_bank`.

- [ ] **Step 4: Set two non-readable cookies after a rate-limited match**

In `almfrje-guest-verify`, derive a non-reversible attempt key from the first trusted `cf-connecting-ip`/`x-forwarded-for` value using HMAC with `ALMFRJE_GUEST_TOKEN_SECRET`, call `almfrje_consume_guest_attempt`, and on the unique live match create tokens with separate audiences:

```ts
const viewToken = await signGuestToken({ aud: 'view', pid: Number(match.id), branch: match.branch_id, jti: crypto.randomUUID() }, guestTokenSecret);
const registerToken = await signGuestToken({ aud: 'register', pid: Number(match.id), branch: match.branch_id, jti: crypto.randomUUID() }, guestTokenSecret);
const response = NextResponse.json({ ok: true, name: fullName, pid: match.id, branch: match.branch_id, has_phone: hasPhone, has_account: hasAccount });
const baseCookie = { httpOnly: true, secure: true, sameSite: 'strict' as const, maxAge: 3600, path: '/api/almfrje-' };
response.cookies.set('almfrje_guest_view', viewToken, baseCookie);
response.cookies.set('almfrje_guest_register', registerToken, baseCookie);
return response;
```

All failed matches return status `403` and the same text `تعذّر التحقق من الاسم. راجع ترتيب الاسم أو تواصل مع الإدارة.`; status `429` returns `محاولات كثيرة. حاول لاحقًا.`. Do not return either token and do not log the input.

- [ ] **Step 5: Add bootstrap, tree, and logout handlers**

Each protected guest handler starts with this fail-closed check before its data query:

```ts
const env = almfrjeEnv();
const proof = env.guestTokenSecret
  ? await verifyGuestToken(request.cookies.get('almfrje_guest_view')?.value, 'view', env.guestTokenSecret)
  : null;
if (!proof) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });
const admin = createClient(env.url!, env.service!, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ data: open }, { data: person }] = await Promise.all([
  admin.from('almfrje_settings').select('value').eq('key', 'guest_open').maybeSingle(),
  admin.from('almfrje_persons').select('id,status').eq('id', proof.pid).maybeSingle(),
]);
if (open?.value !== true || !person || person.status === 'dead') return denyGuestAndExpireCookies();
```

`guest-bootstrap` derives the display lineage from `proof.pid` and returns `{ ok, guest: { pid, branch, name }, settings }`. `guest-tree` pages `almfrje_persons` with the exact column string asserted above and returns branch fields `id,name,root_id,created_at`; it never selects `*`. `DELETE /api/almfrje-guest-session` expires both cookies with the same `path` and returns `{ ok: true }`. Protected responses set:

```ts
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
```

- [ ] **Step 6: Re-run focused tests**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd run check:boundaries`

Expected: route contracts and boundary checks pass.

- [ ] **Step 7: Commit**

```powershell
git add lib/almfrje-public-settings.ts app/api/almfrje-public-settings app/api/almfrje-guest-verify app/api/almfrje-guest-session app/api/almfrje-guest-bootstrap app/api/almfrje-guest-tree test/almfrje-security-contract.test.mjs
git commit -m "feat: replace shared guest login with secure gateway"
```

### Task 6: Move signup and guest replies to the registration cookie

**Files:**
- Modify: `app/api/almfrje-signup/route.ts:1-175`
- Modify: `app/api/almfrje-feedback/route.ts:25-77`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing anti-replay assertions**

```js
test('guest registration actions ignore client pid and regToken authority', async () => {
  for (const file of ['almfrje-signup', 'almfrje-feedback']) {
    const source = await readFile(new URL(`../app/api/${file}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /almfrje_guest_register/);
    assert.match(source, /verifyGuestToken/);
    assert.doesNotMatch(source, /verifyRegToken\(b\.regToken/);
  }
});
```

- [ ] **Step 2: Verify the assertions fail**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL because both routes still trust the body token and `pid`.

- [ ] **Step 3: Derive the guest person from the cookie**

Use this pattern before any guest service-role read:

```ts
const env = almfrjeEnv();
const raw = request.cookies.get('almfrje_guest_register')?.value;
const proof = env.guestTokenSecret
  ? await verifyGuestToken(raw, 'register', env.guestTokenSecret)
  : null;
if (!proof) return NextResponse.json({ ok: false, error: 'انتهت صلاحية التحقق' }, { status: 401 });
const pid = proof.pid;
```

Remove `pid` and `regToken` from guest authority. `signup` may still accept account fields, but it reads the person by `proof.pid`. `feedback` guest `myreplies` and `replyseen` compare the requested normalized name with the lineage derived from `proof.pid`; registered members continue through `requireActiveMember`.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: all guest proof contracts pass.

- [ ] **Step 5: Commit**

```powershell
git add app/api/almfrje-signup/route.ts app/api/almfrje-feedback/route.ts test/almfrje-security-contract.test.mjs
git commit -m "fix: bind signup and replies to guest proof"
```

### Task 7: Enforce resource authorization on every service-role route

**Files:**
- Modify: `app/api/almfrje-admin/route.ts`
- Modify: `app/api/almfrje-backup/route.ts`
- Modify: `app/api/almfrje-create-user/route.ts`
- Modify: `app/api/almfrje-delete-person/route.ts`
- Modify: `app/api/almfrje-feedback/route.ts`
- Modify: `app/api/almfrje-presence/route.ts`
- Modify: `app/api/almfrje-setup/route.ts`
- Modify: `app/api/almfrje-signup/route.ts`
- Modify: `app/api/almfrje-upload/route.ts`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add a failing route inventory test**

```js
test('service-role member routes use the central guard', async () => {
  const names = ['almfrje-admin','almfrje-backup','almfrje-create-user','almfrje-delete-person','almfrje-feedback','almfrje-presence','almfrje-setup','almfrje-signup','almfrje-upload'];
  for (const name of names) {
    const source = await readFile(new URL(`../app/api/${name}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /requireActiveMember/, `${name} must use the central member guard`);
  }
});
```

- [ ] **Step 2: Run the inventory and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL listing routes with duplicated or incomplete authorization.

- [ ] **Step 3: Replace duplicated member authentication with explicit role guards**

Use these exact role sets:

```ts
const ADMIN_ONLY = ['admin'] as const;
const STAFF = ['admin', 'general_manager', 'branch_manager'] as const;
const ACTIVE = ['admin', 'general_manager', 'branch_manager', 'viewer'] as const;
```

`almfrje-admin`, `almfrje-backup` interactive actions, `almfrje-create-user`, `almfrje-delete-person`, and `almfrje-setup` call `requireActiveMember(request, ADMIN_ONLY)`. `presence` and registered `signup` account/profile actions call `ACTIVE`. `feedback` staff actions call `STAFF`. Catch `AlmfrjeHttpError` and return only its controlled status/message.

- [ ] **Step 4: Check the target resource after authenticating**

Before staff operations on a person, feedback item, document, or upload, read only its `branch_id`/`person_id`, then require:

```ts
if (scope.role !== 'admin' && !canManageBranch(scope, resource.branch_id)) {
  throw new AlmfrjeHttpError(403, 'غير مصرّح لهذا الفرع');
}
```

Keep backup/setup/user-role/delete-person admin-only. In `presence`, derive `branch` and `name` from the authenticated membership/person row and ignore body `branch` and `name`. For `general_manager`, `canManageBranch` preserves the current rule: no assigned branches means all branches.

- [ ] **Step 5: Run contracts, TypeScript, and existing tests**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd test; npx.cmd tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add app/api/almfrje-admin app/api/almfrje-backup app/api/almfrje-create-user app/api/almfrje-delete-person app/api/almfrje-feedback app/api/almfrje-presence app/api/almfrje-setup app/api/almfrje-signup app/api/almfrje-upload test/almfrje-security-contract.test.mjs
git commit -m "fix: enforce service route authorization"
```

### Task 8: Make person media private and authorize every signed URL

**Files:**
- Create: `app/api/almfrje-media/route.ts`
- Modify: `app/api/almfrje-upload/route.ts`
- Modify: `app/api/almfrje-setup/route.ts:30-50`
- Modify: `public/almfrje/app.js:870-918,2235-2305,3185-3210,4965-5010`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing private-media contracts**

```js
test('media storage is private and signed only after resource authorization', async () => {
  const setup = await readFile(new URL('../app/api/almfrje-setup/route.ts', import.meta.url), 'utf8');
  const media = await readFile(new URL('../app/api/almfrje-media/route.ts', import.meta.url), 'utf8');
  const upload = await readFile(new URL('../app/api/almfrje-upload/route.ts', import.meta.url), 'utf8');
  assert.match(setup, /values \('almfrje', 'almfrje', false\)/i);
  assert.doesNotMatch(setup, /create policy "almfrje_read"[\s\S]*bucket_id = 'almfrje'/i);
  assert.match(media, /createSignedUrl/);
  assert.match(media, /canManageBranch|personId/);
  assert.doesNotMatch(upload, /getPublicUrl|public:\s*true/);
});
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL because the bucket and upload response are public.

- [ ] **Step 3: Store paths and validate upload targets**

Require `kind` (`person-photo` or `document`) and `personId` in the upload form. Load the target person's `id,branch_id` and enforce:

```ts
const ownPhoto = kind === 'person-photo' && scope.role === 'viewer' && scope.personId === personId;
const staffUpload = scope.role === 'admin' || (isSupervisor(scope) && canManageBranch(scope, person.branch_id) && hasPermission(scope, kind === 'document' ? 'docs' : 'info'));
if (!ownPhoto && !staffUpload) throw new AlmfrjeHttpError(403, 'غير مصرّح لهذا الشخص');
const prefix = kind === 'person-photo' ? 'photos' : 'docs';
const path = `${prefix}/${personId}/${crypto.randomUUID()}.${ext}`;
const { error } = await admin.storage.from('almfrje').upload(path, bytes, { contentType: mime, upsert: false });
if (error) throw new AlmfrjeHttpError(400, 'تعذّر رفع الملف');
return NextResponse.json({ ok: true, path });
```

- [ ] **Step 4: Add the signed-media route**

`GET /api/almfrje-media?kind=person-photo&id=<personId>` loads `photo_url` server-side; `kind=document` loads `url,person_id,is_public` from the document id. Parse only `almfrje` paths:

```ts
function storagePath(value: string): string | null {
  const marker = '/storage/v1/object/public/almfrje/';
  const raw = value.includes(marker) ? value.slice(value.indexOf(marker) + marker.length) : value;
  const path = decodeURIComponent(raw).replace(/^\/+/, '');
  return path && !path.includes('..') && /^(photos|docs)\//.test(path) ? path : null;
}
```

Authenticate a registered request through Bearer and `requireActiveMember`; authenticate a guest through the `view` cookie. Guests may receive only `is_public=true` documents and media allowed by `guest_hide.media`; staff full access remains branch-scoped. Return `{ ok: true, url }` from `createSignedUrl(path, 120)` with `private, no-store`.

- [ ] **Step 5: Hydrate media without putting access tokens in URLs**

Render placeholders with `data-media-kind` and `data-media-id`, then hydrate without query-string tokens:

```js
async function hydratePrivateMedia(root = document) {
  const generation = identityGeneration;
  const { data: { session } } = await sb.auth.getSession();
  const headers = session && !isGuestUser() ? { Authorization: 'Bearer ' + session.access_token } : {};
  await Promise.all([...root.querySelectorAll('[data-media-kind][data-media-id]')].map(async (el) => {
    const qs = new URLSearchParams({ kind: el.dataset.mediaKind, id: el.dataset.mediaId });
    const response = await fetch('/api/almfrje-media?' + qs, { headers, credentials: 'same-origin' });
    const body = await response.json().catch(() => ({}));
    if (generation === identityGeneration && response.ok && body.url) {
      if (el.tagName === 'IMG') el.src = body.url; else el.href = body.url;
    }
  }));
}
```

Update every `uploadFile` call to pass `kind` and `personId`, and store the returned `path`.

- [ ] **Step 6: Flip the bucket only after the route works in the build**

Change `STORAGE_SQL` to:

```sql
insert into storage.buckets (id, name, public)
values ('almfrje', 'almfrje', false)
on conflict (id) do update set public = false;
drop policy if exists "almfrje_read" on storage.objects;
drop policy if exists "almfrje_insert" on storage.objects;
drop policy if exists "almfrje_update" on storage.objects;
drop policy if exists "almfrje_delete" on storage.objects;
```

- [ ] **Step 7: Run tests and build**

Run: `node --test test/almfrje-security-contract.test.mjs; npm.cmd test; npm.cmd run check:boundaries; npm.cmd run build`

Expected: all tests, boundary checks, and Next build exit 0.

- [ ] **Step 8: Commit**

```powershell
git add app/api/almfrje-media app/api/almfrje-upload app/api/almfrje-setup public/almfrje/app.js test/almfrje-security-contract.test.mjs
git commit -m "fix: protect almfrje person media"
```

### Task 9: Remove shared guest credentials and fail-open client fallbacks

**Files:**
- Modify: `public/almfrje/app.js:340-348,453-477,548-605,884-908,3630-3785,6650-6840,7020-7205`
- Modify: `test/almfrje-security-contract.test.mjs`

- [ ] **Step 1: Add failing public-bundle assertions**

```js
test('public app contains no shared login or privilege expansion fallback', async () => {
  const app = await readFile(new URL('../public/almfrje/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /guest@almfrje\.app|guest@Almfrje1|almfrje_ensure_guest|almfrje_claim_admin/);
  assert.doesNotMatch(app, /catch\s*\([^)]*\)\s*\{\s*return fetchPersonsCols\('almfrje_persons'/);
  assert.match(app, /\/api\/almfrje-guest-bootstrap/);
  assert.match(app, /\/api\/almfrje-guest-tree/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/almfrje-security-contract.test.mjs`

Expected: FAIL on the hard-coded credentials, RPCs, and full-table fallback.

- [ ] **Step 3: Replace the guest state machine**

After successful name verification, keep only non-authoritative display values (`name`, `pid`, `branch`, onboarding flags) in memory/session storage, then enter through:

```js
async function enterVerifiedGuest() {
  const bootstrap = await fetch('/api/almfrje-guest-bootstrap', { credentials: 'same-origin', cache: 'no-store' });
  if (!bootstrap.ok) throw new Error('انتهت جلسة الزائر');
  const state = await bootstrap.json();
  me = { user_id: 'guest', full_name: state.guest.name || '', role: 'viewer', is_active: true, perms: {}, guest: true };
  meResolved = true;
  await loadGuestTree();
  render();
}

async function loadGuestTree() {
  const response = await fetch('/api/almfrje-guest-tree', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('تعذّر تحميل الشجرة');
  const body = await response.json();
  C.persons = Array.isArray(body.persons) ? body.persons : [];
  C.branches = Array.isArray(body.branches) ? body.branches : [];
  C.members = [];
  buildIndex();
}
```

Represent the guest object solely for rendering; all data comes from protected guest APIs. On logout call `DELETE /api/almfrje-guest-session`, clear `C`, indexes, object URLs, and guest display values.

Replace the 350 ms input-triggered verification with an explicit submit button so typing cannot consume the rate limit. Give the input `data-testid="guest-name"`, the button `data-testid="guest-submit"`, and the home total number `data-testid="home-total"`; Enter submits the same handler once.

- [ ] **Step 4: Remove unsafe fallbacks and cache mixing**

Change `fetchPersons()` to fail closed:

```js
async function fetchPersons() {
  if (isAdmin() || isManager()) return fetchPersonsCols('almfrje_persons', PERSONS_FULL_COLS);
  return fetchPersonsCols('almfrje_persons_pub', PERSONS_PUB_COLS);
}
```

Replace the old username check and introduce the identity generation used by all async requests:

```js
let identityGeneration = 0;
const isGuestUser = () => !!(me && me.guest === true);
function beginIdentityChange() {
  identityGeneration++;
  clearCache();
  C.persons = []; C.branches = []; C.members = [];
  buildIndex();
}
```

Key registered cache by a SHA-256 digest of the authenticated `user.id` plus scope:

```js
async function cacheOwner(userId) {
  const bytes = new TextEncoder().encode(String(userId));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function saveCache(userId) {
  if (isGuestUser()) return;
  const owner = await cacheOwner(userId);
  const persons = C.persons.map(({ id,name,father_id,branch_id,generation,sex,status,nickname,work,sort }) =>
    ({ id,name,father_id,branch_id,generation,sex,status,nickname,work,sort }));
  localStorage.setItem('almfrje_pcache_v2', JSON.stringify({ version: 2, owner, scope: _cacheScope(), t: Date.now(), persons, branches: C.branches }));
}
```

Never write guest data to `localStorage`. `hydrateFromCache(userId)` becomes async and accepts only `version===2`, the matching owner/scope, and age under seven days. Update save call sites to `await saveCache(_authUid)` after confirming the generation. Call `beginIdentityChange()` before changing `_authUid`, and ignore an async response unless its captured identity generation equals the current generation.

- [ ] **Step 5: Stop unauthenticated schema execution and direct settings reads**

Remove the unauthenticated `/api/almfrje-setup` call in `init()` and replace the pre-auth settings read with:

```js
async function loadPublicSettings() {
  const response = await fetch('/api/almfrje-public-settings', { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذّر تحميل إعدادات الدخول');
  const body = await response.json();
  applySettingsMap(body.settings || {});
}
```

Active members may load the RLS-whitelisted settings directly, and administrators load internal settings only after their membership resolves.

- [ ] **Step 6: Run the full local gate**

Run: `npm.cmd test; npm.cmd run check:boundaries; npx.cmd tsc --noEmit; npm.cmd run build`

Expected: all commands exit 0 and the generated public assets contain no shared password.

- [ ] **Step 7: Commit**

```powershell
git add public/almfrje/app.js test/almfrje-security-contract.test.mjs
git commit -m "fix: remove client-side authorization bypasses"
```

### Task 10: Add the real authorization verification gate

**Files:**
- Create: `scripts/verify-almfrje-access.mjs`
- Modify: `package.json`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add the verification command**

Add this script entry:

```json
"verify:almfrje-access": "node scripts/verify-almfrje-access.mjs"
```

- [ ] **Step 2: Implement status/count-only probes**

The script requires `ALMFRJE_VERIFY_BASE_URL`, `ALMFRJE_SUPABASE_URL`, `ALMFRJE_SUPABASE_ANON_KEY`, `ALMFRJE_VERIFY_VIEWER_TOKEN`, `ALMFRJE_VERIFY_BRANCH_MANAGER_TOKEN`, `ALMFRJE_VERIFY_GENERAL_MANAGER_TOKEN`, `ALMFRJE_VERIFY_ADMIN_TOKEN`, `ALMFRJE_VERIFY_OWN_BRANCH_ID`, `ALMFRJE_VERIFY_OTHER_BRANCH_ID`, and test resource ids. It must never print response bodies. Use this assertion helper:

```js
async function expectStatus(label, url, init, expected) {
  const response = await fetch(url, init);
  const bytes = Number(response.headers.get('content-length') || 0);
  console.log(`${response.status === expected ? 'PASS' : 'FAIL'} ${label} status=${response.status} bytes=${bytes}`);
  if (response.status !== expected) process.exitCode = 1;
}
```

Probe: unauthenticated guest tree `401`; tampered guest cookie `401`; inactive/invalid bearer `401` or `403`; viewer full persons returns zero rows; branch manager full persons returns rows only for own branch and zero for another; general manager follows its stored scope; viewer/admin member-row access follows self/all; settings `presence`, `visit_stats`, and `reply_bank` return zero to non-admin; direct storage URL fails; signed media succeeds only for an authorized resource; `almfrje_claim_admin` and `almfrje_ensure_guest` RPC calls fail for authenticated clients.

- [ ] **Step 3: Document production prerequisites and rollback**

Add to `DEPLOY.md`: generate a 48-byte `ALMFRJE_GUEST_TOKEN_SECRET`; never reuse Supabase keys; capture the current commit/tag, `ALMFRJE_SCHEMA_VERSION`, policy/function definitions, bucket metadata, and a fresh private backup; deploy code before applying the private-bucket migration; keep the leaked guest account disabled but not deleted during the observation window; restore code/schema/bucket metadata from the recorded point if required, without re-enabling the leaked credentials.

- [ ] **Step 4: Run all local verification**

Run: `npm.cmd test; npm.cmd run check:boundaries; npx.cmd tsc --noEmit; npm.cmd run build`

Expected: tests, boundary checks, TypeScript, and build all exit 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/verify-almfrje-access.mjs package.json DEPLOY.md
git commit -m "test: add almfrje authorization deployment gate"
```

### Task 11: Back up, deploy security, and verify live without exposing data

**Files:**
- No source changes expected.

- [ ] **Step 1: Record the exact release and rollback target**

Run: `git status --short; git rev-parse HEAD; git rev-parse origin/main`

Expected: clean worktree and two recorded commit hashes.

- [ ] **Step 2: Create the requested backup and rollback tag**

Run the existing authenticated `/api/almfrje-backup?action=run`, verify its returned counts and private object path without downloading content into logs, then create an annotated tag named `backup/pre-almfrje-security-YYYYMMDD-HHMM` at the currently live commit.

Expected: backup response `ok=true`; tag resolves to the live commit.

- [ ] **Step 3: Deploy code and apply the versioned schema as admin**

Deploy the tested commit through the repository's configured Cloudflare/OpenNext release path, then call authenticated `POST /api/almfrje-setup` once as an active admin.

Expected: deployment succeeds; setup returns `ok=true` with schema version `2026-09-04-1` applied.

- [ ] **Step 4: Disable the leaked guest account before public verification**

Use Supabase Admin API with the service credential from the controlled deployment environment to ban the exact auth user whose email is `guest@almfrje.app`; verify that direct `signInWithPassword` using the published old password fails. Do not delete the user in this release.

Expected: old shared login is rejected.

- [ ] **Step 5: Run the live matrix and browser smoke checks**

Run: `npm.cmd run verify:almfrje-access`

Then verify in the browser: name gate, registered login, pending-member screen, viewer tree, branch-manager own-branch action, denied cross-branch action, general-manager scope, admin management, image/document display, signup, replies, logout, and session expiry.

Expected: every scripted line starts `PASS`; the browser flows work only within the tested role boundaries.

- [ ] **Step 6: Stop on any security failure**

If any matrix assertion fails, stop before the performance plan, restore the tagged application/schema/bucket state as documented, and keep the leaked guest account disabled. Record only status codes and failing labels, never row bodies.
