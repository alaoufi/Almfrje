import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// تواجد وإحصاء الزيارات لكل من يدخل (أي دور) عبر مفتاح خدمي بعد التحقّق.
// «first» = بداية جلسة → يزيد الإجمالي؛ النبضات الدورية تُحدّث التواجد الآن فقط.
// يُخزَّن في almfrje_settings: presence = { clientId: lastSeenMs }, visit_stats.total.
/* eslint-disable @typescript-eslint/no-explicit-any */
const TTL = 180000; // 3 دقائق = «متواجد الآن»

export async function POST(request: NextRequest) {
  const { url, anon, service } = almfrjeEnv();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mem } = await admin.from('almfrje_members').select('is_active').eq('user_id', who.user.id).maybeSingle();
  if (!mem || !mem.is_active) return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل' }, { status: 403 });

  let body: any; try { body = await request.json(); } catch { body = {}; }
  const cid = (String(body.clientId || '').replace(/[^a-z0-9]/gi, '').slice(0, 40)) || ('u' + who.user.id.slice(0, 12));
  const first = !!body.first;
  const branch = (body.branch != null && Number.isFinite(Number(body.branch))) ? Number(body.branch) : null;
  const now = Date.now();

  const { data: rows } = await admin.from('almfrje_settings').select('key,value').in('key', ['presence', 'visit_stats']);
  const map: any = {}; (rows || []).forEach((r: any) => { map[r.key] = r.value; });
  const pres: any = (map.presence && typeof map.presence === 'object') ? map.presence : {};
  // تنقية القديم + توحيد الشكل ({ts,branch})
  for (const k of Object.keys(pres)) {
    const e = pres[k];
    const ts = (e && typeof e === 'object') ? e.ts : e;
    if (typeof ts !== 'number' || now - ts > TTL) delete pres[k];
  }
  pres[cid] = { ts: now, branch };
  await admin.from('almfrje_settings').upsert({ key: 'presence', value: pres, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  // عدّ المتواجدين الآن + تفصيلهم حسب الفرع
  const byBranch: Record<string, number> = {};
  let online = 0;
  for (const k of Object.keys(pres)) {
    online++;
    const b = pres[k] && typeof pres[k] === 'object' ? pres[k].branch : null;
    if (b != null) byBranch[String(b)] = (byBranch[String(b)] || 0) + 1;
  }

  let total = 0;
  if (first) {
    const vs: any = (map.visit_stats && typeof map.visit_stats === 'object') ? map.visit_stats : { total: 0, byBranch: {}, byCity: {} };
    vs.total = (vs.total || 0) + 1; vs.updated_at = new Date().toISOString();
    await admin.from('almfrje_settings').upsert({ key: 'visit_stats', value: vs, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    total = vs.total;
  } else {
    total = (map.visit_stats && map.visit_stats.total) || 0;
  }
  return NextResponse.json({ ok: true, online, byBranch, total });
}
