import { notesEnv } from '@/lib/notes-env';

export const dynamic = 'force-dynamic';

// يقدّم إعدادات Supabase لتطبيق notes. مفتاح anon علني بطبيعته (الحماية عبر RLS).
// مصدر الإعداد معزول في lib/notes-env.ts (يُفضّل NOTES_* مع رجوعٍ للمشتركة انتقالياً).
export async function GET() {
  const { url, anon } = notesEnv();
  const body = url && anon
    ? `window.NOTES_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon })};`
    : '/* notes-config: no Supabase env vars set; using static /notes/config.js fallback */';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
