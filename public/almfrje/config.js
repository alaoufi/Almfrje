/* احتياطيُّ الاستضافة الثابتة فقط (هذه القيم عامة وآمنة للواجهة — الحماية عبر RLS).
   مهم: على alaoufi.me/Vercel يُضبط الاتصال تلقائياً عبر /almfrje-config من متغيّرات
   البيئة، وهو المصدر المعتمد ونفس مشروع Supabase الذي يتحقّق منه الخادم
   (app/api/almfrje-guest-verify). يجب أن يطابق هذا الاحتياطيُّ المشروعَ نفسه؛ وإلا
   فحين يرجع العميل لهذا الاحتياطي (كاش/تعذّر تحميل /almfrje-config) يتصفّح الزائر شجرةَ
   مشروعٍ مختلفٍ عمّا يتحقّق منه الخادم، فيظهر اسمه ولا يُطابَق نسبُه. (وُحِّد على
   مشروع البيئة الحالي بدل مشروعٍ قديم كان مثبَّتاً هنا.) */
window.ALMFRJE_CONFIG = {
  SUPABASE_URL: "https://vzlivdymyiaplnasplvg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_I7PYbWwN-KxV78vc1WDmpA_fnCEslM1",
};
