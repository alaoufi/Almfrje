import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// رفع الملفات/الصور من جهة الخادم بمفتاح خدمي (يتجاوز سياسات التخزين) بعد التحقق
// من أن المُنادي عضوٌ مفعّل — فلا حاجة لسياسات RLS على التخزين ولا لإعداد يدوي.
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

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 }); }
  const file = form.get('file');
  const folder = String(form.get('folder') || 'misc').replace(/[^a-z0-9_-]/gi, '') || 'misc';
  if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'لا يوجد ملف' }, { status: 400 });
  const f = file as File;

  // تحصين: قائمة بيضاء بالأنواع الآمنة فقط (صور + PDF) وبحجمٍ محدود — المجلّد عام،
  // فيُمنع رفع HTML/SVG/XML أو السكربتات (XSS مخزّن من رابط التخزين العلني) وكذلك الملفات الضخمة.
  // أي نوع آخر يُرفض، ويبقى للمستخدم حقل «رابط مباشر» للوثائق الخارجية.
  const ALLOWED = new Map<string, string>([
    ['image/jpeg', 'jpg'], ['image/jpg', 'jpg'], ['image/png', 'png'],
    ['image/webp', 'webp'], ['image/gif', 'gif'], ['image/heic', 'heic'], ['image/heif', 'heif'],
    ['application/pdf', 'pdf'],
  ]);
  const MAX_BYTES = 15 * 1024 * 1024; // 15MB
  const mime = (f.type || '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED.has(mime)) return NextResponse.json({ ok: false, error: 'يُسمح بالصور وملفات PDF فقط — لغير ذلك استخدم حقل «رابط مباشر»' }, { status: 415 });
  if (typeof f.size === 'number' && f.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'حجم الملف يتجاوز 15 ميجابايت' }, { status: 413 });
  // الامتداد يُشتق من نوع المحتوى المسموح (لا من اسم الملف) لمنع امتدادات مخادِعة.
  const ext = ALLOWED.get(mime)!;
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = Buffer.from(await f.arrayBuffer());
  if (bytes.length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'حجم الملف يتجاوز 15 ميجابايت' }, { status: 413 });

  try { await admin.storage.createBucket('almfrje', { public: true }); } catch { /* موجود مسبقاً */ }
  const { error } = await admin.storage.from('almfrje').upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const pub = admin.storage.from('almfrje').getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, url: pub });
}
