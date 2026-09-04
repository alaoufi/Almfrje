# Almfrje Member Actions, Alerts, Visits, and Desktop Layout Implementation Plan

Updated 2026-09-05 to match the approved specification in commit `0148d37`: three home statistics cards, one visits section, and one-time password/install notices. This supersedes the earlier four-card layout.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** فرض صلاحيات الإجراءات الدقيقة، وتمكين تعديل الدرجة الأولى والتراجع، وتصحيح الزيارات القادمة، وإظهار التنبيهات والتخطيط المكتبي المكثف من دون المساس بالماضي.

**Architecture:** تعتمد كل قرارات الصلاحية على وحدات خادمة نقية وهوية مستخرجة من الجلسة، ثم تفرضها API وRLS معًا. تنفذ تعديلات العضو والتراجع والزيارات كمعاملات PostgreSQL ذرية، بينما يستهلك العميل عقودًا صغيرة للعداد والسجل والرئيسية ولا يحسب صلاحيات حساسة محليًا.

**Tech Stack:** Next.js Route Handlers، TypeScript، Supabase/PostgreSQL RLS وRPC، Vanilla JavaScript/CSS، Node test runner.

---

## Prerequisite gate

لا تبدأ هذه الخطة قبل اكتمال `docs/superpowers/plans/2026-09-04-almfrje-security-hardening.md` ونجاح مصفوفة الصلاحيات فيه. نفذ خطة الأداء `docs/superpowers/plans/2026-09-04-home-first-paint-performance.md` قبل مهمة الواجهة النهائية أدناه حتى تستخدم الرئيسية عقد الملخص المحمي.

## File structure

- Create `lib/almfrje-action-policy.ts`: أنواع الصلاحيات وتصنيف الطلبات وفحص الدور والفرع.
- Create `lib/almfrje-member-scope.ts`: اشتقاق نطاق `self/father/children` وقوائم الحقول المسموحة.
- Create `lib/almfrje-visit-contract.ts`: تحقق معرّف الزيارة والأبعاد والاستجابة.
- Create `app/api/almfrje-action-summary/route.ts`: عداد موحد مصفى خادميًا.
- Create `app/api/almfrje-member-actions/route.ts`: تعديل الدرجة الأولى والإضافة والترتيب والتراجع والسجل.
- Create `app/api/almfrje-visit/route.ts`: تسجيل زيارة ذرية مستقلة عن الحضور.
- Modify `app/api/almfrje-feedback/route.ts`: استعمال السياسة المشتركة والحسم المشروط وعدم حذف الرفض.
- Modify `app/api/almfrje-presence/route.ts`: حضور فقط بلا زيادة الزيارات.
- Modify `lib/almfrje-schema.ts`: صلاحية `approve_members`، سجل تراكمي، RPC التعديل والتراجع والزيارة.
- Modify `public/almfrje/app.js`: التنبيه، شاشة السجل، أدوات العضو، زيارة الجلسة، وتغليف صف الرئيسية.
- Modify `public/almfrje/app.css`: شريط التنبيه وشاشة السجل وتخطيط الحاسب.
- Test `test/almfrje-action-policy.test.mjs`.
- Test `test/almfrje-member-scope.test.mjs`.
- Test `test/almfrje-visits.test.mjs`.
- Test `test/almfrje-home-layout.test.mjs`.

### Task 1: Encode request authorization as a pure policy

**Files:**
- Create: `lib/almfrje-action-policy.ts`
- Test: `test/almfrje-action-policy.test.mjs`

- [ ] **Step 1: Write the failing action-policy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { canActOnFeedback, canApproveMember, normalizeManagerPerms } from '../lib/almfrje-action-policy.ts';

test('manager only sees the matching action and branch', () => {
  const actor = { role: 'branch_manager', active: true, branches: [8], perms: { approve_birth: true } };
  assert.equal(canActOnFeedback(actor, { subject: 'إضافة مولود', branchId: 8 }), true);
  assert.equal(canActOnFeedback(actor, { subject: 'إضافة مولود', branchId: 9 }), false);
  assert.equal(canActOnFeedback(actor, { subject: 'ملاحظة', branchId: 8 }), false);
});

test('approve_members is explicit and never inherited by legacy empty perms', () => {
  const legacy = normalizeManagerPerms({});
  assert.equal(legacy.edit_profile, true);
  assert.equal(legacy.approve_members, false);
  assert.equal(canApproveMember({ role: 'branch_manager', active: true, branches: [8], perms: legacy }, 8), false);
});

