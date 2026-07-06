import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// إنشاء مستخدم (مدير/مسؤول فرع/مطّلع) من جهة الخادم عبر المفتاح الخدمي مع تأكيد
// البريد تلقائياً — فلا يُرسل أي بريد ولا يتأثّر بإعداد «تأكيد البريد» أو حدّ الإرسال.
// يتحقّق أولاً أن المُنادي مديرٌ مفعّل عبر رمز جلسته.
export async function POST(request: NextRequest) {
  const { url, anon, service } = almfrjeEnv();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });

  // تحقّق هوية المُنادي
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mem } = await admin.from('almfrje_members').select('role,is_active').eq('user_id', who.user.id).maybeSingle();
  if (!mem || !mem.is_active || mem.role !== 'admin') return NextResponse.json({ ok: false, error: 'للمدير فقط' }, { status: 403 });

  let b: { full_name?: string; username?: string; phone?: string; pin?: string; role?: string; branch_ids?: unknown; perms?: unknown; person_id?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }

  const full_name = String(b.full_name || '').trim();
  const phone = String(b.phone || '').replace(/\D/g, '');
  const username = b.username ? String(b.username).trim() : '';
  const pin = String(b.pin || '').trim();
  const role = ['admin', 'general_manager', 'branch_manager', 'viewer'].includes(String(b.role)) ? String(b.role) : 'viewer';
  const person_id = Number(b.person_id) > 0 ? Number(b.person_id) : null;   // شخصه في الشجرة (من المنتقي)
  const branch_ids = Array.isArray(b.branch_ids) ? (b.branch_ids as unknown[]).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0) : [];
  // تنقية الصلاحيات: قيم منطقية فقط لمفاتيح معروفة الشكل (تُستخدم لاحقاً في almfrje_perm).
  const perms: Record<string, boolean> = {};
  if (b.perms && typeof b.perms === 'object') {
    for (const k of Object.keys(b.perms as Record<string, unknown>)) {
      const v = (b.perms as Record<string, unknown>)[k];
      if (typeof v === 'boolean' && /^[a-z_]{1,24}$/.test(k)) perms[k] = v;
    }
  }
  if (!full_name) return NextResponse.json({ ok: false, error: 'أدخل الاسم' }, { status: 400 });
  if (phone.length < 7) return NextResponse.json({ ok: false, error: 'أدخل رقم جوال صحيح' }, { status: 400 });
  if (!/^\d{4,}$/.test(pin)) return NextResponse.json({ ok: false, error: 'الرقم السري ٤ أرقام على الأقل' }, { status: 400 });

  const email = `${phone}@almfrje.app`;
  const password = `${pin}@Almfrje`;

  // أنشئ حساب المصادقة مؤكَّداً (بلا إرسال بريد)
  const { data: created, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name, username: username || null, phone },
  });
  if (ce || !created || !created.user) {
    const m = (ce && ce.message) || 'تعذّر إنشاء الحساب';
    if (/already|exists|registered|duplicate/i.test(m)) return NextResponse.json({ ok: false, error: 'الجوال مسجّل مسبقاً' }, { status: 409 });
    return NextResponse.json({ ok: false, error: m }, { status: 400 });
  }
  const uid = created.user.id;

  // فعّل صفّ العضو بالدور المطلوب (المُشغّل قد ينشئ الصف؛ نضمن قيمه بـ upsert)
  const { error: ue } = await admin.from('almfrje_members').upsert({
    user_id: uid, full_name, username: username || null, phone, role, is_active: true,
    branch_ids, branch_id: branch_ids[0] || null, perms, person_id,
  }, { onConflict: 'user_id' });
  if (ue) return NextResponse.json({ ok: false, error: ue.message }, { status: 400 });

  return NextResponse.json({ ok: true, user_id: uid });
}
