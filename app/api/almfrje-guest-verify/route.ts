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
  if (gens <= 0) return NextResponse.json({ ok: true });   // التحقّق غير مفعّل → دخول مباشر

  const names = input.split(/\s+/).map((w) => w.trim()).filter((w) => w && w !== 'بن' && w !== 'ابن');
  // الحد الأدنى = ثلاثة أسماء (أنت + أبوك + جدّك) لتقليل الالتباس واحتمال الانتحال.
  if (names.length < 3) return NextResponse.json({ ok: false, error: 'اكتب اسمك ثم أباك ثم جدّك (٣ أسماء على الأقل بالترتيب)' });

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
  // تطبيع اسم واحد (مطابق لـ normalizeAr في الواجهة): يتجاهل التشكيل/الهمزات/التطويل/المسافات.
  const normWord = (s: string): string =>
    String(s || '')
      .replace(/[ً-ْٰ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ـ/g, '')
      .replace(/\s+/g, '').toLowerCase();
  // سلسلة أسماء الشخص (هو ثم آباؤه) مطبَّعة كلمةً كلمة
  const lineageWords = (pid: number): string[] => {
    const out: string[] = [];
    let cur: number | null = pid; let guard = 0;
    while (cur != null && guard++ < 80) { const p = byId.get(cur); if (!p) break; out.push(normWord(p.name)); cur = p.father_id; }
    return out;
  };
  const toks = names.map(normWord).filter(Boolean);
  // التطابق (مطابق لمنطق البحث في الواجهة): الكلمة الأولى ضمن اسمه نفسه،
  // وكل اسم لاحق يطابق الأب المباشر التالي بالترتيب (دون تخطّي أجيال) — أدقّ وأأمن.
  const matchSubseq = (ln: string[]): boolean => {
    if (ln.length < toks.length || !ln[0].includes(toks[0])) return false;
    for (let i = 1; i < toks.length; i++) { if (!ln[i].includes(toks[i])) return false; }
    return true;
  };
  // المطابقون الأحياء فقط (الاسم الأول شرط أن يكون من الأحياء — المتوفّى مستثنى).
  const liveMatches = persons.filter((p) => p.status !== 'dead' && matchSubseq(lineageWords(p.id)));
  // التفرّد: يدخل فقط إن طابق شخصاً حيّاً واحداً تماماً.
  if (liveMatches.length === 1) return NextResponse.json({ ok: true });
  if (liveMatches.length > 1) {
    return NextResponse.json({ ok: false, error: 'اسمك يطابق أكثر من شخص حيّ — أضِف اسم جدٍّ آخر للتمييز.' });
  }
  // لا مطابق حيّ — رسائل تشخيصية أوضح:
  if (persons.some((p) => p.status === 'dead' && matchSubseq(lineageWords(p.id)))) {
    return NextResponse.json({ ok: false, error: 'هذا الاسم مُسجّل في الشجرة كمتوفّى — الدخول للأحياء فقط.' });
  }
  if (persons.some((p) => p.status !== 'dead' && normWord(p.name).includes(toks[0]))) {
    return NextResponse.json({ ok: false, error: 'وُجد اسمك، لكن لم نجد آباءك/أجدادك بما كتبت — تأكّد من ترتيب الأسماء.' });
  }
  return NextResponse.json({ ok: false });   // غير مسجّل إطلاقاً
}
