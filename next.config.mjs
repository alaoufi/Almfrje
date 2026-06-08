/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/setup': ['./database/setup.sql'],
  },
  async rewrites() {
    return [
      // مشروع المفرجي مستقل: جذر النطاق يفتح التطبيق مباشرة (مع إبقاء /almfrji و/almfrje كمرادفين).
      { source: '/', destination: '/almfrje/index.html' },
      { source: '/almfrji', destination: '/almfrje/index.html' },
      { source: '/almfrji/', destination: '/almfrje/index.html' },
      { source: '/almfrje', destination: '/almfrje/index.html' },
      { source: '/almfrje/', destination: '/almfrje/index.html' },
      // منصّة الاستشارات — تُخدَم على /con
      { source: '/con', destination: '/legacy/index.html' },
      { source: '/con/', destination: '/legacy/index.html' },
      // تطبيق مراحي (ويب) — يُخدم من /mrahi
      { source: '/mrahi', destination: '/mrahi/index.html' },
      { source: '/mrahi/', destination: '/mrahi/index.html' },
    ];
  },
  async headers() {
    const noCache = [
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, private' },
      { key: 'CDN-Cache-Control', value: 'no-store' },
      { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
      { key: 'Surrogate-Control', value: 'no-store' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];
    return [
      // منصّة الاستشارات على /con (وملفاتها داخل /legacy/)
      { source: '/con', headers: noCache },
      { source: '/legacy/:path*', headers: noCache },
      // تطبيق مراحي — لا تخزين أثناء التطوير/التجربة
      { source: '/mrahi', headers: noCache },
      { source: '/mrahi/:path*', headers: noCache },
      // نظام المفارجة (الأنساب)
      { source: '/almfrji', headers: noCache },
      { source: '/almfrje', headers: noCache },
      { source: '/almfrje/:path*', headers: noCache },
      // الصفحة الرئيسية
      { source: '/', headers: noCache },
      // كل نقاط الـ API — يجب ألّا تُخزَّن أبداً (محتوى المستخدم)
      { source: '/api/:path*', headers: noCache },
    ];
  },
};

export default nextConfig;