test('unscoped items fail closed for supervisors', () => {
  const actor = { role: 'general_manager', active: true, branches: [], allBranches: true, perms: { edit_profile: true } };
  assert.equal(canActOnFeedback(actor, { subject: 'ملاحظة', branchId: null }), false);
});
```

- [ ] **Step 2: Run the policy test and confirm the red state**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-action-policy.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/almfrje-action-policy.ts`.

- [ ] **Step 3: Implement the policy contract**

```ts
export type ActionPerm = 'add_birth' | 'approve_birth' | 'reorder' | 'edit_profile' | 'approve_members';
export type ActionActor = { role: string; active: boolean; branches: number[]; allBranches?: boolean; perms: Partial<Record<ActionPerm, boolean>> };
export type FeedbackTarget = { subject: string; branchId: number | null };

const LEGACY: ActionPerm[] = ['add_birth', 'approve_birth', 'reorder', 'edit_profile'];
const SUBJECT_PERM: Record<string, ActionPerm> = {
  'إضافة مولود': 'approve_birth',
  'إعادة ترتيب الإخوان': 'reorder',
  'ملاحظة': 'edit_profile',
};

export function normalizeManagerPerms(raw: unknown): Partial<Record<ActionPerm, boolean>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid manager permissions');
  const obj = raw as Record<string, unknown>;
  if (Object.keys(obj).length === 0) return Object.fromEntries(LEGACY.map((key) => [key, true]));
  return Object.fromEntries([...LEGACY, 'approve_members'].map((key) => [key, obj[key] === true]));
}

function inScope(actor: ActionActor, branchId: number | null): boolean {
  if (actor.role === 'admin') return true;
  if (branchId == null) return false;
  return actor.allBranches === true || actor.branches.includes(branchId);
}

export function canActOnFeedback(actor: ActionActor, target: FeedbackTarget): boolean {
  if (!actor.active) return false;
  if (actor.role === 'admin') return true;
  const perm = SUBJECT_PERM[target.subject];
  return !!perm && actor.perms[perm] === true && inScope(actor, target.branchId);
}

export function canApproveMember(actor: ActionActor, branchId: number | null): boolean {
  return actor.active && (actor.role === 'admin' || (actor.perms.approve_members === true && inScope(actor, branchId)));
}
```

- [ ] **Step 4: Run the policy tests green**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-action-policy.test.mjs`

Expected: PASS, 3 tests, 0 failures.

- [ ] **Step 5: Commit the policy unit**

```bash
git add lib/almfrje-action-policy.ts test/almfrje-action-policy.test.mjs
git commit -m "feat: centralize Almfrje action permissions"
```

### Task 2: Encode the member first-degree scope

**Files:**
- Create: `lib/almfrje-member-scope.ts`
- Test: `test/almfrje-member-scope.test.mjs`

- [ ] **Step 1: Write failing scope and field tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { directRelation, sanitizeMemberPatch, validateChildOrder } from '../lib/almfrje-member-scope.ts';

const people = new Map([[10, { id: 10, father_id: 5 }], [5, { id: 5, father_id: 2 }], [20, { id: 20, father_id: 10 }], [21, { id: 21, father_id: 10 }], [30, { id: 30, father_id: 20 }]]);

test('scope contains self, father, and direct children only', () => {
  assert.equal(directRelation(people, 10, 10), 'self');
  assert.equal(directRelation(people, 10, 5), 'father');
  assert.equal(directRelation(people, 10, 20), 'child');
  assert.equal(directRelation(people, 10, 30), null);
});

test('member patch rejects ancestry and identity columns', () => {
  assert.deepEqual(sanitizeMemberPatch({ city: 'الرياض', birth: '1400', father_id: 99 }), { city: 'الرياض', birth: '1400' });
});

test('reorder must contain the exact child set once', () => {
  assert.equal(validateChildOrder([20, 21], [21, 20]), true);
  assert.equal(validateChildOrder([20, 21], [20, 30]), false);
});
```

- [ ] **Step 2: Run the test red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-member-scope.test.mjs`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement exact scope and allowlist**

```ts
type PersonRef = { id: number; father_id: number | null };
const MEMBER_FIELDS = new Set(['city', 'birth', 'phone', 'work', 'status', 'birthplace', 'nickname']);

