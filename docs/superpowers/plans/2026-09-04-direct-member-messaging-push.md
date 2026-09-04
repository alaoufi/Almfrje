# Almfrje Direct Member Messaging and Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إضافة محادثات نصية خاصة وفردية بين عضوين مفعّلين، مع غير مقروء وحظر وإبلاغ وإشعارات Push، ومنع أي طرف ثالث أو إدارة من قراءة المحتوى العادي.

**Architecture:** تستخدم المراسلات جداول منفصلة ذات طرفين ثابتين وسياسات RLS مبنية على `auth.uid()`. تنفذ الكتابة والحظر والبلاغات عبر Route Handlers موثقة ودوال ذرية، ويستخدم العميل Supabase Realtime للتحديث الأمامي وWeb Push عبر Service Worker للتنبيه الخلفي من دون تضمين نص الرسالة.

**Tech Stack:** Next.js Route Handlers، TypeScript، Supabase/PostgreSQL RLS وRealtime، Web Push/VAPID، Service Worker، Vanilla JavaScript/CSS، Node test runner.

---

## Prerequisite gate

لا تبدأ قبل نجاح خطة الأمان وخطة `2026-09-04-member-actions-alerts-visits-layout.md`. لا يعاد استعمال `almfrje_topics` أو سياساتها؛ تبقى المناقشات الإدارية الحالية مستقلة.

## File structure

- Create `lib/almfrje-direct-message-policy.ts`: تطبيع الزوج، أهلية العضو، النص، وحدود المعدل.
- Create `lib/almfrje-push.ts`: تشفير وإرسال Web Push وتنظيف الاشتراكات الميتة.
- Create `app/api/almfrje-direct-messages/route.ts`: قائمة المحادثات، الإنشاء، الرسائل، الإرسال، القراءة، الحظر، والبلاغ.
- Create `app/api/almfrje-push-subscription/route.ts`: تسجيل/حذف اشتراك الجهاز لصاحبه.
- Create `public/almfrje-sw.js`: استقبال Push وفتح المحادثة.
- Modify `lib/almfrje-schema.ts` and `almfrje-app/schema.sql`: الجداول والدوال والسياسات.
- Modify `public/almfrje/app.js`: شاشة الرسائل والمحادثة والعداد والإعدادات.
- Modify `public/almfrje/app.css`: قائمة وفقاعات واستجابة الجوال والحاسب.
- Modify `public/almfrje/manifest.webmanifest`: خصائص PWA اللازمة للإشعارات وTWA.
- Modify `package.json` and `package-lock.json`: إضافة مكتبة Web Push الخادمة وأنواعها مع تثبيت القفل.
- Test `test/almfrje-direct-message-policy.test.mjs`.
- Test `test/almfrje-direct-message-schema.test.mjs`.
- Test `test/almfrje-direct-message-api.test.mjs`.
- Test `test/almfrje-push.test.mjs`.

### Task 1: Define the exact two-party policy

**Files:**
- Create: `lib/almfrje-direct-message-policy.ts`
- Test: `test/almfrje-direct-message-policy.test.mjs`

- [ ] **Step 1: Write failing policy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePair, sanitizeMessage, canStartConversation } from '../lib/almfrje-direct-message-policy.ts';

test('normalizes exactly two different users', () => {
  assert.deepEqual(normalizePair('b', 'a'), ['a', 'b']);
  assert.throws(() => normalizePair('a', 'a'), /different members/);
});

test('accepts text only up to 2000 characters', () => {
  assert.equal(sanitizeMessage('  مرحبا  '), 'مرحبا');
  assert.throws(() => sanitizeMessage(''), /empty/);
  assert.throws(() => sanitizeMessage('x'.repeat(2001)), /2000/);
});

