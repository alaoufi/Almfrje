import { mrahiEnv } from '@/lib/mrahi-env';

export const dynamic = 'force-dynamic';

// يقدّم إعدادات Supabase لتطبيق mrahi. مفتاح anon علني بطبيعته (الحماية عبر RLS).
// مصدر الإعداد معزول في lib/mrahi-env.ts (يُفضّل MRAHI_* مع رجوعٍ للمشتركة انتقالياً).
export async function GET() {
  const { url, anon } = mrahiEnv();
  const body =
    `window.MARAHI_CONFIG = ${JSON.stringify({ SUPABASE_URL: url || '', SUPABASE_ANON_KEY: anon || '' })};`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
