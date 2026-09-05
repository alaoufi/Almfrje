import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../app/api/almfrje-presence/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

// Run the actual route with only Auth/database I/O replaced by an isolated store.
function harness() {
  const members = {
    [A]: { is_active: true, role: 'admin', full_name: 'محمد اختبار', branch_id: 7, person_id: 10 },
    [B]: { is_active: true, role: 'viewer', full_name: 'محمد اختبار', branch_id: 7, person_id: 20 },
  };
  const persons = { 10: { branch_id: 8 }, 20: { branch_id: 9 } };
  const settings = { presence: {}, visit_stats: { total: 1309, byBranch: { 8: 30 }, byCity: { 'الرياض': 10 } } };
  const failures = { read: false, write: false };
  const db = { from(table) {
    let value;
    const query = {
      select() { return query; },
      eq(_key, target) { value = target; return query; },
      async maybeSingle() { return { data: structuredClone((table === 'almfrje_members' ? members : persons)[value] || null), error: null }; },
      async in(_key, keys) { return { data: failures.read ? null : keys.map(key => ({ key, value: structuredClone(settings[key]) })), error: failures.read ? { message: 'unavailable' } : null }; },
      async upsert(row) {
        if (failures.write) return { error: { message: 'unavailable' } };
        settings[row.key] = structuredClone(row.value); return { error: null };
      },
    };
    return query;
  } };
  const exports = {};
  new Function('require', 'exports', compiled)((name) => {
    if (name === '@/lib/almfrje-env') return { almfrjeEnv: () => ({ url: 'https://fixture.test', anon: 'anon', service: 'service' }) };
    if (name === '@/lib/almfrje-registration-policy') return {
      memberCanUseApp: (member) => !!(member && member.is_active && !(member.perms && member.perms.unverified === true)),
    };
    if (name === '@supabase/supabase-js') return { createClient: (_url, key, options) => key === 'service' ? db : {
      auth: { async getUser() {
        const id = options.global.headers.Authorization.replace('Bearer ', '');
        return { data: { user: members[id] ? { id } : null }, error: null };
      } },
    } };
    return require(name);
  }, exports);
  async function post(uid, body = {}) {
    const response = await exports.POST(new Request('https://fixture.test/api/almfrje-presence', {
      method: 'POST', headers: uid ? { Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' } : {}, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control') };
  }
  return { post, settings, members, failures };
}

test('one account on two devices has one online entry, one branch count, and one name', async () => {
  const h = harness();
  await h.post(A, { clientId: 'phone', name: 'محمد', branch: 8 });
  const result = await h.post(A, { clientId: 'laptop', name: 'اسم مزور', branch: 999 });
  assert.equal(result.status, 200);
  assert.equal(result.body.online, 1);
  assert.deepEqual(result.body.byBranch, { 8: 1 });
  assert.deepEqual(result.body.people, [{ name: 'محمد اختبار', branch: 8 }]);
  assert.match(result.cache, /private.*no-store/);
});

test('different accounts with identical names and client IDs remain separate', async () => {
  const h = harness();
  await h.post(A, { clientId: 'same', name: 'محمد اختبار' });
  await h.post(B, { clientId: 'same', name: 'محمد اختبار' });
  const result = await h.post(A, { clientId: 'same' });
  assert.equal(result.body.online, 2);
  assert.equal(result.body.people.length, 2);
  assert.deepEqual(result.body.byBranch, { 8: 1, 9: 1 });
});

test('legacy device entries are replaced on heartbeat without editing visit history', async () => {
  const h = harness();
  h.settings.presence = { phone: { ts: Date.now(), name: 'محمد', branch: 8 }, laptop: { ts: Date.now(), name: 'محمد', branch: 8 } };
  const history = structuredClone(h.settings.visit_stats);
  assert.equal((await h.post(A, { clientId: 'third' })).body.online, 1);
  assert.deepEqual(h.settings.visit_stats, history);
});

test('refreshing the account on another device keeps it online until the last heartbeat expires', async () => {
  const h = harness();
  await h.post(A, { clientId: 'phone' });
  const key = Object.keys(h.settings.presence)[0];
  h.settings.presence[key].ts = Date.now() - 120000;
  await h.post(A, { clientId: 'laptop' });
  assert.equal((await h.post(B, { clientId: 'second-account' })).body.online, 2);
  h.settings.presence[key].ts = Date.now() - 180001;
  assert.equal((await h.post(B, { clientId: 'second-account' })).body.online, 1);
});

test('viewer gets counts without names and inactive/invalid callers cannot register presence', async () => {
  const h = harness();
  await h.post(A);
  const viewer = await h.post(B);
  assert.equal(viewer.body.people, undefined);
  assert.equal(viewer.body.online, 2);
  h.members[B].perms = { unverified: true };
  assert.equal((await h.post(B)).status, 403);
  h.members[B].perms = {};
  h.members[B].is_active = false;
  assert.equal((await h.post(B)).status, 403);
  assert.equal((await h.post('invalid')).status, 401);
  assert.equal((await h.post(null)).status, 401);
});

test('a read or write failure never returns a successful invented count', async () => {
  const h = harness();
  h.failures.read = true;
  assert.equal((await h.post(A)).status, 503);
  h.failures.read = false; h.failures.write = true;
  assert.equal((await h.post(A)).status, 503);
});
