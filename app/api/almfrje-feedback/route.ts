import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// إدارة ملاحظات/طلبات الزوار من جهة الخادم (مفتاح خدمي) بعد التحقق من هوية المُنادي.
// يتيح للمدير رؤية الكل، ولمسؤول الفرع رؤية «إضافة مولود» و«ملاحظة» ضمن فروعه فقط
// واتخاذ الإجراء — دون الاعتماد على سياسات RLS (تعمل مهما كانت إعدادات القاعدة).
function normAr(s: string): string {
  return String(s || '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ـ/g, '')
    .replace(/\s+/g, '').trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const { url, anon, service } = almfrjeEnv();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });

  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });

  const admin: SupabaseClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { action?: string; id?: number; reply?: string; name?: string; ids?: unknown[] };
  try { body = await request.json(); } catch { body = {}; }
  const action = String(body.action || 'list');
  const id = body.id != null ? Number(body.id) : null;

  // ردود الإدارة على ملاحظات المرسل نفسه — متاحة لأي جلسةٍ صالحة (زائر/عضو) باسم دخوله.
  // تُعاد حقول محدودة فقط (الموضوع/الرد/التواريخ) — لا تفاصيل ولا أسماء رادّين.
  if (action === 'myreplies') {
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ ok: true, rows: [] });
    const { data, error } = await admin.from('almfrje_feedback')
      .select('id,subject,reply,replied_at,created_at,reply_seen')
      .eq('created_by_name', name).neq('reply', '')
      .order('replied_at', { ascending: false }).limit(20);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, rows: data || [] });
  }

  // المرسل ضغط «قرأتها» على الرسالة المنبثقة — لا تنبثق له مجدداً
  if (action === 'replyseen') {
    const name = String(body.name || '').trim();
    const idList = (Array.isArray(body.ids) ? body.ids : []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (!name || !idList.length) return NextResponse.json({ ok: true });
    const { error } = await admin.from('almfrje_feedback')
      .update({ reply_seen: true }).eq('created_by_name', name).in('id', idList);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { data: mem } = await admin.from('almfrje_members').select('role,is_active,branch_id,branch_ids,full_name,username').eq('user_id', who.user.id).maybeSingle();
  if (!mem || !mem.is_active) return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل' }, { status: 403 });
  const isAdmin = mem.role === 'admin';
  const isGen = mem.role === 'general_manager';                    // مشرف عام (كل الفروع أو فروعٍ محدّدة)
  const isMgr = mem.role === 'branch_manager' || isGen;
  if (!isAdmin && !isMgr) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 403 });
  const myBranches = new Set<number>([
    ...(Array.isArray(mem.branch_ids) ? (mem.branch_ids as unknown[]).map((x) => Number(x)) : []),
    ...(mem.branch_id ? [Number(mem.branch_id)] : []),
  ].filter((x) => Number.isFinite(x) && x > 0));
  const allBranches = isGen && myBranches.size === 0;              // مشرف عام بلا فروعٍ محدّدة = كل الفروع
  const whoName = mem.full_name || mem.username || '';

  type Row = { id: number; subject: string; branch_id: number | null; details: string; status: string };
  const canTouch = (r: Row) => isAdmin || (isMgr && ['إضافة مولود', 'ملاحظة'].includes(r.subject) && (allBranches || (r.branch_id != null && myBranches.has(Number(r.branch_id)))));

  if (action === 'list' || action === 'count') {
    const { data, error } = await admin.from('almfrje_feedback').select('*').order('created_at', { ascending: false }).limit(3000);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const rows = (data || []).filter((r) => canTouch(r as Row));
    if (action === 'count') return NextResponse.json({ ok: true, pending: rows.filter((r) => (r as Row).status !== 'done').length });
    return NextResponse.json({ ok: true, rows });
  }

  if (id == null) return NextResponse.json({ ok: false, error: 'مُعرّف ناقص' }, { status: 400 });
  const { data: row } = await admin.from('almfrje_feedback').select('*').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: 'العنصر غير موجود' }, { status: 404 });
  if (!canTouch(row as Row)) return NextResponse.json({ ok: false, error: 'غير مصرّح لهذا الفرع' }, { status: 403 });

  if (action === 'done' || action === 'reopen') {
    const upd = action === 'done'
      ? { status: 'done', done_by_name: whoName, done_at: new Date().toISOString() }
      : { status: 'new', done_at: null, done_by_name: '' };
    const { error } = await admin.from('almfrje_feedback').update(upd).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reply') {
    const reply = String(body.reply || '').trim().slice(0, 1000);
    if (!reply) return NextResponse.json({ ok: false, error: 'نصّ الرد فارغ' }, { status: 400 });
    const { error } = await admin.from('almfrje_feedback')
      .update({ reply, replied_by_name: whoName, replied_at: new Date().toISOString(), reply_seen: false }).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete' || action === 'reject') {
    const { error } = await admin.from('almfrje_feedback').delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    if ((row as Row).subject !== 'إضافة مولود') return NextResponse.json({ ok: false, error: 'ليس طلب مولود' }, { status: 400 });
    let o: { kind?: string; father_id?: number; name?: string; birth?: string; city?: string } | null = null;
    try { o = JSON.parse((row as Row).details); } catch { o = null; }
    if (!o || o.kind !== 'newborn' || !o.father_id || !o.name) return NextResponse.json({ ok: false, error: 'بيانات الطلب غير صالحة' }, { status: 400 });
    const { data: father } = await admin.from('almfrje_persons').select('id,name,branch_id,generation').eq('id', o.father_id).maybeSingle();
    if (!father) return NextResponse.json({ ok: false, error: 'لم يُعثر على والد المولود في الشجرة' }, { status: 400 });
    if (isMgr && !allBranches && !myBranches.has(Number(father.branch_id))) return NextResponse.json({ ok: false, error: 'الأب خارج فرعك المصرّح به' }, { status: 403 });
    const { data: sibs } = await admin.from('almfrje_persons').select('name,status').eq('father_id', father.id);
    const nn = normAr(o.name);
    if ((sibs || []).some((c: { name: string; status: string }) => c.status !== 'dead' && normAr(c.name) === nn)) {
      return NextResponse.json({ ok: false, error: 'يوجد ابن حيّ بنفس الاسم لنفس الأب' }, { status: 409 });
    }
    const { data: ins, error: ie } = await admin.from('almfrje_persons').insert({
      name: o.name, father_id: father.id, branch_id: father.branch_id, generation: (father.generation || 1) + 1,
      status: 'alive', birth: o.birth || '', city: o.city || '', created_by_name: whoName,
    }).select('id').single();
    if (ie) return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });
    try { await admin.from('almfrje_audit').insert({ action: 'add', person_id: ins.id, person_name: o.name, actor_name: whoName, actor: who.user.id }); } catch { /* best-effort */ }
    await admin.from('almfrje_feedback').update({ status: 'done', done_by_name: whoName, done_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, person_id: ins.id, name: o.name });
  }

  return NextResponse.json({ ok: false, error: 'إجراء غير معروف' }, { status: 400 });
}
