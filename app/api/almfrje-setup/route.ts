import { NextResponse } from 'next/server';
import { ALMFRJE_SCHEMA_SQL } from '@/lib/almfrje-schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function handle() {
  const pat = process.env.ALMFRJE_SUPABASE_PAT || process.env.SUPABASE_PAT;
  const supaUrl = process.env.ALMFRJE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = supaUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);

  if (!pat || !m) {
    // لا يمكن الإنشاء التلقائي بلا PAT — لكن لا تُفشل التطبيق؛ الجداول قد تكون
    // أُنشئت مسبقاً عبر /api/migrate، فدع التطبيق يحاول الاتصال عادياً.
    return NextResponse.json({
      ok: false,
      reason: !pat ? 'SUPABASE_PAT غير مضاف' : 'تعذّر استخراج project ref',
    }, { status: 200 });
  }
  const ref = m[1];

  // مجلّد التخزين يُنشأ دائماً (حتى لو سبق إعداد المخطط) — رخيص و idempotent،
  // ويعالج القواعد القديمة التي أُنشئت قبل إضافة المجلّد التلقائي.
  try { await runSql(pat, ref, STORAGE_SQL); } catch { /* best-effort */ }

  // إن سبق إعداد المخطط بنجاح في هذه الدورة، اكتفِ بذلك (المخطط ثقيل نسبياً).
  if (_done && _done.ok) return NextResponse.json({ ok: true, cached: true, storage: true });

  const res = await runSql(pat, ref, ALMFRJE_SCHEMA_SQL);
  if (!res.ok) {
    return NextResponse.json({ ok: false, status: res.status, error: res.data }, { status: 200 });
  }
  // حدِّث ذاكرة PostgREST للـ schema حتى تُرى الجداول/الدوال الجديدة عبر REST فوراً.
  try { await runSql(pat, ref, "NOTIFY pgrst, 'reload schema';"); } catch { /* best-effort */ }

  _done = { ok: true, at: Date.now() };
  return NextResponse.json({ ok: true });
}

export async function GET() { return handle(); }
export async function POST() { return handle(); }
