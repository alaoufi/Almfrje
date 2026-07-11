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

  let b: { action?: unknown; pid?: unknown; phone?: unknown; password?: unknown; nickname?: unknown; city?: unknown; birth?: unknown; publish?: unknown; username?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }

  const admin0 = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // العضو يحدّث بيانات حسابه لنفسه (الجوال/اسم المستخدم) — الاسم ممنوع من هنا
  if (String(b.action || '') === 'myaccount') {
    const { data: memRow } = await admin0.from('almfrje_members').select('user_id,phone,is_active').eq('user_id', who.user.id).maybeSingle();
    if (!memRow) return NextResponse.json({ ok: false, error: 'لا حساب عضوية' }, { status: 404 });
    const newPhone = normalizePhone(b.phone);
    const username = b.username === undefined ? undefined : String(b.username || '').trim().slice(0, 40) || null;
    if (newPhone && newPhone.length < 9) return NextResponse.json({ ok: false, error: 'رقم جوال غير صحيح' }, { status: 400 });
    const upd: Record<string, unknown> = {};
    if (username !== undefined) upd.username = username;
    if (newPhone && newPhone !== normalizePhone(memRow.phone)) {
      const { data: dup } = await admin0.from('almfrje_members').select('user_id').eq('phone', newPhone).neq('user_id', who.user.id).limit(1);
      if (dup && dup.length) return NextResponse.json({ ok: false, error: 'هذا الجوال مستخدم بحسابٍ آخر' }, { status: 409 });
      const { error: ae } = await admin0.auth.admin.updateUserById(who.user.id, { email: `${newPhone}@almfrje.app`, email_confirm: true } as never);
      if (ae) return NextResponse.json({ ok: false, error: ae.message }, { status: 400 });
      upd.phone = newPhone;
    }
    if (Object.keys(upd).length) {
      const { error: ue2 } = await admin0.from('almfrje_members').update(upd).eq('user_id', who.user.id);
      if (ue2) return NextResponse.json({ ok: false, error: ue2.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, phone_changed: !!upd.phone });
  }

  // كشف الأعضاء المطهَّر للمشرفين: أسماء وأدوار وحالات وربط الشخص فقط — بلا جوالات
  // (جوالات الأعضاء محمية حمايةً مطلقة: المدير وصاحب الرقم فقط)
  if (String(b.action || '') === 'roster') {
    const { data: memRow } = await admin0.from('almfrje_members').select('role,is_active').eq('user_id', who.user.id).maybeSingle();
    const okRole = memRow && memRow.is_active && ['admin', 'general_manager', 'branch_manager'].includes(String(memRow.role));
    if (!okRole) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 403 });
    const { data: rows, error: re } = await admin0.from('almfrje_members')
      .select('full_name,role,is_active,person_id,created_at').limit(2000);
    if (re) return NextResponse.json({ ok: false, error: re.message }, { status: 400 });
    return NextResponse.json({ ok: true, rows: rows || [] });
  }

  // العضو يحدّث بيانات ملفه الشخصي (شخصه المرتبط في الشجرة) — حقول محدّدة ولنفسه حصراً
  if (String(b.action || '') === 'myinfo') {
    const { data: memRow } = await admin0.from('almfrje_members').select('user_id,person_id,is_active').eq('user_id', who.user.id).maybeSingle();
    if (!memRow || !memRow.is_active) return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل' }, { status: 403 });
    if (!memRow.person_id) return NextResponse.json({ ok: false, error: 'حسابك غير مرتبطٍ بشخصٍ في الشجرة — تواصل مع الإدارة' }, { status: 400 });
    const patch: Record<string, string> = {};
    const nick = String(b.nickname ?? '').trim().slice(0, 60);
    const cty = String(b.city ?? '').trim().slice(0, 60);
    const brt = String(b.birth ?? '').trim().slice(0, 30);
    if (b.nickname !== undefined) patch.nickname = nick;
    if (b.city !== undefined) patch.city = cty;
    if (b.birth !== undefined) patch.birth = brt;
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    const { error: pe } = await admin0.from('almfrje_persons').update(patch).eq('id', memRow.person_id);
    if (pe) return NextResponse.json({ ok: false, error: pe.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // تغيير خصوصية الجوال من «ملفي الشخصي» — لصاحب الحساب حصراً، مع تطبيق الأثر على ملفه بالشجرة
  if (String(b.action || '') === 'privacy') {
    const publish = b.publish === true;
    const { data: memRow } = await admin0.from('almfrje_members').select('user_id,phone,person_id').eq('user_id', who.user.id).maybeSingle();
    if (!memRow) return NextResponse.json({ ok: false, error: 'لا حساب عضوية' }, { status: 404 });
    const { error: e1 } = await admin0.from('almfrje_members').update({ phone_public: publish }).eq('user_id', who.user.id);
    if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 400 });
    const myPh = normalizePhone(memRow.phone);
    if (memRow.person_id && myPh) {
      const { data: pr } = await admin0.from('almfrje_persons').select('id,phone').eq('id', memRow.person_id).maybeSingle();
      if (pr) {
        if (publish && !String(pr.phone || '').trim()) await admin0.from('almfrje_persons').update({ phone: myPh }).eq('id', pr.id);
        if (!publish && String(pr.phone || '').trim() && normalizePhone(pr.phone) === myPh) await admin0.from('almfrje_persons').update({ phone: '' }).eq('id', pr.id);
      }
    }
    return NextResponse.json({ ok: true });
  }
  const pid = Number(b.pid);
  const phone = normalizePhone(b.phone);
  const password = String(b.password || '').trim();
  const nickname = String(b.nickname || '').trim().slice(0, 60);
  const city = String(b.city || '').trim().slice(0, 60);
  const birth = String(b.birth || '').trim().slice(0, 30);
  const publish = b.publish === true;   // «أسمح بنشره في دليل الموقع» — وإلا فللموقع فقط
  if (!Number.isFinite(pid) || pid <= 0) return NextResponse.json({ ok: false, error: 'مُعرّف الشخص ناقص — ادخل باسمك أولاً' }, { status: 400 });
  if (phone.length < 9) return NextResponse.json({ ok: false, error: 'أدخل رقم جوال صحيح (إجباري)' }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ ok: false, error: 'كلمة المرور إجبارية — ٤ أحرف/أرقام على الأقل' }, { status: 400 });

  const admin = admin0;

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

  // صدّ الثغرة: اسمٌ له حسابٌ قائم (حتى القديمة غير المربوطة) — لا تسجيل مزدوج
  {
    const normName = (x: string) => String(x || '').replace(/\bبن\b|\bابن\b/g, ' ')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ً-ْٰـ…]/g, '')
      .replace(/\s+/g, '').trim();
    const target = normName(full_name);
    const { data: allm } = await admin.from('almfrje_members').select('full_name').limit(500);
    if ((allm || []).some((r) => normName(String((r as { full_name?: string }).full_name || '')) === target)) {
      return NextResponse.json({ ok: false, error: 'لهذا الاسم حسابٌ مسجّل مسبقاً — ارجع لصفحة الدخول وادخل بجوالك وكلمة المرور، أو استخدم «مراسلة الإدارة» هناك.' }, { status: 409 });
    }
  }

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
    user_id: created.user.id, full_name, phone, role: 'viewer', is_active: false, person_id: pid, perms: {}, phone_public: publish,
  }, { onConflict: 'user_id' });
  if (ue) return NextResponse.json({ ok: false, error: ue.message }, { status: 400 });

  // استكمال بيانات شخصه — تعبئة الفارغ فقط
  const patch: Record<string, string> = {};
  if (publish && !String(person.phone || '').trim()) patch.phone = phone;   // يُنشر في ملفه فقط بموافقته
  // طلب الخصوصية = حماية مطلقة: إن كان جوالُه منشوراً في ملفه بالشجرة يُسحب منه
  // (يبقى محفوظاً في حسابه — يراه هو والمدير فقط بحماية القاعدة)
  if (!publish && String(person.phone || '').trim() && normalizePhone(person.phone) === phone) patch.phone = '';
  if (nickname && !String(person.nickname || '').trim()) patch.nickname = nickname;
  if (city && !String(person.city || '').trim()) patch.city = city;
  if (birth && !String(person.birth || '').trim()) patch.birth = birth;
  if (Object.keys(patch).length) { try { await admin.from('almfrje_persons').update(patch).eq('id', pid); } catch { /* */ } }

  return NextResponse.json({ ok: true });
}
