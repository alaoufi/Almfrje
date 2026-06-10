/* احتياطيُّ الاستضافة الثابتة فقط (قيمٌ عامة آمنة للواجهة — الحماية عبر RLS).
   مهم: على alaoufi.me/Vercel يُضبط الاتصال تلقائياً عبر /almfrje-config من متغيّرات البيئة،
   وهو المصدر المعتمد ونفس مشروع Supabase الذي يتحقّق منه الخادم (almfrje-guest-verify).
   يجب أن يطابق هذا الاحتياطيُّ مشروعَ البيئة نفسه؛ وإلا فعند الرجوع إليه (كاش/تعذّر تحميل
   /almfrje-config) تُعرَض شجرةُ مشروعٍ مختلفٍ بأسماءٍ وفروعٍ غير صحيحة. (وُحِّد هنا على مشروع
   البيئة الحالي — نفس قيم /almfrje-config — لمنع أي تباين.) */
window.ALMFRJE_CONFIG = {
  SUPABASE_URL: "https://noupszhgfyqhfotokabj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdXBzemhnZnlxaGZvdG9rYWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njc5NDUsImV4cCI6MjA5NjM0Mzk0NX0.TmyNXiXOm1vhOfV07GWwKkvIdb23oIoeaYL20Wwcpv0",
};
