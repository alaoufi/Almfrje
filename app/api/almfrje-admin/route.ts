import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv, almfrjeEnvOk } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// عمليات إدارية على مستخدمي المفارجة (تعديل اسم/جوال/كلمة مرور أي مستخدم).
// تتطلّب الخدمة service_role (لا يُكشف للمتصفّح)، لذا تُنفَّذ على الخادم فقط بعد
// التحقّق من أن المُستدعي مديرٌ مفعّل عبر رمز جلسته (access token).

async function handle(request: NextRequest) {
  // قاعدة المفارجة المعزولة (مع رجوع للمشتركة) — حتى تستهدف نفس قاعدة بيانات التطبيق.
  const env = almfrjeEnv();
  if (!almfrjeEnvOk(env)) {
    return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 });
  }
  const url = env.url!;
  const anon = env.anon!;
  const service = env.service!;

  // ١) تحقّق من هوية المُستدعي عبر رمز الجلسة
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: ures, error: uerr } = await asUser.auth.getUser();
  if (uerr || !ures?.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });
  const callerId = ures.user.id;

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // ٢) تأكّد أن المُستدعي مديرٌ مفعّل
  const { data: meRow } = await admin.from('almfrje_members').select('role,is_active').eq('user_id', callerId).maybeSingle();
  if (!meRow || meRow.role !== 'admin' || !meRow.is_active) {
    return NextResponse.json({ ok: false, error: 'للمدير فقط' }, { status: 403 });
  }

  // ٣) نفّذ التعديل المطلوب
  let body: { user_id?: string; full_name?: string; phone?: string; username?: string | null; pin?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const targetId = body.user_id;
  if (!targetId) return NextResponse.json({ ok: false, error: 'user_id مطلوب' }, { status: 400 });

  // تحديث جدول الأعضاء (الاسم/الجوال/اسم المستخدم)
  const memberUpd: Record<string, unknown> = {};
  if (typeof body.full_name === 'string') memberUpd.full_name = body.full_name;
  if (typeof body.phone === 'string') memberUpd.phone = body.phone;
  if (body.username !== undefined) memberUpd.username = body.username || null;
  if (Object.keys(memberUpd).length) {
    const { error } = await admin.from('almfrje_members').update(memberUpd).eq('user_id', targetId);
    if (error) return NextResponse.json({ ok: false, error: 'تعذّر تحديث البيانات: ' + error.message }, { status: 500 });
  }

  // تحديث بيانات المصادقة (البريد المشتق من الجوال + كلمة المرور)
  const authUpd: { email?: string; password?: string; email_confirm?: boolean } = {};
  if (typeof body.phone === 'string' && body.phone) { authUpd.email = `${body.phone}@almfrje.app`; authUpd.email_confirm = true; }
  if (typeof body.pin === 'string' && /^\d{4,}$/.test(body.pin)) authUpd.password = `${body.pin}@Almfrje`;
  if (authUpd.email || authUpd.password) {
    const { error } = await admin.auth.admin.updateUserById(targetId, authUpd);
    if (error) return NextResponse.json({ ok: false, error: 'تعذّر تحديث الدخول: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) { return handle(request); }
