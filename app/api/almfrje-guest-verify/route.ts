import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// تحقّق دخول الزائر بالنسب: المدير يحدّد عدد الأجيال (guest_verify_gens) من لوحة التحكم.
// الزائر يكتب اسمه ثم آباءه؛ إن طابقت أول n أسماء سلسلة نسب شخصٍ موجود → يُسمح له.
// يتجاهل: التشكيل، الهمزات (أ/إ/آ/ا)، التطويل، المسافات، «بن»/«ابن»، و«ال».
function normGen(s: string): string {
  const t = String(s || '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ـ/g, '');
  const parts = t.split(/\s+/).filter((w) => w && w !== 'بن' && w !== 'ابن');
  return parts.join('').replace(/ال/g, '').toLowerCase();
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  let body: { input?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const input = String(body.input || '');

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // إعدادات الزائر
  const { data: settings } = await admin.from('almfrje_settings').select('key,value').in('key', ['guest_open', 'guest_verify_gens']);
  const map: Record<string, unknown> = {};
  (settings || []).forEach((r: { key: string; value: unknown }) => { map[r.key] = r.value; });
  if (map.guest_open !== true) return NextResponse.json({ ok: false, error: 'الموقع مغلق للزوّار' }, { status: 403 });
  const gens = Math.max(0, parseInt(String(map.guest_verify_gens ?? 0), 10) || 0);
  if (gens <= 0) return NextResponse.json({ ok: true });   // بلا بوابة تحقّق

  const names = input.split(/\s+/).map((w) => w.trim()).filter((w) => w && w !== 'بن' && w !== 'ابن');
  if (names.length < gens) return NextResponse.json({ ok: false, error: `اكتب اسمك ثم آباءك (${gens} أسماء على الأقل بالترتيب)` });
  // نطابق بكل ما كتبه المستخدم (قد يكون أكثر من الحدّ الأدنى)، ونشترط أن يكون فريداً.
  const depth = names.length;
  const sig = normGen(names.join(' '));
  if (!sig) return NextResponse.json({ ok: false });

  // تحميل الأشخاص (صفحات)
  type P = { id: number; name: string; father_id: number | null; status: string };
  const persons: P[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin.from('almfrje_persons').select('id,name,father_id,status').range(from, from + 999);
    if (error) break;
    persons.push(...((data || []) as P[]));
    if (!data || data.length < 1000) break;
  }
  const byId = new Map<number, P>(persons.map((p) => [p.id, p]));
  const lineageSig = (pid: number, n: number): string | null => {
    const chain: string[] = [];
    let cur: number | null = pid; let guard = 0;
    while (cur != null && chain.length < n && guard++ < 80) {
      const p = byId.get(cur); if (!p) break;
      chain.push(p.name); cur = p.father_id;
    }
    if (chain.length < n) return null;
    return normGen(chain.join(' '));
  };
  // الأشخاص الذين يطابق نسبُهم ما كتبه المستخدم — بشرط أن يكون صاحب الاسم نفسه (الزائر) حيّاً.
  const matches = persons.filter((p) => p.status !== 'dead' && lineageSig(p.id, depth) === sig).length;
  if (matches === 1) return NextResponse.json({ ok: true });
  if (matches > 1) {
    // التطابق ليس فريداً (تكرار في الأسماء) → اطلب اسم جدٍّ إضافي للتمييز (٣ ← ٤ …)
    return NextResponse.json({ ok: false, needMore: true, matches, error: `يوجد ${matches} أشخاص بنفس هذا الاسم — أضِف اسم الجدّ التالي ثم أعد المحاولة` });
  }
  return NextResponse.json({ ok: false });   // 0 → غير مسجّل
}
