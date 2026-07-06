import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { ALMFRJE_SCHEMA_SQL } from '@/lib/almfrje-schema';
import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// التحقّق أن المُنادي مديرٌ مفعّل (يمنع تشغيل ترقية مميّزة بـ PAT من أي زائر).
async function isAdminCaller(request: NextRequest): Promise<boolean> {
  const { url, anon, service } = almfrjeEnv();
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !anon || !service || !token) return false;
  try {
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: who } = await caller.auth.getUser();
    if (!who || !who.user) return false;
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: mem } = await admin.from('almfrje_members').select('role,is_active').eq('user_id', who.user.id).maybeSingle();
    return !!(mem && mem.is_active && mem.role === 'admin');
  } catch { return false; }
}

// إعداد تلقائي لجداول المفارجة (الأنساب) — يناديه تطبيق /almfrje ذاتياً أول ما يُفتح
// فلا حاجة لتشغيل /api/migrate يدوياً. كل أوامر المخطط IF NOT EXISTS / OR REPLACE
// (idempotent) فتُنفَّذ مراراً بأمان دون حذف أي بيانات.
//
// آمن للنشر علناً: لا يحذف ولا يُفرغ شيئاً، ويستخدم SUPABASE_PAT من الخادم فقط
// (لا يُكشف للمتصفّح). الحماية الفعلية للبيانات عبر RLS المُنشأة هنا.

// نُنفّذ مرة واحدة لكل دورة حياة للدالة (cold start) ونُخزّن النتيجة عشان ما نكرّر
// نداء Management API مع كل فتح للصفحة.
let _done: { ok: boolean; at: number } | null = null;

// إنشاء مجلّد التخزين العام «almfrje» + سياسات الوصول (قراءة عامة، كتابة للمصادَقين).
// idempotent: ON CONFLICT DO NOTHING + DROP/CREATE POLICY.
const STORAGE_SQL = `
  insert into storage.buckets (id, name, public)
    values ('almfrje', 'almfrje', true)
    on conflict (id) do update set public = true;

  drop policy if exists "almfrje_read" on storage.objects;
  create policy "almfrje_read" on storage.objects for select
    using (bucket_id = 'almfrje');

  drop policy if exists "almfrje_insert" on storage.objects;
  create policy "almfrje_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'almfrje');

  drop policy if exists "almfrje_update" on storage.objects;
  create policy "almfrje_update" on storage.objects for update to authenticated
    using (bucket_id = 'almfrje') with check (bucket_id = 'almfrje');

  drop policy if exists "almfrje_delete" on storage.objects;
  create policy "almfrje_delete" on storage.objects for delete to authenticated
    using (bucket_id = 'almfrje');
`;

async function runSql(pat: string, ref: string, query: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { ok: r.ok, status: r.status, data };
}

// احتياطي حين يغيب/يفشل الـPAT: تنفيذ الترقية باتصال Postgres مباشر.
// لا يُقبل إلا اتصالٌ يحمل مُعرّف مشروع المفرجي نفسه (ref) — حمايةً من الكتابة على قاعدةٍ أخرى.
function pgConnForRef(ref: string): string | null {
  const cands: string[] = [];
  for (const k of ['ALMFRJE_DB_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL']) {
    const v = process.env[k];
    if (v && v.trim()) cands.push(v.trim());
  }
  const host = process.env.POSTGRES_HOST, pw = process.env.POSTGRES_PASSWORD;
  if (host && pw) {
    const user = process.env.POSTGRES_USER || (host.includes('pooler.supabase.com') ? `postgres.${ref}` : 'postgres');
    const port = process.env.POSTGRES_PORT || '6543';
    cands.push(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pw)}@${host}:${port}/${process.env.POSTGRES_DATABASE || 'postgres'}`);
  }
  for (const c of cands) { if (c.includes(ref)) return c; }
  return null;
}

async function runSqlPg(conn: string, query: string) {
  const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 });
  try { await pool.query(query); return { ok: true as const, error: null }; }
  catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
  finally { await pool.end().catch(() => { /* */ }); }
}

async function handle() {
  const pat = almfrjeEnv().pat;
  // ترقية المفارجة تستهدف قاعدتها وحدها فقط (لا رجوع للقاعدة المشتركة) — عزل تام عن مراحي/الاستشارات.
  const supaUrl = almfrjeEnv().url || '';
  const m = supaUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) return NextResponse.json({ ok: false, reason: 'تعذّر استخراج project ref' }, { status: 200 });
  const ref = m[1];

  // إن سبق إعداد المخطط بنجاح في هذه الدورة، اكتفِ بذلك (المخطط ثقيل نسبياً).
  if (_done && _done.ok) return NextResponse.json({ ok: true, cached: true });

  // ١) القناة الأولى: Management API بمفتاح PAT
  let patError: unknown = null;
  if (pat) {
    try { await runSql(pat, ref, STORAGE_SQL); } catch { /* best-effort */ }
    const res = await runSql(pat, ref, ALMFRJE_SCHEMA_SQL);
    if (res.ok) {
      try { await runSql(pat, ref, "NOTIFY pgrst, 'reload schema';"); } catch { /* best-effort */ }
      _done = { ok: true, at: Date.now() };
      return NextResponse.json({ ok: true, via: 'pat' });
    }
    patError = res.data;
  }

  // ٢) القناة الاحتياطية: اتصال Postgres مباشر يخصّ مشروع المفرجي حصراً
  const conn = pgConnForRef(ref);
  if (conn) {
    const r2 = await runSqlPg(conn, ALMFRJE_SCHEMA_SQL);
    if (r2.ok) {
      await runSqlPg(conn, STORAGE_SQL).catch?.(() => { /* */ });
      await runSqlPg(conn, "NOTIFY pgrst, 'reload schema';");
      _done = { ok: true, at: Date.now() };
      return NextResponse.json({ ok: true, via: 'pg' });
    }
    return NextResponse.json({ ok: false, via: 'pg', error: r2.error, patError }, { status: 200 });
  }

  return NextResponse.json({
    ok: false,
    reason: pat
      ? 'فشل PAT ولا يوجد اتصال قاعدة مباشر لمشروع المفرجي (أضِف ALMFRJE_DB_URL في Vercel)'
      : 'لا PAT ولا اتصال قاعدة مباشر — أضِف ALMFRJE_SUPABASE_PAT أو ALMFRJE_DB_URL في Vercel',
    patError,
  }, { status: 200 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminCaller(request))) return NextResponse.json({ ok: false, error: 'للمدير فقط' }, { status: 403 });
  return handle();
}
export async function POST(request: NextRequest) {
  if (!(await isAdminCaller(request))) return NextResponse.json({ ok: false, error: 'للمدير فقط' }, { status: 403 });
  return handle();
}
