export const dynamic = 'force-dynamic';

// يقدّم إعدادات Supabase لتطبيق mrahi من نفس متغيّرات بيئة alaoufi.me.
// مفتاح anon علني بطبيعته (الحماية عبر RLS)، لذا تقديمه للمتصفّح آمن.
export async function GET() {
  // مراحي على قاعدتها الخاصة إن ضُبطت متغيّراتها، وإلا القاعدة المشتركة (انتقالي).
  const url = process.env.MRAHI_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.MRAHI_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const body =
    `window.MARAHI_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon })};`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
