import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// رفع الملفات/الصور من جهة الخادم بمفتاح خدمي (يتجاوز سياسات التخزين) بعد التحقق
// من أن المُنادي عضوٌ مفعّل — فلا حاجة لسياسات RLS على التخزين ولا لإعداد يدوي.
export async function POST(request: NextRequest) {
  const url = process.env.ALMFRJE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.ALMFRJE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.ALMFRJE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: 'إعداد الخادم ناقص' }, { status: 500 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'غير مصرّح' }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await caller.auth.getUser();
  if (!who || !who.user) return NextResponse.json({ ok: false, error: 'جلسة غير صالحة' }, { status: 401 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mem } = await admin.from('almfrje_members').select('is_active').eq('user_id', who.user.id).maybeSingle();
  if (!mem || !mem.is_active) return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل' }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const file = form.get('file');
  const folder = String(form.get('folder') || 'misc').replace(/[^a-z0-9_-]/gi, '') || 'misc';
  if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'لا يوجد ملف' }, { status: 400 });
  const f = file as File;
  const ext = ((f.name || 'file').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = Buffer.from(await f.arrayBuffer());

  try { await admin.storage.createBucket('almfrje', { public: true }); } catch { /* موجود مسبقاً */ }
  const { error } = await admin.storage.from('almfrje').upload(path, bytes, { contentType: f.type || undefined, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const pub = admin.storage.from('almfrje').getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, url: pub });
}
