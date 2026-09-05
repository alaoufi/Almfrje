import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';
import { memberCanUseApp } from '@/lib/almfrje-registration-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// تواجد وإحصاء الزيارات لكل من يدخل (أي دور) عبر مفتاح خدمي بعد التحقّق.
// «first» = بداية جلسة → يزيد الإجمالي؛ النبضات الدورية تُحدّث التواجد الآن فقط.
// presence keyed by verified account UUID, never a device ID or display name.
/* eslint-disable @typescript-eslint/no-explicit-any */
const TTL = 180000; // 3 دقائق = «متواجد الآن»
const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Almfrje-Presence': 'account-v1' };

export async function POST(request: NextRequest) {
  const { url, anon, service } = almfrjeEnv();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401, headers: RESPONSE_HEADERS });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mem } = await admin.from('almfrje_members').select('is_active,perms,role,full_name,branch_id,person_id').eq('user_id', who.user.id).maybeSingle();
  if (!mem || !memberCanUseApp(mem)) return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل' }, { status: 403 });
  const canSeeNames = mem.role === 'admin' || mem.role === 'general_manager';   // الإدارة العليا ترى الأسماء

  let body: any; try { body = await request.json(); } catch { body = {}; }
  const accountKey = 'account:' + who.user.id;
  const first = !!body.first;
  let branch: number | null = mem.branch_id == null ? null : Number(mem.branch_id);
  if (mem.person_id != null) {
    const { data: person, error } = await admin.from('almfrje_persons').select('branch_id').eq('id', mem.person_id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: 'تعذر تحديث التواجد' }, { status: 503, headers: RESPONSE_HEADERS });
    branch = person?.branch_id == null ? null : Number(person.branch_id);
  }
  if (branch !== null && (!Number.isSafeInteger(branch) || branch <= 0)) branch = null;
  const name = String(mem.full_name || '').replace(/[<>]/g, '').trim().slice(0, 80);
  const now = Date.now();

  const { data: rows, error: readError } = await admin.from('almfrje_settings').select('key,value').in('key', ['presence', 'visit_stats']);
  if (readError) return NextResponse.json({ ok: false, error: 'تعذر تحديث التواجد' }, { status: 503, headers: RESPONSE_HEADERS });
  const map: any = {}; (rows || []).forEach((r: any) => { map[r.key] = r.value; });
  const pres: any = (map.presence && typeof map.presence === 'object' && !Array.isArray(map.presence)) ? map.presence : {};
  // Old device entries cannot be safely mapped to accounts. Rebuild transient
  // presence from verified heartbeats; historical visit counters are untouched.
  for (const k of Object.keys(pres)) {
    const e = pres[k];
    const ts = e && typeof e === 'object' ? e.ts : null;
    if (!/^account:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)
      || !Number.isFinite(ts) || ts > now || now - ts > TTL) delete pres[k];
  }
  pres[accountKey] = { ts: now, branch, name };
  const { error: writeError } = await admin.from('almfrje_settings').upsert({ key: 'presence', value: pres, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (writeError) return NextResponse.json({ ok: false, error: 'تعذر تحديث التواجد' }, { status: 503, headers: RESPONSE_HEADERS });

  // عدّ المتواجدين الآن + تفصيلهم حسب الفرع + قائمة أسمائهم (للإدارة العليا فقط)
  const byBranch: Record<string, number> = {};
  const people: { name: string; branch: number | null }[] = [];
  let online = 0;
  for (const k of Object.keys(pres)) {
    online++;
    const e = pres[k] && typeof pres[k] === 'object' ? pres[k] : {};
    const b = e.branch != null ? e.branch : null;
    if (b != null) byBranch[String(b)] = (byBranch[String(b)] || 0) + 1;
    if (canSeeNames) people.push({ name: String(e.name || ''), branch: b });
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
  return NextResponse.json({ ok: true, online, byBranch, total, people: canSeeNames ? people : undefined }, { headers: RESPONSE_HEADERS });
}
