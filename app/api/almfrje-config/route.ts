import { almfrjeEnv } from '@/lib/almfrje-env';

export const dynamic = 'force-dynamic';

// يقدّم إعدادات Supabase لتطبيق المفارجة (almfrje) من نفس متغيّرات بيئة alaoufi.me.
// مفتاح anon علني بطبيعته (الحماية عبر RLS)، لذا تقديمه للمتصفّح آمن.
export async function GET() {
  const e = almfrjeEnv();
  const url = e.url || '';
  const anon = e.anon || '';
  // Only override when env vars are configured. Otherwise emit a no-op so the
  // static values from /almfrje/config.js (loaded just before this) survive —
  // this keeps the app working on deployments where env vars aren't set.
  const body = url && anon
    ? `window.ALMFRJE_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon })};`
    : '/* almfrje-config: no Supabase env vars set; using static /almfrje/config.js fallback */';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