export function directRelation(people: Map<number, PersonRef>, selfId: number, targetId: number): 'self' | 'father' | 'child' | null {
  const self = people.get(selfId);
  const target = people.get(targetId);
  if (!self || !target) return null;
  if (target.id === self.id) return 'self';
  if (self.father_id === target.id) return 'father';
  if (target.father_id === self.id) return 'child';
  return null;
}

export function sanitizeMemberPatch(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([key]) => MEMBER_FIELDS.has(key)));
}

export function validateChildOrder(current: number[], proposed: number[]): boolean {
  if (current.length !== proposed.length || new Set(proposed).size !== proposed.length) return false;
  return [...current].sort((a, b) => a - b).every((id, index) => id === [...proposed].sort((a, b) => a - b)[index]);
}
```

- [ ] **Step 4: Run the scope tests green**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-member-scope.test.mjs`

Expected: PASS, 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/almfrje-member-scope.ts test/almfrje-member-scope.test.mjs
git commit -m "feat: define first-degree member scope"
```

### Task 3: Add atomic schema primitives for audit, actions, and visits

**Files:**
- Modify: `lib/almfrje-schema.ts`
- Modify: `almfrje-app/schema.sql`
- Test: `test/almfrje-visits.test.mjs`

- [ ] **Step 1: Add failing schema-contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync(new URL('../lib/almfrje-schema.ts', import.meta.url), 'utf8');

test('visit RPC is idempotent and server-only', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.almfrje_visit_events/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION public\.almfrje_record_visit/);
  assert.match(schema, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.match(schema, /REVOKE ALL ON FUNCTION public\.almfrje_record_visit/);
});

test('audit history is append-only for clients', () => {
  assert.match(schema, /before_data jsonb/);
  assert.match(schema, /after_data jsonb/);
  assert.match(schema, /reverts_audit_id bigint/);
  assert.doesNotMatch(schema, /CREATE POLICY audit_del .*auth\.uid/);
});
```

- [ ] **Step 2: Run the schema test red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-visits.test.mjs`

Expected: FAIL on missing visit table/RPC and audit columns.

- [ ] **Step 3: Add the migration SQL to both authoritative schema sources**

Add this visit SQL exactly, then mirror it into `almfrje-app/schema.sql`:

```sql
ALTER TABLE public.almfrje_audit ADD COLUMN IF NOT EXISTS before_data jsonb;
ALTER TABLE public.almfrje_audit ADD COLUMN IF NOT EXISTS after_data jsonb;
ALTER TABLE public.almfrje_audit ADD COLUMN IF NOT EXISTS branch_id bigint;
ALTER TABLE public.almfrje_audit ADD COLUMN IF NOT EXISTS reverts_audit_id bigint references public.almfrje_audit(id);

