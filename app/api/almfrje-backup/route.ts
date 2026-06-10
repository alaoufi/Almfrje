import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { almfrjeEnv, almfrjeEnvOk } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
//  نسخ احتياطي سحابي مجدول لبيانات «المفرجي» → تخزين Supabase (دلو خاص).
//  يُستدعى تلقائياً عبر Vercel Cron (انظر vercel.json) مرّة يومياً.
//  يحفظ نسخة كاملة مؤرّخة، ويُبقي آخر KEEP نسخة فقط (تنظيف تلقائي).
//  الأمان: حين يُضبط CRON_SECRET يُطلب تطابقه؛ وإلا يُقبل طلب Vercel Cron فقط.
// =============================================================================

const BUCKET = 'almfrje-backups';
const KEEP = 30; // عدد النسخ التلقائية المحفوظة (الأقدم يُحذف تلقائياً)

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

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (secret) return auth === secret;                       // صارم حين يُضبط CRON_SECRET
  return request.headers.get('x-vercel-cron') != null;      // وإلا: مهمّة Vercel المجدولة فقط
}

async function runBackup() {
  const env = almfrjeEnv();
  if (!almfrjeEnvOk(env)) return { ok: false, status: 500, error: 'إعداد الخادم ناقص (SERVICE_ROLE)' };
  const admin = createClient(env.url!, env.service!, { auth: { persistSession: false, autoRefreshToken: false } });

  // ١) اجمع البيانات الكاملة
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

  // ٢) تأكّد من وجود الدلو الخاص (إنشاؤه عند أول تشغيل)
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await admin.storage.createBucket(BUCKET, { public: false });
    }
  } catch { /* قد تنقص صلاحية القائمة — نحاول الرفع مباشرةً */ }

  // ٣) ارفع النسخة باسم مؤرّخ (UTC)
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-${p(d.getUTCMinutes())}`;
  const path = `auto/almfrje_${stamp}.json`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, JSON.stringify(backup, null, 2), { contentType: 'application/json', upsert: true });
  if (upErr) return { ok: false, status: 500, error: 'تعذّر الرفع للتخزين: ' + upErr.message };

  // ٤) سياسة الاحتفاظ: أبقِ آخر KEEP نسخة فقط (الأسماء مؤرّخة فالترتيب التنازلي = الأحدث أولاً)
  let deleted = 0;
  try {
    const { data: files } = await admin.storage.from(BUCKET).list('auto', { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
    if (files && files.length > KEEP) {
      const old = files.slice(KEEP).map((f) => `auto/${f.name}`);
      if (old.length) { await admin.storage.from(BUCKET).remove(old); deleted = old.length; }
    }
  } catch { /* تجاهل أخطاء التنظيف */ }

  return { ok: true, status: 200, path, counts: backup.counts, kept: KEEP, deleted };
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  try {
    const r = await runBackup();
    const { status, ...rest } = r as any;
    return NextResponse.json(rest, { status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
