import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// نقطة واحدة يضربها cron-job.org فتُسخّن كل الدوال السيرفرلِس الحرجة في نفس الوقت.
// كل route في Vercel له bundle منفصل، فلا يكفي ping على مسار واحد. هنا
// نُطلق fetch داخلي إلى المسارات الأخرى بالتوازي. النتيجة: cron-job واحد
// يُغطّي: php dispatcher (settings) + ai/status — وكلها تشتعل خلال ثانيتين تقريباً.

async function pingUrl(base: string, path: string, timeoutMs = 4000): Promise<{ path: string; ms: number; status: number | null }> {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}${path}`, {
      method: 'GET',
      signal: ac.signal,
      headers: { 'x-keepalive': '1' },
      cache: 'no-store',
    });
    return { path, ms: Date.now() - t0, status: r.status };
  } catch {
    return { path, ms: Date.now() - t0, status: null };
  } finally {
    clearTimeout(timer);
  }
}

async function handle(req: NextRequest) {
  const t0 = Date.now();
  // 1) لمسة خفيفة على Supabase ليبقى الـ pool warm — يُسخّن هذه الدالة + DB
  let dbOk = false;
  try {
    const supabase = db();
    const { error } = await supabase.from('settings').select('key_name', { head: true, count: 'exact' }).limit(1);
    dbOk = !error;
  } catch { /* tolerate */ }

  // 2) سخّن المسارات الأخرى عبر fetch داخلي
  const origin = req.nextUrl.origin;
  const targets = [
    '/api/php/settings',        // الدالة الكبيرة التي تخدم 90% من المسارات
    '/api/ai/status',           // مزوّد الذكاء الاصطناعي
  ];
  // ملاحظة: لا نضرب /api/migrate (يُشغّل ترقيات DB) ولا /api/ai/translate (مكلفة)
  // ولا /api/upload (يحتاج body)
  const results = await Promise.all(targets.map((p) => pingUrl(origin, p)));

  return NextResponse.json({
    ok: true,
    db: dbOk,
    total_ms: Date.now() - t0,
    pinged: results,
    ts: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
