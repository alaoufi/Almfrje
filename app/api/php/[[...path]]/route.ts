import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db, generateToken, authFromHeader, isAuthError, AuthPayload, pgrstQuote, touchLastSeen } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Long-poll on /threads/:id can take up to ~9s. Vercel Hobby max is 10s.
export const maxDuration = 10;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Json = Record<string, unknown> | unknown[];

const ok = (data: Json | string | number | boolean | null, status = 200) =>
  NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; }
  return fallback;
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// Read a single value from the `settings` table.
async function readSetting(supabase: ReturnType<typeof db>, key: string): Promise<string | undefined> {
  const { data } = await supabase.from('settings').select('value').eq('key_name', key).maybeSingle();
  return data?.value;
}

// admin_perms is stored as JSON string of array, e.g. '["users","appts"]'.
// NULL/empty = super admin (backward-compat for existing admins).
// Permission keys: 'super', 'users', 'appts', 'assign', 'sections',
// 'reports', 'chats', 'publications', 'archive', 'settings', 'location'.
function adminHasPerm(adminPerms: string | null | undefined, key: string): boolean {
  if (!adminPerms) return true;
  try {
    const arr = JSON.parse(adminPerms);
    if (!Array.isArray(arr)) return true;
    return arr.includes('super') || arr.includes(key);
  } catch {
    return true;
  }
}

async function ensureAdminPerm(
  supabase: ReturnType<typeof db>,
  uid: number,
  key: string,
): Promise<boolean> {
  try {
    const { data } = await supabase.from('users').select('admin_perms').eq('id', uid).maybeSingle();
    const raw = (data as { admin_perms?: string | null } | null)?.admin_perms;
    return adminHasPerm(raw, key);
  } catch {
    return true;
  }
}

