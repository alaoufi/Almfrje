import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { almfrjeEnv, almfrjeEnvOk, AlmfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
//  نسخ احتياطي سحابي لبيانات «المفرجي» → تخزين Supabase (دلو خاص).
//  - تلقائي يومياً عبر Vercel Cron (action=run، انظر vercel.json).
//  - وإدارياً من داخل التطبيق: run (نسخة الآن) / list (سرد) / get (رابط موقّت).
//  الأمان: Cron يُقبل بـ CRON_SECRET أو ترويسة Vercel؛ والإدارة برمز جلسة مدير مفعّل.
//  يُبقي آخر KEEP نسخة (تنظيف تلقائي).
// =============================================================================

const BUCKET = 'almfrje-backups';
const PREFIX = 'auto';
const KEEP = 30;

// جلب كل صفوف جدول مع ترقيم صفحات (تجاوز حدّ 1000 صف الافتراضي).
async function fetchAllRows(db: SupabaseClient, table: string): Promise<any[]> {
  const out: any[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from(table).select('*').range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return out;
}

// مصادقة Cron: CRON_SECRET (حين يُضبط) أو ترويسة Vercel Cron.
function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (secret) return auth === secret;
  return request.headers.get('x-vercel-cron') != null;
}

// مصادقة مدير مفعّل عبر رمز جلسته (لاستدعاءات التطبيق).
async function callerIsAdmin(request: NextRequest, env: AlmfrjeEnv): Promise<boolean> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return false; // هذا سرّ Cron لا رمز مستخدم
  try {
    const asUser = createClient(env.url!, env.anon!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await asUser.auth.getUser();
    if (!data?.user) return false;
    const admin = createClient(env.url!, env.service!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: m } = await admin.from('almfrje_members').select('role,is_active').eq('user_id', data.user.id).maybeSingle();
    return !!(m && m.role === 'admin' && m.is_active);
  } catch { return false; }
}

async function ensureBucket(admin: SupabaseClient) {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) await admin.storage.createBucket(BUCKET, { public: false });
  } catch { /* قد تنقص صلاحية القائمة — نحاول مباشرةً */ }
}

async function runBackup(admin: SupabaseClient) {
  const [persons, branches, members, documents, settings] = await Promise.all([
    fetchAllRows(admin, 'almfrje_persons'),
    fetchAllRows(admin, 'almfrje_branches'),
    fetchAllRows(admin, 'almfrje_members'),
    fetchAllRows(admin, 'almfrje_documents').catch(() => [] as any[]),
    fetchAllRows(admin, 'almfrje_settings').catch(() => [] as any[]),
  ]);
  const backup = {
    app: 'almfrje', kind: 'full-backup', version: 1, auto: true,
    created_at: new Date().toISOString(),
    counts: { persons: persons.length, branches: branches.length, members: members.length, documents: documents.length, settings: settings.length },
    data: { persons, branches, members, documents, settings },
  };
  await ensureBucket(admin);
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-${p(d.getUTCMinutes())}`;
  const path = `${PREFIX}/almfrje_${stamp}.json`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, JSON.stringify(backup, null, 2), { contentType: 'application/json', upsert: true });
  if (upErr) return { ok: false, status: 500, error: 'تعذّر الرفع للتخزين: ' + upErr.message };

  let deleted = 0;
  try {
    const { data: files } = await admin.storage.from(BUCKET).list(PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
    if (files && files.length > KEEP) {
      const old = files.slice(KEEP).map((f) => `${PREFIX}/${f.name}`);
      if (old.length) { await admin.storage.from(BUCKET).remove(old); deleted = old.length; }
    }
  } catch { /* تجاهل أخطاء الاحتفاظ */ }

  return { ok: true, status: 200, path, counts: backup.counts, kept: KEEP, deleted };
}

async function listBackups(admin: SupabaseClient) {
  await ensureBucket(admin);
  const { data, error } = await admin.storage.from(BUCKET).list(PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
  if (error) return { ok: false, status: 500, error: error.message };
  const items = (data || []).filter((f) => f.name.endsWith('.json')).map((f: any) => ({
    name: f.name,
    path: `${PREFIX}/${f.name}`,
    size: f.metadata?.size ?? null,
    created_at: f.created_at ?? f.updated_at ?? null,
  }));
  return { ok: true, status: 200, items };
}

async function signBackup(admin: SupabaseClient, path: string) {
  if (!path || !path.startsWith(PREFIX + '/') || path.includes('..')) return { ok: false, status: 400, error: 'مسار غير صالح' };
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, status: 200, url: data.signedUrl };
}

async function handle(request: NextRequest) {
  const env = almfrjeEnv();
  if (!almfrjeEnvOk(env)) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص (SERVICE_ROLE)' }, { status: 500 });

  const sp = new URL(request.url).searchParams;
  let action = sp.get('action') || '';
  let path = sp.get('path') || '';
  if (request.method === 'POST') {
    try { const b = await request.json(); action = action || b?.action || ''; path = path || b?.path || ''; } catch { /* لا جسم */ }
  }
  action = action || 'run';

  const cronOK = cronAuthorized(request);
  const adminOK = cronOK ? false : await callerIsAdmin(request, env);
  const deny = () => NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  const send = (r: any) => { const { status, ...rest } = r; return NextResponse.json(rest, { status }); };

  const admin = createClient(env.url!, env.service!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    if (action === 'list') return adminOK ? send(await listBackups(admin)) : deny();
    if (action === 'get') return adminOK ? send(await signBackup(admin, path)) : deny();
    // action === 'run' (افتراضي): Cron أو مدير
    if (!cronOK && !adminOK) return deny();
    return send(await runBackup(admin));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
