import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';
import { normalizePhone } from '@/lib/almfrje-phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// التسجيل الذاتي للزائر المتحقَّق بالاسم: يُكمل بياناته (الجوال إجباري) فيُنشأ له
// حساب «زائر مسجَّل» موقوفاً حتى تفعّله الإدارة، وتُستكمل بيانات شخصه في الشجرة
// (تعبئة الفارغ فقط — لا استبدال لبياناتٍ قائمة).
export async function POST(request: NextRequest) {
  const { url, anon, service } = almfrjeEnv();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  // جلسة صالحة (تكفي جلسة الزائر) — صدٌّ للطلبات الخارجية العشوائية
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });

  let b: { pid?: unknown; phone?: unknown; password?: unknown; nickname?: unknown; city?: unknown; birth?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const pid = Number(b.pid);
  const phone = normalizePhone(b.phone);
  const password = String(b.password || '').trim();
  const nickname = String(b.nickname || '').trim().slice(0, 60);
  const city = String(b.city || '').trim().slice(0, 60);
  const birth = String(b.birth || '').trim().slice(0, 30);
  if (!Number.isFinite(pid) || pid <= 0) return NextResponse.json({ ok: false, error: 'مُعرّف الشخص ناقص — ادخل باسمك أولاً' }, { status: 400 });
  if (phone.length < 9) return NextResponse.json({ ok: false, error: 'أدخل رقم جوال صحيح (إجباري)' }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ ok: false, error: 'كلمة المرور إجبارية — ٤ أحرف/أرقام على الأقل' }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: person } = await admin.from('almfrje_persons')
    .select('id,name,father_id,status,phone,nickname,city,birth').eq('id', pid).maybeSingle();
  if (!person) return NextResponse.json({ ok: false, error: 'لم يُعثر على اسمك في الشجرة' }, { status: 404 });
  if (person.status === 'dead') return NextResponse.json({ ok: false, error: 'لا يمكن التسجيل بهذا الاسم' }, { status: 400 });

  // ازدواج: حسابٌ بنفس الجوال أو لنفس الشخص
  const { data: dup } = await admin.from('almfrje_members').select('user_id,phone,person_id').or(`phone.eq.${phone},person_id.eq.${pid}`).limit(1);
  if (dup && dup.length) {
    const d = dup[0] as { phone?: string };
    const msg = String(d.phone || '') === phone
      ? 'هذا الجوال مسجّلٌ بحسابٍ مسبقاً — يمكنك الدخول به مباشرةً من «دخول المسؤول».'
      : 'لهذا الاسم حسابٌ مسبقاً — ادخل بجوالك وكلمة المرور، أو تواصل مع الإدارة.';
    return NextResponse.json({ ok: false, error: msg }, { status: 409 });
  }

  // الاسم الكامل (٤ أسماء) من الشجرة
  const names: string[] = [person.name];
  let cur: number | null = person.father_id; let hops = 0;
  while (cur != null && names.length < 4 && hops++ < 10) {
    const { data: f } = await admin.from('almfrje_persons').select('name,father_id').eq('id', cur).maybeSingle();
    if (!f) break; names.push(f.name); cur = f.father_id;
  }
  const full_name = names.join(' بن ');

  const { data: created, error: ce } = await admin.auth.admin.createUser({
    email: `${phone}@almfrje.app`, password: `${password}@Almfrje`, email_confirm: true,
    user_metadata: { full_name, phone },
  });
  if (ce || !created || !created.user) {
    const m = (ce && ce.message) || 'تعذّر إنشاء الحساب';
    if (/already|exists|registered|duplicate/i.test(m)) return NextResponse.json({ ok: false, error: 'الجوال مسجّل مسبقاً — يمكنك الدخول به مباشرة.' }, { status: 409 });
    return NextResponse.json({ ok: false, error: m }, { status: 400 });
  }
  const { error: ue } = await admin.from('almfrje_members').upsert({
    user_id: created.user.id, full_name, phone, role: 'viewer', is_active: false, person_id: pid, perms: {},
  }, { onConflict: 'user_id' });
  if (ue) return NextResponse.json({ ok: false, error: ue.message }, { status: 400 });

  // استكمال بيانات شخصه — تعبئة الفارغ فقط
  const patch: Record<string, string> = {};
  if (!String(person.phone || '').trim()) patch.phone = phone;
  if (nickname && !String(person.nickname || '').trim()) patch.nickname = nickname;
  if (city && !String(person.city || '').trim()) patch.city = city;
  if (birth && !String(person.birth || '').trim()) patch.birth = birth;
  if (Object.keys(patch).length) { try { await admin.from('almfrje_persons').update(patch).eq('id', pid); } catch { /* */ } }

  return NextResponse.json({ ok: true });
}