CREATE TABLE IF NOT EXISTS public.almfrje_visit_events (
  event_id uuid primary key,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS almfrje_visit_events_created_idx
  ON public.almfrje_visit_events(created_at);

CREATE OR REPLACE FUNCTION public.almfrje_record_visit(p_event_id uuid, p_branch_id bigint, p_city text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  inserted_id uuid;
  current_value jsonb;
  branch_key text := p_branch_id::text;
  city_key text := nullif(trim(coalesce(p_city, '')), '');
BEGIN
  INSERT INTO public.almfrje_visit_events(event_id) VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING RETURNING event_id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN 'duplicate'; END IF;

  SELECT coalesce(value, '{}'::jsonb) INTO current_value
  FROM public.almfrje_settings WHERE key = 'visit_stats' FOR UPDATE;
  IF NOT FOUND THEN
    current_value := '{"total":0,"byBranch":{},"byCity":{}}'::jsonb;
  END IF;
  current_value := current_value
    || jsonb_build_object('byBranch', coalesce(current_value->'byBranch', '{}'::jsonb))
    || jsonb_build_object('byCity', coalesce(current_value->'byCity', '{}'::jsonb));
  current_value := jsonb_set(current_value, '{total}', to_jsonb(coalesce((current_value->>'total')::bigint, 0) + 1), true);
  IF branch_key IS NOT NULL THEN
    current_value := jsonb_set(current_value, ARRAY['byBranch', branch_key], to_jsonb(coalesce((current_value->'byBranch'->>branch_key)::bigint, 0) + 1), true);
  END IF;
  IF city_key IS NOT NULL THEN
    current_value := jsonb_set(current_value, ARRAY['byCity', city_key], to_jsonb(coalesce((current_value->'byCity'->>city_key)::bigint, 0) + 1), true);
  END IF;

  INSERT INTO public.almfrje_settings(key, value, updated_at)
  VALUES ('visit_stats', current_value, now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
  DELETE FROM public.almfrje_visit_events
   WHERE created_at < now() - interval '30 days';
  RETURN 'recorded';
END $func$;
REVOKE ALL ON FUNCTION public.almfrje_record_visit(uuid,bigint,text) FROM PUBLIC, anon, authenticated;
```

Add two server-only transactional RPCs with these exact signatures:

```sql
public.almfrje_apply_member_action(
  p_actor uuid, p_action text, p_target_id bigint, p_payload jsonb,
  p_expected_updated_at timestamptz
) returns jsonb
public.almfrje_revert_audit(
  p_actor uuid, p_audit_id bigint, p_expected_updated_at timestamptz
) returns jsonb
```

`almfrje_apply_member_action` must lock the active member row for `p_actor`, derive its stored `person_id`, lock the target rows, and accept only `edit`, `add_child`, or `reorder_children`. The `edit` branch verifies self/father/direct-child and the seven allowlisted fields; `add_child` forces the stored self as father and derives branch/generation; `reorder_children` compares the exact complete child-ID set before assigning sequential `sort` values. Each branch inserts `before_data`, `after_data`, `branch_id`, and actor into `almfrje_audit` in the same transaction.

`almfrje_revert_audit` locks the audit and current target rows, verifies actor ownership or action-specific administrative authority, compares `p_expected_updated_at`, restores `before_data`, and inserts a new audit row whose `reverts_audit_id` points to the original. Reverting an add moves the child to trash only when it has no children and no later audit; reverting an order requires the current order to match the original `after_data`. Revoke both functions from `PUBLIC`, `anon`, and `authenticated`; only the service-role route may call them.

- [ ] **Step 4: Replace client-delete audit policies with append-only reads**

Add an action-aware read helper, then use these policies. The helper must fail closed for unknown actions and require the matching permission as well as branch scope:

```sql
CREATE OR REPLACE FUNCTION public.almfrje_can_read_audit(p_action text, p_branch_id bigint, p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT auth.uid() = p_actor
      OR public.almfrje_is_admin()
      OR (
        public.almfrje_is_supervisor()
        AND public.almfrje_manages_branch(p_branch_id)
        AND CASE p_action
          WHEN 'edit' THEN public.almfrje_perm('edit_profile')
          WHEN 'add_child' THEN public.almfrje_perm('add_birth')
          WHEN 'approve_birth' THEN public.almfrje_perm('approve_birth')
          WHEN 'reorder_children' THEN public.almfrje_perm('reorder')
          WHEN 'activate_member' THEN public.almfrje_perm('approve_members')
          ELSE false
        END
      );
$func$;
REVOKE ALL ON FUNCTION public.almfrje_can_read_audit(text,bigint,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.almfrje_can_read_audit(text,bigint,uuid) TO authenticated;

DROP POLICY IF EXISTS audit_sel ON public.almfrje_audit;
DROP POLICY IF EXISTS audit_ins ON public.almfrje_audit;
DROP POLICY IF EXISTS audit_upd ON public.almfrje_audit;
DROP POLICY IF EXISTS audit_del ON public.almfrje_audit;
CREATE POLICY audit_sel ON public.almfrje_audit FOR SELECT USING (
  public.almfrje_can_read_audit(action, branch_id, actor)
);
REVOKE INSERT, UPDATE, DELETE ON public.almfrje_audit FROM anon, authenticated;
```

Increase `schema_rev` consistently in `lib/almfrje-schema.ts` and `almfrje-app/schema.sql`.

- [ ] **Step 5: Run schema tests green and all source tests**

Run: `npm test`

Expected: all tests pass, including the two new schema tests.

- [ ] **Step 6: Commit**

```bash
git add lib/almfrje-schema.ts almfrje-app/schema.sql test/almfrje-visits.test.mjs
git commit -m "feat: add atomic member audit and visit primitives"
```

### Task 4: Serve the unified action summary and secure decisions

**Files:**
- Create: `app/api/almfrje-action-summary/route.ts`
- Modify: `app/api/almfrje-feedback/route.ts`
- Modify: `app/api/almfrje-admin/route.ts`
- Test: `test/almfrje-action-api.test.mjs`

- [ ] **Step 1: Write failing route contract tests**

Create tests that import the policy helper and source-check the routes:

```js
test('summary has all approved categories and no client-side authority', () => {
  const source = fs.readFileSync(new URL('../app/api/almfrje-action-summary/route.ts', import.meta.url), 'utf8');
  for (const key of ['memberActivations', 'birthRequests', 'reorderRequests', 'profileNotes', 'generalNotes']) assert.match(source, new RegExp(key));
  assert.match(source, /requireAlmfrjeMember/);
});

test('reject preserves the row and concurrent decisions are conditional', () => {
  const source = fs.readFileSync(new URL('../app/api/almfrje-feedback/route.ts', import.meta.url), 'utf8');
  assert.match(source, /status:\s*'rejected'/);
  assert.match(source, /\.eq\('status',\s*'new'\)/);
  assert.doesNotMatch(source, /action === 'reject'[\s\S]{0,300}\.delete\(\)/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-action-api.test.mjs`

Expected: FAIL because the summary route does not exist and reject still deletes.

- [ ] **Step 3: Implement the summary route**

Use `requireAlmfrjeMember()` from the security plan, `normalizeManagerPerms()`, `canActOnFeedback()`, and `canApproveMember()`. Query only `id,subject,branch_id,status` from feedback and `user_id,person_id,is_active,perms` plus the linked person's branch for registrations. Return:

```ts
return NextResponse.json({
  ok: true,
  total: memberActivations + birthRequests + reorderRequests + profileNotes + generalNotes,
  memberActivations,
  birthRequests,
  reorderRequests,
  profileNotes,
  generalNotes,
  generatedAt: new Date().toISOString(),
}, { headers: { 'Cache-Control': 'private, no-store' } });
```

- [ ] **Step 4: Use the same policy for list and every decision**

In `almfrje-feedback`, fetch the row first, derive its stored branch/subject, call the shared policy, and change decisions with a conditional update:

```ts
const { data: decided, error } = await admin.from('almfrje_feedback')
  .update({ status: nextStatus, done_by_name: actor.name, done_at: now })
  .eq('id', id).eq('status', 'new').select('id').maybeSingle();
if (error) return badRequest(error.message);
if (!decided) return NextResponse.json({ ok: false, error: 'عولج الطلب مسبقًا' }, { status: 409 });
```

Restrict permanent `delete` to admin and turn supervisor `reject` into terminal status. Make member activation check `approve_members` plus linked branch and record the attestation in audit.

- [ ] **Step 5: Run focused and full tests**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-action-policy.test.mjs test/almfrje-action-api.test.mjs`

Expected: all focused tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/almfrje-action-summary/route.ts app/api/almfrje-feedback/route.ts app/api/almfrje-admin/route.ts test/almfrje-action-api.test.mjs
git commit -m "feat: secure shared Almfrje action decisions"
```

### Task 5: Implement member direct actions and reversible audit

**Files:**
- Create: `app/api/almfrje-member-actions/route.ts`
- Modify: `public/almfrje/app.js`
- Test: `test/almfrje-member-actions.test.mjs`

- [ ] **Step 1: Write failing API contract tests**

Cover `edit`, `add_child`, `reorder_children`, `list_audit`, and `revert`. Assert the route calls `requireAlmfrjeMember`, loads the member's stored `person_id`, never trusts `selfId`, and calls the server-only RPC with `auth.uid()` derived from the verified session.

```js
test('member route exposes only the approved action names', () => {
  const source = fs.readFileSync(new URL('../app/api/almfrje-member-actions/route.ts', import.meta.url), 'utf8');
  for (const action of ['edit', 'add_child', 'reorder_children', 'list_audit', 'revert']) assert.match(source, new RegExp(`'${action}'`));
  assert.doesNotMatch(source, /body\.selfId|body\.actor|body\.role/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-member-actions.test.mjs`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Implement the route actions**

For `edit`, load self and target, call `directRelation`, sanitize fields, require at least one changed field, then call the atomic RPC with target `updated_at`. For `add_child`, ignore any client father/branch/generation and pass `self.id`; derive branch and generation in the RPC. For reorder, load every row whose `father_id=self.id`, validate the exact set, and pass the ordered IDs. For `revert`, require `audit.actor === auth.uid()` for a member or action-specific admin/supervisor authority, then call the conditional revert RPC.

Return no full person rows beyond what the caller can already read:

```ts
return NextResponse.json({ ok: true, action, auditId, personId, updatedAt }, {
  headers: { 'Cache-Control': 'private, no-store' },
});
```

- [ ] **Step 4: Add member UI entry points and audit screens**

Add `#/my-family-edit` and `#/my-edits`. Reuse current person editor fields but render only the server-provided allowed targets/fields. Add `سجل التعديلات` to administration and `تعديلاتي` to the member account group. The undo button must show before/after values, ask one confirmation, and refresh only after a successful API response.

- [ ] **Step 5: Run syntax and tests**

Run: `node --check public/almfrje/app.js`

Expected: exit 0.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/almfrje-member-actions/route.ts public/almfrje/app.js test/almfrje-member-actions.test.mjs
git commit -m "feat: allow audited first-degree member updates"
```

### Task 6: Record future visits exactly once per tab session

**Files:**
- Create: `lib/almfrje-visit-contract.ts`
- Create: `app/api/almfrje-visit/route.ts`
- Modify: `app/api/almfrje-presence/route.ts`
- Modify: `app/api/almfrje-guest-verify/route.ts`
- Modify: `public/almfrje/app.js`
- Test: `test/almfrje-visit-api.test.mjs`

- [ ] **Step 1: Write failing visit tests**

```js
test('presence and guest verification no longer increment visits', () => {
  const presence = read('../app/api/almfrje-presence/route.ts');
  const verify = read('../app/api/almfrje-guest-verify/route.ts');
  assert.doesNotMatch(presence, /vs\.total\+\+|visit_stats.*upsert/s);
  assert.doesNotMatch(verify, /bumpVisit/);
});

test('visit route calls the idempotent RPC', () => {
  const route = read('../app/api/almfrje-visit/route.ts');
  assert.match(route, /almfrje_record_visit/);
  assert.match(route, /recorded|duplicate/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-visit-api.test.mjs`

Expected: FAIL on existing increments and missing route.

- [ ] **Step 3: Implement the visit contract and route**

Validate UUID event IDs, derive branch and city from the verified member/person or guest token, and call `almfrje_record_visit`. Never accept role, branch, or city as authoritative from the client. Return `{ ok: true, result: 'recorded' | 'duplicate', total }`.

- [ ] **Step 4: Implement the pending/committed session state**

In `app.js`, add:

```js
const VISIT_SESSION_KEY = 'almfrje_visit_v2';
async function recordSessionVisit() {
  let state;
  try { state = JSON.parse(sessionStorage.getItem(VISIT_SESSION_KEY) || 'null'); } catch (_) { state = null; }
  if (state && state.status === 'committed') return;
  if (!state || !state.id) {
    state = { id: crypto.randomUUID(), status: 'pending' };
    sessionStorage.setItem(VISIT_SESSION_KEY, JSON.stringify(state));
  }
  const { data: { session } } = await sb.auth.getSession();
  const response = await fetch('/api/almfrje-visit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(session && session.access_token) || ''}`,
    },
    body: JSON.stringify({ eventId: state.id }),
  });
  const res = response.ok ? await response.json() : null;
  if (res && (res.result === 'recorded' || res.result === 'duplicate')) {
    sessionStorage.setItem(VISIT_SESSION_KEY, JSON.stringify({ id: state.id, status: 'committed' }));
  }
}
```

Call once after successful entry. Keep `startPresence()` for online state only.

- [ ] **Step 5: Prove historical values are untouched**

Add a fixture with baseline `{ total: 1295, byBranch: { '1': 20 }, byCity: { الرياض: 10 } }`; test migration SQL contains no reset/update of `visit_stats`, then test one new event yields 1296/21/11 and duplicate leaves them unchanged. Insert one visit event older than 30 days and one recent event; assert cleanup removes only the old idempotency row and never subtracts from `visit_stats`.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add lib/almfrje-visit-contract.ts app/api/almfrje-visit/route.ts app/api/almfrje-presence/route.ts app/api/almfrje-guest-verify/route.ts public/almfrje/app.js test/almfrje-visit-api.test.mjs
git commit -m "fix: count future Almfrje visits once per session"
```

### Task 7: Render the authorized action banner and compact desktop home

**Files:**
- Modify: `public/almfrje/app.js`
- Modify: `public/almfrje/app.css`
- Test: `test/almfrje-home-layout.test.mjs`

- [ ] **Step 1: Write failing source and DOM contract tests**

```js
test('desktop home has three stats and a two-column quick row', () => {
  const js = read('../public/almfrje/app.js');
  const css = read('../public/almfrje/app.css');
  assert.match(js, /class="home-quick-row"/);
  assert.match(css, /@media \(min-width:\s*760px\)[\s\S]*\.stats[\s\S]*repeat\(3,/);
  assert.match(css, /\.home-quick-row[\s\S]*repeat\(2,/);
});

test('banner comes from server summary and links each nonzero category', () => {
  const js = read('../public/almfrje/app.js');
  assert.match(js, /\/api\/almfrje-action-summary/);
  assert.match(js, /memberActivations|birthRequests|reorderRequests|profileNotes/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-home-layout.test.mjs`

Expected: FAIL on missing quick-row and action-summary request.

- [ ] **Step 3: Render the banner without blocking first paint**

Fetch the summary after authenticated shell render. Show only nonzero categories and never display names/content in the banner. On category click route to `#/members?pending=1` or `#/feedbacks?type=...`. Refresh after login, successful decision, and `visibilitychange` when the last successful refresh is older than 60 seconds. On failure show `تعذر تحديث الطلبات` only to administrative users and keep the rest of the page usable.

- [ ] **Step 4: Add the desktop grid wrappers and CSS**

Remove the entire upper `#visitsTotal` card. Keep the existing individuals, branches, and generations cards and the lower `visitStatsCardHtml()` section. Wrap the report and online controls as follows; preserve their existing dynamic content and event handlers:

```html
<!-- Existing .stats contains only individuals, branches, and generations. -->
<div class="home-quick-row">
  <button class="btn outline home-stats-link" data-go="#/stats">📈 التقرير الإحصائي الكامل</button>
  <div class="online-home" id="onlineHome">…</div>
</div>
```

Add:

```css
.stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.home-quick-row { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 12px; }
.home-quick-row .online-home, .home-stats-link { margin: 0; min-height: 52px; }
@media (min-width:760px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .stat { padding: 11px 8px; }
  .stat .n { font-size: 1.55rem; }
  .home-quick-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-quick-row .oh-title { margin-bottom: 0; font-size: .86rem; }
  .home-stats-link { font-size: .88rem; padding: 8px 10px; }
}
```

- [ ] **Step 5: Run syntax, focused tests, and a four-width browser check**

Run: `node --check public/almfrje/app.js`

Expected: exit 0.

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-home-layout.test.mjs`

Expected: PASS.

Use a local production build and inspect widths 390, 760, 1024, and 1366 px in light/dark mode. Expected: 390 has three cards arranged in two columns and stacked quick items; 760+ has one row of three stats and one row of two quick items; no horizontal scroll at 150% zoom. Confirm that visits appear only in the lower section.

Replace the obsolete `#visitsTotal` update in `updateOnlineDom()` with an update of the lower `.vstats-total` from `visitStats.total`. Keep the settings total synchronized from the same state. Apply accepted visit responses through this update path without reloading the tree or closing the expanded visits section. In a browser fixture, render total 1308, deliver an accepted response with total 1309, and verify the lower total becomes 1309 immediately and the upper visitor card is absent. This is a display regression test; do not alter historical database totals. When refreshed branch/city data is available, render it from the same response snapshot rather than mixing older breakdowns with new values.

- [ ] **Step 6: Commit**

```bash
git add public/almfrje/app.js public/almfrje/app.css test/almfrje-home-layout.test.mjs
git commit -m "feat: show action alerts and compact desktop home"
```

### Task 8: Show password advice once per account and installation advice once per browser

**Files:**
- Modify: `lib/almfrje-schema.ts`
- Modify: `almfrje-app/schema.sql`
- Create: `app/api/almfrje-notice-seen/route.ts`
- Modify: `public/almfrje/app.js`
- Test: `test/almfrje-notice-seen.test.mjs`

- [ ] **Step 1: Add account-backed acknowledgement**

Add `password_notice_seen_at timestamptz` using `ADD COLUMN IF NOT EXISTS` in both schema sources and increment their schema revision consistently. Include it in the authenticated caller's own membership payload. Implement POST `/api/almfrje-notice-seen` using `requireAlmfrjeMember`: derive the account ID exclusively from the verified session, reject client-supplied account IDs and arbitrary update fields, and conditionally set the timestamp only when NULL. Return `{ ok: true }` with `Cache-Control: private, no-store`. Repeated acknowledgements are harmless. Do not grant general membership-update rights or use this cosmetic flag for authorization.

- [ ] **Step 2: Record actual password-notice display and preserve prior dismissals**

Show advice only for an eligible account whose server timestamp and local seen marker are absent. After inserting the visible notice, immediately mark the current account seen in memory and local storage, then send the acknowledgement in the background. Honor the existing `almfrje_pwok_<user_id>` marker and migrate it by acknowledging without redisplaying advice. Retry pending acknowledgements on the next authenticated initialization; a failed request must not make the notice repeat on the same browser. Keep keys account-specific and clear in-memory account state on logout. A successful password change also acknowledges the notice. Keep password change accessible from the profile page.

The account-wide guarantee applies after successful server acknowledgement. If two devices first open the account simultaneously before either acknowledgement commits, both may display the advice once; this cosmetic race must not block login or create an authentication dependency.

- [ ] **Step 3: Record installation advice on display**

Add `almfrje_install_prompt_seen_v1`, with an in-memory fallback. Honor the existing `almfrje_install_done` marker so previous dismissals do not reappear after upgrading. Set the new seen marker immediately after the automatic bar is attached, not only on a click. Recheck seen/installed state in delayed iOS callbacks and `beforeinstallprompt` handlers to prevent duplicate automatic bars. Suppress automatic advice in standalone mode; `appinstalled` removes any existing bar and records installed state. Preserve manual installation from More and retain the deferred browser event for that action. Keep the APK downloads link independent of this flag. Browser-storage clearing can reset a browser-local marker; do not introduce device fingerprinting.

- [ ] **Step 4: Verify behavior and authorization**

Exercise the endpoint with an authenticated account, an unauthenticated caller, and a forged other-account ID; verify only the authenticated caller's timestamp can change and repeat calls preserve its original value. Use two browser contexts for the same account: display and acknowledge on the first, then verify suppression on the second. Check refresh, navigation, logout/account switching, legacy markers, failed acknowledgement and retry, and successful password change. Verify installation advice once on display, standalone suppression, delayed callbacks, blocked local storage within one session, and the manual More action after dismissal.

Run `node --check public/almfrje/app.js`, the focused notice tests, and `npm test`. Record the real database/browser results; source pattern checks alone do not prove account isolation or cross-device persistence.

- [ ] **Step 5: Commit the verified implementation**

```bash
git add lib/almfrje-schema.ts almfrje-app/schema.sql app/api/almfrje-notice-seen/route.ts public/almfrje/app.js test/almfrje-notice-seen.test.mjs
git commit -m "fix: show account and installation advice once"
```

### Task 9: Run the full pre-deployment gate

**Files:**
- Modify: `ALMFRJE_DEV_GUIDE.md`
- Create: `docs/verification/almfrje-member-actions-visits-2026-09-04.md`

- [ ] **Step 1: Update technical documentation**

Document `approve_members`, member first-degree rules, action-summary endpoint, audit/revert RPCs, visit event idempotency, three-card desktop layout, the single lower visits total, and one-time notice persistence including acknowledgement retry and legacy-marker migration. Update the in-app guides through the dependent Android/downloads plan. Do not update other project guides.

- [ ] **Step 2: Run all local validation**

Run:

```powershell
node --check public/almfrje/app.js
npm test
npm run check:boundaries
npm run build
```

Expected: every command exits 0; record exact test count and `.next/BUILD_ID` in the verification document.

- [ ] **Step 3: Exercise the authorization matrix in an isolated database**

Test admin, manager with each individual permission, legacy empty permissions, manager outside branch, viewer, inactive member, and direct member scope. Record only status codes and counts, never row bodies or personal data.

- [ ] **Step 4: Commit verification-ready work**

```bash
git add ALMFRJE_DEV_GUIDE.md docs/verification/almfrje-member-actions-visits-2026-09-04.md
git commit -m "docs: verify Almfrje member actions and visits"
```

- [ ] **Step 5: Stop before production activation**

Create a verified database backup and Git rollback tag only when the user authorizes the live deployment checkpoint. If any security test or full-suite command fails, do not deploy and report the exact failure.
