import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';

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

// تسجيل زيارة زائر مُتحقَّق: عدّاد إجمالي + تفصيل حسب الفرع والمنطقة (المدينة) — في الإعدادات.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function bumpVisit(admin: any, branchId: number | null, city: string | null) {
  try {
    const { data } = await admin.from('almfrje_settings').select('value').eq('key', 'visit_stats').maybeSingle();
    const v: any = (data && data.value && typeof data.value === 'object') ? data.value : { total: 0, byBranch: {}, byCity: {} };
    // الإجمالي يُحتسب في مسار التواجد (لكل من يدخل)؛ هنا نوزّع الزوّار حسب الفرع والمنطقة فقط.
    v.byBranch = v.byBranch || {};
    if (branchId != null) v.byBranch[String(branchId)] = (v.byBranch[String(branchId)] || 0) + 1;
    v.byCity = v.byCity || {};
    const c = (city || '').trim();
    if (c) v.byCity[c] = (v.byCity[c] || 0) + 1;
    v.updated_at = new Date().toISOString();
    await admin.from('almfrje_settings').upsert({ key: 'visit_stats', value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch { /* أفضل جهد */ }
}

export async function POST(request: NextRequest) {
  const { url, service } = almfrjeEnv();
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
  type P = { id: number; name: string; father_id: number | null; status: string; branch_id: number | null; city: string | null };
  const persons: P[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    // ترتيب ثابت بالمعرّف: يضمن تحميل كل الأشخاص بلا فجوات/تكرار بين الصفحات (الترقيم
    // دون ORDER ثابت قد يُسقط صفوفاً فتنكسر سلسلة النسب لمن غاب أبوه/جدّه من الذاكرة).
    const { data, error } = await admin.from('almfrje_persons').select('id,name,father_id,status,branch_id,city').order('id', { ascending: true }).range(from, from + 999);
    if (error) break;
    persons.push(...((data || []) as P[]));
    if (!data || data.length < 1000) break;
  }
  // مفتاحٌ نصّيٌّ موحّد: يطابق id/father_id سواءٌ رجعا أرقاماً أو نصوصاً (أعمدة int8 قد
  // تُرجَع كنصوص)، فلا يفشل بحثُ الأب/الجدّ بسبب اختلاف النوع.
  const byId = new Map<string, P>(persons.map((p) => [String(p.id), p]));
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
    while (cur != null && guard++ < 80) { const p = byId.get(String(cur)); if (!p) break; out.push(normWord(p.name)); cur = p.father_id; }
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
  if (liveMatches.length === 1) {
    await bumpVisit(admin, liveMatches[0].branch_id, liveMatches[0].city);
    // الاسم الكامل (رباعي) من قاعدة البيانات: هو ثم آباؤه حتى أربعة أسماء، مفصولة بـ«بن» —
    // لأنه معروفٌ وغير مكرّر. مثال: «محمد بن شامان بن الحميدي بن محمد».
    const fullName = (() => {
      const out: string[] = [];
      let cur: number | null = liveMatches[0].id; let guard = 0;
      while (cur != null && out.length < 4 && guard++ < 20) { const p = byId.get(String(cur)); if (!p) break; out.push(p.name); cur = p.father_id; }
      return out.join(' بن ');
    })();
    return NextResponse.json({ ok: true, branch: liveMatches[0].branch_id, name: fullName });
  }
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
