// قاعدة بيانات المفرجي — يستخدمها وسيط ‎/sbdb‎ أدناه (لشبكاتٍ تحجب نطاق Supabase مباشرة)
const ALMFRJE_DB = process.env.ALMFRJE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://noupszhgfyqhfotokabj.supabase.co';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // `pg` selects pg-cloudflare at runtime in Workers. Next.js tracing sees
    // the default empty export, so include the Worker implementation explicitly.
    '/api/almfrje-setup': ['./node_modules/pg-cloudflare/dist/**/*'],
    '/api/setup': [
      './database/setup.sql',
      './node_modules/pg-cloudflare/dist/**/*',
    ],
  },
  async rewrites() {
    return [
      // وسيط قاعدة بيانات المفرجي: بعض الشبكات (خصوصاً على أجهزة الكمبيوتر) تحجب نطاق
      // Supabase مباشرةً فتظهر شاشة الدخول الخاطئة ويفشل كل شيء. هذا المسار يمرّر
      // REST/Auth عبر نطاق الموقع نفسه، ويتحوّل إليه المتصفّح تلقائياً عند الحجب.
      { source: '/sbdb/:path*', destination: `${ALMFRJE_DB}/:path*` },
      // المساران /almfrje و/almfrji يبقيان عاملَين كـ alias لنفس التطبيق (توافق قديم).
      // الجذر يُعالَج في app/page.tsx بدلاً من rewrite: ذلك يعمل على Cloudflare Workers
      // أيضاً، حيث لا يُطبَّق rewrite إلى ملف ثابت على الجذر بصورة موثوقة.
      { source: '/almfrji', destination: '/almfrje/index.html' },
      { source: '/almfrji/', destination: '/almfrje/index.html' },
      { source: '/almfrje', destination: '/almfrje/index.html' },
      { source: '/almfrje/', destination: '/almfrje/index.html' },
      // منصّة الاستشارات — تُخدَم على /con
      { source: '/con', destination: '/legacy/index.html' },
      { source: '/con/', destination: '/legacy/index.html' },
      // تطبيق الملاحظات (notes) — مشروعٌ مستقلّ يُخدم من /notes
      { source: '/notes', destination: '/notes/index.html' },
      { source: '/notes/', destination: '/notes/index.html' },
    ];
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
      },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    ];
    const noCache = [
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, private' },
      { key: 'CDN-Cache-Control', value: 'no-store' },
      { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
      { key: 'Surrogate-Control', value: 'no-store' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];
    // إعادة تحقّق: تُخزَّن في المتصفّح لكن تُراجَع في كل فتح عبر ETag → 304 سريع إن لم
    // تتغيّر، ونسخة جديدة فور أي نشر. (للأصول الثابتة: app.js / app.css … — أسرع وبلا قِدَم.)
    const revalidate = [
      { key: 'Cache-Control', value: 'no-cache' },
      { key: 'CDN-Cache-Control', value: 'no-cache' },
      { key: 'Vercel-CDN-Cache-Control', value: 'no-cache' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      // منصّة الاستشارات على /con (وملفاتها داخل /legacy/)
      { source: '/con', headers: noCache },
      { source: '/legacy/:path*', headers: noCache },
      // نظام المفارجة (الأنساب): صفحة الدخول (index) تبقى بلا تخزين، والأصول الثابتة
      // (app.js/app.css/الأيقونة…) بإعادة تحقّق ETag — أسرع فتحٍ مع بقائها محدّثة دائماً.
      { source: '/almfrji', headers: noCache },
      { source: '/almfrje', headers: noCache },
      { source: '/almfrje/:path*', headers: revalidate },
      // تطبيق الملاحظات (notes)
      { source: '/notes', headers: noCache },
      { source: '/notes/:path*', headers: noCache },
      // الصفحة الرئيسية
      { source: '/', headers: noCache },
      // كل نقاط الـ API — يجب ألّا تُخزَّن أبداً (محتوى المستخدم)
      { source: '/api/:path*', headers: noCache },
      // وسيط قاعدة البيانات — بيانات حيّة لا تُخزَّن
      { source: '/sbdb/:path*', headers: noCache },
    ];
  },
};

export default nextConfig;