test('both members must be active and linked', () => {
  assert.equal(canStartConversation({ active: true, personId: 1 }, { active: true, personId: 2 }), true);
  assert.equal(canStartConversation({ active: true, personId: 1 }, { active: false, personId: 2 }), false);
  assert.equal(canStartConversation({ active: true, personId: 1 }, { active: true, personId: null }), false);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-direct-message-policy.test.mjs`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the pure policy**

```ts
export type MessageMember = { active: boolean; personId: number | null };

export function normalizePair(a: string, b: string): [string, string] {
  if (!a || !b || a === b) throw new Error('conversation requires two different members');
  return a < b ? [a, b] : [b, a];
}

export function sanitizeMessage(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('message is empty');
  if (text.length > 2000) throw new Error('message exceeds 2000 characters');
  return text;
}

export function canStartConversation(a: MessageMember, b: MessageMember): boolean {
  return a.active && b.active && Number.isFinite(a.personId) && Number.isFinite(b.personId);
}
```

- [ ] **Step 4: Run green and commit**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-direct-message-policy.test.mjs`

Expected: PASS, 3 tests.

```bash
git add lib/almfrje-direct-message-policy.ts test/almfrje-direct-message-policy.test.mjs
git commit -m "feat: define two-party messaging policy"
```

### Task 2: Create messaging tables and deny third-party reads

**Files:**
- Modify: `lib/almfrje-schema.ts`
- Modify: `almfrje-app/schema.sql`
- Test: `test/almfrje-direct-message-schema.test.mjs`

- [ ] **Step 1: Write failing schema tests**

```js
test('schema has fixed two-party conversations and no participant table', () => {
  assert.match(schema, /almfrje_direct_conversations/);
  assert.match(schema, /user_low uuid not null/);
  assert.match(schema, /user_high uuid not null/);
  assert.match(schema, /unique \(user_low, user_high\)/i);
  assert.doesNotMatch(schema, /almfrje_direct_participants/);
});

test('message select policy only allows either endpoint', () => {
  assert.match(schema, /auth\.uid\(\) in \(c\.user_low, c\.user_high\)/);
  assert.doesNotMatch(schema, /almfrje_is_admin\(\).*direct_messages/s);
});

test('message writes use server-only transactional RPCs', () => {
  for (const fn of ['almfrje_start_direct_conversation', 'almfrje_send_direct_message', 'almfrje_mark_direct_read', 'almfrje_report_direct_message']) {
    assert.match(schema, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
  }
  assert.match(schema, /REVOKE ALL ON FUNCTION public\.almfrje_send_direct_message/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-direct-message-schema.test.mjs`

Expected: FAIL because direct-message schema is absent.

- [ ] **Step 3: Add the exact schema**

Add tables with this shape to both schema sources:

```sql
CREATE TABLE IF NOT EXISTS public.almfrje_direct_conversations (
  id bigint generated always as identity primary key,
  user_low uuid not null references auth.users(id) on delete restrict,
  user_high uuid not null references auth.users(id) on delete restrict,
  last_message_id bigint,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_low, user_high),
  check (user_low::text < user_high::text)
);
CREATE TABLE IF NOT EXISTS public.almfrje_direct_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.almfrje_direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (sender_id, request_id)
);
CREATE INDEX IF NOT EXISTS almfrje_direct_messages_conversation_created_idx
  ON public.almfrje_direct_messages(conversation_id, created_at desc);
CREATE INDEX IF NOT EXISTS almfrje_direct_messages_sender_created_idx
  ON public.almfrje_direct_messages(sender_id, created_at desc);
CREATE TABLE IF NOT EXISTS public.almfrje_direct_reads (
  conversation_id bigint not null references public.almfrje_direct_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id bigint,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.almfrje_direct_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS public.almfrje_direct_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.almfrje_direct_messages(id),
  reporter_id uuid not null references auth.users(id),
  reported_sender_id uuid not null references auth.users(id),
  message_snapshot text not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
CREATE TABLE IF NOT EXISTS public.almfrje_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE TABLE IF NOT EXISTS public.almfrje_direct_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  conversation_id bigint references public.almfrje_direct_conversations(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 4: Add helper functions and RLS**

Add the party helper and policies below; use distinct policy names so rerunning setup is idempotent:

```sql
CREATE OR REPLACE FUNCTION public.almfrje_is_direct_party(p_conversation_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.almfrje_direct_conversations c
    JOIN public.almfrje_members m ON m.user_id = auth.uid() AND m.is_active AND m.person_id IS NOT NULL
    WHERE c.id = p_conversation_id AND auth.uid() IN (c.user_low, c.user_high)
  );
$func$;
REVOKE ALL ON FUNCTION public.almfrje_is_direct_party(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.almfrje_is_direct_party(bigint) TO authenticated;

ALTER TABLE public.almfrje_direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_direct_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_direct_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_direct_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almfrje_direct_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS direct_conversations_select ON public.almfrje_direct_conversations;
CREATE POLICY direct_conversations_select ON public.almfrje_direct_conversations FOR SELECT
  USING (auth.uid() IN (user_low, user_high) AND public.almfrje_is_member());
DROP POLICY IF EXISTS direct_messages_select ON public.almfrje_direct_messages;
CREATE POLICY direct_messages_select ON public.almfrje_direct_messages FOR SELECT
  USING (public.almfrje_is_direct_party(conversation_id));
DROP POLICY IF EXISTS direct_reads_select ON public.almfrje_direct_reads;
CREATE POLICY direct_reads_select ON public.almfrje_direct_reads FOR SELECT
  USING (user_id = auth.uid() AND public.almfrje_is_direct_party(conversation_id));
DROP POLICY IF EXISTS direct_blocks_select ON public.almfrje_direct_blocks;
CREATE POLICY direct_blocks_select ON public.almfrje_direct_blocks FOR SELECT USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS direct_reports_insert ON public.almfrje_direct_reports;
CREATE POLICY direct_reports_insert ON public.almfrje_direct_reports FOR INSERT WITH CHECK (
  reporter_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.almfrje_direct_messages msg
    WHERE msg.id = message_id AND public.almfrje_is_direct_party(msg.conversation_id)
  )
);
DROP POLICY IF EXISTS direct_reports_select ON public.almfrje_direct_reports;
CREATE POLICY direct_reports_select ON public.almfrje_direct_reports FOR SELECT USING (public.almfrje_is_admin());
DROP POLICY IF EXISTS push_subscriptions_select ON public.almfrje_push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.almfrje_push_subscriptions FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.almfrje_direct_conversations, public.almfrje_direct_messages FROM anon, authenticated;
REVOKE ALL ON public.almfrje_direct_reports, public.almfrje_push_subscriptions FROM anon;
REVOKE ALL ON public.almfrje_direct_presence FROM anon, authenticated;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.almfrje_direct_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

GRANT SELECT ON public.almfrje_direct_conversations, public.almfrje_direct_messages TO authenticated;
```

Add these server-only transactional functions and revoke them from `PUBLIC`, `anon`, and `authenticated`:

```sql
public.almfrje_start_direct_conversation(p_actor uuid, p_other uuid) returns bigint
public.almfrje_send_direct_message(
  p_actor uuid, p_conversation_id bigint, p_request_id uuid, p_body text
) returns jsonb
public.almfrje_mark_direct_read(
  p_actor uuid, p_conversation_id bigint, p_message_id bigint
) returns void
public.almfrje_report_direct_message(
  p_actor uuid, p_message_id bigint, p_reason text
) returns bigint
```

Each function locks or advisory-locks the relevant pair/conversation before checking. `start` derives and sorts exactly two active linked users, rejects blocked pairs, limits each actor to 20 newly created conversations per hour, and returns the existing row on repetition. `send` proves party membership, active status, and no block in either direction; rejects over 30 messages per rolling minute; inserts by `(sender_id, request_id)` exactly once; and updates `last_message_id/last_message_at` in the same transaction. `mark_read` proves the message belongs to that conversation and upserts only `p_actor`. `report` proves party membership and copies body/sender into the immutable snapshot inside the transaction; it never accepts a snapshot from the caller. Functions are callable only by the server database role after the route has derived `p_actor` from the verified bearer token.

Writes for reads, blocks, reports, subscriptions, conversations, and messages go through the verified server routes. The routes use service-role writes only after checking the caller and target; no broad client write grant remains. Increment `schema_rev` consistently in both schema sources.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add lib/almfrje-schema.ts almfrje-app/schema.sql test/almfrje-direct-message-schema.test.mjs
git commit -m "feat: add private direct-message schema"
```

### Task 3: Implement idempotent direct-message APIs

**Files:**
- Create: `app/api/almfrje-direct-messages/route.ts`
- Test: `test/almfrje-direct-message-api.test.mjs`

- [ ] **Step 1: Write failing route tests**

Assert actions `members`, `conversations`, `messages`, `start`, `send`, `read`, `active`, `idle`, `block`, `unblock`, and `report`; reject any `senderId`, `role`, or participant array from the body; require the centralized member guard.

```js
test('route never trusts sender or participant arrays', () => {
  const source = read('../app/api/almfrje-direct-messages/route.ts');
  assert.match(source, /requireAlmfrjeMember/);
  assert.doesNotMatch(source, /body\.senderId|body\.participants|body\.role/);
  for (const action of ['members', 'conversations', 'messages', 'start', 'send', 'read', 'active', 'idle', 'block', 'unblock', 'report']) assert.match(source, new RegExp(`'${action}'`));
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-direct-message-api.test.mjs`

Expected: FAIL with missing route.

- [ ] **Step 3: Implement lookup and conversation reads**

Use `requireAlmfrjeMember`; `members` returns at most 20 active linked matches with `{ userId, personId, displayName, photoUrl }`, never phone/email. `conversations` queries only rows where the caller is an endpoint and returns the other member plus unread count. `messages` requires party membership and pages 50 messages older than an optional message ID.

- [ ] **Step 4: Implement start/send/read atomically**

`start` calls `almfrje_start_direct_conversation`. `send` validates UUID `requestId`, sanitizes body, then calls `almfrje_send_direct_message`; after that transaction commits, invoke push delivery without rolling back the message if push fails. `read` calls `almfrje_mark_direct_read`. Never split a function's locked validation and write into separate Supabase requests.

`active` first verifies that the caller is a party, then upserts only the caller's `almfrje_direct_presence` row with that conversation and `expires_at = now() + interval '45 seconds'`. The visible conversation refreshes it every 30 seconds. `idle` clears only the caller's row. The server treats an expired row as absent and may delete it; clients never receive another member's presence row.

Return:

```ts
return NextResponse.json({ ok: true, message: { id, conversationId, body, createdAt, senderId: actor.user.id } }, {
  headers: { 'Cache-Control': 'private, no-store' },
});
```

- [ ] **Step 5: Implement block and report**

Block always uses caller as `blocker_id`. Report accepts only message ID and reason and calls `almfrje_report_direct_message`; that function verifies caller is a conversation party and not the sender, then copies exactly the stored body and sender into `almfrje_direct_reports`. Ignore client snapshots. Normal admins/managers receive no conversation/message read path; admin moderation reads only report rows and snapshots.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-direct-message-policy.test.mjs test/almfrje-direct-message-api.test.mjs`

Expected: all focused tests pass.

Run: `npm test`

Expected: all tests pass.

```bash
git add app/api/almfrje-direct-messages/route.ts test/almfrje-direct-message-api.test.mjs
git commit -m "feat: add private direct-message API"
```

### Task 4: Add VAPID push subscriptions and delivery

**Files:**
- Create: `lib/almfrje-push.ts`
- Create: `app/api/almfrje-push-subscription/route.ts`
- Modify: `app/api/almfrje-direct-messages/route.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/almfrje-push.test.mjs`

- [ ] **Step 1: Write failing push tests**

```js
test('push payload is generic and excludes message body', () => {
  const payload = buildPushPayload({ senderName: 'محمد', conversationId: 7 });
  assert.equal(payload.title, 'رسالة جديدة من محمد');
  assert.equal(payload.body, 'افتح تطبيق المفارجة لقراءتها');
  assert.equal(JSON.stringify(payload).includes('secret message'), false);
});

test('subscription endpoint is owner derived', () => {
  const source = read('../app/api/almfrje-push-subscription/route.ts');
  assert.match(source, /requireAlmfrjeMember/);
  assert.doesNotMatch(source, /body\.userId/);
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-push.test.mjs`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the subscription endpoint**

Install `web-push` plus `@types/web-push`, committing the lockfile. Accept only HTTPS endpoint plus base64url `p256dh` and `auth`. Upsert by endpoint with `user_id` from the verified member. Delete only subscriptions owned by the caller. Add `ALMFRJE_VAPID_PUBLIC_KEY`, `ALMFRJE_VAPID_PRIVATE_KEY`, and `ALMFRJE_VAPID_SUBJECT` to `.env.example` without values. Configure VAPID only on the server; throw a startup/configuration error when any secret is absent instead of silently disabling delivery.

- [ ] **Step 4: Implement push delivery**

`buildPushPayload` returns only title/body/icon/badge/data URL. `sendDirectMessagePush` loads recipient subscriptions, skips delivery only when the recipient has an unexpired `almfrje_direct_presence` row for the exact conversation, sends concurrently with bounded fan-out, deletes endpoints returning 404/410, and records no message body or subscription secret in logs.

```ts
export function buildPushPayload(input: { senderName: string; conversationId: number }) {
  return {
    title: `رسالة جديدة من ${input.senderName}`,
    body: 'افتح تطبيق المفارجة لقراءتها',
    icon: '/almfrje/icon-192.png',
    badge: '/almfrje/badge-96.png',
    data: { url: `/#/messages/${input.conversationId}` },
  };
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add lib/almfrje-push.ts app/api/almfrje-push-subscription/route.ts app/api/almfrje-direct-messages/route.ts .env.example package.json package-lock.json test/almfrje-push.test.mjs
git commit -m "feat: notify members of direct messages"
```

### Task 5: Register the Service Worker and notification behavior

**Files:**
- Create: `public/almfrje-sw.js`
- Create: `public/almfrje/icon-192.png`
- Create: `public/almfrje/icon-512.png`
- Create: `public/almfrje/badge-96.png`
- Modify: `public/almfrje/manifest.webmanifest`
- Modify: `public/almfrje/app.js`
- Test: `test/almfrje-service-worker.test.mjs`

- [ ] **Step 1: Write failing worker tests**

Assert `push` and `notificationclick` handlers exist, use payload data URL only after constraining it to the same origin, focus an existing window or open a new one, and do not embed VAPID private material.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-service-worker.test.mjs`

Expected: FAIL because the worker is missing.

- [ ] **Step 3: Implement the Service Worker**

```js
'use strict';
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(payload.title || 'المفارجة', {
    body: payload.body || 'لديك رسالة جديدة', icon: '/almfrje/icon-192.png', badge: '/almfrje/badge-96.png',
    data: { url: typeof payload?.data?.url === 'string' && payload.data.url.startsWith('/#/messages/') ? payload.data.url : '/#/messages' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/#/messages', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const existing = wins.find((win) => new URL(win.url).origin === self.location.origin);
    return existing ? existing.focus().then(() => existing.navigate(url)) : clients.openWindow(url);
  }));
});
```

- [ ] **Step 4: Register only after app initialization**

Register `/almfrje-sw.js` at same-origin root scope. Add a user-gesture button `تفعيل إشعارات الرسائل`; on click request permission, subscribe with the public VAPID key, and POST subscription to the owner-only endpoint. Show denied/unsupported states without blocking messages.

- [ ] **Step 5: Update manifest and create raster icons**

Set `display: standalone`, `start_url: /`, and include 192/512 PNG maskable icons. Generate raster icons from the current SVG using a deterministic script or ImageMagick and verify exact dimensions.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add public/almfrje-sw.js public/almfrje/icon-192.png public/almfrje/icon-512.png public/almfrje/badge-96.png public/almfrje/manifest.webmanifest public/almfrje/app.js test/almfrje-service-worker.test.mjs
git commit -m "feat: add Almfrje message push worker"
```

### Task 6: Build the member messaging UI

**Files:**
- Modify: `public/almfrje/app.js`
- Modify: `public/almfrje/app.css`
- Test: `test/almfrje-messaging-ui.test.mjs`

- [ ] **Step 1: Write failing UI contract tests**

Assert routes `#/messages` and `#/messages/:id`, menu item and unread badge, individual member search, no group strings/buttons, block/report controls, and escaped body rendering.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-messaging-ui.test.mjs`

Expected: FAIL on missing routes.

- [ ] **Step 3: Add list and conversation screens**

Reuse the visual language of existing `.wa-*` classes but create dedicated `dm-*` classes and API state. Add pagination, optimistic send with a stable request UUID, read updates, reconnect banner, empty states, and `aria-live` for new messages. Escape all bodies with `esc()` and never render message HTML.

- [ ] **Step 4: Add Realtime with scoped fallback**

Subscribe to inserts filtered by the current conversation after the server confirms party membership. On navigation unsubscribe. If channel status is not `SUBSCRIBED`, start the 15-second refresh only while the conversation route is visible. Refresh unread on login and on focus after 60 seconds.

- [ ] **Step 5: Add block/report and notification settings**

Place actions in the conversation header. Block requires confirmation. Report requires selecting a stored message and reason; send only message ID and reason. Add notification status and enable/disable controls to the messages screen.

- [ ] **Step 6: Run all frontend checks and commit**

Run:

```powershell
node --check public/almfrje/app.js
npm test
npm run check:boundaries
```

Expected: all commands exit 0.

```bash
git add public/almfrje/app.js public/almfrje/app.css test/almfrje-messaging-ui.test.mjs
git commit -m "feat: add private member messaging UI"
```

### Task 7: Verify security, realtime, and push before APK work

**Files:**
- Create: `docs/verification/almfrje-direct-messaging-push-2026-09-04.md`

- [ ] **Step 1: Run the isolated authorization matrix**

Create two active linked test members, a third member, an inactive member, a manager, and an admin. Verify participant reads succeed; third party, manager, admin, visitor, and inactive reads fail. Verify direct PostgREST and API results match. Record IDs only from disposable fixtures and remove fixtures through the test teardown.

- [ ] **Step 2: Run browser behavior checks**

Verify list/unread, send/retry idempotency, read receipt, block both directions, report snapshot, realtime delivery, fallback polling scope, and no group UI at widths 390 and 1024.

- [ ] **Step 3: Run push checks on an Android browser/device**

Grant permission, close the app, send from the other member, verify generic notification, tap to open the correct conversation, then deny permission and verify messages/unread still work. Expire a disposable subscription and verify 404/410 cleanup.

- [ ] **Step 4: Run the full suite and build**

Run:

```powershell
npm test
npm run check:boundaries
npm run build
```

Expected: all exit 0. Record counts and `.next/BUILD_ID`.

- [ ] **Step 5: Commit verification evidence and stop before live deployment**

```bash
git add docs/verification/almfrje-direct-messaging-push-2026-09-04.md
git commit -m "docs: verify direct messaging and push"
```

Do not activate on Cloudflare until a database backup and rollback tag exist and the user reaches the live-deployment checkpoint.
