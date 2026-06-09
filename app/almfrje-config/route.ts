import { almfrjeEnv } from '@/lib/almfrje-env';

// إعدادات Supabase لتطبيق المفارجة من متغيّرات بيئة alaoufi.me.
// مفتاح anon علني بطبيعته (الحماية عبر RLS)، وقيمه شبه ثابتة — لذا يُخزَّن لمدة
// قصيرة (خارج /api) لإزالة النداء الخادمي الحاجب في كل فتحة وتسريع بدء التطبيق.
// (يُحدَّث تلقائياً عند أي نشر، لأن نشر Vercel يُبطل كاش الحافة.)
export async function GET() {
  const e = almfrjeEnv();
  const url = e.url || '';
  const anon = e.anon || '';
  const body = url && anon
    ? `window.ALMFRJE_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon })};`
    : '/* almfrje-config: no Supabase env vars set; using static /almfrje/config.js fallback */';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
