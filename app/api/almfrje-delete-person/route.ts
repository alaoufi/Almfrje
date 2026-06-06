import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// حذف شخص من شجرة المفارجة — لمدير النظام فقط.
// يُنفَّذ على الخادم بصلاحية service_role (يتجاوز RLS) بعد التحقّق من أن
// المُستدعي مديرٌ مفعّل عبر رمز جلسته. يحفظ نسخة في سلة المحذوفات قبل الحذف.
export async function POST(request: NextRequest) {
  const url = process.env.ALMFRJE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.ALMFRJE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.ALMFRJE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 });
  }

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
  const { data: meRow } = await admin
    .from('almfrje_members').select('role,is_active,full_name').eq('user_id', callerId).maybeSingle();
  if (!meRow || meRow.role !== 'admin' || !meRow.is_active) {
    return NextResponse.json({ ok: false, error: 'الحذف لمدير النظام فقط' }, { status: 403 });
  }

  // ٣) المعرّف المطلوب حذفه
  let body: { id?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: 'معرّف الشخص مطلوب' }, { status: 400 });

  // ٤) خذ نسخة كاملة للسلة قبل الحذف
  const { data: row, error: getErr } = await admin.from('almfrje_persons').select('*').eq('id', id).maybeSingle();
  if (getErr) return NextResponse.json({ ok: false, error: 'تعذّر القراءة: ' + getErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: 'الاسم غير موجود (ربما حُذف مسبقاً)' }, { status: 404 });

  await admin.from('almfrje_trash').insert({
    tbl: 'persons', rec_id: id, action: 'delete', label: (row as { name?: string }).name || '',
    data: row, actor_name: (meRow as { full_name?: string }).full_name || '',
  });

  // ٥) احذف الشخص (service_role يتجاوز RLS) وتحقّق من الحذف فعلياً
  const { error: delErr, count } = await admin
    .from('almfrje_persons').delete({ count: 'exact' }).eq('id', id);
  if (delErr) return NextResponse.json({ ok: false, error: 'تعذّر الحذف: ' + delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: count ?? 1, name: (row as { name?: string }).name || '' });
}
