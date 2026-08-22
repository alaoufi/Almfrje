/* احتياطيُّ الاستضافة الثابتة فقط (هذه القيم عامة وآمنة للواجهة — الحماية عبر RLS).
   مهم: على alaoufi.me/Vercel يُضبط الاتصال تلقائياً عبر /almfrje-config من متغيّرات
   البيئة، وهو المصدر المعتمد. يجب أن يطابق هذا الاحتياطيُّ المشروعَ نفسه؛ وإلا فحين
   يرجع العميل لهذا الاحتياطي (تعذّر تحميل /almfrje-config) يتّصل بقاعدةٍ مختلفة:
   لا إعدادات (فتظهر شاشة المسؤول للزائر) ولا حسابات (فيفشل الدخول الصحيح). */
window.ALMFRJE_CONFIG = {
  SUPABASE_URL: "https://noupszhgfyqhfotokabj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdXBzemhnZnlxaGZvdG9rYWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njc5NDUsImV4cCI6MjA5NjM0Mzk0NX0.TmyNXiXOm1vhOfV07GWwKkvIdb23oIoeaYL20Wwcpv0",
};
/* rebuild-trigger */
