import { NextRequest, NextResponse } from 'next/server';
import { db, authFromHeader, isAuthError } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_MAX_MB = 10;
const HARD_MAX_MB = 100;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const BUCKET = 'uploads';

async function maxUploadBytes(supabase: ReturnType<typeof db>): Promise<number> {
  const { data } = await supabase.from('settings').select('value').eq('key_name', 'max_upload_mb').maybeSingle();
  const raw = data?.value ? parseInt(data.value, 10) : DEFAULT_MAX_MB;
  const mb = Number.isFinite(raw) && raw > 0 ? Math.min(raw, HARD_MAX_MB) : DEFAULT_MAX_MB;
  return mb * 1024 * 1024;
}

// Create the storage bucket on demand if it isn't there yet. Public so files
// served via getPublicUrl() are accessible to reviewers without a token.
// We deliberately pass only `public: true` — file-size + mime-type limits
// are enforced in this route, so we don't want Supabase rejecting the
// createBucket call because our limits don't match the project's plan caps.
async function ensureBucket(supabase: ReturnType<typeof db>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data: bucket } = await supabase.storage.getBucket(BUCKET);
    if (bucket) return { ok: true };
  } catch { /* fall through and try to create */ }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('already exists') || msg.includes('duplicate')) return { ok: true };
    return {
      ok: false,
      error: 'تعذّر إنشاء bucket الرفع تلقائياً — أنشئه يدوياً: Supabase Dashboard → Storage → New bucket → اسم: uploads → Public ✓ (السبب: ' + error.message + ')',
    };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const auth = authFromHeader(req.headers.get('authorization'));
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'تنسيق الطلب غير صحيح' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'لم يتم استلام ملف' }, { status: 400 });
  }
  const supabase = db();
  const maxBytes = await maxUploadBytes(supabase);
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `حجم الملف يتجاوز ${Math.round(maxBytes / 1024 / 1024)} ميجابايت` }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'نوع غير مدعوم — مسموح: صورة أو PDF' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${auth.uid}/${safeName}`;

  const buf = await file.arrayBuffer();

  // First attempt — happy path when the bucket already exists.
  let uploadResult = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });

  // If the first upload failed because the bucket is missing, create it and
  // retry once. This makes the feature work out-of-the-box without any
  // manual setup in the Supabase dashboard.
  if (uploadResult.error) {
    const msg = (uploadResult.error.message || '').toLowerCase();
    const looksMissing = msg.includes('not found') || msg.includes("doesn't exist") || msg.includes('bucket') || msg.includes('404');
    if (looksMissing) {
      const ensured = await ensureBucket(supabase);
      if (!ensured.ok) return NextResponse.json({ error: ensured.error }, { status: 500 });
      uploadResult = await supabase.storage.from(BUCKET).upload(path, buf, {
        contentType: file.type,
        upsert: false,
      });
    }
  }

  if (uploadResult.error) {
    return NextResponse.json({ error: 'فشل الرفع: ' + uploadResult.error.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl || '';
  const kind = file.type === 'application/pdf' ? 'pdf' : 'image';

  return NextResponse.json({
    ok: true,
    url,
    type: kind,
    filename: file.name,
    size: file.size,
  });
}