async function dispatch(req: NextRequest, method: Method): Promise<NextResponse> {
  const path = req.nextUrl.pathname;
  // /api/php/<res>/<id?>
  const m = path.match(/^\/api\/php\/?([^/]+)?\/?([^/]+)?/);
  const res = m?.[1] ?? '';
  const id = m?.[2] ?? null;
  const u = new URL(req.url);
  const sp = u.searchParams;
  const auth = req.headers.get('authorization');

  // Best-effort: mark the caller as online so admins can see active reviewers.
  // Skipped silently if not authenticated.
  touchLastSeen(auth).catch(() => {});

  // ─── LOGIN ────────────────────────────────────────────────────────
  if (res === 'login') {
    if (method !== 'POST') return err('POST only', 405);
    const d = await readBody(req);
    const q = trimStr(d.phone) || trimStr(d.username);
    const w = typeof d.password === 'string' ? d.password : '';
    if (!q || !w) return err('أدخل بيانات الدخول', 400);
    const supabase = db();
    const qd = q.replace(/[^0-9]/g, '0');
    const qp = '+' + qd;
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .neq('status', 'banned')
      .or(`username.eq.${pgrstQuote(q)},phone.eq.${pgrstQuote(q)},phone.eq.${pgrstQuote(qp)}`)
      .limit(1);
    const user = users?.[0];
    // Same generic error for "no user" vs "wrong password" so callers can't
    // enumerate accounts via the response text.
    if (!user) return err('بيانات الدخول غير صحيحة', 401);
    const valid = await compare(w, user.password);
    if (!valid) return err('بيانات الدخول غير صحيحة', 401);
    // When "special login only" is on, allow only admins or users with
    // allowed_special=1. The admin URL (?admin=1) doesn't bypass this check;
    // admins are simply always allowed regardless of mode.
    const specialOnly = (await readSetting(supabase, 'allow_special_login')) === '1';
    if (specialOnly && user.role !== 'admin' && Number(user.allowed_special) !== 1) {
      return err('الدخول الخاص فقط — ليس لديك صلاحية', 403);
    }
    // نُعيد الحقول الكاملة للملف الشخصي و admin_perms و allow_chat حتى تستطيع
    // الواجهة عرض الصفحة الصحيحة فوراً بدون استدعاء /me إضافي بعد تسجيل الدخول.
    return ok({
      token: generateToken(user.id, user.role),
      user: {
        id: user.id, name: user.name, username: user.username,
        phone: user.phone, role: user.role,
        allowed_special: user.allowed_special,
        allow_chat: user.allow_chat ?? 1,
        gender: user.gender ?? null,
        age: user.age ?? null,
        height: user.height ?? null,
        weight: user.weight ?? null,
        occupation: user.occupation ?? null,
        residence: user.residence ?? null,
        admin_perms: user.admin_perms ?? null,
      },
    });
  }

  // ─── CHECK SPECIAL ────────────────────────────────────────────────
  if (res === 'check_special') {
    if (method !== 'POST') return err('POST only', 405);
    const d = await readBody(req);
    const phone = trimStr(d.phone);
    if (!phone) return err('أدخل رقم الجوال', 400);
    const supabase = db();
    const specialOn = (await readSetting(supabase, 'allow_special_login')) === '1';
    if (!specialOn) return err('الدخول الخاص غير مفعّل', 403);
    const qd = phone.replace(/[^0-9]/g, '0');
    const qp = '+' + qd;
    const { data: users } = await supabase
      .from('users')
      .select('id,name,role,allowed_special,status')
      .neq('status', 'banned')
      .or(`phone.eq.${pgrstQuote(phone)},phone.eq.${pgrstQuote(qp)}`)
      .limit(1);
    const user = users?.[0];
    if (!user) return err('رقم الجوال غير موجود في النظام', 404);
    if (user.role === 'admin' || Number(user.allowed_special) === 1) {
      return ok({ allowed: true, name: user.name });
    }
    return ok({ allowed: false, error: 'رقم الجوال غير مصرّح له بالدخول الخاص' });
  }

  // ─── REGISTER (public self-signup, gated by allow_registration) ────
  if (res === 'register') {
    if (method !== 'POST') return err('POST only', 405);
    const supabase = db();
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key_name', 'allow_registration')
      .maybeSingle();
    if (setting?.value !== '1') return err('التسجيل مغلق حالياً', 403);
    const d = await readBody(req);
    const name = trimStr(d.name);
    const username = trimStr(d.username);
    const phone = trimStr(d.phone);
    const password = typeof d.password === 'string' ? d.password : '';
    if (!name || !username || !phone || !password) {
      return err('جميع الحقول مطلوبة', 400);
    }
    if (password.length < 4) return err('كلمة المرور قصيرة', 400);
    const hashed = await hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ name, username, phone, password: hashed, role: 'reviewer', allowed_special: 0, status: 'active' })
      .select('id')
      .single();
    if (error) return err('اسم المستخدم أو الجوال مكرر', 409);
    return ok({ ok: true, id: data?.id });
  }

  // ─── INVITE VERIFY (public — للحصول على بيانات الدعوة قبل تسجيل المدعو)
  if (res === 'invite_verify' && method === 'GET') {
    const t = trimStr(sp.get('token'));
    if (!t) return err('رمز الدعوة مطلوب', 400);
    const supabase = db();
    await supabase.from('invitations').update({ status: 'expired' })
      .eq('status', 'pending').lt('expires_at', new Date().toISOString());
    const { data: inv } = await supabase
      .from('invitations')
      .select('id,name,phone,status,expires_at,inviter_id')
      .eq('token', t)
      .maybeSingle();
    if (!inv) return err('الرابط غير صحيح', 404);
    const row = inv as { id: number; name: string; phone: string; status: string; expires_at: string; inviter_id: number };
    if (row.status === 'used') return err('تم استخدام هذه الدعوة سابقاً', 410);
    if (row.status === 'expired') return err('انتهت صلاحية الدعوة. أعطيناك فرصة وتأخّرت عليها، وأخذها شخص محتاج لها.', 410);
    if (row.status === 'cancelled') return err('أُلغيت هذه الدعوة', 410);
    return ok({ ok: true, name: row.name, phone: row.phone, expires_at: row.expires_at });
  }

  // ─── INVITE REGISTER (public — تسجيل المدعو عبر رمز صالح)
  if (res === 'invite_register' && method === 'POST') {
    const d = await readBody(req);
    const token = trimStr(d.token);
    const username = trimStr(d.username);
    const password = typeof d.password === 'string' ? d.password : '';
    if (!token || !username || !password) return err('جميع الحقول مطلوبة', 400);
    if (password.length < 4) return err('كلمة المرور قصيرة', 400);
    const supabase = db();
    // اضبط المنتهية أوّلاً
    await supabase.from('invitations').update({ status: 'expired' })
      .eq('status', 'pending').lt('expires_at', new Date().toISOString());
    const { data: inv } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (!inv) return err('الرابط غير صحيح', 404);
    const row = inv as { id: number; name: string; phone: string; status: string; inviter_id: number };
    if (row.status !== 'pending') return err('الدعوة لم تعد صالحة', 410);
    const hashed = await hash(password, 10);
    // اربط المدعو بمن دعاه لتمكين الإشراف المحدود (تتبّع المواعيد + المحادثة)
    const baseUser: Record<string, unknown> = {
      name: row.name, username, phone: row.phone, password: hashed,
      role: 'reviewer', allowed_special: 0, status: 'active',
      invited_by: row.inviter_id,
    };
    let u, uErr;
    ({ data: u, error: uErr } = await supabase.from('users').insert(baseUser).select('id').single());
    if (uErr && /invited_by/i.test(uErr.message || '')) {
      delete baseUser.invited_by;
      ({ data: u, error: uErr } = await supabase.from('users').insert(baseUser).select('id').single());
    }
    if (uErr) return err('اسم المستخدم أو الجوال مكرر', 409);
    const newId = (u as { id: number }).id;
    await supabase.from('invitations').update({
      status: 'used',
      registered_at: new Date().toISOString(),
      new_user_id: newId,
    }).eq('id', row.id);
    const tk = generateToken(newId, 'reviewer');
    return ok({ ok: true, token: tk, user: { id: newId, name: row.name, phone: row.phone, role: 'reviewer' } });
  }

  // ─── INVITATIONS (إدارة الدعوات — لكل صاحب رصيد + المدير)
  if (res === 'invitations') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    // اضبط المنتهية تلقائياً قبل أي قراءة
    await supabase.from('invitations').update({ status: 'expired' })
      .eq('status', 'pending').lt('expires_at', new Date().toISOString());
    if (method === 'GET') {
      let q = supabase
        .from('invitations')
        .select('id,inviter_id,name,phone,token,status,invited_at,expires_at,registered_at')
        .order('invited_at', { ascending: false });
      if (a.role !== 'admin') q = q.eq('inviter_id', a.uid);
      const { data, error } = await q;
      if (error) return err('فشل القراءة: ' + error.message, 500);
      return ok(data ?? []);
    }
    if (method === 'POST') {
      const d = await readBody(req);
      const name = trimStr(d.name);
      const phone = trimStr(d.phone);
      if (!name || !phone) return err('الاسم والجوال مطلوبان', 400);
      // تحقّق من الرصيد + اسحب المدّة المخصّصة لهذا المرسل
      const { data: me } = await supabase
        .from('users').select('invite_quota,invite_used,invite_days').eq('id', a.uid).maybeSingle();
      const meRow = me as { invite_quota?: number; invite_used?: number; invite_days?: number } | null;
      const quota = +(meRow?.invite_quota ?? 0);
      const used  = +(meRow?.invite_used  ?? 0);
      const days  = Math.max(1, +(meRow?.invite_days ?? 5));
      if (quota - used <= 0) return err('انتهى رصيد الدعوات لديك', 403);
      // لا يمكن دعوة من هو مسجّل بالفعل
      const { data: existsUser } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
      if (existsUser) return err('هذا الجوال مسجّل في الموقع بالفعل', 409);
      // لا يمكن دعوة من سبق وأن دعوته (مهما كانت حالة الدعوة)
      const { data: existsInv } = await supabase.from('invitations').select('id,status').eq('phone', phone).maybeSingle();
      if (existsInv) {
        const st = (existsInv as { status: string }).status;
        if (st === 'pending') return err('سبق وأن أرسلت دعوة لهذا الجوال', 409);
        if (st === 'expired' || st === 'cancelled') return err('أعطيناه فرصة وتأخّر عليها، لا يمكن دعوته مرة أخرى', 409);
        if (st === 'used') return err('هذا الجوال استخدم دعوته بالفعل', 409);
      }
      const token = randomBytes(16).toString('hex');
      const now = new Date();
      const exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const { data: ins, error: insErr } = await supabase
        .from('invitations')
        .insert({
          inviter_id: a.uid,
          name, phone, token,
          status: 'pending',
          invited_at: now.toISOString(),
          expires_at: exp.toISOString(),
        })
        .select('id')
        .single();
      if (insErr) return err('فشل إنشاء الدعوة: ' + insErr.message, 500);
      // خصم من الرصيد
      await supabase.from('users').update({ invite_used: used + 1 }).eq('id', a.uid);
      return ok({ ok: true, id: (ins as { id: number }).id, token, expires_at: exp.toISOString() });
    }
    if (method === 'DELETE' && id) {
      // إلغاء دعوة (يستردّ الرصيد فقط لو لم تُستخدم)
      const { data: row } = await supabase.from('invitations').select('inviter_id,status').eq('id', num(id)).maybeSingle();
      if (!row) return err('الدعوة غير موجودة', 404);
      const r = row as { inviter_id: number; status: string };
      if (a.role !== 'admin' && r.inviter_id !== a.uid) return err('غير مصرّح', 403);
      if (r.status !== 'pending') return err('لا يمكن إلغاء دعوة منتهية أو مستخدمة', 400);
      await supabase.from('invitations').update({ status: 'cancelled' }).eq('id', num(id));
      // أعد الرصيد للمُرسل
      const { data: u } = await supabase.from('users').select('invite_used').eq('id', r.inviter_id).maybeSingle();
      const usedNow = +((u as { invite_used?: number } | null)?.invite_used ?? 0);
      if (usedNow > 0) await supabase.from('users').update({ invite_used: usedNow - 1 }).eq('id', r.inviter_id);
      return ok({ ok: true });
    }
  }

  // ─── MY INVITEES (لصاحب دور 'دعوات' — قائمة من دعاهم بحالاتهم) ──
  if (res === 'my_invitees' && method === 'GET') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    const { data: users, error } = await supabase
      .from('users')
      .select('id,name,phone,username,status,created_at,gender,age,residence')
      .eq('invited_by', a.uid)
      .order('created_at', { ascending: false });
    if (error) return err('فشل القراءة: ' + error.message, 500);
    const list = (users ?? []) as Array<Record<string, unknown>>;
    const ids = list.map((u) => u.id as number);
    // عدّاد المواعيد لكل مدعو
    const aptByRev: Record<number, { total: number; upcoming: number }> = {};
    if (ids.length) {
      const { data: apts } = await supabase
        .from('appointments')
        .select('id,reviewer_id,status,date')
        .in('reviewer_id', ids);
      const today = new Date().toISOString().slice(0, 10);
      (apts ?? []).forEach((apt: Record<string, unknown>) => {
        const rid = +(apt.reviewer_id as number);
        if (!aptByRev[rid]) aptByRev[rid] = { total: 0, upcoming: 0 };
        aptByRev[rid].total++;
        const st = apt.status as string;
        const dt = (apt.date as string) || '';
        if ((st === 'pending' || st === 'confirmed') && (!dt || dt >= today)) aptByRev[rid].upcoming++;
      });
    }
    return ok(list.map((u) => ({
      ...u,
      apt_total: aptByRev[+(u.id as number)]?.total ?? 0,
      apt_upcoming: aptByRev[+(u.id as number)]?.upcoming ?? 0,
    })));
  }

  // ─── ME ───────────────────────────────────────────────────────────
  if (res === 'me') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    // ترتيب التجربة: كامل (allow_chat + الحقول الشخصية + admin_perms) → الأوسط بدون admin_perms → بدون الحقول الشخصية → بدون allow_chat
    const wInv  = 'id,name,username,phone,role,allowed_special,allow_chat,status,gender,age,height,weight,occupation,residence,admin_perms,invite_quota,invite_used,invite_days,invited_by';
    const full  = 'id,name,username,phone,role,allowed_special,allow_chat,status,gender,age,height,weight,occupation,residence,admin_perms';
    const midp  = 'id,name,username,phone,role,allowed_special,allow_chat,status,gender,age,height,weight,occupation,residence';
    const midd  = 'id,name,username,phone,role,allowed_special,allow_chat,status';
    const base  = 'id,name,username,phone,role,allowed_special,status';
    let userRes = await supabase.from('users').select(wInv).eq('id', a.uid).single();
    if (userRes.error) userRes = await supabase.from('users').select(full).eq('id', a.uid).single();
    if (userRes.error) userRes = await supabase.from('users').select(midp).eq('id', a.uid).single();
    if (userRes.error) userRes = await supabase.from('users').select(midd).eq('id', a.uid).single();
    if (userRes.error) {
      userRes = await supabase.from('users').select(base).eq('id', a.uid).single();
    }
    const user = userRes.data as Record<string, unknown> | null;
    if (user && user.allow_chat === undefined) user.allow_chat = 1;
    if (!user) return err('not found', 404);
    return ok(user);
  }

  // ─── ME PROFILE (reviewer self-edit — restricted to profile fields) ─
  // Reviewers can update only their own demographic info. Cannot change
  // name/username/phone/role/status — those stay admin-controlled.
  if (res === 'me_profile') {
    if (method !== 'POST') return err('POST only', 405);
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const d = await readBody(req);
    const supabase = db();
    const patch: Record<string, unknown> = {};
    if (typeof d.gender === 'string' && (d.gender === 'male' || d.gender === 'female')) {
      patch.gender = d.gender;
    }
    for (const k of ['occupation', 'residence'] as const) {
      if (typeof d[k] === 'string') patch[k] = trimStr(d[k]);
    }
    for (const k of ['age', 'height', 'weight'] as const) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
        const n = num(d[k], 0);
        if (n > 0) patch[k] = n;
      }
    }
    if (!Object.keys(patch).length) return err('لا توجد بيانات للحفظ', 400);
    // نستخدم .select() لنتأكّد أن التحديث حصل فعلاً ولاسترجاع القيم المحفوظة
    const upd = await supabase.from('users')
      .update(patch).eq('id', a.uid)
      .select('id,gender,age,height,weight,occupation,residence')
      .single();
    if (upd.error) {
      return err('فشل الحفظ — تأكّد من تطبيق الترقيات في الإعدادات. ' + (upd.error.message || ''), 500);
    }
    if (!upd.data) {
      return err('لم يُحفظ شيء — ربما الأعمدة غير موجودة في DB. اضغط «تطبيق الترقيات».', 500);
    }
    return ok({ ok: true, profile: upd.data });
  }

  // ─── PRESENCE (admin-only — never exposed to reviewers) ──────────
  // Reviewers never get to see who's online, especially not the admin.
  if (res === 'presence') {
    if (method !== 'GET') return err('GET only', 405);
    const a = authFromHeader(auth, true);
    if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    const minutes = num(sp.get('minutes'), 5);
    const since = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000).toISOString();
    // Try with last_seen — fall back gracefully if column is missing.
    let online: Array<Record<string, unknown>> = [];
    try {
      const { data } = await supabase
        .from('users')
        .select('id,name,username,phone,role,last_seen')
        .gte('last_seen', since)
        .neq('status', 'banned')
        .order('last_seen', { ascending: false })
        .limit(100);
      online = (data ?? []) as Array<Record<string, unknown>>;
    } catch {
      online = [];
    }
    return ok(online);
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────
  if (res === 'settings') {
    const supabase = db();
    if (method === 'GET') {
      // private keys are only returned to authenticated admins; keys starting
      // with "_" are internal state (rate-limit timestamps) and are never exposed
      const { data: rows } = await supabase.from('settings').select('key_name,value');
      const out: Record<string, string> = {};
      (rows ?? []).forEach((r: { key_name: string; value: string }) => {
        out[r.key_name] = r.value;
      });
      return ok(out);
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'settings'))) return err('لا تملك صلاحية تعديل الإعدادات', 403);
      const d = await readBody(req);
      const rows = Object.entries(d).map(([key_name, value]) => ({ key_name, value: String(value) }));
      if (rows.length) {
        await supabase.from('settings').upsert(rows, { onConflict: 'key_name' });
      }
      return ok({ ok: true });
    }
  }

  // ─── USERS ────────────────────────────────────────────────────────
  if (res === 'users') {
    const supabase = db();
    if (method === 'GET') {
      const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
      const role = sp.get('role');
      const search = sp.get('search');
      // جرّب أولاً مع كل الأعمدة (بما في ذلك الجديدة للملف الشخصي + admin_perms).
      // لو DB قديمة، نُسقط الأعمدة الناقصة تدريجياً.
      const colsInv  = 'id,name,username,phone,role,allowed_special,allow_chat,status,created_at,gender,age,height,weight,occupation,residence,admin_perms,invite_quota,invite_used,invite_days,invited_by';
      const colsFull = 'id,name,username,phone,role,allowed_special,allow_chat,status,created_at,gender,age,height,weight,occupation,residence,admin_perms';
      const colsMidP = 'id,name,username,phone,role,allowed_special,allow_chat,status,created_at,gender,age,height,weight,occupation,residence';
      const colsMid  = 'id,name,username,phone,role,allowed_special,allow_chat,status,created_at';
      const colsBase = 'id,name,username,phone,role,allowed_special,status,created_at';
      async function fetchUsersWith(cols: string) {
        let q = supabase.from('users').select(cols as '*').order('role', { ascending: false }).order('name');
        if (role) q = q.eq('role', role);
        if (search) {
          const safe = search.replace(/[",.()*%\\]/g, ' ').trim();
          if (safe) q = q.or(`name.ilike.${pgrstQuote('%' + safe + '%')},username.ilike.${pgrstQuote('%' + safe + '%')},phone.ilike.${pgrstQuote('%' + safe + '%')}`);
        }
        return await q;
      }
      let result = await fetchUsersWith(colsInv);
      if (result.error) result = await fetchUsersWith(colsFull);
      if (result.error) result = await fetchUsersWith(colsMidP);
      if (result.error) result = await fetchUsersWith(colsMid);
      if (result.error) result = await fetchUsersWith(colsBase);
      const rows = (result.data ?? []) as Record<string, unknown>[];
      rows.forEach((r) => { if (r.allow_chat === undefined) r.allow_chat = 1; });
      return ok(rows);
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'users'))) return err('لا تملك صلاحية إدارة المستخدمين', 403);
      const d = await readBody(req);
      const name = trimStr(d.name), username = trimStr(d.username), phone = trimStr(d.phone);
      if (!name || !username || !phone) return err('البيانات ناقصة', 400);
      const pass = typeof d.password === 'string' && d.password ? d.password : String(Math.floor(1000 + Math.random() * 9000));
      const role = (d.role === 'admin' || d.role === 'reviewer' || d.role === 'inviter') ? d.role : 'reviewer';
      const allowed_special = num(d.allowed_special, 0);
      const allow_chat = d.allow_chat === undefined ? 1 : num(d.allow_chat, 1);
      const hashed = await hash(pass, 10);
      const baseInsert: Record<string, unknown> = { name, username, phone, password: hashed, role, allowed_special, allow_chat, status: 'active' };
      // إذا أُنشئ بدور "دعوات"، اعتبر الرصيد والمدّة (الافتراضي ٥ أيام)
      if (role === 'inviter') {
        if (d.invite_quota !== undefined) baseInsert.invite_quota = Math.max(0, num(d.invite_quota, 0));
        if (d.invite_days  !== undefined) baseInsert.invite_days  = Math.max(1, num(d.invite_days, 5));
      }
      // admin_perms valid only for admin role; tolerate missing column on old DBs
      if (role === 'admin' && typeof d.admin_perms === 'string') {
        const tryInsert = { ...baseInsert, admin_perms: d.admin_perms };
        const first = await supabase.from('users').insert(tryInsert).select('id').single();
        if (!first.error) return ok({ ok: true, id: first.data.id, generated_password: pass });
        if (!/admin_perms/i.test(first.error.message || '')) return err('مستخدم أو جوال مكرر', 409);
        // fall through to base insert
      }
      const { data, error } = await supabase.from('users').insert(baseInsert).select('id').single();
      if (error) return err('مستخدم أو جوال مكرر', 409);
      return ok({ ok: true, id: data.id, generated_password: pass });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'users'))) return err('لا تملك صلاحية إدارة المستخدمين', 403);
      const d = await readBody(req);
      const patch: Record<string, unknown> = {};
      for (const k of ['name', 'phone', 'username', 'role', 'status', 'gender', 'occupation', 'residence'] as const) {
        if (typeof d[k] === 'string' && d[k]) patch[k] = d[k];
      }
      if (d.allowed_special !== undefined) patch.allowed_special = num(d.allowed_special, 0);
      if (d.allow_chat !== undefined) patch.allow_chat = num(d.allow_chat, 1);
      // admin_perms: JSON string of array, set only when role is/will be 'admin'
      if (typeof d.admin_perms === 'string') patch.admin_perms = d.admin_perms;
      // رصيد الدعوات + مدّتها (المدير يضبط لأي مستخدم — خاصةً ذوي دور 'inviter')
      if (d.invite_quota !== undefined) patch.invite_quota = Math.max(0, num(d.invite_quota, 0));
      if (d.invite_days  !== undefined) patch.invite_days  = Math.max(1, num(d.invite_days, 5));
      // الحقول الرقمية للملف الشخصي — تقبل صفراً أو أرقام إيجابية
      for (const k of ['age', 'height', 'weight'] as const) {
        if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
          const n = num(d[k], 0);
          if (n > 0) patch[k] = n;
        }
      }
      if (typeof d.password === 'string' && d.password) patch.password = await hash(d.password, 10);
      if (Object.keys(patch).length) {
        // إذا كانت بعض الأعمدة الجديدة مفقودة في DB القديمة، أَسقط الواحد المُشار إليه وأعد المحاولة
        const colsToCheck = ['allow_chat', 'gender', 'age', 'height', 'weight', 'occupation', 'residence', 'admin_perms', 'invite_quota', 'invite_days'];
        const attemptPatch: Record<string, unknown> = { ...patch };
        let lastErr: string | null = null;
        for (let attempt = 0; attempt <= colsToCheck.length; attempt++) {
          if (!Object.keys(attemptPatch).length) { lastErr = null; break; }
          const r = await supabase.from('users').update(attemptPatch).eq('id', num(id));
          if (!r.error) { lastErr = null; break; }
          lastErr = r.error.message || 'unknown';
          // Find which missing column triggered this error and strip it
          const failedCol = colsToCheck.find(c => c in attemptPatch && new RegExp(c, 'i').test(lastErr || ''));
          if (!failedCol) break; // unknown error, stop retrying
          delete attemptPatch[failedCol];
        }
        if (lastErr) return err('فشل التحديث: ' + lastErr, 500);
      }
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'users'))) return err('لا تملك صلاحية إدارة المستخدمين', 403);
      await supabase.from('users').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── SECTIONS ─────────────────────────────────────────────────────
  if (res === 'sections') {
    const supabase = db();
    if (method === 'GET') {
      const { data } = await supabase.from('sections').select('*').order('sort_order').order('id');
      return ok(data ?? []);
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الأقسام', 403);
      const d = await readBody(req);
      const name = trimStr(d.name);
      if (!name) return err('الاسم مطلوب', 400);
      const { data } = await supabase
        .from('sections')
        .insert({ name, description: trimStr(d.description), sort_order: num(d.sort_order, 0), active: num(d.active, 1) })
        .select('id').single();
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الأقسام', 403);
      const d = await readBody(req);
      const name = trimStr(d.name);
      if (!name) return err('الاسم مطلوب', 400);
      await supabase.from('sections').update({
        name, description: trimStr(d.description), sort_order: num(d.sort_order, 0), active: num(d.active, 1),
      }).eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الأقسام', 403);
      await supabase.from('sections').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── FORMS ────────────────────────────────────────────────────────
  if (res === 'forms') {
    const supabase = db();
    if (method === 'GET') {
      if (id) {
        const { data: form } = await supabase.from('forms').select('*,sections(name)').eq('id', num(id)).single();
        if (!form) return err('not found', 404);
        const { data: fields } = await supabase.from('form_fields').select('*').eq('form_id', num(id)).order('sort_order').order('id');
        const parsedFields = (fields ?? []).map((f: Record<string, unknown>) => {
          if (typeof f.options === 'string' && f.options) {
            try { f.options = JSON.parse(f.options); } catch { /* keep as string */ }
          }
          return f;
        });
        const section = (form as { sections?: { name: string } }).sections;
        return ok({ ...form, section_name: section?.name, fields: parsedFields });
      }
      const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
      if (a.role === 'reviewer') {
        const { data: assignedRows } = await supabase.from('form_assignments').select('form_id').eq('user_id', a.uid);
        const formIds = (assignedRows ?? []).map((r: { form_id: number }) => r.form_id);
        if (!formIds.length) return ok([]);
        const { data } = await supabase.from('forms').select('*,sections(name)').eq('status', 'active').in('id', formIds).order('id', { ascending: false });
        return ok((data ?? []).map((f: Record<string, unknown>) => ({ ...f, section_name: (f as { sections?: { name: string } }).sections?.name })));
      }
      const { data } = await supabase.from('forms').select('*,sections(name)').order('id', { ascending: false });
      return ok((data ?? []).map((f: Record<string, unknown>) => ({ ...f, section_name: (f as { sections?: { name: string } }).sections?.name })));
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الاستمارات', 403);
      const d = await readBody(req);
      const title = trimStr(d.title);
      if (!title) return err('العنوان مطلوب', 400);
      // Duplicate flow: copy fields from an existing form, never publish copies by default
      if (d.duplicate_from) {
        const sourceId = num(d.duplicate_from);
        const { data: source } = await supabase.from('forms').select('*').eq('id', sourceId).single();
        if (!source) return err('الاستمارة المصدر غير موجودة', 404);
        const { data: newForm } = await supabase.from('forms').insert({
          section_id: source.section_id,
          title,
          subtitle: source.subtitle || '',
          status: 'draft',
        }).select('id').single();
        if (!newForm) return err('فشل إنشاء النسخة', 500);
        const { data: fields } = await supabase.from('form_fields').select('*').eq('form_id', sourceId).order('sort_order').order('id');
        if (fields && fields.length) {
          const newFields = fields.map((f: Record<string, unknown>) => {
            const copy: Record<string, unknown> = { ...f };
            delete copy.id;
            copy.form_id = newForm.id;
            return copy;
          });
          await supabase.from('form_fields').insert(newFields);
        }
        return ok({ ok: true, id: newForm.id, duplicated: true });
      }
      const { data } = await supabase.from('forms').insert({
        section_id: d.section_id ? num(d.section_id) : null,
        title, subtitle: trimStr(d.subtitle), status: d.status === 'active' ? 'active' : 'draft',
      }).select('id').single();
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الاستمارات', 403);
      const d = await readBody(req);
      await supabase.from('forms').update({
        section_id: d.section_id ? num(d.section_id) : null,
        title: trimStr(d.title), subtitle: trimStr(d.subtitle),
        status: d.status === 'active' ? 'active' : 'draft',
      }).eq('id', num(id));
      if (Array.isArray(d.fields)) {
        await supabase.from('form_fields').delete().eq('form_id', num(id));
        const rows = d.fields.map((ff: Record<string, unknown>, i: number) => ({
          form_id: num(id),
          label: trimStr(ff.label),
          placeholder: trimStr(ff.placeholder),
          field_type: typeof ff.field_type === 'string' ? ff.field_type : 'text',
          required: num(ff.required, 0),
          sort_order: ff.sort_order !== undefined ? num(ff.sort_order) : i,
          category: typeof ff.category === 'string' ? ff.category : 'عام',
          conditional_field: typeof ff.conditional_field === 'string' ? ff.conditional_field : null,
          conditional_value: typeof ff.conditional_value === 'string' ? ff.conditional_value : null,
          options: Array.isArray(ff.options) ? JSON.stringify(ff.options) : null,
        }));
        if (rows.length) await supabase.from('form_fields').insert(rows);
      }
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'sections'))) return err('لا تملك صلاحية إدارة الاستمارات', 403);
      await supabase.from('forms').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── ASSIGNMENTS ──────────────────────────────────────────────────
  if (res === 'assignments') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      if (a.role === 'admin') {
        const { data } = await supabase.from('form_assignments').select('*,users(name),forms(title)').order('id', { ascending: false });
        return ok((data ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          user_name: (r as { users?: { name: string } }).users?.name,
          form_title: (r as { forms?: { title: string } }).forms?.title,
        })));
      }
      const { data } = await supabase.from('form_assignments')
        .select('*,forms!inner(title,status,sections(name))')
        .eq('user_id', a.uid).eq('forms.status', 'active');
      return ok((data ?? []).map((r: Record<string, unknown>) => {
        const f = (r as { forms?: { title: string; status: string; sections?: { name: string } } }).forms;
        return { ...r, form_title: f?.title, form_status: f?.status, section_name: f?.sections?.name };
      }));
    }
    if (method === 'POST') {
      if (a.role !== 'admin') return err('للمدير فقط', 403);
      if (!(await ensureAdminPerm(supabase, a.uid, 'assign'))) return err('لا تملك صلاحية ترشيح الاستمارات', 403);
      const d = await readBody(req);
      const form_id = num(d.form_id), user_id = num(d.user_id);
      if (!form_id || !user_id) return err('بيانات ناقصة', 400);
      // Block if the reviewer still has an active form_assignment OR a
      // submission that hasn't been archived yet.
      const [{ count: assignCount }, { count: subCount }] = await Promise.all([
        supabase.from('form_assignments').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
        supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('reviewer_id', user_id).neq('status', 'archived'),
      ]);
      if ((assignCount ?? 0) > 0 || (subCount ?? 0) > 0) {
        return err('المراجع لديه استمارة لم تُؤرشَف. أرشف السابقة أولاً قبل ترشيح استمارة جديدة.', 409);
      }
      const { data, error } = await supabase.from('form_assignments').insert({ form_id, user_id }).select('id').single();
      if (error) return err('مرشح مسبقاً', 409);
      return ok({ ok: true, id: data.id });
    }
    if (method === 'DELETE') {
      if (a.role !== 'admin') return err('للمدير فقط', 403);
      if (!(await ensureAdminPerm(supabase, a.uid, 'assign'))) return err('لا تملك صلاحية ترشيح الاستمارات', 403);
      const d = await readBody(req);
      await supabase.from('form_assignments').delete()
        .eq('form_id', num(d.form_id)).eq('user_id', num(d.user_id));
      return ok({ ok: true });
    }
  }

  // ─── SUBMISSIONS ──────────────────────────────────────────────────
  if (res === 'submissions') {
    const supabase = db();
    if (method === 'GET') {
      const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
      if (id) {
        const { data: sub } = await supabase.from('submissions')
          .select('*,forms(title),users(name)')
          .eq('id', num(id)).single();
        if (!sub) return err('not found', 404);
        // Reviewers can only fetch their own submissions; otherwise they could
        // walk through other reviewers' records by guessing the id.
        if (a.role === 'reviewer' && (sub as { reviewer_id?: number }).reviewer_id !== a.uid) {
          return err('غير مصرح', 403);
        }
        const out: Record<string, unknown> = { ...sub };
        out.form_title = (sub as { forms?: { title: string } }).forms?.title;
        out.reviewer_name = (sub as { users?: { name: string } }).users?.name;
        if (a.role === 'reviewer') delete out.internal_notes;
        const { data: answers } = await supabase.from('submission_answers')
          .select('*,form_fields(label,field_type)')
          .eq('submission_id', num(id));
        out.answers = (answers ?? []).map((ans: Record<string, unknown>) => ({
          ...ans,
          label: (ans as { form_fields?: { label: string } }).form_fields?.label,
          field_type: (ans as { form_fields?: { field_type: string } }).form_fields?.field_type,
        }));
        return ok(out);
      }
      // مسودة المراجع لهذه الاستمارة — يستخدمها الفرونت لاستئناف التعبئة
      const draftFormId = sp.get('draft_form_id');
      if (draftFormId && a.role === 'reviewer') {
        const { data: draft } = await supabase.from('submissions')
          .select('id').eq('form_id', num(draftFormId)).eq('reviewer_id', a.uid)
          .eq('status', 'draft').maybeSingle();
        if (!draft) return ok({ draft: null });
        const { data: answers } = await supabase.from('submission_answers')
          .select('field_id,answer').eq('submission_id', draft.id);
        return ok({ draft: { id: draft.id, answers: answers ?? [] } });
      }
      let q = supabase.from('submissions').select('*,forms(title),users(name,phone)').order('created_at', { ascending: false }).neq('status', 'archived').neq('status', 'draft');
      if (a.role === 'reviewer') q = q.eq('reviewer_id', a.uid);
      const status = sp.get('status');
      if (status) q = q.eq('status', status);
      const { data } = await q;
      return ok((data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        form_title: (r as { forms?: { title: string } }).forms?.title,
        reviewer_name: (r as { users?: { name: string } }).users?.name,
        reviewer_phone: (r as { users?: { phone: string } }).users?.phone,
      })));
    }
    if (method === 'POST') {
      const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
      const d = await readBody(req);
      const formId = num(d.form_id);
      const asDraft = d.draft === true || d.draft === 'true' || d.draft === 1;
      if (!formId) return err('form_id مطلوب', 400);
      // ابحث عن مسوّدة موجودة لهذا (المراجع + الاستمارة)
      const { data: existing } = await supabase.from('submissions')
        .select('id,status').eq('form_id', formId).eq('reviewer_id', a.uid)
        .eq('status', 'draft').maybeSingle();
      let sid: number;
      if (existing) {
        sid = (existing as { id: number }).id;
        // إذا الإرسال نهائي، انقل الحالة لـ pending وحدّث وقت الإنشاء
        if (!asDraft) {
          await supabase.from('submissions').update({
            status: 'pending', created_at: new Date().toISOString(),
          }).eq('id', sid);
        }
        await supabase.from('submission_answers').delete().eq('submission_id', sid);
      } else {
        const { data: sub } = await supabase.from('submissions')
          .insert({ form_id: formId, reviewer_id: a.uid, status: asDraft ? 'draft' : 'pending' })
          .select('id').single();
        sid = (sub as { id: number })?.id;
      }
      if (sid && Array.isArray(d.answers) && d.answers.length) {
        const rows = d.answers.map((a2: Record<string, unknown>) => ({
          submission_id: sid,
          field_id: a2.field_id ? num(a2.field_id) : null,
          answer: typeof a2.answer === 'string' ? a2.answer : String(a2.answer ?? ''),
        }));
        await supabase.from('submission_answers').insert(rows);
      }
      return ok({ ok: true, id: sid, draft: asDraft });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      const d = await readBody(req);
      const patch: Record<string, unknown> = {};
      const allowedStatuses = ['draft', 'pending', 'reviewing', 'done', 'rejected', 'archived'];
      if (typeof d.status === 'string' && allowedStatuses.includes(d.status)) {
        patch.status = d.status;
      }
      if ('internal_notes' in d) patch.internal_notes = typeof d.internal_notes === 'string' ? d.internal_notes : '';
      if ('reviewer_notes' in d) patch.reviewer_notes = typeof d.reviewer_notes === 'string' ? d.reviewer_notes : '';
      if ('highlights' in d) patch.highlighted_answers = d.highlights;
      if (Object.keys(patch).length) await supabase.from('submissions').update(patch).eq('id', num(id));
      // When the submission is archived, free up the reviewer by removing
      // the matching form_assignment row so a new form can be nominated.
      if (patch.status === 'archived') {
        const { data: sub } = await supabase.from('submissions').select('form_id,reviewer_id').eq('id', num(id)).single();
        if (sub?.form_id && sub?.reviewer_id) {
          await supabase.from('form_assignments').delete()
            .eq('form_id', sub.form_id).eq('user_id', sub.reviewer_id);
        }
      }
      return ok({ ok: true });
    }
  }

  // ─── SLOTS ────────────────────────────────────────────────────────
  if (res === 'slots') {
    const supabase = db();
    if (method === 'GET') {
      const { data } = await supabase.from('slots').select('*').order('sort_order').order('id');
      return ok(data ?? []);
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      const d = await readBody(req);
      if (!d.name) return err('الاسم مطلوب', 400);
      const { data } = await supabase.from('slots').insert({
        name: String(d.name),
        time_from: d.time_from || null,
        time_to: d.time_to || null,
        status: d.status === 'open' ? 'open' : 'closed',
        sort_order: num(d.sort_order, 0),
      }).select('id').single();
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      const d = await readBody(req);
      const patch: Record<string, unknown> = {};
      for (const k of ['name', 'time_from', 'time_to', 'status', 'sort_order'] as const) {
        if (k in d) patch[k] = d[k];
      }
      if (Object.keys(patch).length) await supabase.from('slots').update(patch).eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      await supabase.from('slots').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── DATES (appointment_dates) ────────────────────────────────────
  if (res === 'dates') {
    const supabase = db();
    if (method === 'GET') {
      const { data } = await supabase.from('appointment_dates').select('*,slots(name,time_from,time_to,sort_order)').order('date');
      return ok((data ?? []).map((r: Record<string, unknown>) => {
        const s = (r as { slots?: { name: string; time_from: string; time_to: string } }).slots;
        return { ...r, slot_name: s?.name, time_from: s?.time_from, time_to: s?.time_to };
      }));
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      const d = await readBody(req);
      const slot_id = num(d.slot_id);
      const status = d.status === 'locked' ? 'locked' : 'available';
      if (!slot_id) return err('slot_id مطلوب', 400);
      if (Array.isArray(d.dates) && d.dates.length) {
        // نظّف ووحّد قائمة التواريخ
        const wantDates = Array.from(new Set(
          d.dates.map((x: unknown) => String(x ?? '').trim()).filter(Boolean),
        )) as string[];
        if (!wantDates.length) return err('لا توجد تواريخ صالحة', 400);
        // لا نعتمد على ON CONFLICT (القيد الفريد قد لا يكون موجوداً في DB).
        // نجلب الموجود لنفس الفترة ضمن هذه التواريخ، ثم نُدرج الناقص فقط.
        const { data: existing, error: exErr } = await supabase
          .from('appointment_dates')
          .select('date')
          .eq('slot_id', slot_id)
          .in('date', wantDates);
        if (exErr) return err('فشل قراءة المواعيد الحالية: ' + exErr.message, 500);
        const existSet = new Set((existing ?? []).map((r: { date: string }) => String(r.date).slice(0, 10)));
        const toInsert = wantDates
          .filter((dt) => !existSet.has(dt.slice(0, 10)))
          .map((dt) => ({ slot_id, date: dt, status }));
        let inserted = 0;
        if (toInsert.length) {
          const { error: insErr } = await supabase.from('appointment_dates').insert(toInsert);
          if (insErr) return err('فشل حفظ المواعيد: ' + insErr.message, 500);
          inserted = toInsert.length;
        }
        // التواريخ الموجودة مسبقاً: حدّث حالتها لتطابق المطلوب (متاح/محجوب)
        if (existSet.size) {
          await supabase.from('appointment_dates')
            .update({ status })
            .eq('slot_id', slot_id)
            .in('date', Array.from(existSet));
        }
        return ok({ ok: true, inserted, updated: existSet.size, total: wantDates.length });
      }
      const { data, error } = await supabase.from('appointment_dates').insert({
        slot_id, date: String(d.date ?? ''), status,
      }).select('id').single();
      if (error) return err('فشل الحفظ: ' + error.message, 500);
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      const d = await readBody(req);
      await supabase.from('appointment_dates').update({ status: d.status }).eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      await supabase.from('appointment_dates').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── APPOINTMENTS ─────────────────────────────────────────────────
  if (res === 'appointments') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      let q = supabase.from('appointments')
        .select('*,users(name,phone),appointment_dates(date,slots(name,time_from,time_to))')
        .order('created_at', { ascending: false });
      if (a.role === 'reviewer') q = q.eq('reviewer_id', a.uid);
      // صاحب دور 'دعوات' يرى مواعيد مدعوّيه (إشراف متابعة فقط)
      if (a.role === 'inviter') {
        const { data: invitees } = await supabase.from('users').select('id').eq('invited_by', a.uid);
        const ids = (invitees ?? []).map((u: { id: number }) => u.id);
        if (!ids.length) return ok([]);
        q = q.in('reviewer_id', ids);
      }
      const { data } = await q;
      return ok((data ?? []).map((r: Record<string, unknown>) => {
        const dt = (r as { appointment_dates?: { date: string; slots?: { name: string; time_from: string; time_to: string } } }).appointment_dates;
        const u2 = (r as { users?: { name: string; phone: string } }).users;
        return {
          ...r,
          reviewer_name: u2?.name, phone: u2?.phone,
          date: dt?.date, slot_name: dt?.slots?.name,
          time_from: dt?.slots?.time_from, time_to: dt?.slots?.time_to,
        };
      }));
    }
    if (method === 'POST') {
      const d = await readBody(req);
      // Admin booking on behalf of someone (exceptional booking) requires 'appts' perm.
      if (a.role === 'admin' && d.reviewer_id) {
        if (!(await ensureAdminPerm(supabase, a.uid, 'appts'))) return err('لا تملك صلاحية إدارة المواعيد', 403);
      }
      const rid = (a.role !== 'reviewer' && d.reviewer_id) ? num(d.reviewer_id) : a.uid;
      const status = (a.role !== 'reviewer' && d.status) ? String(d.status) : 'pending';
      if (a.role === 'reviewer') {
        const { data: exist } = await supabase.from('appointments').select('id').eq('reviewer_id', rid).in('status', ['pending', 'confirmed']).limit(1);
        if (exist && exist.length) return err('لديك موعد نشط', 409);
      }
      const { data: apt } = await supabase.from('appointments').insert({
        reviewer_id: rid, date_id: d.date_id ? num(d.date_id) : null, status, notes: trimStr(d.notes),
      }).select('id').single();
      if (d.date_id) await supabase.from('appointment_dates').update({ status: 'locked' }).eq('id', num(d.date_id));
      return ok({ ok: true, id: apt?.id });
    }
    if (method === 'PUT' && id) {
      const d = await readBody(req);
      const ns = typeof d.status === 'string' ? d.status : '';
      if (a.role === 'reviewer' && ns && ns !== 'cancelled_reviewer') return err('غير مصرح', 403);
      // Admin actions on appointments require 'appts' perm.
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'appts'))) {
        return err('لا تملك صلاحية إدارة المواعيد', 403);
      }
      const patch: Record<string, unknown> = {};
      if (ns) patch.status = ns;
      if ('notes' in d) patch.notes = d.notes;
      if (Object.keys(patch).length) await supabase.from('appointments').update(patch).eq('id', num(id));
      if (ns === 'cancelled_admin' || ns === 'cancelled_reviewer') {
        const { data: r2 } = await supabase.from('appointments').select('date_id').eq('id', num(id)).single();
        if (r2?.date_id) await supabase.from('appointment_dates').update({ status: 'available' }).eq('id', r2.date_id);
      }
      return ok({ ok: true });
    }
  }

  // ─── THREADS ──────────────────────────────────────────────────────
  if (res === 'threads') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    // Look up caller's own allow_chat — if it's 0, chat surface is disabled.
    const { data: meRow } = await supabase.from('users').select('allow_chat').eq('id', a.uid).maybeSingle();
    const myAllowChat = !meRow || (meRow as { allow_chat?: number }).allow_chat !== 0;
    // مساعد: enriche قائمة threads بأحدث رسالة + غير المقروء + اسم الطرف الآخر
    async function enrichThreads(rawThreads: Array<Record<string, unknown>>, mySide: 'admin' | 'reviewer'): Promise<Array<Record<string, unknown>>> {
      const tids = rawThreads.map((t) => t.id as number);
      type MsgRow = { id: number; thread_id: number; body: string; created_at: string; is_read: number; from_id: number };
      const lastByThread = new Map<number, MsgRow>();
      const unreadByThread = new Map<number, number>();
      if (tids.length) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id,thread_id,body,created_at,is_read,from_id')
          .in('thread_id', tids)
          .order('created_at', { ascending: false })
          .limit(2000);
        for (const m of (msgs ?? []) as MsgRow[]) {
          if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
          const t = rawThreads.find((x) => x.id === m.thread_id) as { reviewer_id?: number; admin_id?: number } | undefined;
          if (!t) continue;
          const otherUid = mySide === 'admin' ? t.reviewer_id : t.admin_id;
          if (m.is_read === 0 && m.from_id === otherUid) {
            unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
          }
        }
      }
      return rawThreads.map((t) => {
        const userJoin = (t as { users?: { name?: string; phone?: string } }).users;
        const last = lastByThread.get(t.id as number);
        const tt = t as { admin_id?: number; reviewer_id?: number };
        const otherUid = mySide === 'admin' ? tt.reviewer_id : tt.admin_id;
        return {
          ...t,
          name: userJoin?.name,
          admin_name: mySide === 'reviewer' ? userJoin?.name : undefined,
          reviewer_name: mySide === 'admin' ? userJoin?.name : undefined,
          reviewer_phone: mySide === 'admin' ? userJoin?.phone : undefined,
          other_side: mySide === 'admin' ? 'reviewer' : 'admin',
          other_uid: otherUid,
          last_msg: last?.body,
          last_time: last?.created_at,
          unread: unreadByThread.get(t.id as number) ?? 0,
        };
      });
    }

    if (method === 'GET' && !id) {
      if (!myAllowChat) return ok([]);
      // صاحب دور 'دعوات': يدمج طرفين — مع الإدارة (reviewer side) + مع مدعوّيه (admin side)
      if (a.role === 'inviter') {
        // 1) محادثاتي مع الإدارة (أنا = reviewer_id)
        let asReviewerRes = await supabase
          .from('threads')
          .select('*,users!threads_admin_id_fkey(name,phone,allow_chat)')
          .eq('reviewer_id', a.uid)
          .eq('status', 'active');
        if (asReviewerRes.error) {
          asReviewerRes = await supabase
            .from('threads')
            .select('*,users!threads_admin_id_fkey(name,phone)')
            .eq('reviewer_id', a.uid)
            .eq('status', 'active');
        }
        // 2) محادثاتي مع مدعوّيي (أنا = admin_id، الطرف الآخر مدعوٌّ لي)
        const { data: invitees } = await supabase.from('users').select('id').eq('invited_by', a.uid);
        const inviteeIds = (invitees ?? []).map((u: { id: number }) => u.id);
        let asAdminRes: { data: Array<Record<string, unknown>> | null; error: unknown } = { data: [], error: null };
        if (inviteeIds.length) {
          let r = await supabase
            .from('threads')
            .select('*,users!threads_reviewer_id_fkey(name,phone,allow_chat)')
            .eq('admin_id', a.uid)
            .in('reviewer_id', inviteeIds)
            .eq('status', 'active');
          if (r.error) {
            r = await supabase
              .from('threads')
              .select('*,users!threads_reviewer_id_fkey(name,phone)')
              .eq('admin_id', a.uid)
              .in('reviewer_id', inviteeIds)
              .eq('status', 'active');
          }
          asAdminRes = r;
        }
        const reviewerSide = (asReviewerRes.data ?? []).filter((t: Record<string, unknown>) => {
          const u = (t as { users?: { allow_chat?: number } }).users;
          return !u || u.allow_chat !== 0;
        });
        const adminSide = (asAdminRes.data ?? []).filter((t: Record<string, unknown>) => {
          const u = (t as { users?: { allow_chat?: number } }).users;
          return !u || u.allow_chat !== 0;
        });
        const enrichedRev = await enrichThreads(reviewerSide, 'reviewer');
        const enrichedAdm = await enrichThreads(adminSide, 'admin');
        const combined = [...enrichedRev, ...enrichedAdm];
        combined.sort((x, y) => ((y.last_time as string) ?? '').localeCompare((x.last_time as string) ?? ''));
        return ok(combined);
      }
      if (a.role === 'admin') {
        // جرّب الـ select مع allow_chat، ولو فشل (العمود ناقص) أعد المحاولة بدونه
        let threadsRes = await supabase
          .from('threads')
          .select('*,users!threads_reviewer_id_fkey(name,phone,allow_chat)')
          .eq('status', 'active')
          .eq('admin_id', a.uid);
        if (threadsRes.error) {
          threadsRes = await supabase
            .from('threads')
            .select('*,users!threads_reviewer_id_fkey(name,phone)')
            .eq('status', 'active')
            .eq('admin_id', a.uid);
        }
        const threads = threadsRes.data ?? [];
        // Drop threads where the reviewer side has chat blocked
        const visible = (threads ?? []).filter((t: Record<string, unknown>) => {
          const r = (t as { users?: { allow_chat?: number } }).users;
          return !r || r.allow_chat !== 0;
        });
        // N+1 fix: استعلامين فقط بدل 2N استعلام —
        // اجلب كل الرسائل لكل الـ threads دفعة واحدة، ثم احسب آخر رسالة وعدد غير المقروء في JS.
        const tids = visible.map((t: Record<string, unknown>) => t.id as number);
        type MsgRow = { id: number; thread_id: number; body: string; created_at: string; is_read: number; from_id: number };
        const lastByThread = new Map<number, MsgRow>();
        const unreadByThread = new Map<number, number>();
        if (tids.length) {
          const { data: msgs } = await supabase
            .from('messages')
            .select('id,thread_id,body,created_at,is_read,from_id')
            .in('thread_id', tids)
            .order('created_at', { ascending: false })
            .limit(2000);
          for (const m of (msgs ?? []) as MsgRow[]) {
            if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
            // عدّ غير المقروءة الواردة من المراجع (للمدير الحالي)
            const t = visible.find((x: Record<string, unknown>) => x.id === m.thread_id) as { reviewer_id?: number } | undefined;
            if (t && m.is_read === 0 && m.from_id === t.reviewer_id) {
              unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
            }
          }
        }
        const enriched = visible.map((t: Record<string, unknown>) => {
          const reviewer = (t as { users?: { name: string; phone: string } }).users;
          const last = lastByThread.get(t.id as number);
          return {
            ...t,
            reviewer_name: reviewer?.name,
            reviewer_phone: reviewer?.phone,
            last_msg: last?.body,
            last_time: last?.created_at,
            unread: unreadByThread.get(t.id as number) ?? 0,
          };
        });
        enriched.sort((a, b) => (b.last_time as string ?? '').localeCompare((a.last_time as string ?? '')));
        return ok(enriched);
      }
      // Reviewer view: only admins who have chat allowed
      let revThreadRes = await supabase.from('threads').select('*,users!threads_admin_id_fkey(name,allow_chat)').eq('reviewer_id', a.uid).eq('status', 'active').order('created_at', { ascending: false });
      if (revThreadRes.error) {
        revThreadRes = await supabase.from('threads').select('*,users!threads_admin_id_fkey(name)').eq('reviewer_id', a.uid).eq('status', 'active').order('created_at', { ascending: false });
      }
      const data = revThreadRes.data ?? [];
      const visible = (data ?? []).filter((t: Record<string, unknown>) => {
        const u = (t as { users?: { allow_chat?: number } }).users;
        return !u || u.allow_chat !== 0;
      });
      return ok(visible.map((t: Record<string, unknown>) => ({ ...t, admin_name: (t as { users?: { name: string } }).users?.name })));
    }
    if (method === 'GET' && id) {
      const tid = num(id);
      // Verify caller is a participant of this thread before exposing the
      // message history.
      const { data: thread } = await supabase.from('threads').select('reviewer_id,admin_id').eq('id', tid).single();
      if (!thread) return err('not found', 404);
      const th = thread as { admin_id: number; reviewer_id: number };
      const isParticipant =
        (a.role === 'admin' && th.admin_id === a.uid) ||
        (a.role === 'reviewer' && th.reviewer_id === a.uid) ||
        (a.role === 'inviter' && (th.admin_id === a.uid || th.reviewer_id === a.uid));
      if (!isParticipant) return err('غير مصرح', 403);

      const after = num(sp.get('after'));
      const longPoll = sp.get('long_poll') === '1';

      async function fetchNew() {
        return await supabase
          .from('messages')
          .select('*,users!messages_from_id_fkey(name)')
          .eq('thread_id', tid)
          .gt('id', after)
          .order('created_at', { ascending: true })
          .limit(100);
      }

      if (after > 0) {
        let res = await fetchNew();
        // long polling: لو لا توجد رسائل جديدة، انتظر حتى ٨ ثواني للحصول على رسالة
        // من الطرف الآخر. هذا يجعل المحادثة فورية مثل واتساب ويُبقي الـ function ساخنة.
        if (longPoll && (!res.data || !res.data.length)) {
          // ٧ ثوانٍ ينتظر فيها السيرفر رسالة جديدة. Vercel maxDuration = 10 ثوانٍ
          // (يترك متّسعاً لـ cold start و إرسال الردّ بأمان).
          const deadline = Date.now() + 7000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            res = await fetchNew();
            if (res.data && res.data.length) break;
          }
        }
        // علِّم رسائل الطرف الآخر كمقروءة عند استقبالها
        if (res.data && res.data.length) {
          await supabase.from('messages').update({ is_read: 1 }).eq('thread_id', tid).eq('to_id', a.uid);
        }
        // ✓✓ في الوقت الفعلي — أعلى id من رسائلي قرأها الطرف الآخر،
        // فالواجهة تستطيع تحديث علامات القراءة دون إعادة جلب كامل.
        const { data: lastRead } = await supabase
          .from('messages')
          .select('id')
          .eq('thread_id', tid)
          .eq('from_id', a.uid)
          .eq('is_read', 1)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        const readUpTo = (lastRead as { id?: number } | null)?.id || 0;
        return ok({
          messages: (res.data ?? []).map((m: Record<string, unknown>) => ({ ...m, from_name: (m as { users?: { name: string } }).users?.name })),
          read_up_to: readUpTo,
        });
      }

      // التحميل الأوّلي: جلب آخر ٣٠٠ رسالة
      const { data: msgs } = await supabase
        .from('messages')
        .select('*,users!messages_from_id_fkey(name)')
        .eq('thread_id', tid)
        .order('created_at', { ascending: true })
        .limit(300);
      // علّم كل الرسائل غير المقروءة من الطرف الآخر — ليس فقط في هذا الـ thread.
      // هذا يمنع بقاء العداد الأحمر «1» في قائمة المحادثات بسبب رسائل قديمة
      // في threads مؤرشفة أو بدون thread_id (legacy direct messages).
      const t = thread as { reviewer_id: number; admin_id: number };
      const otherUid =
        (a.role === 'admin') ? t.reviewer_id :
        (a.role === 'inviter' && t.admin_id === a.uid) ? t.reviewer_id :
        t.admin_id;
      await supabase
        .from('messages')
        .update({ is_read: 1 })
        .eq('to_id', a.uid)
        .eq('from_id', otherUid)
        .eq('is_read', 0);
      return ok({ messages: (msgs ?? []).map((m: Record<string, unknown>) => ({ ...m, from_name: (m as { users?: { name: string } }).users?.name })), unread: 0 });
    }
    if ((method === 'POST' || method === 'PUT') && id === 'transfer') {
      if (a.role !== 'admin') return err('للمدير فقط', 403);
      if (!(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      const d = await readBody(req);
      const tid = num(d.thread_id);
      const newAdminId = num(d.new_admin_id);
      if (!tid || !newAdminId) return err('thread_id و new_admin_id مطلوبين', 400);
      const { data: target } = await supabase.from('users').select('id,name,role,status').eq('id', newAdminId).single();
      if (!target || target.role !== 'admin' || target.status === 'banned') {
        return err('المدير المستلم غير صالح', 400);
      }
      const { data: thread } = await supabase.from('threads').select('id,reviewer_id,admin_id').eq('id', tid).single();
      if (!thread) return err('المحادثة غير موجودة', 404);
      await supabase.from('threads').update({ admin_id: newAdminId }).eq('id', tid);
      await supabase.from('messages').update({ to_id: newAdminId }).eq('thread_id', tid).eq('to_id', thread.admin_id);
      await supabase.from('messages').update({ from_id: newAdminId }).eq('thread_id', tid).eq('from_id', thread.admin_id);
      await supabase.from('messages').insert({
        from_id: newAdminId, to_id: thread.reviewer_id, thread_id: tid,
        body: `📢 تم تحويل المحادثة إلى ${target.name}. سيتابع معك قريباً.`,
        is_read: 0,
      });
      return ok({ ok: true, new_admin_name: target.name });
    }
    if (method === 'POST') {
      const d = await readBody(req);
      const title = trimStr(d.title) || 'محادثة جديدة';
      let rid: number;
      let adminId: number;
      if (a.role === 'admin') {
        if (!(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
        rid = num(d.reviewer_id);
        if (!rid) return err('reviewer_id مطلوب', 400);
        adminId = a.uid;
      } else if (a.role === 'inviter' && d.reviewer_id) {
        // المدعي يبدأ محادثة مع أحد مدعوّيه (يلعب دور admin_id في الـ thread)
        rid = num(d.reviewer_id);
        const { data: rev } = await supabase
          .from('users')
          .select('id,invited_by,allow_chat,status')
          .eq('id', rid)
          .maybeSingle();
        const r = rev as { id?: number; invited_by?: number; allow_chat?: number; status?: string } | null;
        if (!r || +(r.invited_by ?? 0) !== a.uid) return err('لا يمكن بدء محادثة إلا مع من دعوتهم', 403);
        if (r.status === 'banned') return err('المستخدم محظور', 403);
        if (r.allow_chat === 0) return err('محادثات هذا المستخدم معطّلة', 403);
        adminId = a.uid;
      } else {
        // المراجع يبدأ محادثة جديدة مع مدير محدّد
        rid = a.uid;
        adminId = num(d.admin_id);
        // توافق رجعي: لو واجهة قديمة لم تُرسل admin_id (كانت تُرسل reviewer_id فقط)،
        // نبحث عن مدير واحد نشط مسموح له بالمحادثة ونستخدمه تلقائياً.
        if (!adminId) {
          const { data: admins } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .eq('status', 'active')
            .neq('allow_chat', 0)
            .order('id', { ascending: true })
            .limit(2);
          const list = (admins ?? []) as Array<{ id: number }>;
          if (list.length === 1) adminId = list[0].id;
          else return err('admin_id مطلوب — حدّد المدير المطلوب', 400);
        }
        const { data: admRow } = await supabase
          .from('users')
          .select('id,role,status,allow_chat')
          .eq('id', adminId)
          .maybeSingle();
        const adm = admRow as { id?: number; role?: string; status?: string; allow_chat?: number } | null;
        if (!adm || adm.role !== 'admin' || adm.status === 'banned') return err('المدير غير صالح', 400);
        if (adm.allow_chat === 0) return err('المحادثة مع هذا المدير معطّلة', 403);
        const { data: meRow2 } = await supabase.from('users').select('allow_chat').eq('id', a.uid).maybeSingle();
        if (meRow2 && (meRow2 as { allow_chat?: number }).allow_chat === 0) return err('محادثاتك معطّلة', 403);
      }
      const { data } = await supabase.from('threads').insert({
        reviewer_id: rid, admin_id: adminId, title, status: 'active',
      }).select('id').single();
      return ok({ ok: true, id: data?.id, title });
    }
    if (method === 'PUT' && (id === 'archive' || id === 'restore')) {
      if (a.role !== 'admin') return err('للمدير فقط', 403);
      if (!(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      const d = await readBody(req);
      const tid = num(d.thread_id);
      if (!tid) return err('thread_id مطلوب', 400);
      const restore = id === 'restore' || Boolean(d.restore);
      if (restore) {
        await supabase.from('threads').update({ status: 'active', archived_at: null }).eq('id', tid);
        await supabase.from('messages').update({ status: 'sent' }).eq('thread_id', tid).eq('status', 'archived');
      } else {
        await supabase.from('threads').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', tid);
        await supabase.from('messages').update({ status: 'archived' }).eq('thread_id', tid);
      }
      return ok({ ok: true });
    }
  }

  // ─── THREAD MESSAGE ───────────────────────────────────────────────
  if (res === 'thread_msg') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    if (method === 'POST') {
      const d = await readBody(req);
      const tid = num(d.thread_id), toId = num(d.to_id);
      const body = trimStr(d.body);
      if (!tid || !body || !toId) return err('بيانات ناقصة', 400);
      const supabase = db();
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'chats'))) {
        return err('لا تملك صلاحية المحادثات', 403);
      }
      const { data: thread } = await supabase.from('threads').select('reviewer_id,admin_id').eq('id', tid).single();
      if (!thread) return err('not found', 404);
      const t = thread as { reviewer_id: number; admin_id: number };
      const isParticipant =
        (a.role === 'admin' && t.admin_id === a.uid && t.reviewer_id === toId) ||
        (a.role === 'reviewer' && t.reviewer_id === a.uid && t.admin_id === toId) ||
        (a.role === 'inviter' && (
          (t.reviewer_id === a.uid && t.admin_id === toId) ||
          (t.admin_id === a.uid && t.reviewer_id === toId)
        ));
      if (!isParticipant) return err('غير مصرح', 403);
      // Refuse if either party has chat blocked
      const { data: bothUsers } = await supabase.from('users').select('id,allow_chat').in('id', [a.uid, toId]);
      const blocked = (bothUsers ?? []).find((u: { allow_chat?: number }) => u.allow_chat === 0);
      if (blocked) return err('المحادثة معطّلة', 403);
      // ملحقات اختيارية: صورة / PDF / موقع
      const fileType = typeof d.file_type === 'string' ? d.file_type : null;
      const fileUrl = typeof d.file_url === 'string' ? d.file_url : null;
      // إرسال موقع — يحتاج صلاحية 'location' (المراجع لا يستطيع إرسال الموقع)
      if (fileType === 'location'){
        if (a.role !== 'admin') return err('إرسال الموقع للمدير فقط', 403);
        if (!(await ensureAdminPerm(supabase, a.uid, 'location'))) {
          return err('لا تملك صلاحية إرسال الموقع', 403);
        }
        if (!fileUrl) return err('رابط الموقع مفقود', 400);
      }
      const { data } = await supabase.from('messages').insert({
        from_id: a.uid, to_id: toId, body, is_read: 0, thread_id: tid,
        file_url: fileUrl, file_type: fileType,
      }).select('id').single();
      return ok({ ok: true, id: data?.id });
    }
  }

  // ─── ARCHIVE: CHATS, MSGS, FORMS, APTS ────────────────────────────
  if (res === 'archive_chats' && method === 'GET') {
    const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (!(await ensureAdminPerm(supabase, a.uid, 'archive'))) return err('لا تملك صلاحية الأرشيف', 403);
    const { data: threads } = await supabase.from('threads').select('*,users!threads_reviewer_id_fkey(name)').eq('status', 'archived').order('archived_at', { ascending: false });
    const enriched = await Promise.all((threads ?? []).map(async (t: Record<string, unknown>) => {
      const { data: last } = await supabase.from('messages').select('body').eq('thread_id', t.id as number).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('thread_id', t.id as number);
      return { ...t, reviewer_name: (t as { users?: { name: string } }).users?.name, last_msg: last?.body, msg_count: count ?? 0 };
    }));
    return ok(enriched);
  }
  if (res === 'archive_chat_msgs' && method === 'GET' && id) {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    const { data } = await supabase.from('messages').select('*')
      .or(`and(from_id.eq.${a.uid},to_id.eq.${num(id)}),and(from_id.eq.${num(id)},to_id.eq.${a.uid})`)
      .eq('status', 'archived').order('created_at', { ascending: true }).limit(300);
    return ok(data ?? []);
  }
  if (res === 'archive_forms' && method === 'GET') {
    const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (!(await ensureAdminPerm(supabase, a.uid, 'archive'))) return err('لا تملك صلاحية الأرشيف', 403);
    const { data } = await supabase.from('submissions').select('*,users(name),forms(title)').eq('status', 'archived').order('created_at', { ascending: false });
    return ok((data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      reviewer_name: (r as { users?: { name: string } }).users?.name,
      form_title: (r as { forms?: { title: string } }).forms?.title,
    })));
  }
  if (res === 'archive_apts' && method === 'GET') {
    const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (!(await ensureAdminPerm(supabase, a.uid, 'archive'))) return err('لا تملك صلاحية الأرشيف', 403);
    const { data } = await supabase.from('appointments').select('*,users(name),appointment_dates(date,slots(name))').eq('status', 'archived').order('created_at', { ascending: false });
    return ok((data ?? []).map((r: Record<string, unknown>) => {
      const dt = (r as { appointment_dates?: { date: string; slots?: { name: string } } }).appointment_dates;
      return { ...r, reviewer_name: (r as { users?: { name: string } }).users?.name, date: dt?.date, slot_name: dt?.slots?.name };
    }));
  }

  // ─── MESSAGES ─────────────────────────────────────────────────────
  if (res === 'messages') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'DELETE' && id) {
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      await supabase.from('messages').delete().eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'PUT' && id === 'archive') {
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      const d = await readBody(req); const uid = num(d.user_id);
      if (!uid) return err('missing user_id', 400);
      await supabase.from('messages').update({ status: 'archived' })
        .or(`from_id.eq.${uid},to_id.eq.${uid}`).neq('status', 'archived');
      return ok({ ok: true });
    }
    if (method === 'PUT' && id === 'restore') {
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      const d = await readBody(req); const uid = num(d.user_id);
      if (!uid) return err('missing user_id', 400);
      await supabase.from('messages').update({ status: 'sent' })
        .or(`from_id.eq.${uid},to_id.eq.${uid}`).eq('status', 'archived');
      return ok({ ok: true });
    }
    if (method === 'PUT' && id === 'read') {
      const partner = num(sp.get('partner'));
      if (!partner) return err('missing partner', 400);
      await supabase.from('messages').update({ is_read: 1 }).eq('to_id', a.uid).eq('from_id', partner);
      return ok({ ok: true });
    }
    if (method === 'POST' && id === 'transfer') {
      if (a.role !== 'admin') return err('للمدير فقط', 403);
      if (!(await ensureAdminPerm(supabase, a.uid, 'chats'))) return err('لا تملك صلاحية المحادثات', 403);
      const d = await readBody(req);
      const rId = num(d.reviewer_id), nId = num(d.new_admin_id), oId = num(d.old_admin_id);
      if (!rId || !nId || !oId) return err('missing params', 400);
      await supabase.from('messages').update({ to_id: nId }).eq('from_id', rId).eq('to_id', oId);
      await supabase.from('messages').update({ from_id: nId }).eq('from_id', oId).eq('to_id', rId);
      await supabase.from('messages').insert({ from_id: nId, to_id: rId, body: '📢 تم تحويل محادثتك إلى مختص جديد. سيتابع معك قريباً.', is_read: 0 });
      return ok({ ok: true });
    }
    if (method === 'GET') {
      if (id) {
        const after = num(sp.get('after'));
        const userId = num(id);
        let q = supabase.from('messages').select('*,users!messages_from_id_fkey(name,role)')
          .or(`and(from_id.eq.${a.uid},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${a.uid})`)
          .neq('status', 'archived').order('created_at', { ascending: true });
        if (after > 0) {
          q = q.gt('id', after).limit(100);
          const { data } = await q;
          return ok((data ?? []).map((m: Record<string, unknown>) => {
            const u2 = (m as { users?: { name: string; role: string } }).users;
            return { ...m, from_name: u2?.name, from_role: u2?.role };
          }));
        }
        q = q.limit(300);
        const { data: msgs } = await q;
        return ok({
          messages: (msgs ?? []).map((m: Record<string, unknown>) => {
            const u2 = (m as { users?: { name: string; role: string } }).users;
            return { ...m, from_name: u2?.name, from_role: u2?.role };
          }),
          unread: 0,
        });
      }
      // If the caller's own chat is disabled, return empty
      const { data: myRow } = await supabase.from('users').select('allow_chat').eq('id', a.uid).maybeSingle();
      if (myRow && (myRow as { allow_chat?: number }).allow_chat === 0) return ok([]);

      // 1) جمع شركاء المحادثة من الرسائل الموجودة
      const { data: convoRows } = await supabase
        .from('messages')
        .select('from_id,to_id')
        .or(`from_id.eq.${a.uid},to_id.eq.${a.uid}`)
        .neq('status', 'archived');
      const partnerIds = new Set<number>();
      for (const r of convoRows ?? []) {
        const row = r as { from_id: number | null; to_id: number | null };
        const partner = row.from_id === a.uid ? row.to_id : row.from_id;
        if (partner && partner !== a.uid) partnerIds.add(partner);
      }
      // 2) للمراجع — أَضِف كل المدراء النشطين المسموح لهم بالمحادثة
      // (حتى لو لم تكن هناك رسائل بعد) حتى يستطيع المراجع بدء محادثة جديدة.
      if (a.role === 'reviewer') {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('status', 'active')
          .neq('allow_chat', 0);
        (admins ?? []).forEach((u: { id: number }) => partnerIds.add(u.id));
      }

      if (partnerIds.size === 0) return ok([]);
      const { data: users } = await supabase
        .from('users')
        .select('id,name,username,role,allow_chat')
        .in('id', Array.from(partnerIds))
        .eq('status', 'active')
        .neq('allow_chat', 0);
      const list = await Promise.all((users ?? []).map(async (u: { id: number; name: string; username: string; role: string }) => {
        const { data: last } = await supabase.from('messages').select('body,created_at')
          .or(`and(from_id.eq.${a.uid},to_id.eq.${u.id}),and(from_id.eq.${u.id},to_id.eq.${a.uid})`)
          .neq('status', 'archived').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('from_id', u.id).eq('to_id', a.uid).eq('is_read', 0).neq('status', 'archived');
        return { ...u, last_msg: last?.body, last_time: last?.created_at, unread: count ?? 0 };
      }));
      // ترتيب: من له محادثة سابقة بالأحدث أولاً، ثم بقية المسموح لهم أبجدياً
      list.sort((x, y) => {
        const xt = x.last_time || '';
        const yt = y.last_time || '';
        if (xt && !yt) return -1;
        if (yt && !xt) return 1;
        if (xt && yt) return yt.localeCompare(xt);
        return String(x.name || '').localeCompare(String(y.name || ''));
      });
      return ok(list);
    }
    if (method === 'POST') {
      if (a.role === 'admin' && !(await ensureAdminPerm(supabase, a.uid, 'chats'))) {
        return err('لا تملك صلاحية المحادثات', 403);
      }
      const d = await readBody(req);
      const to_id = num(d.to_id);
      const body = typeof d.body === 'string' ? d.body : '';
      if (!to_id || !body) return err('بيانات ناقصة', 400);
      const { data: msg } = await supabase.from('messages').insert({
        from_id: a.uid, to_id, body, is_read: 0,
        file_url: typeof d.file_url === 'string' ? d.file_url : null,
        file_type: typeof d.file_type === 'string' ? d.file_type : null,
      }).select('*,users!messages_from_id_fkey(name)').single();
      if (msg) {
        const u2 = (msg as { users?: { name: string } }).users;
        return ok({ ...msg, from_name: u2?.name });
      }
      return ok({ ok: true });
    }
  }

  // ─── PUBLICATIONS ─────────────────────────────────────────────────
  if (res === 'publications') {
    const supabase = db();
    if (method === 'GET') {
      if (id) {
        const { data: pub } = await supabase.from('publications').select('*').eq('id', num(id)).single();
        if (!pub) return err('not found', 404);
        await supabase.from('publications').update({ views: (pub.views ?? 0) + 1 }).eq('id', num(id));
        return ok(pub);
      }
      const { data } = await supabase.from('publications').select('*').order('created_at', { ascending: false });
      return ok(data ?? []);
    }
    if (method === 'POST') {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'publications'))) return err('لا تملك صلاحية إدارة النشرات', 403);
      const d = await readBody(req);
      if (!d.title) return err('العنوان مطلوب', 400);
      const { data } = await supabase.from('publications').insert({
        title: String(d.title),
        description: typeof d.description === 'string' ? d.description : '',
        content: typeof d.content === 'string' ? d.content : '',
        type: d.type === 'pdf' ? 'pdf' : 'article',
        file_path: typeof d.file_path === 'string' ? d.file_path : null,
        status: typeof d.status === 'string' ? d.status : 'active',
      }).select('id').single();
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'publications'))) return err('لا تملك صلاحية إدارة النشرات', 403);
      const d = await readBody(req);
      const patch: Record<string, unknown> = {};
      for (const k of ['title', 'description', 'content', 'type', 'file_path', 'status'] as const) {
        if (k in d) patch[k] = d[k];
      }
      if (Object.keys(patch).length) await supabase.from('publications').update(patch).eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const a = authFromHeader(auth, true); if (isAuthError(a)) return err(a.error, a.status);
      if (!(await ensureAdminPerm(supabase, a.uid, 'publications'))) return err('لا تملك صلاحية إدارة النشرات', 403);
      await supabase.from('publications').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── REPORTS (images + PDFs uploaded by reviewers) ────────────────
  // Admin: sees all reports. Reviewer: sees only their own.
  if (res === 'reports') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      // Single report + comments
      if (id) {
        const { data: report } = await supabase
          .from('reports')
          .select('*,users!reports_reviewer_id_fkey(name,username,phone)')
          .eq('id', num(id))
          .single();
        if (!report) return err('not found', 404);
        const r = report as Record<string, unknown> & { reviewer_id: number };
        if (a.role !== 'admin' && r.reviewer_id !== a.uid) return err('غير مصرّح', 403);
        let commentsRes = await supabase
          .from('report_comments')
          .select('*,users!report_comments_user_id_fkey(name,role)')
          .eq('report_id', num(id))
          .order('created_at', { ascending: true });
        // إذا عمود is_private مفقود في DB قديم، جرّب بدونه
        if (commentsRes.error && /is_private/i.test(commentsRes.error.message || '')) {
          commentsRes = await supabase
            .from('report_comments')
            .select('id,report_id,user_id,body,created_at,users!report_comments_user_id_fkey(name,role)')
            .eq('report_id', num(id))
            .order('created_at', { ascending: true });
        }
        const comments = commentsRes.data ?? [];
        // المراجع لا يرى التعليقات الخاصة بالإدارة (is_private=1).
        // FAIL-CLOSED: نعرض للمراجع فقط ما عُلِّم صراحة بـ is_private===0.
        // لو الحقل undefined (عمود مفقود في DB قديم) أو null (صف قديم) → نعتبره خاصاً ونُخفيه.
        const visibleComments = comments.filter((c: Record<string, unknown>) => {
          if (a.role === 'admin') return true;
          return Number(c.is_private) === 0;
        });
        const u = (r as { users?: { name?: string; phone?: string; username?: string } }).users;
        return ok({
          ...r,
          reviewer_name: u?.name,
          reviewer_phone: u?.phone,
          reviewer_username: u?.username,
          comments: visibleComments.map((c: Record<string, unknown>) => {
            const cu = (c as { users?: { name?: string; role?: string } }).users;
            return { ...c, user_name: cu?.name, user_role: cu?.role, is_private: c.is_private ? 1 : 0 };
          }),
        });
      }
      // List
      const statusFilter = sp.get('status') || 'active';
      let q = supabase.from('reports').select('*,users!reports_reviewer_id_fkey(name,username,phone)');
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (a.role !== 'admin') q = q.eq('reviewer_id', a.uid);
      const { data } = await q.order('created_at', { ascending: false }).limit(200);
      return ok((data ?? []).map((r: Record<string, unknown>) => {
        const u = (r as { users?: { name?: string; phone?: string; username?: string } }).users;
        return { ...r, reviewer_name: u?.name, reviewer_phone: u?.phone, reviewer_username: u?.username };
      }));
    }
    if (method === 'POST') {
      const d = await readBody(req);
      const title = trimStr(d.title);
      const file_url = typeof d.file_url === 'string' ? d.file_url : '';
      const file_type = typeof d.file_type === 'string' ? d.file_type : 'image';
      const file_name = trimStr(d.file_name);
      // Reviewer uploads to their own account; admin can upload on behalf of a reviewer
      let reviewer_id = a.uid;
      if (a.role === 'admin' && d.reviewer_id) {
        if (!(await ensureAdminPerm(supabase, a.uid, 'reports'))) return err('لا تملك صلاحية التقارير', 403);
        reviewer_id = num(d.reviewer_id);
      }
      if (!title || !file_url) return err('العنوان والملف مطلوبان', 400);
      const { data, error } = await supabase
        .from('reports')
        .insert({ reviewer_id, title, file_url, file_type, file_name, status: 'active' })
        .select('id')
        .single();
      if (error) return err('فشل الحفظ: ' + error.message, 500);
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const d = await readBody(req);
      const { data: r } = await supabase.from('reports').select('reviewer_id').eq('id', num(id)).single();
      if (!r) return err('not found', 404);
      const ownerId = (r as { reviewer_id: number }).reviewer_id;
      // Reviewer can only edit title of own reports; admin needs 'reports' perm to touch any
      if (a.role !== 'admin' && ownerId !== a.uid) return err('غير مصرّح', 403);
      if (a.role === 'admin' && ownerId !== a.uid && !(await ensureAdminPerm(supabase, a.uid, 'reports'))) {
        return err('لا تملك صلاحية التقارير', 403);
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof d.title === 'string') patch.title = trimStr(d.title);
      if (a.role === 'admin' && typeof d.status === 'string') {
        const s = d.status === 'archived' ? 'archived' : 'active';
        patch.status = s;
      }
      await supabase.from('reports').update(patch).eq('id', num(id));
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const { data: r } = await supabase.from('reports').select('reviewer_id').eq('id', num(id)).single();
      if (!r) return err('not found', 404);
      const ownerId = (r as { reviewer_id: number }).reviewer_id;
      if (a.role !== 'admin' && ownerId !== a.uid) return err('غير مصرّح', 403);
      if (a.role === 'admin' && ownerId !== a.uid && !(await ensureAdminPerm(supabase, a.uid, 'reports'))) {
        return err('لا تملك صلاحية التقارير', 403);
      }
      await supabase.from('reports').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── REPORT COMMENTS ─────────────────────────────────────────────
  if (res === 'report_comments') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'POST') {
      const d = await readBody(req);
      const report_id = num(d.report_id);
      const body = trimStr(d.body);
      if (!report_id || !body) return err('التعليق مطلوب', 400);
      // Verify the user can comment on this report (admin or owning reviewer)
      const { data: r } = await supabase.from('reports').select('reviewer_id').eq('id', report_id).single();
      if (!r) return err('التقرير غير موجود', 404);
      const ownerId = (r as { reviewer_id: number }).reviewer_id;
      if (a.role !== 'admin' && ownerId !== a.uid) return err('غير مصرّح', 403);
      // Admin commenting on a reviewer's report needs 'reports' perm
      if (a.role === 'admin' && ownerId !== a.uid && !(await ensureAdminPerm(supabase, a.uid, 'reports'))) {
        return err('لا تملك صلاحية التقارير', 403);
      }
      // is_private: للمدير فقط — يحفظ التعليق كملاحظة داخلية لا يراها المراجع
      const isPrivate = (a.role === 'admin' && (d.is_private === 1 || d.is_private === '1' || d.is_private === true)) ? 1 : 0;
      const insertRow: Record<string, unknown> = { report_id, user_id: a.uid, body, is_private: isPrivate };
      let insertRes = await supabase.from('report_comments').insert(insertRow).select('id').single();
      // إذا عمود is_private مفقود في DB قديم، أَسقطه وحاول مجدّداً
      if (insertRes.error && /is_private/i.test(insertRes.error.message || '')) {
        delete insertRow.is_private;
        insertRes = await supabase.from('report_comments').insert(insertRow).select('id').single();
      }
      if (insertRes.error) return err('فشل الحفظ: ' + insertRes.error.message, 500);
      // Bump parent report's updated_at so it sorts to the top
      await supabase.from('reports').update({ updated_at: new Date().toISOString() }).eq('id', report_id);
      return ok({ ok: true, id: insertRes.data?.id });
    }
    if (method === 'DELETE' && id) {
      const { data: c } = await supabase.from('report_comments').select('user_id').eq('id', num(id)).single();
      if (!c) return err('not found', 404);
      const cUid = (c as { user_id: number }).user_id;
      if (a.role !== 'admin' && cUid !== a.uid) return err('غير مصرّح', 403);
      if (a.role === 'admin' && cUid !== a.uid && !(await ensureAdminPerm(supabase, a.uid, 'reports'))) {
        return err('لا تملك صلاحية التقارير', 403);
      }
      await supabase.from('report_comments').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── UNREAD COUNT (lightweight badge endpoint) ──────────────────
  // يُستخدم من شارة الإشعار على شريط النقل — استعلام واحد سريع.
  if (res === 'unread') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', a.uid)
      .eq('is_read', 0)
      .neq('status', 'archived');
    return ok({ count: count ?? 0 });
  }

  // ─── TIPS (تعليمات قابلة للتعديل تظهر بأيقونة ⓘ) ───────────────
  if (res === 'tips') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('tips')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });
      if (error) return err('فشل القراءة: ' + error.message, 500);
      return ok(data ?? []);
    }
    if (a.role !== 'admin') return err('للمدير فقط', 403);
    if (method === 'POST') {
      const d = await readBody(req);
      const tip_key = String(d.tip_key ?? '').trim();
      const title = String(d.title ?? '').trim();
      const body = String(d.body ?? '').trim();
      if (!tip_key) return err('المفتاح مطلوب', 400);
      if (!title) return err('العنوان مطلوب', 400);
      if (!body) return err('النص مطلوب', 400);
      const row = {
        tip_key,
        title,
        body,
        sort_order: num(d.sort_order) || 100,
        status: 'active',
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('tips').insert(row).select('id').single();
      if (error) return err('فشل الحفظ: ' + error.message, 500);
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const d = await readBody(req);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof d.tip_key === 'string') patch.tip_key = d.tip_key.trim();
      if (typeof d.title === 'string') patch.title = d.title.trim();
      if (typeof d.body === 'string') patch.body = d.body.trim();
      if (d.sort_order !== undefined) patch.sort_order = num(d.sort_order);
      if (typeof d.status === 'string') patch.status = d.status;
      const { error } = await supabase.from('tips').update(patch).eq('id', num(id));
      if (error) return err('فشل التحديث: ' + error.message, 500);
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('tips').delete().eq('id', num(id));
      if (error) return err('فشل الحذف: ' + error.message, 500);
      return ok({ ok: true });
    }
  }

  // ─── SESSION EVAL FIELDS (إدارة معايير التقييم من الإعدادات) ──
  if (res === 'session_eval_fields') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('session_eval_fields')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) return err('فشل القراءة: ' + error.message, 500);
      return ok(data ?? []);
    }
    if (a.role !== 'admin') return err('للمدير فقط', 403);
    if (method === 'POST') {
      const d = await readBody(req);
      const label = String(d.label ?? '').trim();
      if (!label) return err('العنوان مطلوب', 400);
      const row = {
        label,
        icon: typeof d.icon === 'string' ? d.icon.trim() : null,
        sort_order: num(d.sort_order) || 100,
        status: 'active',
      };
      const { data, error } = await supabase.from('session_eval_fields').insert(row).select('id').single();
      if (error) return err('فشل الحفظ: ' + error.message, 500);
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'PUT' && id) {
      const d = await readBody(req);
      const patch: Record<string, unknown> = {};
      if (typeof d.label === 'string') patch.label = d.label.trim();
      if (typeof d.icon === 'string') patch.icon = d.icon.trim();
      if (d.sort_order !== undefined) patch.sort_order = num(d.sort_order);
      if (typeof d.status === 'string') patch.status = d.status;
      const { error } = await supabase.from('session_eval_fields').update(patch).eq('id', num(id));
      if (error) return err('فشل التحديث: ' + error.message, 500);
      return ok({ ok: true });
    }
    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('session_eval_fields').delete().eq('id', num(id));
      if (error) return err('فشل الحذف: ' + error.message, 500);
      return ok({ ok: true });
    }
  }

  // ─── SESSION EVALUATIONS (تقييم ما بعد الجلسة) ─────────────────
  // المراجع يُضيف تقييم بعد أن يضع المدير حالة الموعد = completed.
  // المدير يقرأ كل التقييمات ويردّ عليها (نقاش مفتوح).
  // المعايير ديناميكية — تُدار من session_eval_fields، والإجابات في JSONB.
  if (res === 'session_evals') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    if (method === 'GET') {
      const aptId = num(sp.get('appointment_id'));
      if (!aptId) return err('appointment_id مطلوب', 400);
      const { data: apt } = await supabase.from('appointments').select('id,reviewer_id').eq('id', aptId).maybeSingle();
      if (!apt) return err('الموعد غير موجود', 404);
      const ownerId = (apt as { reviewer_id: number }).reviewer_id;
      if (a.role !== 'admin' && ownerId !== a.uid) return err('غير مصرّح', 403);
      // خريطة legacy_col → id لاسترجاع البيانات القديمة المخزّنة في أعمدة منفصلة
      const { data: fields } = await supabase
        .from('session_eval_fields')
        .select('id,legacy_col');
      const legacyMap: Array<{ id: number; col: string }> = [];
      (fields ?? []).forEach((f: Record<string, unknown>) => {
        if (typeof f.legacy_col === 'string' && f.legacy_col) {
          legacyMap.push({ id: f.id as number, col: f.legacy_col });
        }
      });
      const { data, error } = await supabase
        .from('session_evals')
        .select('*,users!session_evals_author_id_fkey(name,role)')
        .eq('appointment_id', aptId)
        .order('created_at', { ascending: true });
      if (error) return err('فشل القراءة: ' + error.message, 500);
      return ok((data ?? []).map((r: Record<string, unknown>) => {
        const u = (r as { users?: { name?: string; role?: string } }).users;
        const ans: Record<string, string> = {};
        const raw = r.answers;
        if (raw && typeof raw === 'object') {
          Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
            if (typeof v === 'string' && v.trim()) ans[k] = v;
          });
        }
        // الأعمدة القديمة كاحتياط للبيانات السابقة قبل التحويل إلى JSONB
        legacyMap.forEach(({ id: fid, col }) => {
          const key = String(fid);
          if (!ans[key]) {
            const v = (r as Record<string, unknown>)[col];
            if (typeof v === 'string' && v.trim()) ans[key] = v;
          }
        });
        return {
          id: r.id,
          appointment_id: r.appointment_id,
          author_id: r.author_id,
          author_name: u?.name,
          author_role: u?.role || (r as { author_role?: string }).author_role,
          created_at: r.created_at,
          answers: ans,
        };
      }));
    }
    if (method === 'POST') {
      const d = await readBody(req);
      const apt_id = num(d.appointment_id);
      if (!apt_id) return err('appointment_id مطلوب', 400);
      const { data: apt } = await supabase.from('appointments').select('id,reviewer_id,status').eq('id', apt_id).maybeSingle();
      if (!apt) return err('الموعد غير موجود', 404);
      const t = apt as { reviewer_id: number; status: string };
      if (a.role !== 'admin') {
        if (t.reviewer_id !== a.uid) return err('غير مصرّح', 403);
        if (t.status !== 'completed') return err('التقييم متاح بعد اعتماد الجلسة من الإدارة', 403);
      }
      const ansRaw = (d.answers && typeof d.answers === 'object') ? (d.answers as Record<string, unknown>) : {};
      const cleanAns: Record<string, string> = {};
      Object.entries(ansRaw).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) cleanAns[String(k)] = v.trim();
      });
      if (!Object.keys(cleanAns).length) return err('أضف ملاحظة واحدة على الأقل', 400);
      const row = {
        appointment_id: apt_id,
        author_id: a.uid,
        author_role: a.role,
        answers: cleanAns,
      };
      const { data, error } = await supabase.from('session_evals').insert(row).select('id').single();
      if (error) return err('فشل الحفظ: ' + error.message, 500);
      return ok({ ok: true, id: data?.id });
    }
    if (method === 'DELETE' && id) {
      const { data: row } = await supabase.from('session_evals').select('author_id').eq('id', num(id)).maybeSingle();
      if (!row) return err('not found', 404);
      if (a.role !== 'admin' && (row as { author_id: number }).author_id !== a.uid) return err('غير مصرّح', 403);
      await supabase.from('session_evals').delete().eq('id', num(id));
      return ok({ ok: true });
    }
  }

  // ─── STATS ────────────────────────────────────────────────────────
  if (res === 'stats') {
    const a = authFromHeader(auth); if (isAuthError(a)) return err(a.error, a.status);
    const supabase = db();
    const counts = await Promise.all([
      supabase.from('sections').select('id', { count: 'exact', head: true }),
      supabase.from('forms').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'reviewer'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'done'),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', 0),
    ]);
    return ok({
      sections: counts[0].count ?? 0,
      forms: counts[1].count ?? 0,
      reviewers: counts[2].count ?? 0,
      submissions: counts[3].count ?? 0,
      pending_subs: counts[4].count ?? 0,
      reviewed_subs: counts[5].count ?? 0,
      appointments: counts[6].count ?? 0,
      unread_msgs: counts[7].count ?? 0,
    });
  }

  return err('not found', 404);
}

export async function GET(req: NextRequest) {
  try { return await dispatch(req, 'GET'); } catch (e) { return NextResponse.json({ error: 'Server error: ' + (e instanceof Error ? e.message : 'unknown') }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try { return await dispatch(req, 'POST'); } catch (e) { return NextResponse.json({ error: 'Server error: ' + (e instanceof Error ? e.message : 'unknown') }, { status: 500 }); }
}
export async function PUT(req: NextRequest) {
  try { return await dispatch(req, 'PUT'); } catch (e) { return NextResponse.json({ error: 'Server error: ' + (e instanceof Error ? e.message : 'unknown') }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  try { return await dispatch(req, 'DELETE'); } catch (e) { return NextResponse.json({ error: 'Server error: ' + (e instanceof Error ? e.message : 'unknown') }, { status: 500 }); }
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
}

// Suppress unused import warning
type _ = AuthPayload;
