/* المفارجة (almfrje) — نظام شجرة الأنساب وإدارة الفروع (Supabase + JS صِرف) */
'use strict';

/* ===== مسميات ===== */
const SEX = [{ k: 'male', ar: 'ذكر' }, { k: 'female', ar: 'أنثى' }];
const STATUS = [{ k: 'alive', ar: 'حي' }, { k: 'dead', ar: 'متوفى' }];
// نصّ الحالة الكامل: المتوفى بلا ذرية = «لم يعقب» (آلياً).
function statusText(p) {
  if (!p || p.status !== 'dead') return statLabels.alive;
  return (descCount.get(p.id) || 0) === 0 ? statLabels.noissue : statLabels.dead;
}
// لاحقة اللقب تُكتب بجانب الاسم في القوائم والمشجّرات «اللقب».
function nickSuffix(p) { return p && p.nickname ? ` <span class="nick">(${esc(p.nickname)})</span>` : ''; }
// وسم حالة مختصر يُكتب بجانب الاسم في المشجّرات (متوفّى / توفي ولم يعقب) بلون الحالة.
function statusTag(p) {
  if (!p || p.status !== 'dead') return '';
  return ` <span class="stat-tag ${nameCls(p)}">(${esc(statusText(p))})</span>`;
}
// بطاقة دلالة ألوان الأسماء — تُعرض أسفل المشجّرات وكل عرض يعتمد على الألوان.
function legendHtml() {
  return `<div class="card status-legend-card"><div class="legend-title">دلالة ألوان الأسماء</div>
    <div class="status-legend">
      <span class="n-alive">${esc(statLabels.alive)}</span>
      <span class="n-died">${esc(statLabels.dead)}</span>
      <span class="n-noissue">${esc(statLabels.noissue)}</span>
    </div></div>`;
}
const WORK = [{ k: '', ar: 'لم تحدد' }, { k: 'employee', ar: 'موظف' }, { k: 'retired', ar: 'متقاعد' }];
const ROLES = [{ k: 'admin', ar: 'مدير النظام' }, { k: 'general_manager', ar: 'مشرف عام' }, { k: 'branch_manager', ar: 'مشرف فرع' }, { k: 'viewer', ar: 'زائر' }];
// مسمّيات الحالة (تظهر في تعريف الألوان أسفل الرئيسية) — قابلة للتعديل من لوحة التحكم ← النصوص.
const LABELS_DEFAULT = { alive: 'موجود', dead: 'متوفّى', noissue: 'توفي ولم يعقب' };
let statLabels = { ...LABELS_DEFAULT };
const arOf = (arr, k) => (arr.find(x => x.k === k) || {}).ar || '—';
// شارة الحالة: تُعرض «متوفى» فقط للأموات؛ الأحياء بلا شارة (لا نعلم الحي من الميت).
// تمييز الحالة بلون اسم الشخص (لا نقطة):
//  • حيّ: لون عادي.
//  • متوفّى وله ذرية: لون رمادي (n-died).
//  • متوفّى وبلا ذرية «لم يعقب»: لون أحمر داكن (n-noissue) — يُكتشف آلياً.
function nameCls(p) {
  if (!p || p.status !== 'dead') return '';
  return (descCount.get(p.id) || 0) === 0 ? 'n-noissue' : 'n-died';
}
function nameTitle(p) {
  if (!p || p.status !== 'dead') return '';
  return (descCount.get(p.id) || 0) === 0 ? ' title="' + esc(statLabels.noissue) + '"' : ' title="' + esc(statLabels.dead) + '"';
}
// (أُبقي deadBadge فارغةً للتوافق — لم نعد نعرض نقطة)
function deadBadge() { return ''; }

/* ===== أدوات عامة ===== */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => document.getElementById('view');
const val = (id) => (document.getElementById(id) || {}).value || '';
const num = (id) => parseInt(val(id), 10) || 0;
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
// تحميل مكتبة خارجية عند الطلب فقط (تسريع البدء) — مع تخزين الوعد لتفادي التكرار.
const _libs = {};
function lazyLib(url, globalName) {
  if (globalName && window[globalName]) return Promise.resolve();
  if (_libs[url]) return _libs[url];
  _libs[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { delete _libs[url]; reject(new Error('فشل تحميل ' + url)); };
    document.head.appendChild(s);
  });
  return _libs[url];
}
const loadXLSX = () => lazyLib('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js', 'XLSX');
const loadPDF = () => lazyLib('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'pdfjsLib');
// تنبيه مع زر تراجع. يبقى مدةً أطول (٣٠ ثانية افتراضياً)، والتراجع يبقى متاحاً لاحقاً من سجل التعديلات.
function showUndoToast(message, onUndo, ms = 30000) {
  const t = document.createElement('div'); t.className = 'toast undo';
  const span = document.createElement('span'); span.textContent = message;
  const btn = document.createElement('button'); btn.textContent = '↩ تراجع'; btn.className = 'undo-btn';
  let done = false;
  btn.addEventListener('click', () => { if (done) return; done = true; t.remove(); onUndo(); });
  t.appendChild(span); t.appendChild(btn); document.body.appendChild(t);
  setTimeout(() => { if (!done) t.remove(); }, ms);
}
function showLoading(b) { document.getElementById('loading').classList.toggle('hidden', !b); }
const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const noItem = () => '<div class="muted">لا يوجد</div>';
const noPerm = () => '<div class="center-empty">ليست لديك صلاحية الوصول لهذا القسم.<br>راجع مدير النظام.</div>';
function fInput(label, id, v, type = 'text', extra = '') { return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(v == null ? '' : v)}" ${extra}></div>`; }
function fTextarea(label, id, v) { return `<div class="field"><label>${label}</label><textarea id="${id}">${esc(v || '')}</textarea></div>`; }
// ===== نظام التعليمات (i) =====
// قاموس الشروح؛ كل مفتاح له عنوان ونص. يُعرض في نافذة أنيقة عند الضغط على (i).
const HINTS = {
  // ——— الرئيسية والتنقّل ———
  home: ['الصفحة الرئيسية', 'هنا تجد ملخّص الشجرة: عدد الأفراد والفروع والأجيال، وآخر الإضافات.\n\nالأزرار في الأسفل تنقلك بين الأقسام:\n🏠 الرئيسية • 🔍 البحث • 🌳 الشجرة • 🗂️ الفروع • ☰ المزيد.'],
  nav: ['شريط التنقّل', 'الأزرار في أسفل الشاشة:\n🏠 الرئيسية: الملخّص.\n🔍 البحث: ابحث عن أي شخص.\n🌳 الشجرة: تصفّح الأنساب.\n🗂️ الفروع: قائمة الفروع.\n☰ المزيد: بقية الأدوات.'],
  stats_box: ['الإحصائيات', 'أرقام سريعة: إجمالي الأفراد المسجّلين، عدد الفروع، عدد الأجيال، وآخر إضافة.'],
  recent: ['آخر الإضافات', 'أحدث الأسماء المُضافة. اضغط أي اسم لرؤية أبيه وجدّه وتاريخ إضافته.\n\nللمدير: زر «🙈 إخفاء / 👁 إظهار» يتحكم بظهور البطاقة للجميع، وزر «↺ تصفير» يبدأ العدّ من جديد دون حذف أي بيانات.'],
  // ——— البحث ———
  search: ['البحث', 'اكتب اسماً في الأعلى للبحث الفوري، أو استخدم «بحث متقدّم» لتضييق النتائج بالأب أو الجد أو الفرع.\n\nكل الحقول اختيارية — املأ ما تعرفه فقط.'],
  search_name: ['الاسم', 'اكتب جزءاً من اسم الشخص.\nمثال: تكتب «محمد» فتظهر كل من يحمل هذا الاسم.\nلا يهم التشكيل أو «ال» التعريف.'],
  search_father: ['اسم الأب', 'لتضييق البحث: يعرض فقط من كان اسم والده يطابق ما تكتب.\nمثال: الاسم «سالم» + الأب «محمد» = كل سالم بن محمد.'],
  search_grand: ['اسم الجد', 'يعرض فقط من كان اسم جدّه (والد أبيه) يطابق ما تكتب.'],
  search_branch: ['الفرع', 'اختر فرعاً لعرض أفراده فقط.\nالفروع يحدّدها مدير النظام.'],
  search_gen: ['الجيل', 'رقم الجيل من الأصل:\nالأصل = الجيل ١\nأبناؤه = الجيل ٢\nأحفاده = الجيل ٣ … وهكذا.'],
  search_work: ['الحالة الوظيفية', 'تصفية حسب: موظف أو متقاعد.\nمن لم تُحدَّد حالته لن يظهر عند اختيار قيمة.'],
  relations: ['نسبه وأحفاده', 'نافذة سريعة تعرض:\n• سلسلة آباء الشخص حتى الأصل (فلان بن فلان…).\n• أبناءه، وتحت كل ابن أحفاده.\n\nاضغط أي اسم للانتقال إليه.'],
  // ——— الشجرة والعرض ———
  tree: ['الشجرة التفاعلية', 'تصفّح الأنساب بالضغط على «+» لفتح أبناء أي شخص و«−» لطيّهم.\nاضغط الاسم لفتح ملفه الكامل.'],
  hierarchy: ['العرض الهرمي', 'عرض منظّم للشجرة على شكل بطاقات متدرّجة بالألوان حسب الجيل.\n• «توسيع الكل» يفتح كل الفروع.\n• «طباعة / PDF» يصدّر الشجرة كاملة.'],
  outline: ['نموذج الأعمدة', 'عرض الشجرة بأعمدة (كل جيل في عمود) — نفس شكل ملف Excel، ومناسب للطباعة.'],
  descendants: ['فهرس الذرية', 'قائمة مرقّمة بكل ذرية الشخص بنظام أنساب هرمي.\n\nكيف تقرأ الرقم بجوار الاسم؟\n• كل رقم يُمثّل جيلاً، وقيمته = ترتيب الشخص بين إخوته.\n• كلّما طال الرقم نزلنا جيلاً للأسفل.\n\nمثال: لو كان الجذر «فراج»:\n• ‎1‎ = فراج نفسه (الجذر).\n• ‎1‑2‎ = ابن فراج الثاني.\n• ‎1‑2‑1‎ = أوّل أبناء (1‑2)، أي حفيد فراج.\n• ‎1‑2‑1‑3‎ = ثالث أبناء (1‑2‑1)، أي ابن الحفيد.\n\nأي: اقرأ الرقم من اليسار لليمين كسلسلة نسب من الجدّ نزولاً، وآخر رقم هو ترتيبه بين إخوته.\n\nالصفوف ذات الخلفية الملوّنة = آباء لهم ذرية، وتحتها أبناؤهم مُزاحون قليلاً.\n\nومن هذا الفهرس تُصدّر Excel ملوّن أو PDF أو نص مرقّم.'],
  kinship: ['حاسبة صلة القرابة', 'اختر شخصين فتُحسب صلة القرابة بينهما تلقائياً:\n• الجدّ المشترك الأقرب بينهما.\n• نوع الصلة (أخوان، عمّ وابن أخ، ابنا عمّ…).\n• مسار النسب لكلٍّ منهما حتى الجدّ المشترك.\n\nالحساب يعتمد على سلسلة الآباء المسجّلة. اضغط «↕️ تبديل» لقلب الترتيب، و«مسح» لإعادة الاختيار.'],
  // ——— إضافة وتعديل ———
  add_person: ['إضافة مولود', 'الخطوات:\n١) اختر الأب من الشجرة.\n٢) اكتب اسم المولود.\n٣) (اختياري) أضف بقية البيانات.\n٤) اضغط «إضافة المولود».\n\nيُحدَّد الفرع تلقائياً من فرع الأب.'],
  add_father: ['الأب المباشر', 'اضغط «اختيار الأب» وابحث عن والد المولود.\nيُحدَّد فرع المولود تلقائياً من فرع أبيه.\n\nمشرف الفرع يختار أباً ضمن فرعه فقط.'],
  add_status: ['الحالة', 'حي أو متوفى.\nتظهر شارة «متوفى» فقط لمن حالته متوفى.'],
  add_work: ['الحالة الوظيفية', 'اختياري:\nلم تحدد (الافتراضي) / موظف / متقاعد.'],
  edit_lock: ['تعديل البيانات', 'يمكنك تعديل بيانات الشخص.\nحذف الأسماء متاح لمدير النظام فقط (مع تأكيد)، وتُحفظ نسخة في سلة المحذوفات للتراجع.'],
  // ——— الأدوات ———
  bulk: ['التعديل الجماعي', 'لتعديل عدّة أشخاص دفعة واحدة:\n١) حدّد المجموعة (الجيل أو ضمن جدّ).\n٢) اختر الحقل (الحالة/المدينة…) وقيمته.\n٣) تظهر الأسماء كلها مؤشّرة — أزل تأشير من لا تريد.\n٤) طبّق على المحدّدين.\n\nملاحظة: عند تعديل الجوال أو الحالة الوظيفية أو المدينة أو سنة الميلاد، تظهر أسماء المتوفّين بلا إمكان اختيار لأنها لا تخصّهم.'],
  grid: ['تعديل البيانات بالقائمة', 'لتعديل بيانات كل فرد على حدة ضمن جدٍّ واحد:\n١) اختر الجدّ — تظهر ذرّيته من الأحياء فقط.\n٢) أشّر الحقول التي تريد تعديلها (الحالة/المدينة/الجوال…).\n٣) عدّل قيمة كل فرد في القائمة، ثم «حفظ التعديلات».\n\nيُسجَّل من قام بالتعديل، ويمكن التراجع من سجل التعديلات. مشرف الفرع يعدّل ضمن فرعه فقط.'],
  review: ['مراجعة البيانات', 'عرض للمراجعة فقط (دون تعديل) لبيانات الأحياء ضمن جدٍّ تختاره، مع إظهار آخر من عدّل كل حقل ومتى — لمراجعة دقّة البيانات.'],
  dups: ['كشف الأسماء المكرّرة', 'يعرض الحالات التي تكرّر فيها اسمٌ واحد لأكثر من ابنٍ لنفس الأب — لمراجعتها وتصحيحها.\n\nلا يُحتسب التكرار إن كان أحد المتشابهين متوفّى؛ فقط عندما يكون الاثنان من الأحياء.'],
  feedbacks: ['ملاحظات الزوّار الواردة', 'صندوق الملاحظات وطلبات إضافة المواليد التي يرسلها الزوّار.\n\nتقدر تقبل الطلب أو ترفضه أو تضع علامة «تم».\nمشرف الفرع يرى ما يخصّ فرعه فقط (مواليد فرعه وملاحظاته).'],
  import: ['استيراد Excel', 'لإدخال الشجرة كاملة من ملف Excel مرة واحدة:\nكل عمود = جيل (العمود الأقصى يميناً = الأصل).\nالأسماء المتتالية في نفس العمود = إخوة.\n\nيتجاهل جدول الإحصائيات في نهاية الملف تلقائياً. راجع المعاينة قبل التنفيذ.'],
  branches: ['الفروع', 'الفرع = جدّ معيّن وكل ذريّته، له مشرف أو أكثر.\nالمدير يعيّن أي جدّ كفرع ويحدّد مشرفيه.\nكل مشرف يرى ويضيف في فرعه فقط.'],
  branch_root: ['جذر الفرع (الجدّ)', 'الجدّ الذي يبدأ منه الفرع.\nعند الحفظ يُضمّ هو وكل ذريّته إلى هذا الفرع تلقائياً.'],
  branch_sup: ['المشرفون', 'أشّر عضواً أو أكثر للإشراف على الفرع.\nالمشرف يضيف ويعدّل أفراد فرعه فقط، ولا يرى الفروع الأخرى.'],
  backups: ['النسخ الاحتياطية', 'احفظ نسخة كاملة من كل البيانات في أي وقت (للأمان).\nتقدر تنزّلها كملف أو ترجع لها لاحقاً.\nأخذ نسخة لا يؤثّر على بياناتك الحالية.'],
  audit: ['سجل التعديلات', 'سجلّ كامل: كل إضافة أو تعديل على الأسماء، مع اسم من قام بها ووقتها.'],
  trash: ['سلة المحذوفات', 'تحفظ النسخ السابقة من البيانات المعدّلة، فتقدر تتراجع عن أي تعديل.'],
  export: ['التصدير', 'نزّل البيانات كملف:\n• Excel ملوّن منسّق.\n• CSV للجداول.\n• PDF للطباعة.'],
  // ——— المستخدمون والصلاحيات ———
  members: ['الأعضاء والصلاحيات', 'إدارة الحسابات: تفعيل/إيقاف، تحديد الدور والفروع، وتعديل البيانات.\nمن هنا أيضاً تتحكّم في فتح الموقع للعموم ونص الرئيسية.'],
  add_user: ['إضافة عضو', 'أنشئ حساباً جديداً:\nالاسم + الجوال + رقم سري.\nثم اختر الدور (مدير/مشرف فرع/زائر) والفروع.\nيُفعّل مباشرةً.'],
  control_panel: ['لوحة التحكم', 'كل وظائف مدير النظام في مكان واحد بتبويبات:\nالأعضاء والصلاحيات • النصوص (نص الرئيسية وتعريف الألوان) • التعليمات • سجل التعديلات • سلة المحذوفات • النسخ والتصدير.'],
  guest_browse: ['فتح الموقع للزوّار', 'مفتوح = يدخل أي زائر مباشرةً للتصفّح (قراءة فقط) دون شاشة دخول.\nمغلق = تظهر شاشة الدخول للجميع.\n\nالزائر لا يضيف ولا يعدّل ولا يحذف، وتقدر تحدّد ما يُخفى عنه (الجوال، الصور والمستندات، الملاحظات والحالة الوظيفية).\n\nدخول المدير/المشرف: من «المزيد ← دخول المسؤول / مشرف الفرع».'],
  member_role: ['الأدوار', 'مدير النظام: صلاحية كاملة على كل شيء.\nمشرف فرع: يضيف ويعدّل في فروعه فقط.\nزائر: يتصفّح ويبحث فقط.'],
  member_edit: ['تعديل بيانات العضو', 'عدّل اسم الدخول أو جواله أو كلمة مروره.\nيعمل لأي حساب بما فيهم المدير.'],
  profile: ['ملفي الشخصي', 'عدّل اسمك وجوالك وكلمة مرورك.\n⚠️ تغيير الجوال يعني الدخول لاحقاً بالرقم الجديد — احفظه.'],
  banner: ['نص الرئيسية', 'النص الذي يظهر أعلى الصفحة الرئيسية لكل المستخدمين (مثل تعريف القبيلة).'],
  occasion: ['كلمة المناسبات (شاشة الدخول)', 'كلمة قصيرة تظهر تحت عنوان شاشة الدخول مباشرةً بخطٍّ غامق وباللون الذي تختاره. اتركها فارغة لإخفائها.\n\nوهي غير «تهنئة المناسبات» التي تظهر بعد الدخول.'],
  congrats: ['تهنئة / مبارَكة المناسبات', 'رسالة تهنئة من الإدارة تظهر لكل من يدخل فور الدخول (في الجزء الأوسط العلوي) مرّةً واحدة لكل جلسة، وكشريط ذهبي أعلى الرئيسية طوال مدّة العرض.\n\n• النص + لون الخط الذي تختاره.\n• وقت النشر: «الآن مباشرة»، أو «بتوقيت محدّد» فتظهر حقول اليوم والساعة لتبدأ في موعدها.\n• مدّة العرض: رقم + وحدة (ساعة/يوم)، أو اتركها فارغة لعرضٍ دائم حتى الإيقاف.\n• «حفظ/تعديل» لتحديثها، و«حذف التهنئة» لإيقافها وإزالتها.\n\nالحالة أسفل البطاقة تبيّن: مجدوَلة (تبدأ…)، أو فعّالة (حتى…)، أو منتهية.'],
  site_title: ['عنوان الموقع و«powered by»', 'عنوان الموقع يظهر في شاشتَي الدخول (الزائر والمسؤول) وفي تذييل «المزيد». وسطر «powered by» سطرُ إسنادٍ صغير أسفل العنوان — اتركه فارغاً لإخفائه.'],
  feedback_card: ['بطاقة «ملاحظات الزوار»', 'النص التعريفي داخل بطاقة إرسال الملاحظة في الرئيسية — يشجّع الزائر على الإبلاغ عن خطأ أو طلب إضافة مولود.'],
  guest_prompt: ['دعوة الزائر للدخول', 'الجملة التي تظهر للزائر فوق حقل كتابة الاسم في شاشة الدخول، تحثّه على كتابة اسمه بالتسلسل.'],
  feedback_thanks: ['رسالة الشكر بعد الملاحظة', 'تظهر للزائر في نافذةٍ بعد إرساله ملاحظته، لطمأنته أنها وصلت الإدارة.'],
  guest_ok: ['ترحيب الزائر — عند النجاح', 'الرسالة التي تظهر للزائر بعد مطابقة اسمه بالشجرة (الترحيب بعد الدخول). اكتب {name} مكان اسم الزائر فيُستبدل تلقائياً باسمه.'],
  guest_fail: ['ترحيب الزائر — عند الفشل', 'الرسالة التي تظهر إذا لم يُطابَق الاسم بالشجرة. اكتب {name} مكان اسم الزائر.'],
  status_labels: ['تعريف ألوان الحالة', 'مسمّيات دلالة الألوان التي تظهر أسفل قوائم الشجرة: الاسم بلونٍ عادي (حي)، رمادي (متوفّى وله ذرية)، أحمر (متوفّى ولم يعقب). عدّل المسميات كما تريد.'],
  feedback_send: ['ملاحظات الزوّار', 'من هنا تُرسل ملاحظةً للإدارة: تصحيح خطأ، أو طلب إضافة مولود، أو أي اقتراح. يُؤخذ اسمك الذي دخلت به تلقائياً، وتصل ملاحظتك للمدير (وللمشرف ما يخصّ فرعه)، ثم تُراجَع ويُردّ عليها.'],
};
function hintBtn(key) { return `<button type="button" class="hint-i" data-hint="${key}" aria-label="تعليمات">i</button>`; }
function showHint(key) { const h = HINTS[key]; if (!h) return; openModal('💡 ' + h[0], `<div class="hint-body">${esc(h[1]).replace(/\n/g, '<br>')}</div>`); }
// ربط عام لأزرار (i) — يُستدعى ضمن bindGo فيغطّي كل الشاشات.
function bindHints(root) { (root || document).querySelectorAll('[data-hint]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showHint(b.dataset.hint); })); }
function fSelect(label, id, options, selected, blank) {
  const opts = (blank ? `<option value="">${blank}</option>` : '') + options.map(o => `<option value="${o.k}" ${String(o.k) === String(selected) ? 'selected' : ''}>${esc(o.ar)}</option>`).join('');
  return `<div class="field"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
// ===== نوافذ تأكيد/إدخال أنيقة (تعِد Promise) =====
function uiDialog({ title, message, okText = 'تأكيد', cancelText = 'إلغاء', danger = false, input = null }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const inputHtml = input
      ? `<input id="dlgInput" class="dlg-input" type="text" placeholder="${esc(input.placeholder || '')}" autocomplete="off">`
      : '';
    root.innerHTML = `<div class="dlg-bg">
      <div class="dlg" role="dialog" aria-modal="true">
        <div class="dlg-icon ${danger ? 'danger' : ''}">${danger ? '⚠️' : '❓'}</div>
        ${title ? `<div class="dlg-title">${esc(title)}</div>` : ''}
        <div class="dlg-msg">${esc(message).replace(/\n/g, '<br>')}</div>
        ${inputHtml}
        <div class="dlg-actions">
          <button class="btn outline" id="dlgCancel">${esc(cancelText)}</button>
          <button class="btn ${danger ? 'danger' : ''}" id="dlgOk">${esc(okText)}</button>
        </div>
      </div></div>`;
    const close = (val) => { root.innerHTML = ''; resolve(val); };
    const okBtn = document.getElementById('dlgOk');
    const inp = document.getElementById('dlgInput');
    document.getElementById('dlgCancel').addEventListener('click', () => close(input ? null : false));
    okBtn.addEventListener('click', () => close(input ? (inp ? inp.value : '') : true));
    root.querySelector('.dlg-bg').addEventListener('click', (e) => { if (e.target.classList.contains('dlg-bg')) close(input ? null : false); });
    if (inp) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') okBtn.click(); }); }
  });
}
// تأكيد بسيط أنيق (يستبدل confirm)
function confirm2(message, opts = {}) {
  return uiDialog({ title: opts.title || 'تأكيد', message, okText: opts.okText || 'متابعة', danger: opts.danger !== false, ...opts });
}
// تذكير المسؤولية للمشرف عند أي إضافة/تعديل (يُسجَّل باسمه) — المدير لا يُذكَّر.
async function responsibilityOk() {
  if (isAdmin()) return true;
  return await confirm2('هذا التعديل أو الإضافة سيُسجَّل باسمك وعلى مسؤوليتك. تأكّد من صحّة المعلومة قبل اعتمادها.', { title: 'تأكيد المسؤولية', okText: 'أعتمد على مسؤوليتي', danger: false });
}
// إدخال نصّي أنيق (يستبدل prompt) — يُرجع النص أو null
function uiPrompt(message, opts = {}) {
  return uiDialog({ title: opts.title || '', message, okText: opts.okText || 'تأكيد', danger: !!opts.danger, input: { placeholder: opts.placeholder || '' } });
}
function fmtDateTime(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('ar', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }
function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return iso; } }

// تطبيع النص العربي للبحث (إزالة التشكيل وتوحيد الهمزات/الألف/التاء المربوطة)
function normalizeAr(s) {
  return String(s || '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ـ/g, '')
    .replace(/\s+/g, '')
    .trim().toLowerCase();
}

/* ===== الحالة العامة ===== */
let sb = null;
let me = null;
let _authUid = null;   // هوية الجلسة الحالية — لتجاهل أحداث المصادقة المتكررة
let imported = false;
let guestOpen = false;    // إتاحة زر «تصفّح كزائر» بحساب زائر مدمج (قراءة فقط)
let guestGens = 0;        // عدد الأجيال المطلوبة للتحقق قبل دخول الزائر (0 = بلا تحقّق)
// بنك الردود الجاهزة (لكل موضوعٍ ردوده) — يحرّره المدير من «النصوص»، ويستعمله المشرف للرد باسم الإدارة
const DEFAULT_REPLY_BANK = {
  'إضافة مولود': ['شكراً لإضافتك وتم إجراء اللازم', 'شكراً لإضافتك وهي محل اهتمامنا'],
  'ملاحظة': ['شكراً لاهتمامك، ملاحظتك محل اهتمامنا'],
  'اقتراح': ['شكراً لاهتمامك، اقتراحك محل اهتمامنا'],
  'إعادة ترتيب الإخوان': ['تم اعتماد الترتيب المقترح وتطبيقه — شكراً لمساهمتك', 'شكراً لاهتمامك — لم يُعتمد الترتيب المقترح حالياً'],
};
let replyBank = JSON.parse(JSON.stringify(DEFAULT_REPLY_BANK));
let settingsOk = false;   // نجح تحميل الإعدادات من القاعدة؟ (فشلها الكامل = مشكلة اتصال، لا «موقع مغلق»)
let _dbProxied = false;   // الاتصال يمرّ عبر وسيط الموقع /sbdb (لشبكاتٍ تحجب نطاق القاعدة مباشرة)
const GUEST_HIDE_DEFAULT = { phone: true, media: true, notes: true };  // ما يُخفى عن الزائر افتراضياً
let guestHide = { ...GUEST_HIDE_DEFAULT };
let recentSince = '';      // تاريخ تصفير «آخر الإضافات» (ISO) — يُحدّده المدير
let recentShow = true;
const txOpen = new Set([0]);   // مجموعات «النصوص» المفتوحة (الأولى مفتوحة افتراضياً)     // إظهار بطاقة «آخر الإضافات» بالرئيسية — يتحكم بها المدير من زرٍّ على البطاقة
let visitStats = { total: 0, byBranch: {}, byCity: {} };   // إحصاء زيارات الزوّار (من الإعدادات)
let onlineNow = 0;                 // عدد المتواجدين الآن (من مسار التواجد)
let onlineByBranch = {};           // تفصيلهم حسب الفرع
let _presenceTimer = null;
const DEFAULT_BANNER = 'المفرجي قبيلة من ولد حسين من الصواعد من عوف من حرب';
let bannerText = DEFAULT_BANNER;
let bannerSize = '';   // حجم خطّ لوحة التعريف (يحدّده المدير)؛ فارغ = الافتراضي
// وثيقة لزمة ولد حسين — عنوان ووصف قابلان للتعديل من «النصوص»
const DEFAULT_DOC_TITLE = 'وثيقة لزمة ولد حسين سنة ١١٧٣هـ في فارع الناصبية';
const DEFAULT_DOC_CAPTION = 'لزمة ولد حسين في فارع الناصبية سنة ١١٧٣هـ — وردت فيها رؤوس الفروع، ولزيم المفارجة منها سفران المفرجي.';
let docTitle = DEFAULT_DOC_TITLE, docCaption = DEFAULT_DOC_CAPTION;
// قسم الوثائق: مصفوفة [{title,url,text}] — يديرها المدير (إضافة/تعديل/حذف).
let tribeDocs = [];
// نصّ المشاركة (زرّ المشاركة) — قابل للتعديل من «النصوص»
const DEFAULT_SHARE_TITLE = 'المفارجة — شجرة العائلة';
const DEFAULT_SHARE_TEXT = 'تصفّح شجرة قبيلة المفارجة';
let shareTitle = DEFAULT_SHARE_TITLE, shareText = DEFAULT_SHARE_TEXT;
const DEFAULT_FB_THANKS = 'شكراً لك 🌿\nتم إرسال ملاحظتك، وهي محل اهتمامنا.';
let feedbackThanks = DEFAULT_FB_THANKS;
const DEFAULT_GUEST_OK = 'مرحباً بك يا ابن العم {name} 🌿\nداخل مكانك وبين ربعك وجماعتك.. نسعد بوجودك';
const DEFAULT_GUEST_FAIL = 'مرحباً بك يا {name} 🙏\nنأسف، الاسم غير مسجّل — تأكّد من كتابة اسمك الصحيح بالتسلسل.';
let guestWelcomeOk = DEFAULT_GUEST_OK;
let guestWelcomeFail = DEFAULT_GUEST_FAIL;
// نصوص واجهة قابلة للتعديل من «التحكم ← النصوص» (تظهر للزائر والجميع).
const DEFAULT_SITE_TITLE = 'قاعدة بيانات قبيلة المفارجة';
const DEFAULT_SITE_POWERED = 'powered by Mohamad Shaman almfrji';
const DEFAULT_HOME_HERO = 'شجرة المفارجة';
const DEFAULT_FB_CARD = 'لاحظت خطأً في اسم أو نسب؟ أو لديك إضافة أو تصحيح؟ أرسل ملاحظتك للإدارة وستُراجَع.';
const DEFAULT_FB_CARD_TITLE = 'ملاحظتك تهمنا';
const DEFAULT_GUEST_PROMPT = 'اكتب اسمك ثم أباك ثم جدّك للدخول';
let siteTitle = DEFAULT_SITE_TITLE;
let sitePowered = DEFAULT_SITE_POWERED;
let homeHero = DEFAULT_HOME_HERO;
let feedbackCardText = DEFAULT_FB_CARD;
let feedbackCardTitle = DEFAULT_FB_CARD_TITLE;
let guestPrompt = DEFAULT_GUEST_PROMPT;
// كلمة المناسبات: تظهر تحت عنوان شاشة الدخول بخط غامق، نصّها ولونها من «التحكم ← النصوص».
let occasionText = '';
let occasionColor = '#c0392b';
const okColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c || '')) ? c : '#c0392b');
// ===== تهنئة/مبارَكة المناسبات: رسالة من الإدارة تظهر فور الدخول وكشريط بالرئيسية طوال مدّتها =====
let congrats = null;   // { text, color, mode:'now'|'sched', start:ISO|null, days:number, savedAt:ISO }
function dtLocalValue(d) { d = d ? new Date(d) : new Date(); if (isNaN(d)) d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtDateTime(ms) { const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} الساعة ${p(d.getHours())}:${p(d.getMinutes())}`; }
function congratsWindow(c) {
  if (!c || !c.text) return null;
  const startMs = (c.mode === 'sched' && c.start) ? new Date(c.start).getTime() : (c.savedAt ? new Date(c.savedAt).getTime() : Date.now());
  const start = isNaN(startMs) ? Date.now() : startMs;
  const unitMs = (c.durUnit === 'd') ? 86400000 : 3600000;   // الافتراضي بالساعات
  let durMs = 0;
  if (c.durValue != null && c.durValue !== '') durMs = Math.max(0, parseInt(c.durValue, 10) || 0) * unitMs;
  else if (c.days != null) durMs = Math.max(0, parseInt(c.days, 10) || 0) * 86400000;   // توافق مع نسخة سابقة (أيام)
  const end = durMs > 0 ? start + durMs : Infinity;
  return { start, end };
}
function congratsActive() {
  if (!congrats || !congrats.text) return null;
  const w = congratsWindow(congrats); if (!w) return null;
  const now = Date.now();
  return (now >= w.start && now < w.end) ? congrats : null;
}
function congratsStatusText(c) {
  if (!c || !c.text) return 'متوقّفة — لا تظهر.';
  const w = congratsWindow(c), now = Date.now();
  if (now < w.start) return '⏳ مجدوَلة — تبدأ ' + fmtDateTime(w.start) + (w.end < Infinity ? '، وتنتهي ' + fmtDateTime(w.end) : '، بلا نهاية حتى توقفها');
  if (now >= w.end) return '✔️ انتهت مدّة عرضها.';
  return '🟢 فعّالة الآن' + (w.end < Infinity ? '، حتى ' + fmtDateTime(w.end) : '، بلا نهاية حتى توقفها');
}
// عنوان شارة التهنئة حسب اختيار الإدارة: افتراضي «🎊 تهنئة من الإدارة» / مخصّص / بدون عنوان («»).
const DEFAULT_CONGRATS_TITLE = '🎊 تهنئة من الإدارة';
function congratsTitle(c) {
  const m = (c && c.titleMode) || 'default';
  if (m === 'none') return '';
  if (m === 'custom') return (c && c.title) ? String(c.title) : '';
  return DEFAULT_CONGRATS_TITLE;
}
// الصفحة التعريفية (HTML منسّق) — يحرّرها المدير من «التحكم ← الصفحة التعريفية».
const DEFAULT_ABOUT =
  '<p class="about-eyebrow">نبذة تعريفية</p>' +
  '<h2>قبيلة المفارجة من ولد حسين</h2>' +
  '<hr>' +
  '<p>المفارجة وواحدهم (مَفْرَجي) — ولا زال المفرجي متمسكاً بالمسمّى القديم — وتنحدر من قبيلة وَلَد حسين (وواحدهم حُسَيني) المنحدرة من الصواعد من عوف من قبيلة حرب.</p>' +
  '<p>ديارهم الأصلية جنوب المدينة المنورة: الناصبية والمضحاة، وهي أسفل المَلحة والمسيل العائر إلى الحرّة غرب اليتمة، وتواجدهم مع بقية فروع ولد حسين في ديارهم وتداخلهم ينمّ عن وحدةٍ وترابطٍ بينهم.</p>' +
  '<p>وديار ولد حسين عامةً هي المدينة المنورة، ممتدةً جنوباً بين جبالها وشعابها؛ ومن ديارهم: الناصبية وخُلص واللثامة وجبال الرّاء والعشيرة والملحة وغيرها من جبال جنوب المدينة. أمّا الآن فقد توسّعت ديار ولد حسين غرباً وشرقاً.</p>' +
  '<p>وقد ذُكِرَ كثيرٌ من فروع ولد حسين باسمها القديم أو باسم لزيمها (أي ضامن جماعته) في وثيقة لزمة ولد حسين في فارع الناصبية سنة ١١٧٣هـ. ولزيم المفارجة من ولد حسين الوارد في الوثيقة هو سفران المفرجي، وكان وقت تسطير هذه الوثيقة (١١٧٣هـ) وجودُ الإخوة وأبناء عمومتهم الثمانية، وهم رؤوس الفروع الحالية التي تصل ما بين الجيل الخامس إلى العاشر عند كتابة هذه السطور في طبعة المشجّرة الثالثة لعام ١٤٤٦هـ. وكان سفران لزيم جماعته (المفارجة من ولد حسين) في ذلك الوقت، وضامناً إلى الجيل الخامس في هذه الوثيقة.</p>' +
  '<p class="about-sign">،،، والله أعلم ،،،</p>';
let aboutHtml = DEFAULT_ABOUT;
const C = { persons: [], branches: [], members: [], documents: [] };
const TABLES = { persons: 'almfrje_persons', branches: 'almfrje_branches', members: 'almfrje_members', documents: 'almfrje_documents' };

// فهارس
let byId = new Map();
let kids = new Map();          // father_id -> [children]
let branchById = new Map();
let childCount = new Map();
let descCount = new Map();     // إجمالي الذرية
let branchCountMap = new Map(); // branch_id -> عدد أفراده (يُحسب مرّة في computeCounts)
let branchRootCache = new Map(); // bid -> جذر الفرع (تخزين، يُمسح في buildIndex)

const isAdmin = () => !!(me && me.role === 'admin' && me.is_active);
// «مشرف عام» = مشرف على كل الفروع (بصلاحيات يحدّدها المدير)؛ يندرج تحت isManager بنطاقٍ كامل.
const isGeneralManager = () => !!(me && me.role === 'general_manager' && me.is_active);
const isManager = () => !!(me && (me.role === 'branch_manager' || me.role === 'general_manager') && me.is_active);
const isViewer = () => !!(me && me.role === 'viewer');
// حساب الزائر المدمج المشترك (للتصفّح بلا تسجيل) — يُميَّز باسم المستخدم 'guest'.
const isGuestUser = () => !!(me && me.username === 'guest');
// اسم المستخدم الحالي للعرض/التوثيق: للعضو اسمه، وللزائر النسب الذي تحقّق به عند الدخول.
function currentUserName() {
  if (isGuestUser()) { try { return (sessionStorage.getItem('almfrje_guest_name') || '').trim(); } catch (e) { return ''; } }
  return (me && (me.full_name || me.username || me.phone)) || '';
}
// هل يُخفى عن الزائر (دور viewer) هذا الصنف من البيانات؟ what: phone | media | notes
const hideForGuest = (what) => isViewer() && !!guestHide[what];
// فروع المستخدم التي يُشرف عليها (يدعم القديم branch_id + الجديد branch_ids[])
function myBranches() {
  if (!me) return [];
  const arr = Array.isArray(me.branch_ids) ? me.branch_ids.map(Number) : [];
  if (me.branch_id) arr.push(Number(me.branch_id));
  const set = [...new Set(arr.filter(Boolean))];
  // مشرف عام بلا فروعٍ محدّدة = كل الفروع؛ ومع تحديد فروع = يقتصر عليها (كالمشرف الفرعي).
  if (me.role === 'general_manager' && set.length === 0) return C.branches.map(b => Number(b.id));
  return set;
}
const myBranch = () => { const b = myBranches(); return b.length ? b[0] : null; };
const myPerm = (k) => !!(me && me.perms && me.perms[k]);
// هل ينتمي هذا الشخص لأحد فروع المستخدم؟ نتحقّق بطريقتين معاً (الأقوى):
//  ١) تطابق branch_id مع فروع المستخدم، أو
//  ٢) أن يكون ضمن الشجرة الفرعية لأحد جذور فروعه (يعالج أي تفاوت في branch_id).
function inMyBranch(p) {
  if (!p) return false;
  const mine = myBranches();
  if (p.branch_id != null && mine.includes(Number(p.branch_id))) return true;
  // اصعد بالآباء؛ إن وصلنا لجذر أحد فروعي فهو ضمن فرعي
  const myRootIds = new Set(mine.map(bid => { const r = branchRoot(bid); return r ? r.id : null; }).filter(v => v != null));
  let cur = p, guard = 0;
  while (cur && guard++ < 60) { if (myRootIds.has(cur.id)) return true; cur = cur.father_id ? byId.get(cur.father_id) : null; }
  return false;
}
// هل يوجد ابن بنفس الاسم لنفس الأب؟ (يتجاهل اختلاف التشكيل/الهمزات) — excludeId لاستثناء الشخص نفسه عند التعديل.
function siblingNameExists(father, name, excludeId) {
  const fid = father ? father.id : null;
  const norm = normalizeAr((name || '').trim());
  if (!norm) return false;
  const sibs = fid ? childrenOf(fid) : roots();
  return sibs.some(c => c.id !== excludeId && normalizeAr(c.name) === norm);
}
// الإخوة الذين يحملون نفس الاسم (مطبَّعاً) لنفس الأب — للتمييز بين تكرار على حيّ (ممنوع) أو متوفّى (مسموح بتأكيد).
function sameNameSiblings(father, name, excludeId) {
  const fid = father ? father.id : null;
  const norm = normalizeAr((name || '').trim());
  if (!norm) return [];
  const sibs = fid ? childrenOf(fid) : roots();
  return sibs.filter(c => c.id !== excludeId && normalizeAr(c.name) === norm);
}
// الأدوار:
//  • مدير النظام: صلاحيات مفتوحة كاملة (بلا تحديد).
//  • مشرف فرع: الإضافة والتعديل ضمن فروعه/جدّه المصرّح له بها فقط (لا يتجاوزها).
//  • زائر: تصفّح فقط.
function canAddBirth() { return isAdmin() || (isManager() && mgrPerm('add_birth')); }   // مشرف الفرع يضيف في فروعه (بصلاحية)
// هل يجوز إضافة ابن لهذا الشخص تحديداً؟ لا للمتوفى، ولمشرف الفرع ضمن فرعه فقط.
function canAddChildTo(p) {
  if (!p) return false;
  if (p.status === 'dead') return false;       // المتوفى لا يُضاف له أبناء
  if (isAdmin()) return true;
  if (isManager()) return inMyBranch(p) && mgrPerm('add_birth');   // ضمن فرعه وبصلاحية
  return false;
}
function canEditPerson(p) { return isAdmin() || (isManager() && inMyBranch(p) && mgrPerm('edit_profile')); }
function canReorder(p) { return isAdmin() || (isManager() && inMyBranch(p) && mgrPerm('reorder')); }
function canApproveBirth() { return isAdmin() || (isManager() && mgrPerm('approve_birth')); }
function canAdd() { return canAddBirth(); }
function canExport() { return isAdmin() || isManager(); }
function canDelete() { return isAdmin(); }                    // الحذف للمدير فقط
// صلاحيات المشرف الدقيقة: المدير مفتوح؛ المشرف بلا صلاحيات محدّدة = الكل مفعّل (توافق رجعي).
const MGR_PERMS = [['add_birth', 'إضافة مولود'], ['approve_birth', 'تأكيد إضافة مولود'], ['reorder', 'تعديل ترتيب الأبناء'], ['edit_profile', 'تعديل الملف الشخصي (الجوال/الحالة/الحالة الوظيفية/المدينة…)']];
function mgrPerm(k) {
  if (isAdmin()) return true;
  if (!isManager()) return false;
  if (!me || !me.perms || Object.keys(me.perms).length === 0) return true;   // مشرف قديم بلا صلاحيات محدّدة
  return !!me.perms[k];
}

/* ===== طبقة البيانات ===== */
// جلب كل صفوف جدول عبر صفحات — Supabase يحدّ كل طلب بـ 1000 صف افتراضياً،
// وشجرتنا تتجاوز ذلك، فنكرّر بـ range حتى تنتهي الصفوف.
async function fetchAll(table, pageSize = 1000) {
  // الصفحة الأولى تكشف العدد الكلي، وبقية الصفحات تُجلب دفعةً واحدة بالتوازي (لا تتابع بطيء)
  const first = await sb.from(table).select('*', { count: 'exact' }).range(0, pageSize - 1);
  if (first.error) throw first.error;
  const out = (first.data || []).slice();
  const total = (typeof first.count === 'number' && first.count >= out.length) ? first.count : out.length;
  if (total > out.length) {
    const jobs = [];
    for (let from = pageSize; from < total; from += pageSize) jobs.push(sb.from(table).select('*').range(from, from + pageSize - 1));
    const rest = await Promise.all(jobs);
    for (const r of rest) { if (r.error) throw r.error; out.push(...(r.data || [])); }
  }
  return out;
}
// مصدر الأشخاص: المدير/المشرف يقرؤون الجدول كاملاً (يحتاجون الجوال للإدارة)،
// والزائر/المطّلع يقرأ منظوراً منقّى بلا (جوال/بريد/ملاحظات) إن وُجد — مع رجوع آمن للجدول.
async function fetchPersons() {
  const full = isAdmin() || isManager();
  if (full) return fetchAll('almfrje_persons');
  try { return await fetchAll('almfrje_persons_pub'); }
  catch (e) { return fetchAll('almfrje_persons'); }   // المنظور غير موجود بعد → رجوع
}
async function loadAll() {
  // الإعدادات تتوازى مع البيانات (كانت تتسلسل بعدها فتبطئ الدخول)
  const [pr, br, mr] = await Promise.all([
    fetchPersons().then(d => ({ data: d }), e => ({ error: e })),
    fetchAll('almfrje_branches').then(d => ({ data: d }), e => ({ error: e })),
    fetchAll('almfrje_members').then(d => ({ data: d }), e => ({ error: e })),
    loadSettings().catch(() => { /* */ }),
  ]);
  C.persons = pr.error ? [] : (pr.data || []);
  C.branches = br.error ? [] : (br.data || []);
  C.members = mr.error ? [] : (mr.data || []);
  buildIndex();
  // عدّاد صندوق الوارد لا يعطّل الدخول — يُجلب بالخلفية ويُحدّث شاراته وتنبيهه حال وصوله
  refreshInboxCount();
}
// جلب عدّاد الصندوق بالخلفية: يحدّث شارة «المزيد» ويطلق تنبيه الدخول (مرة لكل جلسة)
function refreshInboxCount() {
  if (!me || !me.is_active || !(isAdmin() || isManager())) { C.feedbackPending = 0; return; }
  // تنبيه بطلبات التسجيل الجديدة (بيانات الأعضاء محمّلة أصلاً — بلا نداء إضافي)
  try {
    if (isAdmin()) {
      const nr = C.members.filter(m => !m.is_active && m.role === 'viewer' && m.person_id).length;
      if (nr > 0 && sessionStorage.getItem('almfrje_reg_alerted') !== '1') {
        sessionStorage.setItem('almfrje_reg_alerted', '1');
        setTimeout(() => toast('👤 ' + nr + (nr === 1 ? ' طلب تسجيل' : ' طلبات تسجيل') + ' بانتظار تحققك وتفعيلك — لوحة التحكم ← الأعضاء'), 3200);
      }
    }
  } catch (e) { /* */ }
  fbApi('count').then(j => {
    C.feedbackPending = j.pending || 0;
    try { buildNav(); } catch (e) { /* */ }
    try {
      if (C.feedbackPending > 0 && sessionStorage.getItem('almfrje_inbox_alerted') !== '1') {
        sessionStorage.setItem('almfrje_inbox_alerted', '1');
        const n = C.feedbackPending;
        toast('📨 لديك ' + n + (n === 1 ? ' رسالة' : ' رسائل') + ' في صندوق الوارد بانتظار الحسم — المزيد ← صندوق الوارد');
      }
    } catch (e) { /* */ }
  }).catch(() => { C.feedbackPending = 0; });
}
// تحويل الاتصال إلى وسيط الموقع ‎/sbdb‎ — لشبكاتٍ تحجب نطاق القاعدة مباشرة (تحدث على أجهزة الكمبيوتر خاصة)
function switchDbToProxy() {
  _dbProxied = true;
  try { localStorage.setItem('almfrje_dbproxy', '1'); } catch (e) { /* */ }
  sb = window.supabase.createClient(location.origin + '/sbdb', window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY);
}
async function loadSettings() {
  for (let att = 0; att < 3; att++) {
    try {
      await loadSettingsOnce();
      settingsOk = true;
      // نجحنا عبر الوسيط؟ افحص بالخلفية إن عاد الوصول المباشر فارجع إليه في الفتحات القادمة (أسرع)
      if (_dbProxied) {
        try {
          fetch(window.ALMFRJE_CONFIG.SUPABASE_URL + '/auth/v1/health', { headers: { apikey: window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY }, cache: 'no-store' })
            .then(r => { if (r.ok) { try { localStorage.removeItem('almfrje_dbproxy'); } catch (e) { /* */ } } }).catch(() => { /* */ });
        } catch (e) { /* */ }
      }
      return;
    } catch (e) {
      settingsOk = false;
      if (!_dbProxied) switchDbToProxy();                                   // المحاولة التالية عبر وسيط الموقع
      else if (att < 2) await new Promise(r => setTimeout(r, 900));         // مهلة قصيرة ثم إعادة
    }
  }
}
async function loadSettingsOnce() {
  {
    const { data, error } = await sb.from('almfrje_settings').select('key,value');
    if (error) throw error;
    const map = {}; (data || []).forEach(r => map[r.key] = r.value);
    imported = map.imported === true;
    visitStats = (map.visit_stats && typeof map.visit_stats === 'object') ? map.visit_stats : { total: 0, byBranch: {}, byCity: {} };
    guestOpen = map.guest_open === true;
    guestGens = Number.isFinite(+map.guest_verify_gens) ? Math.max(0, parseInt(map.guest_verify_gens, 10) || 0) : 0;
    guestHide = Object.assign({ ...GUEST_HIDE_DEFAULT }, (map.guest_hide && typeof map.guest_hide === 'object') ? map.guest_hide : {});
    statLabels = Object.assign({ ...LABELS_DEFAULT }, (map.status_labels && typeof map.status_labels === 'object') ? map.status_labels : {});
    recentSince = typeof map.recent_since === 'string' ? map.recent_since : '';
    recentShow = map.recent_show !== false;   // الافتراضي: ظاهرة
    bannerText = typeof map.banner_text === 'string' ? map.banner_text : DEFAULT_BANNER;
    bannerSize = (typeof map.banner_size === 'string' && /^[0-9.]+rem$/.test(map.banner_size)) ? map.banner_size : '';
    docTitle = (typeof map.doc_title === 'string' && map.doc_title) ? map.doc_title : DEFAULT_DOC_TITLE;
    docCaption = (typeof map.doc_caption === 'string') ? map.doc_caption : DEFAULT_DOC_CAPTION;
    tribeDocs = Array.isArray(map.tribe_docs) ? map.tribe_docs.filter(d => d && d.url) : [{ title: docTitle, url: '/almfrje/lazma-1173.jpg', text: docCaption }];
    shareTitle = (typeof map.share_title === 'string' && map.share_title) ? map.share_title : DEFAULT_SHARE_TITLE;
    shareText = (typeof map.share_text === 'string' && map.share_text) ? map.share_text : DEFAULT_SHARE_TEXT;
    feedbackThanks = typeof map.feedback_thanks === 'string' && map.feedback_thanks ? map.feedback_thanks : DEFAULT_FB_THANKS;
    guestWelcomeOk = typeof map.guest_welcome_ok === 'string' && map.guest_welcome_ok ? map.guest_welcome_ok : DEFAULT_GUEST_OK;
    guestWelcomeFail = typeof map.guest_welcome_fail === 'string' && map.guest_welcome_fail ? map.guest_welcome_fail : DEFAULT_GUEST_FAIL;
    siteTitle = typeof map.site_title === 'string' ? map.site_title : DEFAULT_SITE_TITLE;   // فراغٌ محفوظ = مخفيّ
    sitePowered = typeof map.site_powered === 'string' ? map.site_powered : DEFAULT_SITE_POWERED;
    homeHero = typeof map.home_hero === 'string' && map.home_hero ? map.home_hero : DEFAULT_HOME_HERO;
    feedbackCardText = typeof map.feedback_card_text === 'string' && map.feedback_card_text ? map.feedback_card_text : DEFAULT_FB_CARD;
    feedbackCardTitle = typeof map.feedback_card_title === 'string' && map.feedback_card_title ? map.feedback_card_title : DEFAULT_FB_CARD_TITLE;
    guestPrompt = typeof map.guest_prompt === 'string' && map.guest_prompt ? map.guest_prompt : DEFAULT_GUEST_PROMPT;
    aboutHtml = typeof map.about_html === 'string' && map.about_html ? map.about_html : DEFAULT_ABOUT;
    replyBank = (map.reply_bank && typeof map.reply_bank === 'object' && !Array.isArray(map.reply_bank)) ? map.reply_bank : JSON.parse(JSON.stringify(DEFAULT_REPLY_BANK));
    occasionText = typeof map.occasion_text === 'string' ? map.occasion_text : '';
    occasionColor = okColor(map.occasion_color);
    congrats = (map.congrats && typeof map.congrats === 'object') ? map.congrats : null;
    // تطبيق نصوص التعليمات المعدّلة من الإعدادات فوق الافتراضية
    applyHintOverrides(map.hints_overrides);
  }
}
// نصوص التعليمات: نحتفظ بالافتراضية، ونطبّق تعديلات المدير فوقها.
const HINTS_DEFAULT = JSON.parse(JSON.stringify(HINTS));
function applyHintOverrides(ov) {
  // أعد للأصل أولاً ثم طبّق التعديلات (title يبقى، body يُستبدل)
  for (const k in HINTS_DEFAULT) HINTS[k] = [HINTS_DEFAULT[k][0], HINTS_DEFAULT[k][1]];
  if (ov && typeof ov === 'object') {
    for (const k in ov) { if (HINTS[k] && typeof ov[k] === 'string') HINTS[k][1] = ov[k]; }
  }
}
function buildIndex() {
  byId = new Map(); kids = new Map(); branchById = new Map(); branchRootCache = new Map();
  C.branches.forEach(b => branchById.set(b.id, b));
  C.persons.forEach(p => { p._n = normalizeAr(p.name + ' ' + (p.nickname || '')); p._ln = null; byId.set(p.id, p); });
  C.persons.forEach(p => { if (p.father_id != null) { if (!kids.has(p.father_id)) kids.set(p.father_id, []); kids.get(p.father_id).push(p); } });
  const cmp = (a, b) => (a.sort - b.sort) || (a.id - b.id);
  kids.forEach(arr => arr.sort(cmp));
  computeCounts();
}
function computeCounts() {
  childCount = new Map(); descCount = new Map(); branchCountMap = new Map();
  C.persons.forEach(p => {
    childCount.set(p.id, (kids.get(p.id) || []).length);
    if (p.branch_id != null) branchCountMap.set(p.branch_id, (branchCountMap.get(p.branch_id) || 0) + 1);
  });
  const byGenDesc = [...C.persons].sort((a, b) => b.generation - a.generation);
  for (const p of byGenDesc) {
    let s = 0; for (const c of (kids.get(p.id) || [])) s += 1 + (descCount.get(c.id) || 0);
    descCount.set(p.id, s);
  }
}
const childrenOf = (id) => (kids.get(id) || []);
const branchName = (bid) => bid && branchById.get(bid) ? branchById.get(bid).name : 'الجذع';
// الجذر الفعلي للفرع = الجدّ في الجيل الثاني (رأس الفرع). نصعد بالآباء من أي عضو
// حتى الجيل الثاني، فلا نعتمد على branch_id الذي قد يكون ناقصاً في بيانات قديمة.
function branchRoot(bid) {
  if (branchRootCache.has(bid)) return branchRootCache.get(bid);
  const b = branchById.get(bid); if (!b) { branchRootCache.set(bid, null); return null; }
  // ابدأ من root_id المخزّن إن وُجد، وإلا من أيّ عضو
  let start = b.root_id ? byId.get(b.root_id) : null;
  if (!start) { const mem = C.persons.find(p => p.branch_id === bid); if (!mem) { branchRootCache.set(bid, null); return null; } start = mem; }
  // اصعد بالأب حتى الوصول للجيل الثاني (رأس الفرع) أو الجذر الأعلى
  let cur = start, guard = 0;
  while (cur && cur.generation > 2 && cur.father_id && byId.has(cur.father_id) && guard++ < 60) {
    cur = byId.get(cur.father_id);
  }
  branchRootCache.set(bid, cur);
  return cur;
}
function roots() { return C.persons.filter(p => p.father_id == null || !byId.has(p.father_id)).sort((a, b) => a.generation - b.generation || a.id - b.id); }
function lineage(id) { const out = []; let p = byId.get(id); let guard = 0; while (p && guard++ < 60) { out.push(p); p = p.father_id ? byId.get(p.father_id) : null; } return out; }
function lineageShort(id, max = 4) {
  const ln = lineage(id); if (!ln.length) return '';
  const names = ln.map(p => p.name);
  let s = names.slice(0, max).join(' بن ');
  if (names.length > max) s += ' …';
  return s;
}
// نسب الآباء فقط (بدون اسم الشخص) — يُستخدم بعد عرض الاسم بخط غامق فلا يتكرّر.
function ancestryShort(id, max = 3) {
  const anc = lineage(id).slice(1).map(p => p.name);   // الآباء فقط (نُسقط الشخص نفسه)
  if (!anc.length) return '';
  return 'بن ' + anc.slice(0, max).join(' بن ') + (anc.length > max ? ' …' : '');
}
function descendants(id) { const out = []; const st = [...childrenOf(id)]; while (st.length) { const p = st.pop(); out.push(p); for (const c of childrenOf(p.id)) st.push(c); } return out; }
// تطبيع سلسلة نسب للمطابقة (مطابق لمنطق التحقق في الخادم): يتجاهل التشكيل/الهمزات/المسافات/«بن»/«ابن»/«ال».
function normGenChain(s) {
  const t = String(s || '').replace(/[ً-ْٰ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ـ/g, '');
  const parts = t.split(/\s+/).filter(w => w && w !== 'بن' && w !== 'ابن');
  return parts.join('').replace(/ال/g, '').toLowerCase();
}
function lineageMatchSig(id, n) { const ln = lineage(id).slice(0, n).map(x => x.name); return ln.length < n ? null : normGenChain(ln.join(' ')); }
// عدد الأشخاص غير المميَّزين (يتشاركون نفس سلسلة n أجيال) — يساعد المدير على اختيار عدد الأجيال للتحقق.
function nonUniqueAtDepth(n) {
  const cnt = new Map();
  C.persons.forEach(p => { const s = lineageMatchSig(p.id, n); if (s) cnt.set(s, (cnt.get(s) || 0) + 1); });
  let total = 0; cnt.forEach(c => { if (c > 1) total += c; });
  return total;
}
const maxGen = () => C.persons.reduce((m, p) => Math.max(m, p.generation || 1), 0);

async function refreshAndRender() { showLoading(true); try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); } showLoading(false); render(); }
async function guard(fn) {
  try { await fn(); } catch (e) {
    const msg = (e.message || ('' + e));
    let out;
    if (/rate limit|over_email_send/i.test(msg))
      out = 'تعذّر إنشاء الحساب: تجاوز حدّ إرسال البريد. أوقِف «تأكيد البريد» (Confirm email) في إعدادات مصادقة Supabase، ثم أعد المحاولة.';
    else if (/not confirmed|confirm.*email|email.*confirm|signups? .*disabled|Email signups are disabled|Database error saving new user/i.test(msg))
      out = 'تعذّر إنشاء الحساب: إعداد المصادقة يمنعه. أوقِف «تأكيد البريد» (Confirm email) في إعدادات Supabase ثم أعد المحاولة.';
    else if (/Could not find the table|schema cache|Could not find the .* column/i.test(msg))
      out = 'تعذّر الوصول لجدول/عمود في القاعدة (قد يكون المخطط قيد التحديث). أعِد المحاولة بعد لحظات أو أعد تحميل الصفحة.';
    else out = 'تعذّر الحفظ: ' + msg;
    toast(out);
    return false;
  }
  return true;
}
async function trashSnap(tbl, id, action, label) {
  try { const rec = byId.get(id); await sb.from('almfrje_trash').insert({ tbl, rec_id: id, action, label: label || '', data: rec, actor_name: (me && me.full_name) || '' }); } catch (e) { /* أفضل جهد */ }
}
// سجل التعديلات: يثبّت من أضاف/عدّل/حذف اسماً (أفضل جهد — لا يُفشل العملية).
// undoData (اختياري): {kind:'persons', items:[{id, prev:{...}}], label} لإتاحة التراجع لاحقاً من السجل.
// يعيد معرّف صف السجل (أو null) ليُربط به التراجع.
async function auditLog(action, personId, personName, undoData) {
  try {
    // «يحفظ آخر تعديل فقط»: عند تعديل شخص، تُحذف تعديلاته الأقدم فيبقى الأخير وحده.
    if (action === 'edit' && personId) {
      try { await sb.from('almfrje_audit').delete().eq('action', 'edit').eq('person_id', personId); } catch (e) { /* أفضل جهد */ }
    }
    const { data } = await sb.from('almfrje_audit').insert({
      action, person_id: personId || null, person_name: personName || '',
      actor_name: (me && (me.full_name || me.username || me.phone)) || '',
      undo_data: undoData || null,
    }).select('id').single();
    return data ? data.id : null;
  } catch (e) { return null; }
}
// يعيد القيم السابقة للأفراد (تجميعاً حسب القيمة لتسريع التنفيذ). يُستخدم من التراجع الفوري ومن السجل.
async function restorePersons(items) {
  const groups = new Map();
  for (const s of items) {
    const key = JSON.stringify(s.prev);
    if (!groups.has(key)) groups.set(key, { prev: s.prev, ids: [] });
    groups.get(key).ids.push(s.id);
  }
  for (const { prev, ids } of groups.values()) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await sb.from('almfrje_persons').update(prev).in('id', chunk);
      if (error) throw error;
    }
  }
}
async function markAuditUndone(id) {
  if (!id) return;
  try { await sb.from('almfrje_audit').update({ undone: true, undone_at: new Date().toISOString(), undone_by: (me && (me.full_name || me.username)) || '' }).eq('id', id); } catch (e) { /* تجاهل */ }
}

/* ===== التوجيه ===== */
function setHash(h) { location.hash = h; }
function goBack() { history.length > 1 ? history.back() : setHash('#/home'); }
const ROUTES = {
  home: { t: 'المفارجة', back: false, fn: screenHome },
  search: { t: 'البحث', back: false, fn: screenSearch },
  tree: { t: 'الشجرة', back: false, fn: screenTree },
  branches: { t: 'الفروع', back: false, fn: screenBranches },
  more: { t: 'المزيد', back: false, fn: screenMore },
  person: { t: 'الشخص', back: true, fn: screenPerson },
  descendants: { t: 'الذرية', back: true, fn: screenDescendants },
  'person-edit': { t: 'بيانات الشخص', back: true, fn: screenPersonEdit },
  branch: { t: 'الفرع', back: true, fn: screenBranch },
  hierarchy: { t: 'العرض الهرمي', back: true, fn: screenHierarchy },
  branchhier: { t: 'عرض الفرع', back: true, fn: screenBranchHier },
  outline: { t: 'نموذج الأعمدة', back: true, fn: screenOutline },
  timeline: { t: 'خط الأجيال', back: true, fn: screenTimeline },
  radial: { t: 'الشجرة الدائرية', back: true, fn: screenRadial },
  kinship: { t: 'حاسبة صلة القرابة', back: true, fn: screenKinship },
  printtree: { t: 'نسخة للطباعة', back: true, fn: screenPrintTree },
  printview: { t: 'نسخة للطباعة', back: true, fn: screenPrintView },
  import: { t: 'استيراد Excel', back: true, fn: screenImport },
  members: { t: 'الأعضاء والصلاحيات', back: true, fn: screenMembers },
  branchadmin: { t: 'الفروع والمشرفون', back: true, fn: screenBranchAdmin },
  bulk: { t: 'تعديل جماعي', back: true, fn: screenBulkEdit },
  grid: { t: 'تعديل البيانات بالقائمة', back: true, fn: screenGridEdit },
  review: { t: 'مراجعة البيانات', back: true, fn: screenGridReview },
  reorder: { t: 'ترتيب الأبناء', back: true, fn: screenReorder },
  audit: { t: 'سجل التعديلات', back: true, fn: screenAudit },
  hints: { t: 'تعديل التعليمات', back: true, fn: screenHints },
  texts: { t: 'النصوص', back: true, fn: screenTexts },
  settings: { t: 'الإعدادات', back: true, fn: screenSettings },
  control: { t: 'لوحة التحكم', back: true, fn: screenControl },
  discussions: { t: 'المناقشات', back: true, fn: screenTopics },
  topic: { t: 'مناقشة', back: true, fn: screenTopicChat },
  backups: { t: 'النسخ والتصدير', back: true, fn: screenBackups },
  profile: { t: 'ملفي الشخصي', back: true, fn: screenProfile },
  stats: { t: 'الإحصائيات', back: true, fn: screenStats },
  dups: { t: 'الأسماء المكرّرة', back: true, fn: screenDuplicates },
  feedback: { t: 'إرسال ملاحظة للإدارة', back: true, fn: screenFeedback },
  feedbacks: { t: 'صندوق الوارد', back: true, fn: screenFeedbacks },
  trash: { t: 'سلة المحذوفات', back: true, fn: screenTrash },
  about: { t: 'نبذة تعريفية', back: true, fn: screenAbout },
  document: { t: 'الوثائق', back: true, fn: screenDocuments },
  documents: { t: 'الوثائق', back: true, fn: screenDocuments },
  aboutedit: { t: 'الصفحة التعريفية', back: true, fn: screenAboutEdit },
  guide: { t: 'دليل الزوّار', back: true, fn: screenGuide },
  guideadmin: { t: 'تعليمات الإدارة', back: true, fn: screenGuideAdmin },
  faq: { t: 'الأسئلة الشائعة', back: true, fn: screenFaq },
};
function parseHash() { const raw = (location.hash || '#/home').replace(/^#\//, ''); const p = raw.split('/'); return { name: p[0] || 'home', arg: p[1] }; }
function render() {
  if (!me || !me.is_active) { renderPending(); return; }
  const { name, arg } = parseHash();
  const r = ROUTES[name] || ROUTES.home;
  try { view().dataset.screen = name; } catch (e) { /* */ }   // وسم الشاشة (للتنسيقات الخاصة بكل شاشة)
  document.getElementById('screenTitle').textContent = r.t;
  document.getElementById('backBtn').classList.toggle('hidden', !r.back);
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === '#/' + name));
  updateMoreBadge();
  document.querySelectorAll('.fab').forEach(f => f.remove());
  window.scrollTo(0, 0);
  r.fn(arg);
  bindHints(view());   // فعّل أزرار (i) في كل شاشة
  bindEyes(view());    // فعّل أزرار العين في كل شاشة
  // تبويبات لوحة التحكم (تظهر في شاشات المدير فقط)
  view().querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => setHash(b.dataset.go)));  guestOnboard();   // التسجيل الإجباري للزائر المتحقَّق (يلاحقه في كل الشاشات حتى يسجّل)
}
function addFab(label, onClick) { const f = document.createElement('button'); f.className = 'fab'; f.textContent = label; f.addEventListener('click', onClick); document.body.appendChild(f); }
// شريط تبويبات لوحة التحكم (للمدير) — كل شاشة إدارية تعرضه أعلاها.
const ADMIN_TABS = [
  ['members', '👥 الأعضاء', '#/members'],
  ['branchadmin', '🗂️ الفروع والمشرفون', '#/branchadmin'],
  ['settings', '⚙️ الإعدادات', '#/settings'],
  ['texts', '📝 النصوص', '#/texts'],
  ['aboutedit', '📖 الصفحة التعريفية', '#/aboutedit'],
  ['hints', '💡 التعليمات', '#/hints'],
  ['audit', '📋 سجل التعديلات', '#/audit'],
  ['trash', '🗑️ سلة المحذوفات', '#/trash'],
  ['backups', '💾 النسخ والتصدير', '#/backups'],
];
function adminTabBar(active) {
  // زر العودة لواجهة اللوحة (المربعات) يتصدّر الشريط

  if (!isAdmin()) return '';
  return `<div class="admin-tabs"><button class="admin-tab" data-go="#/control" title="لوحة التحكم">⌂</button>${ADMIN_TABS.map(([k, label, href]) => `<button class="admin-tab${k === active ? ' active' : ''}" data-go="${href}">${label}</button>`).join('')}</div>`;
}

/* ===== بطاقات ومكوّنات مشتركة ===== */
function avatar(p, lg) {
  const cls = 'avatar' + (lg ? ' lg' : '');
  const fallback = p && p.sex === 'female' ? '👩' : '👤';
  if (p && p.photo_url && !hideForGuest('media')) {
    // عند فشل تحميل الصورة (رابط معطّل/مجلّد غير عام) استبدلها بالأيقونة بدل إطار فارغ.
    return `<img class="${cls}" src="${esc(p.photo_url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'${cls}\\'>${fallback}</div>'">`;
  }
  return `<div class="${cls}">${fallback}</div>`;
}
function personCard(p) {
  const f = p.father_id ? byId.get(p.father_id) : null;
  return `<div class="card pc" style="padding:12px">
    <div style="display:flex;gap:10px;align-items:center">
      ${avatar(p)}
      <div style="flex:1;min-width:0">
        <div class="li-title"><span class="${nameCls(p)}"${nameTitle(p)}>${esc(p.name)}</span>${nickSuffix(p)}</div>
        <div class="li-sub">${f ? 'الأب: ' + esc(f.name) + ' • ' : ''}${esc(branchName(p.branch_id))} • جيل ${p.generation}</div>
        <div class="li-sub">الأبناء: ${childCount.get(p.id) || 0} • الذرية: ${descCount.get(p.id) || 0}</div>
      </div>
    </div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn sm" data-relations="${p.id}">🔗 نسبه وأحفاده</button>
      <button class="btn sm outline" data-go="#/person/${p.id}">الملف</button>
      <button class="btn sm outline" data-go="#/tree/${p.id}">الشجرة</button>
      ${canEditPerson(p) ? `<button class="btn sm outline" data-go="#/person-edit/${p.id}">تعديل</button>` : ''}
    </div></div>`;
}
function bindGo(root) {
  const r = root || view();
  r.querySelectorAll('[data-go]').forEach(c => c.addEventListener('click', () => setHash(c.dataset.go)));
  r.querySelectorAll('[data-relations]').forEach(c => c.addEventListener('click', () => relationsModal(parseInt(c.dataset.relations, 10))));
  bindHints(r);
}
// نافذة «نسبه وأحفاده»: سلسلة الآباء كاملة + الأبناء والأحفاد المتعلّقون به.
function relationsModal(id) {
  const p = byId.get(id); if (!p) return;
  // سلسلة الآباء (من الشخص صعوداً للأصل)
  const ln = lineage(id);   // [الشخص, أبوه, جدّه, ... الأصل]
  const chain = ln.map((x, i) => i === 0
    ? `<b>${esc(x.name)}</b>`
    : `<a href="#/person/${x.id}" class="rel-link">${esc(x.name)}</a>`).join('<span class="rel-sep"> بن </span>');
  // الأبناء وتحت كل ابن أحفاده المباشرون
  const kidsArr = childrenOf(id);
  const kidsHtml = kidsArr.length ? kidsArr.map(c => {
    const gk = childrenOf(c.id);
    return `<div class="rel-kid">
      <div class="rel-kid-name"><a href="#/person/${c.id}" class="rel-link">${esc(c.name)}</a>${gk.length ? `<span class="rel-count">${gk.length}</span>` : ''}</div>
      ${gk.length ? `<div class="rel-grand">${gk.map(g => `<a href="#/person/${g.id}" class="rel-gchip">${esc(g.name)}</a>`).join('')}</div>` : ''}
    </div>`;
  }).join('') : '<div class="muted">لا أبناء مسجّلون.</div>';

  openModal('🔗 ' + p.name, `
    <div class="rel-block">
      <div class="rel-h">سلسلة النسب</div>
      <div class="rel-chain">${chain}</div>
    </div>
    <div class="rel-block">
      <div class="rel-h">الأبناء (${kidsArr.length}) والأحفاد</div>
      <div class="rel-kids">${kidsHtml}</div>
    </div>
    <div class="rel-stats">إجمالي الذرية: <b>${descCount.get(id) || 0}</b> • الأحفاد: <b>${kidsArr.reduce((s, c) => s + (childCount.get(c.id) || 0), 0)}</b></div>
    <button class="btn" id="rel_open">فتح الملف الكامل</button>`, () => {
    document.getElementById('rel_open').addEventListener('click', () => { closeModal(); setHash('#/person/' + id); });
    document.querySelectorAll('#modalRoot .rel-link, #modalRoot .rel-gchip').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); closeModal(); setHash(a.getAttribute('href'));
    }));
  });
}

// الجدّ الأعلى (الجيل الأول) لشخص — يُستخدم لتجميع الفروع تحت أصلها (فراج/مفرج).
function topAncestor(id) { const ln = lineage(id); return ln.length ? ln[ln.length - 1] : null; }
// عرض كل الفروع مجمّعةً تحت كل أصل (جذر جيل-١) مع مجموع كل أصل.
// عدد أفراد الفرع = الأشخاص المنتمون له فعلاً (دقيق دائماً)
function branchCount(bid) { return branchCountMap.get(bid) || 0; }
// الفرع «القائم/الحيّ» = أنجب مؤسّسه (له ذرية)، أي فيه أكثر من الجدّ المؤسّس وحده.
// مثال: «سفران» لم ينجب فليس فرعاً قائماً — لا يُحتسب ولا يُعرض في قائمة الفروع.
function isLiveBranch(bid) { return branchCount(bid) > 1; }
function liveBranchCount() { return C.branches.filter(b => isLiveBranch(b.id)).length; }
function branchGroupsHtml() {
  if (!C.branches.length) return `<div class="card"><h3>الفروع</h3>${noItem()}</div>`;
  const groups = new Map();   // rootId -> { root, items:[{b,n}] }
  for (const b of C.branches) {
    if (!isLiveBranch(b.id)) continue;   // فرع لم ينجب (كسفران) ليس فرعاً قائماً — لا يُعرض
    const rootP = branchRoot(b.id);
    const top = rootP ? topAncestor(rootP.id) : null;
    const key = top ? top.id : 0;
    if (!groups.has(key)) groups.set(key, { root: top, items: [] });
    groups.get(key).items.push({ b, n: branchCount(b.id) });
  }
  // رتّب الأصول حسب إجمالي عددها تنازلياً
  const arr = [...groups.values()].map(g => ({ ...g, total: g.items.reduce((s, x) => s + x.n, 0) }))
    .sort((a, b) => b.total - a.total);
  return arr.map(g => {
    const head = g.root ? esc(g.root.name) : 'فروع';
    const items = g.items.sort((x, y) => y.n - x.n)
      .map(x => row(`<a href="#/branch/${x.b.id}" style="color:var(--brand);text-decoration:none">${esc(x.b.name)}</a><span class="br-online" data-bid="${x.b.id}"></span>`, x.n + ' فرد')).join('');
    return `<div class="card"><h3>${head} <span class="muted" style="font-weight:normal;font-size:.8rem">(${g.items.length} فروع • ${g.total} فرد)</span></h3>${items}</div>`;
  }).join('');
}

/* ===== لوحة التحكم ===== */
// بطاقة إحصائيات الزيارات (للجميع) — تفصيل حسب الفرع والمنطقة، بلا أزرار تصفير (التصفير في الإدارة).
function visitStatsCardHtml() {
  const vb = visitStats.byBranch || {}, vc = visitStats.byCity || {};
  const branchRows = Object.keys(vb).length
    ? Object.entries(vb).sort((a, b) => b[1] - a[1]).map(([bid, n]) => `<div class="row"><span class="k">🗂️ ${esc(branchName(Number(bid)))}</span><span class="v">${n}</span></div>`).join('')
    : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا زيارات مسجّلة بعد.</div>';
  const cityRows = Object.keys(vc).length
    ? Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div class="row"><span class="k">📍 ${esc(c)}</span><span class="v">${n}</span></div>`).join('')
    : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا مناطق مسجّلة بعد.</div>';
  return `<details class="card vstats">
    <summary>📊 إحصائيات الزيارات<span class="vstats-total">${visitStats.total || 0}</span></summary>
    <div class="li-sub" style="margin-top:10px;font-weight:800;color:var(--text)">حسب الفرع</div>${branchRows}
    <div class="li-sub" style="margin-top:10px;font-weight:800;color:var(--text)">حسب المنطقة (المدينة)</div>${cityRows}
  </details>`;
}
function screenHome() {
  const total = C.persons.length;
  // «آخر الإضافات»: ما أُضيف بعد آخر تصفير حدّده المدير (recentSince). إن لم يُصفَّر، تُعرض الأحدث.
  const sinceMs = recentSince ? Date.parse(recentSince) : 0;
  const isRecent = (p) => sinceMs ? (p.created_at && Date.parse(p.created_at) >= sinceMs) : true;
  const recentAll = [...C.persons].filter(isRecent).sort((a, b) => b.id - a.id);
  const recent = recentAll.slice(0, 12);
  const newCount = sinceMs ? recentAll.length : 0;   // عدد الإضافات منذ التصفير
  if (!total && isAdmin() && !imported) {
    view().innerHTML = `<div class="card"><h3>مرحباً بك في المفارجة 🌳</h3>
      <p class="muted">لم يتم استيراد البيانات بعد. ابدأ باستيراد ملف Excel (أعمدة = أجيال) مرة واحدة، أو أضِف الأشخاص يدوياً.</p>
      <button class="btn" data-go="#/import">📥 استيراد ملف Excel</button>
      <button class="btn outline" data-go="#/person-edit/0">➕ إضافة شخص يدوياً</button></div>`;
    bindGo(); return;
  }
  view().innerHTML = `
    ${(() => { const c = congratsActive(); if (!c) return ''; const t = congratsTitle(c); return `<div class="congrats-strip">${t ? `<span class="cs-badge">${esc(t)}</span>` : ''}<span class="cs-text" style="color:${okColor(c.color)}">${esc(c.text)}</span></div>`; })()}
    ${bannerText ? (() => {
      const long = bannerText.length > 160;
      const sz = /^[0-9.]+rem$/.test(bannerSize) ? ` style="font-size:${bannerSize}"` : '';
      return `<div class="banner"${sz}>
        <button class="about-i banner-i" data-go="#/about" title="نبذة تعريفية عن قبيلة المفارجة" aria-label="نبذة تعريفية">ⓘ</button>
        <div class="banner-text${long ? ' clamp' : ''}">${esc(bannerText)}</div>
        ${long ? '<button class="banner-more" data-go="#/about">المزيد…</button>' : ''}
      </div>`;
    })() : ''}
    ${!isGuestUser() && !pwChanged() ? `<div class="notice-pw">🔐 ننصحك بتغيير كلمة المرور الآن لحماية حسابك. <button class="btn sm" id="pwGo" style="margin-top:6px">تغيير كلمة المرور</button> <button class="btn sm outline" id="pwSkip" style="margin-top:6px">لاحقاً</button></div>` : ''}
    <div class="home-greet">أهلاً <span class="hg-name">${esc(currentUserName() || me.full_name || '')}</span>${isGuestUser() ? '' : `<span class="hg-role"> • ${esc(arOf(ROLES, me.role))}</span>`}${isManager() && myBranches().length ? `<span class="hg-role"> (${(isGeneralManager() && !(Array.isArray(me.branch_ids) && me.branch_ids.length) && !me.branch_id) ? 'كل الفروع' : myBranches().map(b => esc(branchName(b))).join('، ')})</span>` : ''}</div>
    ${tribeDocs.length ? `<div class="card doc-card click" data-go="#/documents">
      <img class="doc-thumb" src="${esc((tribeDocs[0] && tribeDocs[0].url) || '/almfrje/lazma-1173-thumb.jpg')}" alt="وثائق القبيلة" loading="lazy">
      <div class="doc-card-body">
        <div class="li-title">📜 ${tribeDocs.length === 1 ? esc(tribeDocs[0].title || 'وثيقة') : 'وثائق القبيلة (' + tribeDocs.length + ')'}</div>
        <div class="li-sub muted">اضغط لعرض الوثيقة وتفريغ نصّها</div>
      </div>
      <span class="doc-card-arrow">‹</span>
    </div>` : ''}
    <div class="card" style="border:2px solid var(--brand);background:color-mix(in srgb, var(--brand) 7%, transparent)">
      <h3 style="margin:0 0 4px">📝 ${esc(feedbackCardTitle)} ${hintBtn('feedback_send')}</h3>
      <p class="muted" style="margin:0 0 8px;font-size:.88rem">${esc(feedbackCardText)}</p>
      <button class="btn" data-go="#/feedback">✉️ أرسل ملاحظة للإدارة</button>
      ${isAdmin() && (C.feedbackPending || 0) > 0 ? `<button class="btn outline" data-go="#/feedbacks" style="margin-top:8px">📨 صندوق الوارد (${C.feedbackPending})</button>` : ''}
      ${!isAdmin() && isManager() && (C.feedbackPending || 0) > 0 ? `<button class="btn outline" data-go="#/feedbacks" style="margin-top:8px">📨 صندوق الوارد — يخصّك (${C.feedbackPending})</button>` : ''}
      <div id="fbMyReplies"></div>
    </div>
    <div class="search"><input id="q" placeholder="ابحث بالاسم أو اللقب…"></div><div id="qr"></div>
    <div class="stats">
      <div class="stat"><div class="n">${total}</div><div class="l">إجمالي الأفراد</div></div>
      <div class="stat a"><div class="n">${liveBranchCount()}</div><div class="l">الفروع</div></div>
      <div class="stat g"><div class="n">${maxGen()}</div><div class="l">الأجيال</div></div>
      <div class="stat k"><div class="n" id="visitsTotal">${visitStats.total || 0}</div><div class="l">الزوّار</div></div>
    </div>
    <button class="btn outline" data-go="#/stats" style="margin:0 0 12px">📈 التقرير الإحصائي الكامل</button>
    <div class="online-home" id="onlineHome">${onlineHomeHtml()}</div>
    ${visitStatsCardHtml()}
    ${branchGroupsHtml()}
    ${(recentShow || isAdmin()) ? `<div class="card"><div class="recent-head"><h3 style="margin:0">آخر الإضافات${sinceMs ? ` (${newCount})` : ''} ${hintBtn('recent')}</h3>${isAdmin() ? `<button class="btn sm outline" id="recentToggle">${recentShow ? '🙈 إخفاء' : '👁 إظهار'}</button>` : ''}</div>
      ${!recentShow ? '<div class="muted" style="padding:6px">البطاقة مخفية عن الجميع — أنت وحدك تراها الآن (اضغط «إظهار» لإعادتها).</div>'
        : (recent.length ? recent.map(p => `<div class="row click" data-recent="${p.id}"><span class="k">${esc(p.name)}</span><span class="v">${p.created_at ? fmtDate(p.created_at) : esc(branchName(p.branch_id))}</span></div>`).join('') : '<div class="muted" style="padding:6px">لا إضافات جديدة.</div>')}</div>` : ''}
    ${sitePowered ? `<div style="text-align:center;margin:10px 0 0;font-size:.74rem;opacity:.75">${esc(sitePowered)}</div>` : ''}`;
  const q = document.getElementById('q');
  q.addEventListener('input', debounce(() => instantSearch(q.value, document.getElementById('qr')), 130));
  const pwGo = document.getElementById('pwGo'); if (pwGo) pwGo.addEventListener('click', () => setHash('#/profile'));
  const pwSkip = document.getElementById('pwSkip'); if (pwSkip) pwSkip.addEventListener('click', () => { markPwChanged(); screenHome(); });
  view().querySelectorAll('[data-recent]').forEach(el => el.addEventListener('click', () => recentInfoModal(parseInt(el.dataset.recent, 10))));
  // إظهار/إخفاء بطاقة «آخر الإضافات» (للمدير) — الإعداد يسري على الجميع
  const rt = document.getElementById('recentToggle');
  if (rt) rt.addEventListener('click', async () => {
    const nv = !recentShow;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'recent_show', value: nv, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { recentShow = nv; toast(nv ? 'بطاقة «آخر الإضافات» ظاهرة للجميع' : 'أُخفيت «آخر الإضافات» عن الجميع'); screenHome(); }
  });
  bindGo();
  pingPresence(false);   // تحديث «المتواجدون الآن حسب الفرع» عند فتح الرئيسية
  loadMyReplies();       // ردود الإدارة على ملاحظات هذا المستخدم (إن وُجدت)
  // إضافة المولود انتقلت إلى قائمة «المزيد» (للمدير ومشرف الفرع) — لا زرّ عائم بالرئيسية.
}
// تصفير «آخر الإضافات» (للمدير فقط): تأكيدان + كتابة الكلمة + إمكانية تراجع.
async function setRecentSince(value) {
  const stamp = value || '';
  const { error } = await sb.from('almfrje_settings').upsert({ key: 'recent_since', value: stamp, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  recentSince = stamp;
}
async function resetRecent() {
  if (!isAdmin()) { toast('للمدير فقط'); return; }
  const prev = recentSince;   // للتراجع
  // تأكيد أول
  if (!(await confirm2('تصفير قائمة «آخر الإضافات»؟ تبدأ العدّ من الآن، ولا يؤثّر على بيانات الشجرة.', { title: 'تصفير آخر الإضافات', okText: 'متابعة', danger: false }))) return;
  // تأكيد ثانٍ بكتابة الكلمة
  const typed = await uiPrompt('للتأكيد اكتب كلمة: تصفير', { title: 'تأكيد التصفير', placeholder: 'تصفير', okText: 'تصفير الآن' });
  if ((typed || '').trim() !== 'تصفير') { toast('أُلغي التصفير'); return; }
  const now = new Date().toISOString();
  const ok = await guard(async () => { await setRecentSince(now); });
  if (ok) {
    // يُستدعى من لوحة التحكم (النصوص) أو من الرئيسية — أعِد رسم الشاشة الحالية.
    const rerender = () => { if (location.hash === '#/texts') screenTexts(); else screenHome(); };
    rerender();
    // إتاحة التراجع لمدة ٨ ثوانٍ
    showUndoToast('تم التصفير', async () => { await guard(async () => { await setRecentSince(prev); }); toast('تم التراجع'); rerender(); });
  }
}
// بطاقة مختصرة عند الضغط على اسم في آخر الإضافات: الأب والجد وتاريخ الإضافة فقط.
function recentInfoModal(id) {
  const p = byId.get(id); if (!p) return;
  const f = p.father_id ? byId.get(p.father_id) : null;
  const g = f && f.father_id ? byId.get(f.father_id) : null;
  openModal('معلومات: ' + p.name, `
    <div class="mini-info">
      ${row('الاسم', esc(p.name))}
      ${row('الأب', f ? esc(f.name) : '— (الأصل)')}
      ${row('الجد', g ? esc(g.name) : '—')}
      ${row('تاريخ الإضافة', p.created_at ? fmtDateTime(p.created_at) : '—')}
      ${p.created_by_name ? row('أضافه', esc(p.created_by_name)) : ''}
    </div>
    <button class="btn" id="mi_open">فتح الملف الكامل</button>`, () => {
    document.getElementById('mi_open').addEventListener('click', () => { closeModal(); setHash('#/person/' + id); });
  });
}
// مطابقة استعلام اسم (كلمة أو أكثر) على الشخص وسلسلة نسبه:
// الكلمة الأولى لاسمه أو لقبه، والباقي ضمن آبائه/أجداده بالترتيب (ولو بتخطّي أجيال).
// يتجاهل المسافات والتشكيل والهمزات و«بن»/«ابن».
function nameMatch(p, query) {
  const toks = String(query || '').trim().split(/\s+/).map(normalizeAr).filter(t => t && t !== 'بن' && t !== 'ابن');
  if (!toks.length) return true;
  if (!p._n.includes(toks[0])) return false;             // الكلمة الأولى: اسمه نفسه أو لقبه
  if (toks.length === 1) return true;
  const ln = p._ln || (p._ln = lineage(p.id).map(x => normalizeAr(x.name)));  // مخزَّن: هو ثم آباؤه بالترتيب
  // كل اسم لاحق يطابق الأب المباشر التالي بالترتيب (لا تخطّي أجيال) — أدقّ تصفية.
  for (let i = 1; i < toks.length; i++) { if (!ln[i] || !ln[i].includes(toks[i])) return false; }
  return true;
}
// مؤخِّر تنفيذ: يجمّع ضغطات لوحة المفاتيح المتلاحقة في نداءٍ واحد (يخفّف عبء البحث الفوري).
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function instantSearch(term, box) {
  const t = normalizeAr(term.trim());
  if (!t) { box.innerHTML = ''; return; }
  const res = C.persons.filter(p => nameMatch(p, term)).slice(0, 30);
  box.innerHTML = res.length ? res.map(personCard).join('') : '<div class="muted" style="padding:8px">لا نتائج</div>';
  bindGo(box);
}

/* ===== البحث المتقدم ===== */
let searchState = { name: '', father: '', grand: '', branch: '', gen: '', city: '', status: '', work: '' };
function screenSearch() {
  const branchOpts = C.branches.map(b => ({ k: String(b.id), ar: b.name }));
  const genOpts = []; for (let i = 1; i <= maxGen(); i++) genOpts.push({ k: String(i), ar: 'الجيل ' + i });
  view().innerHTML = `
    <div class="card search-card">
      <div class="search-head"><span class="search-ico">🔎</span><h3>بحث متقدّم في الشجرة</h3>${hintBtn('search')}</div>
      <p class="muted search-hint">عبّئ ما تعرفه فقط — كل الحقول اختيارية، وتُدمج معاً لتضييق النتائج.</p>

      <div class="field"><label>الاسم أو اللقب ${hintBtn('search_name')}</label>
        <input id="s_name" type="text" value="${esc(searchState.name)}" placeholder="اكتب الاسم أو اللقب… (اختياري)"></div>

      <div class="grid2">
        <div class="field"><label>اسم الأب ${hintBtn('search_father')}</label>
          <input id="s_father" type="text" value="${esc(searchState.father)}" placeholder="مثال: محمد (اختياري)"></div>
        <div class="field"><label>اسم الجد ${hintBtn('search_grand')}</label>
          <input id="s_grand" type="text" value="${esc(searchState.grand)}" placeholder="مثال: سالم (اختياري)"></div>
      </div>

      <div class="grid2">
        ${fSelect('الفرع', 's_branch', branchOpts, searchState.branch, 'كل الفروع')}
        ${fSelect('الجيل', 's_gen', genOpts, searchState.gen, 'كل الأجيال')}
      </div>

      <div class="grid2">
        <div class="field"><label>المدينة</label>
          <input id="s_city" type="text" value="${esc(searchState.city)}" placeholder="مثال: الرياض (اختياري)"></div>
        ${fSelect('الحالة', 's_status', STATUS, searchState.status, 'الكل')}
      </div>

      ${hideForGuest('notes') ? '' : `<div class="grid2">
        ${fSelect('الحالة الوظيفية', 's_work', WORK.filter(w => w.k), searchState.work, 'الكل')}
        <div></div>
      </div>`}

      <div class="btn-row search-actions">
        <button class="btn" id="s_go">🔍 بحث</button>
        <button class="btn outline" id="s_clear">مسح الحقول</button>
      </div>
    </div>
    <div id="s_res"></div>`;
  document.getElementById('s_go').addEventListener('click', runAdvanced);
  document.getElementById('s_clear').addEventListener('click', () => { searchState = { name: '', father: '', grand: '', branch: '', gen: '', city: '', status: '', work: '' }; screenSearch(); });
  view().querySelectorAll('#s_name,#s_father,#s_grand,#s_city').forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') runAdvanced(); }));
  if (searchState.name || searchState.father) runAdvanced();
}
function runAdvanced() {
  searchState = { name: val('s_name'), father: val('s_father'), grand: val('s_grand'), branch: val('s_branch'), gen: val('s_gen'), city: val('s_city'), status: val('s_status'), work: val('s_work') };
  const n = normalizeAr(searchState.name), f = normalizeAr(searchState.father), g = normalizeAr(searchState.grand), c = normalizeAr(searchState.city);
  const res = C.persons.filter(p => {
    if (n && !nameMatch(p, searchState.name)) return false;
    if (searchState.branch && String(p.branch_id) !== searchState.branch) return false;
    if (searchState.gen && String(p.generation) !== searchState.gen) return false;
    if (searchState.status && p.status !== searchState.status) return false;
    if (searchState.work && (p.work || '') !== searchState.work) return false;
    if (c && !normalizeAr(p.city).includes(c)) return false;
    if (f) { const fa = p.father_id ? byId.get(p.father_id) : null; if (!fa || !fa._n.includes(f)) return false; }
    if (g) { const fa = p.father_id ? byId.get(p.father_id) : null; const ga = fa && fa.father_id ? byId.get(fa.father_id) : null; if (!ga || !ga._n.includes(g)) return false; }
    return true;
  }).slice(0, 200);
  const box = document.getElementById('s_res');
  box.innerHTML = `<div class="search-count">${res.length ? `نتائج البحث: <b>${res.length}</b>${res.length === 200 ? ' (عُرضت أول ٢٠٠)' : ''}` : ''}</div>` + (res.length ? res.map(personCard).join('') : '<div class="center-empty">لا نتائج مطابقة — جرّب تقليل شروط البحث.</div>');
  bindGo(box);
}

/* ===== أدوات المشجّرة الجديدة (حول الشخص) — إضافات لا تستبدل أي عرضٍ قائم ===== */
// نسخ نصٍّ للحافظة مع بديلٍ احتياطي.
async function copyText(s) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(s); toast('تم النسخ ✓'); return true; } } catch (e) { /* */ }
  try { const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); ta.remove(); toast('تم النسخ ✓'); return true; } catch (e) { toast('تعذّر النسخ'); return false; }
}
// مشاركة الموقع: واجهة المشاركة الأصلية للجهاز إن توفّرت، وإلا نسخ الرابط للحافظة.
async function shareSite() {
  // واتساب يخزّن معاينة كل رابط؛ بصمة الإصدار تُجبره على قراءة المعاينة الحديثة (تُرفع عند تغيير العنوان/الوصف).
  const url = location.origin + '/?v=2';
  const msg = [shareTitle, shareText].filter(Boolean).join('\n');   // واتساب يعرض النصّ فقط — فندمج العنوان معه
  try {
    if (navigator.share) { await navigator.share({ title: shareTitle, text: msg, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; /* أُلغيت المشاركة → لا بديل */ }
  copyText((msg ? msg + '\n' : '') + url);   // بديل: نسخ الرسالة + الرابط
}
// مسار النسب: من الشخص حتى الأصل، مع حمايةٍ من الدوائر ونقص البيانات (بحدٍّ أقصى للأجيال).
function getLineagePath(id, maxDepth = 50) {
  const out = []; const seen = new Set(); let cur = byId.get(id); let g = 0;
  while (cur && g++ < maxDepth) { if (seen.has(cur.id)) break; seen.add(cur.id); out.push(cur); cur = cur.father_id ? byId.get(cur.father_id) : null; }
  return out;
}
const lineageBin = (id) => getLineagePath(id).map(p => p.name).join(' بن ');

// (1) مسار النسب الذكي
function lineagePathModal(id) {
  const path = getLineagePath(id);
  if (!path.length) { toast('الشخص غير موجود'); return; }
  const lastP = path[path.length - 1];
  const incomplete = !!(lastP.father_id && !byId.get(lastP.father_id));
  const rows = path.map((p, i) => {
    const isSelf = i === 0; const isRoot = i === path.length - 1 && !p.father_id;
    return `<div class="lp-row${isSelf ? ' lp-self' : ''}" data-lpid="${p.id}" title="عرض الشجرة من هنا">
      <span class="lp-ico">${isRoot ? '🌳' : (isSelf ? '◀' : '•')}</span>
      <span class="lp-name ${nameCls(p)}">${esc(p.name)}</span>
      <span class="lp-gen">جيل ${p.generation}</span>
    </div>`;
  }).join('<div class="lp-arrow">↑</div>');
  openModal('مسار النسب', `
    ${incomplete ? '<div class="lp-warn">⚠️ النسب غير مكتمل في قاعدة البيانات</div>' : ''}
    <div class="lp-list">${rows}</div>
    <div class="lp-full" id="lp_full">${esc(lineageBin(id))}</div>
    <p class="muted" style="font-size:.78rem;margin:6px 0 0">اضغط أي اسمٍ في المسار لعرض الشجرة منه.</p>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn sm" id="lp_copy">📋 نسخ النسب</button>
      <button class="btn sm outline" id="lp_tree">🌳 فتح في الشجرة</button>
    </div>`, () => {
    document.getElementById('lp_copy').addEventListener('click', () => copyText(lineageBin(id)));
    document.getElementById('lp_tree').addEventListener('click', () => { closeModal(); setHash('#/tree/' + id); });
    document.querySelectorAll('#modalRoot [data-lpid]').forEach(el => el.addEventListener('click', () => { closeModal(); setHash('#/tree/' + el.dataset.lpid); }));
  });
}

// (3) خريطة الذرية المصغّرة
function getDescendantsSummary(id) {
  const all = descendants(id);
  const kidsArr = childrenOf(id);
  const grand = kidsArr.flatMap(c => childrenOf(c.id));
  let alive = 0, dead = 0, noissue = 0;
  for (const p of all) { if (p.status === 'dead') { dead++; if ((descCount.get(p.id) || 0) === 0) noissue++; } else alive++; }
  let depth = 0; const stack = [[id, 0]]; const seen = new Set(); let guard = 0;
  while (stack.length && guard++ < 200000) { const [pid, d] = stack.pop(); if (seen.has(pid)) continue; seen.add(pid); if (d > depth) depth = d; for (const c of childrenOf(pid)) stack.push([c.id, d + 1]); }
  const last = all.slice().filter(p => p.created_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
  return { total: all.length, kids: kidsArr.length, grand: grand.length, gens: depth, alive, dead, noissue, last };
}
function descendantsMiniMap(id) {
  const p = byId.get(id); if (!p) { toast('الشخص غير موجود'); return; }
  const s = getDescendantsSummary(id);
  const noIssue = p.status === 'dead' && s.total === 0;
  const stat = (n, l, cls) => `<div class="mini-stat ${cls || ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  // أول مستويين فقط
  const kidsArr = childrenOf(id);
  const lvl = kidsArr.length ? kidsArr.slice(0, 30).map(c => {
    const gk = childrenOf(c.id);
    const sub = gk.length ? `<div class="mini-sub">${gk.slice(0, 12).map(g => `<span class="rel-chip ${nameCls(g)}" data-lensid="${g.id}">${esc(g.name)}</span>`).join('')}${gk.length > 12 ? `<span class="rel-more" data-descfull="${c.id}">+${gk.length - 12}</span>` : ''}</div>` : '';
    return `<div class="mini-node"><span class="rel-chip strong ${nameCls(c)}" data-lensid="${c.id}">${esc(c.name)}${(childCount.get(c.id) || 0) ? ` <b>(${childCount.get(c.id)})</b>` : ''}</span>${sub}</div>`;
  }).join('') + (kidsArr.length > 30 ? `<div class="rel-more" data-descfull="${id}">+${kidsArr.length - 30} المزيد</div>` : '') : '<div class="muted" style="padding:6px">لا توجد ذرية مسجلة</div>';
  openModal('خريطة الذرية', `
    <div class="mini-head"><b>${esc(p.name)}</b> <span class="muted" style="font-weight:400">${esc(ancestryShort(p.id, 3))}</span><div class="muted" style="font-size:.8rem">الفرع: ${esc(branchName(p.branch_id))}${noIssue ? ' • <span class="n-noissue">لم يعقب</span>' : ''}</div></div>
    <div class="mini-grid">
      ${stat(s.kids, 'الأبناء')}${stat(s.grand, 'الأحفاد')}${stat(s.total, 'إجمالي الذرية')}
      ${stat(s.gens, 'الأجيال تحته')}${stat(s.alive, 'الأحياء', 'ok')}${stat(s.dead, 'المتوفّون', 'mut')}
    </div>
    ${s.noissue ? `<div class="muted" style="font-size:.82rem;margin:6px 0">منهم <b>${s.noissue}</b> لم يعقب.</div>` : ''}
    ${s.last ? `<div class="muted" style="font-size:.82rem;margin:2px 0">آخر إضافة: <b>${esc(s.last.name)}</b>${s.last.created_at ? ' • ' + fmtDate(s.last.created_at) : ''}</div>` : ''}
    <div class="mini-lvl">${lvl}</div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn sm" data-go-close="#/descendants/${id}">📇 فتح فهرس الذرية</button>
      <button class="btn sm outline" data-go-close="#/tree/${id}">🌳 عرض الذرية كاملة</button>
      ${canExport() ? `<button class="btn sm outline" id="mini_print">🖨️ طباعة مختصر الذرية</button>` : ''}
    </div>`, () => {
    bindLensChips();
    document.querySelectorAll('#modalRoot [data-go-close]').forEach(b => b.addEventListener('click', () => { closeModal(); setHash(b.dataset.goClose); }));
    document.querySelectorAll('#modalRoot [data-descfull]').forEach(b => b.addEventListener('click', () => { closeModal(); setHash('#/descendants/' + b.dataset.descfull); }));
    const pr = document.getElementById('mini_print'); if (pr) pr.addEventListener('click', () => { closeModal(); printDescSummary(id); });
  });
}

// (9) شجرة الأقرباء المباشرين
function getImmediateRelatives(id) {
  const p = byId.get(id); if (!p) return null;
  const father = p.father_id ? byId.get(p.father_id) : null;
  const siblings = father ? childrenOf(father.id).filter(x => x.id !== id) : [];
  const children = childrenOf(id);
  const grand = father && father.father_id ? byId.get(father.father_id) : null;
  const uncles = grand ? childrenOf(grand.id).filter(x => !father || x.id !== father.id) : [];
  const cousins = uncles.flatMap(u => childrenOf(u.id));
  return { p, father, siblings, children, uncles, cousins };
}
function relativesModal(id) {
  const r = getImmediateRelatives(id);
  if (!r) { toast('الشخص غير موجود'); return; }
  const chips = (arr) => arr.length ? arr.map(x => `<span class="rel-chip ${nameCls(x)}" data-lensid="${x.id}">${esc(x.name)}</span>`).join('') : '<span class="muted" style="font-size:.82rem">—</span>';
  const sec = (t, arr, openable) => `<div class="rel-sec"><div class="rel-sec-h">${t} ${arr.length ? `<span class="muted">(${arr.length})</span>` : ''}</div><div class="rel-chips">${chips(arr)}</div></div>`;
  const incomplete = !r.father && r.p.father_id;
  openModal('أقرباء ' + r.p.name, `
    ${incomplete ? '<div class="lp-warn">⚠️ بيانات النسب غير مكتملة</div>' : ''}
    ${r.father ? `<div class="rel-sec"><div class="rel-sec-h">الأب</div><div class="rel-chips"><span class="rel-chip strong ${nameCls(r.father)}" data-lensid="${r.father.id}">${esc(r.father.name)}</span></div></div>` : ''}
    <div class="rel-sec rel-self"><div class="rel-sec-h">هو</div><div class="rel-chips"><span class="rel-chip strong" style="background:var(--brand);color:#fff">${esc(r.p.name)}</span></div></div>
    ${sec('الإخوة', r.siblings)}
    ${sec('الأبناء', r.children)}
    ${sec('الأعمام', r.uncles)}
    ${sec('أبناء العم', r.cousins)}
    <div class="btn-row" style="margin-top:10px">
      <button class="btn sm" id="rel_tree">🌳 فتح في الشجرة</button>
      <button class="btn sm outline" id="rel_lin">🧬 مسار النسب</button>
      <button class="btn sm outline" id="rel_desc">📇 عرض الذرية</button>
    </div>`, () => {
    bindLensChips();
    document.getElementById('rel_tree').addEventListener('click', () => { closeModal(); setHash('#/tree/' + id); });
    document.getElementById('rel_lin').addEventListener('click', () => { closeModal(); lineagePathModal(id); });
    document.getElementById('rel_desc').addEventListener('click', () => { closeModal(); setHash('#/descendants/' + id); });
  });
}

// (10) عدسة التكبير — البطاقة السريعة المركزية لكل الأدوات (تُفتح عند الضغط على أي اسم).
function bindLensChips(root) {
  (root || document).querySelectorAll('#modalRoot [data-lensid]').forEach(el => el.addEventListener('click', () => { const nid = parseInt(el.dataset.lensid, 10); closeModal(); openLens(nid); }));
}
function openLens(id) {
  const p = byId.get(id); if (!p) { toast('الشخص غير موجود'); return; }
  const kids = childCount.get(id) || 0, desc = descCount.get(id) || 0;
  const father = p.father_id ? byId.get(p.father_id) : null;
  openModal(p.name, `
    <div class="ql-sub">${father ? 'بن ' + esc(father.name) + ' • ' : ''}${esc(branchName(p.branch_id))} • جيل ${p.generation}${statusTag(p)}</div>
    <div class="ql-stats"><div class="ql-stat"><div class="n">${kids}</div><div class="l">الأبناء</div></div><div class="ql-stat"><div class="n">${desc}</div><div class="l">الذرية</div></div></div>
    <div class="ql-tools">
      <button class="btn sm" data-ql="lineage">🧬 مسار النسب</button>
      <button class="btn sm" data-ql="desc">🗺️ خريطة الذرية</button>
      <button class="btn sm" data-ql="rel">👨‍👩‍👧 أقربائي</button>
      <button class="btn sm" data-ql="kin">🧬 صلة قرابته بشخص</button>
      <button class="btn sm" data-ql="radial">🔆 اجعله مركز الدائرية</button>
      <button class="btn sm outline" data-ql="tree">🌳 فتح في الشجرة</button>
      <button class="btn sm outline" data-ql="profile">📄 فتح الملف الكامل</button>
    </div>`, () => {
    const act = { lineage: () => { closeModal(); lineagePathModal(id); }, desc: () => { closeModal(); descendantsMiniMap(id); }, rel: () => { closeModal(); relativesModal(id); }, kin: () => { closeModal(); kinA = byId.get(id); kinB = null; setHash('#/kinship'); }, radial: () => { closeModal(); setHash('#/radial/' + id); }, tree: () => { closeModal(); setHash('#/tree/' + id); }, profile: () => { closeModal(); setHash('#/person/' + id); } };
    document.querySelectorAll('#modalRoot [data-ql]').forEach(b => b.addEventListener('click', () => act[b.dataset.ql]()));
  });
}

// طباعة مختصر الذرية (صفحة نظيفة) — تُستخدم من خريطة الذرية.
function printDescSummary(id) {
  const p = byId.get(id); if (!p) return;
  const s = getDescendantsSummary(id);
  const w = window.open('', '_blank');
  if (!w) { toast('اسمح بالنوافذ المنبثقة للطباعة'); return; }
  const rowsTop = childrenOf(id).map(c => `<li><b>${esc(c.name)}</b> — ${descCount.get(c.id) || 0} ذرية</li>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مختصر ذرية ${esc(p.name)}</title>
    <style>body{font-family:"Segoe UI",Tahoma,sans-serif;padding:24px;color:#111;direction:rtl}h1{color:#312E81;margin:0 0 2px}.sub{color:#555;margin-bottom:14px}
    .g{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.b{border:1px solid #ccc;border-radius:8px;padding:8px 14px;text-align:center;min-width:90px}.b .n{font-size:1.5rem;font-weight:800;color:#312E81}.b .l{font-size:.8rem;color:#555}
    ul{line-height:1.9}.foot{margin-top:18px;color:#777;font-size:.8rem}</style></head><body>
    <h1>مختصر ذرية: ${esc(p.name)}</h1>
    <div class="sub">${esc(ancestryShort(p.id, 4))} • الفرع: ${esc(branchName(p.branch_id))} • ${new Date().toLocaleDateString('ar')}</div>
    <div class="g"><div class="b"><div class="n">${s.kids}</div><div class="l">الأبناء</div></div><div class="b"><div class="n">${s.grand}</div><div class="l">الأحفاد</div></div><div class="b"><div class="n">${s.total}</div><div class="l">إجمالي الذرية</div></div><div class="b"><div class="n">${s.gens}</div><div class="l">الأجيال</div></div><div class="b"><div class="n">${s.alive}</div><div class="l">الأحياء</div></div><div class="b"><div class="n">${s.dead}</div><div class="l">المتوفّون</div></div></div>
    <h3>الأبناء المباشرون</h3><ul>${rowsTop || '<li>لا توجد ذرية مسجلة</li>'}</ul>
    <div class="foot">هذه نسخة مختصرة من قاعدة بيانات قبيلة المفارجة</div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

/* ===== (5) خط الأجيال — عرض الأشخاص حسب الجيل ===== */
let tlRoot = null, tlBranch = '', tlStatus = 'all', tlSearch = '';
function timelineBasePool() {
  let pool = (tlRoot && byId.get(tlRoot.id)) ? [byId.get(tlRoot.id), ...descendants(tlRoot.id)] : C.persons.slice();
  if (!isAdmin() && isManager()) pool = pool.filter(p => inMyBranch(p));   // المشرف: فرعه فقط
  return pool;
}
function screenTimeline(arg) {
  if (arg && arg !== 'all') { const rid = parseInt(arg, 10); if (byId.get(rid)) tlRoot = byId.get(rid); } else if (arg === 'all') tlRoot = null;
  const branchOpts = (isAdmin() ? C.branches.filter(b => isLiveBranch(b.id)) : C.branches.filter(b => myBranches().includes(b.id)))
    .map(b => `<option value="${b.id}" ${tlBranch === String(b.id) ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  view().innerHTML = `
    <div class="card">
      <div class="tl-top">
        <h3 style="margin:0">🕓 خط الأجيال</h3>
        ${tlRoot ? `<span class="tl-rootbadge">من: <b>${esc(tlRoot.name)}</b> <button class="btn sm outline" id="tl_all" style="margin:0">كل الشجرة</button></span>` : ''}
      </div>
      <p class="muted" style="font-size:.84rem;margin:4px 0 8px">عرض الأفراد مقسّمين حسب الجيل. اضغط أي اسم لفتح أدواته.</p>
      <div class="tl-filters">
        <select id="tl_branch" class="tl-sel"><option value="">كل الفروع</option>${branchOpts}</select>
        <div class="seg" id="tl_status">
          <button class="seg-b${tlStatus === 'all' ? ' on' : ''}" data-st="all">الكل</button>
          <button class="seg-b${tlStatus === 'alive' ? ' on' : ''}" data-st="alive">الأحياء</button>
          <button class="seg-b${tlStatus === 'dead' ? ' on' : ''}" data-st="dead">المتوفّون</button>
          <button class="seg-b${tlStatus === 'noissue' ? ' on' : ''}" data-st="noissue">لم يعقب</button>
        </div>
        <div class="search" style="margin:0"><input id="tl_q" placeholder="بحث بالاسم…" value="${esc(tlSearch)}"></div>
        <button class="btn sm outline" id="tl_pick" style="margin:0">▶ ابدأ من شخص</button>
      </div>
    </div>
    <div id="tl_list"></div>`;
  const listEl = document.getElementById('tl_list');
  const renderList = () => {
    let f = timelineBasePool();
    if (tlBranch) f = f.filter(p => String(p.branch_id) === tlBranch);
    if (tlStatus === 'alive') f = f.filter(p => p.status !== 'dead');
    else if (tlStatus === 'dead') f = f.filter(p => p.status === 'dead');
    else if (tlStatus === 'noissue') f = f.filter(p => p.status === 'dead' && (descCount.get(p.id) || 0) === 0);
    if (tlSearch.trim()) f = f.filter(p => nameMatch(p, tlSearch));
    const byGen = new Map();
    f.forEach(p => { const g = byId.get(p.father_id) || !p.father_id ? (p.generation || 0) : -1; const key = (p.father_id && !byId.get(p.father_id)) ? 'x' : (p.generation || 0); if (!byGen.has(key)) byGen.set(key, []); byGen.get(key).push(p); });
    const keys = [...byGen.keys()].filter(k => k !== 'x').sort((a, b) => a - b);
    if (byGen.has('x')) keys.push('x');
    if (!f.length) { listEl.innerHTML = '<div class="center-empty">لا نتائج بهذه الفلترة.</div>'; return; }
    listEl.innerHTML = keys.map(g => {
      const arr = byGen.get(g).slice().sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
      const title = g === 'x' ? 'بيانات غير مكتملة' : 'الجيل ' + g;
      const cards = arr.map(p => {
        const f2 = p.father_id ? byId.get(p.father_id) : null;
        return `<div class="tl-card" data-lensid="${p.id}">
          <div class="tl-name ${nameCls(p)}">${esc(p.name)}${nickSuffix(p)}${statusTag(p)}</div>
          <div class="tl-meta">${f2 ? 'بن ' + esc(f2.name) + ' • ' : ''}${esc(branchName(p.branch_id))}${(childCount.get(p.id) || 0) ? ' • ' + childCount.get(p.id) + ' ابن' : ''}</div>
        </div>`;
      }).join('');
      return `<div class="tl-gen"><div class="tl-gen-h">${title} <span class="tl-gen-n">${arr.length} شخص</span></div><div class="tl-grid">${cards}</div></div>`;
    }).join('');
    listEl.querySelectorAll('[data-lensid]').forEach(el => el.addEventListener('click', () => openLens(parseInt(el.dataset.lensid, 10))));
  };
  const ta = document.getElementById('tl_all'); if (ta) ta.addEventListener('click', () => { tlRoot = null; setHash('#/timeline/all'); });
  document.getElementById('tl_branch').addEventListener('change', e => { tlBranch = e.target.value; renderList(); });
  document.querySelectorAll('#tl_status .seg-b').forEach(b => b.addEventListener('click', () => { tlStatus = b.dataset.st; document.querySelectorAll('#tl_status .seg-b').forEach(x => x.classList.toggle('on', x === b)); renderList(); }));
  { let t = null; document.getElementById('tl_q').addEventListener('input', e => { tlSearch = e.target.value; clearTimeout(t); t = setTimeout(renderList, 200); }); }
  document.getElementById('tl_pick').addEventListener('click', () => pickPerson('اختر شخصاً لبدء خط الأجيال منه', (p) => p && setHash('#/timeline/' + p.id)));
  renderList();
}

/* ===== (8) الشجرة الدائرية ===== */
let radRoot = null, radGens = 3, radZoom = 1;
function buildRadial(rootId, maxGen) {
  const CAP = 24;   // أقصى أبناء معروضين لكل عقدة (الباقي يُجمَّع في +عدد)
  const root = byId.get(rootId);
  function build(p, depth) {
    const node = { p, depth, children: [] };
    if (depth < maxGen) {
      let cs = childrenOf(p.id);
      if (!isAdmin() && isManager()) cs = cs.filter(c => inMyBranch(c));
      let extra = 0;
      if (cs.length > CAP) { extra = cs.length - CAP; cs = cs.slice(0, CAP); }
      node.children = cs.map(c => build(c, depth + 1));
      if (extra) node.children.push({ more: true, n: extra, parentId: p.id, depth: depth + 1, children: [] });
    }
    return node;
  }
  const tree = build(root, 0);
  (function weigh(n) { if (!n.children.length) { n.w = 1; return 1; } n.w = n.children.reduce((s, c) => s + weigh(c), 0); return n.w; })(tree);
  // مسافة الحلقات تكبر مع الأجيال لمنع الازدحام في الحلقات الخارجية.
  const ringR = (d) => [0, 200, 360, 510, 650, 780, 900][d] != null ? [0, 200, 360, 510, 650, 780, 900][d] : d * 150;
  const nodes = [], links = [];
  (function place(n, a0, a1) {
    const mid = (a0 + a1) / 2, r = ringR(n.depth);
    n.x = r * Math.cos(mid); n.y = r * Math.sin(mid); n.angle = mid; nodes.push(n);
    let a = a0; const tot = n.w || 1;
    for (const c of n.children) { const span = (a1 - a0) * ((c.w || 1) / tot); place(c, a, a + span); links.push([n, c]); a += span; }
  })(tree, -Math.PI / 2, Math.PI * 1.5);
  return { nodes, links, ringR, maxGen };
}
function screenRadial(arg) {
  if (arg && arg !== 'all') { const rid = parseInt(arg, 10); if (byId.get(rid)) radRoot = byId.get(rid); }
  if (!radRoot || !byId.get(radRoot.id)) {
    if (!isAdmin() && isManager() && !isGeneralManager()) { const b = myBranches()[0]; radRoot = (b && branchRoot(b)) || roots()[0] || null; }
    else if (isGeneralManager()) { radRoot = roots()[0] || null; }   // المشرف العام يبدأ من القمة ككل المستخدمين
    else radRoot = roots()[0] || null;
  }
  if (!radRoot) { view().innerHTML = '<div class="center-empty">لا توجد بيانات.</div>'; return; }
  const maxG = Math.max(1, Math.min(radGens, 6));
  const lay = buildRadial(radRoot.id, maxG);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  lay.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
  const pad = 170, vbW = (maxX - minX) + pad * 2, vbH = (maxY - minY) + pad * 2, ox = minX - pad, oy = minY - pad;
  const big = lay.nodes.length > 120;
  // حلقات إرشادية خافتة لكل جيل
  const guides = [];
  for (let d = 1; d <= maxG; d++) { const rr = lay.ringR(d); if (rr) guides.push(`<circle cx="0" cy="0" r="${rr}" class="rad-ring"/>`); }
  // وصلات منحنية أنيقة (منحنى تربيعي نحو المركز) أوضح من الخطوط المتقاطعة
  const lines = lay.links.map(([a, b]) => {
    const mx = (a.x + b.x) / 2 * 0.6, my = (a.y + b.y) / 2 * 0.6;
    return `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" class="rad-link"/>`;
  }).join('');
  const RAD = (d) => d === 0 ? 30 : d === 1 ? 21 : d === 2 ? 15 : 11;
  const circles = lay.nodes.map(n => {
    if (n.more) return `<g class="rad-g rad-more" data-radmore="${n.parentId}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="15"/><text x="${n.x.toFixed(1)}" y="${(n.y + 4).toFixed(1)}" text-anchor="middle">+${n.n}</text></g>`;
    const r = RAD(n.depth);
    const nm = n.p.name.length > 12 ? n.p.name.slice(0, 12) + '…' : n.p.name;
    const circle = `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" class="rad-c d${Math.min(n.depth, 3)} ${nameCls(n.p)}"/>`;
    let label;
    if (n.depth === 0) {
      label = `<text x="${n.x.toFixed(1)}" y="${(n.y + 5).toFixed(1)}" text-anchor="middle" class="rad-t rad-t0">${esc(nm)}</text>`;
    } else {
      // تسمية شعاعية تخرج من العقدة نحو الخارج (تقلّل التداخل)، تنقلب في النصف الأيسر لتُقرأ
      const deg = n.angle * 180 / Math.PI;
      const flip = Math.cos(n.angle) < 0;
      const lr = r + 5;
      const lx = n.x + lr * Math.cos(n.angle), ly = n.y + lr * Math.sin(n.angle);
      const rot = flip ? deg + 180 : deg;
      const anchor = flip ? 'end' : 'start';
      label = `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" text-anchor="${anchor}" dominant-baseline="middle" class="rad-t rad-lbl">${esc(nm)}</text>`;
    }
    return `<g class="rad-g" data-radid="${n.p.id}"><title>${esc(n.p.name)}</title>${circle}${label}</g>`;
  }).join('');
  const parent = radRoot.father_id ? byId.get(radRoot.father_id) : null;
  view().innerHTML = `
    <div class="card">
      <div class="tl-top"><h3 style="margin:0">🔆 الشجرة الدائرية</h3><span class="tl-rootbadge">المركز: <b>${esc(radRoot.name)}</b></span></div>
      <div class="tl-filters">
        ${parent ? `<button class="btn sm" id="rad_up" style="margin:0">⬆ المركز: ${esc(parent.name)}</button>` : ''}
        <button class="btn sm outline" id="rad_pick" style="margin:0">⌖ تغيير المركز</button>
        <span class="rad-genctl">الأجيال: <button class="btn sm" id="rad_dec" style="margin:0">−</button> <b>${maxG}</b> <button class="btn sm" id="rad_inc" style="margin:0">+</button></span>
        <span class="rad-genctl">تكبير: <button class="btn sm" id="rad_zout" style="margin:0">−</button> <button class="btn sm" id="rad_zin" style="margin:0">+</button></span>
      </div>
      <p class="muted" style="font-size:.78rem;margin:6px 0 0">ضغطة على الاسم تفتح أدواته، و<b>ضغطة مطوّلة تجعله المركز</b>. ${big ? 'وتُجمَّع الفروع الكبيرة في «+عدد».' : ''}</p>
    </div>
    <div class="rad-wrap"><svg class="rad-svg" viewBox="${ox.toFixed(0)} ${oy.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}" style="width:${(vbW * radZoom).toFixed(0)}px;height:${(vbH * radZoom).toFixed(0)}px"><g class="rad-guides">${guides.join('')}</g>${lines}${circles}</svg></div>`;
  { const up = document.getElementById('rad_up'); if (up && parent) up.addEventListener('click', () => setHash('#/radial/' + parent.id)); }
  document.getElementById('rad_pick').addEventListener('click', () => pickPerson('اختر مركز الشجرة الدائرية', p => p && setHash('#/radial/' + p.id)));
  document.getElementById('rad_inc').addEventListener('click', () => { radGens = Math.min(6, radGens + 1); screenRadial(String(radRoot.id)); });
  document.getElementById('rad_dec').addEventListener('click', () => { radGens = Math.max(1, radGens - 1); screenRadial(String(radRoot.id)); });
  document.getElementById('rad_zin').addEventListener('click', () => { radZoom = Math.min(3, radZoom + 0.25); screenRadial(String(radRoot.id)); });
  document.getElementById('rad_zout').addEventListener('click', () => { radZoom = Math.max(0.5, radZoom - 0.25); screenRadial(String(radRoot.id)); });
  view().querySelectorAll('[data-radid]').forEach(g => {
    const nid = parseInt(g.dataset.radid, 10);
    // ضغطة قصيرة = العدسة؛ ضغط مطوّل = اجعله المركز.
    bindLongPress(g, () => openLens(nid), () => setHash('#/radial/' + nid));
  });
  view().querySelectorAll('[data-radmore]').forEach(g => g.addEventListener('click', () => setHash('#/descendants/' + g.dataset.radmore)));
}
// ضغطة قصيرة/مطوّلة على عنصر (لمس وفأرة) — مع منع النقر بعد الضغط المطوّل.
function bindLongPress(el, onTap, onLong, ms) {
  let timer = null, longed = false, sx = 0, sy = 0;
  el.style.touchAction = 'manipulation';
  el.addEventListener('pointerdown', (e) => {
    longed = false; sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { longed = true; if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { } } onLong(); }, ms || 500);
  });
  el.addEventListener('pointermove', (e) => { if (timer && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) { clearTimeout(timer); timer = null; } });
  const stop = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('click', (e) => { if (longed) { longed = false; e.preventDefault(); e.stopPropagation(); return; } onTap(); });
}

/* ===== (6) المشجّرة المختصرة للطباعة ===== */
let ptStart = null;   // الجدّ الذي تبدأ منه (اختياري)
let ptStyle = 'compact';   // نمط الطباعة: compact | outline
let ptOpts = null;    // خيارات النسخة المولّدة (لعرض الطباعة داخل الموقع)
function screenPrintTree() {
  const branches = (isAdmin() ? C.branches.filter(b => isLiveBranch(b.id)) : C.branches.filter(b => myBranches().includes(b.id)));
  const bopts = branches.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar')).map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  view().innerHTML = `
    <div class="card">
      <h3>🖨️ نسخة مختصرة للطباعة</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">اختر ما تريد ثم «توليد النسخة» لصفحة طباعة نظيفة (طباعة أو حفظ PDF).</p>
      <div class="field"><label>نمط الطباعة</label>
        <div class="seg" id="pt_style">
          <button class="seg-b${ptStyle === 'compact' ? ' on' : ''}" data-pst="compact">فهرس مرقّم مضغوط</button>
          <button class="seg-b${ptStyle === 'outline' ? ' on' : ''}" data-pst="outline">مشجّرة متدرّجة</button>
        </div>
        <div class="muted" style="font-size:.76rem;margin-top:3px">المضغوط = كل فرد في سطر بأعمدة (أقل صفحات).</div>
      </div>
      <div class="field"><label>الفرع</label><select id="pt_branch" class="tl-sel" style="width:100%">${isAdmin() ? '<option value="">كل الشجرة</option>' : ''}${bopts}</select></div>
      <div class="field"><label>ابدأ من جدٍّ محدّد (اختياري)</label>
        <div class="father-pick"><div id="pt_anclbl" class="father-name empty">— من جذر الفرع —</div>
        <div class="btn-row"><button class="btn sm" id="pt_pick" style="margin:0">🔍 اختيار الجدّ</button><button class="btn sm outline" id="pt_clr" style="margin:0">إلغاء</button></div></div></div>
      <div class="field"><label>عدد الأجيال المعروضة</label><input id="pt_gens" type="number" min="1" max="12" value="4" class="tl-sel" style="width:100px"></div>
      <div class="grid-fields">
        <label class="perm-chk"><input type="checkbox" id="pt_status" checked><span>إظهار الحالة</span></label>
        <label class="perm-chk"><input type="checkbox" id="pt_city"><span>إظهار المدينة</span></label>
        <label class="perm-chk"><input type="checkbox" id="pt_kids"><span>إظهار عدد الأبناء</span></label>
        <label class="perm-chk"><input type="checkbox" id="pt_alive"><span>الأحياء فقط</span></label>
      </div>
      <button class="btn btn-lg" id="pt_go" style="margin-top:10px">📄 توليد النسخة</button>
    </div>`;
  const setAnc = (p) => { ptStart = p; const el = document.getElementById('pt_anclbl'); el.textContent = p ? '👤 ' + p.name + ' (جيل ' + p.generation + ')' : '— من جذر الفرع —'; el.classList.toggle('empty', !p); };
  document.getElementById('pt_pick').addEventListener('click', () => pickPerson('اختر الجدّ الذي تبدأ منه', p => setAnc(p), (!isAdmin() && isManager()) ? (p => inMyBranch(p)) : null));
  document.getElementById('pt_clr').addEventListener('click', () => setAnc(null));
  document.querySelectorAll('#pt_style .seg-b').forEach(b => b.addEventListener('click', () => { ptStyle = b.dataset.pst; document.querySelectorAll('#pt_style .seg-b').forEach(x => x.classList.toggle('on', x === b)); }));
  document.getElementById('pt_go').addEventListener('click', () => {
    const branchId = document.getElementById('pt_branch').value;
    let start = ptStart;
    if (!start) { if (branchId) start = branchRoot(parseInt(branchId, 10)); else start = roots()[0]; }
    if (!start) { toast('اختر فرعاً أو جدّاً'); return; }
    if (!isAdmin() && isManager() && !inMyBranch(start)) { toast('هذا خارج فرعك'); return; }
    ptOpts = {
      start,
      gens: Math.max(1, Math.min(12, parseInt(document.getElementById('pt_gens').value, 10) || 4)),
      status: document.getElementById('pt_status').checked,
      city: document.getElementById('pt_city').checked,
      kids: document.getElementById('pt_kids').checked,
      aliveOnly: document.getElementById('pt_alive').checked,
      style: ptStyle,
      branchName: branchId ? branchName(parseInt(branchId, 10)) : '',
    };
    setHash('#/printview');
  });
}
// يبني جسم النسخة المختصرة (يُعرض داخل الموقع ثم يُطبع) — بنمطين.
function printTreeBody(o) {
  const start = o.start;
  const childrenFor = (p) => {
    let cs = childrenOf(p.id);
    if (o.aliveOnly) cs = cs.filter(c => c.status !== 'dead');
    return cs.slice().sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
  };
  const metaOf = (p) => {
    const meta = [];
    if (o.status && p.status === 'dead') meta.push((descCount.get(p.id) || 0) === 0 ? 'لم يعقب' : 'متوفّى');
    if (o.city && p.city) meta.push(esc(p.city));
    if (o.kids && (childCount.get(p.id) || 0)) meta.push((childCount.get(p.id)) + ' أبناء');
    return meta.length ? ` <span class="m">(${meta.join(' • ')})</span>` : '';
  };
  let body, count = 0;
  if (o.style === 'outline') {
    const node = (p, depth) => {
      count++;
      let sub = '';
      if (depth + 1 < o.gens) { const cs = childrenFor(p); if (cs.length) sub = `<ul>${cs.map(c => node(c, depth + 1)).join('')}</ul>`; }
      return `<li><span class="nm">${esc(p.name)}</span>${metaOf(p)}${sub}</li>`;
    };
    body = `<div class="ptv-cols"><ul class="ptv-tree">${node(start, 0)}</ul></div>`;
  } else {
    const lines = [];
    (function walk(p, num, depth) {
      count++;
      const ind = Math.min(depth, 8) * 9;
      lines.push(`<div class="ptv-r" style="padding-inline-start:${ind}px"><span class="ptv-num">${num.join('‑')}</span> <span class="nm">${esc(p.name)}</span>${metaOf(p)}</div>`);
      if (depth + 1 < o.gens) childrenFor(p).forEach((c, i) => walk(c, num.concat(i + 1), depth + 1));
    })(start, [1], 0);
    body = `<div class="ptv-cols ptv-idx">${lines.join('')}</div>`;
  }
  const title = o.branchName ? ('فرع ' + o.branchName) : start.name;
  return `<div class="ptv-h1">المشجّرة المختصرة — ${esc(title)}</div>
    <div class="ptv-sub">يبدأ من: ${esc(start.name)} • ${o.gens} أجيال • ${count} فرد • ${new Date().toLocaleDateString('ar')}</div>
    ${body}
    <div class="ptv-foot">هذه نسخة مختصرة من قاعدة بيانات قبيلة المفارجة — powered by Mohamad Shaman almfrji</div>`;
}
function screenPrintView() {
  if (!ptOpts) { setHash('#/printtree'); return; }
  view().innerHTML = `
    <div class="btn-row no-print" style="margin-bottom:10px">
      <button class="btn" id="pv_print">🖨️ طباعة / حفظ PDF</button>
      <button class="btn outline" id="pv_back">⚙️ تغيير الخيارات</button>
    </div>
    <div class="ptv print-area">${printTreeBody(ptOpts)}</div>`;
  document.getElementById('pv_print').addEventListener('click', () => window.print());
  document.getElementById('pv_back').addEventListener('click', () => setHash('#/printtree'));
}

/* ===== صفحة الشخص ===== */
async function screenPerson(arg) {
  const id = parseInt(arg, 10); const p = byId.get(id);
  if (!p) { view().innerHTML = '<div class="center-empty">الشخص غير موجود.</div>'; return; }
  document.getElementById('screenTitle').textContent = p.name;
  const ln = lineage(id);
  const chain = ln.map((x, i) => i === 0 ? esc(x.name) : `<a href="#/person/${x.id}">${esc(x.name)}</a>`).join(' بن ');
  const f = p.father_id ? byId.get(p.father_id) : null;
  const cs = childrenOf(id);
  const grand = cs.flatMap(c => childrenOf(c.id));
  showLoading(true);
  let docs = [];
  const showDocs = !hideForGuest('media');   // الزائر (إن أُخفيت الوسائط) لا يرى الصور/الوثائق
  if (showDocs) { try { const { data } = await sb.from('almfrje_documents').select('*').eq('person_id', id).order('id'); docs = data || []; } catch (e) { } }
  showLoading(false);
  view().innerHTML = `
    <div class="card"><div class="person-hd">${avatar(p, true)}
      <div><div class="li-title" style="font-size:1.3rem"><span class="${nameCls(p)}"${nameTitle(p)}>${esc(p.name)}</span>${nickSuffix(p)}</div>
      <div><span class="badge">جيل ${p.generation}</span> <span class="badge role">${esc(branchName(p.branch_id))}</span></div></div></div>
      <div class="lineage" style="margin-top:10px">${chain}</div>
    </div>
    <div class="card"><h3>البيانات</h3>
      ${p.nickname ? row('اللقب', esc(p.nickname)) : ''}
      ${row('الأب المباشر', f ? `<a href="#/person/${f.id}" style="color:var(--brand);text-decoration:none">${esc(f.name)}</a>` : '— (الأصل)')}
      ${row('الفرع', `<a href="#/branch/${p.branch_id || 0}" style="color:var(--brand);text-decoration:none">${esc(branchName(p.branch_id))}</a>`)}
      ${p.status === 'dead' ? row('الحالة', `<span class="${(descCount.get(p.id) || 0) === 0 ? 'died-noissue-txt' : 'died-txt'}">${statusText(p)}</span>`) : ''}
      ${p.work && !hideForGuest('notes') ? row('الحالة الوظيفية', arOf(WORK, p.work)) : ''}
      ${p.birth ? row('الميلاد', esc(p.birth)) : ''}
      ${p.birthplace ? row('مكان الميلاد', esc(p.birthplace)) : ''}
      ${p.status === 'dead' && p.death ? row('الوفاة', esc(p.death)) : ''}
      ${p.city ? row('المدينة', esc(p.city)) : ''}
      ${p.phone && !hideForGuest('phone') ? row('الجوال', esc(p.phone)) : ''}
      ${p.email && !hideForGuest('phone') ? row('البريد', esc(p.email)) : ''}
      ${p.notes && !hideForGuest('notes') ? row('ملاحظات', esc(p.notes)) : ''}
      ${''/* «من أضاف/عدّل» لا يظهر في ملف الشخص — يبقى في سجل التعديلات لمدير النظام فقط */}
    </div>
    <div class="stats" style="grid-template-columns:1fr 1fr 1fr">
      <div class="stat"><div class="n">${cs.length}</div><div class="l">الأبناء</div></div>
      <div class="stat a"><div class="n">${grand.length}</div><div class="l">الأحفاد</div></div>
      <div class="stat g"><div class="n">${descCount.get(id) || 0}</div><div class="l">إجمالي الذرية</div></div>
    </div>
    <div class="card"><h3>الأبناء (${cs.length})</h3>${cs.length > 1 && canReorder(p) ? '<div class="reorder-hint"><b>↕️ ترتيب الأبناء</b> — رتّب بالسهمين ▲▼ لكل ابن. يبقى ضمن إخوته فقط ولا يتجاوز الأب.</div>' : ''}<div id="childList" class="${cs.length > 1 && canReorder(p) ? 'reorder-list' : ''}">${cs.length ? cs.map(c => `<div class="row child-row"${cs.length > 1 && canReorder(p) ? ` data-reorder-id="${c.id}"` : ''}>${cs.length > 1 && canReorder(p) ? `<span class="reorder-arrows"><button class="reorder-up" data-up="${c.id}" aria-label="تحريك لأعلى">▲</button><button class="reorder-down" data-down="${c.id}" aria-label="تحريك لأسفل">▼</button></span>` : ''}<span class="k"><a href="#/person/${c.id}" style="color:var(--brand);text-decoration:none">${esc(c.name)}</a>${nickSuffix(c)}</span><span class="v">${descCount.get(c.id) || 0} ذرية</span></div>`).join('') : noItem()}</div></div>
    ${showDocs ? `<div class="card"><h3>الوثائق والصور (${docs.length})</h3>
      ${docs.length ? docs.map(d => `<div class="row"><span class="k">${d.kind === 'photo' ? '🖼️' : d.kind === 'pdf' ? '📄' : '📎'} <a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:none">${esc(d.label || 'ملف')}</a></span>${canDelete() ? `<button class="btn sm danger" data-ddel="${d.id}">حذف</button>` : ''}</div>`).join('') : noItem()}
      ${canEditPerson(p) ? `<button class="btn outline" id="addDoc" style="margin-top:8px">➕ إضافة صورة/وثيقة</button>` : ''}
    </div>` : ''}
    <div class="btn-row no-print">
      <button class="btn" id="toolsP">🧭 أدوات النسب</button>
      <button class="btn outline" data-go="#/tree/${id}">🌳 الشجرة</button>
      <button class="btn outline" data-go="#/descendants/${id}">👨‍👩‍👧 الذرية</button>
      ${canExport() ? `<button class="btn outline" id="printP">🖨️ تقرير / PDF</button>` : ''}
      ${canAddChildTo(p) ? `<button class="btn" id="addSon">➕ إضافة ابن</button>` : ''}
      ${canEditPerson(p) ? `<button class="btn outline" data-go="#/person-edit/${id}">✎ تعديل</button>` : ''}
    </div>`;
  bindGo();
  { const tb = document.getElementById('toolsP'); if (tb) tb.addEventListener('click', () => openLens(id)); }
  const as = document.getElementById('addSon'); if (as) as.addEventListener('click', () => { presetFather = p; setHash('#/person-edit/0'); });
  const pr = document.getElementById('printP'); if (pr) pr.addEventListener('click', () => window.print());
  const ad = document.getElementById('addDoc'); if (ad) ad.addEventListener('click', () => addDocModal(p));
  if (cs.length > 1 && canReorder(p)) {
    const childList = document.getElementById('childList');
    bindChildArrows(childList, id);                              // الترتيب الدقيق بالأسهم ▲▼
    enableReorder(childList, cs.map(c => c.id), id);             // وسحبٌ مطوّل اختياري
  }
  view().querySelectorAll('[data-ddel]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirm2('حذف هذا الملف؟'))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_documents').delete().eq('id', b.dataset.ddel); if (error) throw error; });
    if (ok) { toast('تم الحذف'); screenPerson(arg); }
  }));
}
// إعادة ترتيب الأبناء بالسحب والإفلات — يُفعَّل بالضغط المطوّل، ويبقى ضمن إخوته (نفس الأب).
function enableReorder(listEl, originalIds, fatherId) {
  if (!listEl) return;
  let dragEl = null, timer = null, active = false, startY = 0, suppressClickUntil = 0;
  const rows = () => [...listEl.querySelectorAll('[data-reorder-id]')];
  // امنع فتح رابط الابن مباشرةً بعد عملية سحب
  listEl.addEventListener('click', (e) => { if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
  rows().forEach(row => {
    row.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      dragEl = row; startY = e.clientY; active = false;
      const activate = () => {
        active = true;
        row.classList.add('reorder-grab'); listEl.classList.add('reordering');
        try { row.setPointerCapture(e.pointerId); } catch (_) { }
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { } }
      };
      // السحب من المقبض «⠿» يبدأ فوراً؛ ومن أي مكان آخر بالضغط المطوّل (احتياط).
      if (e.target && e.target.closest && e.target.closest('.reorder-grip')) { e.preventDefault(); activate(); }
      else { timer = setTimeout(activate, 550); }
    });
    row.addEventListener('pointermove', (e) => {
      if (!active) { if (Math.abs(e.clientY - startY) > 14) clearTimeout(timer); return; }
      e.preventDefault();
      const y = e.clientY;
      for (const r of rows()) {
        if (r === dragEl) continue;
        const rect = r.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          if (y < rect.top + rect.height / 2) listEl.insertBefore(dragEl, r);
          else listEl.insertBefore(dragEl, r.nextSibling);
          break;
        }
      }
    });
    const finish = async () => {
      clearTimeout(timer);
      if (!active) { dragEl = null; return; }
      active = false; listEl.classList.remove('reordering'); row.classList.remove('reorder-grab');
      suppressClickUntil = Date.now() + 400;
      const order = rows().map(r => parseInt(r.dataset.reorderId, 10));
      dragEl = null;
      if (order.join(',') === originalIds.join(',')) return;   // لا تغيير
      await commitReorder(order, fatherId);
    };
    row.addEventListener('pointerup', finish);
    row.addEventListener('pointercancel', () => { clearTimeout(timer); active = false; listEl.classList.remove('reordering'); row.classList.remove('reorder-grab'); dragEl = null; });
  });
}
async function commitReorder(order, fatherId) {
  const names = order.map(idn => (byId.get(idn) || {}).name).filter(Boolean);
  const ok1 = await confirm2('الترتيب الجديد للأبناء:\n' + names.map((n, i) => (i + 1) + '. ' + n).join('\n'), { title: 'تأكيد ترتيب الأبناء', okText: 'حفظ الترتيب', danger: false });
  if (!ok1) { screenPerson(String(fatherId)); return; }
  showLoading(true);
  const who = (me && (me.full_name || me.username)) || '';
  const ok = await guard(async () => {
    for (let i = 0; i < order.length; i++) { const { error } = await sb.from('almfrje_persons').update({ sort: i + 1, updated_by_name: who, updated_at: new Date().toISOString() }).eq('id', order[i]); if (error) throw error; }
    await auditLog('edit', fatherId, 'إعادة ترتيب الأبناء');
  });
  showLoading(false);
  if (ok) toast('تم حفظ الترتيب');
  await loadAll();
  screenPerson(String(fatherId));
}
// ترتيب الأبناء بالأسهم ▲▼ — دقيق، يبقى ضمن الأب فقط، ويُحفظ مؤجَّلاً (يجمّع الضغطات المتتالية).
function bindChildArrows(listEl, fatherId) {
  if (!listEl) return;
  const persist = debounce(() => persistChildOrder(listEl, fatherId), 650);
  const setState = () => {
    const rs = [...listEl.querySelectorAll('[data-reorder-id]')];
    rs.forEach((r, i) => {
      const up = r.querySelector('.reorder-up'), dn = r.querySelector('.reorder-down');
      if (up) up.disabled = (i === 0);
      if (dn) dn.disabled = (i === rs.length - 1);
    });
  };
  const move = (childId, dir) => {
    const rs = [...listEl.querySelectorAll('[data-reorder-id]')];
    const idx = rs.findIndex(r => parseInt(r.dataset.reorderId, 10) === childId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= rs.length) return;
    if (dir < 0) listEl.insertBefore(rs[idx], rs[j]); else listEl.insertBefore(rs[j], rs[idx]);
    // حدّث الترتيب محلياً فوراً (ضمن الأب فقط) ثم احفظ مؤجَّلاً
    const order = [...listEl.querySelectorAll('[data-reorder-id]')].map(r => parseInt(r.dataset.reorderId, 10));
    order.forEach((cid, i) => { const c = byId.get(cid); if (c) c.sort = i + 1; });
    const arr = kids.get(fatherId); if (arr) arr.sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
    setState();
    persist();
  };
  listEl.querySelectorAll('.reorder-up, .reorder-down').forEach(b => {
    b.addEventListener('pointerdown', e => e.stopPropagation());   // لا يبدأ سحباً
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (b.disabled) return;
      const up = b.classList.contains('reorder-up');
      move(parseInt(up ? b.dataset.up : b.dataset.down, 10), up ? -1 : 1);
    });
  });
  setState();
}
async function persistChildOrder(listEl, fatherId) {
  const order = [...listEl.querySelectorAll('[data-reorder-id]')].map(r => parseInt(r.dataset.reorderId, 10));
  if (!order.length) return;
  const who = (me && (me.full_name || me.username)) || '';
  const ok = await guard(async () => {
    for (let i = 0; i < order.length; i++) {
      const { error } = await sb.from('almfrje_persons').update({ sort: i + 1, updated_by_name: who, updated_at: new Date().toISOString() }).eq('id', order[i]); if (error) throw error;
    }
    await auditLog('edit', fatherId, 'إعادة ترتيب الأبناء');
  });
  if (ok) toast('تم حفظ ترتيب الأبناء ✓');
}
// شاشة «ترتيب الأبناء» (المزيد ← الإدارة) — شجرة تصفّح: اضغط الاسم لتدخل لأبنائه
// وتتدرّج حتى تصل للأب المطلوب، ثم رتّب أبناءه بالأسهم. مع بحثٍ للقفز السريع.
let reorderNav = null;   // الأب الحالي (null = الأصول)
function screenReorder() {
  if (!(isAdmin() || isManager())) { view().innerHTML = noPerm(); return; }
  const tops = () => (!isAdmin() && isManager()) ? myBranches().map(bid => branchRoot(bid)).filter(Boolean) : roots();
  view().innerHTML = `
    <div class="card">
      <h3>↕️ ترتيب الأبناء</h3>
      <p class="muted" style="font-size:.85rem">اضغط الاسم لتدخل لأبنائه وتتدرّج للأسفل حتى تصل للأب المطلوب، ثم رتّب أبناءه بالسهمين ▲▼ (يبقى ضمن إخوته فقط ويُحفظ تلقائياً). أو ابحث للقفز السريع.</p>
      <div class="search"><input id="ro_q" placeholder="ابحث بالاسم للقفز مباشرة…"></div>
    </div>
    <div id="ro_body"></div>`;
  const q = document.getElementById('ro_q'), body = document.getElementById('ro_body');
  const renderBrowse = () => {
    const cur = (reorderNav && byId.get(reorderNav.id)) ? byId.get(reorderNav.id) : null;
    const list = cur ? childrenOf(cur.id) : tops();
    const crumb = cur ? lineage(cur.id).slice().reverse() : [];
    const canOrder = !!cur && list.length > 1 && canReorder(cur);
    body.innerHTML = `
      <div class="card">
        <div class="anc-bar">
          <button class="btn sm outline" id="ro_top" ${!cur ? 'disabled' : ''}>⌂ القمة</button>
          ${cur ? '<button class="btn sm outline" id="ro_up">↑ للأعلى</button>' : ''}
        </div>
        ${cur ? `<div class="anc-crumb">${crumb.map(x => `<span class="anc-cl" data-rogo="${x.id}">${esc(x.name)}</span>`).join(' › ')}</div>` : '<div class="muted" style="margin-bottom:6px">اختر الأصل ثم تدرّج لأبنائه:</div>'}
        <h3 style="margin:.2rem 0 .4rem">${cur ? '👤 ' + esc(cur.name) + ' — الأبناء (' + list.length + ')' : 'الأصول'}</h3>
        ${canOrder ? '<div class="reorder-hint"><b>↕️ رتّب بالأسهم ▲▼</b> (ضمن إخوته فقط)، واضغط الاسم للدخول لأبنائه.</div>'
          : (cur && list.length === 1 ? '<div class="muted" style="padding:4px 0 8px">ابنٌ واحد — اضغط اسمه للدخول لأبنائه.</div>'
          : (cur && list.length && !canOrder ? '<div class="muted" style="padding:4px 0 8px">اضغط الاسم للدخول لأبنائه.</div>' : ''))}
        <div id="childList" class="${canOrder ? 'reorder-list' : ''}">
          ${list.length ? list.map(c => {
            const kc = childCount.get(c.id) || 0;
            return `<div class="row child-row"${canOrder ? ` data-reorder-id="${c.id}"` : ''}>${canOrder ? `<span class="reorder-arrows"><button class="reorder-up" data-up="${c.id}" aria-label="أعلى">▲</button><button class="reorder-down" data-down="${c.id}" aria-label="أسفل">▼</button></span>` : ''}<span class="k"><a href="#" data-rointo="${c.id}" style="color:var(--brand);text-decoration:none">${esc(c.name)}</a>${nickSuffix(c)}</span><span class="v">${kc ? kc + ' ابن ›' : (descCount.get(c.id) || 0) + ' ذرية'}</span></div>`;
          }).join('') : '<div class="muted" style="padding:6px">لا أبناء.</div>'}
        </div>
      </div>`;
    const top = document.getElementById('ro_top'); if (top) top.addEventListener('click', () => { reorderNav = null; renderBrowse(); });
    const up = document.getElementById('ro_up'); if (up) up.addEventListener('click', () => { reorderNav = (cur && cur.father_id) ? byId.get(cur.father_id) : null; renderBrowse(); });
    body.querySelectorAll('[data-rointo]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); reorderNav = byId.get(parseInt(a.dataset.rointo, 10)); renderBrowse(); }));
    body.querySelectorAll('[data-rogo]').forEach(s => s.addEventListener('click', () => { reorderNav = byId.get(parseInt(s.dataset.rogo, 10)); renderBrowse(); }));
    if (canOrder) bindChildArrows(document.getElementById('childList'), cur.id);
  };
  const renderSearch = () => {
    let listP = C.persons;
    if (!isAdmin() && isManager()) listP = listP.filter(inMyBranch);
    listP = listP.filter(p => nameMatch(p, q.value)).slice(0, 40);
    body.innerHTML = `<div class="card"><h3>نتائج البحث</h3>${listP.length
      ? listP.map(p => `<div class="card click" data-rojump="${p.id}" style="margin:6px 0;padding:10px"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${esc(lineageShort(p.id))}${(childCount.get(p.id) || 0) ? ' • ' + childCount.get(p.id) + ' ابن' : ''}</div></div>`).join('')
      : '<div class="muted" style="padding:8px">لا نتائج — امسح البحث للتصفّح</div>'}</div>`;
    body.querySelectorAll('[data-rojump]').forEach(c => c.addEventListener('click', () => { reorderNav = byId.get(parseInt(c.dataset.rojump, 10)); q.value = ''; renderBrowse(); }));
  };
  q.addEventListener('input', debounce(() => (q.value.trim() ? renderSearch() : renderBrowse()), 130));
  renderBrowse();
}
function addDocModal(p) {
  openModal('إضافة صورة / وثيقة', `
    ${fSelect('النوع', 'd_kind', [{ k: 'photo', ar: 'صورة' }, { k: 'pdf', ar: 'ملف PDF' }, { k: 'doc', ar: 'وثيقة أخرى' }], 'photo')}
    ${fInput('الوصف', 'd_label', '')}
    <div class="field"><label>رفع ملف (إلى التخزين) — أو ضع رابطاً أدناه</label><input id="d_file" type="file" accept="image/*,application/pdf"></div>
    ${fInput('رابط مباشر (اختياري)', 'd_url', '')}
    <button class="btn" id="d_save">حفظ</button>`, () => {
    document.getElementById('d_save').addEventListener('click', async () => {
      const file = document.getElementById('d_file').files[0];
      let url = val('d_url').trim();
      const ok = await guard(async () => {
        if (file) url = await uploadFile(file, 'docs');
        if (!url) throw new Error('أضِف ملفاً أو رابطاً');
        const { error } = await sb.from('almfrje_documents').insert({ person_id: p.id, kind: val('d_kind'), url, label: val('d_label').trim() });
        if (error) throw error;
      });
      if (ok) { closeModal(); toast('تم الحفظ'); screenPerson(String(p.id)); }
    });
  });
}
let _bucketReady = false;
async function uploadFile(file, folder) {
  // الرفع عبر الخادم (مفتاح خدمي) — لا يحتاج سياسات تخزين ولا إعداداً يدوياً.
  const { data: { session } } = await sb.auth.getSession();
  const token = session && session.access_token;
  if (!token) throw new Error('انتهت الجلسة — أعد تسجيل الدخول');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder || 'misc');
  const res = await fetch('/api/almfrje-upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error('فشل رفع الصورة: ' + (j.error || res.status));
  return j.url;
}

/* ===== فهرسة احترافية للذرية (ترقيم أنساب هرمي) ===== */
// يبني قائمة مرتّبة بعمق-أوّل لكل ذرية شخص، مع رقم نَسَبي هرمي (1، 1‑1، 1‑1‑2 …)
// ومستوى إزاحة لكل فرد — أساس العرض والتصدير.
function buildIndex_(rootId) {
  const out = [];
  const root = byId.get(rootId);
  if (!root) return out;
  function walk(p, num, depth) {
    out.push({ p, num, depth });
    const cs = childrenOf(p.id);
    cs.forEach((c, i) => walk(c, num.concat(i + 1), depth + 1));
  }
  walk(root, [1], 0);
  return out;
}
const numStr = (arr) => arr.join('‑');   // فاصل غير قابل للكسر بين الأرقام

function screenDescendants(arg) {
  const id = parseInt(arg, 10); const p = byId.get(id);
  if (!p) { view().innerHTML = '<div class="center-empty">الشخص غير موجود.</div>'; return; }
  document.getElementById('screenTitle').textContent = 'فهرس ذرية ' + p.name;
  const all = descendants(id);
  const cs = childrenOf(id);
  const grand = cs.flatMap(c => childrenOf(c.id));
  const idx = buildIndex_(id);          // يشمل الجذر (الشخص نفسه) في أوّله

  // عرض الفهرس الهرمي المرقّم
  const indexRows = idx.map(({ p: x, num, depth }) => {
    const kidsN = childCount.get(x.id) || 0;
    const descN = descCount.get(x.id) || 0;
    const isRoot = depth === 0;
    const isParent = kidsN > 0;
    const pad = Math.min(depth, 8) * 14;   // إزاحة متدرّجة بحدّ أقصى تمنع التداخل في الأجيال العميقة
    return `<div class="idx-row${isRoot ? ' idx-root' : ''}${isParent ? ' idx-parent' : ''}" style="padding-inline-start:${pad}px">
      <span class="idx-num" dir="ltr">${numStr(num)}</span>
      <a href="#/person/${x.id}" class="idx-name ${nameCls(x)}"${nameTitle(x)}>${esc(x.name)}</a>${nickSuffix(x)}${statusTag(x)}
      ${kidsN ? `<span class="idx-meta">${kidsN} ابن • ${descN} ذرية</span>` : ''}
    </div>`;
  }).join('');

  view().innerHTML = `
    <div class="card"><div class="person-hd">${avatar(p)}<div><div class="li-title">${esc(p.name)}</div><div class="li-sub">${esc(lineageShort(id))}</div></div></div></div>
    <div class="stats" style="grid-template-columns:1fr 1fr 1fr">
      <div class="stat"><div class="n">${cs.length}</div><div class="l">الأبناء</div></div>
      <div class="stat a"><div class="n">${grand.length}</div><div class="l">الأحفاد</div></div>
      <div class="stat g"><div class="n">${all.length}</div><div class="l">إجمالي الذرية</div></div>
    </div>
    ${canExport() ? `<div class="btn-row no-print">
      <button class="btn sm" id="ex_xlsx">📗 تصدير Excel</button>
      <button class="btn sm outline" id="ex_pdf">📄 طباعة / PDF</button>
      <button class="btn sm outline" id="ex_txt">📝 نص مرقّم</button>
    </div>` : ''}
    ${idx.length > 1 ? `<div class="card idx-card"><h3>الفهرس النَّسَبي (${all.length} فرد) ${hintBtn('descendants')}</h3><div class="idx-list">${indexRows}</div></div>${legendHtml()}` : '<div class="center-empty">لا ذرية مسجّلة.</div>'}`;
  bindGo();
  const xb = document.getElementById('ex_xlsx'); if (xb) xb.addEventListener('click', () => exportDescendantsExcel(id));
  const pb = document.getElementById('ex_pdf'); if (pb) pb.addEventListener('click', () => exportDescendantsPdf(id));
  const tb = document.getElementById('ex_txt'); if (tb) tb.addEventListener('click', () => exportDescendantsText(id));
}

// تصدير Excel بنفس طريقة ملف المصدر: كل جيل في عمود مستقل (شجرة الأعمدة).
// ألوان أعمدة خفيفة متناسقة (تتكرّر إذا زادت الأعمدة)
const COL_FILLS = ['EEF2FF', 'ECFEFF', 'ECFDF5', 'FEFCE8', 'FEF2F2', 'F5F3FF', 'FFF7ED', 'F0FDFA'];
const HEAD_FILLS = ['4338CA', '0891B2', '059669', 'CA8A04', 'DC2626', '7C3AED', 'EA580C', '0D9488'];
async function exportDescendantsExcel(rootId) {
  const root = byId.get(rootId); if (!root) return;
  try { toast('… تجهيز Excel'); await loadXLSX(); } catch (e) { toast('تعذّر تحميل مكتبة Excel'); return; }
  const idx = buildIndex_(rootId);
  const baseGen = root.generation;
  const maxCol = idx.reduce((m, it) => Math.max(m, it.p.generation - baseGen), 0);
  const ncol = maxCol + 2;   // عمود الرقم + أعمدة الأجيال
  const aoa = [];
  const head = ['الرقم']; for (let i = 0; i <= maxCol; i++) head.push('الجيل ' + (baseGen + i));
  aoa.push(head);
  // علّم بداية كل فرع رئيسي (ابن مباشر للجذر) لوضع خط سميك فاصل
  const branchStartRows = new Set();
  idx.forEach(({ p, num, depth }) => { if (depth === 1) branchStartRows.add(aoa.length); aoa.push(rowFor(p, numStr(num), baseGen, maxCol)); });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = head.map((_, i) => ({ wch: i === 0 ? 12 : 18 }));
  ws['!sheetViews'] = [{ RTL: true }];

  const thin = { style: 'thin', color: { rgb: 'D1D5DB' } };
  const thick = { style: 'thick', color: { rgb: '111827' } };
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; R++) {
    const isHead = R === 0;
    const isBranchStart = branchStartRows.has(R);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      const colorIdx = C === 0 ? 0 : ((C - 1) % COL_FILLS.length);
      const border = {
        top: isBranchStart ? thick : thin, bottom: thin, left: thin, right: thin,
      };
      if (isHead) {
        ws[addr].s = {
          fill: { fgColor: { rgb: C === 0 ? '1F2937' : HEAD_FILLS[(C - 1) % HEAD_FILLS.length] } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: { top: thick, bottom: thick, left: thin, right: thin },
        };
      } else {
        ws[addr].s = {
          fill: { fgColor: { rgb: C === 0 ? 'F3F4F6' : COL_FILLS[colorIdx] } },
          font: { bold: C !== 0 && !!ws[addr].v, sz: 11, color: { rgb: '111827' } },
          alignment: { horizontal: C === 0 ? 'center' : 'right', vertical: 'center' },
          border,
        };
      }
    }
  }
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 22 };
  XLSX.utils.book_append_sheet(wb, ws, 'الذرية');

  // ورقة تفصيلية منسّقة
  const det = [['الرقم', 'الاسم', 'الأب', 'الجيل', 'الحالة', 'الميلاد', 'الوفاة', 'المدينة']];
  idx.forEach(({ p, num }) => det.push([numStr(num), p.name, (byId.get(p.father_id) || {}).name || '', p.generation, arOf(STATUS, p.status), p.birth || '', p.death || '', p.city || '']));
  const ws2 = XLSX.utils.aoa_to_sheet(det);
  ws2['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 7 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  ws2['!sheetViews'] = [{ RTL: true }];
  const r2 = XLSX.utils.decode_range(ws2['!ref']);
  for (let C = r2.s.c; C <= r2.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    ws2[addr].s = { fill: { fgColor: { rgb: '4338CA' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center' }, border: { bottom: thick } };
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'تفصيلي');

  XLSX.writeFile(wb, `ذرية_${root.name}.xlsx`);
  toast('تم تصدير Excel منسّق');
}
function rowFor(p, num, baseGen, maxCol) {
  const r = new Array(maxCol + 2).fill('');
  r[0] = num; r[1 + (p.generation - baseGen)] = p.name; return r;
}

// تصدير/طباعة PDF: فهرس نَسَبي مرقّم بإزاحة هرمية، عربي RTL، مهيّأ للطباعة.
function exportDescendantsPdf(rootId) {
  const root = byId.get(rootId); if (!root) return;
  const idx = buildIndex_(rootId);
  const rows = idx.map(({ p, num, depth }) => {
    const meta = (childCount.get(p.id) || 0) ? ` <span style="color:#888;font-size:.8em">(${childCount.get(p.id)} ابن • ${descCount.get(p.id) || 0} ذرية)</span>` : '';
    return `<div style="padding:2px 0;padding-right:${depth * 22}px;border-bottom:1px dotted #ddd;${depth === 0 ? 'font-weight:bold;font-size:1.1em' : ''}">
      <span style="color:#4338CA;font-family:monospace;margin-left:8px">${numStr(num)}</span>
      <span>${esc(p.name)}</span>${p.status === 'dead' ? ' (' + esc(statusText(p)) + ')' : ''}${meta}</div>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
    <title>ذرية ${esc(root.name)}</title>
    <style>body{font-family:'Segoe UI',Tahoma,sans-serif;margin:24px;color:#222}
      h1{color:#4338CA;border-bottom:2px solid #4338CA;padding-bottom:8px}
      .sub{color:#666;margin-bottom:16px}@media print{.noprint{display:none}}</style></head>
    <body><h1>فهرس ذرية: ${esc(root.name)}</h1>
    <div class="sub">${esc(lineageShort(rootId))} • إجمالي الذرية: ${descCount.get(rootId) || 0} فرد • ${new Date().toLocaleDateString('ar')}</div>
    <button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#4338CA;color:#fff;border:0;border-radius:6px;cursor:pointer">🖨️ طباعة / حفظ PDF</button>
    ${rows}
    <script>setTimeout(function(){window.print()},400)<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('اسمح بالنوافذ المنبثقة للطباعة'); return; }
  w.document.write(html); w.document.close();
}

// تصدير نص مرقّم بسيط (يصلح للنسخ في واتساب/وورد).
function exportDescendantsText(rootId) {
  const root = byId.get(rootId); if (!root) return;
  const idx = buildIndex_(rootId);
  const lines = idx.map(({ p, num, depth }) => '  '.repeat(depth) + numStr(num) + '  ' + p.name + (p.status === 'dead' ? ' (' + statusText(p) + ')' : ''));
  download(`ذرية_${root.name}.txt`, lines.join('\n'), 'text/plain');
}


/* ===== الشجرة التفاعلية ===== */
const treeOpen = new Set();
/* ===== (7) وضع تتبّع الفرع ===== */
const TRACK_KEY = 'almfrje_tracked_branch';
function getTracked() { try { const v = parseInt(localStorage.getItem(TRACK_KEY) || '0', 10); return (v && branchById.get(v)) ? v : 0; } catch (e) { return 0; } }
function setTracked(bid) { try { if (bid) localStorage.setItem(TRACK_KEY, String(bid)); else localStorage.removeItem(TRACK_KEY); } catch (e) { /* */ } }
function branchPeople(bid) { const r = branchRoot(bid); if (!r) return []; return [r, ...descendants(r.id)]; }
function trackingBarHtml() {
  const bid = getTracked();
  if (!bid) {
    const gb = isGuestUser() ? (parseInt(sessionStorage.getItem('almfrje_guest_branch') || '0', 10) || 0) : 0;
    return (gb && branchById.get(gb)) ? `<div class="track-bar suggest"><span>عرض فرعك فقط؟</span><button class="btn sm" data-track="${gb}" style="margin:0">🎯 عرض فرعي فقط</button></div>` : '';
  }
  const ppl = branchPeople(bid);
  const gensArr = ppl.map(p => p.generation || 0);
  const gens = ppl.length ? (Math.max(...gensArr) - Math.min(...gensArr) + 1) : 0;
  const recent = ppl.filter(p => p.created_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6);
  return `<div class="track-bar">
    <div class="track-head"><span>🎯 تتصفّح فرع: <b>${esc(branchName(bid))}</b></span><button class="btn sm outline" id="track_cancel" style="margin:0">إلغاء التتبع</button></div>
    <div class="track-up"><div class="track-up-h">تحديثات هذا الفرع</div>
      <div class="track-stats"><span>الأفراد <b>${ppl.length}</b></span><span>الأجيال <b>${gens}</b></span></div>
      ${recent.length ? `<div class="track-recent"><span class="track-lbl">آخر الإضافات:</span>${recent.map(p => `<span class="rel-chip" data-lensid="${p.id}">${esc(p.name)}</span>`).join('')}</div>` : ''}
    </div></div>`;
}
function bindTrackingBar() {
  const c = document.getElementById('track_cancel'); if (c) c.addEventListener('click', () => { setTracked(0); render(); });
  view().querySelectorAll('[data-track]').forEach(b => b.addEventListener('click', () => { const bid = parseInt(b.dataset.track, 10); setTracked(bid); const r = branchRoot(bid); setHash(r ? '#/tree/' + r.id : '#/tree/'); }));
  view().querySelectorAll('.track-bar [data-lensid]').forEach(el => el.addEventListener('click', () => openLens(parseInt(el.dataset.lensid, 10))));
}
function screenTree(arg) {
  const rs = roots();
  let rootId = parseInt(arg, 10);
  // افتراض المشرف: فرعه عند فتح الشجرة بلا تحديد، مع تفعيل التتبّع.
  // التتبّع التلقائي لمشرف الفرع فقط (فرعه محدّد). المشرف العام يتنقّل بين كل الفروع
  // بلا تثبيت — التثبيت التلقائي كان يعلّقه على أول فرعٍ بالقائمة (مرزوق) أينما ذهب.
  if ((!arg || !byId.has(rootId)) && !isAdmin() && isManager() && !isGeneralManager() && !getTracked()) { const b = myBranches()[0], r = b && branchRoot(b); if (r) { setTracked(b); rootId = r.id; } }
  if (!rootId || !byId.has(rootId)) rootId = rs.length ? rs[0].id : 0;
  if (!rootId) { view().innerHTML = '<div class="center-empty">لا توجد بيانات بعد.</div>'; return; }
  const rootOpts = rs.map(r => ({ k: String(r.id), ar: r.name }));
  view().innerHTML = trackingBarHtml() + `
    <div class="card no-print tree-ctl"><div class="grid2">
      ${rootOpts.length > 1 ? fSelect('ابدأ من', 't_root', rootOpts, rootId) : ''}
      <div class="field"><label>اذهب لشخص</label><button class="btn outline" id="t_pick" style="margin-top:0">🔍 اختر شخصاً</button></div>
    </div>
    <div class="btn-row"><button class="btn sm outline" id="t_expand">توسيع المستوى الأول</button><button class="btn sm outline" id="t_collapse">طيّ الكل</button>
      <button class="btn sm outline" data-go="#/hierarchy/${rootId}">عرض هرمي</button></div>
    </div>
    <div class="card tree" id="treeBox"></div>
    ${legendHtml()}`;
  treeOpen.add(rootId);
  renderTree(rootId);
  // تفويض أحداث: مستمعٌ واحد للحاوية بدل ربط كل عقدة في كل رسم (طيٌّ/فتحٌ سلس على الأشجار الكبيرة).
  const treeBox = document.getElementById('treeBox');
  treeBox.addEventListener('click', (e) => {
    const tog = e.target.closest('[data-tog]');
    if (tog && treeBox.contains(tog)) {
      e.stopPropagation(); const id = parseInt(tog.dataset.tog, 10);
      treeOpen.has(id) ? treeOpen.delete(id) : treeOpen.add(id); renderTree(rootId); return;
    }
    const op = e.target.closest('[data-open]');
    if (op && treeBox.contains(op)) openLens(parseInt(op.dataset.open, 10));
  });
  bindGo();
  bindTrackingBar();
  const sel = document.getElementById('t_root'); if (sel) sel.addEventListener('change', () => setHash('#/tree/' + sel.value));
  document.getElementById('t_pick').addEventListener('click', () => pickPerson('اختر شخصاً للشجرة', (p) => p && setHash('#/tree/' + p.id)));
  document.getElementById('t_expand').addEventListener('click', () => { childrenOf(rootId).forEach(c => treeOpen.add(c.id)); renderTree(rootId); });
  document.getElementById('t_collapse').addEventListener('click', () => { treeOpen.clear(); treeOpen.add(rootId); renderTree(rootId); });
}
// رسمٌ خفيف: يكتفي بتحديث HTML؛ النقر يُدار بتفويضٍ واحد على الحاوية (لا إعادة ربط لكل عقدة).
function renderTree(rootId) {
  const box = document.getElementById('treeBox'); if (!box) return;
  box.innerHTML = treeNodeHtml(rootId);
}
function treeNodeHtml(id) {
  const p = byId.get(id); if (!p) return '';
  const cs = childrenOf(id); const open = treeOpen.has(id); const has = cs.length > 0;
  const toggle = has ? `<button class="ttoggle" data-tog="${id}">${open ? '−' : '+'}</button>` : `<span class="ttoggle leaf">•</span>`;
  let html = `<div class="tnode"><div class="trow">${toggle}<span class="tname ${nameCls(p)}" data-open="${id}"${nameTitle(p)}>${esc(p.name)}</span>${nickSuffix(p)}${statusTag(p)}${has ? `<span class="tcount">(${cs.length} • ${descCount.get(id) || 0})</span>` : ''}</div>`;
  if (open && has) html += `<div class="tkids">${cs.map(c => treeNodeHtml(c.id)).join('')}</div>`;
  html += `</div>`;
  return html;
}
// منتقٍ موحّد: بحث فوري بالاسم + تصفّح هرمي (جيلاً بجيل مع مسار تنقّل) للوصول لأي جدّ بسهولة.
//  filterFn: يقيّد ما يُمكن «اختياره» (والتصفّح يمرّ عبر غير القابل للاختيار للوصول لذريّته).
//  startAt: يفتح التصفّح عند عقدة محدّدة (لتعديل الاختيار دون البدء من القمة).
function pickPerson(title, onPick, filterFn, startAt) {
  let nav = (startAt && byId.get(startAt.id)) ? byId.get(startAt.id) : null;   // عقدة التصفّح (null = القمة)
  const tops = () => (!isAdmin() && isManager()) ? myBranches().map(bid => branchRoot(bid)).filter(Boolean) : roots();
  const canPick = (p) => !!p && (!filterFn || filterFn(p));
  openModal(title, `
    <div class="search"><input id="pp_q" placeholder="ابحث بالاسم… أو تصفّح الأجيال بالأسفل"></div>
    <div id="pp_body" style="max-height:55vh;overflow:auto"></div>`, () => {
    const q = document.getElementById('pp_q'), body = document.getElementById('pp_body');
    const take = (p) => { if (canPick(p)) { closeModal(); onPick(p); } };
    const renderSearch = () => {
      let list = C.persons;
      if (filterFn) list = list.filter(filterFn);
      list = list.filter(p => nameMatch(p, q.value)).slice(0, 40);
      body.innerHTML = list.length
        ? list.map(p => `<div class="card click" data-pid="${p.id}" style="margin:6px 0;padding:10px"><div class="li-title">${esc(p.name)}${nickSuffix(p)}</div><div class="li-sub">${esc(lineageShort(p.id))}</div></div>`).join('')
        : '<div class="muted" style="padding:8px">لا نتائج — امسح البحث لتصفّح الأجيال</div>';
      body.querySelectorAll('[data-pid]').forEach(c => c.addEventListener('click', () => take(byId.get(parseInt(c.dataset.pid, 10)))));
    };
    const renderBrowse = () => {
      const cur = nav, list = cur ? childrenOf(cur.id) : tops();
      const crumb = cur ? lineage(cur.id).slice().reverse() : [];
      body.innerHTML = `
        <div class="anc-bar">
          <button class="btn sm outline" id="pp_top" ${!cur ? 'disabled' : ''}>⌂ القمة</button>
          ${cur ? '<button class="btn sm outline" id="pp_up">↑ للأعلى</button>' : ''}
        </div>
        ${cur
          ? `<div class="anc-crumb">${crumb.map(x => `<span class="anc-cl" data-ppgo="${x.id}">${esc(x.name)}</span>`).join(' › ')}</div>
             <div class="anc-cur"><b>${esc(cur.name)}</b> (جيل ${cur.generation})${canPick(cur) ? ' <button class="btn sm" id="pp_pickcur">✅ اختيار هذا</button>' : ''}</div>`
          : '<div class="muted" style="margin-bottom:6px">اختر الأصل ثم تنقّل لأبنائه وصولاً للمطلوب — أو ابحث بالأعلى:</div>'}
        <div class="anc-list">
          ${list.length ? list.map(c => {
            const kc = childCount.get(c.id) || 0;
            return `<div class="anc-row">
              <span class="anc-name" data-ppinto="${c.id}"><b>${esc(c.name)}</b>${nickSuffix(c)} <span class="muted" style="font-size:.78rem;font-weight:400">(جيل ${c.generation}${kc ? ' • ' + kc + ' ابن' : ''})</span></span>
              ${canPick(c) ? `<button class="btn sm" data-pppick="${c.id}">اختيار</button>` : ''}
            </div>`;
          }).join('') : '<div class="muted" style="padding:8px">لا أبناء — استخدم «اختيار هذا» بالأعلى.</div>'}
        </div>`;
      const t = document.getElementById('pp_top'); if (t) t.addEventListener('click', () => { nav = null; renderBrowse(); });
      const u = document.getElementById('pp_up'); if (u) u.addEventListener('click', () => { nav = (cur && cur.father_id) ? byId.get(cur.father_id) : null; renderBrowse(); });
      const pc = document.getElementById('pp_pickcur'); if (pc) pc.addEventListener('click', () => take(cur));
      body.querySelectorAll('[data-ppinto]').forEach(b => b.addEventListener('click', () => { nav = byId.get(parseInt(b.dataset.ppinto, 10)); renderBrowse(); }));
      body.querySelectorAll('[data-pppick]').forEach(b => b.addEventListener('click', () => take(byId.get(parseInt(b.dataset.pppick, 10)))));
      body.querySelectorAll('[data-ppgo]').forEach(b => b.addEventListener('click', () => { nav = byId.get(parseInt(b.dataset.ppgo, 10)); renderBrowse(); }));
    };
    const run = () => q.value.trim() ? renderSearch() : renderBrowse();
    q.addEventListener('input', run); q.focus(); renderBrowse();
  });
}

/* ===== حاسبة صلة القرابة ===== */
let kinA = null, kinB = null;
// الجدّ المشترك الأقرب لشخصين + درجة كلٍّ منهما إليه (عبر سلسلة الآباء).
function lowestCommonAncestor(idA, idB) {
  const pathA = getLineagePath(idA), pathB = getLineagePath(idB);
  const idxB = new Map(); pathB.forEach((p, i) => idxB.set(p.id, i));
  for (let i = 0; i < pathA.length; i++) {
    if (idxB.has(pathA[i].id)) return { lca: pathA[i], dA: i, dB: idxB.get(pathA[i].id), pathA, pathB };
  }
  return { lca: null, dA: -1, dB: -1, pathA, pathB };
}
const genWord = (n) => n === 1 ? 'جيل' : (n === 2 ? 'جيلين' : (n <= 10 ? 'أجيال' : 'جيلاً'));
// يحوّل (درجة A، درجة B) إلى وصفٍ عربيٍّ لصلة القرابة (نسب أبوي).
function kinshipSentence(A, B, info) {
  const { lca, dA, dB } = info;
  if (!lca) return { rel: 'لا تربطهما قرابة مسجّلة', detail: 'الشخصان يعودان إلى أصلين مختلفين في البيانات، فلا جدّ مشترك بينهما.' };
  // نسب مباشر (أحدهما من ذرية الآخر)
  if (dA === 0 || dB === 0) {
    const n = dA + dB;
    const ancP = dA === 0 ? A : B, desP = dA === 0 ? B : A;
    const term = n === 1 ? 'والد' : n === 2 ? 'جدّ' : n === 3 ? 'جدّ والد' : `جدٌّ أعلى (يفصلهما ${n} ${genWord(n)})`;
    return { rel: `${esc(ancP.name)} ${term} ${esc(desP.name)}`, detail: `${esc(desP.name)} من ذريّة ${esc(ancP.name)} المباشرة (${n} ${genWord(n)}).` };
  }
  if (dA === 1 && dB === 1) return { rel: `${esc(A.name)} و${esc(B.name)} أخوان`, detail: `أبوهما المشترك: ${esc(lca.name)}.` };
  // عمّ / ابن أخ (أحد الطرفين ابنٌ مباشر للجدّ المشترك)
  if (Math.min(dA, dB) === 1) {
    const shallow = dA === 1 ? A : B, deep = dA === 1 ? B : A, dDeep = Math.max(dA, dB);
    const uncle = dDeep === 2 ? 'عمّ' : dDeep === 3 ? 'عمّ والد' : dDeep === 4 ? 'عمّ جدّ' : `عمٌّ من الجيل ${dDeep - 1}`;
    const neph = dDeep === 2 ? 'ابن أخ' : dDeep === 3 ? 'ابن أخ والد' : 'من ذريّة أخي';
    return { rel: `${esc(shallow.name)} ${uncle} ${esc(deep.name)}`, detail: `${esc(deep.name)} ${neph} ${esc(shallow.name)} — جدّهما المشترك: ${esc(lca.name)}.` };
  }
  // أبناء عمومة (كلاهما على بُعد جيلين أو أكثر)
  if (dA === dB) {
    const deg = dA - 1;
    const label = deg === 1 ? 'ابنا عمّ (الدرجة الأولى)' : deg === 2 ? 'ابنا عمّ (الدرجة الثانية)' : `ابنا عمّ (الدرجة ${deg})`;
    return { rel: `${esc(A.name)} و${esc(B.name)} ${label}`, detail: `جدّهما المشترك: ${esc(lca.name)}.` };
  }
  const deg = Math.min(dA, dB) - 1, df = Math.abs(dA - dB);
  const base = deg === 1 ? 'ابنا عمّ' : `ابنا عمّ (الدرجة ${deg})`;
  const higher = dA < dB ? A : B;
  return { rel: `${esc(A.name)} و${esc(B.name)} ${base} مع فارق ${df} ${genWord(df)}`, detail: `${esc(higher.name)} أعلى جيلاً — جدّهما المشترك: ${esc(lca.name)}.` };
}
// سلسلة النسب من الشخص حتى الجدّ المشترك (مع إبراز الجدّ).
function kinChainHtml(path, upto, lca) {
  return path.slice(0, upto + 1).map(p => {
    const isLca = lca && p.id === lca.id;
    return `<span class="kin-name${isLca ? ' kin-lca-name' : ''} ${nameCls(p)}" data-lensid="${p.id}">${esc(p.name)}</span>`;
  }).join('<span class="kin-bn">بن</span>');
}
function kinPlainText(A, B, info, s) {
  const lines = [`صلة القرابة بين «${A.name}» و«${B.name}»:`, s.rel + (s.detail ? ' — ' + s.detail : '')];
  if (info.lca) {
    lines.push('', `الجدّ المشترك الأقرب: ${info.lca.name}`);
    lines.push(`نسب ${A.name}: ${info.pathA.slice(0, info.dA + 1).map(p => p.name).join(' بن ')}`);
    lines.push(`نسب ${B.name}: ${info.pathB.slice(0, info.dB + 1).map(p => p.name).join(' بن ')}`);
  }
  return lines.join('\n');
}
function renderKinResult() {
  const box = document.getElementById('kinResult'); if (!box) return;
  if (!kinA || !kinB) { box.innerHTML = ''; return; }
  if (kinA.id === kinB.id) { box.innerHTML = '<div class="card kin-card"><div class="kin-rel">⚠️ اخترت الشخص نفسه في الخانتين.</div></div>'; return; }
  const info = lowestCommonAncestor(kinA.id, kinB.id);
  const s = kinshipSentence(kinA, kinB, info);
  box.innerHTML = `
    <div class="card kin-card">
      <div class="kin-rel">🧬 ${s.rel}</div>
      ${s.detail ? `<div class="kin-detail">${s.detail}</div>` : ''}
      ${info.lca ? `
        <div class="kin-lca">
          <div class="kin-lca-l">الجدّ المشترك الأقرب</div>
          <div class="kin-lca-name ${nameCls(info.lca)}" data-lensid="${info.lca.id}">${esc(info.lca.name)}</div>
          <div class="muted" style="font-size:.78rem">جيل ${info.lca.generation} • ${esc(branchName(info.lca.branch_id))}</div>
        </div>
        <div class="kin-paths">
          <div class="kin-path"><div class="kin-path-l">${esc(kinA.name)} — ${info.dA} ${info.dA === 1 ? 'درجة' : 'درجات'} حتى الجدّ</div><div class="kin-chain">${kinChainHtml(info.pathA, info.dA, info.lca)}</div></div>
          <div class="kin-path"><div class="kin-path-l">${esc(kinB.name)} — ${info.dB} ${info.dB === 1 ? 'درجة' : 'درجات'} حتى الجدّ</div><div class="kin-chain">${kinChainHtml(info.pathB, info.dB, info.lca)}</div></div>
        </div>
        <p class="muted" style="font-size:.78rem;margin:8px 0 0">اضغط أي اسمٍ لفتح العدسة السريعة.</p>` : ''}
      <div class="btn-row" style="margin-top:10px">
        <button class="btn sm outline" id="kin_copy">📋 نسخ النتيجة</button>
      </div>
    </div>`;
  box.querySelectorAll('[data-lensid]').forEach(el => el.addEventListener('click', () => openLens(parseInt(el.dataset.lensid, 10))));
  document.getElementById('kin_copy').addEventListener('click', () => copyText(kinPlainText(kinA, kinB, info, s)));
}
function screenKinship() {
  const slot = (label, p, which) => `
    <div class="kin-slot">
      <div class="kin-slot-l">${label}</div>
      <div class="kin-slot-body">${p
        ? `<div class="kin-slot-p"><b class="${nameCls(p)}">${esc(p.name)}</b><div class="muted" style="font-size:.8rem">${esc(ancestryShort(p.id)) || '— (الأصل)'}</div></div>`
        : '<div class="muted">لم يُختر بعد</div>'}</div>
      <button class="btn sm outline" data-kpick="${which}">${p ? 'تغيير' : 'اختيار'}</button>
    </div>`;
  view().innerHTML = `
    <div class="card">
      <div class="muted" style="margin-bottom:10px">اختر شخصين لمعرفة صلة القرابة بينهما والجدّ المشترك الأقرب.</div>
      ${slot('الشخص الأول', kinA, 'a')}
      <div class="kin-vs">⇕</div>
      ${slot('الشخص الثاني', kinB, 'b')}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn sm" id="kin_swap"${kinA && kinB ? '' : ' disabled'}>↕️ تبديل</button>
        <button class="btn sm outline" id="kin_clear"${kinA || kinB ? '' : ' disabled'}>مسح</button>
      </div>
    </div>
    <div id="kinResult"></div>`;
  view().querySelectorAll('[data-kpick]').forEach(b => b.addEventListener('click', () => {
    const which = b.dataset.kpick;
    pickPerson('اختر الشخص ' + (which === 'a' ? 'الأول' : 'الثاني'), (p) => { if (!p) return; if (which === 'a') kinA = p; else kinB = p; screenKinship(); });
  }));
  document.getElementById('kin_swap').addEventListener('click', () => { const t = kinA; kinA = kinB; kinB = t; screenKinship(); });
  document.getElementById('kin_clear').addEventListener('click', () => { kinA = null; kinB = null; screenKinship(); });
  renderKinResult();
}

/* ===== العرض الهرمي النصي (للطباعة) ===== */
function screenHierarchy(arg) {
  const rs = roots();
  const single = parseInt(arg, 10);
  // arg='all' أو فارغ → كل الأصول (فراج ومفرج تحت «المفرجي»)؛ أو شخص محدّد
  const ids = single && byId.has(single) ? [single] : rs.map(r => r.id);
  if (!ids.length) { view().innerHTML = '<div class="center-empty">لا توجد بيانات.</div>'; return; }
  const all = ids.length > 1;
  document.getElementById('screenTitle').textContent = all ? 'عرض هرمي — المفرجي' : 'عرض هرمي — ' + (byId.get(ids[0]).name);
  view().innerHTML = `
    ${all ? '<div class="hier-top">المفرجي <span class="muted" style="font-weight:normal;font-size:.8rem">(' + rs.map(r => esc(r.name)).join(' • ') + ')</span></div>' : ''}
    <div class="btn-row no-print" style="margin-bottom:10px">
      <button class="btn sm outline" id="h_expand">توسيع الكل</button>
      <button class="btn sm outline" id="h_collapse">طيّ الكل</button>
      <button class="btn sm outline" id="prn">🖨️ طباعة / PDF</button>
    </div>
    <div class="hier-wrap" id="hierBox"></div>`;
  ids.forEach(i => { hierOpen.add(i); childrenOf(i).forEach(c => hierOpen.add(c.id)); });
  renderHier(ids);
  view().insertAdjacentHTML('beforeend', legendHtml());
  document.getElementById('prn').addEventListener('click', () => { ids.forEach(i => hierExpandAll(i)); renderHier(ids); setTimeout(() => window.print(), 60); });
  document.getElementById('h_expand').addEventListener('click', () => { ids.forEach(i => hierExpandAll(i)); renderHier(ids); });
  document.getElementById('h_collapse').addEventListener('click', () => { hierOpen.clear(); ids.forEach(i => hierOpen.add(i)); renderHier(ids); });
}
const hierOpen = new Set();
function hierExpandAll(rootId) { hierOpen.add(rootId); descendants(rootId).forEach(p => hierOpen.add(p.id)); }
function renderHier(rootId) {
  const box = document.getElementById('hierBox'); if (!box) return;
  const roots = Array.isArray(rootId) ? rootId : [rootId];   // يدعم غابة (عدّة جذور)
  roots.forEach(r => hierOpen.add(r));
  box.innerHTML = `<ul class="hier">${roots.map(r => hierNode(r, 0)).join('')}</ul>`;
  box.querySelectorAll('[data-htog]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const hid = parseInt(b.dataset.htog, 10);
    if (hierOpen.has(hid)) hierOpen.delete(hid); else hierOpen.add(hid);
    renderHier(rootId);
  }));
  box.querySelectorAll('[data-hopen]').forEach(b => b.addEventListener('click', () => openLens(parseInt(b.dataset.hopen, 10))));
}
// عرض هرمي للفرع: يبدأ من أبناء جذر الفرع (الجيل الثالث) كإخوة، فهدهود (ج٢) عنوان فقط.
function screenBranchHier(arg) {
  const bid = parseInt(arg, 10); const b = branchById.get(bid);
  if (!b) { view().innerHTML = '<div class="center-empty">الفرع غير موجود.</div>'; return; }
  const rootP = branchRoot(bid);
  const sons = rootP ? childrenOf(rootP.id) : [];
  document.getElementById('screenTitle').textContent = 'فرع ' + b.name;
  if (!sons.length) { view().innerHTML = '<div class="center-empty">لا أبناء في هذا الفرع.</div>'; return; }
  const sonIds = sons.map(s => s.id);
  view().innerHTML = `
    <div class="card" style="padding:10px 14px"><div class="li-title">🗂️ فرع ${esc(b.name)}</div>
      <div class="li-sub">${rootP ? 'الجدّ: ' + esc(rootP.name) + ' • ' : ''}يبدأ العرض من أبنائه (${sons.length})</div></div>
    <div class="btn-row no-print" style="margin-bottom:10px">
      <button class="btn sm outline" id="h_expand">توسيع الكل</button>
      <button class="btn sm outline" id="h_collapse">طيّ الكل</button>
      <button class="btn sm outline" id="prn">🖨️ طباعة / PDF</button>
    </div>
    <div class="hier-wrap" id="hierBox"></div>`;
  sonIds.forEach(s => { hierOpen.add(s); childrenOf(s).forEach(c => hierOpen.add(c.id)); });
  renderHier(sonIds);
  view().insertAdjacentHTML('beforeend', legendHtml());
  document.getElementById('prn').addEventListener('click', () => { sonIds.forEach(s => { hierExpandAll(s); }); renderHier(sonIds); setTimeout(() => window.print(), 60); });
  document.getElementById('h_expand').addEventListener('click', () => { sonIds.forEach(s => hierExpandAll(s)); renderHier(sonIds); });
  document.getElementById('h_collapse').addEventListener('click', () => { hierOpen.clear(); sonIds.forEach(s => hierOpen.add(s)); renderHier(sonIds); });
}
function hierNode(id, depth) {
  const p = byId.get(id); if (!p) return '';
  const cs = childrenOf(id);
  const has = cs.length > 0;
  const open = hierOpen.has(id);
  const dc = descCount.get(id) || 0;
  const lvl = (depth % 6) + 1;   // لون دوري حسب العمق
  const toggle = has
    ? `<button class="hier-tog" data-htog="${id}">${open ? '−' : '+'}</button>`
    : `<span class="hier-dot"></span>`;
  const meta = has ? `<span class="hier-meta">${cs.length} ${cs.length === 1 ? 'ابن' : 'أبناء'}${dc ? ' • ' + dc + ' ذرية' : ''}</span>` : '';
  let html = `<li class="hier-li lvl${lvl}">
    <div class="hier-row">
      ${toggle}
      <div class="hier-main">
        <div class="hier-line"><span class="hier-name ${nameCls(p)}" data-hopen="${id}"${nameTitle(p)}>${esc(p.name)}</span>${nickSuffix(p)}${statusTag(p)}</div>
        ${meta}
      </div>
    </div>`;
  if (has && open) {
    html += `<ul class="hier">${cs.map(c => hierNode(c.id, depth + 1)).join('')}</ul>`;
  }
  html += '</li>';
  return html;
}
function buildAscii(rootId) {
  const p = byId.get(rootId); if (!p) return '';
  const lines = [p.name];
  function walk(id, prefix) {
    const cs = childrenOf(id);
    cs.forEach((c, i) => {
      const last = i === cs.length - 1;
      lines.push(prefix + (last ? '└── ' : '├── ') + c.name);
      walk(c.id, prefix + (last ? '    ' : '│   '));
    });
  }
  walk(rootId, '');
  return lines.join('\n');
}

/* ===== نموذج الأعمدة (شبيه Excel — للطباعة) ===== */
function screenOutline(arg) {
  const rs = roots();
  if (!rs.length) { view().innerHTML = '<div class="center-empty">لا توجد بيانات.</div>'; return; }
  // arg = 'all' أو فارغ → كل الأصول؛ أو معرّف شخص محدّد
  const startId = parseInt(arg, 10);
  const useAll = !startId;
  const startPersons = useAll ? rs : [byId.get(startId)].filter(Boolean);
  if (!startPersons.length) { view().innerHTML = '<div class="center-empty">غير موجود.</div>'; return; }
  document.getElementById('screenTitle').textContent = 'نموذج الأعمدة' + (useAll ? '' : ' — ' + startPersons[0].name);

  // اجمع الصفوف بترتيب عمق-أوّل، مع أصغر جيل أساس
  const baseGen = Math.min(...startPersons.map(p => p.generation));
  const rows = [];
  const walk = (pid) => { const pp = byId.get(pid); if (!pp) return; rows.push(pp); childrenOf(pid).forEach(c => walk(c.id)); };
  startPersons.forEach(p => walk(p.id));
  const maxCol = rows.reduce((m, r) => Math.max(m, r.generation - baseGen), 0);

  // ترويسة الأعمدة (الأجيال)
  let head = '<tr>';
  for (let i = 0; i <= maxCol; i++) head += `<th class="oc oc${i % 6}">الجيل ${baseGen + i}</th>`;
  head += '</tr>';

  const body = rows.map((r, idx) => {
    const col = r.generation - baseGen;
    const isRoot = r.father_id == null || !byId.has(r.father_id);   // فراج/مفرج
    const isBranch = r.generation === 2;                            // رأس فرع (سيف/هدهود…)
    // خطّان فوق الأصل (عدا أوّل صف)، وخط سميك فوق رأس كل فرع
    const cls = isRoot ? (idx > 0 ? 'orow-root' : '') : (isBranch ? 'orow-branch' : '');
    let tds = '';
    for (let i = 0; i <= maxCol; i++) {
      const here = i === col;
      tds += `<td class="oc${i % 6}${here ? ' filled' : ''}${here && isRoot ? ' oroot' : ''}${here && isBranch ? ' obranch' : ''}">${here ? `<span class="${nameCls(r)}"${nameTitle(r)}>${esc(r.name)}</span>` : ''}</td>`;
    }
    return `<tr class="${cls}">${tds}</tr>`;
  }).join('');

  const rootSel = rs.length > 1 ? `<div class="field" style="margin:0;flex:1"><select id="o_root">
      <option value="">📋 كل الأصول</option>
      ${rs.map(r => `<option value="${r.id}" ${!useAll && startId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
    </select></div>` : '';

  view().innerHTML = `
    <div class="btn-row no-print" style="margin-bottom:10px">
      ${rootSel}
      <button class="btn outline" id="prn">🖨️ طباعة / PDF</button>
    </div>
    <div class="outline-wrap"><table class="outline-tbl">${head}${body}</table></div>
    ${legendHtml()}`;
  document.getElementById('prn').addEventListener('click', () => window.print());
  const os = document.getElementById('o_root');
  if (os) os.addEventListener('change', () => setHash('#/outline/' + (os.value || 'all')));
}

/* ===== إضافة / تعديل شخص ===== */
let editFather = null;   // كائن الأب المختار أثناء التحرير
let presetFather = null;   // أب مُمرّر من زر «إضافة ابن» على صفحة الشخص
function screenPersonEdit(arg) {
  if (!canAdd() && !(parseInt(arg, 10) && canEditPerson(byId.get(parseInt(arg, 10))))) { view().innerHTML = noPerm(); return; }
  const id = parseInt(arg, 10) || 0;
  const p = id ? byId.get(id) : null;
  if (id && !p) { view().innerHTML = '<div class="center-empty">غير موجود.</div>'; return; }
  if (!id) {
    // إضافة مولود = معالج بخطوات (اختيار الأب من الشجرة ← الاسم ← مراجعة النسب ← حفظ)
    // لا نقبل الأب المُمرّر إلا إذا كان مسموحاً (حيّ + ضمن فرع المستخدم)، وإلا نبدأ من الشجرة.
    editFather = (presetFather && canAddChildTo(presetFather)) ? presetFather : null;
    presetFather = null;
    document.getElementById('screenTitle').textContent = 'إضافة مولود';
    return addBirthWizard();
  }
  // ——— التعديل: نموذج كامل (بلا حقل الجنس) ———
  editFather = p.father_id ? byId.get(p.father_id) : null;
  document.getElementById('screenTitle').textContent = 'تعديل: ' + p.name;
  view().innerHTML = `
    <div class="card"><h3>البيانات الأساسية</h3>
      <div class="field"><label>الأب المباشر</label><div class="father-name" style="text-align:right">${editFather ? '👤 ' + esc(editFather.name) : '— (الأصل)'}</div></div>
      <div class="field"><label>الاسم *</label><input id="p_name" type="text" value="${esc(p.name || '')}" placeholder="الاسم"></div>
      <div class="field"><label>اللقب</label><input id="p_nickname" type="text" value="${esc(p.nickname || '')}" placeholder="اختياري"></div>
      ${fSelect('الحالة', 'p_status', STATUS, p.status || 'alive')}
      ${fSelect('الحالة الوظيفية', 'p_work', WORK, p.work || '')}
      <div class="grid2">
        <div class="field"><label>سنة الميلاد</label><input id="p_birth" type="text" value="${esc(p.birth || '')}" placeholder="مثال: 1440هـ"></div>
        <div class="field"><label>مكان الميلاد</label><input id="p_birthplace" type="text" value="${esc(p.birthplace || '')}" placeholder="اختياري"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>المدينة</label><input id="p_city" type="text" value="${esc(p.city || '')}" placeholder="اختياري"></div>
        <div class="field"><label>الجوال</label><input id="p_phone" type="tel" inputmode="tel" value="${esc(p.phone || '')}" placeholder="اختياري"></div>
      </div>
      <div class="field" id="p_death_wrap" style="${(p.status === 'dead') ? '' : 'display:none'}"><label>سنة الوفاة</label><input id="p_death" type="text" value="${esc(p.death || '')}" placeholder="إن وُجدت"></div>
      ${fInput('البريد الإلكتروني', 'p_email', p.email, 'email', 'placeholder="اختياري"')}
    </div>
    <div class="card"><h3>الصورة الشخصية (اختياري)</h3>
      <div class="field"><label>رفع صورة — أو ضع رابطاً</label><input id="p_photofile" type="file" accept="image/*"></div>
      ${fInput('رابط الصورة', 'p_photo', p.photo_url, 'text', 'placeholder="اختياري"')}
    </div>
    <div class="card"><h3>ملاحظات (اختياري)</h3>${fTextarea('ملاحظات', 'p_notes', p.notes)}</div>
    <button class="btn btn-lg" id="saveBtn">💾 حفظ التعديل</button>
    ${isAdmin()
      ? `<button class="btn btn-lg danger" id="delBtn" style="margin-top:12px">🗑️ حذف هذا الاسم</button>
    <p class="muted" style="text-align:center;font-size:.8rem;margin-top:6px">الحذف لمدير النظام فقط — تُحفظ نسخة في سلة المحذوفات ويمكن استرجاعها.</p>`
      : `<p class="muted" style="text-align:center;font-size:.82rem;margin-top:8px">🔒 حذف الأسماء غير متاح — التعديل فقط، والنسخة السابقة تُحفظ في سلة المحذوفات.</p>`}`;
  document.getElementById('saveBtn').addEventListener('click', () => savePerson(id, p));
  const delB = document.getElementById('delBtn');
  if (delB) delB.addEventListener('click', () => deletePerson(id, p));
  // سنة الوفاة تظهر للمتوفّى فقط — تُظهر/تُخفى مع تغيير الحالة.
  { const st = document.getElementById('p_status'), dw = document.getElementById('p_death_wrap');
    if (st && dw) st.addEventListener('change', () => { dw.style.display = st.value === 'dead' ? '' : 'none'; if (st.value !== 'dead') { const d = document.getElementById('p_death'); if (d) d.value = ''; } }); }
}

// حذف اسم (لمدير النظام فقط) — حذف مؤقت إلى سلة المحذوفات مع تأكيدين قبل التنفيذ.
async function deletePerson(id, p) {
  if (!isAdmin()) { toast('الحذف لمدير النظام فقط'); return; }
  const childCount = (kids.get(id) || []).length;
  let msg = `حذف الاسم «${p.name}»؟\nتُحفظ نسخة كاملة في سلة المحذوفات ويمكن استرجاعها لاحقاً.`;
  if (childCount > 0) msg = `⚠️ تنبيه: «${p.name}» له ${childCount} من الأبناء المباشرين، وسيصبحون بلا أب عند الحذف.\n\nيُفضّل نقل أبنائه أولاً. المتابعة رغم ذلك؟`;
  if (!(await confirm2(msg, { title: '🗑️ تأكيد حذف الاسم', okText: 'متابعة', danger: true }))) return;
  if (!(await confirm2(`تأكيد نهائي — حذف «${p.name}» من الشجرة؟`, { title: 'تأكيد نهائي', okText: 'نعم، احذف', danger: true }))) return;
  const ok = await guard(async () => {
    // الحذف عبر الخادم بصلاحية كاملة (يتجاوز RLS) — يتحقق الخادم أنّ المُستدعي مديرٌ مفعّل،
    // ويحفظ نسخة في سلة المحذوفات قبل الحذف.
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch('/api/almfrje-delete-person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(session && session.access_token) || ''}` },
      body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || 'تعذّر الحذف');
    await auditLog('delete', id, p.name);
  });
  if (ok) {
    toast(`تم نقل «${p.name}» إلى سلة المحذوفات`);
    await loadAll();
    location.hash = p.father_id ? '#/person/' + p.father_id : '#/tree';
  }
}

/* ===== معالج إضافة مولود (عرض هرمي → الأب → الاسم → مراجعة النسب → حفظ) ===== */
let abwStep = 1;   // 1=اختيار الأب  2=بيانات المولود
function addBirthWizard() {
  abwStep = editFather ? 2 : 1;
  renderAddBirth();
}
function renderAddBirth() {
  const whoName = (me && (me.full_name || me.username)) || '';
  const branchNames = isManager() ? myBranches().map(b => branchName(b)).join('، ') : '';
  const ctx = `
    <div class="add-ctx"><div class="add-ctx-ico">👶</div><div>
      <div class="add-ctx-title">إضافة مولود</div>
      <div class="add-ctx-sub">المُضيف: <b>${esc(whoName)}</b>${isManager() ? ' • الفرع: <b>' + esc(branchNames || '—') + '</b>' : (isAdmin() ? ' • <b>مدير النظام</b>' : '')}</div>
    </div></div>
    <div class="add-steps">
      <span class="add-step ${abwStep === 1 ? 'cur' : (editFather ? 'done' : '')}"><span class="add-step-n">١</span> اختر الأب</span>
      <span class="add-step ${abwStep === 2 ? 'cur' : ''}"><span class="add-step-n">٢</span> بيانات المولود</span>
    </div>`;
  if (abwStep === 1) {
    // الخطوة ١: عرض هرمي للفرع المصرّح به، يُختار منه الأب
    view().innerHTML = ctx + `
      <div class="card" style="padding:10px 14px"><div class="li-sub">اضغط على اسم الأب من الشجرة أدناه ${isManager() ? '(فرعك فقط)' : ''}، ثم تابع.</div></div>
      <div class="hier-wrap abw-tree" id="hierBox"></div>`;
    renderAddBirthTree();
  } else {
    // الخطوة ٢: الاسم + سنة ميلاد + مكان ميلاد فقط، مع سلسلة النسب للموافقة
    const chainPreview = abwChain(editFather, '«اسم المولود»');
    view().innerHTML = ctx + `
      <div class="card add-card">
        <div class="field"><label>الأب المختار</label>
          <div class="father-name">👤 ${esc(editFather ? editFather.name : '— (أصل)')} ${editFather ? '<span class="muted" style="font-weight:normal">(جيل ' + editFather.generation + ')</span>' : ''}</div>
          <button class="btn sm outline" id="abw_back" style="margin-top:6px">↩ تغيير الأب</button>
        </div>
        <div class="field"><label>اسم المولود *</label><input id="p_name" type="text" placeholder="اكتب الاسم"></div>
        <div class="grid2">
          <div class="field"><label>سنة الولادة</label><input id="p_birth" type="text" placeholder="مثال: 1440هـ"></div>
          <div class="field"><label>المدينة (اختياري)</label><input id="p_city" type="text" placeholder="اختياري"></div>
        </div>
        <div class="abw-chain"><div class="abw-chain-t">سلسلة النسب (للمراجعة):</div><div id="abw_chain">${chainPreview}</div></div>
        <button class="btn btn-lg" id="abw_save">✅ مراجعة وحفظ</button>
      </div>`;
    const nameInp = document.getElementById('p_name');
    nameInp.addEventListener('input', () => { document.getElementById('abw_chain').innerHTML = abwChain(editFather, nameInp.value.trim() || '«اسم المولود»'); });
    nameInp.focus();
    document.getElementById('abw_back').addEventListener('click', () => { abwStep = 1; renderAddBirth(); });
    document.getElementById('abw_save').addEventListener('click', abwConfirmSave);
  }
}
// عرض شجرة الفرع لاختيار الأب: تبدأ من أبناء جذر الفرع، وتقف عند كل اسم قابل للاختيار
function renderAddBirthTree() {
  // الجذور المتاحة: للمسؤول فروعه فقط، للمدير كل الأصول
  let startIds;
  if (isManager()) {
    startIds = myBranches().map(bid => branchRoot(bid)).filter(Boolean).map(r => r.id);
  } else {
    startIds = roots().map(r => r.id);
  }
  if (!startIds.length) { document.getElementById('hierBox').innerHTML = '<div class="center-empty">لا يوجد فرع مصرّح لك بالإضافة فيه.</div>'; return; }
  startIds.forEach(s => { hierOpen.add(s); childrenOf(s).forEach(c => hierOpen.add(c.id)); });
  const box = document.getElementById('hierBox');
  box.innerHTML = `<ul class="hier">${startIds.map(s => hierNode(s, 0)).join('')}</ul>`;
  // التوسعة/الطيّ
  box.querySelectorAll('[data-htog]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const hid = parseInt(b.dataset.htog, 10);
    if (hierOpen.has(hid)) hierOpen.delete(hid); else hierOpen.add(hid);
    renderAddBirthTree();
  }));
  // اختيار الاسم كأب (بدل فتح ملفه)
  box.querySelectorAll('[data-hopen]').forEach(b => b.addEventListener('click', () => {
    const fp = byId.get(parseInt(b.dataset.hopen, 10));
    if (!fp) return;
    if (fp.status === 'dead') { toast('لا يمكن اختيار متوفى كأب'); return; }
    if (isManager() && !inMyBranch(fp)) { toast('خارج فرعك المصرّح به'); return; }
    editFather = fp; abwStep = 2; renderAddBirth();
  }));
}
// سلسلة النسب: المولود ← الأب ← الجد ← … حتى الأصل (تدعم 11-12 جيلاً وأكثر)
function abwChain(father, childName) {
  const names = [childName];
  let cur = father, guard = 0;
  while (cur && guard++ < 60) { names.push(cur.name); cur = cur.father_id ? byId.get(cur.father_id) : null; }
  return names.map((n, i) => i === 0
    ? `<b class="abw-child">${esc(n)}</b>`
    : `<span class="abw-anc">${esc(n)}</span>`).join('<span class="abw-bn">بن</span>');
}
async function abwConfirmSave() {
  const name = val('p_name').trim();
  if (!name) { toast('أدخل اسم المولود'); return; }
  if (isManager() && (!editFather || !inMyBranch(editFather))) { toast('اختر أباً ضمن فرعك'); return; }
  // تكرار اسم المولود لنفس الأب: ممنوع إن كان الموجود حيّاً، ومسموح إن كان متوفّى بعد تحذير وتأكيد مكرّر.
  const dups = sameNameSiblings(editFather, name);
  if (dups.length) {
    if (dups.some(c => c.status !== 'dead')) {
      toast('يوجد ابن حيّ بنفس الاسم لنفس الأب — غير مسموح. اختر اسماً مختلفاً'); return;
    }
    if (!(await confirm2(`⚠️ يوجد بالفعل «${name}» (متوفّى) ابناً لنفس الأب.\nتسمية مولود جديد باسم متوفّى مسموحة — لكن تأكّد أنه ليس تكراراً بالخطأ.`, { title: 'اسم مكرّر لمتوفّى', okText: 'متابعة', danger: true }))) return;
    if (!(await confirm2(`تأكيد نهائي: إضافة «${name}» رغم وجود «${name}» (متوفّى) تحت نفس الأب؟`, { title: 'تأكيد التكرار', okText: 'نعم، أضف', danger: true }))) return;
  }
  // قاعدة: لا يحمل الابن اسم والده الحيّ. (مع والدٍ متوفٍّ: تحذير ويُقبل.)
  if (editFather && normalizeAr(name) === normalizeAr(editFather.name)) {
    if (editFather.status !== 'dead') { toast('لا يصحّ أن يحمل المولود اسم والده الحيّ «' + editFather.name + '» — اختر اسماً مختلفاً'); return; }
    if (!(await confirm2(`⚠️ اسم المولود مطابق لاسم والده «${esc(editFather.name)}» (متوفّى). مسموح، لكن تأكّد أنه مقصود.`, { title: 'اسم مطابق للوالد', okText: 'متابعة', danger: true }))) return;
  }
  // عرض سلسلة النسب الكاملة للموافقة النهائية
  const okConfirm = await confirm2(`تأكيد إضافة:\n${[name].concat(lineage(editFather ? editFather.id : 0).map(x => x.name)).join(' بن ')}`, { title: 'مراجعة النسب', okText: 'حفظ المولود', danger: false });
  if (!okConfirm) return;
  await saveBirth(name);
}
async function saveBirth(name) {
  const father = editFather;
  // حارس صلاحية صارم لمشرف الفرع: يجب وجود أب ضمن فرعه المصرّح به فقط
  if (!isAdmin()) {
    if (!isManager()) { toast('ليست لديك صلاحية الإضافة'); return; }
    if (!father) { toast('اختر الأب أولاً'); return; }
    if (!inMyBranch(father)) { toast('الأب خارج فرعك المصرّح به — لا يمكن الإضافة'); return; }
  }
  // حارس نهائي: يُمنع تطابق الاسم مع أخٍ حيّ، أو مع اسم الوالد الحيّ.
  if (sameNameSiblings(father, name).some(c => c.status !== 'dead')) { toast('يوجد ابن حيّ بنفس الاسم لنفس الأب — اختر اسماً مختلفاً'); return; }
  if (father && father.status !== 'dead' && normalizeAr(name) === normalizeAr(father.name)) { toast('لا يصحّ أن يحمل المولود اسم والده الحيّ — اختر اسماً مختلفاً'); return; }
  const generation = father ? (father.generation + 1) : 1;
  let branch_id = father ? father.branch_id : null;
  if (isManager() && !isGeneralManager() && branch_id == null) branch_id = myBranch();
  const who = (me && (me.full_name || me.username || me.phone)) || '';
  const obj = {
    name, father_id: father ? father.id : null, branch_id, generation,
    status: 'alive', birth: val('p_birth').trim(), city: val('p_city').trim(),
    created_by_name: who,
  };
  if (!(await responsibilityOk())) return;
  const ok = await guard(async () => {
    const { data: ins, error } = await sb.from('almfrje_persons').insert(obj).select('id').single(); if (error) throw error;
    await auditLog('add', ins && ins.id, name);
  });
  if (ok) { toast('تمت إضافة «' + name + '»'); await loadAll(); goBack(); }
}
async function savePerson(id, existing) {
  const name = val('p_name').trim();
  if (!name) { toast('أدخل اسم المولود'); return; }
  const father = editFather;
  // مشرف الفرع لا ينشئ أصلاً بلا أب — يجب اختيار والد ضمن فرعه
  if (!existing && !father && !isAdmin()) { toast('اختر الأب أولاً (يجب أن يكون ضمن فرعك)'); return; }
  if (!existing && father && isManager() && !inMyBranch(father)) { toast('الأب المختار خارج فرعك المصرّح به'); return; }
  // تكرار الاسم لنفس الأب: يُمنع فقط إن غيّرت الاسم وتعارض مع أخٍ **حيّ**.
  // (تغيير الحالة لمتوفّى دون تغيير الاسم لا يُفحص؛ والمتوفّى لا يُحسب تكراراً — يجوز تكرار اسم متوفّى.)
  const nameChanged = !existing || normalizeAr(existing.name) !== normalizeAr(name);
  if (nameChanged && sameNameSiblings(father, name, existing ? existing.id : undefined).some(c => c.status !== 'dead')) { toast('يوجد ابن حيّ بنفس الاسم لنفس الأب — اختر اسماً مختلفاً'); return; }
  if (nameChanged && father && father.status !== 'dead' && normalizeAr(name) === normalizeAr(father.name)) { toast('لا يصحّ أن يحمل الابن اسم والده الحيّ — اختر اسماً مختلفاً'); return; }
  const generation = father ? (father.generation + 1) : 1;
  // الفرع: يرث فرع الأب؛ إن كان الأب هو الأصل (جيل 1) فالفرع يُحدَّد لاحقاً من الإدارة.
  // مشرف الفرع يضيف ضمن فروعه فقط — يرث الفرع من الأب (المقيَّد أصلاً باختيار أب من فرعه).
  let branch_id = father ? (father.generation === 1 ? (father.branch_id || null) : father.branch_id) : null;
  if (isManager() && !isGeneralManager() && branch_id == null) branch_id = myBranch();
  const photofile = document.getElementById('p_photofile').files[0];
  let photo_url = val('p_photo').trim();
  const who = (me && (me.full_name || me.username || me.phone)) || '';
  const obj = {
    name, father_id: father ? father.id : null, branch_id, generation,
    nickname: val('p_nickname').trim(),
    status: val('p_status'), work: val('p_work'), birth: val('p_birth').trim(), birthplace: val('p_birthplace').trim(), death: val('p_status') === 'dead' ? val('p_death').trim() : '',
    city: val('p_city').trim(), phone: val('p_phone').trim(), email: val('p_email').trim(), notes: val('p_notes').trim(),
  };
  if (existing && nameChanged && existing.name) {
    // تغيير اسم قائم حسّاسٌ في شجرة الأنساب: رسالتان تأكيديتان + كتابة عبارة تأكيد
    const chain = ancestryShort(existing.id, 4);
    if (!(await confirm2(`⚠️ أنت على وشك تغيير الاسم:\n«${existing.name}» ← «${name}»${chain ? '\n(ابن ' + chain + ')' : ''}\n\nتغيير الاسم حسّاس في شجرة الأنساب ويظهر في كل المشجّرات والأنساب. تأكد أنه تصحيحٌ صحيح.`, { title: 'تأكيد تغيير الاسم', okText: 'متابعة', danger: true }))) return;
    const typed = await uiPrompt('للتأكيد النهائي اكتب كلمة: تعديل', { title: 'تأكيد نهائي لتغيير الاسم', placeholder: 'تعديل', okText: 'تعديل الاسم' });
    if ((typed || '').trim() !== 'تعديل') { toast('أُلغي تعديل الاسم'); return; }
  } else if (existing && !(await confirm2('حفظ التعديل على هذا الشخص؟ النسخة السابقة تبقى في سلة المحذوفات.'))) return;
  if (!(await responsibilityOk())) return;
  const ok = await guard(async () => {
    if (photofile) photo_url = await uploadFile(photofile, 'photos');
    obj.photo_url = photo_url;
    if (existing) {
      // تتبّع: مَن عدّل ومتى
      obj.updated_by_name = who; obj.updated_at = new Date().toISOString();
      await trashSnap('persons', id, 'edit', existing.name);
      // التقط القيم السابقة لإتاحة التراجع من سجل التعديلات لاحقاً
      const undoCols = ['name', 'nickname', 'father_id', 'branch_id', 'generation', 'status', 'work', 'birth', 'birthplace', 'death', 'city', 'phone', 'email', 'notes', 'photo_url', 'updated_by_name', 'updated_at'];
      const prev = {}; undoCols.forEach(c => prev[c] = existing[c] ?? null);
      const { error } = await sb.from('almfrje_persons').update(obj).eq('id', id); if (error) throw error;
      await auditLog('edit', id, name, { kind: 'persons', items: [{ id, prev }], label: existing.name });
    } else {
      // تتبّع: مَن أضاف
      obj.created_by_name = who;
      const { data: ins, error } = await sb.from('almfrje_persons').insert(obj).select('id').single(); if (error) throw error;
      await auditLog('add', ins && ins.id, name);
    }
  });
  if (ok) { toast(existing ? 'تم حفظ التعديل' : 'تمت إضافة «' + name + '» بنجاح'); await loadAll(); existing ? setHash('#/person/' + id) : goBack(); }
}
// حذف الأسماء غير متاح لأي مستخدم (قرار نهائي) — يبقى التعديل + التراجع من سلة المحذوفات.

/* ===== الفروع ===== */
function branchCardsHtml() {
  // الفروع القائمة فقط (التي أنجبت) — «سفران» وأمثاله لا تُعرض للتصفّح.
  const list = C.branches.filter(b => isLiveBranch(b.id)).sort((a, b) => branchCount(b.id) - branchCount(a.id));
  const supCount = (bid) => C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(bid))).length;
  return list.length ? list.map(b => {
    const n = branchCount(b.id);
    const sc = supCount(b.id);
    const sups = C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(b.id))).map(m => m.full_name || m.username || '—');
    return `<div class="card click" data-go="#/branch/${b.id}">
      <div class="li-title">🗂️ ${esc(b.name)}</div>
      <div class="li-sub">عدد الأفراد: ${n} • المشرفون: ${sc ? esc(sups.join('، ')) : '—'}</div></div>`;
  }).join('') : '<div class="center-empty">لا توجد فروع بعد.</div>';
}
// تبويب «الفروع» السفلي — للعرض/التصفّح فقط للجميع (الإدارة انتقلت للوحة التحكم).
function screenBranches() {
  view().innerHTML = branchCardsHtml();
  bindGo();
}
// إدارة الفروع والمشرفين — داخل لوحة التحكم (للمدير فقط).
function screenBranchAdmin() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const list = C.branches.slice().sort((a, b) => branchCount(b.id) - branchCount(a.id));
  const supCount = (bid) => C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(bid))).length;
  view().innerHTML = adminTabBar('branchadmin') + `
    <div class="muted" style="margin-bottom:8px">الفرع = جدّ وذريّته، له مشرف أو أكثر. عيّن أي جدّ كفرع وحدّد مشرفيه. كل مشرف يرى ويضيف في فرعه فقط.</div>
    ${list.length ? list.map(b => {
      const n = branchCount(b.id); const sc = supCount(b.id);
      const sups = C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(b.id))).map(m => m.full_name || m.username || '—');
      return `<div class="card click" data-bedit="${b.id}">
        <div class="li-title">🗂️ ${esc(b.name)} <span class="muted" style="font-weight:normal;font-size:.78rem">✎ تعديل</span></div>
        <div class="li-sub">عدد الأفراد: ${n} • المشرفون: ${sc ? esc(sups.join('، ')) : '—'}</div></div>`;
    }).join('') : '<div class="center-empty">لا توجد فروع بعد.</div>'}`;
  view().querySelectorAll('[data-bedit]').forEach(c => c.addEventListener('click', () => branchModal(C.branches.find(x => String(x.id) === c.dataset.bedit))));
  addFab('+ تعيين فرع', () => branchModal(null));
}
let branchRootPick = null;   // الجذر المختار في نافذة الفرع
function branchModal(b) {
  branchRootPick = b && b.root_id ? byId.get(b.root_id) : null;
  // مشرفون متعدّدون: صناديق اختيار من الأعضاء المفعّلين
  const supSet = new Set(C.members.filter(m => b && memberBranchSet(m).has(Number(b.id))).map(m => m.user_id));
  const supChks = C.members.filter(m => m.is_active && m.role !== 'admin').length
    ? C.members.filter(m => m.is_active && m.role !== 'admin').map(m => `<label class="perm-chk"><input type="checkbox" data-bsup="${m.user_id}" ${supSet.has(m.user_id) ? 'checked' : ''}><span>${esc(m.full_name || m.username || m.phone || '—')}</span></label>`).join('')
    : '<div class="muted">لا أعضاء بعد — أضِف أول عضو.</div>';
  openModal(b ? 'تعديل فرع' : 'تعيين فرع جديد', `
    ${fInput('اسم الفرع', 'b_name', b && b.name)}
    <div class="field"><label>جذر الفرع (الجدّ) ${hintBtn('branch_root')}</label>
      <div class="father-pick">
        <div id="b_rootLabel" class="father-name ${branchRootPick ? '' : 'empty'}">${branchRootPick ? '👤 ' + esc(branchRootPick.name) + ' (جيل ' + branchRootPick.generation + ')' : '— اختر الجدّ —'}</div>
        <button class="btn sm outline" id="b_pickRoot" style="margin:0">🔍 اختيار الجدّ</button>
      </div>
    </div>
    <div class="perm-box"><div class="perm-title">المشرفون على هذا الفرع (واحد أو أكثر): ${hintBtn('branch_sup')}</div>${supChks}</div>
    ${fTextarea('ملاحظات', 'b_notes', b && b.notes)}
    <div class="muted" style="font-size:.82rem">سيُضمّ الجدّ وكل ذريّته إلى هذا الفرع، ويراه مشرفوه فقط.</div>
    <button class="btn" id="b_save">حفظ الفرع</button>`, () => {
    document.getElementById('b_pickRoot').addEventListener('click', () => pickPerson('اختر جدّ الفرع', (fp) => { branchRootPick = fp; const el = document.getElementById('b_rootLabel'); el.textContent = fp ? '👤 ' + fp.name + ' (جيل ' + fp.generation + ')' : '— اختر الجدّ —'; el.classList.toggle('empty', !fp); }));
    document.getElementById('b_save').addEventListener('click', async () => {
      const name = val('b_name').trim(); if (!name) { toast('أدخل اسم الفرع'); return; }
      if (!branchRootPick) { toast('اختر جدّ الفرع'); return; }
      const sups = []; document.querySelectorAll('input[data-bsup]').forEach(cb => { if (cb.checked) sups.push(cb.dataset.bsup); });
      const rootId = branchRootPick.id;
      const obj = { name, root_id: rootId, manager_id: sups[0] || null, notes: val('b_notes').trim() };
      const ok = await guard(async () => {
        let branchId = b && b.id;
        if (b) { const { error } = await sb.from('almfrje_branches').update(obj).eq('id', b.id); if (error) throw error; }
        else { const { data, error } = await sb.from('almfrje_branches').insert(obj).select('id').single(); if (error) throw error; branchId = data.id; }
        // ضُمّ الجدّ وكل ذريّته إلى هذا الفرع (إعادة تعيين branch_id للشجرة الفرعية)
        const subtreeIds = [rootId, ...descendants(rootId).map(p => p.id)];
        for (let i = 0; i < subtreeIds.length; i += 300) {
          const chunk = subtreeIds.slice(i, i + 300);
          const { error } = await sb.from('almfrje_persons').update({ branch_id: branchId }).in('id', chunk);
          if (error) throw error;
        }
        // عيّن المشرفين: أضِف هذا الفرع لكل مشرف مختار، وأزِله ممّن أُلغي اختياره
        for (const m of C.members) {
          const has = memberBranchSet(m).has(Number(branchId));
          const want = sups.includes(m.user_id);
          if (want && !has) {
            const arr = [...memberBranchSet(m)]; arr.push(Number(branchId));
            await sb.from('almfrje_members').update({ role: 'branch_manager', branch_ids: arr, branch_id: arr[0] }).eq('user_id', m.user_id);
          } else if (!want && has) {
            const arr = [...memberBranchSet(m)].filter(x => x !== Number(branchId));
            await sb.from('almfrje_members').update({ branch_ids: arr, branch_id: arr[0] || null }).eq('user_id', m.user_id);
          }
        }
      });
      if (ok) { closeModal(); toast('تم حفظ الفرع وضمّ ذريّته'); await refreshAndRender(); }
    });
  });
}
function screenBranch(arg) {
  const id = parseInt(arg, 10); const b = branchById.get(id);
  if (!b) { view().innerHTML = '<div class="center-empty">الفرع غير موجود.</div>'; return; }
  document.getElementById('screenTitle').textContent = 'فرع ' + b.name;
  const members = C.persons.filter(p => p.branch_id === id);
  const sups = C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(id)));
  const gens = {}; members.forEach(p => { (gens[p.generation] = gens[p.generation] || 0); gens[p.generation]++; });
  const rootP = branchRoot(id);   // رأس الفرع (الجيل الثاني)
  const sons = rootP ? childrenOf(rootP.id) : [];   // أبناؤه = الجيل الثالث (بداية العرض)
  document.getElementById('screenTitle').textContent = 'فرع ' + b.name;
  view().innerHTML = `
    <div class="card"><div class="li-title">🗂️ فرع ${esc(b.name)}</div>
      <div class="li-sub">المشرفون: ${sups.length ? esc(sups.map(m => m.full_name || m.username || '—').join('، ')) : '—'}</div>
      ${b.notes ? `<div class="li-sub">${esc(b.notes)}</div>` : ''}
      ${rootP ? `<div class="li-sub">الجدّ: <a href="#/person/${rootP.id}" style="color:var(--brand);text-decoration:none">${esc(rootP.name)}</a> (جيل ${rootP.generation}) — العرض يبدأ من أبنائه</div>` : ''}
    </div>
    <div class="stats" style="grid-template-columns:1fr 1fr">
      <div class="stat"><div class="n">${members.length}</div><div class="l">عدد الأفراد</div></div>
      <div class="stat g"><div class="n">${Object.keys(gens).length}</div><div class="l">عدد الأجيال</div></div>
    </div>
    <div class="btn-row no-print" style="margin-bottom:10px">
      <button class="btn sm" id="trackB">🎯 تتبّع هذا الفرع</button>
      <button class="btn sm outline" id="h_expand">توسيع الكل</button>
      <button class="btn sm outline" id="h_collapse">طيّ الكل</button>
      ${canExport() ? `<button class="btn sm outline" id="prn">🖨️ طباعة / PDF</button>` : ''}
      ${isAdmin() ? `<button class="btn sm" id="editB">✎ تعديل الفرع</button>` : ''}
    </div>
    <div class="hier-wrap" id="hierBox"></div>`;
  bindGo();
  const eb = document.getElementById('editB'); if (eb) eb.addEventListener('click', () => branchModal(b));
  { const tb = document.getElementById('trackB'); if (tb) tb.addEventListener('click', () => { setTracked(id); toast('بدأ تتبّع فرع ' + b.name); setHash(rootP ? '#/tree/' + rootP.id : '#/tree/'); }); }
  const sonIds = sons.map(s => s.id);
  if (!sonIds.length) { document.getElementById('hierBox').innerHTML = '<div class="center-empty">لا أبناء في هذا الفرع.</div>'; return; }
  sonIds.forEach(s => { hierOpen.add(s); childrenOf(s).forEach(c => hierOpen.add(c.id)); });
  renderHier(sonIds);
  const pe = document.getElementById('prn'); if (pe) pe.addEventListener('click', () => { sonIds.forEach(s => hierExpandAll(s)); renderHier(sonIds); setTimeout(() => window.print(), 60); });
  document.getElementById('h_expand').addEventListener('click', () => { sonIds.forEach(s => hierExpandAll(s)); renderHier(sonIds); });
  document.getElementById('h_collapse').addEventListener('click', () => { hierOpen.clear(); sonIds.forEach(s => hierOpen.add(s)); renderHier(sonIds); });
}

/* ===== كشف الأسماء المكرّرة لنفس الأب ===== */
function screenDuplicates() {
  if (!isAdmin() && !isManager()) { view().innerHTML = noPerm(); return; }
  const mgr = !isAdmin() && isManager();
  const groups = [];
  // لكل أب: جمّع أبناءه حسب الاسم المطبّع — التكرار يُحسب بين **الأحياء فقط**
  // (إن كان أحد المتشابهَين متوفّى فلا يُعدّ تكراراً؛ التكرار فقط إذا كان الاثنان حيّين).
  const scan = (father, sibs) => {
    const m = new Map();
    sibs.forEach(c => { const k = normalizeAr(c.name); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(c); } });
    m.forEach(arr => { const living = arr.filter(c => c.status !== 'dead'); if (living.length > 1) groups.push({ father, items: living }); });
  };
  kids.forEach((arr, fid) => scan(byId.get(fid) || null, arr));
  scan(null, roots());   // الأصول (فراج/مفرج) كإخوة
  let list = mgr ? groups.filter(g => g.items.some(c => inMyBranch(c))) : groups;
  list.sort((a, b) => b.items.length - a.items.length);
  view().innerHTML = `
    <div class="muted" style="margin-bottom:8px">الأسماء المتطابقة لأبناء نفس الأب (تتجاهل التشكيل والهمزات والمسافات: «عبدالله»=«عبد الله»)${mgr ? ' — ضمن فرعك فقط' : ''}. اضغط الاسم لفتحه وتعديله.</div>
    <div class="card"><div class="li-title">${list.length ? '🔁 ' + list.length + ' حالة تكرار' : '✅ لا يوجد أي تكرار'}</div></div>
    ${list.map(g => `<div class="card" style="padding:12px">
      <div class="li-sub">📜 الأب: <b>${g.father ? esc(lineageShort(g.father.id, 8)) : '— (الأصل)'}</b></div>
      <div class="li-sub">الاسم المكرّر: <b class="n-noissue">${esc(g.items[0].name)}</b> (${g.items.length})</div>
      <div style="margin-top:6px">${g.items.map(c => `<div class="row"><span class="k"><a href="#/person/${c.id}" style="color:var(--brand);text-decoration:none">${esc(c.name)}</a>${nickSuffix(c)}</span><span class="v" style="font-size:.8rem">${esc(lineageShort(c.id))}</span></div>`).join('')}</div>
    </div>`).join('')}`;
  bindGo();
}

/* ===== التقرير الإحصائي ===== */
function screenStats() {
  const total = C.persons.length;
  const alive = C.persons.filter(p => p.status === 'alive').length;
  const dead = total - alive;                                  // كل المتوفين (يشمل من لم يعقب)
  const deadNoIssue = C.persons.filter(p => p.status === 'dead' && (descCount.get(p.id) || 0) === 0).length;
  const deadWithIssue = dead - deadNoIssue;
  const mg = maxGen();
  // عدد كل جيل (إجمالي + حي + متوفّى + لم يعقب)
  const genTot = {}, genAlive = {}, genNoIssue = {};
  C.persons.forEach(p => {
    const g = p.generation || 1; genTot[g] = (genTot[g] || 0) + 1;
    if (p.status === 'alive') genAlive[g] = (genAlive[g] || 0) + 1;
    else if ((descCount.get(p.id) || 0) === 0) genNoIssue[g] = (genNoIssue[g] || 0) + 1;
  });
  const genRows = [];
  for (let g = 1; g <= mg; g++) {
    const t = genTot[g] || 0, a = genAlive[g] || 0, no = genNoIssue[g] || 0, dw = t - a - no;
    genRows.push(`<div class="row"><span class="k">الجيل ${g}</span><span class="v">${t} فرد • <span style="color:var(--c-alive)">${a} حيّ</span> • <span style="color:var(--c-dead)">${dw} متوفّى</span> • <span style="color:var(--c-noissue)">${no} لم يعقب</span></span></div>`);
  }
  const branchSizes = C.branches.map(b => ({ b, n: branchCount(b.id) })).sort((x, y) => y.n - x.n);
  const vb = visitStats.byBranch || {}, vc = visitStats.byCity || {};
  const vbRows = Object.keys(vb).length ? Object.entries(vb).sort((a, b) => b[1] - a[1]).map(([bid, n]) => row('🗂️ ' + esc(branchName(Number(bid))), n)).join('') : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا زيارات مسجّلة بعد.</div>';
  const vcRows = Object.keys(vc).length ? Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([c, n]) => row('📍 ' + esc(c), n)).join('') : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا مناطق مسجّلة بعد.</div>';
  // إثراءات: أكثر الأسماء شيوعاً • التوزيع حسب المدينة
  const nameFreq = {}, cityFreq = {};
  C.persons.forEach(p => { const n = (p.name || '').trim(); if (n) nameFreq[n] = (nameFreq[n] || 0) + 1; const c = (p.city || '').trim(); if (c) cityFreq[c] = (cityFreq[c] || 0) + 1; });
  const topNames = Object.entries(nameFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topCities = Object.entries(cityFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  view().innerHTML = `
    <div class="card"><h3>📊 إحصاءات عامة</h3>
      ${row('إجمالي الأفراد', total)}${row('إجمالي الفروع', C.branches.length)}${row('عدد الأجيال', mg)}
      <div class="stat3">
        <div class="s3 s3-alive"><div class="s3-n">${alive}</div><div class="s3-l">أحياء</div></div>
        <div class="s3 s3-dead"><div class="s3-n">${deadWithIssue}</div><div class="s3-l">متوفّون (لهم ذرية)</div></div>
        <div class="s3 s3-noissue"><div class="s3-n">${deadNoIssue}</div><div class="s3-l">لم يعقب</div></div>
      </div></div>
    <div class="card"><h3>👥 عدد كل جيل</h3>${genRows.join('') || noItem()}</div>
    <div class="card"><h3>🗂️ الفروع حسب العدد</h3>${branchSizes.length ? branchSizes.map(x => row(esc(x.b.name), x.n)).join('') : noItem()}</div>
    <div class="card"><h3>🔤 أكثر الأسماء شيوعاً</h3>${topNames.length ? topNames.map(([n, c]) => row(esc(n), c)).join('') : noItem()}</div>
    <div class="card"><h3>🏙️ التوزيع حسب المدينة</h3>${topCities.length ? topCities.map(([c, n]) => row('📍 ' + esc(c), n)).join('') : noItem()}</div>
    <div class="card"><h3>🚶 الزيارات</h3>${row('إجمالي الزوّار', visitStats.total || 0)}
      <div class="li-sub" style="margin-top:8px;font-weight:800;color:var(--text)">حسب الفرع</div>${vbRows}
      <div class="li-sub" style="margin-top:10px;font-weight:800;color:var(--text)">حسب المنطقة (المدينة)</div>${vcRows}</div>
    ${canExport() ? `<button class="btn outline no-print" id="prn">🖨️ طباعة / PDF</button>` : ''}`;
  const prn = document.getElementById('prn'); if (prn) prn.addEventListener('click', () => window.print());
}

/* ===== ملاحظات الزوار ===== */
// نموذج إرسال ملاحظة/خطأ للإدارة — متاح للجميع (زائر/عضو).
let fbFather = null;     // والد المولود (عند موضوع «إضافة مولود») أو الأب (عند «إعادة ترتيب الإخوان»)
let fbOrder = null;      // الترتيب المقترح لأبنائه (مصفوفة معرّفات)
let fbSender = null;     // المُرسِل يعرّف نفسه من الشجرة
let fbFilter = 'new';    // تبويب شاشة المدير: new | done | all
function screenFeedback() {
  fbFather = null; fbSender = null;
  view().innerHTML = `
    <div class="fb-screen">
    <div class="card" style="text-align:center;border:2px solid var(--brand)">
      <div style="font-size:2rem;line-height:1">✉️</div>
      <h3 style="margin:.3rem 0 .15rem">إرسال ملاحظة للإدارة</h3>
      <div class="muted" style="font-size:.84rem;line-height:1.7">اختر موضوع الملاحظة وأكملها — وستصل للإدارة لمراجعتها واتخاذ الإجراء.</div>
    </div>
    ${currentUserName() ? `<div class="card"><div class="li-title" style="margin-bottom:6px">المُرسِل</div>
      <div style="padding:8px 10px;border:1px solid var(--brand);border-radius:8px;font-size:.95rem;font-weight:700">👤 ${esc(currentUserName())}</div>
      <div class="muted" style="font-size:.78rem;margin-top:6px">يُؤخذ تلقائياً من حسابك الذي دخلت به.</div></div>`
      : `<div class="card"><div class="li-title" style="margin-bottom:6px">اسمك</div>
      <div class="field"><input id="fb_name" type="text" placeholder="اكتب اسمك"></div></div>`}
    ${myPhoneKnown() ? '' : `<div class="card"><div class="li-title" style="margin-bottom:6px">📱 رقم جوالك للتواصل <span style="color:var(--danger)">*</span></div>
      <div class="field"><input id="fb_phone" type="tel" inputmode="tel" placeholder="05xxxxxxxx — إجباري"></div>
      <div class="muted" style="font-size:.78rem">للتواصل معك والتحقق من المعلومة — جوالك غير مسجّل لدينا.</div></div>`}
    <div class="card">
      <div class="field"><select id="fb_subject">
        <option value="">— اختر موضوع الملاحظة —</option>
        <option value="إضافة مولود">👶 إضافة مولود</option>
        <option value="ملاحظة">📝 ملاحظة / تصحيح</option>
        <option value="اقتراح">💡 اقتراح</option>
        <option value="إعادة ترتيب الإخوان">↕️ إعادة ترتيب الإخوان</option>
      </select></div>
      <div id="fb_dynamic"></div>
      <div class="field"><textarea id="fb_details" rows="4" placeholder="اكتب التفاصيل هنا"></textarea></div>
    </div>
    <button class="btn btn-lg" id="fb_send" style="width:100%">✉️ إرسال للإدارة</button>
    </div>`;
  const sub = document.getElementById('fb_subject');
  sub.addEventListener('change', () => renderFbDynamic(sub.value));
  document.getElementById('fb_send').addEventListener('click', sendFeedback);
  renderFbDynamic('');
}
// شخص المستخدم الحالي في الشجرة (زائراً بعد التحقق، أو عضواً مربوطاً) — للجوال والتحقق.
function myPersonId() {
  try { const g = parseInt(sessionStorage.getItem('almfrje_guest_pid') || '0', 10); if (g) return g; } catch (e) { /* */ }
  if (me && me.person_id) return Number(me.person_id) || 0;
  try { const pid = parseInt(localStorage.getItem('almfrje_me_person_' + (me && me.user_id)) || '0', 10); if (pid) return pid; } catch (e) { /* */ }
  return 0;
}
// هل جوال المُرسِل معروفٌ للنظام؟ (جوال حساب العضو، أو جوال شخصه المسجّل في الشجرة)
function myPhoneKnown() {
  if (me && !isGuestUser() && me.phone) return true;
  try { if (sessionStorage.getItem('almfrje_guest_hasphone') === '1') return true; } catch (e) { /* */ }
  const pid = myPersonId(); const p = pid && byId.get(pid);
  return !!(p && p.phone);
}
// مطابقة شخص بعدّة كلمات: الكلمة الأولى لاسمه، التالية لأبيه، ثم جدّه… (لتقليص القائمة).
function personMatchTokens(p, tokens) {
  const ln = lineage(p.id).map(x => normalizeAr(x.name));
  return tokens.every((tok, i) => (ln[i] || '').includes(tok));
}
// بحث مشترك لاختيار شخص (المُرسِل أو والد المولود): يقبل «الاسم ثم اسم الأب» لتقليص النتائج.
function fbPickerSearch(term, resEl, aliveOnly, onPick) {
  // يقبل الفاصل مسافة أو «بن»/«ابن» بين الاسم واسم الأب — تُتجاهَل كلمة الوصل.
  const tokens = String(term || '').trim().split(/\s+/).map(normalizeAr).filter(t => t && t !== 'بن' && t !== 'ابن');
  if (!tokens.length) { resEl.innerHTML = ''; return; }
  const all = C.persons.filter(p => personMatchTokens(p, tokens));
  if (!all.length) { resEl.innerHTML = '<div class="muted" style="padding:6px">الاسم لا يوجد</div>'; return; }
  const live = aliveOnly ? all.filter(p => p.status !== 'dead') : all;
  const deadM = aliveOnly ? all.filter(p => p.status === 'dead') : [];
  let html = live.slice(0, 25).map(p => `<div class="row click" data-pk="${p.id}"><span class="k">${esc(p.name)}${nickSuffix(p)}</span><span class="v" style="font-size:.78rem">${esc(lineageShort(p.id, 6))}</span></div>`).join('');
  // المطابقون المتوفّون: يُعرضون كتنبيه فقط (لا يصلحون أباً لمولود)
  if (deadM.length) html += deadM.slice(0, 15).map(p => `<div class="row" style="opacity:.75"><span class="k">${esc(p.name)} <span style="color:var(--c-dead);font-weight:800;font-size:.8rem">(متوفّى)</span></span><span class="v" style="font-size:.78rem">${esc(lineageShort(p.id, 6))}</span></div>`).join('');
  if (!live.length && deadM.length) html = '<div class="muted" style="padding:6px">المطابق متوفّى — لا يصلح والداً لمولود:</div>' + html;
  resEl.innerHTML = html || '<div class="muted" style="padding:6px">الاسم لا يوجد</div>';
  resEl.querySelectorAll('[data-pk]').forEach(el => el.addEventListener('click', () => {
    onPick(byId.get(parseInt(el.dataset.pk, 10))); resEl.innerHTML = '';
  }));
}
// حقول النموذج تتغيّر حسب الموضوع:
//  إضافة مولود → اختيار والد المولود (حيّ فقط).  ملاحظة → الفرع + الخطأ.  اقتراح → بلا فرع.
function renderFbDynamic(subject) {
  const wrap = document.getElementById('fb_dynamic');
  const det = document.getElementById('fb_details');
  fbFather = null; fbOrder = null;
  if (subject === 'إضافة مولود') {
    wrap.innerHTML = `
      <div class="field">
        <input id="fb_fsearch" type="text" placeholder="والد المولود: اكتب اسمه ثم اسم أبيه (مثال: سالم خالد) *">
        <div id="fb_fresults" style="max-height:200px;overflow:auto"></div>
        <div id="fb_fselected" class="muted" style="margin-top:6px"></div>
      </div>
      <div class="field"><input id="fb_baby_name" type="text" placeholder="اسم المولود *"></div>
      <div class="grid2">
        <div class="field"><input id="fb_baby_birth" type="text" placeholder="سنة الولادة (اختياري) — مثال 1448هـ"></div>
        <div class="field"><input id="fb_baby_city" type="text" placeholder="المدينة (اختياري)"></div>
      </div>`;
    const fs = document.getElementById('fb_fsearch');
    fs.addEventListener('input', () => fbPickerSearch(fs.value, document.getElementById('fb_fresults'), true, (p) => {
      fbFather = p;
      document.getElementById('fb_fselected').innerHTML = p ? '<div style="padding:8px 10px;border:1px solid var(--brand);border-radius:8px;font-size:.9rem">✅ والد المولود: <b>' + esc(lineageShort(p.id, 12)) + '</b></div>' : '';
      fs.value = p ? p.name : '';
    }));
  } else if (subject === 'ملاحظة') {
    if (det) det.placeholder = 'اكتب تفاصيل الملاحظة هنا';
    const branchOpts = C.branches.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'))
      .map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    wrap.innerHTML = `
      <div class="field"><select id="fb_branch"><option value="">— اختر الفرع (اختياري) —</option>${branchOpts}</select></div>
      <div class="field"><textarea id="fb_error" rows="3" placeholder="صِف الخطأ والتصحيح المقترح (اختياري)"></textarea></div>`;
  } else if (subject === 'إعادة ترتيب الإخوان') {
    wrap.innerHTML = `
      <div class="field">
        <input id="fb_rsearch" type="text" placeholder="الأب: اكتب اسمه ثم اسم أبيه (مثال: سالم خالد) *">
        <div id="fb_rresults" style="max-height:200px;overflow:auto"></div>
        <div id="fb_rselected" class="muted" style="margin-top:6px"></div>
      </div>
      <div id="fb_rkids"></div>`;
    const rsi = document.getElementById('fb_rsearch');
    rsi.addEventListener('input', () => fbPickerSearch(rsi.value, document.getElementById('fb_rresults'), false, (p) => {
      const ks = childrenOf(p.id);
      if (ks.length < 2) { toast('هذا الأب ليس له أكثر من ابنٍ واحد — لا حاجة لترتيب'); return; }
      fbFather = p; fbOrder = ks.map(k => k.id);
      document.getElementById('fb_rselected').innerHTML = '<div style="padding:8px 10px;border:1px solid var(--brand);border-radius:8px;font-size:.9rem">✅ الأب: <b>' + esc(lineageShort(p.id, 12)) + '</b></div>';
      rsi.value = p.name;
      renderFbOrder();
    }));
  } else {
    if (det) det.placeholder = subject === 'اقتراح' ? 'اكتب اقتراحك هنا' : 'اكتب التفاصيل هنا';
    wrap.innerHTML = '';
  }
  // «إضافة مولود» تكتفي بحقول المولود — أخفِ مربّع التفاصيل العام.
  // لا شيء قبل اختيار الموضوع؛ وبعده يظهر ما يناسبه فقط (مولود/ترتيب: حقولهما الخاصة بلا مربع التفاصيل)
  if (det) { const fld = det.closest('.field'); if (fld) fld.style.display = (!subject || subject === 'إضافة مولود' || subject === 'إعادة ترتيب الإخوان') ? 'none' : ''; }
}
// قائمة الإخوان بالسهمين ▲▼ داخل نموذج «إعادة ترتيب الإخوان»
function renderFbOrder() {
  const box = document.getElementById('fb_rkids'); if (!box || !fbFather || !fbOrder) return;
  box.innerHTML = '<div class="li-sub" style="font-weight:800;margin:10px 0 4px">رتّب الإخوان بالسهمين ثم أرسل للإدارة:</div>' +
    fbOrder.map((cid, i) => {
      const c = byId.get(cid);
      return `<div class="row child-row"><span class="reorder-arrows"><button class="reorder-up" data-fbup="${i}" aria-label="أعلى">▲</button><button class="reorder-down" data-fbdn="${i}" aria-label="أسفل">▼</button></span><span class="k">${i + 1}. <span class="${c ? nameCls(c) : ''}">${esc(c ? c.name : String(cid))}</span></span></div>`;
    }).join('');
  box.querySelectorAll('[data-fbup]').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.fbup, 10);
    if (i > 0) { const t = fbOrder[i - 1]; fbOrder[i - 1] = fbOrder[i]; fbOrder[i] = t; renderFbOrder(); }
  }));
  box.querySelectorAll('[data-fbdn]').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.fbdn, 10);
    if (i < fbOrder.length - 1) { const t = fbOrder[i + 1]; fbOrder[i + 1] = fbOrder[i]; fbOrder[i] = t; renderFbOrder(); }
  }));
}
async function sendFeedback() {
  const who = currentUserName() || (document.getElementById('fb_name') ? val('fb_name').trim() : '');
  if (!who) { toast('اكتب اسمك أولاً'); return; }
  const subject = val('fb_subject').trim();
  if (!subject) { toast('اختر الموضوع'); return; }
  const details = val('fb_details').trim();
  // جوال المرسل: إجباري إن لم يكن معروفاً؛ وإن كان عضواً بجوالٍ مسجّل يُرفق تلقائياً
  let sender_phone = '';
  if (!myPhoneKnown()) {
    sender_phone = normPhone(document.getElementById('fb_phone') ? val('fb_phone') : '');
    if (sender_phone.length < 9) { toast('اكتب رقم جوالك للتواصل (إجباري)'); return; }
  } else if (me && !isGuestUser() && me.phone) {
    sender_phone = normPhone(me.phone);
  }
  const sender_person_id = myPersonId() || null;
  let branch_id = null, error_desc = '', fullDetails = details;
  if (subject === 'إضافة مولود') {
    if (!fbFather) { toast('اختر والد المولود من البحث'); return; }
    const bname = document.getElementById('fb_baby_name') ? val('fb_baby_name').trim() : '';
    if (!bname) { toast('اكتب اسم المولود (إجباري)'); return; }
    branch_id = fbFather.branch_id || null;
    // بيانات مهيكلة ليوافق عليها المدير/مشرف الفرع لاحقاً
    fullDetails = JSON.stringify({
      kind: 'newborn', father_id: fbFather.id, father: lineageShort(fbFather.id, 12), name: bname,
      birth: document.getElementById('fb_baby_birth') ? val('fb_baby_birth').trim() : '',
      city: document.getElementById('fb_baby_city') ? val('fb_baby_city').trim() : '', by: who,
    });
  } else if (subject === 'إعادة ترتيب الإخوان') {
    if (!fbFather || !fbOrder || fbOrder.length < 2) { toast('اختر الأب أولاً ورتّب أبناءه'); return; }
    branch_id = fbFather.branch_id || null;
    fullDetails = JSON.stringify({
      kind: 'reorder', father_id: fbFather.id, father: lineageShort(fbFather.id, 12),
      order: fbOrder, names: fbOrder.map(cid => (byId.get(cid) || { name: String(cid) }).name), by: who,
    });
  } else if (subject === 'ملاحظة') {
    branch_id = val('fb_branch') ? parseInt(val('fb_branch'), 10) : null;
    error_desc = document.getElementById('fb_error') ? val('fb_error').trim() : '';
  }
  if (!fullDetails && !error_desc) { toast('اكتب التفاصيل'); return; }
  const ok = await guard(async () => {
    const { error } = await sb.from('almfrje_feedback').insert({ subject, branch_id, details: fullDetails, error_desc, created_by_name: who, sender_phone, sender_person_id });
    if (error) throw error;
  });
  if (ok) {
    openModal('✅ تم الإرسال', `<div style="text-align:center;white-space:pre-wrap;font-size:1.05rem;line-height:1.9;padding:6px 0">${esc(feedbackThanks)}</div>`);
    setTimeout(() => { closeModal(); location.hash = '#/home'; }, 2800);
  }
}
// ردود الإدارة على ملاحظات المستخدم الحالي (باسم دخوله) — تُملأ في بطاقة «ملاحظتك تهمنا»،
// وغير المقروء منها ينبثق برسالةٍ تبقى تعود مع كل دخول حتى يضغط «قرأتها ✓».
async function loadMyReplies() {
  const el = document.getElementById('fbMyReplies'); if (!el) return;
  const name = currentUserName(); if (!name) return;
  try {
    const j = await fbApi('myreplies', null, { name });
    const rows = j.rows || []; if (!rows.length) return;
    el.innerHTML = `<div style="margin-top:12px;font-weight:800;font-size:.9rem">↩️ ردود الإدارة على ملاحظاتك</div>` +
      rows.map(r => `<div style="margin-top:6px;padding:8px 10px;background:color-mix(in srgb, var(--brand) 6%, var(--card));border:1px solid var(--line);border-inline-start:3px solid var(--brand);border-radius:8px;font-size:.86rem;line-height:1.8">
        <span class="muted" style="font-size:.72rem">${esc(r.subject)} • ${fmtDateTime(r.replied_at || r.created_at)}</span><br>${esc(r.reply)}</div>`).join('');
    // الرسالة المنبثقة للردود غير المقروءة — تنتظر خلوّ الشاشة من نافذة الترحيب/التهنئة
    const unseen = rows.filter(r => !r.reply_seen);
    if (!unseen.length || window._fbPopupShown) return;
    window._fbPopupShown = true;   // مرة واحدة لكل فتح صفحة (تعود في الدخول التالي إن لم يؤكد)
    let tries = 0;
    const showWhenFree = () => {
      const root = document.getElementById('modalRoot');
      if (root && root.innerHTML.trim()) { if (tries++ < 60) setTimeout(showWhenFree, 800); return; }
      openModal('📨 رسالة من الإدارة', `
        <div style="text-align:center;font-size:.9rem;color:var(--muted);margin-bottom:8px">وصلك ردٌّ من الإدارة على ما أرسلته:</div>
        ${unseen.map(r => `<div style="margin:0 0 8px;padding:10px 12px;background:color-mix(in srgb, var(--brand) 7%, var(--card));border:1px solid var(--line);border-inline-start:3px solid var(--brand);border-radius:10px;font-size:.95rem;line-height:1.9">
          <span class="muted" style="font-size:.74rem">${esc(r.subject)} • ${fmtDateTime(r.replied_at || r.created_at)}</span><br>${esc(r.reply)}</div>`).join('')}
        <button class="btn" id="fbSeenBtn" style="width:100%">قرأتها ✓</button>`, () => {
        document.getElementById('fbSeenBtn').addEventListener('click', async () => {
          try { await fbApi('replyseen', null, { name, ids: unseen.map(r => r.id) }); } catch (e) { /* */ }
          closeModal();
        });
      });
    };
    setTimeout(showWhenFree, 600);
  } catch (e) { /* بصمت — البطاقة اختيارية */ }
}
/* ===== التسجيل الذاتي للزائر المتحقَّق ===== */
// بعد دخول الزائر باسمه: إن لم يكن له حساب تُفتح له حقول استكمال بياناته (الجوال إجباري)
// فيُنشأ حسابه بانتظار التفعيل؛ وإن كان له حساب دُعي للدخول به ليطّلع على رسائله.
function guestOnboard() {
  if (!isGuestUser()) return;
  let pid = 0, hasacct = null;
  try {
    pid = parseInt(sessionStorage.getItem('almfrje_guest_pid') || '0', 10);
    hasacct = sessionStorage.getItem('almfrje_guest_hasacct');
  } catch (e) { /* */ }
  if (!pid || hasacct == null) return;
  if (window._onbPoll) return;   // لا تكرار لمؤقّتات الانتظار
  const name = currentUserName();
  // له حساب: دعوة للدخول — مرة واحدة لكل جلسة (غير قسرية)
  if (hasacct === '1') {
    try { if (sessionStorage.getItem('almfrje_onboard') === '1') return; sessionStorage.setItem('almfrje_onboard', '1'); } catch (e) { /* */ }
    window._onbPoll = true;
    let tries = 0;
    const show = () => {
      const root = document.getElementById('modalRoot');
      if (root && root.innerHTML.trim()) { if (tries++ < 60) { setTimeout(show, 800); return; } window._onbPoll = false; return; }
      window._onbPoll = false;
      openModal('🔐 أنت مسجّلٌ لدينا', `
        <div style="font-size:.95rem;line-height:1.9;text-align:center">حيّاك الله <b>${esc(name)}</b> 🌿<br>لديك حسابٌ مسجّل — ادخل به لتطّلع على <b>رسائلك وردود الإدارة</b> وكل جديدٍ يخصّك.</div>
        <button class="btn" id="go_login" style="width:100%;margin-top:10px">🔐 دخول بحسابي (الجوال وكلمة المرور)</button>
        <button class="btn outline" id="go_skip" style="width:100%;margin-top:8px">متابعة كزائر</button>`, () => {
        document.getElementById('go_login').addEventListener('click', () => { closeModal(); setHash('#adminlogin'); });
        document.getElementById('go_skip').addEventListener('click', closeModal);
      });
    };
    setTimeout(show, 900);
    return;
  }
  // لا حساب له: التسجيل إجباري — لا يُتجاوز (لا زر تخطٍّ ولا إغلاق) حتى يسجّل
  try { if (sessionStorage.getItem('almfrje_signed') === '1') return; } catch (e) { /* */ }
  window._onbPoll = true;
  let tries = 0;
  const show = () => {
    const root = document.getElementById('modalRoot');
    if (root && root.innerHTML.trim()) { if (tries++ < 90) { setTimeout(show, 700); return; } window._onbPoll = false; return; }
    window._onbPoll = false;
    openModal('🌿 التسجيل مطلوب للدخول على الموقع', `
      <div style="font-size:.95rem;line-height:1.9;margin-bottom:8px;text-align:center;background:#fff5f5;border:1px solid #e03131;border-radius:10px;padding:8px 10px;color:#c92a2a;font-weight:700">التسجيل مطلوبٌ للدخول على الموقع</div>
      <div style="font-size:.9rem;line-height:1.9;margin-bottom:8px">أهلاً <b>${esc(name)}</b>! أكمل بياناتك لإنشاء حسابك — <b>خطوة واحدة لا تتكرر</b>:</div>
      <div class="field"><input id="go_phone" class="req-in" type="tel" inputmode="tel" placeholder="📱 رقم الجوال — إجباري *"></div>
      <div class="field"><input id="go_pw" class="req-in" type="password" placeholder="🔒 كلمة المرور — إجباري *"></div>
      <div class="field"><input id="go_nick" type="text" placeholder="اللقب (اختياري)"></div>
      <div class="grid2">
        <div class="field"><input id="go_city" type="text" placeholder="المدينة (اختياري)"></div>
        <div class="field"><input id="go_birth" type="text" placeholder="سنة الميلاد مثل 1410هـ (اختياري)"></div>
      </div>
      <button class="btn" id="go_send" style="width:100%">✅ تسجيل بياناتي</button>`, () => {
      document.getElementById('go_send').addEventListener('click', async () => {
        const phone = normPhone(val('go_phone'));
        if (phone.length < 9) { toast('رقم الجوال إجباري — اكتبه صحيحاً'); return; }
        if (val('go_pw').trim().length < 4) { toast('كلمة المرور إجبارية — ٤ أحرف/أرقام على الأقل'); return; }
        const body = { pid, phone, password: val('go_pw').trim(), nickname: val('go_nick').trim(), city: val('go_city').trim(), birth: val('go_birth').trim() };
        const ok = await guard(async () => {
          const { data: { session } } = await sb.auth.getSession();
          const res = await fetch('/api/almfrje-signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session && session.access_token) }, body: JSON.stringify(body) });
          const j = await res.json().catch(() => ({}));
          if (!res.ok || !j.ok) throw new Error(j.error || 'تعذّر التسجيل');
          try { sessionStorage.setItem('almfrje_signed', '1'); } catch (e) { /* */ }
          closeModal();
          openModal('✅ شكراً لك', `<div style="text-align:center;font-size:1rem;line-height:2;padding:6px 0">استُلمت بياناتك وسوف <b>يُفعَّل حسابك لاحقاً</b> بعد مراجعة الإدارة.<br>يمكنك بعدها الدخول على حسابك من «المزيد ← دخول المسؤول»<br>📱 برقم جوالك وكلمة المرور التي اخترتها.</div>`);
        });
        if (!ok) { /* بقيت النافذة ليصحح */ }
      });
    }, { noClose: true, noBgClose: true });
  };
  setTimeout(show, 900);
}
// نداء خادم إدارة الملاحظات (يعمل بمفتاح خدمي بعد التحقق — لا يعتمد على RLS).
async function fbApi(action, id, extra) {
  const { data: { session } } = await sb.auth.getSession();
  const token = session && session.access_token;
  if (!token) throw new Error('انتهت الجلسة — أعد تسجيل الدخول');
  const res = await fetch('/api/almfrje-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(Object.assign({ action, id }, extra || {})) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || 'تعذّر تنفيذ العملية');
  return j;
}
// نافذة الرد باسم الإدارة: ردود جاهزة من البنك (حسب الموضوع) أو ردّ مخصّص.
function replyModal(f) {
  const bank = (Array.isArray(replyBank[f.subject]) ? replyBank[f.subject] : []).filter(Boolean);
  openModal('↩️ الرد باسم الإدارة', `
    <div class="li-sub" style="margin-bottom:8px">إلى: <b>${esc(f.created_by_name || 'زائر')}</b> — ${esc(f.subject)}</div>
    ${bank.length ? `<div class="li-sub" style="font-weight:800;margin-bottom:6px">اختر رداً جاهزاً:</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${bank.map((r, i) => `<button class="btn sm outline" data-rbpick="${i}" style="text-align:right">${esc(r)}</button>`).join('')}</div>` : ''}
    <div class="field"><textarea id="rb_text" rows="3" placeholder="أو اكتب رداً مخصّصاً">${esc(f.reply || '')}</textarea></div>
    <button class="btn" id="rb_send">إرسال الرد باسم الإدارة</button>`, () => {
    document.querySelectorAll('[data-rbpick]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('rb_text').value = bank[parseInt(b.dataset.rbpick, 10)] || '';
    }));
    document.getElementById('rb_send').addEventListener('click', async () => {
      const t = val('rb_text').trim();
      if (!t) { toast('اختر رداً جاهزاً أو اكتب رداً'); return; }
      const ok = await guard(async () => { await fbApi('reply', f.id, { reply: t }); });
      if (ok) { closeModal(); toast('أُرسل الرد باسم الإدارة ✓'); screenFeedbacks(); }
    });
  });
}
// عرض الملاحظات للمدير — مرتّب باحترافية: تبويبات (قيد المراجعة/منجزة/الكل) + بطاقات مصنّفة بالنوع.
// يحلّل طلب «إضافة مولود» المهيكل من حقل التفاصيل (أو null لغير المواليد).
function parseNewborn(f) {
  if (!f || f.subject !== 'إضافة مولود') return null;
  try { const o = JSON.parse(f.details); if (o && o.kind === 'newborn') return o; } catch (e) {}
  return null;
}
// شخص مُرسِل الملاحظة في الشجرة: من الربط المحفوظ، وإلا بمطابقة اسمه عند التفرّد.
function feedbackSenderPerson(f) {
  if (f && f.sender_person_id) { const p = byId.get(Number(f.sender_person_id)); if (p) return p; }
  if (f && f.created_by_name) {
    const q = String(f.created_by_name).replace(/[…]/g, ' ');
    const m = C.persons.filter(p => nameMatch(p, q));
    if (m.length === 1) return m[0];
  }
  return null;
}
// حفظ جوال المرسل في ملف شخصه بالشجرة (بعد تحقق الإدارة) — بتأكيد يعرض الاسم والنسب.
async function addSenderPhone(f) {
  const p = feedbackSenderPerson(f);
  if (!p) { toast('تعذّر تحديد شخص المرسل في الشجرة'); return; }
  if (!f.sender_phone) { toast('لا جوال مرفق مع الملاحظة'); return; }
  if (p.phone && normPhone(p.phone) === normPhone(f.sender_phone)) { toast('هذا الجوال مسجّل له مسبقاً'); return; }
  const msg = p.phone
    ? 'لهذا الشخص جوالٌ مسجّل (' + p.phone + ') — استبداله بجوال المرسل ' + f.sender_phone + '؟\n' + lineageShort(p.id, 6)
    : 'إضافة الجوال ' + f.sender_phone + ' إلى ملف:\n' + lineageShort(p.id, 6) + '؟';
  if (!(await confirm2(msg, { title: 'حفظ جوال المرسل', okText: 'حفظ الجوال' }))) return;
  const who = (me && (me.full_name || me.username)) || '';
  const ok = await guard(async () => {
    const { error } = await sb.from('almfrje_persons').update({ phone: f.sender_phone, updated_by_name: who, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) throw error;
  });
  if (ok) { toast('حُفظ الجوال في ملف «' + p.name + '» ✓'); await loadAll(); screenFeedbacks(); }
}
function parseReorder(f) {
  if (!f || f.subject !== 'إعادة ترتيب الإخوان') return null;
  try { const o = JSON.parse(f.details); if (o && o.kind === 'reorder' && Array.isArray(o.order)) return o; } catch (e) {}
  return null;
}
async function screenFeedbacks() {
  if (!isAdmin() && !isManager()) { view().innerHTML = noPerm(); return; }
  showLoading(true);
  let list = [];
  try { const j = await fbApi('list'); list = j.rows || []; }
  catch (e) { showLoading(false); view().innerHTML = '<div class="center-empty">تعذّر تحميل الملاحظات.<br>' + esc(e.message || '') + '</div>'; return; }
  showLoading(false);
  const newCount = list.filter(f => f.status !== 'done').length;
  const doneCount = list.length - newCount;
  const icon = { 'إضافة مولود': '👶', 'ملاحظة': '📝', 'اقتراح': '💡', 'إعادة ترتيب الإخوان': '↕️' };
  const shown = list.filter(f => fbFilter === 'all' ? true : fbFilter === 'done' ? f.status === 'done' : f.status !== 'done');
  const tab = (k, t) => `<button class="btn sm ${fbFilter === k ? '' : 'outline'}" data-fbfilter="${k}" style="margin:0 3px 6px 0">${t}</button>`;
  view().innerHTML = `
    <div class="muted" style="margin-bottom:6px">📨 صندوق الوارد — بانتظار الحسم ${newCount} • في الأرشيف ${doneCount}</div>
    <div style="margin-bottom:10px">${tab('new', '📥 ملاحظات الزوار (' + newCount + ')')}${tab('done', '🗂️ الأرشيف (' + doneCount + ')')}</div>
    ${shown.length ? shown.map(f => {
      const nb = parseNewborn(f);
      const ro = parseReorder(f);
      const body = ro
        ? `<div class="li-sub" style="margin-top:4px">👨‍👦 الأب: <b>${esc(ro.father || '')}</b></div>
           <div class="li-sub" style="margin-top:4px;line-height:2">الترتيب المقترح:<br>${(ro.names || []).map((n, i) => (i + 1) + '. ' + esc(n)).join('<br>')}</div>`
        : nb
        ? `<div class="li-sub" style="margin-top:4px">👶 المولود: <b>${esc(nb.name)}</b></div>
           <div class="li-sub">الأب: ${esc(nb.father || '')}</div>
           ${nb.birth ? `<div class="li-sub">سنة الولادة: ${esc(nb.birth)}</div>` : ''}
           ${nb.city ? `<div class="li-sub">المدينة: ${esc(nb.city)}</div>` : ''}
           ${f.status !== 'done' ? `<div style="margin-top:8px;padding:8px 10px;border:1px solid var(--danger);border-radius:8px;color:var(--danger);font-weight:700;font-size:.85rem;line-height:1.7">⚠️ تأكّد من الاسم وأبيه وجدّه — اسأل وتأكّد قبل الإضافة.</div>` : ''}`
        : `${f.details ? `<div class="li-sub" style="margin-top:4px;white-space:pre-wrap">${esc(f.details)}</div>` : ''}`;
      const actions = ro
        ? (f.status !== 'done'
            ? `<button class="btn sm" data-rook="${f.id}">✅ اعتماد وتطبيق</button><button class="btn sm danger" data-rono="${f.id}">❌ رفض</button>`
            : `<span class="badge add">✓ عولج</span> <button class="btn sm danger" data-fbdel="${f.id}">حذف السجل</button>`)
        : nb
        ? (f.status !== 'done'
            ? `${canApproveBirth() ? `<button class="btn sm" data-nbok="${f.id}">✅ موافقة وإضافة</button>` : ''}<button class="btn sm danger" data-nbno="${f.id}">❌ رفض وحذف</button>`
            : `<span class="badge add">✓ أُضيف للشجرة</span> <button class="btn sm danger" data-fbdel="${f.id}">حذف السجل</button>`)
        : `${f.status !== 'done' ? `<button class="btn sm" data-fbdone="${f.id}">✓ تم</button>` : `<button class="btn sm outline" data-fbreopen="${f.id}">↩ إعادة فتح</button>`}<button class="btn sm danger" data-fbdel="${f.id}">حذف</button>`;
      return `
      <div class="card" style="padding:12px;${f.status !== 'done' ? 'border-right:4px solid var(--brand)' : 'opacity:.72'}">
        <div class="row" style="border:0;padding:0;align-items:center">
          <span class="li-title">${icon[f.subject] || '•'} ${esc(f.subject)}</span>
          <span>${f.status === 'done' ? '<span class="badge add">✓ تم</span>' : '<span class="badge off">جديد</span>'}</span>
        </div>
        ${f.branch_id ? `<div class="li-sub" style="margin-top:4px">🗂️ الفرع: <b>${esc(branchName(f.branch_id))}</b></div>` : ''}
        ${body}
        ${f.error_desc ? `<div class="li-sub" style="margin-top:4px;white-space:pre-wrap">⚠️ ${esc(f.error_desc)}</div>` : ''}
        ${f.reply ? `<div style="margin-top:8px;padding:8px 10px;background:color-mix(in srgb, var(--brand) 7%, var(--card));border:1px solid var(--line);border-inline-start:3px solid var(--brand);border-radius:8px;font-size:.86rem;line-height:1.8">↩️ <b>ردّ الإدارة:</b> ${esc(f.reply)}<div class="muted" style="font-size:.72rem;margin-top:2px">${esc(f.replied_by_name || '')}${f.replied_at ? ' • ' + fmtDateTime(f.replied_at) : ''}</div></div>` : ''}
        <div class="muted" style="margin-top:6px;font-size:.74rem">👤 ${esc(f.created_by_name || 'زائر')}${(() => { const ph = f.sender_phone || (() => { const sp = feedbackSenderPerson(f); return (sp && sp.phone) ? sp.phone : ''; })(); return ph ? ' • 📱 <b>' + esc(ph) + '</b>' + (f.sender_phone ? '' : ' <span style="opacity:.7">(من ملفه المسجّل)</span>') : ''; })()} • ${fmtDateTime(f.created_at)}${f.status === 'done' && f.done_by_name ? ' • ' + esc(f.done_by_name) : ''}</div>
        <div class="btn-row" style="margin-top:8px">${(() => { const sp = f.sender_phone && feedbackSenderPerson(f); return (sp && (!sp.phone || normPhone(sp.phone) !== normPhone(f.sender_phone)) && canEditPerson(sp)) ? `<button class="btn sm outline" data-fbphone="${f.id}">📱 حفظ الجوال في ملفه</button>` : ''; })()}<button class="btn sm outline" data-fbreply="${f.id}">↩️ ${f.reply ? 'تعديل الرد' : 'رد باسم الإدارة'}</button>${actions}</div>
      </div>`; }).join('') : '<div class="center-empty">لا توجد عناصر في هذا التبويب.</div>'}`;
  view().querySelectorAll('[data-fbfilter]').forEach(b => b.addEventListener('click', () => { fbFilter = b.dataset.fbfilter; screenFeedbacks(); }));
  view().querySelectorAll('[data-fbdone]').forEach(b => b.addEventListener('click', () => markFeedback(b.dataset.fbdone, 'done')));
  view().querySelectorAll('[data-fbreopen]').forEach(b => b.addEventListener('click', () => markFeedback(b.dataset.fbreopen, 'new')));
  view().querySelectorAll('[data-fbdel]').forEach(b => b.addEventListener('click', () => delFeedback(b.dataset.fbdel)));
  view().querySelectorAll('[data-fbreply]').forEach(b => b.addEventListener('click', () => replyModal(list.find(x => String(x.id) === b.dataset.fbreply))));
  view().querySelectorAll('[data-fbphone]').forEach(b => b.addEventListener('click', () => addSenderPhone(list.find(x => String(x.id) === b.dataset.fbphone))));
  view().querySelectorAll('[data-rook]').forEach(b => b.addEventListener('click', () => approveReorder(list.find(x => String(x.id) === b.dataset.rook))));
  view().querySelectorAll('[data-rono]').forEach(b => b.addEventListener('click', () => rejectReorder(list.find(x => String(x.id) === b.dataset.rono))));
  view().querySelectorAll('[data-nbok]').forEach(b => b.addEventListener('click', () => approveNewborn(list.find(x => String(x.id) === b.dataset.nbok))));
  view().querySelectorAll('[data-nbno]').forEach(b => b.addEventListener('click', () => rejectNewborn(list.find(x => String(x.id) === b.dataset.nbno))));
}
// اعتماد طلب «إعادة ترتيب الإخوان»: يتحقق من الصلاحية وثبات القائمة ثم يطبّق الترتيب،
// وبعده يُفتح الرد الجاهز ليصل المرسلَ باسم الإدارة.
async function approveReorder(f) {
  const o = parseReorder(f); if (!o) { toast('بيانات الطلب غير صالحة'); return; }
  const father = byId.get(o.father_id);
  if (!father) { toast('لم يُعثر على الأب في الشجرة'); return; }
  if (!canReorder(father)) { toast('ليست لديك صلاحية الترتيب لهذا الفرع'); return; }
  const cur = childrenOf(father.id).map(c => c.id);
  const same = cur.length === o.order.length &&
    cur.slice().sort((a, b) => a - b).join(',') === o.order.slice().map(Number).sort((a, b) => a - b).join(',');
  if (!same) { toast('تغيّرت قائمة الأبناء منذ إرسال الطلب — راجع الترتيب يدوياً من ملف الأب'); return; }
  if (!(await confirm2('اعتماد الترتيب المقترح لأبناء «' + father.name + '»؟\n' + (o.names || []).map((n, i) => (i + 1) + '. ' + n).join('\n'), { title: 'اعتماد إعادة الترتيب', okText: 'اعتماد وتطبيق' }))) return;
  const who = (me && (me.full_name || me.username)) || '';
  const ok = await guard(async () => {
    for (let i = 0; i < o.order.length; i++) {
      const { error } = await sb.from('almfrje_persons').update({ sort: i + 1, updated_by_name: who, updated_at: new Date().toISOString() }).eq('id', Number(o.order[i]));
      if (error) throw error;
    }
    await fbApi('done', f.id);
  });
  if (ok) { toast('اعتُمد الترتيب وطُبّق ✓'); await loadAll(); screenFeedbacks(); replyModal(f); }
}
// رفض الطلب: يُعلَّم «تم» (لا يُحذف) ثم يُفتح الرد ليُبلَّغ المرسل باسم الإدارة.
async function rejectReorder(f) {
  if (!(await confirm2('رفض طلب إعادة الترتيب؟ سيبقى في السجل معلَّماً «تم»، ويمكنك الرد على مرسله.', { title: 'رفض الطلب', okText: 'رفض', danger: true }))) return;
  const ok = await guard(async () => { await fbApi('done', f.id); });
  if (ok) { toast('رُفض الطلب'); screenFeedbacks(); replyModal(f); }
}
// موافقة المدير/مشرف الفرع على طلب إضافة مولود → يُضاف فعلياً للشجرة.
async function approveNewborn(f) {
  const o = parseNewborn(f); if (!o) { toast('بيانات الطلب غير صالحة'); return; }
  const father = byId.get(o.father_id);
  if (!father) { toast('لم يُعثر على والد المولود في الشجرة'); return; }
  if (!isAdmin() && !(isManager() && inMyBranch(father))) { toast('ليست لديك صلاحية على هذا الفرع'); return; }
  if (sameNameSiblings(father, o.name).some(c => c.status !== 'dead')) { toast('يوجد ابن حيّ بنفس الاسم لنفس الأب — راجِع الطلب'); return; }
  if (father.status !== 'dead' && normalizeAr(o.name) === normalizeAr(father.name)) { toast('اسم المولود مطابق لاسم والده الحيّ — لا يصحّ، راجِع الطلب'); return; }
  const chain = [o.name].concat(lineage(father.id).map(x => x.name)).join(' بن ');
  if (!(await confirm2(`⚠️ سيُضاف «${o.name}» إلى الشجرة نهائياً تحت:\n${chain}\nتأكّد أنه ليس مكرّراً قبل المتابعة.`, { title: 'مراجعة قبل الإضافة', okText: 'متابعة', danger: false }))) return;
  const typed = await uiPrompt('للتأكيد النهائي اكتب كلمة: اضافة', { title: 'تأكيد نهائي', placeholder: 'اضافة', okText: 'إضافة' });
  if ((typed || '').trim() !== 'اضافة') { toast('أُلغيت الإضافة'); return; }
  const ok = await guard(async () => { await fbApi('approve', f.id); });   // الخادم يُدرج المولود ويسجّله
  if (ok) { toast('تمت الموافقة وأُضيف «' + o.name + '» للشجرة'); await loadAll(); screenFeedbacks(); }
}
// رفض طلب إضافة مولود وحذفه نهائياً.
async function rejectNewborn(f) {
  if (!f) return;
  if (!(await confirm2('رفض هذا الطلب وحذفه نهائياً؟ لن يُضاف المولود إلى الشجرة.', { title: 'تأكيد الرفض', okText: 'رفض وحذف نهائي', danger: true }))) return;
  const ok = await guard(async () => { await fbApi('reject', f.id); });
  if (ok) { toast('رُفض الطلب وحُذف'); screenFeedbacks(); }
}
async function markFeedback(id, status) {
  if (status === 'done' && !(await confirm2('تأكيد: تم اتخاذ الإجراء على هذه الملاحظة ووضع علامة «تم»؟', { title: 'تأكيد الإجراء', okText: 'تم', danger: false }))) return;
  const ok = await guard(async () => { await fbApi(status === 'done' ? 'done' : 'reopen', id); });
  if (ok) { toast(status === 'done' ? 'تم وضع علامة «تم» ✓' : 'أُعيد فتح الملاحظة'); screenFeedbacks(); }
}
async function delFeedback(id) {
  if (!(await confirm2('حذف هذه الملاحظة نهائياً؟', { title: 'تأكيد الحذف', okText: 'حذف', danger: true }))) return;
  const ok = await guard(async () => { await fbApi('delete', id); });
  if (ok) { toast('حُذفت الملاحظة'); screenFeedbacks(); }
}

/* ===== المزيد ===== */
let moreOpen = new Set([0]);   // المجموعات المفتوحة في «المزيد» (الأولى مفتوحة افتراضياً)
function screenMore() {
  const r0 = roots()[0];
  // مجموعات متشابهة قابلة للطيّ — كل مجموعة عنوان وعناصرها [label, action, hint?]
  const groups = [];

  // ١) الإحصائيات — تصنيف رئيسي أعلى القائمة (يجمع كل الإحصاءات)
  groups.push(['📊 الإحصائيات', [['📈 الإحصائيات الكاملة (أفراد • أجيال • فروع • زيارات)', '#/stats']]]);

  // ٢) المشجّرات والعروض (للجميع)
  const trees = [];
  if (r0) { trees.push(['🌳 العرض الهرمي العام', '#/hierarchy/all', 'hierarchy']); trees.push(['🗒️ نموذج الأعمدة', '#/outline/all', 'outline']); }
  trees.push(['🕓 خط الأجيال', '#/timeline/all']);
  trees.push(['🔆 الشجرة الدائرية', '#/radial/all']);
  trees.push(['📇 فهرس ذرية شخص', '#pickdesc', 'descendants']);
  trees.push(['🖨️ نسخة مختصرة للطباعة', '#/printtree']);
  groups.push(['🌳 المشجّرات والعروض', trees]);

  // ٣) الحاسبات (للجميع)
  groups.push(['🧮 الحاسبات', [['🧬 حاسبة صلة القرابة', '#/kinship', 'kinship']]]);

  // ٤) المساعدة (للجميع) — دليل الاستخدام + الأسئلة الشائعة (تصنيف مستقل)
  groups.push(['❓ المساعدة', [['📖 دليل استخدام الموقع', '#/guide'], ['❓ الأسئلة الشائعة', '#/faq']]]);

  // ٣) الإدارة (للمصرّح لهم فقط) — أدوات البيانات + لوحة التحكم والملاحظات والسجل والتعليمات مجمّعة
  const admin = [];
  if (isAdmin()) admin.push(['⚙️ لوحة التحكم', '#/control', 'control_panel']);
  if (isAdmin() || isGeneralManager()) admin.push(['💬 المناقشات (الإدارة العليا)', '#/discussions']);
  { const n = (isAdmin() || isManager()) ? (C.feedbackPending || 0) : 0;
    if (isAdmin() || isManager()) admin.push(['📨 صندوق الوارد' + (n > 0 ? ' <span class="inb-badge">' + (n > 99 ? '99+' : n) + '</span>' : ''), '#/feedbacks', 'feedbacks']); }
  if (canAdd()) admin.push(['👶 إضافة مولود (مباشرة)', '#/person-edit/0', 'add_person']);
  if (isAdmin()) admin.push(['📥 استيراد ملف Excel', '#/import', 'import']);
  if (isAdmin() || isManager()) admin.push(['✏️ تعديل جماعي', '#/bulk', 'bulk']);
  if (isAdmin() || isManager()) admin.push(['📝 تعديل البيانات بالقائمة', '#/grid', 'grid']);
  if (isAdmin() || isManager()) admin.push(['↕️ ترتيب الأبناء', '#/reorder']);
  if (!isGuestUser()) admin.push(['👁️ مراجعة البيانات (الأحياء)', '#/review', 'review']);
  if (isAdmin() || isManager()) admin.push(['🔁 كشف الأسماء المكرّرة لنفس الأب', '#/dups', 'dups']);
  if (isManager() && !isAdmin()) admin.push(['📋 سجل تعديلاتي (تراجع)', '#/audit', 'audit']);
  if (isAdmin() || isManager()) admin.push(['📖 تعليمات المدير والمشرف', '#/guideadmin']);
  if (admin.length) {
    const n = (isAdmin() || isManager()) ? (C.feedbackPending || 0) : 0;
    groups.push(['⚙️ الإدارة' + (n > 0 ? ' <span class="inb-badge">' + (n > 99 ? '99+' : n) + '</span>' : ''), admin]);
  }

  // ٥) حسابي
  const acct = [];
  if (!isGuestUser()) acct.push(['👤 ملفي الشخصي (الجوال/كلمة المرور)', '#/profile', 'profile']);
  if (!alreadyInstalled()) acct.push(['📌 إضافة اختصار الموقع إلى الشاشة', '#install']);
  if (isGuestUser()) acct.push(['🔐 دخول المسؤول / مشرف الفرع', '#adminlogin']);
  if (acct.length) groups.push(['👤 حسابي', acct]);

  view().innerHTML = groups.map(([title, items], gi) => {
    const open = moreOpen.has(gi);
    return `<div class="more-group${open ? ' open' : ''}">
      <button class="more-group-title" data-mg="${gi}"><span class="mg-ico">${open ? '▾' : '▸'}</span><span class="mg-label">${title}</span><span class="mg-count">${items.length}</span></button>
      <div class="more-group-items">
        ${items.map(([l, h, hint]) => `<div class="card click more-card" data-act="${h}"><div class="li-title">${l}</div>${hint ? hintBtn(hint) : ''}</div>`).join('')}
      </div>
    </div>`;
  }).join('')
    + (sitePowered ? `<div class="muted" style="text-align:center;margin-top:14px;font-size:.8rem;opacity:.85">${esc(sitePowered)}</div>` : '');

  // طيّ/فتح في المكان (بلا إعادة رسم) — تبقى مستمعات العناصر والتلميحات سليمة
  view().querySelectorAll('[data-mg]').forEach(b => b.addEventListener('click', () => {
    const gi = parseInt(b.dataset.mg, 10), grp = b.closest('.more-group');
    const open = grp.classList.toggle('open');
    if (open) moreOpen.add(gi); else moreOpen.delete(gi);
    const ico = b.querySelector('.mg-ico'); if (ico) ico.textContent = open ? '▾' : '▸';
  }));
  view().querySelectorAll('.more-card[data-act]').forEach(c => c.addEventListener('click', (e) => {
    if (e.target.closest('[data-hint]')) return;   // لا تتنقّل عند الضغط على (i)
    if (c.dataset.act === '#pickdesc') pickDescendantStart();
    else if (c.dataset.act === '#install') triggerInstall();
    else if (c.dataset.act === '#adminlogin') { location.hash = '#login'; sb.auth.signOut(); }
    else if (c.dataset.act.charAt(0) === '/') location.href = c.dataset.act;   // صفحة مستقلة (كالشجرة الطبيعية)
    else setHash(c.dataset.act);
  }));
}
// اختيار بداية فهرس الذرية: الأصول (فراج/مفرج) كأزرار سريعة، أو أي شخص.
function pickDescendantStart() {
  const rs = roots();
  const rootBtns = rs.map(r => `<button class="btn" data-droot="${r.id}">🌳 ${esc(r.name)} <span class="muted" style="font-weight:normal">(${(descCount.get(r.id) || 0) + 1})</span></button>`).join('');
  openModal('فهرس ذرية — ابدأ من', `
    <div class="muted" style="margin-bottom:8px">اختر أصلاً لعرض فهرس ذريّته كاملاً، أو ابحث عن أي شخص.</div>
    <div class="btn-row" style="flex-direction:column;gap:8px">${rootBtns}</div>
    <hr style="margin:12px 0;border:0;border-top:1px solid var(--line)">
    <button class="btn outline" id="d_any">🔍 اختر شخصاً آخر</button>`, () => {
    document.querySelectorAll('[data-droot]').forEach(b => b.addEventListener('click', () => { closeModal(); setHash('#/descendants/' + b.dataset.droot); }));
    document.getElementById('d_any').addEventListener('click', () => { closeModal(); pickPerson('اختر شخصاً لعرض فهرس ذريته', (p) => p && setHash('#/descendants/' + p.id)); });
  });
}
// (أُزيلت أداة «حذف كل البيانات» — حذف الأسماء منتهٍ. الاستبدال الكامل يتم فقط
//  ضمن «استعادة نسخة احتياطية» عبر دالة المدير المحمية almfrje_admin_wipe_persons.)
// يبني كائن النسخة الاحتياطية الكامل (كل الجداول + الإعدادات + بيانات وصفية).
async function buildBackupObject() {
  let settings = [], docs = [];
  try { const { data } = await sb.from('almfrje_settings').select('*'); settings = data || []; } catch (e) { }
  try { const d = await fetchAll('almfrje_documents'); docs = d || []; } catch (e) { }
  // نزيل الحقول المحسوبة في المتصفّح (تبدأ بـ _) من الأشخاص
  const cleanArr = (arr) => (arr || []).map(o => { const r = {}; for (const k in o) if (!k.startsWith('_')) r[k] = o[k]; return r; });
  return {
    app: 'almfrje', kind: 'full-backup', version: 1,
    created_at: new Date().toISOString(),
    by: (me && (me.full_name || me.username)) || '',
    counts: { persons: C.persons.length, branches: C.branches.length, members: C.members.length, documents: docs.length, settings: settings.length },
    data: { persons: cleanArr(C.persons), branches: C.branches, members: C.members, documents: docs, settings },
  };
}
// نسخة احتياطية كاملة تُنزَّل كملف JSON على الجهاز.
async function backupFull() {
  showLoading(true);
  try {
    const backup = await buildBackupObject();
    // اسم الملف: «المفرجي» + تاريخ اليوم والوقت (بالتوقيت المحلّي) — مثال: المفرجي_2026-06-10_15-30.json
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
    download(`المفرجي_${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
  } catch (e) { toast('تعذّرت النسخة: ' + (e.message || e)); }
  showLoading(false);
}
// استعادة من ملف يرفعه المستخدم.
async function restoreBackup() {
  if (!isAdmin()) { toast('للمدير فقط'); return; }
  const file = document.getElementById('rs_file').files[0];
  if (!file) { toast('اختر ملف النسخة الاحتياطية (.json)'); return; }
  let backup;
  try { backup = JSON.parse(await file.text()); } catch (e) { toast('ملف غير صالح'); return; }
  await restoreFromObject(backup);
}
// استعادة من كائن نسخة (مشترك بين الملف المرفوع والنسخ المحفوظة في القاعدة).
async function restoreFromObject(backup) {
  if (!isAdmin()) { toast('للمدير فقط'); return; }
  if (!backup || backup.app !== 'almfrje' || !backup.data) { toast('هذا ليس ملف نسخة احتياطية للمفارجة'); return; }
  const d = backup.data;
  // حماية من فقدان البيانات: لا نمسح الحالي إلا إذا كانت النسخة كاملة وصالحة فعلاً.
  if (!Array.isArray(d.persons) || d.persons.length === 0) { toast('النسخة لا تحوي أشخاصاً — أُلغيت الاستعادة حمايةً لبياناتك'); return; }
  if (backup.version != null && Number(backup.version) > 1) { toast('هذه النسخة من إصدارٍ أحدث غير مدعوم — حدّث الموقع أولاً'); return; }
  const np = (d.persons || []).length, nb = (d.branches || []).length;
  if (!(await confirm2(`ستُحذف البيانات الحالية وتُستبدل بـ ${np} شخص و ${nb} فرع من النسخة (${backup.created_at || ''}). متابعة؟`))) return;
  const typedR = await uiPrompt('للتأكيد النهائي اكتب كلمة: استعادة', { title: 'تأكيد الاستعادة', placeholder: 'استعادة', danger: true, okText: 'استعادة' });
  if ((typedR || '').trim() !== 'استعادة') { toast('أُلغيت الاستعادة'); return; }
  showLoading(true);
  const ok = await guard(async () => {
    // مسح الحالي عبر دالة المدير المحمية (DELETE المباشر ممنوع للجميع).
    const { error: we } = await sb.rpc('almfrje_admin_wipe_persons'); if (we) throw we;
    // أعِد الإدخال محافظاً على المعرّفات. لتفادي قيود المفاتيح الأجنبية الدائرية:
    //   ١) أدخل الأشخاص بلا father_id/branch_id، والفروع بلا root_id. ٢) ثم حدّث المراجع.
    // قائمة أعمدة بيضاء مطابقة للمخطّط (lib/almfrje-schema.ts) — تتجاهل أي عمود غير معروف
    // فلا يفشل الإدخال بعد المسح. عند إضافة عمود للمخطّط، أضِفه هنا أيضاً.
    const COLS = {
      almfrje_persons: ['id', 'name', 'father_id', 'branch_id', 'generation', 'sex', 'status', 'birth', 'death', 'phone', 'email', 'city', 'photo_url', 'notes', 'sort', 'created_at', 'created_by', 'created_by_name', 'updated_by_name', 'updated_at', 'work', 'birthplace', 'nickname', 'field_audit'],
      almfrje_branches: ['id', 'name', 'root_id', 'manager_id', 'notes', 'created_at'],
      almfrje_documents: ['id', 'person_id', 'kind', 'url', 'label', 'created_at', 'created_by'],
      almfrje_settings: ['key', 'value', 'updated_at'],
    };
    const pick = (table, o, drop = []) => { const r = {}; for (const k of COLS[table]) if (k in o && !drop.includes(k)) r[k] = o[k]; return r; };
    const insChunks = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 300) {
        const { error } = await sb.from(table).insert(rows.slice(i, i + 300)); if (error) throw error;
      }
    };
    const persons = d.persons || [], branches = d.branches || [], docs = d.documents || [];
    if (persons.length) await insChunks('almfrje_persons', persons.map(p => pick('almfrje_persons', p, ['father_id', 'branch_id'])));
    if (branches.length) await insChunks('almfrje_branches', branches.map(b => pick('almfrje_branches', b, ['root_id'])));
    for (const p of persons) {
      if (p.father_id != null || p.branch_id != null) {
        await sb.from('almfrje_persons').update({ father_id: p.father_id ?? null, branch_id: p.branch_id ?? null }).eq('id', p.id);
      }
    }
    for (const b of branches) {
      if (b.root_id != null) await sb.from('almfrje_branches').update({ root_id: b.root_id }).eq('id', b.id);
    }
    if (docs.length) await insChunks('almfrje_documents', docs.map(x => pick('almfrje_documents', x)));
    if (d.settings && d.settings.length) {
      for (const s of d.settings) { await sb.from('almfrje_settings').upsert(pick('almfrje_settings', s), { onConflict: 'key' }); }
    }
  });
  showLoading(false);
  if (ok) { toast('تمت الاستعادة'); closeModal(); await loadAll(); setHash('#/home'); render(); }
}
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('تم التنزيل');
}

/* ===== استيراد Excel (مرة واحدة) ===== */
let importParsed = null;
function screenImport() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  view().innerHTML = `
    <div class="card"><h3>استيراد البيانات — مرة واحدة ${hintBtn('import')}</h3>
      <p class="muted">كل عمود يمثل جيلاً: العمود الأقصى يميناً = الأصل، ثم أبناؤه، وهكذا. الأسماء المتتالية في نفس العمود تُعدّ إخوةً لنفس الأب في العمود السابق.</p>
      <p class="muted" style="font-size:.85rem">الأفضل والأدق: ملف <b>Excel/CSV</b> (الأعمدة محفوظة). يُقبل أيضاً <b>PDF</b> (يُحلَّل بأفضل جهد — راجع المعاينة قبل الاعتماد).</p>
      <div class="field"><label>اختر ملف Excel / CSV / PDF</label><input id="imp_file" type="file"></div>
      <div class="check"><input type="checkbox" id="imp_header" checked><label for="imp_header" style="margin:0">السطر الأول عناوين (تجاهله)</label></div>
      <button class="btn outline" id="imp_parse">معاينة</button>
    </div>
    <div id="imp_preview"></div>`;
  document.getElementById('imp_parse').addEventListener('click', parseImport);
}
function parseImport() {
  const file = document.getElementById('imp_file').files[0];
  if (!file) { toast('اختر ملفاً'); return; }
  if (!/\.(xlsx|xls|csv|pdf)$/i.test(file.name)) { toast('صيغة غير مدعومة. اختر ملف Excel (.xlsx/.xls) أو CSV أو PDF.'); return; }
  const skipHeader = document.getElementById('imp_header').checked;
  const isPdf = /\.pdf$/i.test(file.name);
  toast('… جارٍ قراءة الملف');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let items;
      if (isPdf) { toast('… تحليل PDF'); await loadPDF(); items = await pdfToItems(e.target.result, skipHeader); }
      else {
        await loadXLSX();
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
        if (skipHeader) rows = rows.slice(1);
        rows = stripStatsTable(rows);
        items = rowsToItems(rows);
      }
      importParsed = buildNodes(items);
      renderImportPreview();
    } catch (err) { toast('تعذّرت قراءة الملف: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}
// تقصّ جدول الإحصائيات/الملخّص الذي يوضع غالباً في نهاية ملفات الأنساب
// (صفوف فيها عدّة أرقام أو كلمة «الكلي/المجموع»)، فلا تُحسب كأشخاص وهميين.
// عند أوّل صف إحصائي، يُقطع كل ما بعده (الملخّص دائماً في الذيل).
function isStatsRow(r) {
  let nums = 0;
  for (const c of r) {
    const v = String(c == null ? '' : c).trim();
    if (/الكلي|المجموع/.test(v)) return true;
    // رقم من خانتين فأكثر (عربي أو لاتيني) = خانة عدّ في جدول إحصائي
    if (v.length >= 2 && /^[\d٠-٩]+$/.test(v)) nums++;
  }
  return nums >= 2;
}
function stripStatsTable(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (isStatsRow(rows[i])) return rows.slice(0, i);
  }
  return rows;
}
// من صفوف Excel إلى عناصر [{col, name}] (أوّل خلية غير فارغة = العمود/الجيل)
function rowsToItems(rows) {
  const items = [];
  for (const r of rows) {
    let col = -1, name = '';
    for (let c = 0; c < r.length; c++) { const v = String(r[c] == null ? '' : r[c]).trim(); if (v) { col = c; name = v; break; } }
    if (col >= 0 && name && !/^\d+$/.test(name)) items.push({ col, name });
  }
  return items;
}
// من PDF إلى عناصر [{col, name}] بتحليل مواضع x (RTL: العمود الأقصى يميناً = الجيل الأول)
async function pdfToItems(buf, skipHeader) {
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const raw = [];   // {str, x, y, page}
  for (let pg = 1; pg <= doc.numPages; pg++) {
    const page = await doc.getPage(pg);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const s = (it.str || '').trim(); if (!s) continue;
      raw.push({ str: s, x: it.transform[4], y: it.transform[5], page: pg });
    }
  }
  // اجمع العناصر في صفوف (نفس الصفحة + y متقارب)
  raw.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows = []; let cur = null;
  for (const r of raw) {
    if (!cur || cur.page !== r.page || Math.abs(cur.y - r.y) > 6) { cur = { page: r.page, y: r.y, parts: [] }; rows.push(cur); }
    cur.parts.push(r);
  }
  // لكل صف: الاسم = دمج الأجزاء (يمين→يسار)، x المرجعي = أقصى يمين
  let rowObjs = rows.map(row => {
    const parts = row.parts.slice().sort((a, b) => b.x - a.x);
    const name = parts.map(p => p.str).join('').replace(/\s+/g, ' ').trim();
    const x = Math.max(...parts.map(p => p.x));
    return { name, x };
  }).filter(r => r.name && !/^\d+$/.test(r.name.replace(/\s/g, '')));
  if (skipHeader && rowObjs.length) rowObjs = rowObjs.slice(1);
  // عنقدة مواضع x إلى أعمدة، ثم رتّبها تنازلياً (الأيمن = الجيل الأول)
  const xs = rowObjs.map(r => r.x).sort((a, b) => a - b);
  const centers = [];
  for (const x of xs) { const last = centers[centers.length - 1]; if (last == null || x - last > 22) centers.push(x); else centers[centers.length - 1] = (last + x) / 2; }
  const colOf = (x) => { let best = 0, bd = Infinity; centers.forEach((c, i) => { const d = Math.abs(c - x); if (d < bd) { bd = d; best = i; } }); return best; };
  const sortedDesc = centers.slice().sort((a, b) => b - a);   // الأيمن أولاً
  const rank = (x) => sortedDesc.indexOf(centers[colOf(x)]);
  return rowObjs.map(r => ({ col: rank(r.x), name: r.name }));
}
// تحويل عناصر [{col, name}] المرتّبة إلى عُقد بعلاقات أب/ابن + حساب الفرع (جدّ الجيل الثاني)
function buildNodes(items) {
  const nodes = []; let tmp = 0; const lastAtCol = [];
  for (const it of items) {
    const col = it.col, name = (it.name || '').trim();
    if (col < 0 || !name) continue;
    const node = { tmp: ++tmp, name, gen: col + 1, parentTmp: col > 0 ? (lastAtCol[col - 1] || null) : null };
    nodes.push(node);
    lastAtCol[col] = node.tmp;
    lastAtCol.length = col + 1;     // امسح المستويات الأعمق
  }
  // احسب جدّ الجيل الثاني لكل عقدة (يحدد الفرع)
  const map = new Map(nodes.map(n => [n.tmp, n]));
  for (const n of nodes) {
    let cur = n, guard = 0;
    while (cur && cur.gen > 2 && guard++ < 80) cur = map.get(cur.parentTmp);
    n.g2 = (cur && cur.gen === 2) ? cur.tmp : null;   // فرع = عقدة الجيل الثاني
  }
  return nodes;
}
function renderImportPreview() {
  const nodes = importParsed || [];
  const box = document.getElementById('imp_preview');
  if (!nodes.length) { box.innerHTML = '<div class="center-empty">لم يُعثر على أسماء صالحة في الملف.</div>'; return; }
  const gmax = nodes.reduce((m, n) => Math.max(m, n.gen), 0);
  const branches = nodes.filter(n => n.gen === 2);
  const map = new Map(nodes.map(n => [n.tmp, n]));
  // معاينة شجرية مختصرة لأول جذر
  const root = nodes.find(n => n.gen === 1);
  let sample = '';
  if (root) {
    const childrenTmp = (t) => nodes.filter(x => x.parentTmp === t);
    const lines = [root.name];
    const walk = (t, pre, depth) => { if (depth > 3) return; const cs = childrenTmp(t); cs.slice(0, 6).forEach((c, i) => { const last = i === cs.length - 1; lines.push(pre + (last ? '└── ' : '├── ') + c.name); walk(c.tmp, pre + (last ? '    ' : '│   '), depth + 1); }); };
    walk(root.tmp, '', 1);
    sample = lines.slice(0, 40).join('\n');
  }
  box.innerHTML = `
    <div class="card"><h3>معاينة الاستيراد</h3>
      ${row('إجمالي الأفراد', nodes.length)}${row('عدد الأجيال', gmax)}${row('عدد الفروع (الجيل الثاني)', branches.length)}
    </div>
    <div class="card"><h3>عيّنة من الشجرة</h3><div class="ascii">${esc(sample)}</div></div>
    <div class="card"><h3>تأكيد</h3>
      <p class="muted">سيتم إنشاء العلاقات والفروع وتحديد الجيل تلقائياً. الاستيراد لمرة واحدة. ${imported ? '<b style="color:var(--danger)">تنبيه: سبق الاستيراد.</b>' : ''}</p>
      <button class="btn" id="imp_commit">✅ تنفيذ الاستيراد (${nodes.length} فرد)</button>
    </div>`;
  document.getElementById('imp_commit').addEventListener('click', commitImport);
}
async function commitImport() {
  const nodes = importParsed || [];
  if (!nodes.length) return;
  if (imported && !(await confirm2('سبق استيراد بيانات. الاستيراد مرة أخرى سيضيف نسخة مكررة. متابعة؟'))) return;
  if (!(await confirm2('تنفيذ الاستيراد النهائي لعدد ' + nodes.length + ' فرد؟'))) return;
  const btn = document.getElementById('imp_commit'); btn.disabled = true;
  const setMsg = (m) => { btn.textContent = m; };
  const realId = new Map();      // tmp -> real person id
  const branchId = new Map();    // gen2 tmp -> branch id
  const byGen = {}; nodes.forEach(n => (byGen[n.gen] = byGen[n.gen] || []).push(n));
  const gmax = nodes.reduce((m, n) => Math.max(m, n.gen), 0);
  // فرع حقيقي = عقدة جيل ثانٍ لها ذرية (أبناء). من ليس له ذرية (مثل «سفران»)
  // يبقى فرداً عادياً يُحسب ضمن العدد تحت جذره، ولا يُنشأ له فرع مستقل.
  const hasKids = new Set(); nodes.forEach(n => { if (n.parentTmp) hasKids.add(n.parentTmp); });
  const ok = await guard(async () => {
    for (let g = 1; g <= gmax; g++) {
      const list = byGen[g] || []; if (!list.length) continue;
      setMsg(`… الجيل ${g}/${gmax} (${list.length})`);
      // أدخل على دفعات واربط المعرفات بالترتيب
      const CH = 500;
      for (let i = 0; i < list.length; i += CH) {
        const chunk = list.slice(i, i + CH);
        const payload = chunk.map((n, idx) => ({
          name: n.name, generation: g,
          father_id: g > 1 ? (realId.get(n.parentTmp) || null) : null,
          branch_id: g >= 3 ? (branchId.get(n.g2) || null) : null,
          sort: i + idx,
        }));
        const { data, error } = await sb.from('almfrje_persons').insert(payload).select('id');
        if (error) throw error;
        data.forEach((rec, idx) => realId.set(chunk[idx].tmp, rec.id));
      }
      // بعد إدخال الجيل الثاني: أنشئ الفروع (لمن له ذرية فقط) واربطها
      if (g === 2) {
        setMsg('… إنشاء الفروع');
        const branchNodes = list.filter(n => hasKids.has(n.tmp));   // استثنِ الأفراد المنقطعين
        for (let i = 0; i < branchNodes.length; i += CH) {
          const chunk = branchNodes.slice(i, i + CH);
          const bpayload = chunk.map(n => ({ name: n.name, root_id: realId.get(n.tmp) }));
          const { data, error } = await sb.from('almfrje_branches').insert(bpayload).select('id');
          if (error) throw error;
          data.forEach((rec, idx) => branchId.set(chunk[idx].tmp, rec.id));
        }
        // عيّن لكل عقدة جيل ثانٍ لها فرع فرعَها الخاص (المنقطع يبقى بلا فرع)
        for (let i = 0; i < branchNodes.length; i += CH) {
          const chunk = branchNodes.slice(i, i + CH);
          for (const n of chunk) { await sb.from('almfrje_persons').update({ branch_id: branchId.get(n.tmp) }).eq('id', realId.get(n.tmp)); }
        }
      }
    }
    await sb.from('almfrje_settings').upsert({ key: 'imported', value: true, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  });
  if (ok) { toast('تم الاستيراد بنجاح'); importParsed = null; await loadAll(); setHash('#/home'); render(); }
  else { btn.disabled = false; setMsg('إعادة المحاولة'); }
}

/* ===== تعديل جماعي (للمدير) ===== */
let bulkAncestor = null;   // الجدّ المختار لحصر النطاق
function screenBulkEdit() {
  if (!isAdmin() && !isManager()) { view().innerHTML = noPerm(); return; }
  const scopeNote = isManager() ? `<div class="add-ctx" style="margin-bottom:10px"><div class="add-ctx-ico">🔒</div><div><div class="add-ctx-title">ضمن صلاحيتك فقط</div><div class="add-ctx-sub">التعديل الجماعي يشمل فرعك المصرّح به فقط: <b>${esc(myBranches().map(b => branchName(b)).join('، ') || '—')}</b></div></div></div>` : '';
  view().innerHTML = `
    ${scopeNote}
    <div class="card"><h3>① اختر الجدّ ثم الجيل ${hintBtn('bulk')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">اختر الجدّ أولاً، ثم الجيل المراد تعديله من ذريّته — فيُعرض ذلك الجيل فقط.</p>
      <div class="field"><label>الجدّ</label>
        <div class="father-pick">
          <div id="bk_ancLabel" class="father-name empty">— اختر الجدّ —</div>
          <div class="btn-row"><button class="btn sm" id="bk_pickAnc" style="margin:0">🔍 اختيار الجدّ</button><button class="btn sm outline" id="bk_clrAnc" style="margin:0">إلغاء</button></div>
        </div>
      </div>
      <div class="field"><label>الجيل (من ذرية الجدّ)</label><select id="bk_gen" disabled><option value="">— اختر الجدّ أولاً —</option></select></div>
    </div>
    <div class="card"><h3>② اختر الحقول المراد تعديلها</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">أشّر الحقل الذي تريد تغييره فقط، وأدخل قيمته. غير المؤشّر لن يتغيّر.</p>
      <label class="perm-chk"><input type="checkbox" data-bf="status"><span>الحالة</span></label>
      <div class="bk-val" id="bkv_status" style="display:none">${fSelect('', 'bk_status', STATUS, 'alive')}</div>
      <label class="perm-chk"><input type="checkbox" data-bf="work"><span>الحالة الوظيفية</span></label>
      <div class="bk-val" id="bkv_work" style="display:none">${fSelect('', 'bk_work', WORK, '')}</div>
      <label class="perm-chk"><input type="checkbox" data-bf="birth"><span>سنة الميلاد</span></label>
      <div class="bk-val" id="bkv_birth" style="display:none"><div class="field"><input id="bk_birth" type="text" placeholder="مثال: 1440هـ"></div></div>
      <label class="perm-chk"><input type="checkbox" data-bf="city"><span>المدينة</span></label>
      <div class="bk-val" id="bkv_city" style="display:none"><div class="field"><input id="bk_city" type="text" placeholder="اسم المدينة"></div></div>
      <label class="perm-chk"><input type="checkbox" data-bf="phone"><span>الجوال</span></label>
      <div class="bk-val" id="bkv_phone" style="display:none"><div class="field"><input id="bk_phone" type="tel" inputmode="tel" placeholder="رقم الجوال"></div></div>
    </div>
    <div class="card"><h3>③ راجِع الأسماء واختر من يشمله التعديل</h3>
      <div id="bk_count" class="search-count">الأفراد المطابقون: <b>0</b></div>
      <div class="btn-row" style="margin-bottom:6px">
        <button class="btn sm outline" id="bk_all">تحديد الكل</button>
        <button class="btn sm outline" id="bk_none">إلغاء الكل</button>
      </div>
      <div id="bk_list" class="bk-list"></div>
      <button class="btn btn-lg" id="bk_apply" style="margin-top:10px">✏️ تطبيق على المحدّدين</button>
    </div>`;
  // الحقول المؤشّرة حالياً، وهل نحن في وضع «حقول الأحياء فقط» (لا يشمل الحالة).
  const bulkSelectedFields = () => [...view().querySelectorAll('input[data-bf]:checked')].map(c => c.dataset.bf);
  const livingOnlyMode = () => { const fs = bulkSelectedFields(); return fs.length > 0 && !fs.includes('status'); };
  // يعيد بناء قائمة المطابقين بمربّعات اختيار (كلها مؤشّرة افتراضياً).
  const refresh = () => {
    const list = bulkMatch();
    const living = livingOnlyMode();   // عند تعديل الجوال/الوظيفة/المدينة/الميلاد: المتوفّى لا يلزم تعديله
    const editable = living ? list.filter(p => p.status !== 'dead') : list;
    document.getElementById('bk_count').innerHTML = !bulkAncestor
      ? 'اختر الجدّ أولاً لعرض الأفراد'
      : (living
        ? `القابلون للتعديل: <b>${editable.length}</b> من ${list.length} (المتوفّون لا يلزم تعديل هذه الحقول)`
        : `الأفراد المطابقون: <b>${list.length}</b> — أزل تأشير من لا تريد تعديله`);
    const box = document.getElementById('bk_list');
    box.innerHTML = list.length
      ? list.slice(0, 1000).map(p => {
          const f = p.father_id ? byId.get(p.father_id) : null;
          const blocked = living && p.status === 'dead';   // متوفّى وحقولٌ لا تخصّه ⇒ غير قابل للاختيار
          return `<label class="bk-item${blocked ? ' bk-blocked' : ''}"><input type="checkbox" class="bk-pick" value="${p.id}" ${blocked ? 'disabled' : 'checked'}>
            <span class="bk-item-name">${esc(p.name)}${blocked ? ' <span class="bk-dead-tag">متوفّى — لا يلزم</span>' : ''}</span>
            <span class="bk-item-sub">${f ? 'بن ' + esc(f.name) + ' • ' : ''}جيل ${p.generation}${p.work ? ' • ' + arOf(WORK, p.work) : ''}</span></label>`;
        }).join('') + (list.length > 1000 ? '<div class="muted" style="padding:6px">… عُرض أول ١٠٠٠</div>' : '')
      : '<div class="muted" style="padding:6px">لا أفراد مطابقون.</div>';
    updateApplyCount();
  };
  const updateApplyCount = () => {
    const n = view().querySelectorAll('.bk-pick:checked').length;
    const btn = document.getElementById('bk_apply');
    if (btn) btn.textContent = `✏️ تطبيق على المحدّدين (${n})`;
  };
  document.getElementById('bk_gen').addEventListener('change', refresh);
  // عند اختيار الجدّ: املأ قائمة الأجيال الموجودة في ذريّته فقط
  const fillBulkGens = () => {
    const sel = document.getElementById('bk_gen');
    if (!bulkAncestor) { sel.innerHTML = '<option value="">— اختر الجدّ أولاً —</option>'; sel.disabled = true; return; }
    const desc = descendants(bulkAncestor.id);
    const gensSet = [...new Set(desc.map(p => p.generation))].sort((a, b) => a - b);
    sel.disabled = false;
    sel.innerHTML = '<option value="">— كل ذرية الجدّ —</option>' + gensSet.map(g => `<option value="${g}">الجيل ${g}${g === bulkAncestor.generation + 1 ? ' (أبناؤه المباشرون)' : ''}</option>`).join('');
    sel.value = '';
  };
  document.getElementById('bk_pickAnc').addEventListener('click', () => pickAncestorModal((fp) => { bulkAncestor = fp; const el = document.getElementById('bk_ancLabel'); el.textContent = fp ? '👤 ' + fp.name + ' (جيل ' + fp.generation + ')' : '— اختر الجدّ —'; el.classList.toggle('empty', !fp); fillBulkGens(); refresh(); }));
  document.getElementById('bk_clrAnc').addEventListener('click', () => { bulkAncestor = null; const el = document.getElementById('bk_ancLabel'); el.textContent = '— اختر الجدّ —'; el.classList.add('empty'); fillBulkGens(); refresh(); });
  view().querySelectorAll('input[data-bf]').forEach(cb => cb.addEventListener('change', () => { const box = document.getElementById('bkv_' + cb.dataset.bf); if (box) box.style.display = cb.checked ? '' : 'none'; refresh(); }));
  document.getElementById('bk_all').addEventListener('click', () => { view().querySelectorAll('.bk-pick:not(:disabled)').forEach(c => c.checked = true); updateApplyCount(); });
  document.getElementById('bk_none').addEventListener('click', () => { view().querySelectorAll('.bk-pick').forEach(c => c.checked = false); updateApplyCount(); });
  view().addEventListener('change', (e) => { if (e.target.classList && e.target.classList.contains('bk-pick')) updateApplyCount(); });
  document.getElementById('bk_apply').addEventListener('click', applyBulkEdit);
  // إن كان جدٌّ مختاراً مسبقاً (مثلاً بعد تنفيذ إجراء والبقاء للإجراء التالي) استعد عرضه
  if (bulkAncestor) {
    const el = document.getElementById('bk_ancLabel');
    el.textContent = '👤 ' + bulkAncestor.name + ' (جيل ' + bulkAncestor.generation + ')';
    el.classList.remove('empty');
    fillBulkGens();
  }
  refresh();
}
// نافذة اختيار جدّ هرمية: المدير يبدأ من الأصول (فراج/مفرج)، ومشرف الفرع من فرعه
// (الجيل الثاني). تتنقّل بالضغط على الاسم للدخول لأبنائه، مع زر «اختيار» لكل اسم.
// اختيار الجدّ: يستخدم المنتقي الموحّد (بحث + تصفّح هرمي). يفتح عند الاختيار الحالي،
// ويقيّد المسؤول على ذرية فروعه فقط (للمدير: كل الأصول).
function pickAncestorModal(onPick, startAt) {
  const scope = (!isAdmin() && isManager()) ? (p => inMyBranch(p)) : null;
  pickPerson('اختيار الجدّ', onPick, scope, startAt);
}
// الأفراد المطابقون للنطاق المحدّد (يلزم اختيار جدّ أولاً)
function bulkMatch() {
  if (!bulkAncestor) return [];   // لا نطاق قبل اختيار الجدّ
  const gen = val('bk_gen');
  // ذرية الجدّ فقط (لا الجدّ نفسه)
  let pool = descendants(bulkAncestor.id);
  if (!isAdmin() && isManager()) pool = pool.filter(p => inMyBranch(p));
  if (gen) pool = pool.filter(p => String(p.generation) === gen);   // الجيل المختار فقط
  return pool;
}
async function applyBulkEdit() {
  if (!isAdmin() && !isManager()) return;
  // اجمع الحقول المؤشّرة وقيمها
  const patch = {};
  const labels = [];
  view().querySelectorAll('input[data-bf]:checked').forEach(cb => {
    const f = cb.dataset.bf;
    if (f === 'status') { patch.status = val('bk_status'); labels.push('الحالة'); }
    else if (f === 'work') { patch.work = val('bk_work'); labels.push('الحالة الوظيفية'); }
    else if (f === 'birth') { patch.birth = val('bk_birth').trim(); labels.push('سنة الميلاد'); }
    else if (f === 'city') { patch.city = val('bk_city').trim(); labels.push('المدينة'); }
    else if (f === 'phone') { patch.phone = val('bk_phone').trim(); labels.push('الجوال'); }
  });
  if (!labels.length) { toast('اختر حقلاً واحداً على الأقل'); return; }
  // فقط الأفراد المؤشَّرون في القائمة
  let ids = [...view().querySelectorAll('.bk-pick:checked')].map(c => parseInt(c.value, 10));
  // حماية: عند تعديل حقول لا تخصّ المتوفّى (بلا الحالة) نستبعد المتوفّين نهائياً
  const fieldsSel = [...view().querySelectorAll('input[data-bf]:checked')].map(c => c.dataset.bf);
  if (fieldsSel.length && !fieldsSel.includes('status')) {
    ids = ids.filter(id => { const p = byId.get(id); return p && p.status !== 'dead'; });
  }
  if (!ids.length) { toast('لم تحدّد أي اسم'); return; }
  if (!(await confirm2(`سيُعدَّل «${labels.join('، ')}» لعدد ${ids.length} فرد محدّد. يُسجَّل في سجل التعديلات. متابعة؟`, { title: 'تأكيد التعديل الجماعي', okText: 'تطبيق', danger: false }))) return;
  const typed = await uiPrompt('للتأكيد اكتب كلمة: تعديل', { title: 'تأكيد نهائي', placeholder: 'تعديل', okText: 'تطبيق' });
  if ((typed || '').trim() !== 'تعديل') { toast('أُلغي التعديل'); return; }
  const who = (me && (me.full_name || me.username)) || '';
  // التقط القيم السابقة لكل فرد (للأعمدة المعدَّلة) لإتاحة التراجع بعد التنفيذ
  const editedCols = Object.keys(patch);
  const snapshots = ids.map(id => {
    const p = byId.get(id) || {};
    const prev = {};
    editedCols.forEach(col => { prev[col] = (col === 'status') ? (p.status || 'alive') : (p[col] ?? null); });
    prev.updated_by_name = p.updated_by_name ?? null;
    prev.updated_at = p.updated_at ?? null;
    return { id, prev };
  });
  patch.updated_by_name = who; patch.updated_at = new Date().toISOString();
  showLoading(true);
  let okCount = 0;
  let auditId = null;
  const ok = await guard(async () => {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await sb.from('almfrje_persons').update(patch).in('id', chunk);
      if (error) throw error;
      okCount += chunk.length;
      document.getElementById('bk_apply').textContent = `… ${okCount}/${ids.length}`;
    }
    auditId = await auditLog('edit', null, `تعديل جماعي (${labels.join('، ')}) لـ ${ids.length} فرد`,
      { kind: 'persons', items: snapshots, label: labels.join('، ') });
  });
  showLoading(false);
  if (ok) {
    await loadAll();
    // ابقَ في شاشة التعديل الجماعي لتنفيذ إجراء آخر، مع إتاحة التراجع
    screenBulkEdit();
    showUndoToast(`تم تعديل ${okCount} فرد — يمكنك تنفيذ إجراء آخر`, () => undoBulk(snapshots, labels, auditId));
  }
  else { document.getElementById('bk_apply').textContent = '✏️ تطبيق التعديل الجماعي'; }
}
// التراجع الفوري عن آخر تعديل جماعي (من زر التنبيه).
async function undoBulk(snapshots, labels, auditId) {
  if (!snapshots || !snapshots.length) return;
  showLoading(true);
  const ok = await guard(async () => {
    await restorePersons(snapshots);
    await markAuditUndone(auditId);
    await auditLog('edit', null, `تراجع عن تعديل جماعي (${(labels || []).join('، ')}) لـ ${snapshots.length} فرد`);
  });
  showLoading(false);
  if (ok) { toast('تم التراجع عن التعديل'); await loadAll(); if (location.hash.includes('/bulk')) screenBulkEdit(); else render(); }
}
// التراجع من سجل التعديلات (متاح في أي وقت لاحق ما دامت بيانات التراجع محفوظة).
async function undoFromAudit(row) {
  const ud = row && row.undo_data;
  if (!ud || !ud.items || !ud.items.length) { toast('لا تتوفّر بيانات تراجع لهذا السطر'); return; }
  if (!(await confirm2(`⚠️ تنبيه: سيُعاد ${ud.items.length} فرد إلى قيمهم قبل هذا التعديل، وتُلغى التغييرات الحالية.\n\nالمتابعة بالتراجع؟`, { title: '↩ تأكيد التراجع', okText: 'نعم، تراجع', danger: true }))) return;
  if (!(await confirm2('تأكيد نهائي للتراجع — لا يمكن إلغاؤه إلا بتعديل يدوي. متابعة؟', { title: 'تأكيد نهائي', okText: 'تراجع الآن', danger: true }))) return;
  showLoading(true);
  const ok = await guard(async () => {
    await restorePersons(ud.items);
    await markAuditUndone(row.id);
    await auditLog('edit', row.person_id || null, `تراجع عن: ${row.person_name || (ud.label || '')}`);
  });
  showLoading(false);
  if (ok) { toast('تم التراجع'); await loadAll(); screenAudit(); }
}

/* ===== قائمة تعديل/مراجعة بيانات الأفراد (لكل فرد على حدة) — الأحياء فقط ===== */
let gridAncestor = null;   // الجدّ المختار لحصر النطاق في قائمة التعديل/المراجعة
let gridReviewStatus = 'alive';   // مرشّح المراجعة: alive | dead | all
let gridReviewDetail = 'brief';   // تفصيل المراجعة: brief (الاسم متسلسلاً + الحالة) | full (كل البيانات)
// الحقول القابلة للتعديل بالقائمة (بيانات لا بنية — لا الاسم ولا الأب)
const GRID_FIELDS = [
  { k: 'status', ar: 'الحالة', type: 'select', opts: STATUS },
  { k: 'work', ar: 'الحالة الوظيفية', type: 'select', opts: WORK },
  { k: 'nickname', ar: 'اللقب', type: 'text', ph: 'اختياري' },
  { k: 'birth', ar: 'سنة الميلاد', type: 'text', ph: 'مثال: 1440هـ' },
  { k: 'birthplace', ar: 'مكان الميلاد', type: 'text', ph: 'اختياري' },
  { k: 'city', ar: 'المدينة', type: 'text', ph: 'اختياري' },
  { k: 'phone', ar: 'الجوال', type: 'tel', ph: 'اختياري' },
  { k: 'death', ar: 'سنة الوفاة', type: 'text', ph: 'إن وُجدت' },
];
// هل عمود تتبّع الحقول متاح في القاعدة؟ (يُحمَّل تلقائياً مع select('*') إن وُجد)
const fieldAuditOn = () => !!(C.persons.length && C.persons[0].field_audit !== undefined);
// نصّ «آخر من عدّل» لحقل بعينه: من تتبّع الحقول إن وُجد، وإلا من تتبّع السجل العام.
function fieldEditorNote(p, k) {
  const fa = (p.field_audit && typeof p.field_audit === 'object') ? p.field_audit[k] : null;
  if (fa && fa.by) return esc(fa.by) + (fa.at ? ' • ' + fmtDate(fa.at) : '');
  if (p.updated_by_name) return esc(p.updated_by_name) + (p.updated_at ? ' • ' + fmtDate(p.updated_at) : '');
  return '';
}
function gridPool(statusFilter) {
  if (!gridAncestor) return [];
  let pool = descendants(gridAncestor.id);
  if (statusFilter === 'dead') pool = pool.filter(p => p.status === 'dead');         // المتوفّون فقط
  else if (statusFilter !== 'all') pool = pool.filter(p => p.status !== 'dead');     // الأحياء (الافتراضي)
  if (!isAdmin() && isManager()) pool = pool.filter(p => inMyBranch(p));            // مشرف الفرع: نطاقه
  pool.sort((a, b) => (a.generation - b.generation) || (a.sort - b.sort) || (a.id - b.id));
  return pool;
}
function gridCard(p, fields, review) {
  const sub = `${esc(ancestryShort(p.id, 3))} • جيل ${p.generation}`;
  // لا نعرض «من قام بالتعديل» هنا — يبقى محفوظاً في سجل التعديلات فقط (يُرجع إليه عند الخلاف).
  const rows = fields.map(k => {
    const f = GRID_FIELDS.find(x => x.k === k);
    const v = f.type === 'select' ? arOf(f.opts, p[k]) : (p[k] ? esc(p[k]) : '—');
    return `<div class="grid-rev"><span class="grid-rev-l">${f.ar}</span><span class="grid-rev-v">${v}</span></div>`;
  }).join('');
  return `<div class="grid-card"><div class="grid-head"><b>${esc(p.name)}</b> <span class="muted">${sub}</span></div>${rows}</div>`;
}
// صفّ تعديل: الاسم ثم حقوله بجانبه (تخطيط جدولي — الاسم يمين والحقول تليه).
function gridRow(p, fields) {
  const cells = fields.map(k => {
    const f = GRID_FIELDS.find(x => x.k === k);
    const cur = p[k] == null ? (k === 'status' ? 'alive' : '') : String(p[k]);
    const ctrl = f.type === 'select'
      ? `<select data-gfld="${k}">${f.opts.map(o => `<option value="${o.k}" ${cur === o.k ? 'selected' : ''}>${o.ar}</option>`).join('')}</select>`
      : `<input type="${f.type === 'tel' ? 'tel' : 'text'}" ${f.type === 'tel' ? 'inputmode="tel"' : ''} data-gfld="${k}" value="${esc(cur)}" placeholder="${esc(f.ar)}">`;
    return `<div class="grid-tc">${ctrl}</div>`;
  }).join('');
  return `<div class="grid-trow" data-grow="${p.id}"><div class="grid-tc grid-tc-name"><b>${esc(p.name)}</b><span class="muted">${esc(ancestryShort(p.id, 2))}</span></div>${cells}</div>`;
}
function screenGridEdit() { screenGrid('edit'); }
function screenGridReview() { screenGrid('review'); }
function screenGrid(mode) {
  const review = mode === 'review';
  if (!review && !isAdmin() && !isManager()) { view().innerHTML = noPerm(); return; }
  if (review && (!me || isGuestUser())) { view().innerHTML = noPerm(); return; }
  const scopeNote = (!review && isManager() && !isAdmin())
    ? `<div class="add-ctx" style="margin-bottom:10px"><div class="add-ctx-ico">🔒</div><div><div class="add-ctx-title">ضمن صلاحيتك فقط</div><div class="add-ctx-sub">يشمل التعديل فرعك المصرّح به: <b>${esc(myBranches().map(b => branchName(b)).join('، ') || '—')}</b></div></div></div>`
    : '';
  const faNote = (!review && !fieldAuditOn())
    ? `<div class="muted" style="font-size:.8rem;margin:-4px 0 8px">ملاحظة: تتبّع «من عدّل كل حقل» يحتاج ترقية القاعدة؛ حتى ذلك الحين يُسجَّل آخر من عدّل الفرد.</div>` : '';
  view().innerHTML = `
    ${scopeNote}
    <div class="card"><h3>① اختر الجدّ</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">يُعرض <b>الأحياء</b> من ذرّيته فقط${review ? ' — للمراجعة دون تعديل.' : ' لتعديل بياناتهم.'}</p>
      <div class="field"><label>الجدّ</label>
        <div class="father-pick">
          <div id="g_ancLabel" class="father-name empty" style="cursor:pointer" title="اضغط لتغيير الجدّ">— اختر الجدّ —</div>
          <div class="btn-row"><button class="btn sm" id="g_pickAnc" style="margin:0">🔍 ${gridAncestor ? 'تغيير الجدّ' : 'اختيار الجدّ'}</button><button class="btn sm outline" id="g_clrAnc" style="margin:0">إلغاء</button></div>
        </div>
      </div>
    </div>
    ${review ? '' : `<div class="card"><h3>② اختر الحقول المراد تعديلها</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">تظهر الحقول المختارة فقط في القائمة لتعديل كل فرد على حدة.</p>
      ${faNote}
      <div class="grid-fields">${GRID_FIELDS.map(f => `<label class="perm-chk"><input type="checkbox" data-gf="${f.k}"><span>${f.ar}</span></label>`).join('')}</div></div>`}
    <div class="card"><h3>${review ? '② البيانات' : '③ عدّل ثم احفظ'}</h3>
      ${review ? `<div class="seg" id="g_status">
        <button class="seg-b${gridReviewStatus === 'alive' ? ' on' : ''}" data-st="alive">الأحياء</button>
        <button class="seg-b${gridReviewStatus === 'dead' ? ' on' : ''}" data-st="dead">المتوفّون</button>
        <button class="seg-b${gridReviewStatus === 'all' ? ' on' : ''}" data-st="all">الكل</button>
      </div>
      <div class="seg" id="g_detail">
        <button class="seg-b${gridReviewDetail === 'brief' ? ' on' : ''}" data-dt="brief">قائمة مختصرة</button>
        <button class="seg-b${gridReviewDetail === 'full' ? ' on' : ''}" data-dt="full">قائمة مفصّلة</button>
      </div>` : ''}
      <div id="g_count" class="search-count"></div>
      <div id="g_list" class="grid-list"></div>
      ${review ? '' : `<button class="btn btn-lg" id="g_save" style="margin-top:12px" disabled>💾 حفظ التعديلات</button>`}
    </div>`;
  const selFields = () => review
    ? (gridReviewDetail === 'full' ? GRID_FIELDS.map(f => f.k) : ['status'])   // مختصرة: الحالة فقط (مع الاسم متسلسلاً)
    : [...view().querySelectorAll('input[data-gf]:checked')].map(c => c.dataset.gf);
  const renderList = () => {
    const cnt = document.getElementById('g_count');
    const box = document.getElementById('g_list');
    const sv = document.getElementById('g_save');
    if (!gridAncestor) { cnt.textContent = 'اختر الجدّ أولاً لعرض القائمة'; box.innerHTML = ''; if (sv) sv.disabled = true; return; }
    const fields = selFields();
    if (!review && !fields.length) { cnt.textContent = 'اختر حقلاً واحداً على الأقل'; box.innerHTML = ''; if (sv) sv.disabled = true; return; }
    const pool = gridPool(review ? gridReviewStatus : 'alive');   // التعديل: الأحياء فقط؛ المراجعة: حسب المرشّح
    const lbl = !review ? 'الأحياء' : (gridReviewStatus === 'dead' ? 'المتوفّون' : gridReviewStatus === 'all' ? 'الكل' : 'الأحياء');
    cnt.innerHTML = `${lbl} في ذرّية «${esc(gridAncestor.name)}»: <b>${pool.length}</b>`;
    if (!pool.length) { box.innerHTML = '<div class="muted" style="padding:8px">لا نتائج ضمن نطاقك في ذرّية هذا الجدّ.</div>'; if (sv) sv.disabled = true; return; }
    if (review) {
      box.innerHTML = pool.map(p => gridCard(p, fields, true)).join('');
    } else {
      // جدول: الاسم يمين وحقوله بجانبه، مع صفّ عناوين للحقول.
      const head = `<div class="grid-trow grid-thead"><div class="grid-tc grid-tc-name">الاسم</div>${fields.map(k => `<div class="grid-tc">${GRID_FIELDS.find(x => x.k === k).ar}</div>`).join('')}</div>`;
      box.innerHTML = `<div class="grid-table" style="--cols:${fields.length}">${head}${pool.map(p => gridRow(p, fields)).join('')}</div>`;
    }
    if (sv) sv.disabled = !pool.length;
  };
  const setAnc = (fp) => {
    gridAncestor = fp;
    const el = document.getElementById('g_ancLabel');
    el.innerHTML = fp ? `👤 <b>${esc(fp.name)}</b> <span class="muted" style="font-weight:400">(جيل ${fp.generation})</span>` : '— اختر الجدّ —';
    el.classList.toggle('empty', !fp);
    const pb = document.getElementById('g_pickAnc'); if (pb) pb.textContent = '🔍 ' + (fp ? 'تغيير الجدّ' : 'اختيار الجدّ');
    renderList();
  };
  const openPick = () => pickAncestorModal(setAnc, gridAncestor);   // يفتح عند الجدّ الحالي (تغيير دون بدء من جديد)
  document.getElementById('g_pickAnc').addEventListener('click', openPick);
  document.getElementById('g_ancLabel').addEventListener('click', openPick);   // الضغط على الاسم يغيّره مباشرة
  document.getElementById('g_clrAnc').addEventListener('click', () => setAnc(null));
  if (review) view().querySelectorAll('#g_status .seg-b').forEach(b => b.addEventListener('click', () => {
    gridReviewStatus = b.dataset.st;
    view().querySelectorAll('#g_status .seg-b').forEach(x => x.classList.toggle('on', x === b));
    renderList();
  }));
  if (review) view().querySelectorAll('#g_detail .seg-b').forEach(b => b.addEventListener('click', () => {
    gridReviewDetail = b.dataset.dt;
    view().querySelectorAll('#g_detail .seg-b').forEach(x => x.classList.toggle('on', x === b));
    renderList();
  }));
  if (!review) view().querySelectorAll('input[data-gf]').forEach(cb => cb.addEventListener('change', renderList));
  if (!review) document.getElementById('g_save').addEventListener('click', () => gridSave(selFields()));
  if (gridAncestor) { const el = document.getElementById('g_ancLabel'); el.innerHTML = `👤 <b>${esc(gridAncestor.name)}</b> <span class="muted" style="font-weight:400">(جيل ${gridAncestor.generation})</span>`; el.classList.remove('empty'); }
  renderList();
}
async function gridSave(fields) {
  if (!isAdmin() && !isManager()) return;
  if (!fields.length) { toast('اختر حقلاً أولاً'); return; }
  const who = (me && (me.full_name || me.username)) || '';
  const nowIso = new Date().toISOString();
  const useFA = fieldAuditOn();
  const changes = [];
  view().querySelectorAll('[data-grow]').forEach(row => {
    const id = parseInt(row.dataset.grow, 10);
    const p = byId.get(id); if (!p) return;
    if (!isAdmin() && !inMyBranch(p)) return;   // حماية إضافية
    const patch = {};
    fields.forEach(k => {
      const el = row.querySelector(`[data-gfld="${k}"]`); if (!el) return;
      const v = (el.value || '').trim();
      const cur = (p[k] == null ? (k === 'status' ? 'alive' : '') : String(p[k]));
      if (v !== cur) patch[k] = v;
    });
    if (Object.keys(patch).length) changes.push({ id, patch, p });
  });
  if (!changes.length) { toast('لا توجد تغييرات لحفظها'); return; }
  const totalFields = changes.reduce((n, c) => n + Object.keys(c.patch).length, 0);
  if (!(await confirm2(`سيُحفظ ${totalFields} تعديل على ${changes.length} فرد، ويُسجَّل من قام بالتعديل. متابعة؟`, { title: 'تأكيد حفظ التعديلات', okText: 'حفظ', danger: false }))) return;
  const snapshots = [];
  showLoading(true);
  let okCount = 0;
  let auditId = null;
  const ok = await guard(async () => {
    for (const c of changes) {
      const prev = {};
      Object.keys(c.patch).forEach(k => prev[k] = c.p[k] ?? null);
      prev.updated_by_name = c.p.updated_by_name ?? null; prev.updated_at = c.p.updated_at ?? null;
      const upd = { ...c.patch, updated_by_name: who, updated_at: nowIso };
      if (useFA) {
        const fa = (c.p.field_audit && typeof c.p.field_audit === 'object') ? { ...c.p.field_audit } : {};
        Object.keys(c.patch).forEach(k => { fa[k] = { by: who, at: nowIso }; });
        upd.field_audit = fa; prev.field_audit = c.p.field_audit ?? null;
      }
      const { error } = await sb.from('almfrje_persons').update(upd).eq('id', c.id);
      if (error) throw error;
      snapshots.push({ id: c.id, prev });
      okCount++;
    }
    auditId = await auditLog('edit', null, `تعديل بالقائمة لـ ${changes.length} فرد (${totalFields} حقل)`, { kind: 'persons', items: snapshots, label: 'تعديل بالقائمة' });
  });
  showLoading(false);
  if (ok) {
    await loadAll();
    screenGrid('edit');
    showUndoToast(`تم حفظ ${okCount} فرد`, () => undoBulk(snapshots, ['تعديل بالقائمة'], auditId));
  }
}

/* ===== تعديل نصوص التعليمات (i) — للمدير ===== */
function screenHints() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const keys = Object.keys(HINTS_DEFAULT);
  view().innerHTML = adminTabBar('hints') + `
    <div class="muted" style="margin-bottom:8px">عدّل نصوص أزرار التعليمات (i) التي تظهر للمستخدمين. اضغط «حفظ» تحت كل نص. «استرجاع» يعيد النص الأصلي.</div>
    ${keys.map(k => `
      <div class="card">
        <div class="li-title" style="font-size:.95rem">${esc(HINTS[k][0])} <span class="muted" style="font-weight:normal;font-size:.75rem">(${k})</span></div>
        <div class="field" style="margin-top:6px"><textarea id="ht_${k}" rows="3">${esc(HINTS[k][1])}</textarea></div>
        <div class="btn-row">
          <button class="btn sm" data-htsave="${k}">حفظ</button>
          <button class="btn sm outline" data-htreset="${k}">استرجاع الأصلي</button>
        </div>
      </div>`).join('')}`;
  view().querySelectorAll('[data-htsave]').forEach(b => b.addEventListener('click', () => saveHint(b.dataset.htsave)));
  view().querySelectorAll('[data-htreset]').forEach(b => b.addEventListener('click', () => resetHint(b.dataset.htreset)));
}
// يقرأ تعديلات التعليمات الحالية من القاعدة (للدمج عند الحفظ)
async function loadHintOverrides() {
  try { const { data } = await sb.from('almfrje_settings').select('value').eq('key', 'hints_overrides').maybeSingle(); return (data && data.value && typeof data.value === 'object') ? data.value : {}; }
  catch (e) { return {}; }
}
async function saveHint(key) {
  const txt = (document.getElementById('ht_' + key) || {}).value || '';
  const ok = await guard(async () => {
    const ov = await loadHintOverrides();
    if (txt.trim() === (HINTS_DEFAULT[key] ? HINTS_DEFAULT[key][1] : '')) delete ov[key];   // لا تخزّن إن كان مطابقاً للأصل
    else ov[key] = txt;
    const { error } = await sb.from('almfrje_settings').upsert({ key: 'hints_overrides', value: ov, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    if (HINTS[key]) HINTS[key][1] = txt;
  });
  if (ok) toast('تم حفظ التعليمة');
}
async function resetHint(key) {
  const def = HINTS_DEFAULT[key] ? HINTS_DEFAULT[key][1] : '';
  const ok = await guard(async () => {
    const ov = await loadHintOverrides(); delete ov[key];
    const { error } = await sb.from('almfrje_settings').upsert({ key: 'hints_overrides', value: ov, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    if (HINTS[key]) HINTS[key][1] = def;
  });
  if (ok) { toast('أُعيد النص الأصلي'); const ta = document.getElementById('ht_' + key); if (ta) ta.value = def; }
}

/* ===== الصفحة التعريفية (قبيلة المفرجي) ===== */
// منقٍّ بسيط لِـ HTML المُحرَّر من المدير: يسمح بوسوم التنسيق ويزيل النصوص البرمجية
// والسمات الخطرة (on*، javascript:) لتفادي أي حقن.
function sanitizeHtml(html) {
  const ALLOWED = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'img', 'font', 'center', 'small']);
  const ATTR = new Set(['style', 'href', 'src', 'color', 'size', 'face', 'align', 'target', 'rel', 'alt', 'title', 'class']);
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  const clean = (node) => {
    [...node.children].forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED.has(tag)) { el.replaceWith(...el.childNodes); return; }
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value || '';
        if (!ATTR.has(n) || n.startsWith('on')) { el.removeAttribute(a.name); return; }
        if ((n === 'href' || n === 'src') && /^\s*(javascript|data):/i.test(v) && !/^data:image\//i.test(v)) el.removeAttribute(a.name);
        if (n === 'style' && /url\s*\(|expression|javascript:/i.test(v)) el.removeAttribute('style');
      });
      if (tag === 'a') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener nofollow'); }
      clean(el);
    });
  };
  clean(tpl.content);
  return tpl.innerHTML;
}
function screenAbout() {
  view().innerHTML = `
    ${isAdmin() ? `<div class="btn-row no-print" style="justify-content:flex-end"><button class="btn sm outline" data-go="#/aboutedit">✎ تعديل الصفحة</button></div>` : ''}
    <div class="about-wrap"><div class="about-card"><div class="about-body">${sanitizeHtml(aboutHtml)}</div></div></div>`;
  bindGo();
}
// قسم الوثائق — كل وثيقة: صورة (تُعرض كاملةً بالضغط) + تفريغ نصّها تحتها (يُخفى إن فُرّغ).
function screenDocuments() {
  const admin = isAdmin();
  const docs = tribeDocs || [];
  view().innerHTML = `
    ${admin ? `<div class="btn-row no-print" style="justify-content:flex-end;margin-bottom:8px"><button class="btn sm" id="doc_add">➕ إضافة وثيقة</button></div>` : ''}
    ${docs.length ? docs.map((d, i) => `
      <div class="doc-wrap"><div class="doc-3d">
        <div class="doc-eyebrow">وثيقة تاريخية</div>
        ${d.title ? `<h2 class="doc-title">${esc(d.title)}</h2>` : ''}
        <div class="doc-frame"><img class="doc-img" data-docfull="${i}" src="${esc(d.url)}" alt="${esc(d.title || 'وثيقة')}" loading="lazy"></div>
        <div class="doc-actions no-print"><button class="btn sm outline" data-docfull="${i}">🔍 عرض كامل الوثيقة</button>${admin ? `<button class="btn sm outline" data-docedit="${i}">✎ تعديل</button><button class="btn sm danger" data-docdel="${i}">🗑 حذف</button>` : ''}</div>
        ${d.text ? `<div class="doc-text">${esc(d.text)}</div>` : ''}
      </div></div>`).join('') : '<div class="center-empty">لا توجد وثائق بعد.</div>'}`;
  view().querySelectorAll('[data-docfull]').forEach(el => el.addEventListener('click', () => { const d = docs[+el.dataset.docfull]; if (d) openDocFull(d.url, d.title); }));
  if (admin) {
    const a = document.getElementById('doc_add'); if (a) a.addEventListener('click', () => docEditModal(-1));
    view().querySelectorAll('[data-docedit]').forEach(b => b.addEventListener('click', () => docEditModal(+b.dataset.docedit)));
    view().querySelectorAll('[data-docdel]').forEach(b => b.addEventListener('click', () => docDelete(+b.dataset.docdel)));
  }
}
// عرض وثيقة بالحجم الكامل داخل التطبيق (طبقة فوق الصفحة) مع سهم رجوع.
function openDocFull(url, title) {
  const root = document.getElementById('modalRoot'); if (!root || !url) return;
  root.innerHTML = `<div class="doc-full" id="docFull">
    <div class="doc-full-bar"><button class="doc-full-back" id="docFullBack">‹ رجوع</button></div>
    <img src="${esc(url)}" alt="${esc(title || 'وثيقة')}">
  </div>`;
  const close = () => { root.innerHTML = ''; };
  document.getElementById('docFullBack').addEventListener('click', close);
  document.getElementById('docFull').addEventListener('click', (e) => { if (e.target.id === 'docFull') close(); });
}
async function saveTribeDocs(arr) {
  const { error } = await sb.from('almfrje_settings').upsert({ key: 'tribe_docs', value: arr, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  tribeDocs = arr;
}
// إضافة/تعديل وثيقة (للمدير): عنوان + صورة (رفع) + تفريغ النص.
function docEditModal(idx) {
  if (!isAdmin()) return;
  const d = (idx >= 0 && tribeDocs[idx]) ? tribeDocs[idx] : { title: '', url: '', text: '' };
  openModal(idx >= 0 ? 'تعديل وثيقة' : 'إضافة وثيقة', `
    ${fInput('العنوان', 'd_title', d.title || '')}
    <div class="field"><label>صورة الوثيقة${d.url ? ' (اتركها لإبقاء الحالية)' : ''}</label><input id="d_file" type="file" accept="image/*"></div>
    ${d.url ? `<div class="muted" style="font-size:.8rem;margin:-4px 0 8px">الحالية: <a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:var(--brand)">عرض الصورة</a></div>` : ''}
    ${fTextarea('تفريغ النص (اتركه فارغاً ليُخفى تحت الوثيقة)', 'd_text', d.text || '')}
    <button class="btn" id="d_save">💾 حفظ</button>`, () => {
    document.getElementById('d_save').addEventListener('click', async () => {
      const title = val('d_title').trim();
      const text = val('d_text').trim();
      const file = document.getElementById('d_file').files[0];
      let url = d.url || '';
      if (!file && !url) { toast('أضف صورة الوثيقة'); return; }
      showLoading(true);
      const ok = await guard(async () => {
        if (file) url = await uploadFile(file, 'docs');
        const arr = tribeDocs.slice();
        const item = { title, url, text };
        if (idx >= 0) arr[idx] = item; else arr.push(item);
        await saveTribeDocs(arr);
      });
      showLoading(false);
      if (ok) { toast('تم حفظ الوثيقة'); closeModal(); screenDocuments(); }
    });
  });
}
async function docDelete(idx) {
  if (!isAdmin() || idx < 0 || !tribeDocs[idx]) return;
  if (!(await confirm2('حذف هذه الوثيقة؟', { title: 'حذف وثيقة', okText: 'حذف', danger: true }))) return;
  const arr = tribeDocs.slice(); arr.splice(idx, 1);
  const ok = await guard(async () => { await saveTribeDocs(arr); });
  if (ok) { toast('تم الحذف'); screenDocuments(); }
}

/* ===== دليل الموقع (كتيّب تعليمات مفصّل) =====
   مبني من بنية الموقع نفسه، فيتحدّث آلياً عند إضافة/تعديل أي ميزة هنا. */
const GUIDE = [
  { sec: '🚪 دخول الزائر', items: [
    { t: 'دخول الزائر بالنسب', fn: 'تمكين أبناء القبيلة من تصفّح الشجرة دون إنشاء حساب.', brief: 'يكتب الزائر اسمه ثم أباه ثم جدّه، فيُطابَق تلقائياً بالشجرة ويدخل بمجرد أن يتميّز اسمه.', det: 'يلزم ثلاثة أسماء على الأقل بالترتيب (أنت ثم أبوك ثم جدّك). يُسمح بالدخول فقط عند مطابقة شخصٍ حيٍّ واحدٍ غير مكرّر؛ المتوفّى أو من لم يعقب لا يُحتسب من الأحياء. عند النجاح يظهر ترحيب باسمك الرباعي كما هو مسجّل في القاعدة، ويُنسب دخولك لفرعك. الزائر يتصفّح ويبحث فقط (لا يضيف ولا يعدّل).' },
  ]},
  { sec: '🏠 الرئيسية', items: [
    { t: 'نص الرئيسية (البانر)', fn: 'كلمة تعريفية تظهر أعلى الصفحة للجميع.', brief: 'نصّ يحدّده المدير من التحكم ← النصوص، ويتحكّم بحجم خطّه.', det: 'يظهر في صندوقٍ عائمٍ ملوّن أعلى الرئيسية. يحدّد المدير نصّه وحجم خطّه، وإن طال النصّ يُقصَر تلقائياً مع زرّ «المزيد…» يفتح صفحة النبذة التعريفية ثلاثية الأبعاد. وبزاوية الصندوق زر ⓘ يفتح النبذة أيضاً.' },
    { t: 'رسالة الترحيب بعد الدخول', fn: 'ترحيب شخصي فور دخولك.', brief: 'تظهر مرّة في الجزء الأوسط العلوي عند الدخول.', det: 'يظهر للزائر ترحيبٌ باسمه فور مطابقته بالشجرة. تظهر مرّة واحدة لكل جلسة تصفّح ولا تتكرّر مع تحديث الصفحة، وتعود عند دخولٍ جديد.' },
    { t: 'تهنئة المناسبات (مبارَكة)', fn: 'رسالة تهنئة من الإدارة في المناسبات.', brief: 'تظهر فور الدخول وكشريط ذهبي أعلى الرئيسية.', det: 'تكتبها الإدارة بلونٍ مميّز وتُنشَر فوراً أو بموعدٍ محدّد ولمدّةٍ معيّنة (بالساعات أو الأيام). تظهر النافذة مرّة لكل جلسة، ويبقى الشريط الذهبي أعلى الرئيسية ظاهراً طوال مدّة العرض. ويمكن للإدارة اختيار عنوان الشريط: الافتراضي «🎊 تهنئة من الإدارة»، أو عنوان مخصّص تكتبه، أو بدون عنوان.' },
    { t: 'الإحصائيات (المربّعات الأربعة)', fn: 'أرقام سريعة عن الشجرة.', brief: 'إجمالي الأفراد، الفروع، الأجيال، الزوّار — وتحتها زر «📈 التقرير الإحصائي الكامل».', det: 'إجمالي الأفراد = كل الأسماء المسجّلة في الشجرة. الفروع = الفروع القائمة فقط (التي أنجب مؤسّسها). الأجيال = أطول سلسلة نسبٍ من الجذر إلى الأحدث. الزوّار = إجمالي كل من دخل الموقع (زائر/مشرف/مدير). وللتفصيل الكامل يفتح الزر أسفلها «التقرير الإحصائي الكامل» (انظر قسم الإحصائيات والتقارير).' },
    { t: 'المتواجدون الآن', fn: 'معرفة من يتصفّح الموقع حالياً.', brief: 'عدد المتواجدين الآن، وأمام كل فرع عدد متواجديه بخط صغير.', det: 'يُحتسب النشِطون خلال آخر ثلاث دقائق، ويُنسب كلٌّ لفرعه. يتحدّث تلقائياً.' },
    { t: 'بطاقة «ملاحظتك تهمنا»', fn: 'قناة تواصل لتصحيح الأخطاء أو طلب إضافة مولود.', brief: 'بطاقة بالرئيسية فيها زر «أرسل ملاحظة للإدارة» — عنوانها ونصّها يحدّدهما المدير من التحكم ← النصوص.', det: 'الملاحظات تظهر للمدير، وللمشرف ما يخصّ فرعه (مع شارة رقمية على تبويب «المزيد» عند وجود طلبات معلّقة ضمن صلاحياته).' },
    { t: 'آخر الإضافات', fn: 'عرض أحدث الأسماء المُضافة.', brief: 'قائمة بأحدث المضافين، الضغط على الاسم يعرض أباه وجدّه وتاريخ إضافته.', det: 'المدير يظهرها أو يخفيها عن الجميع بزرٍّ أعلى البطاقة (تبقى ظاهرة له مع ملاحظة). ويصفّرها من التحكم ← النصوص ← إحصائيات الزيارات دون حذف بيانات.' },
    { t: 'قائمة الفروع', fn: 'تصفّح الفروع وأعدادها.', brief: 'الفروع مجمّعة تحت أصولها مع عدد أفراد كل فرع.', det: 'تُعرض الفروع القائمة فقط؛ الضغط على فرع يفتح صفحته.' },
  ]},
  { sec: '🔍 البحث', items: [
    { t: 'البحث الفوري', fn: 'الوصول السريع لأي شخص.', brief: 'اكتب اسماً في الأعلى فتظهر النتائج فوراً.', det: 'يتجاهل التشكيل و«ال» التعريف. ويمكن البحث بالتسلسل: «محمد سالم» يعرض محمداً الذي أبوه سالم بالترتيب.' },
    { t: 'البحث المتقدّم', fn: 'تضييق النتائج بدقّة.', brief: 'حقول: الاسم، الأب، الجد، الفرع، الجيل، المدينة، الحالة.', det: 'كل الحقول اختيارية؛ المطابقة بالترتيب النَّسَبي (الاسم ثم الأب ثم الجد) دون تخطّي الأجيال.' },
  ]},
  { sec: '🌳 العرض والتصفّح', items: [
    { t: 'الشجرة التفاعلية', fn: 'تصفّح الأنساب هرمياً.', brief: 'اضغط «+» لفتح أبناء أي شخص و«−» لطيّهم.', det: 'الضغط على الاسم يفتح «العدسة السريعة» (بطاقة فيها أدوات الشخص + «فتح الملف الكامل»). وتظهر دلالة ألوان الحالة أسفل الشاشة.' },
    { t: 'العرض الهرمي العام', fn: 'عرض منظّم للشجرة بالبطاقات.', brief: 'بطاقات متدرّجة بالألوان حسب الجيل.', det: '«توسيع الكل» يفتح كل الفروع، و«طباعة/PDF» يصدّر الشجرة كاملة.' },
    { t: 'نموذج الأعمدة', fn: 'عرض الشجرة بأعمدة (كل جيل في عمود).', brief: 'نفس شكل ملف Excel ومناسب للطباعة.', det: 'خطوط واضحة وخطّ غامق للأسماء.' },
    { t: 'فهرس ذرية شخص', fn: 'قائمة مرقّمة بكل ذرية شخص بنظام أنساب هرمي.', brief: 'اختر أصلاً أو أي شخص فيُعرض فهرس ذرّيته مرقّماً.', det: 'الرقم يُقرأ من اليسار لليمين كسلسلة نسبٍ نزولاً، وآخر رقم هو ترتيب الشخص بين إخوته (مثال: 1‑2‑1‑3). الصفوف الملوّنة آباء لهم ذرية. ويُصدَّر Excel/PDF/نص مرقّم.' },
    { t: 'دلالة ألوان الأسماء', fn: 'فهم لون كل اسم في المشجرات.', brief: 'تظهر أسفل قوائم الشجرة.', det: 'اللون العادي = حي، الرمادي = متوفّى وله ذرية، الأحمر الداكن = متوفّى ولم يعقب. (المسميات يحدّدها المدير).' },
  ]},
  { sec: '🧭 أدوات المشجّرة', items: [
    { t: 'اختيار شخص/جدّ (بحث + تصفّح)', fn: 'الوصول لأي شخص بطريقتين في كل مواضع الاختيار.', brief: 'في أي زرّ «اختر شخصاً/الأب/المركز…».', det: 'منتقٍ موحّد: إمّا تكتب الاسم فيظهر فوراً مع سلسلة نسبه، أو تتصفّح هرمياً بالضغط على الاسم لتدخل لأبنائه جيلاً بعد جيل حتى تصل للمطلوب، مع مسار تنقّل وأزرار «⌂ القمة / ↑ للأعلى». يُستخدم في الحاسبة والشجرة والدائرية وخط الأجيال وفهرس الذرية وترتيب الأبناء واختيار الجدّ.' },
    { t: 'العدسة السريعة', fn: 'بطاقة سريعة لأي شخص دون فتح صفحته.', brief: 'تظهر عند الضغط على أي اسم في الشجرة أو العرض الهرمي.', det: 'تعرض الاسم وأباه وفرعه وحالته وعدد أبنائه وذرّيته، وفيها أزرار: مسار النسب • خريطة الذرية • أقربائي • صلة قرابته بشخص • اجعله مركز الدائرية • فتح في الشجرة • فتح الملف الكامل.' },
    { t: 'مسار النسب', fn: 'عرض نسب أي شخص حتى الأصل.', brief: 'من العدسة → «مسار النسب».', det: 'يعرض السلسلة من الشخص حتى الجذر مع تمييز الشخص وأيقونة 🌳 للأصل. زر «نسخ النسب» ينسخه بصيغة «فلان بن فلان بن فلان»، و«فتح في الشجرة»، والضغط على أي اسمٍ في المسار يعرض الشجرة منه.' },
    { t: 'خريطة الذرية', fn: 'تلخيص ذرية أي شخص بسرعة.', brief: 'من العدسة → «خريطة الذرية».', det: 'بطاقة بإحصائيات (الأبناء/الأحفاد/إجمالي الذرية/الأجيال/الأحياء/المتوفّون) وأول مستويين من الذرية، مع روابط لفهرس الذرية والعرض الكامل وطباعة مختصر الذرية.' },
    { t: 'أقربائي', fn: 'عرض الأقرباء المباشرين فقط.', brief: 'من العدسة → «أقربائي».', det: 'يعرض الأب والإخوة والأبناء والأعمام وأبناء العم كأسماء قابلة للضغط — عرضٌ مختصر مناسب للجوال.' },
    { t: 'خط الأجيال', fn: 'عرض الأفراد مقسّمين حسب الجيل.', brief: 'المزيد → «خط الأجيال».', det: 'كل جيل في قسمٍ مع عدد أفراده، مع فلترة (الفرع/الأحياء/المتوفّون/لم يعقب) وبحث، وزر «ابدأ من شخص» لعرض الأجيال تحته فقط.' },
    { t: 'الشجرة الدائرية', fn: 'عرض بصري دائري للمشجّرة.', brief: 'المزيد → «الشجرة الدائرية».', det: 'المركز في الوسط والأجيال حلقاتٌ حوله (٣ افتراضياً، حتى ٦) بتسميات شعاعية واضحة. ضغطة قصيرة على أي اسم تفتح العدسة، و«ضغطة مطوّلة تجعله المركز». ولتغيير المركز أيضاً: زر «⬆ المركز: الأب»، أو «⌖ تغيير المركز»، أو «🔆 اجعله مركز الدائرية» من العدسة. مع تكبير، وتجميع الفروع الكبيرة في «+عدد» يفتح فهرس الذرية.' },
    { t: 'حاسبة صلة القرابة', fn: 'معرفة صلة القرابة بين أيّ شخصين.', brief: 'المزيد → «حاسبة صلة القرابة»، أو من العدسة → «صلة قرابته بشخص».', det: 'اختر شخصين فيُحسب تلقائياً: الجدّ المشترك الأقرب بينهما، ونوع الصلة (أخوان، عمّ وابن أخ، ابنا عمّ بدرجاتها، أو نسب مباشر أب/جدّ)، ومسار نسب كلٍّ منهما حتى الجدّ المشترك مع إبرازه. يعتمد الحساب على سلسلة الآباء المسجّلة. أزرار: «↕️ تبديل» لقلب الترتيب، و«مسح»، و«📋 نسخ النتيجة». والضغط على أي اسمٍ يفتح العدسة السريعة. واختيار الشخص (هنا وفي كل مواضع اختيار الجدّ) يجمع طريقتين: البحث بالاسم، أو التصفّح الهرمي جيلاً بعد جيل بمسار تنقّل (القمة/للأعلى) للوصول لأي جدٍّ بسهولة.' },
    { t: 'نسخة مختصرة للطباعة', fn: 'مشجّرة نظيفة للطباعة أو PDF.', brief: 'المزيد → «نسخة مختصرة للطباعة».', det: 'اختر الفرع/الجدّ وعدد الأجيال وما يظهر (الحالة/المدينة/عدد الأبناء/الأحياء فقط)، ونمط الطباعة: «فهرس مرقّم مضغوط» (كل فرد في سطر — أقل صفحات) أو «مشجّرة متدرّجة». تُولَّد صفحة A4 نظيفة بأعمدة تلقائية تملأ الصفحة، للطباعة أو حفظ PDF.' },
    { t: 'تتبّع الفرع', fn: 'تركيز الشجرة على فرعٍ واحد.', brief: 'شاشة الفرع → «تتبّع هذا الفرع».', det: 'تركّز الشجرة على الفرع وتعرض شريطاً بـ«تتصفّح فرع: …» مع «تحديثات هذا الفرع» (عدد الأفراد والأجيال وآخر الإضافات). مشرف الفرع يبدأ على فرعه تلقائياً، والزائر يُقترح عليه «عرض فرعي فقط».' },
  ]},
  { sec: '📊 الإحصائيات والتقارير', items: [
    { t: 'التقرير الإحصائي الكامل', fn: 'لوحة أرقامٍ شاملة عن القبيلة في صفحة واحدة.', brief: 'المزيد ← 📊 الإحصائيات ← «الإحصائيات الكاملة»، أو زر «📈 التقرير الإحصائي الكامل» أسفل مربّعات الرئيسية.', det: 'يجمع كل الإحصاءات: (١) إحصاءات عامة — إجمالي الأفراد والفروع والأجيال، مع ثلاثة مربّعات ملوّنة مجسّمة: الأحياء، والمتوفّون الذين لهم ذرية، ومن لم يعقب. (٢) عدد كل جيل مفصّلاً (إجمالي الجيل • حيّ • متوفّى • لم يعقب بألوان الحالة). (٣) الفروع مرتّبة حسب العدد. (٤) أكثر الأسماء شيوعاً. (٥) التوزيع حسب المدينة. (٦) الزيارات: الإجمالي وحسب الفرع وحسب المنطقة. يتحدّث تلقائياً مع تغيّر البيانات.' },
  ]},
  { sec: 'ℹ️ نبذة تعريفية', items: [
    { t: 'صفحة قبيلة المفارجة', fn: 'تعريف بالقبيلة ونسبها وديارها.', brief: 'صفحة منسّقة تُعرض بشكل ثلاثي الأبعاد.', det: 'يحرّرها المدير بأدوات تنسيق الخطوط من التحكم ← الصفحة التعريفية، وتظهر للجميع.' },
    { t: 'قسم الوثائق', fn: 'عرض الوثائق التاريخية الأصلية للقبيلة.', brief: 'بطاقة بالرئيسية تفتح قسم الوثائق (صفحة عرضٍ ثلاثية الأبعاد).', det: 'كل وثيقة تُعرض في إطارٍ مجسّم مع «فتح بالحجم الكامل» للتكبير (وسهم رجوع)، وتحتها تفريغ نصّها إن وُجد (يُخفى إن تُرك فارغاً). أولها «📜 وثيقة لزمة ولد حسين عام ١١٧٣هـ في فارع الناصبية». يستطيع المدير إضافة وثيقة جديدة أو تعديل عنوانها/صورتها/نصّها أو حذفها.' },
  ]},
  { sec: '✉️ ملاحظات الزوار', items: [
    { t: 'إرسال ملاحظة للإدارة', fn: 'إبلاغ الإدارة بخطأ أو طلب إضافة/تصحيح/ترتيب.', brief: 'يُؤخذ اسمك الذي دخلت به تلقائياً، وتختار الموضوع: إضافة مولود • ملاحظة • اقتراح • إعادة ترتيب الإخوان.', det: 'طلب إضافة مولود يصل منظّماً فيوافق عليه المدير أو المشرف بعد تأكيدات. وطلب «إعادة ترتيب الإخوان»: تختار الأب فتظهر قائمة أبنائه ترتّبها بالسهمين ▲▼ ثم ترسلها، فتعتمدها الإدارة أو ترفضها مع ردٍّ يصلك باسمها.' },
  ]},
  { sec: '🔐 دخول الإدارة والصلاحيات', role: 'admin', items: [
    { t: 'خطوات التسجيل (للزائر)', fn: 'التسجيل مطلوبٌ للدخول على الموقع — خطوة واحدة لا تتكرر.', brief: '١) اكتب اسمك ثم آباءك حتى يتميّز فيدخل تلقائياً. ٢) تظهر نافذة «التسجيل مطلوب للدخول على الموقع». ٣) أدخل جوالك وكلمة مرورك (إجباريان — بحقلين أحمرين) واللقب/المدينة/سنة الميلاد إن شئت. ٤) اضغط «تسجيل بياناتي».', det: 'يقبل الجوال بأي صيغة (05xxxxxxxx أو 5xxxxxxxx أو +9665xxxxxxxx أو بأرقامٍ عربية ٠٥…). بعد التسجيل تظهر «شكراً لك — سوف يُفعَّل حسابك لاحقاً» بعد تحقق الإدارة من بياناتك، ثم تدخل من «المزيد ← دخول المسؤول» بجوالك وكلمة مرورك، وتجد رسائلك وردود الإدارة واضحةً في الرئيسية. وإن كان لك حسابٌ مسبقاً فستُدعى للدخول به مباشرة.' },
    { t: 'دخول المسؤول / مشرف الفرع', fn: 'دخول الإدارة لإضافة البيانات وتعديلها.', brief: 'من «المزيد ← دخول المسؤول / مشرف الفرع» بالجوال أو اسم المستخدم والرقم السري.', det: 'مدير النظام له صلاحية كاملة على كل الأقسام. مشرف الفرع يضيف ويعدّل ضمن فرعه المصرّح به فقط، ولا يرى أقسام الإدارة العامة. شاشة دخول الإدارة لا تظهر عبر رابطٍ مُرسَل أبداً — أي رابطٍ يُفتح يعرض دخول الزائر فقط.' },
    { t: 'صندوق الوارد', fn: 'كل ملاحظات وطلبات الزوار في مكانٍ واحد.', brief: 'تبويبان: 📥 ملاحظات الزوار (بانتظار الحسم) و🗂️ الأرشيف (المحسومة). وشارة عددٍ حمراء تتسلسل من تبويب «المزيد» حتى البند لتقودك إليه، وتنبيهٌ برسائل الصندوق فور دخولك.', det: 'المدير يرى الكل؛ والمشرف ما يخصّ فروعه. من البطاقة: اعتماد المولود أو الترتيب، الرد باسم الإدارة من بنك الردود، حفظ جوال المرسل في ملفه، ثم تنتقل المحسومة للأرشيف.' },
    { t: 'المناقشات (الإدارة العليا)', fn: 'غرف نقاشٍ داخلية للمدير والمشرفين العامين فقط.', brief: 'المزيد ← «💬 المناقشات»: كل موضوعٍ محادثة مستقلة بأسلوب واتساب.', det: 'أنشئ موضوعاً بعنوانٍ واضح، وتحاور فيه بفقاعات رسائل (رسائلك بلونٍ مميّز والآخرون بأسمائهم)، مع فواصل الأيام ووقت كل رسالة، ومؤشرٍ أخضر للمواضيع التي فيها جديدٌ لم تقرأه، وتحديثٍ تلقائي أثناء فتح الغرفة. حذف الموضوع كاملاً للمدير وحده.' },
    { t: 'ملفي الشخصي', fn: 'تعديل بيانات حسابك.', brief: 'الاسم والجوال وكلمة المرور، وبياناتك في الشجرة (المدينة/الجوال/سنة الميلاد).', det: 'تغيير الجوال يعني الدخول لاحقاً بالرقم الجديد؛ احفظه.' },
  ]},
  { sec: '🗂️ البيانات (للمدير ومشرف الفرع)', role: 'admin', items: [
    { t: 'إضافة مولود (مباشرة)', fn: 'إضافة فرد جديد للشجرة.', brief: 'تختار الأب وتكتب الاسم (وسنة الولادة والمدينة اختياري).', det: 'يُحدَّد الفرع تلقائياً من فرع الأب. مشرف الفرع يضيف ضمن فرعه فقط.' },
    { t: 'تعديل بيانات الشخص', fn: 'تحديث بيانات فرد.', brief: 'من ملف الشخص ← «تعديل».', det: 'تصحيح الاسم يمرّ برسالتين تأكيديتين مع كتابة كلمة «تعديل» (حمايةً لأنساب الشجرة). سنة الوفاة تظهر للمتوفّى فقط. ويمكن «ترتيب الأبناء» بالسهمين ▲▼ لكل ابن من ملف الأب (دقيق، يبقى ضمن الإخوة فقط دون تجاوز الأب)، ويُحفظ تلقائياً. الحذف لمدير النظام فقط مع حفظ نسخة في سلة المحذوفات.' },
    { t: 'تعديل جماعي', fn: 'تعديل حقلٍ واحد لمجموعة دفعة واحدة.', brief: 'اختر الجدّ والجيل ثم الحقل وقيمته وطبّق على المحدّدين.', det: 'مناسب لتوحيد قيمة (مدينة/حالة…) لعدد كبير سريعاً.' },
    { t: 'تعديل البيانات بالقائمة', fn: 'تعديل كل فرد على حدة ضمن جدٍّ واحد.', brief: 'اختر الجدّ ثم الحقول، وعدّل قيمة كل فرد ثم احفظ.', det: 'يُعرض الأحياء فقط، ويُسجَّل من قام بالتعديل (يُرجع إليه في سجل التعديلات). مشرف الفرع ضمن فرعه فقط.' },
    { t: 'مراجعة البيانات', fn: 'مراجعة دقّة البيانات دون تعديل.', brief: 'اختر الجدّ ثم راجع ذرّيته.', det: 'مرشّحات: الأحياء/المتوفّون/الكل، وقائمة مختصرة (الاسم متسلسلاً + الحالة) أو مفصّلة. تغيير الجدّ بالضغط على اسمه دون البدء من جديد.' },
    { t: 'ترتيب الأبناء', fn: 'ترتيب أبناء أبٍ واحد بالأسهم.', brief: 'المزيد ← الإدارة ← «↕️ ترتيب الأبناء»: اضغط الاسم لتدخل لأبنائه وتتدرّج حتى الأب المطلوب، ثم رتّب بالسهمين ▲▼ (أو ابحث للقفز).', det: 'الترتيب يبقى ضمن إخوته فقط ولا يتجاوز الأب، ويُحفظ تلقائياً مع تسجيله في سجل التعديلات. الشاشة شجرة تصفّح: الضغط على الاسم يدخل لأبنائه، ومسار التنقّل و«القمة/للأعلى» للرجوع. متاح أيضاً من بطاقة «الأبناء» داخل ملف الأب. للمصرّح لهم فقط (مشرف الفرع ضمن فرعه).' },
    { t: 'كشف الأسماء المكرّرة', fn: 'إظهار تكرار اسمٍ لأكثر من ابنٍ لنفس الأب.', brief: 'قائمة بالحالات المتشابهة لمراجعتها.', det: 'لا يُحتسب التكرار إن كان أحد المتشابهين متوفّى؛ فقط عند كونهما حيَّيْن.' },
  ]},
  { sec: '⚙️ لوحة التحكم (لمدير النظام)', role: 'admin', items: [
    { t: 'الأعضاء والصلاحيات', fn: 'إدارة الحسابات والأدوار والصلاحيات الدقيقة.', brief: 'إضافة/تفعيل/إيقاف الأعضاء، وتحديد أدوارهم وفروعهم وصلاحياتهم.', det: 'الأدوار: مدير النظام (كل شيء) • مشرف عام (كل الفروع أو فروعٍ تحدّدها) • مشرف فرع (فروعه المحدّدة) • زائر (تصفّح). عند إضافة عضوٍ يُختار اسمه من الشجرة بالبحث (يُطابَق باسمٍ مسجَّل، ولا بدّ أن يكون حيّاً)، ثم يُحدَّد رقم جواله ورقمه السري. وللمشرفَين تُحدَّد الفروع والصلاحيات داخلها: إضافة مولود، تأكيد إضافة مولود، تعديل ترتيب الأبناء، تعديل الملف الشخصي (الجوال/الحالة/الحالة الوظيفية/المدينة…). يطّلع المشرف على فروعه ويتّخذ الإجراء فيها بكامل المسؤولية، ويُذكَّر عند الحفظ بأنّ ما يُضيفه/يعدّله مسجَّلٌ باسمه. كل إجراء يُسجَّل باسم من قام به ووقته. أدوات إدارة الموقع للمدير وحده.' },
    { t: 'الإعدادات', fn: 'مفاتيح تشغيل الموقع مجموعةً في مكانٍ واحد.', brief: 'التحكم ← ⚙️ الإعدادات.', det: 'فتح/إغلاق الموقع للزوّار وما يُخفى عنهم والتحقّق بالاسم • إظهار/إخفاء بطاقة «آخر الإضافات» وتصفيرها • إحصائيات الزيارات (الإجمالي/حسب الفرع/حسب المنطقة) وتصفيرها.' },
    { t: 'الفروع والمشرفون', fn: 'تعريف الفروع وتعيين مشرفيها.', brief: 'عيّن أي جدٍّ كفرع وحدّد مشرفيه.', det: 'الفرع = جدّ وكل ذرّيته. كل مشرف يرى ويضيف في فرعه فقط.' },
    { t: 'النصوص', fn: 'تحرير نصوص الواجهة الظاهرة للجميع.', brief: 'عنوان الموقع وسطر «powered by» وكلمة المناسبات وتهنئة المناسبات وبطاقة الملاحظات ودعوة الزائر ورسالة الشكر وترحيب الزائر وألوان الحالة.', det: '«كلمة المناسبات» تظهر تحت عنوان شاشة الدخول بخط غامق ولونٍ تختاره. و«تهنئة/مبارَكة المناسبات» رسالةٌ من الإدارة تظهر بعد الدخول مباشرةً وكشريطٍ ذهبي أعلى الرئيسية: تختار نصّها ولون خطّها، ووقت نشرها (فوري أو بتوقيتٍ محدّد بيومٍ وساعة)، ومدّة عرضها (بالساعات أو الأيام، أو دائمة)، وعنوان شريطها (الافتراضي «🎊 تهنئة من الإدارة» أو عنوان مخصّص أو بدون عنوان)، مع تعديلها أو حذفها في أي وقت.' },
    { t: 'الصفحة التعريفية', fn: 'تحرير صفحة «نبذة تعريفية».', brief: 'محرّر نصٍّ غني بأدوات تنسيق الخطوط.', det: 'غامق/مائل/تسطير، حجم ولون الخط، المحاذاة، نقاط، عنوان، مع معاينة وحفظ واسترجاع الافتراضي.' },
    { t: 'التعليمات', fn: 'تعديل نصوص أزرار التعليمات (ⓘ).', brief: 'لكل ميزة نصّ تعليمة قابل للتعديل.', det: 'عدّل النص واحفظ، أو «استرجاع الأصلي» لإعادة النص الافتراضي.' },
    { t: 'سجل التعديلات', fn: 'سجلّ من قام بالتعديل وإمكانية التراجع.', brief: 'يحفظ آخر تعديل لكل شخص فقط.', det: 'يُرجع إليه عند الخلاف، ويمكن التراجع عن أي تعديل، وتصفير السجل بالكامل.' },
    { t: 'سلة المحذوفات', fn: 'استرجاع البيانات المحذوفة أو المعدّلة.', brief: 'تحفظ النسخ السابقة للتراجع.', det: 'يمكن استرجاع أي عنصر، أو تصفير السلة نهائياً.' },
    { t: 'النسخ والتصدير', fn: 'حفظ نسخة كاملة وتصدير البيانات والنسخ السحابية.', brief: 'نسخ في القاعدة، تنزيل ملف باسم «المفرجي_التاريخ_الوقت»، نسخ سحابية تلقائية، وتصدير Excel/CSV/PDF.', det: 'أخذ النسخة لا يؤثّر على البيانات الحالية، ويمكن الاستعادة لاحقاً (لمدير النظام فقط). وتبويب «☁️ النسخ السحابية»: تُحفظ نسخة كاملة تلقائياً يومياً في تخزينٍ سحابيّ خاص (يُحتفظ بآخر ٣٠ نسخة)، مع إنشاء نسخة فورية، وسرد النسخ، وتنزيل أو استعادة أيٍّ منها مباشرةً.' },
  ]},
  { sec: '🎨 أدوات عامة', items: [
    { t: 'قائمة «المزيد» المجمّعة', fn: 'كل الأدوات منظّمة في مجموعات قابلة للطيّ.', brief: 'تبويب «☰ المزيد» بالأسفل.', det: 'الأدوات مرتّبة في مجموعات: المشجّرات والعروض • التقارير والحاسبات • الإدارة (للمصرّح لهم) • حسابي. اضغط رأس أي مجموعة ليتوسّع/ينطوي. مجموعة «الإدارة» وما فيها من أدوات البيانات لا تظهر إلا لمن له صلاحية.' },
    { t: 'مشاركة الموقع', fn: 'إرسال رابط الموقع للآخرين بسهولة.', brief: 'زر المشاركة (أيقونة الشبكة) في أعلى الشاشة.', det: 'يفتح قائمة المشاركة في جهازك (واتساب/رسائل/تيليجرام/نسخ…)، أو ينسخ الرابط مباشرةً على الأجهزة التي لا تدعم المشاركة.' },
    { t: 'إضافة اختصار للشاشة', fn: 'تثبيت الموقع كتطبيق على الجهاز.', brief: 'زر «إضافة اختصار الموقع إلى الشاشة».', det: 'يفتح الموقع كتطبيق مستقل بوصولٍ أسرع.' },
    { t: 'زر التحديث', fn: 'جلب أحدث محتوى للموقع.', brief: 'زر 🔄 لتحديث الصفحة بالكامل.', det: 'يجلب أحدث نسخة من الموقع متجاوزاً ذاكرة المتصفّح.' },
    { t: 'دليل الزوّار (هذا الكتيّب)', fn: 'شرح مفصّل لكل ما يُعرض للزائر.', brief: 'زر 📖 في أعلى الشاشة.', det: 'يغطّي كل ما يراه الزائر (المشجرات والإحصائيات والفروع والمتواجدون…) ويتحدّث مع تطوير الموقع.' },
  ]},
];
function guideHtml(sections, eyebrow, title, sub, highlights) {
  const toc = sections.map((g, i) => `<button class="guide-toc-link" data-gsec="${i}">${g.sec}</button>`).join('');
  const hi = (highlights && highlights.length)
    ? `<div class="guide-new"><div class="guide-new-t">✨ أبرز الميزات الجديدة</div>${highlights.map(h => `<div class="guide-new-i">${esc(h)}</div>`).join('')}</div>`
    : '';
  const body = sections.map((g, i) => `
    <section class="guide-sec" data-gsecid="${i}">
      <h3 class="guide-sec-h">${g.sec}</h3>
      ${g.items.map(it => `
        <div class="guide-item">
          <div class="guide-item-t">${esc(it.t)}</div>
          <div class="guide-row"><span class="guide-lbl">الوظيفة</span><span class="guide-val">${esc(it.fn)}</span></div>
          <div class="guide-row"><span class="guide-lbl">مختصر العمل</span><span class="guide-val">${esc(it.brief)}</span></div>
          <div class="guide-row"><span class="guide-lbl">التفاصيل</span><span class="guide-val">${esc(it.det)}</span></div>
        </div>`).join('')}
    </section>`).join('');
  return `<div class="about-wrap"><div class="about-card guide-card">
      <p class="about-eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(title)}</h2>
      <hr>
      <p style="text-align:center;color:var(--muted);font-size:.9rem;margin:0 0 14px">${esc(sub)}</p>
      <div style="text-align:center;margin:0 0 14px"><button class="btn outline" data-go="#/faq">❓ الأسئلة الشائعة</button></div>
      ${hi}
      <div class="guide-toc">${toc}</div>
      ${body}
    </div></div>`;
}
function bindGuideToc() {
  view().querySelectorAll('.guide-toc-link').forEach(b => b.addEventListener('click', () => {
    const el = view().querySelector(`[data-gsecid="${b.dataset.gsec}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
function screenGuide() {
  const secs = GUIDE.filter(g => g.role !== 'admin');
  const hi = ['📤 مشاركة الموقع بضغطة من أعلى الشاشة', '🔎 اختيار أي شخص ببحثٍ أو تصفّحٍ هرمي (جيلاً بعد جيل)', '☰ قائمة «المزيد» مرتّبة في مجموعات قابلة للطيّ', '🌳 لوحة تعريفٍ عائمة وتصميمٌ عصري ثلاثي الأبعاد'];
  if (isAdmin() || isManager()) hi.push('↕️ ترتيب الأبناء بالأسهم (ضمن الأب فقط)', '🔐 صلاحيات دقيقة لكل مشرف داخل فروعه');
  if (isAdmin()) hi.push('☁️ نسخ احتياطية سحابية تلقائية واستعادة من داخل التطبيق', '🎁 تهنئة الإدارة بعنوانٍ قابل للتخصيص');
  view().innerHTML = guideHtml(secs, 'دليل الزوّار', 'دليل استخدام الموقع', 'شرح مفصّل لكل ما يُعرض للزائر في الموقع — يتحدّث مع تطوير الموقع.', hi);
  bindGuideToc();
  bindGo();
}
function screenGuideAdmin() {
  if (!me || isGuestUser()) { view().innerHTML = noPerm(); return; }
  const secs = GUIDE.filter(g => g.role === 'admin');
  view().innerHTML = guideHtml(secs, 'دليل الإدارة', 'تعليمات المدير والمشرف', 'شرح أقسام الإضافة والتعديل والمراجعة ولوحة التحكم — لأصحاب الصلاحية فقط.');
  bindGuideToc();
  bindGo();
}
/* ===== الأسئلة الشائعة (تصنيف مستقل) =====
   قسم منفصل عن دليل الميزات: سؤال/جواب سريع لأكثر ما يتكرّر.
   العناصر ذات role:'admin' تظهر لأصحاب الصلاحية فقط. */
const FAQ = [
  { q: 'كيف أدخل الموقع كزائر؟', a: 'في شاشة الدخول اكتب اسمك ثم اسم أبيك ثم جدّك (ثلاثة أسماء على الأقل بالترتيب: أنت ثم أبوك ثم جدّك)، فيُطابَق اسمك تلقائياً بالشجرة وتدخل بمجرّد أن يتميّز اسمك دون تكرار. لا حاجة لإنشاء حساب.' },
  { q: 'لماذا يظهر لي «الاسم لا يوجد» عند الدخول؟', a: 'لأن الأسماء الثلاثة بالترتيب لا تطابق شخصاً حيّاً في الشجرة. تأكّد من الترتيب (أنت ثم أبوك ثم جدّك) ومن الإملاء، وجرّب إضافة اسم الجدّ الأعلى. وإن كنت غير مُسجَّل فأرسِل ملاحظة للإدارة لإضافتك.' },
  { q: 'الاسم صحيح لكنه يقول «متوفّى» ولا يدخل؟', a: 'الدخول متاح للأحياء فقط. إن كانت حالتك مُسجَّلة «متوفّى» بالخطأ، راسِل الإدارة عبر «ملاحظتك تهمنا» لتصحيحها.' },
  { q: 'كيف أبحث عن شخص؟', a: 'اكتب اسمه في شريط البحث بأعلى الشاشة فتظهر النتائج فوراً (يتجاهل التشكيل و«ال» التعريف)، ويمكنك البحث بالتسلسل «محمد سالم». وللدقّة استخدم البحث المتقدّم (الاسم/الأب/الجد/الفرع/الجيل/المدينة/الحالة).' },
  { q: 'ماذا تعني ألوان الأسماء في الشجرة؟', a: 'اللون العادي = حيّ، والرمادي = متوفّى وله ذرية، والأحمر الداكن = متوفّى ولم يعقب. وتظهر دلالة الألوان أسفل قوائم الشجرة (والمسمّيات يحدّدها المدير).' },
  { q: 'كيف أسجّل في الموقع؟', a: 'ادخل باسمك ثم آباءك حتى يتميّز اسمك، فتظهر نافذة «التسجيل مطلوب للدخول على الموقع»: أدخل جوالك (بأي صيغة) وكلمة مرورك — إجباريان — والبقية اختيارية، ثم «تسجيل بياناتي». بعد تحقق الإدارة يُفعَّل حسابك وتدخل من «المزيد ← دخول المسؤول» بجوالك وكلمة مرورك.' },
  { q: 'كيف أطلب إضافة مولود أو تصحيح خطأ؟', a: 'من بطاقة «ملاحظتك تهمنا» في الرئيسية اضغط «أرسل ملاحظة للإدارة». طلب المولود يصل منظّماً (اسم الأب والمولود وسنة الولادة والمدينة)، فيوافق عليه المدير أو مشرف الفرع بعد رسائل تأكيدية.' },
  { q: 'كيف أعرف صلة القرابة بيني وبين شخص؟', a: 'من «المزيد ← حاسبة صلة القرابة» اختر الشخصين، فتُحسب تلقائياً الصلة والجدّ المشترك الأقرب ومسار نسب كلٍّ منهما حتى الجدّ المشترك. أو من العدسة السريعة لأي شخص اختر «صلة قرابته بشخص».' },
  { q: 'أين أجد الإحصائيات الكاملة؟', a: 'من «المزيد ← 📊 الإحصائيات ← الإحصائيات الكاملة»، أو زر «📈 التقرير الإحصائي الكامل» أسفل مربّعات الرئيسية. يعرض الأعداد العامة وكل جيل والفروع وأكثر الأسماء والتوزيع حسب المدينة والزيارات.' },
  { q: 'كيف أشارك الموقع مع غيري؟', a: 'زر المشاركة (أيقونة الشبكة) أعلى الشاشة يفتح قائمة المشاركة في جهازك (واتساب/رسائل/تيليجرام/نسخ…)، أو ينسخ الرابط مباشرةً.' },
  { q: 'كيف أضيف الموقع كتطبيق على جوالي؟', a: 'من «المزيد ← إضافة اختصار الموقع إلى الشاشة»، فيُفتح الموقع كتطبيق مستقل بوصولٍ أسرع.' },
  { q: 'عدّلتُ لكن لا تظهر التغييرات؟', a: 'اضغط زر 🔄 بأعلى الشاشة؛ فهو يجلب أحدث نسخة من الموقع متجاوزاً ذاكرة المتصفّح.' },
  { q: 'هل تظهر بياناتي الخاصة (جوالي) للزوّار؟', a: 'لا. الزائر يتصفّح ويبحث فقط، ولا يرى الجوال ولا الملاحظات الخاصة.' },
  { role: 'admin', q: 'كيف أضيف مشرفاً جديداً؟', a: 'لوحة التحكم ← الأعضاء ← «➕ إضافة عضو»: اكتب الاسم فيُنتقى من الشجرة (لا بدّ أن يكون حيّاً)، ثم أدخل رقم الجوال والرقم السري، واختر الدور (مشرف عام/مشرف فرع)، وحدّد الفروع والصلاحيات، ثم «إنشاء الحساب وتفعيله». ويدخل المشرف بجوّاله ورقمه السري.' },
  { role: 'admin', q: 'ما الفرق بين «مشرف عام» و«مشرف فرع»؟', a: 'المشرف العام على كل الفروع (أو فروعٍ تحدّدها له)، ومشرف الفرع على فروعه المحدّدة فقط. ولكلٍّ منهما صلاحيات دقيقة داخل نطاقه (إضافة مولود/تأكيده/ترتيب الأبناء/تعديل الملف).' },
  { role: 'admin', q: 'نسيَ عضوٌ رقمه السري — ماذا أفعل؟', a: 'من لوحة التحكم ← الأعضاء ← بطاقة العضو ← «✎ تعديل البيانات»، يعيّن المدير رقماً سرياً جديداً.' },
  { role: 'admin', q: 'كيف أعتمد طلب إضافة مولود؟', a: 'المزيد ← «ملاحظات الزوار الواردة» ← افتح الطلب ← «قبول» بعد رسائل التأكيد وكتابة كلمة «اضافة». يُحدَّد الفرع تلقائياً من فرع الأب، ولا يُقبل ابنٌ حيٌّ بنفس اسم أخيه الحيّ.' },
  { role: 'admin', q: 'كيف آخذ نسخة احتياطية وأستعيدها؟', a: 'لوحة التحكم ← «النسخ والتصدير»: نسخة داخل القاعدة أو تنزيل ملف باسم «المفرجي_التاريخ». وهناك نسخ سحابية تلقائية يومية (يُحتفظ بآخر ٣٠) مع إنشاء نسخة فورية والاستعادة مباشرةً (لمدير النظام فقط).' },
  { role: 'admin', q: 'كيف أرتّب أبناء أبٍ واحد؟', a: 'من ملف الأب بطاقة «الأبناء»، أو «المزيد ← الإدارة ← ↕️ ترتيب الأبناء»، رتّب بالسهمين ▲▼ (يبقى الترتيب ضمن الإخوة فقط ويُحفظ تلقائياً ويُسجَّل باسمك).' },
];
function screenFaq() {
  const canAdmin = isAdmin() || isManager();
  const items = FAQ.filter(f => !f.role || canAdmin);
  const cards = items.map(f => `
    <details class="faq-item"${f.role ? ' data-adm="1"' : ''}>
      <summary>${f.role ? '<span class="faq-adm-tag">إدارة</span> ' : ''}${esc(f.q)}</summary>
      <div class="faq-a">${esc(f.a)}</div>
    </details>`).join('');
  view().innerHTML = `<div class="about-wrap"><div class="about-card guide-card">
      <p class="about-eyebrow">مركز المساعدة</p>
      <h2>❓ الأسئلة الشائعة</h2>
      <hr>
      <p style="text-align:center;color:var(--muted);font-size:.9rem;margin:0 0 14px">إجاباتٌ سريعة لأكثر الأسئلة تكراراً — اضغط أيّ سؤال ليظهر جوابه.</p>
      <div style="text-align:center;margin:0 0 16px"><button class="btn outline" data-go="#/guide">📖 دليل الاستخدام الكامل</button></div>
      ${cards}
    </div></div>`;
  bindGo();
}
// محرّر الصفحة التعريفية (للمدير) — أدوات تنسيق الخطوط ثم حفظ.
function screenAboutEdit() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const sizes = [['3', 'صغير'], ['4', 'عادي'], ['5', 'كبير'], ['6', 'أكبر'], ['7', 'عنوان']];
  view().innerHTML = adminTabBar('aboutedit') + `
    <div class="card">
      <h3>📖 الصفحة التعريفية — قبيلة المفرجي</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">صمّم الصفحة بأدوات التنسيق ثم احفظ. تُعرض للجميع عبر زر «ⓘ» في الرئيسية وقائمة المزيد.</p>
      <div class="rte-toolbar">
        <button type="button" class="rte-b" data-cmd="bold" title="غامق"><b>غ</b></button>
        <button type="button" class="rte-b" data-cmd="italic" title="مائل"><i>م</i></button>
        <button type="button" class="rte-b" data-cmd="underline" title="تسطير"><u>ت</u></button>
        <span class="rte-sep"></span>
        <select class="rte-sel" id="rte_size" title="حجم الخط"><option value="">حجم</option>${sizes.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select>
        <label class="rte-color" title="لون الخط">🎨<input type="color" id="rte_color" value="#1c8b4d"></label>
        <span class="rte-sep"></span>
        <button type="button" class="rte-b" data-cmd="justifyright" title="يمين">⟶</button>
        <button type="button" class="rte-b" data-cmd="justifycenter" title="توسيط">↔</button>
        <button type="button" class="rte-b" data-cmd="justifyleft" title="يسار">⟵</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-b" data-cmd="insertunorderedlist" title="نقاط">•</button>
        <button type="button" class="rte-b" data-cmd="formatblock" data-val="H2" title="عنوان">H</button>
        <button type="button" class="rte-b" data-cmd="removeformat" title="مسح التنسيق">⌫</button>
      </div>
      <div id="rte" class="rte-area" contenteditable="true" dir="rtl">${sanitizeHtml(aboutHtml)}</div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" id="about_save">💾 حفظ الصفحة</button>
        <button class="btn outline" id="about_preview">👁️ معاينة</button>
        <button class="btn sm outline" id="about_reset">↺ استرجاع الافتراضي</button>
      </div>
    </div>`;
  const rte = document.getElementById('rte');
  const exec = (cmd, val) => { rte.focus(); try { document.execCommand(cmd, false, val); } catch (e) { /* */ } };
  view().querySelectorAll('.rte-b[data-cmd]').forEach(b => b.addEventListener('click', () => exec(b.dataset.cmd, b.dataset.val || null)));
  document.getElementById('rte_size').addEventListener('change', (e) => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = ''; });
  document.getElementById('rte_color').addEventListener('input', (e) => exec('foreColor', e.target.value));
  document.getElementById('about_save').addEventListener('click', async () => {
    const html = sanitizeHtml(rte.innerHTML);
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'about_html', value: html, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { aboutHtml = html; toast('تم حفظ الصفحة التعريفية'); }
  });
  document.getElementById('about_preview').addEventListener('click', () => {
    openModal('قبيلة المفرجي', `<div class="about-card" style="margin:0"><div class="about-body">${sanitizeHtml(rte.innerHTML)}</div></div>`);
  });
  document.getElementById('about_reset').addEventListener('click', async () => {
    if (!(await confirm2('استرجاع النص الافتراضي للصفحة التعريفية؟', { title: 'استرجاع', okText: 'استرجاع' }))) return;
    rte.innerHTML = DEFAULT_ABOUT;
  });
}

/* ===== النصوص: نص الرئيسية + تعريف ألوان الحالة (للمدير) ===== */
/* ===== 💬 المناقشات (المدير + المشرفون العامون) — كل موضوعٍ محادثة مستقلة بأسلوب واتساب ===== */
const canDiscuss = () => !!(me && me.is_active && (me.role === 'admin' || me.role === 'general_manager'));
let _chatTimer = null, _chatLastId = 0;
function waTime(iso) { try { const d = new Date(iso); return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function waDay(iso) { try { const d = new Date(iso); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return 'اليوم'; if (same(d, y)) return 'أمس';
  return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
// قائمة المواضيع — كقائمة محادثات واتساب: الأحدث أولاً، معاينة آخر رسالة، ونقطة غير المقروء
async function screenTopics() {
  if (!canDiscuss()) { view().innerHTML = noPerm(); return; }
  showLoading(true);
  let topics = [], reads = {};
  try {
    const [t, r] = await Promise.all([
      sb.from('almfrje_topics').select('*').order('last_msg_at', { ascending: false }).limit(200),
      sb.from('almfrje_topic_reads').select('topic_id,last_read_at').eq('user_id', me.user_id),
    ]);
    topics = t.data || [];
    (r.data || []).forEach(x => reads[x.topic_id] = x.last_read_at);
  } catch (e) { /* */ }
  showLoading(false);
  view().innerHTML = `
    <button class="btn" id="tp_new" style="width:100%;margin-bottom:10px">＋ موضوع نقاشٍ جديد</button>
    ${topics.length ? topics.map(t => {
      const unread = !reads[t.id] || (t.last_msg_at && Date.parse(t.last_msg_at) > Date.parse(reads[t.id]));
      return `<button class="wa-item${unread ? ' unread' : ''}" data-topic="${t.id}">
        <span class="wa-av">💬</span>
        <span class="wa-tx">
          <span class="wa-row1"><span class="wa-title">${esc(t.title)}</span><span class="wa-time">${t.last_msg_at ? waTime(t.last_msg_at) : ''}</span></span>
          <span class="wa-row2"><span class="wa-prev">${t.last_msg_text ? esc((t.last_msg_by ? t.last_msg_by.split(' ')[0] + ': ' : '') + t.last_msg_text) : 'موضوع جديد — ابدأ النقاش'}</span>${unread ? '<span class="wa-dot"></span>' : ''}</span>
        </span>
      </button>`; }).join('') : '<div class="center-empty">لا مواضيع بعد — أنشئ أول موضوع نقاش.</div>'}`;
  document.getElementById('tp_new').addEventListener('click', async () => {
    const title = (await uiPrompt('عنوان الموضوع الجديد', { title: 'موضوع نقاشٍ جديد', placeholder: 'مثال: خطة تحديث بيانات فرع غباش', okText: 'إنشاء' }) || '').trim();
    if (!title) return;
    const who = (me && (me.full_name || me.username)) || '';
    const ok = await guard(async () => {
      const { data, error } = await sb.from('almfrje_topics').insert({ title, created_by_name: who, last_msg_text: '', last_msg_by: '' }).select('id').single();
      if (error) throw error;
      setHash('#/topic/' + data.id);
    });
    if (!ok) { /* بقي في القائمة */ }
  });
  view().querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => setHash('#/topic/' + b.dataset.topic)));
}
// غرفة المحادثة — فقاعات كواتساب: رسائلي بلون مميّز جهة، والآخرون جهة، مع فواصل الأيام
async function screenTopicChat(arg) {
  if (!canDiscuss()) { view().innerHTML = noPerm(); return; }
  const tid = parseInt(arg, 10);
  showLoading(true);
  let topic = null, msgs = [];
  try {
    const [t, m] = await Promise.all([
      sb.from('almfrje_topics').select('*').eq('id', tid).maybeSingle(),
      sb.from('almfrje_topic_msgs').select('*').eq('topic_id', tid).order('id', { ascending: true }).limit(800),
    ]);
    topic = t.data; msgs = m.data || [];
  } catch (e) { /* */ }
  showLoading(false);
  if (!topic) { view().innerHTML = '<div class="center-empty">الموضوع غير موجود.</div>'; return; }
  document.getElementById('screenTitle').textContent = '💬 ' + topic.title;
  _chatLastId = msgs.length ? msgs[msgs.length - 1].id : 0;
  view().innerHTML = `
    <div class="wa-chat" id="waChat">${waMsgsHtml(msgs)}</div>
    <div class="wa-inputbar">
      <textarea id="waText" rows="1" placeholder="اكتب رسالة"></textarea>
      <button id="waSend" aria-label="إرسال">➤</button>
    </div>
    ${isAdmin() ? `<div class="no-print" style="text-align:center;margin-top:8px"><button class="btn sm danger" id="waDel">🗑️ حذف الموضوع كاملاً</button></div>` : ''}`;
  const box = document.getElementById('waChat');
  box.scrollTop = box.scrollHeight;
  markTopicRead(tid);
  const ta = document.getElementById('waText');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  const send = async () => {
    const body = ta.value.trim(); if (!body) return;
    ta.value = ''; ta.style.height = 'auto';
    const who = (me && (me.full_name || me.username)) || '';
    const ok = await guard(async () => {
      const { data, error } = await sb.from('almfrje_topic_msgs').insert({ topic_id: tid, body, author_name: who }).select('*').single();
      if (error) throw error;
      await sb.from('almfrje_topics').update({ last_msg_at: new Date().toISOString(), last_msg_text: body.slice(0, 80), last_msg_by: who }).eq('id', tid);
      box.insertAdjacentHTML('beforeend', waMsgsHtml([data], _chatLastId ? msgs[msgs.length - 1] : null));
      msgs.push(data); _chatLastId = data.id;
      box.scrollTop = box.scrollHeight;
      markTopicRead(tid);
    });
    if (!ok) ta.value = body;   // أعد النص عند الفشل
  };
  document.getElementById('waSend').addEventListener('click', send);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); send(); } });
  { const dl = document.getElementById('waDel'); if (dl) dl.addEventListener('click', async () => {
    if (!(await confirm2('حذف الموضوع وكل رسائله نهائياً؟', { danger: true, okText: 'حذف' }))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_topics').delete().eq('id', tid); if (error) throw error; });
    if (ok) { toast('حُذف الموضوع'); setHash('#/discussions'); }
  }); }
  // تحديث تلقائي كل ١٢ ثانية ما دامت الغرفة مفتوحة (يتوقف ذاتياً عند مغادرتها)
  if (_chatTimer) clearInterval(_chatTimer);
  _chatTimer = setInterval(async () => {
    if (!location.hash.startsWith('#/topic/' + tid)) { clearInterval(_chatTimer); _chatTimer = null; return; }
    try {
      const { data } = await sb.from('almfrje_topic_msgs').select('*').eq('topic_id', tid).gt('id', _chatLastId).order('id', { ascending: true }).limit(100);
      if (data && data.length) {
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        box.insertAdjacentHTML('beforeend', waMsgsHtml(data, msgs[msgs.length - 1] || null));
        data.forEach(d => msgs.push(d));
        _chatLastId = msgs[msgs.length - 1].id;
        if (nearBottom) box.scrollTop = box.scrollHeight;
        markTopicRead(tid);
      }
    } catch (e) { /* */ }
  }, 12000);
}
function waMsgsHtml(list, prev) {
  let lastDay = prev ? waDay(prev.created_at) : null;
  return list.map(m => {
    const mine = m.author === me.user_id;
    const day = waDay(m.created_at);
    const sep = day !== lastDay ? `<div class="wa-day"><span>${day}</span></div>` : '';
    lastDay = day;
    return `${sep}<div class="wa-bub ${mine ? 'me' : ''}">
      ${!mine ? `<span class="wa-who">${esc((m.author_name || '').split(' بن ')[0] || m.author_name || '')}</span>` : ''}
      <span class="wa-body">${esc(m.body)}</span>
      <span class="wa-t">${waTime(m.created_at)}</span>
    </div>`;
  }).join('');
}
async function markTopicRead(tid) {
  try { await sb.from('almfrje_topic_reads').upsert({ user_id: me.user_id, topic_id: tid, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,topic_id' }); } catch (e) { /* */ }
}
// 🎛️ لوحة التحكم — مربّع لكل خدمة، مرتّبة متباعدة، وتحت كلٍّ منها مسؤولياتها
function screenControl() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  // ⭐ الأكثر استخداماً: بارزة أعلى اللوحة بشكل أعرض — والملاحظات بعدّاد المعلّق
  const featured = [
    ['📨', 'صندوق الوارد', 'ملاحظات الزوّار: الاعتماد والرد والأرشيف', '#/feedbacks', C.feedbackPending || 0],
    ['⚙️', 'الإعدادات', 'فتح الزوّار • آخر الإضافات • الزيارات', '#/settings', 0],
    ['👥', 'الأعضاء', 'الحسابات والأدوار والصلاحيات الدقيقة', '#/members', C.members.filter(m => !m.is_active && m.role === 'viewer' && m.person_id).length],
  ];
  const tiles = [
    ['🗂️', 'الفروع والمشرفون', 'تعريف الفروع وتعيين مشرفيها', '#/branchadmin'],
    ['📝', 'النصوص', 'نصوص الواجهة والتهنئة وبنك الردود', '#/texts'],
    ['📜', 'الوثائق', 'إضافة وثائق القبيلة وتفريغ نصوصها', '#/documents'],
    ['📖', 'الصفحة التعريفية', 'نبذة القبيلة بمحرّر التنسيق', '#/aboutedit'],
    ['💡', 'التعليمات', 'نصوص أزرار الإرشاد ⓘ', '#/hints'],
    ['📋', 'سجل التعديلات', 'من عدّل وماذا — مع التراجع', '#/audit'],
    ['🗑️', 'سلة المحذوفات', 'استرجاع ما حُذف أو عُدّل', '#/trash'],
    ['💾', 'النسخ والتصدير', 'نسخ احتياطية واستعادة وExcel/PDF', '#/backups'],
  ];
  view().innerHTML = `
    <div class="cp-sec">⭐ الأكثر استخداماً</div>
    ${featured.map(([ic, t, d, h, n], i2) => `
      <button class="cp-feat cpt-${i2 % 6}" data-go="${h}">
        <span class="cp-ico">${ic}</span>
        <span class="cp-feat-tx"><span class="cp-title">${t}</span><span class="cp-desc">${d}</span></span>
        ${n > 0 ? `<span class="cp-badge">${n > 99 ? '99+' : n}</span>` : '<span class="cp-arrow">‹</span>'}
      </button>`).join('')}
    <div class="cp-sec" style="margin-top:14px">🗄️ بقية الخدمات</div>
    <div class="cp-grid">${tiles.map(([ic, t, d, h], i3) => `
      <button class="cp-tile cpt-${(i3 + 3) % 6}" data-go="${h}">
        <span class="cp-ico">${ic}</span>
        <span class="cp-title">${t}</span>
        <span class="cp-desc">${d}</span>
      </button>`).join('')}
    </div>`;
  bindGo();
}
// ⚙️ الإعدادات — مفاتيح تشغيل الموقع مجموعةً في مكانٍ واحد (بدل تناثرها)
function screenSettings() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const vb = visitStats.byBranch || {}, vc = visitStats.byCity || {};
  const branchRows = Object.keys(vb).length
    ? Object.entries(vb).sort((a, b) => b[1] - a[1]).map(([bid, n]) => `<div class="row"><span class="k">🗂️ ${esc(branchName(Number(bid)))}</span><span class="v">${n}</span></div>`).join('')
    : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا زيارات مسجّلة بعد.</div>';
  const cityRows = Object.keys(vc).length
    ? Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div class="row"><span class="k">📍 ${esc(c)}</span><span class="v">${n}</span></div>`).join('')
    : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا مناطق مسجّلة بعد.</div>';
  view().innerHTML = adminTabBar('settings') + `
    <div class="card"><div class="li-title">👁 فتح الموقع للزوّار (تصفّح مباشر) ${hintBtn('guest_browse')}</div>
      <div class="li-sub">${guestOpen ? 'مفتوح — يدخل الزائر مباشرةً للتصفّح (قراءة فقط) دون تسجيل. دخول الإدارة من «المزيد ← دخول المسؤول».' : 'مغلق — تظهر شاشة الدخول للجميع (للمسؤولين فقط).'}</div>
      <button class="btn sm ${guestOpen ? 'danger' : ''}" id="guestToggle" style="margin-top:6px">${guestOpen ? '🔒 إغلاق الموقع عن الزوّار' : '👁 فتح الموقع للزوّار'}</button>
      ${guestOpen ? `<div style="margin-top:10px"><div class="li-sub" style="font-weight:700;margin-bottom:4px">ماذا يُخفى عن الزائر؟</div>
        <label class="perm-chk"><input type="checkbox" data-ghide="phone" ${guestHide.phone ? 'checked' : ''}><span>أرقام الجوال والبريد</span></label>
        <label class="perm-chk"><input type="checkbox" data-ghide="media" ${guestHide.media ? 'checked' : ''}><span>الصور والمستندات</span></label>
        <label class="perm-chk"><input type="checkbox" data-ghide="notes" ${guestHide.notes ? 'checked' : ''}><span>الملاحظات والحالة الوظيفية</span></label>
        <div class="muted" style="font-size:.78rem;margin-top:4px">تُحفظ التغييرات فور التأشير. الأسماء والنسب والأجيال والمدن وتواريخ الميلاد/الوفاة تبقى ظاهرة.</div>
        <div style="margin-top:12px;border-top:1px solid var(--line,#e5e5e5);padding-top:10px"><div class="li-sub" style="font-weight:700;margin-bottom:4px">🔐 تحقّق دخول الزائر بالاسم</div>
          <div class="muted" style="font-size:.78rem;margin-bottom:8px;line-height:1.9">عند التفعيل: يكتب الزائر اسمه ثم آباءه، ويدخل <b>تلقائياً بلا زر</b> بمجرد أن يصبح اسمه مميّزاً (غير مكرّر). وإن تكرّر يُطلب اسم جدٍّ إضافي تلقائياً حتى يتفرّد. (تُتجاهل المسافة و«بن»/«ابن»/«ال» والهمزات، وصاحب الاسم يجب أن يكون حيّاً.)</div>
          <label class="perm-chk"><input type="checkbox" id="guestVerifyChk" ${guestGens > 0 ? 'checked' : ''}><span>اشتراط التحقّق بالاسم قبل دخول الزائر</span></label>
        </div></div>` : ''}</div>
    <div class="card"><div class="li-title">🕘 بطاقة «آخر الإضافات» في الرئيسية</div>
      <div class="li-sub">${recentShow ? 'ظاهرة للجميع حالياً.' : 'مخفية عن الجميع حالياً (يراها المدير وحده بملاحظة).'} والتصفير يبدأ عدّ الإضافات من جديد دون حذف أي بيانات.</div>
      <button class="btn sm ${recentShow ? 'outline' : ''}" id="recent_toggle" style="margin-top:6px">${recentShow ? '🙈 إخفاء «آخر الإضافات» عن الجميع' : '👁 إظهار «آخر الإضافات» للجميع'}</button>
      <button class="btn sm outline" id="recent_reset" style="margin-top:6px">↺ تصفير «آخر الإضافات»</button></div>
<div class="card"><h3>📊 إحصائيات الزيارات</h3>
      <div class="row"><span class="k">إجمالي من دخل الموقع</span><span class="v" style="font-size:1.2rem;color:var(--brand)" id="visitsTotalSt">${visitStats.total || 0}</span></div>
      <div class="row"><span class="k">🟢 المتواجدون الآن</span><span class="v" style="font-size:1.2rem;color:#1c8b4d" id="onlineNowSt">${onlineNow}</span></div>
      <div class="li-sub" style="margin-top:6px;font-weight:800;color:var(--text)">المتواجدون الآن حسب الفرع</div>
      <div id="onlineByBranchSt"><div class="muted" style="font-size:.85rem;padding:4px 0">…</div></div>
      <div class="li-sub" style="margin-top:10px;font-weight:800;color:var(--text)">إجمالي الزيارات حسب الفرع</div>${branchRows}
      <div class="li-sub" style="margin-top:10px;font-weight:800;color:var(--text)">حسب المنطقة (المدينة)</div>${cityRows}
      <button class="btn sm danger" id="visits_reset" style="margin-top:10px">↺ تصفير إحصاء الزيارات</button>
            <p class="muted" style="font-size:.78rem;margin-top:6px">يُحتسب كل من يدخل الموقع (زائر/مشرف/مدير). «المتواجدون الآن» = نشِطون خلال آخر ٣ دقائق.</p></div>
    `;
  const gTg = document.getElementById('guestToggle');
  if (gTg) gTg.addEventListener('click', async () => {
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_open', value: !guestOpen, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestOpen = !guestOpen; toast(guestOpen ? 'الموقع مفتوح للزوّار' : 'الموقع مغلق (للمسؤولين فقط)'); screenSettings(); }
  });
  view().querySelectorAll('input[data-ghide]').forEach(cb => cb.addEventListener('change', async () => {
    const next = Object.assign({ ...GUEST_HIDE_DEFAULT }, guestHide, { [cb.dataset.ghide]: cb.checked });
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_hide', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestHide = next; toast('تم الحفظ'); } else { cb.checked = !cb.checked; }
  }));
  const gvc = document.getElementById('guestVerifyChk');
  if (gvc) gvc.addEventListener('change', async () => {
    const n = gvc.checked ? 2 : 0;   // 2 = تحقّق تلقائي (اسمان فأكثر حتى التميّز)؛ 0 = دخول مباشر
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_verify_gens', value: n, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestGens = n; toast(n > 0 ? 'فُعِّل التحقّق بالاسم (دخول تلقائي عند التميّز)' : 'أُلغي التحقّق (دخول مباشر)'); } else { gvc.checked = !gvc.checked; }
  });
  { const rb = document.getElementById('visits_reset'); if (rb) rb.addEventListener('click', async () => {
    if (!(await confirm2('تصفير إحصاء الزيارات بالكامل؟ يبدأ العدّ من جديد.', { title: 'تصفير الزيارات', okText: 'تصفير', danger: true }))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'visit_stats', value: { total: 0, byBranch: {}, byCity: {}, updated_at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { visitStats = { total: 0, byBranch: {}, byCity: {} }; toast('تم تصفير الزيارات'); screenSettings(); }
  }); }
  pingPresence(false);   // تحديث «المتواجدون الآن» وتفصيلهم حسب الفرع عند فتح البطاقة
  { const rrc = document.getElementById('recent_reset'); if (rrc) rrc.addEventListener('click', resetRecent); }
  { const rtg = document.getElementById('recent_toggle'); if (rtg) rtg.addEventListener('click', async () => {
    const nv = !recentShow;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'recent_show', value: nv, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { recentShow = nv; toast(nv ? 'بطاقة «آخر الإضافات» ظاهرة للجميع' : 'أُخفيت «آخر الإضافات» عن الجميع'); screenSettings(); }
  }); }
}
function screenTexts() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }

  view().innerHTML = adminTabBar('texts') + `
    <div class="tx-group txg-0${txOpen.has(0) ? ' open' : ''}"><button class="tx-group-title" data-txg="0"><span class="txg-ico">${txOpen.has(0) ? '▾' : '▸'}</span><span class="txg-label">🏠 الرئيسية والهوية</span><span class="txg-count">4</span></button><div class="tx-group-items"><div class="card"><h3>🏷️ عنوان الموقع وسطر «powered by» ${hintBtn('site_title')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهران في شاشات الدخول (الزائر والمسؤول) وفي تذييل قائمة «المزيد».</p>
      ${fInput('عنوان الموقع', 'tx_title', siteTitle)}
      ${fInput('سطر الإسناد (powered by) — اتركه فارغاً لإخفائه', 'tx_powered', sitePowered)}
      <button class="btn sm" id="tx_titleSave" style="margin-top:6px">حفظ</button></div>
    <div class="card"><h3>📝 نص الرئيسية ${hintBtn('banner')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهر أعلى الصفحة الرئيسية للجميع. النص الطويل يُقصَر تلقائياً مع زرّ «المزيد…» يفتح صفحة النبذة.</p>
      ${fTextarea('النص', 'tx_banner', bannerText)}
      ${fSelect('حجم الخط', 'tx_banner_size', [{ k: '', ar: 'افتراضي' }, { k: '0.95rem', ar: 'صغير' }, { k: '1.05rem', ar: 'متوسط' }, { k: '1.2rem', ar: 'كبير' }, { k: '1.35rem', ar: 'كبير جداً' }], bannerSize)}
      <button class="btn sm" id="tx_bannerSave" style="margin-top:6px">حفظ</button></div>
    <div class="card"><h3>📜 قسم الوثائق</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">إدارة الوثائق (إضافة صورة + تفريغ نصّها) من القسم المخصّص.</p>
      <button class="btn sm outline" data-go="#/documents" style="margin-top:6px">فتح قسم الوثائق</button></div>
    <div class="card"><h3>📤 نصّ المشاركة</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">العنوان والنص يظهران معاً في رسالة المشاركة (زرّ المشاركة). <b>ملاحظة:</b> «بطاقة المعاينة» الصغيرة في واتساب لها عنوانٌ ثابت في الترويسة (لا يُعدَّل من هنا).</p>
      ${fInput('العنوان', 'tx_share_title', shareTitle)}
      ${fInput('النص', 'tx_share_text', shareText)}
      <button class="btn sm" id="tx_shareSave" style="margin-top:6px">حفظ</button></div>
    </div></div><div class="tx-group txg-1${txOpen.has(1) ? ' open' : ''}"><button class="tx-group-title" data-txg="1"><span class="txg-ico">${txOpen.has(1) ? '▾' : '▸'}</span><span class="txg-label">🎉 المناسبات</span><span class="txg-count">2</span></button><div class="tx-group-items"><div class="card"><h3>🎉 كلمة المناسبات (شاشة الدخول) ${hintBtn('occasion')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">تظهر تحت العنوان مباشرة في شاشة الدخول بخط غامق وباللون الذي تختاره. اتركها فارغة لإخفائها.</p>
      ${fInput('الكلمة', 'tx_occ', occasionText)}
      <div class="field"><label>لون الكلمة</label><input type="color" id="tx_occ_color" value="${okColor(occasionColor)}" style="width:60px;height:38px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--card)"></div>
      <div id="occPreview" style="font-weight:800;font-size:1.05rem;text-align:center;margin:8px 0;color:${okColor(occasionColor)}">${esc(occasionText || 'معاينة الكلمة')}</div>
      <button class="btn sm" id="tx_occSave">حفظ</button></div>
    <div class="card"><h3>🎊 تهنئة / مبارَكة المناسبات ${hintBtn('congrats')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">رسالة تهنئة من الإدارة تظهر لكل من يدخل <b>فور الدخول</b> (في الجزء الأوسط العلوي) وكشريط مميّز أعلى الرئيسية <b>طوال مدّة العرض</b>. اترك النص فارغاً لإيقافها.</p>
      ${fTextarea('نص التهنئة', 'tx_cong', (congrats && congrats.text) || '')}
      ${fSelect('عنوان التهنئة', 'tx_cong_title_mode', [{ k: 'default', ar: '🎊 تهنئة من الإدارة (الافتراضي)' }, { k: 'custom', ar: 'عنوان مخصّص (تكتبه)' }, { k: 'none', ar: 'بدون عنوان' }], (congrats && congrats.titleMode) || 'default')}
      <div class="field" id="tx_cong_title_wrap"><label>العنوان المخصّص</label><input id="tx_cong_title" type="text" value="${esc((congrats && congrats.title) || '')}" placeholder="اكتب عنوان التهنئة"></div>
      <div class="field"><label>لون الخط</label><input type="color" id="tx_cong_color" value="${okColor(congrats && congrats.color)}" style="width:60px;height:38px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--card)"></div>
      ${fSelect('وقت النشر', 'tx_cong_mode', [{ k: 'now', ar: 'تُنشر الآن مباشرة' }, { k: 'sched', ar: 'بتوقيت محدّد (يوم وساعة)' }], (congrats && congrats.mode) || 'now')}
      <div class="field" id="tx_cong_start_wrap"><label>تاريخ ووقت بدء النشر</label><input type="datetime-local" id="tx_cong_start" value="${dtLocalValue(congrats && congrats.mode === 'sched' ? congrats.start : null)}" style="width:100%"></div>
      <div class="field"><label>مدّة العرض — اتركها فارغة لعرضٍ دائم حتى الإيقاف</label>
        <div style="display:flex;gap:8px">
          <input id="tx_cong_dur" type="number" min="0" step="1" inputmode="numeric" value="${(congrats && (congrats.durValue != null ? congrats.durValue : (congrats.days != null ? congrats.days : ''))) ?? ''}" style="flex:1" placeholder="مثلاً 6">
          ${(() => { const u = (congrats && congrats.durUnit) ? congrats.durUnit : (congrats && congrats.days != null && congrats.durValue == null ? 'd' : 'h'); return `<select id="tx_cong_unit" style="width:120px"><option value="h" ${u === 'h' ? 'selected' : ''}>ساعة</option><option value="d" ${u === 'd' ? 'selected' : ''}>يوم</option></select>`; })()}
        </div></div>
      <div class="greet-congrats" style="margin:10px 0"><span class="greet-congrats-badge" id="congTitlePreview">🎊 تهنئة من الإدارة</span><div class="greet-congrats-text" id="congPreview" style="color:${okColor(congrats && congrats.color)}">${esc((congrats && congrats.text) || 'معاينة نص التهنئة')}</div></div>
      <div id="congStatus" class="muted" style="font-size:.82rem;margin:6px 0">${esc(congratsStatusText(congrats))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" id="tx_congSave">💾 حفظ / تعديل</button>
        <button class="btn sm danger" id="tx_congDel">🗑️ حذف التهنئة</button>
      </div></div>
    </div></div><div class="tx-group txg-2${txOpen.has(2) ? ' open' : ''}"><button class="tx-group-title" data-txg="2"><span class="txg-ico">${txOpen.has(2) ? '▾' : '▸'}</span><span class="txg-label">🚪 دخول الزائر وترحيبه</span><span class="txg-count">3</span></button><div class="tx-group-items"><div class="card"><h3>🚪 دعوة الزائر للدخول ${hintBtn('guest_prompt')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهر للزائر فوق حقل كتابة الاسم في شاشة الدخول.</p>
      ${fInput('النص', 'tx_gprompt', guestPrompt)}
      <button class="btn sm" id="tx_gpromptSave" style="margin-top:6px">حفظ</button></div>
    <div class="card"><h3>🌿 ترحيب الزائر — عند نجاح التحقق ${hintBtn('guest_ok')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهر للزائر بعد مطابقة اسمه. اكتب <b>{name}</b> مكان اسم الزائر.</p>
      ${fTextarea('النص', 'tx_gok', guestWelcomeOk)}
      <button class="btn sm" id="tx_gokSave" style="margin-top:6px">حفظ</button></div>
    <div class="card"><h3>🙏 ترحيب الزائر — عند فشل التحقق ${hintBtn('guest_fail')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهر إذا لم يُطابق الاسم. اكتب <b>{name}</b> مكان اسم الزائر.</p>
      ${fTextarea('النص', 'tx_gfail', guestWelcomeFail)}
      <button class="btn sm" id="tx_gfailSave" style="margin-top:6px">حفظ</button></div>
    </div></div><div class="tx-group txg-3${txOpen.has(3) ? ' open' : ''}"><button class="tx-group-title" data-txg="3"><span class="txg-ico">${txOpen.has(3) ? '▾' : '▸'}</span><span class="txg-label">✉️ الملاحظات والردود</span><span class="txg-count">3</span></button><div class="tx-group-items"><div class="card"><h3>✉️ بطاقة «ملاحظتك تهمنا» ${hintBtn('feedback_card')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">عنوان البطاقة ونصّها التعريفي في الرئيسية (لإرسال الملاحظة).</p>
      ${fInput('العنوان', 'tx_fbcard_title', feedbackCardTitle)}
      ${fTextarea('النص', 'tx_fbcard', feedbackCardText)}
      <button class="btn sm" id="tx_fbcardSave" style="margin-top:6px">حفظ</button></div>
    <div class="card"><h3>💬 رسالة الشكر بعد إرسال ملاحظة ${hintBtn('feedback_thanks')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">تظهر للمُرسِل في موديل بعد إرسال ملاحظته.</p>
      ${fTextarea('النص', 'tx_fbthanks', feedbackThanks)}
      <button class="btn sm" id="tx_fbthanksSave" style="margin-top:6px">حفظ النص</button></div>
    <div class="card"><h3>🏦 بنك الردود الجاهزة</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يستخدمها المشرف للرد على الملاحظات باسم الإدارة. <b>كل سطرٍ = ردّ جاهز</b> — عدّل أو أضِف سطراً جديداً لكل بند.</p>
      ${fTextarea('👶 ردود «إضافة مولود»', 'tx_rb_newborn', (Array.isArray(replyBank['إضافة مولود']) ? replyBank['إضافة مولود'] : []).join('\n'))}
      ${fTextarea('📝 ردود «ملاحظة»', 'tx_rb_note', (Array.isArray(replyBank['ملاحظة']) ? replyBank['ملاحظة'] : []).join('\n'))}
      ${fTextarea('💡 ردود «اقتراح»', 'tx_rb_sugg', (Array.isArray(replyBank['اقتراح']) ? replyBank['اقتراح'] : []).join('\n'))}
      ${fTextarea('↕️ ردود «إعادة ترتيب الإخوان»', 'tx_rb_reorder', (Array.isArray(replyBank['إعادة ترتيب الإخوان']) ? replyBank['إعادة ترتيب الإخوان'] : []).join('\n'))}
      <button class="btn sm" id="tx_rbSave" style="margin-top:6px">حفظ بنك الردود</button>
      <button class="btn sm outline" id="tx_rbReset" style="margin-top:6px">استرجاع الافتراضي</button></div>
    </div></div><div class="tx-group txg-4${txOpen.has(4) ? ' open' : ''}"><button class="tx-group-title" data-txg="4"><span class="txg-ico">${txOpen.has(4) ? '▾' : '▸'}</span><span class="txg-label">🎨 ألوان الحالة</span><span class="txg-count">1</span></button><div class="tx-group-items"><div class="card"><h3>🎨 تعريف ألوان الحالة ${hintBtn('status_labels')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">تظهر دلالة الألوان أسفل قوائم الشجرة (الشجرة/العرض الهرمي/الأعمدة/الذرية). عدّل المسميات كما تريد.</p>
      ${fInput('الاسم بلون عادي يعني', 'tx_alive', statLabels.alive)}
      ${fInput('الاسم بلون رمادي يعني', 'tx_dead', statLabels.dead)}
      ${fInput('الاسم بلون أحمر يعني', 'tx_noissue', statLabels.noissue)}
      <button class="btn sm" id="tx_lblSave">حفظ المسميات</button>
      <div class="status-legend" style="margin-top:12px">
        <span class="n-alive">${esc(statLabels.alive)}</span>
        <span class="n-died">${esc(statLabels.dead)}</span>
        <span class="n-noissue">${esc(statLabels.noissue)}</span>
      </div></div></div></div>`;
  // طيّ/فتح مجموعات النصوص في المكان (تبقى مستمعات الأزرار سليمة)
  view().querySelectorAll('[data-txg]').forEach(b => b.addEventListener('click', () => {
    const gi = parseInt(b.dataset.txg, 10), grp = b.closest('.tx-group');
    const open = grp.classList.toggle('open');
    if (open) txOpen.add(gi); else txOpen.delete(gi);
    const ico = b.querySelector('.txg-ico'); if (ico) ico.textContent = open ? '▾' : '▸';
  }));

  document.getElementById('tx_titleSave').addEventListener('click', async () => {
    const t = val('tx_title').trim(); const pw = val('tx_powered').trim();   // يُسمح بفراغ العنوان (لإخفائه)
    const ok = await guard(async () => {
      let { error } = await sb.from('almfrje_settings').upsert({ key: 'site_title', value: t, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error;
      ({ error } = await sb.from('almfrje_settings').upsert({ key: 'site_powered', value: pw, updated_at: new Date().toISOString() }, { onConflict: 'key' })); if (error) throw error;
    });
    if (ok) { siteTitle = t; sitePowered = pw; toast('تم حفظ العنوان'); }
  });
  { // كلمة المناسبات: معاينة حيّة + حفظ النص واللون
    const occInp = document.getElementById('tx_occ'), occCol = document.getElementById('tx_occ_color'), occPrev = document.getElementById('occPreview');
    const refresh = () => { if (!occPrev) return; occPrev.textContent = (occInp.value || '').trim() || 'معاينة الكلمة'; occPrev.style.color = okColor(occCol.value); };
    if (occInp) occInp.addEventListener('input', refresh);
    if (occCol) occCol.addEventListener('input', refresh);
    document.getElementById('tx_occSave').addEventListener('click', async () => {
      const t = (occInp.value || '').trim(); const c = okColor(occCol.value);
      const ok = await guard(async () => {
        let { error } = await sb.from('almfrje_settings').upsert({ key: 'occasion_text', value: t, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error;
        ({ error } = await sb.from('almfrje_settings').upsert({ key: 'occasion_color', value: c, updated_at: new Date().toISOString() }, { onConflict: 'key' })); if (error) throw error;
      });
      if (ok) { occasionText = t; occasionColor = c; toast(t ? 'تم حفظ كلمة المناسبة' : 'أُخفيت كلمة المناسبة'); }
    });
  }
  { // تهنئة المناسبات: معاينة حيّة + إظهار/إخفاء حقل التوقيت بحسب الوضع + حفظ
    const cInp = document.getElementById('tx_cong'), cCol = document.getElementById('tx_cong_color'), cMode = document.getElementById('tx_cong_mode'),
      cStartWrap = document.getElementById('tx_cong_start_wrap'), cPrev = document.getElementById('congPreview');
    const cTitleMode = document.getElementById('tx_cong_title_mode'), cTitleWrap = document.getElementById('tx_cong_title_wrap'),
      cTitle = document.getElementById('tx_cong_title'), cTitlePrev = document.getElementById('congTitlePreview');
    const syncMode = () => { if (cStartWrap) cStartWrap.style.display = (cMode && cMode.value === 'sched') ? '' : 'none'; };
    // عنوان التهنئة المختار الآن (حسب الوضع): افتراضي / مخصّص / بدون
    const titleNow = () => congratsTitle({ titleMode: cTitleMode ? cTitleMode.value : 'default', title: cTitle ? cTitle.value.trim() : '' });
    const syncTitle = () => {
      const m = cTitleMode ? cTitleMode.value : 'default';
      if (cTitleWrap) cTitleWrap.style.display = (m === 'custom') ? '' : 'none';
      if (cTitlePrev) { const t = titleNow(); cTitlePrev.textContent = t || '(بدون عنوان)'; cTitlePrev.style.display = t ? '' : 'none'; }
    };
    const refresh = () => { if (cPrev) { cPrev.textContent = (cInp.value || '').trim() || 'معاينة نص التهنئة'; cPrev.style.color = okColor(cCol.value); } };
    syncMode(); syncTitle(); refresh();
    if (cInp) cInp.addEventListener('input', refresh);
    if (cCol) cCol.addEventListener('input', refresh);
    if (cMode) cMode.addEventListener('change', syncMode);
    if (cTitleMode) cTitleMode.addEventListener('change', syncTitle);
    if (cTitle) cTitle.addEventListener('input', syncTitle);
    const cSave = document.getElementById('tx_congSave');
    if (cSave) cSave.addEventListener('click', async () => {
      const text = (cInp.value || '').trim();
      const color = okColor(cCol.value);
      const mode = (cMode && cMode.value === 'sched') ? 'sched' : 'now';
      const durRaw = (val('tx_cong_dur') || '').trim();
      const durUnit = (val('tx_cong_unit') === 'd') ? 'd' : 'h';
      const durValue = durRaw === '' ? null : Math.max(0, parseInt(durRaw, 10) || 0);
      let start = null;
      if (mode === 'sched') { const s = val('tx_cong_start'); if (s) { const d = new Date(s); if (!isNaN(d)) start = d.toISOString(); } }
      const titleMode = (cTitleMode && cTitleMode.value) || 'default';
      const title = (cTitle && cTitle.value.trim()) || '';
      const obj = text ? { text, color, mode, start, durValue, durUnit, titleMode, title, savedAt: new Date().toISOString() } : null;
      const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'congrats', value: obj, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
      if (ok) {
        congrats = obj;
        const st = document.getElementById('congStatus'); if (st) st.textContent = congratsStatusText(congrats);
        toast(text ? 'تم حفظ التهنئة' : 'تم إيقاف التهنئة');
      }
    });
    const cDel = document.getElementById('tx_congDel');
    if (cDel) cDel.addEventListener('click', async () => {
      if (!(await confirm2('حذف التهنئة وإيقاف ظهورها للجميع؟', { title: 'حذف التهنئة', okText: 'حذف', danger: true }))) return;
      const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'congrats', value: null, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
      if (ok) {
        congrats = null;
        if (cInp) cInp.value = '';
        if (cPrev) { cPrev.textContent = 'معاينة نص التهنئة'; cPrev.style.color = okColor(cCol && cCol.value); }
        const st = document.getElementById('congStatus'); if (st) st.textContent = congratsStatusText(congrats);
        toast('تم حذف التهنئة');
      }
    });
  }
  document.getElementById('tx_fbcardSave').addEventListener('click', async () => {
    const t = val('tx_fbcard').trim() || DEFAULT_FB_CARD;
    const ti = val('tx_fbcard_title').trim() || DEFAULT_FB_CARD_TITLE;
    const ok = await guard(async () => {
      let { error } = await sb.from('almfrje_settings').upsert({ key: 'feedback_card_text', value: t, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error;
      ({ error } = await sb.from('almfrje_settings').upsert({ key: 'feedback_card_title', value: ti, updated_at: new Date().toISOString() }, { onConflict: 'key' })); if (error) throw error;
    });
    if (ok) { feedbackCardText = t; feedbackCardTitle = ti; toast('تم الحفظ'); }
  });
  document.getElementById('tx_gpromptSave').addEventListener('click', async () => {
    const t = val('tx_gprompt').trim() || DEFAULT_GUEST_PROMPT;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_prompt', value: t, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestPrompt = t; toast('تم حفظ النص'); }
  });
  document.getElementById('tx_bannerSave').addEventListener('click', async () => {
    const txt = val('tx_banner').trim();
    const size = /^[0-9.]+rem$/.test(val('tx_banner_size')) ? val('tx_banner_size') : '';
    const ok = await guard(async () => {
      let { error } = await sb.from('almfrje_settings').upsert({ key: 'banner_text', value: txt, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error;
      ({ error } = await sb.from('almfrje_settings').upsert({ key: 'banner_size', value: size, updated_at: new Date().toISOString() }, { onConflict: 'key' })); if (error) throw error;
    });
    if (ok) { bannerText = txt; bannerSize = size; toast('تم الحفظ'); }
  });
  { const ss = document.getElementById('tx_shareSave'); if (ss) ss.addEventListener('click', async () => {
    const t = val('tx_share_title').trim() || DEFAULT_SHARE_TITLE;
    const x = val('tx_share_text').trim() || DEFAULT_SHARE_TEXT;
    const ok = await guard(async () => {
      let { error } = await sb.from('almfrje_settings').upsert({ key: 'share_title', value: t, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error;
      ({ error } = await sb.from('almfrje_settings').upsert({ key: 'share_text', value: x, updated_at: new Date().toISOString() }, { onConflict: 'key' })); if (error) throw error;
    });
    if (ok) { shareTitle = t; shareText = x; toast('تم الحفظ'); }
  }); }
  document.getElementById('tx_fbthanksSave').addEventListener('click', async () => {
    const txt = val('tx_fbthanks').trim() || DEFAULT_FB_THANKS;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'feedback_thanks', value: txt, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { feedbackThanks = txt; toast('تم حفظ رسالة الشكر'); }
  });
  // بنك الردود الجاهزة: كل سطرٍ في الحقل = ردّ مستقل
  const rbLines = (idv) => val(idv).split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('tx_rbSave').addEventListener('click', async () => {
    const bank = { 'إضافة مولود': rbLines('tx_rb_newborn'), 'ملاحظة': rbLines('tx_rb_note'), 'اقتراح': rbLines('tx_rb_sugg'), 'إعادة ترتيب الإخوان': rbLines('tx_rb_reorder') };
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'reply_bank', value: bank, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { replyBank = bank; toast('تم حفظ بنك الردود'); }
  });
  document.getElementById('tx_rbReset').addEventListener('click', async () => {
    if (!(await confirm2('استرجاع الردود الافتراضية؟ سيستبدل ما كتبته.'))) return;
    const bank = JSON.parse(JSON.stringify(DEFAULT_REPLY_BANK));
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'reply_bank', value: bank, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { replyBank = bank; toast('استُرجع الافتراضي'); screenTexts(); }
  });
  document.getElementById('tx_gokSave').addEventListener('click', async () => {
    const txt = val('tx_gok').trim() || DEFAULT_GUEST_OK;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_welcome_ok', value: txt, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestWelcomeOk = txt; toast('تم حفظ ترحيب النجاح'); }
  });
  document.getElementById('tx_gfailSave').addEventListener('click', async () => {
    const txt = val('tx_gfail').trim() || DEFAULT_GUEST_FAIL;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_welcome_fail', value: txt, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestWelcomeFail = txt; toast('تم حفظ ترحيب الفشل'); }
  });
  document.getElementById('tx_lblSave').addEventListener('click', async () => {
    const next = { alive: val('tx_alive').trim() || LABELS_DEFAULT.alive, dead: val('tx_dead').trim() || LABELS_DEFAULT.dead, noissue: val('tx_noissue').trim() || LABELS_DEFAULT.noissue };
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'status_labels', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { statLabels = next; toast('تم حفظ المسميات'); screenTexts(); }
  });
}

/* ===== سجل التعديلات (من أضاف/عدّل/حذف الأسماء) ===== */
async function screenAudit() {
  if (!isAdmin() && !isManager()) { view().innerHTML = noPerm(); return; }
  const mine = !isAdmin();   // مشرف الفرع يرى أفعاله فقط (تقييد على الخادم أيضاً)
  showLoading(true);
  let list = [];
  try {
    const { data, error } = await sb.from('almfrje_audit').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    list = data || [];
  } catch (e) { showLoading(false); view().innerHTML = '<div class="center-empty">تعذّر تحميل السجل.<br>' + esc(e.message || '') + '</div>'; return; }
  showLoading(false);
  const actAr = { add: '➕ إضافة', edit: '✎ تعديل', delete: '🗑️ حذف' };
  const actCls = { add: 'add', edit: '', delete: 'off' };
  view().innerHTML = adminTabBar('audit') + `
    <div class="muted" style="margin-bottom:8px">${mine ? 'سجلّ تعديلاتك أنت (ضمن فرعك)' : 'كل إضافة/تعديل/حذف على الأسماء مع من قام به'} (${list.length}). التعديلات قابلة للتراجع في أي وقت.</div>
    ${isAdmin() && list.length ? `<button class="btn sm danger" id="audit_clear" style="margin-bottom:10px">🧹 تصفير سجل التعديلات</button>` : ''}
    ${list.length ? list.map(a => {
      const canUndo = a.action === 'edit' && a.undo_data && a.undo_data.items && a.undo_data.items.length && !a.undone;
      return `<div class="card" style="padding:10px">
      <div class="row" style="border:0;padding:0">
        <span class="k"><span class="badge ${actCls[a.action] || ''}">${actAr[a.action] || a.action}</span>
          ${a.person_id ? `<a href="#/person/${a.person_id}" style="color:var(--brand);text-decoration:none">${esc(a.person_name || '—')}</a>` : esc(a.person_name || '—')}</span>
        <span class="v" style="text-align:left">${esc(a.actor_name || '—')}<br><small class="muted">${fmtDateTime(a.created_at)}</small></span>
      </div>
      ${a.person_id && byId.get(a.person_id) ? `<div class="li-sub" style="margin-top:4px">📜 ${esc(lineageShort(a.person_id, 6))}</div>` : ''}
      ${canUndo ? `<div class="btn-row" style="margin-top:8px"><button class="btn sm outline" data-undo="${a.id}">↩ تراجع عن هذا التعديل</button></div>`
        : (a.undone ? `<div class="muted" style="margin-top:6px;font-size:.75rem">↩ تم التراجع${a.undone_by ? ' — ' + esc(a.undone_by) : ''}</div>` : '')}
      </div>`;
    }).join('') : noItem()}`;
  view().querySelectorAll('[data-undo]').forEach(b => b.addEventListener('click', () => {
    const row = list.find(x => String(x.id) === b.dataset.undo);
    if (row) undoFromAudit(row);
  }));
  { const cb = document.getElementById('audit_clear'); if (cb) cb.addEventListener('click', clearAudit); }
  bindGo();
}
// حذف كامل سجل التعديلات نهائياً (للمدير) — مع تأكيد مزدوج. يُلغي إمكانية التراجع عن التعديلات السابقة.
async function clearAudit() {
  if (!isAdmin()) return;
  if (!(await confirm2('⚠️ حذف كل سجل التعديلات نهائياً؟ سيُمسح كامل السجل، وتُلغى إمكانية التراجع عن التعديلات السابقة. (لا يؤثّر على بيانات الشجرة.)', { title: 'مسح السجل', okText: 'حذف الكل', danger: true }))) return;
  const typed = await uiPrompt('للتأكيد النهائي اكتب كلمة: حذف', { title: 'تأكيد نهائي', placeholder: 'حذف', okText: 'حذف نهائي' });
  if ((typed || '').trim() !== 'حذف') { toast('أُلغي المسح'); return; }
  const ok = await guard(async () => { const { error } = await sb.from('almfrje_audit').delete().neq('id', -1); if (error) throw error; });
  if (ok) { toast('تم مسح سجل التعديلات'); screenAudit(); }
}

/* ===== النسخ الاحتياطية (محفوظة في القاعدة — يطلبها المدير في أي وقت) ===== */
// تبويب «النسخ والتصدير» الموحّد (يتفرّع داخلياً بتبويبات حسب الدور)
let dataTab = 'export';
async function screenBackups() {
  // النسخ والتصدير والاستعادة — للمدير فقط (ضمن لوحة التحكم).
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const tabs = [];
  if (isAdmin()) tabs.push(['backup', '💾 النسخ الاحتياطية']);
  if (canExport()) tabs.push(['export', '📤 التصدير']);
  if (isAdmin()) tabs.push(['restore', '♻️ الاستعادة']);
  if (isAdmin()) tabs.push(['cloud', '☁️ النسخ السحابية']);
  if (!tabs.find(t => t[0] === dataTab)) dataTab = tabs[0][0];

  let list = [], cloudItems = [];
  if (dataTab === 'backup') {
    showLoading(true);
    try {
      const { data, error } = await sb.from('almfrje_backups')
        .select('id,label,note,persons_count,branches_count,actor_name,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error; list = data || [];
    } catch (e) { toast('تعذّر تحميل النسخ: ' + (e.message || e)); }
    showLoading(false);
  } else if (dataTab === 'cloud') {
    showLoading(true);
    try {
      const r = await cloudApi('list');
      if (r && r.ok) cloudItems = r.items || [];
      else if (r && r.error) toast(r.error);
    } catch (e) { toast('تعذّر تحميل النسخ السحابية'); }
    showLoading(false);
  }

  const tabsBar = `<div class="subtabs">${tabs.map(([k, l]) => `<button class="subtab ${dataTab === k ? 'active' : ''}" data-dtab="${k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (dataTab === 'backup') {
    body = `
      <div class="card"><h3>إنشاء نسخة احتياطية الآن ${hintBtn('backups')}</h3>
        <p class="muted" style="font-size:.85rem">تحفظ نسخة كاملة من البيانات في القاعدة، ترجع لها أو تنزّلها في أي وقت.</p>
        ${fInput('وصف مختصر (اختياري)', 'bk_label', '')}
        <div class="btn-row">
          <button class="btn" id="bk_create">💾 احفظ نسخة الآن</button>
          <button class="btn outline" id="bk_download">⤓ نزّل نسخة كملف</button>
        </div>
      </div>
      <div class="card"><h3>النسخ المحفوظة (${list.length})</h3>${list.length ? list.map(backupRow).join('') : noItem()}</div>`;
  } else if (dataTab === 'export') {
    body = `
      <div class="card"><h3>تصدير البيانات ${hintBtn('export')}</h3>
        <p class="muted" style="font-size:.85rem">نزّل البيانات كملف على جهازك.</p>
        <button class="btn" id="ex_full">💾 نسخة كاملة (JSON)</button>
        <button class="btn outline" id="ex_csv">📊 تصدير الأشخاص (CSV)</button>
      </div>`;
  } else if (dataTab === 'restore') {
    body = `
      <div class="card"><h3>استعادة من ملف</h3>
        <p class="muted" style="font-size:.85rem">ارفع ملف نسخة احتياطية (.json) لاستعادة البيانات. ستُستبدل البيانات الحالية.</p>
        <input id="rs_file" type="file" accept=".json">
        <button class="btn danger" id="rs_btn" style="margin-top:8px">♻️ استعادة من ملف</button>
      </div>`;
  } else if (dataTab === 'cloud') {
    body = `
      <div class="card"><h3>النسخ السحابية ☁️</h3>
        <p class="muted" style="font-size:.85rem">نسخة كاملة تُحفظ تلقائياً يومياً في تخزينٍ سحابيّ خاص (يُحتفظ بآخر ٣٠ نسخة). أنشئ نسخة الآن، أو نزّل/استعد من أي نسخة مباشرةً.</p>
        <button class="btn" id="cl_now">☁️ أنشئ نسخة سحابية الآن</button>
      </div>
      <div class="card"><h3>النسخ السحابية المحفوظة (${cloudItems.length})</h3>${cloudItems.length ? cloudItems.map(cloudRow).join('') : noItem()}</div>`;
  }
  view().innerHTML = adminTabBar('backups') + tabsBar + body;
  view().querySelectorAll('[data-dtab]').forEach(b => b.addEventListener('click', () => { dataTab = b.dataset.dtab; screenBackups(); }));
  // ربط أزرار كل تبويب
  const bc = document.getElementById('bk_create'); if (bc) bc.addEventListener('click', createDbBackup);
  const bd = document.getElementById('bk_download'); if (bd) bd.addEventListener('click', backupFull);
  const rb = document.getElementById('rs_btn'); if (rb) rb.addEventListener('click', restoreBackup);
  const ef = document.getElementById('ex_full'); if (ef) ef.addEventListener('click', backupFull);
  const ec = document.getElementById('ex_csv'); if (ec) ec.addEventListener('click', exportCsv);
  view().querySelectorAll('[data-bkdl]').forEach(b => b.addEventListener('click', () => downloadDbBackup(b.dataset.bkdl)));
  view().querySelectorAll('[data-bkrs]').forEach(b => b.addEventListener('click', () => restoreDbBackup(b.dataset.bkrs)));
  view().querySelectorAll('[data-bkdel]').forEach(b => b.addEventListener('click', () => deleteDbBackup(b.dataset.bkdel)));
  const cn = document.getElementById('cl_now'); if (cn) cn.addEventListener('click', cloudBackupNow);
  view().querySelectorAll('[data-cldl]').forEach(b => b.addEventListener('click', () => downloadCloud(b.dataset.cldl)));
  view().querySelectorAll('[data-clrs]').forEach(b => b.addEventListener('click', () => restoreCloud(b.dataset.clrs)));
}
// ===== النسخ السحابية (تخزين Supabase عبر /api/almfrje-backup) =====
function cloudRow(f) {
  const kb = (f.size != null) ? ' • ' + Math.max(1, Math.round(f.size / 1024)) + ' ك.ب.' : '';
  return `<div class="row" style="flex-wrap:wrap;gap:6px">
    <div style="flex:1;min-width:140px">
      <div class="li-title" style="font-size:.95rem">${esc(f.name)}</div>
      <div class="li-sub">${f.created_at ? fmtDateTime(f.created_at) : ''}${kb}</div>
    </div>
    <div class="btn-row" style="margin:0">
      <button class="btn sm outline" data-cldl="${esc(f.path)}">⤓ تنزيل</button>
      <button class="btn sm" data-clrs="${esc(f.path)}">♻️ استعادة</button>
    </div>
  </div>`;
}
async function cloudApi(action, extra) {
  const { data: { session } } = await sb.auth.getSession();
  const token = (session && session.access_token) || '';
  const res = await fetch('/api/almfrje-backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(Object.assign({ action }, extra || {})),
  });
  return res.json().catch(() => ({ ok: false, error: 'استجابة غير صالحة' }));
}
async function cloudBackupNow() {
  showLoading(true);
  try {
    const r = await cloudApi('run');
    if (r && r.ok) { toast('تم حفظ نسخة سحابية ✓'); screenBackups(); }
    else toast('تعذّرت النسخة السحابية: ' + ((r && r.error) || ''));
  } catch (e) { toast('تعذّر الاتصال بالخادم'); }
  showLoading(false);
}
async function downloadCloud(path) {
  const r = await cloudApi('get', { path });
  if (r && r.ok && r.url) window.open(r.url, '_blank');
  else toast('تعذّر التنزيل: ' + ((r && r.error) || ''));
}
async function restoreCloud(path) {
  const r = await cloudApi('get', { path });
  if (!r || !r.ok || !r.url) { toast('تعذّر جلب النسخة: ' + ((r && r.error) || '')); return; }
  let backup;
  try { backup = await (await fetch(r.url)).json(); }
  catch (e) { toast('تعذّرت قراءة الملف السحابي'); return; }
  await restoreFromObject(backup);   // يطلب تأكيداً بكتابة «استعادة» ثم يستعيد
}
// تصدير الأشخاص CSV (مستقلّ لإعادة الاستخدام)
function exportCsv() {
  const cell = s => { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['المعرف', 'الاسم', 'الأب', 'الفرع', 'الجيل', 'الجنس', 'الحالة', 'الميلاد', 'الوفاة', 'المدينة', 'الجوال'];
  const rows = C.persons.map(p => [p.id, p.name, (byId.get(p.father_id) || {}).name || '', branchName(p.branch_id), p.generation, arOf(SEX, p.sex), arOf(STATUS, p.status), p.birth, p.death, p.city, p.phone].map(cell).join(','));
  download('almfrje_persons.csv', '﻿' + head.join(',') + '\n' + rows.join('\n'), 'text/csv');
}
function backupRow(b) {
  return `<div class="row" style="flex-wrap:wrap;gap:6px">
    <div style="flex:1;min-width:140px">
      <div class="li-title" style="font-size:.95rem">${esc(b.label || 'نسخة')} </div>
      <div class="li-sub">${fmtDateTime(b.created_at)} • ${b.persons_count || 0} شخص • ${b.branches_count || 0} فرع${b.actor_name ? ' • ' + esc(b.actor_name) : ''}</div>
    </div>
    <div class="btn-row" style="margin:0">
      <button class="btn sm outline" data-bkdl="${b.id}">⤓ تنزيل</button>
      <button class="btn sm" data-bkrs="${b.id}">♻️ استعادة</button>
      <button class="btn sm danger" data-bkdel="${b.id}">حذف</button>
    </div></div>`;
}
async function createDbBackup() {
  if (!isAdmin()) return;
  const label = val('bk_label').trim();
  showLoading(true);
  const ok = await guard(async () => {
    const payload = await buildBackupObject();
    const { error } = await sb.from('almfrje_backups').insert({
      label: label || ('نسخة ' + new Date().toLocaleDateString('ar')),
      payload,
      persons_count: payload.counts.persons,
      branches_count: payload.counts.branches,
      actor_name: (me && (me.full_name || me.username)) || '',
    });
    if (error) throw error;
  });
  showLoading(false);
  if (ok) { toast('تم حفظ النسخة'); screenBackups(); }
}
async function fetchDbBackup(id) {
  const { data, error } = await sb.from('almfrje_backups').select('payload,label,created_at').eq('id', id).single();
  if (error) throw error;
  return data;
}
async function downloadDbBackup(id) {
  showLoading(true);
  try {
    const rec = await fetchDbBackup(id);
    const stamp = (rec.created_at || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, '-');
    download(`almfrje_backup_${stamp}.json`, JSON.stringify(rec.payload, null, 2), 'application/json');
  } catch (e) { toast('تعذّر التنزيل: ' + (e.message || e)); }
  showLoading(false);
}
async function restoreDbBackup(id) {
  try {
    const rec = await fetchDbBackup(id);
    await restoreFromObject(rec.payload);
  } catch (e) { toast('تعذّرت الاستعادة: ' + (e.message || e)); }
}
async function deleteDbBackup(id) {
  if (!(await confirm2('حذف هذه النسخة الاحتياطية؟'))) return;
  const ok = await guard(async () => { const { error } = await sb.from('almfrje_backups').delete().eq('id', id); if (error) throw error; });
  if (ok) { toast('تم الحذف'); screenBackups(); }
}

/* ===== الملف الشخصي (تعديل الجوال وكلمة المرور لأي مستخدم) ===== */
function screenProfile() {
  if (!me || isGuestUser()) { view().innerHTML = noPerm(); return; }
  view().innerHTML = `
    <div class="card"><div class="person-hd">${avatar({ sex: 'male' })}<div>
      <div class="li-title">${esc(me.full_name || '—')}</div>
      <div class="li-sub">${arOf(ROLES, me.role)}${me.username ? ' • @' + esc(me.username) : ''}</div></div></div></div>

    <div class="card"><h3>البيانات الأساسية</h3>
      ${fInput('الاسم الكامل', 'pf_name', me.full_name || '')}
      ${fInput('رقم الجوال (يُستخدم للدخول)', 'pf_phone', me.phone || '', 'tel', 'inputmode="tel"')}
      ${fInput('اسم المستخدم (اختياري)', 'pf_user', me.username || '', 'text', 'autocomplete="off"')}
      <button class="btn" id="pf_saveInfo">حفظ البيانات</button>
    </div>

    <div class="card"><h3>تغيير كلمة المرور (الرقم السري)</h3>
      <p class="muted" style="font-size:.85rem">رقم سري جديد من ٤ أرقام فأكثر. ستحتاجه في الدخول القادم.</p>
      ${pinField('الرقم السري الجديد', 'pf_pin')}
      ${pinField('تأكيد الرقم السري', 'pf_pin2')}
      <button class="btn" id="pf_savePin">تغيير كلمة المرور</button>
    </div>
    ${(isAdmin() || isManager()) ? `<div class="card"><h3>بياناتي في الشجرة</h3><div id="pf_person"></div></div>` : ''}`;
  // إظهار/إخفاء حقول الـ PIN
  view().querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => { const inp = document.getElementById(b.dataset.eye); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁'; }));

  document.getElementById('pf_saveInfo').addEventListener('click', async () => {
    const full_name = val('pf_name').trim();
    const phone = normPhone(val('pf_phone'));
    const username = val('pf_user').trim();
    if (!full_name) { toast('أدخل الاسم'); return; }
    if (phone.length < 7) { toast('أدخل رقم جوال صحيح'); return; }
    const phoneChanged = phone !== normPhone(me.phone || '');
    if (phoneChanged && !(await confirm2('تغيير الجوال يعني الدخول لاحقاً بالرقم الجديد. متابعة؟'))) return;
    const ok = await guard(async () => {
      // إن تغيّر الجوال، حدّث بريد المصادقة المشتق منه أيضاً
      if (phoneChanged) {
        const { error: ae } = await sb.auth.updateUser({ email: phoneToEmail(phone) });
        if (ae) throw ae;
      }
      const { error } = await sb.from('almfrje_members').update({ full_name, phone, username: username || null }).eq('user_id', me.user_id);
      if (error) throw error;
    });
    if (ok) { me.full_name = full_name; me.phone = phone; me.username = username || null; toast(phoneChanged ? 'تم الحفظ — استخدم الجوال الجديد بالدخول القادم' : 'تم حفظ البيانات'); }
  });

  document.getElementById('pf_savePin').addEventListener('click', async () => {
    const pin = val('pf_pin').trim(), pin2 = val('pf_pin2').trim();
    if (!PIN_RE.test(pin)) { toast('الرقم السري ٤ أرقام على الأقل'); return; }
    if (pin !== pin2) { toast('التأكيد غير مطابق'); return; }
    if (!(await confirm2('تغيير كلمة المرور؟ ستحتاج الرقم الجديد بالدخول القادم.'))) return;
    const ok = await guard(async () => {
      const { error } = await sb.auth.updateUser({ password: pinToPass(pin) });
      if (error) throw error;
    });
    if (ok) { toast('تم تغيير كلمة المرور'); document.getElementById('pf_pin').value = ''; document.getElementById('pf_pin2').value = ''; markPwChanged(); }
  });

  // ===== بياناتي في الشجرة: ربط الحساب بشخصه ثم تعديل (المدينة/الوظيفة/الجوال/سنة الميلاد) =====
  const myPersonKey = 'almfrje_me_person_' + me.user_id;
  const pickMine = () => pickPerson('اختر شخصك في الشجرة', (sel) => {
    if (!sel) return;
    if (!canEditPerson(sel)) { toast('اختر شخصاً ضمن صلاحيتك'); return; }
    try { localStorage.setItem(myPersonKey, String(sel.id)); } catch (e) { /* */ }
    renderMyPerson();
  }, (x) => canEditPerson(x));
  function renderMyPerson() {
    const box = document.getElementById('pf_person'); if (!box) return;
    let pid = 0; try { pid = parseInt(localStorage.getItem(myPersonKey) || '0', 10) || 0; } catch (e) { }
    const p = pid && byId.get(pid);
    if (!p) {
      box.innerHTML = `<p class="muted" style="font-size:.85rem">اربط حسابك بشخصك في الشجرة لتعديل بياناتك (المدينة، الحالة الوظيفية، الجوال، سنة الميلاد).</p><button class="btn outline" id="mp_pick">🔍 اختر شخصك في الشجرة</button>`;
      document.getElementById('mp_pick').addEventListener('click', pickMine);
      return;
    }
    box.innerHTML = `
      <div class="li-sub" style="margin-bottom:8px">👤 <b>${esc(p.name)}</b> — ${esc(lineageShort(p.id, 6))} <button class="btn sm outline" id="mp_change" style="margin-top:0;margin-inline-start:8px">تغيير الشخص</button></div>
      <div class="grid2">
        ${fInput('المدينة', 'mp_city', p.city || '')}
        ${fSelect('الحالة الوظيفية', 'mp_work', WORK, p.work || '')}
        ${fInput('الجوال', 'mp_phone', p.phone || '', 'tel', 'inputmode="tel"')}
        ${fInput('سنة الميلاد', 'mp_birth', p.birth || '')}
      </div>
      <button class="btn" id="mp_save">حفظ بياناتي</button>`;
    document.getElementById('mp_change').addEventListener('click', pickMine);
    document.getElementById('mp_save').addEventListener('click', () => saveMyPerson(p.id));
  }
  async function saveMyPerson(pid) {
    const p = byId.get(pid); if (!p) return;
    if (!canEditPerson(p)) { toast('لا تملك صلاحية تعديل هذا الشخص'); return; }
    const patch = { city: val('mp_city').trim(), work: val('mp_work'), phone: val('mp_phone').trim(), birth: val('mp_birth').trim(), updated_by_name: (me.full_name || me.username || ''), updated_at: new Date().toISOString() };
    const prev = { city: p.city ?? null, work: p.work ?? null, phone: p.phone ?? null, birth: p.birth ?? null, updated_by_name: p.updated_by_name ?? null, updated_at: p.updated_at ?? null };
    const ok = await guard(async () => {
      const { error } = await sb.from('almfrje_persons').update(patch).eq('id', pid); if (error) throw error;
      await auditLog('edit', pid, p.name, { kind: 'persons', items: [{ id: pid, prev }], label: p.name });
    });
    if (ok) { toast('تم حفظ بياناتك'); await loadAll(); screenProfile(); }
  }
  renderMyPerson();
}

/* ===== الأعضاء والصلاحيات ===== */
let expandedMember = null;   // user_id للعضو المفتوح حالياً
function screenMembers() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const list = C.members.slice().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  view().innerHTML = adminTabBar('members') + `
    <div class="card"><div class="li-title">➕ إضافة عضو جديد ${hintBtn('add_user')}</div>
      <div class="li-sub">أنشئ حساباً وحدّد الفروع التي يُشرف عليها وصلاحياته.</div>
      <button class="btn sm" id="addUserBtn" style="margin-top:6px">➕ إضافة عضو</button></div>

    ${(() => {
      const pend = list.filter(m => !m.is_active && m.role === 'viewer' && m.person_id);
      if (!pend.length) return '';
      return `<div class="card" style="border-inline-start:4px solid #e8590c"><h3>🆕 طلبات تسجيل بانتظار التحقق (${pend.length})</h3>
        <p class="muted" style="font-size:.82rem;margin-top:-4px">سجّلوا بأنفسهم بعد دخولهم بأسمائهم — تحقّق من صحة البيانات ثم فعّل.</p>
        ${pend.map(m => { const p = m.person_id ? byId.get(Number(m.person_id)) : null; return `
        <div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px">
          <div style="font-weight:800">${esc(m.full_name || '—')}</div>
          <div class="li-sub" style="margin-top:2px">📱 ${esc(m.phone || '—')}${p && p.phone && normPhone(p.phone) !== normPhone(m.phone || '') ? ' <span style="color:var(--danger);font-weight:700">≠ جوال ملفه (' + esc(p.phone) + ')</span>' : ''}</div>
          ${p ? `<div class="li-sub">🌳 ${esc(lineageShort(p.id, 6))}</div>
          <div class="li-sub">${p.nickname ? 'اللقب: ' + esc(p.nickname) + ' • ' : ''}${p.city ? 'المدينة: ' + esc(p.city) + ' • ' : ''}${p.birth ? 'الميلاد: ' + esc(p.birth) : ''}</div>` : '<div class="li-sub" style="color:var(--danger)">⚠️ لا ربط بشخصٍ في الشجرة</div>'}
          <div class="btn-row" style="margin-top:8px">
            ${p ? `<button class="btn sm outline" data-go="#/person/${p.id}">👁 ملفه بالشجرة</button>` : ''}
            <button class="btn sm" data-regok="${m.user_id}">✅ تحقّقت — تفعيل</button>
            <button class="btn sm danger" data-regno="${m.user_id}">❌ رفض وحذف</button>
          </div>
        </div>`; }).join('')}</div>`;
    })()}
    <div class="card"><h3>الأعضاء (${list.length}) ${hintBtn('member_role')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">اضغط على اسم لعرض تفاصيله والتحكّم به.</p>
      <div class="mlist">${list.map(memberRow).join('')}</div>
    </div>`;
  const au = document.getElementById('addUserBtn'); if (au) au.addEventListener('click', addUserModal);

  view().querySelectorAll('[data-regok]').forEach(b => b.addEventListener('click', async () => {
    const uid = b.dataset.regok;
    if (!(await confirm2('تحقّقت من صحة البيانات وتريد تفعيل الحساب؟ سيتمكن صاحبه من الدخول والاطلاع على رسائله.', { title: 'تفعيل بعد التحقق', okText: 'تفعيل' }))) return;
    const ok = await guard(async () => { await updMember(uid, { is_active: true }); });
    if (ok) { toast('فُعِّل الحساب ✓'); await loadAll(); screenMembers(); }
  }));
  view().querySelectorAll('[data-regno]').forEach(b => b.addEventListener('click', async () => {
    const uid = b.dataset.regno;
    if (!(await confirm2('رفض طلب التسجيل وحذف الحساب؟ (لا يمسّ بياناته في الشجرة)', { danger: true, okText: 'رفض وحذف' }))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_members').delete().eq('user_id', uid); if (error) throw error; });
    if (ok) { toast('رُفض الطلب وحُذف الحساب'); await loadAll(); screenMembers(); }
  }));
  bindGo();
  bindMemberRows();
}
// صف عضو: اسم فقط (مطويّ)، أو اسم + بطاقة كاملة (مفتوح)
function memberRow(m) {
  const open = expandedMember === m.user_id;
  const sub = `${arOf(ROLES, m.role)}${m.is_active ? '' : ' • موقوف'}`;
  return `<div class="mitem ${open ? 'open' : ''}">
    <div class="mitem-head" data-mhead="${m.user_id}">
      <span class="mitem-name">${esc(m.full_name || '—')} ${m.user_id === me.user_id ? '<span class="badge">أنت</span>' : ''}</span>
      <span class="mitem-sub">${esc(sub)}</span>
      <span class="mitem-arrow">${open ? '▴' : '▾'}</span>
    </div>
    ${open ? `<div class="mitem-body">${memberCardBody(m)}</div>` : ''}
  </div>`;
}
function bindMemberRows() {
  view().querySelectorAll('[data-mhead]').forEach(h => h.addEventListener('click', () => {
    const uid = h.dataset.mhead;
    expandedMember = (expandedMember === uid) ? null : uid;
    screenMembers();
  }));
  // اربط أزرار البطاقة المفتوحة فقط
  if (expandedMember) { const m = C.members.find(x => x.user_id === expandedMember); if (m) bindMemberCard(m); }
}
// مجموعة فروع العضو الحالية (مصفوفة + المفرد القديم)
function memberBranchSet(m) {
  const s = new Set((Array.isArray(m.branch_ids) ? m.branch_ids : []).map(Number));
  if (m.branch_id) s.add(Number(m.branch_id));
  return s;
}
const ROLE_HINT = {
  admin: 'صلاحيات كاملة على كل الأقسام والإدارة.',
  general_manager: 'مشرف على كل الفروع (أو فروعٍ تحدّدها أدناه): يطّلع ويتّخذ الإجراء فيها بكامل المسؤولية، حسب الصلاحيات المؤشّرة. أدوات إدارة الموقع للمدير فقط.',
  branch_manager: 'يعمل ضمن فروعه المحدّدة فقط: يطّلع ويتّخذ الإجراء فيها بكامل المسؤولية، حسب الصلاحيات المؤشّرة. الحذف وأدوات الإدارة للمدير فقط.',
  viewer: 'تصفّح فقط.',
};
function memberCardBody(m) {
  const roleOpts = ROLES.map(r => `<option value="${r.k}" ${m.role === r.k ? 'selected' : ''}>${r.ar}</option>`).join('');
  const bset = memberBranchSet(m);
  const branchChks = C.branches.length
    ? C.branches.map(b => `<label class="perm-chk"><input type="checkbox" data-mbranch="${b.id}" data-uid="${m.user_id}" ${bset.has(Number(b.id)) ? 'checked' : ''}><span>${esc(b.name)}</span></label>`).join('')
    : '<div class="muted">لا فروع بعد.</div>';
  const showSup = m.role === 'branch_manager' || m.role === 'general_manager';   // المشرفان: فروع + صلاحيات
  const pset = (m.perms && typeof m.perms === 'object') ? m.perms : {};
  const noPerms = Object.keys(pset).length === 0;   // مشرف بلا تحديد = الكل مفعّل
  const permChks = MGR_PERMS.map(([k, l]) => `<label class="perm-chk"><input type="checkbox" data-mperm="${k}" data-uid="${m.user_id}" ${(noPerms || pset[k]) ? 'checked' : ''}><span>${l}</span></label>`).join('');
  return `
    <div class="li-sub">${m.phone ? '📱 ' + esc(m.phone) : 'بلا جوال'}${m.phone && m.username ? ' • ' : ''}${m.username ? '@' + esc(m.username) : ''} <span class="badge ${m.is_active ? '' : 'off'}">${m.is_active ? 'مفعّل' : 'موقوف'}</span></div>
    <div class="field" style="margin-top:8px"><label>الدور</label><select data-role="${m.user_id}">${roleOpts}</select></div>
    <div class="perm-note" data-rolehint="${m.user_id}" style="margin:-4px 0 8px">${ROLE_HINT[m.role] || ''}</div>
    <div class="perm-box" data-branchbox="${m.user_id}" style="${showSup ? '' : 'display:none'}">
      <div class="perm-title">الفروع التي يشرف عليها <span class="muted" style="font-weight:normal">(للمشرف العام: اتركها فارغة = كل الفروع)</span>:</div>
      ${branchChks}
    </div>
    <div class="perm-box" data-permbox="${m.user_id}" style="${showSup ? '' : 'display:none'}">
      <div class="perm-title">صلاحياته:</div>
      ${permChks}
    </div>
    <div class="btn-row">
      <button class="btn sm outline" data-edit="${m.user_id}">✎ تعديل البيانات</button>
      <button class="btn sm ${m.is_active ? 'danger' : ''}" data-toggle="${m.user_id}" ${m.user_id === me.user_id ? 'disabled' : ''}>${m.is_active ? 'إيقاف' : 'تفعيل'}</button>
      <button class="btn sm" data-save="${m.user_id}">حفظ الدور</button>
      ${m.user_id !== me.user_id ? `<button class="btn sm outline" data-del="${m.user_id}">حذف الحساب</button>` : ''}
    </div>`;
}
function bindMemberCard(m) {
  const q = (s) => view().querySelector(s);
  const ed = q(`[data-edit="${m.user_id}"]`); if (ed) ed.addEventListener('click', () => editUserDataModal(m));
  // إظهار/إخفاء صندوق الفروع وتلميح الدور حسب الدور المختار
  const roleSel = q(`[data-role="${m.user_id}"]`);
  if (roleSel) roleSel.addEventListener('change', () => {
    const r = roleSel.value, sup = (r === 'branch_manager' || r === 'general_manager');
    const box = q(`[data-branchbox="${m.user_id}"]`); if (box) box.style.display = sup ? '' : 'none';
    const pbox = q(`[data-permbox="${m.user_id}"]`); if (pbox) pbox.style.display = sup ? '' : 'none';
    const hint = q(`[data-rolehint="${m.user_id}"]`); if (hint) hint.textContent = ROLE_HINT[r] || '';
  });
  const tg = q(`[data-toggle="${m.user_id}"]`); if (tg) tg.addEventListener('click', async () => { const ok = await guard(async () => { await updMember(m.user_id, { is_active: !m.is_active }); }); if (ok) { await loadAll(); screenMembers(); } });
  const sv = q(`[data-save="${m.user_id}"]`); if (sv) sv.addEventListener('click', async () => {
    const role = q(`[data-role="${m.user_id}"]`).value;
    const isSup = role === 'branch_manager' || role === 'general_manager';
    const branch_ids = [];
    if (isSup) view().querySelectorAll(`input[data-mbranch][data-uid="${m.user_id}"]`).forEach(cb => { if (cb.checked) branch_ids.push(parseInt(cb.dataset.mbranch, 10)); });
    const perms = {};
    if (isSup) view().querySelectorAll(`input[data-mperm][data-uid="${m.user_id}"]`).forEach(cb => { perms[cb.dataset.mperm] = cb.checked; });
    if (role === 'branch_manager' && !branch_ids.length) { toast('اختر فرعاً واحداً على الأقل لمشرف الفرع'); return; }
    const ok = await guard(async () => { await updMember(m.user_id, {
      role,
      branch_ids: isSup ? branch_ids : [],
      branch_id: isSup && branch_ids.length ? branch_ids[0] : null,   // توافق مع القديم
      perms: isSup ? perms : {},
    }); });
    if (ok) { toast('تم الحفظ'); await loadAll(); screenMembers(); }
  });
  const dl = q(`[data-del="${m.user_id}"]`); if (dl) dl.addEventListener('click', async () => {
    if (!(await confirm2('حذف هذا الحساب؟ (لا يحذف بياناته في الشجرة)'))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_members').delete().eq('user_id', m.user_id); if (error) throw error; });
    if (ok) { toast('تم الحذف'); await loadAll(); screenMembers(); }
  });
}
async function updMember(uid, obj) { const { error } = await sb.from('almfrje_members').update(obj).eq('user_id', uid); if (error) throw error; }

// نافذة تعديل بيانات مستخدم (للمدير): الاسم/الجوال/كلمة المرور لأي حساب بما فيهم المدير.
// تغيير الجوال/كلمة المرور لمستخدم آخر يتطلّب صلاحية إدارية على الخادم (/api/almfrje-admin).
function editUserDataModal(m) {
  if (!isAdmin()) return;
  openModal('تعديل بيانات: ' + (m.full_name || '—'), `
    ${fInput('الاسم الكامل', 'eu_name', m.full_name || '')}
    ${fInput('رقم الجوال (للدخول)', 'eu_phone', m.phone || '', 'tel', 'inputmode="tel"')}
    ${fInput('اسم المستخدم (اختياري)', 'eu_user', m.username || '', 'text', 'autocomplete="off"')}
    <div class="muted" style="font-size:.85rem;margin:6px 0">اتركه فارغاً لعدم تغيير كلمة المرور:</div>
    ${pinField('رقم سري جديد (٤ أرقام فأكثر)', 'eu_pin')}
    <button class="btn" id="eu_save">حفظ التعديلات</button>`, () => {
    document.querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => { const inp = document.getElementById(b.dataset.eye); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁'; }));
    document.getElementById('eu_save').addEventListener('click', async () => {
      const full_name = val('eu_name').trim();
      const phone = normPhone(val('eu_phone'));
      const username = val('eu_user').trim();
      const pin = val('eu_pin').trim();
      if (!full_name) { toast('أدخل الاسم'); return; }
      if (phone && phone.length < 7) { toast('رقم جوال غير صحيح'); return; }
      if (pin && !PIN_RE.test(pin)) { toast('الرقم السري ٤ أرقام على الأقل'); return; }
      if (!(await confirm2('حفظ تعديل بيانات هذا العضو؟'))) return;
      const ok = await guard(async () => {
        const { data: { session } } = await sb.auth.getSession();
        const tok = session && session.access_token;
        const r = await fetch('/api/almfrje-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (tok || '') },
          body: JSON.stringify({ user_id: m.user_id, full_name, phone, username, pin: pin || undefined }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || ('فشل (' + r.status + ')'));
      });
      if (ok) { toast('تم حفظ التعديلات'); closeModal(); await loadAll(); screenMembers(); }
    });
  });
}

// نافذة «إضافة مستخدم» — ينشئ الحساب ويحدّد الفروع والصلاحيات
function addUserModal() {
  if (!isAdmin()) return;
  const roleOpts = ROLES.map(r => `<option value="${r.k}">${r.ar}</option>`).join('');
  const branchChks = C.branches.length
    ? C.branches.map(b => `<label class="perm-chk"><input type="checkbox" data-nubranch="${b.id}"><span>${esc(b.name)}</span></label>`).join('')
    : '<div class="muted">لا فروع بعد.</div>';
  const permChksNew = MGR_PERMS.map(([k, l]) => `<label class="perm-chk"><input type="checkbox" data-nuperm="${k}" checked><span>${l}</span></label>`).join('');
  openModal('إضافة مستخدم جديد', `
    <div class="field">
      <label>الاسم (يُختار من الشجرة — لا بدّ أن يكون حيّاً)</label>
      <input id="nu_search" type="text" placeholder="اكتب الاسم ثم اسم أبيه (مثال: سالم خالد) *" autocomplete="off">
      <div id="nu_results" style="max-height:200px;overflow:auto"></div>
      <div id="nu_selected" class="muted" style="margin-top:6px"></div>
    </div>
    ${fInput('رقم الجوال', 'nu_phone', '', 'tel', 'inputmode="tel"')}
    ${fInput('اسم المستخدم (اختياري)', 'nu_user', '', 'text', 'autocomplete="off"')}
    ${pinField('الرقم السري (٤ أرقام فأكثر)', 'nu_pin')}
    <div class="field"><label>الدور</label><select id="nu_role">${roleOpts}</select></div>
    <div id="nu_mgrbox">
      <div class="perm-box"><div class="perm-title">الفروع التي يشرف عليها <span class="muted" style="font-weight:normal">(للمشرف العام: اتركها فارغة = كل الفروع)</span>:</div>${branchChks}</div>
      <div class="perm-box"><div class="perm-title">صلاحياته:</div>${permChksNew}</div>
    </div>
    <div id="nu_rolenote" class="muted" style="font-size:.85rem;margin:6px 0"></div>
    <button class="btn" id="nu_save">إنشاء الحساب وتفعيله</button>`, () => {
    const roleSel = document.getElementById('nu_role');
    const mgrBox = document.getElementById('nu_mgrbox');
    const roleNote = document.getElementById('nu_rolenote');
    const syncRole = () => {
      const r = roleSel.value;
      mgrBox.style.display = (r === 'branch_manager' || r === 'general_manager') ? '' : 'none';
      roleNote.textContent = ROLE_HINT[r] || '';
    };
    roleSel.addEventListener('change', syncRole); syncRole();

    // الاسم يُنتقى من الشجرة (حيّ فقط) — كطريقة دخول الزائر/إضافة المواليد
    let nuPerson = null;
    const nuSearch = document.getElementById('nu_search');
    nuSearch.addEventListener('input', () => fbPickerSearch(nuSearch.value, document.getElementById('nu_results'), true, (p) => {
      nuPerson = p;
      document.getElementById('nu_selected').innerHTML = p ? '<div style="padding:8px 10px;border:1px solid var(--brand);border-radius:8px;font-size:.9rem">✅ الاسم: <b>' + esc(lineageShort(p.id, 12)) + '</b></div>' : '';
      nuSearch.value = p ? p.name : '';
    }));

    document.getElementById('nu_save').addEventListener('click', async () => {
      if (!nuPerson) { toast('اختر الاسم من الشجرة (لا بدّ أن يكون حيّاً)'); return; }
      // اسمٌ نظيف بلا علامة الاختصار «…» (كانت تفسد مطابقة نسبه لاحقاً)
      const full_name = lineage(nuPerson.id).slice(0, 4).map(x => x.name).join(' بن ');
      const phone = normPhone(val('nu_phone'));
      const username = val('nu_user').trim();
      const pin = val('nu_pin').trim();
      const role = roleSel.value;
      if (!full_name) { toast('تعذّر تحديد الاسم'); return; }
      if (phone.length < 7) { toast('أدخل رقم جوال صحيح'); return; }
      if (!PIN_RE.test(pin)) { toast('الرقم السري ٤ أرقام على الأقل'); return; }
      const isSup = role === 'branch_manager' || role === 'general_manager';
      const branch_ids = [];
      if (isSup) document.querySelectorAll('input[data-nubranch]').forEach(cb => { if (cb.checked) branch_ids.push(parseInt(cb.dataset.nubranch, 10)); });
      const perms = {};
      if (isSup) document.querySelectorAll('input[data-nuperm]').forEach(cb => { perms[cb.dataset.nuperm] = cb.checked; });
      if (role === 'branch_manager' && !branch_ids.length) { toast('اختر فرعاً واحداً على الأقل لمشرف الفرع'); return; }
      if (role === 'admin' && !(await confirm2('إنشاء مستخدم بصلاحية مدير نظام كاملة؟'))) return;
      const ok = await guard(async () => {
        // الإنشاء من جهة الخادم (مفتاح خدمي، بريد مؤكَّد تلقائياً) — لا يتأثّر بإعداد «تأكيد البريد».
        const { data: { session } } = await sb.auth.getSession();
        const token = session && session.access_token;
        if (!token) throw new Error('انتهت الجلسة — أعد تسجيل الدخول');
        const res = await fetch('/api/almfrje-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ full_name, username, phone, pin, role, branch_ids: isSup ? branch_ids : [], perms, person_id: nuPerson.id }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.error || 'تعذّر إنشاء الحساب');
      });
      if (ok) { closeModal(); toast('تم إنشاء الحساب وتفعيله'); await loadAll(); screenMembers(); }
    });
  });
}

/* ===== سلة المحذوفات ===== */
async function screenTrash() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  showLoading(true);
  let list = [];
  try { const { data } = await sb.from('almfrje_trash').select('*').order('created_at', { ascending: false }); list = data || []; } catch (e) { toast('خطأ تحميل'); }
  showLoading(false);
  const actionAr = { delete: 'محذوف', edit: 'نسخة قبل تعديل' };
  view().innerHTML = adminTabBar('trash') + `<div class="muted" style="margin-bottom:8px">نُسخ محفوظة قبل التعديل/الحذف — يمكن استعادتها. «حذف من السلة» يزيل النسخة المحفوظة فقط، ولا يحذف الاسم من الشجرة.</div>`
    + (list.length ? `<button class="btn sm danger" id="trash_clear" style="margin-bottom:10px">🧹 تصفير سلة المحذوفات</button>` : '')
    + (list.length ? list.map(t => `<div class="card"><div class="li-title">${esc(t.label || t.tbl)}</div>
        <div class="li-sub"><span class="badge ${t.action === 'delete' ? 'off' : ''}">${actionAr[t.action] || t.action}</span> ${fmtDateTime(t.created_at)} • ${esc(t.actor_name || '')}</div>
        <div class="btn-row" style="margin-top:6px"><button class="btn sm" data-rest="${t.id}">استعادة</button><button class="btn sm danger" data-perm="${t.id}">🗑️ حذف من السلة</button></div></div>`).join('') : '<div class="center-empty">السلة فارغة.</div>');
  view().querySelectorAll('[data-rest]').forEach(b => b.addEventListener('click', () => restoreTrash(list.find(x => String(x.id) === b.dataset.rest))));
  view().querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirm2('حذف هذه النسخة من السلة نهائياً؟ لن تتمكّن من استعادتها لاحقاً. (لا يحذف الاسم من الشجرة.)', { title: 'حذف من السلة', okText: 'حذف', danger: true }))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_trash').delete().eq('id', b.dataset.perm); if (error) throw error; });
    if (ok) { toast('حُذفت النسخة من السلة'); screenTrash(); }
  }));
  { const cb = document.getElementById('trash_clear'); if (cb) cb.addEventListener('click', clearTrash); }
}
// تصفير سلة المحذوفات بالكامل (للمدير) — يحذف كل النُّسخ المحفوظة، ولا يمسّ أسماء الشجرة.
async function clearTrash() {
  if (!isAdmin()) return;
  if (!(await confirm2('تصفير سلة المحذوفات بالكامل؟ تُحذف كل النُّسخ المحفوظة نهائياً ولا يمكن استعادتها. (لا يؤثّر على أسماء الشجرة.)', { title: 'تصفير السلة', okText: 'تصفير', danger: true }))) return;
  const typed = await uiPrompt('للتأكيد النهائي اكتب كلمة: حذف', { title: 'تأكيد نهائي', placeholder: 'حذف', okText: 'تصفير' });
  if ((typed || '').trim() !== 'حذف') { toast('أُلغي التصفير'); return; }
  const ok = await guard(async () => { const { error } = await sb.from('almfrje_trash').delete().neq('id', -1); if (error) throw error; });
  if (ok) { toast('تم تصفير سلة المحذوفات'); screenTrash(); }
}
async function restoreTrash(t) {
  if (!t) return;
  const data = Object.assign({}, t.data); delete data.created_at; delete data._n;
  const ok = await guard(async () => {
    if (t.action === 'edit') { const id = data.id; delete data.id; const { error } = await sb.from(TABLES[t.tbl]).update(data).eq('id', t.rec_id || id); if (error) throw error; }
    else { delete data.id; const { error } = await sb.from(TABLES[t.tbl]).insert(data); if (error) throw error; }
    const { error: de } = await sb.from('almfrje_trash').delete().eq('id', t.id); if (de) throw de;
  });
  if (ok) { toast('تمت الاستعادة'); await loadAll(); screenTrash(); }
}

/* ===== المودال ===== */
function openModal(title, body, onMount, opts) {
  opts = opts || {};
  const root = document.getElementById('modalRoot');
  const closeBtn = opts.noClose ? '' : `<button class="btn outline" id="modalClose" style="margin-top:10px">إلغاء</button>`;
  root.innerHTML = `<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3>${body}${closeBtn}</div></div>`;
  if (!opts.noBgClose) root.querySelector('.modal-bg').addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) closeModal(); });
  { const cb = document.getElementById('modalClose'); if (cb) cb.addEventListener('click', closeModal); }
  bindHints(root);
  if (onMount) onMount();
  bindEyes(root);   // فعّل أزرار العين بعد بناء محتوى النافذة
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }
// ===== رسالة الترحيب/المبارَكة — تظهر في الجزء الأوسط العلوي فور الدخول =====
function showGreeting(firstName) {
  // تظهر مرّة واحدة لكل جلسة تصفّح — لا تتكرّر مع كل تحديث للصفحة (تُصفَّر عند تسجيل دخول فعلي)
  try { if (sessionStorage.getItem('almfrje_greeted') === '1') return; } catch (e) { /* */ }
  const c = congratsActive();
  let welcomeHtml = '';
  if (isGuestUser() && firstName) {
    const msg = (guestWelcomeOk || DEFAULT_GUEST_OK).replace(/\{name\}/g, firstName);
    welcomeHtml = `<div class="greet-welcome">${esc(msg)}</div>`;
  }
  let congHtml = '';
  if (c) {
    congHtml = `<div class="greet-congrats">${congratsTitle(c) ? `<span class="greet-congrats-badge">${esc(congratsTitle(c))}</span>` : ''}<div class="greet-congrats-text" style="color:${okColor(c.color)}">${esc(c.text)}</div></div>`;
  }
  if (!welcomeHtml && !congHtml) return;
  try { sessionStorage.setItem('almfrje_greeted', '1'); } catch (e) { /* */ }
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="greet-bg"><div class="greet-card">${welcomeHtml}${congHtml}<button class="btn btn-lg" id="greetOk">🌳 ابدأ التصفّح</button></div></div>`;
  const close = () => { const r = document.getElementById('modalRoot'); if (r) r.innerHTML = ''; };
  const gb = document.getElementById('greetOk'); if (gb) gb.addEventListener('click', close);
  const bg = root.querySelector('.greet-bg'); if (bg) bg.addEventListener('click', e => { if (e.target.classList.contains('greet-bg')) close(); });
}

/* ===== شاشة بانتظار التفعيل ===== */
function renderPending() {
  document.getElementById('screenTitle').textContent = 'المفارجة';
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('bottomnav').innerHTML = '';
  document.querySelectorAll('.fab').forEach(f => f.remove());
  view().innerHTML = `<div class="center-empty"><div style="font-size:3rem">⏳</div>
    <h3>حسابك بانتظار التفعيل</h3>
    <p class="muted">تم إنشاء حسابك. يرجى أن يقوم مدير النظام بتفعيلك ومنحك الدور المناسب، ثم أعد تسجيل الدخول.</p>
    <div class="muted">${esc((me && me.full_name) || '')}</div></div>`;
}

/* ===== المصادقة (جوال/اسم مستخدم + رقم سري ٤ أرقام) ===== */
function buildNav() {
  const tabs = [['#/home', '🏠', 'الرئيسية'], ['#/search', '🔍', 'البحث'], ['#/tree', '🌳', 'الشجرة'], ['#/about', 'ℹ️', 'نبذة تعريفية'], ['#/more', '☰', 'المزيد']];
  const nav = document.getElementById('bottomnav');
  nav.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
  nav.innerHTML = tabs.map(([r, i, l]) => `<button class="nav-item" data-route="${r}"><span class="nav-ico">${i}${r === '#/more' ? '<span class="nav-badge" id="moreBadge" hidden></span>' : ''}</span>${l}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => setHash(b.dataset.route)));
  updateMoreBadge();
}
// شارة عدد الملاحظات التي تخصّ المدير/المشرف (ضمن صلاحياته) على تبويب «المزيد».
function updateMoreBadge() {
  const el = document.getElementById('moreBadge'); if (!el) return;
  const n = (isAdmin() || isManager()) ? (C.feedbackPending || 0) : 0;
  if (n > 0) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = false; } else { el.hidden = true; }
}
// تطبيع الجوال بأي صيغة إلى 05XXXXXXXX: أرقام عربية/فارسية، مسافات/شرطات، +966/00966/966/5XXXXXXXX
const normPhone = (s) => {
  let d = String(s || '').replace(/[٠-٩]/g, ch => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/[۰-۹]/g, ch => '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)).replace(/\D/g, '');
  if (d.startsWith('00966')) d = d.slice(5); else if (d.startsWith('966')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = '0' + d;
  return d;
};
const phoneToEmail = (p) => `${p}@almfrje.app`;
const pinToPass = (pin) => `${pin}@Almfrje`;
// تتبّع نصح تغيير كلمة المرور لأول دخول (لكل مستخدم على هذا الجهاز).
const pwKey = () => 'almfrje_pwok_' + (me && me.user_id || '');
function pwChanged() { try { return localStorage.getItem(pwKey()) === '1'; } catch (e) { return true; } }
function markPwChanged() { try { localStorage.setItem(pwKey(), '1'); } catch (e) { } }
const PIN_RE = /^\d{4,}$/;   // ٤ خانات حدّاً أدنى، ويُسمح بالزيادة
function pinField(label, id) {
  return `<div class="field pw"><label>${label}</label>
    <input id="${id}" type="password" inputmode="numeric" pattern="\\d*" autocomplete="off">
    <button type="button" class="eye" data-eye="${id}" aria-label="إظهار/إخفاء">👁</button></div>`;
}
// ربط أزرار العين (إظهار/إخفاء كلمة المرور) ضمن أي حاوية.
function bindEyes(root) {
  (root || document).querySelectorAll('.eye').forEach(b => {
    if (b._eyeBound) return; b._eyeBound = true;
    b.addEventListener('click', () => { const inp = document.getElementById(b.dataset.eye); if (!inp) return; const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁'; });
  });
}
// حساب الزائر المدمج للتصفّح بلا تسجيل (قراءة فقط) — بيانات ثابتة معروفة.
const GUEST_EMAIL = 'guest@almfrje.app';
const GUEST_PASS = 'guest@Almfrje1';
async function rpcEnsureGuest() {
  let { data, error } = await sb.rpc('almfrje_ensure_guest');
  if (error && /does not exist|schema cache/i.test(error.message || '')) {
    try { await fetch('/api/almfrje-setup', { method: 'POST' }); } catch (e) { /* تجاهل */ }
    await new Promise(r => setTimeout(r, 1200));
    ({ data } = await sb.rpc('almfrje_ensure_guest'));
  }
  return data;
}
// ===== انتهاء جلسة الزائر: عند الخروج والعودة (sessionStorage يُمسح بإغلاق التبويب)،
//       أو بعد ساعة خمول، أو بزرّ الخروج. =====
const GUEST_IDLE_MS = 60 * 60 * 1000;   // ساعة
function bumpGuestTs() { try { sessionStorage.setItem('almfrje_guest_ts', String(Date.now())); } catch (e) { /* تجاهل */ } }
function guestSessionFresh() {
  try { const ts = parseInt(sessionStorage.getItem('almfrje_guest_ts') || '0', 10); return !!ts && (Date.now() - ts) < GUEST_IDLE_MS; } catch (e) { return false; }
}
async function endGuestSession() { stopPresence(); try { sessionStorage.removeItem('almfrje_guest_ts'); } catch (e) { /* */ } _authUid = null; me = null; try { await sb.auth.signOut(); } catch (e) { /* */ } }
async function browseAsGuest(msgEl) {
  // لا نُصفّر علامة الترحيب هنا: قد تُستدعى تلقائياً عند تحديث الصفحة/تجديد الجلسة،
  // فالتصفير يقتصر على الدخول اليدوي الفعلي (كتابة الاسم / زر التصفّح / دخول المسؤول).
  try {
    let { error } = await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASS });
    if (error) {
      // أول مرة: أنشئ الحساب ثم ادخل به
      await sb.auth.signUp({ email: GUEST_EMAIL, password: GUEST_PASS, options: { data: { full_name: 'زائر', username: 'guest' } } });
      await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASS });
    }
    await rpcEnsureGuest();   // فعّل دور viewer للحساب المخصّص (آمن — لا يمنح أعلى)
    const { data: { session } } = await sb.auth.getSession();
    if (session) { _authUid = session.user.id; bumpGuestTs(); await enterApp(session); return true; }
    if (msgEl) { msgEl.classList.add('err'); msgEl.textContent = 'تعذّر فتح وضع الزائر'; }
    return false;
  } catch (e) { if (msgEl) { msgEl.classList.add('err'); msgEl.textContent = translateAuthError(e.message); } return false; }
}
// بوابة دخول الزائر (تلقائية): تتحقّق فور كتابة اسمين فأكثر، وتُدخله بمجرد أن يصبح اسمه فريداً — بلا زر.
let _gateBusy = false;
async function guestGateEnter() {
  if (_gateBusy) return;
  const m = document.getElementById('a_msg'); if (!m) return;
  const inp = (val('g_lineage') || '').trim();
  const names = inp.split(/\s+/).filter(w => w && w !== 'بن' && w !== 'ابن');
  m.className = 'auth-msg';
  if (names.length < 3) { m.textContent = names.length === 0 ? 'اكتب اسمك ثم أباك ثم جدّك…' : names.length === 1 ? 'تابع: اكتب اسم أبيك…' : 'تابع: اكتب اسم جدّك…'; return; }
  const firstName = names[0];
  _gateBusy = true; m.textContent = '… جارٍ التحقق';
  try {
    const res = await fetch('/api/almfrje-guest-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inp }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      try { sessionStorage.setItem('almfrje_guest_name', (j.name && String(j.name).trim()) || inp); if (j.branch != null) sessionStorage.setItem('almfrje_guest_branch', String(j.branch)); if (j.pid) sessionStorage.setItem('almfrje_guest_pid', String(j.pid)); sessionStorage.setItem('almfrje_guest_hasphone', j.has_phone ? '1' : '0'); sessionStorage.setItem('almfrje_guest_hasacct', j.has_account ? '1' : '0'); sessionStorage.removeItem('almfrje_greeted'); sessionStorage.removeItem('almfrje_onboard'); } catch (e) { /* */ }
      location.hash = '#/home';
      // رسالة الترحيب تظهر الآن فور الدخول من داخل enterApp (الجزء الأوسط العلوي) — لا نافذة مؤجَّلة هنا
      await browseAsGuest(m);
    } else if (j.error) {
      // رسالة تشخيصية من الخادم: متكرّر (أضف جدّاً)، أو متوفّى، أو اسم الأب لا يطابق
      m.classList.add('err'); m.textContent = j.error;
    } else {
      m.classList.add('err'); m.textContent = (guestWelcomeFail || DEFAULT_GUEST_FAIL).replace(/\{name\}/g, firstName);
    }
  } catch (e) { m.classList.add('err'); m.textContent = 'تعذّر التحقق، حاول مجدداً'; }
  finally { _gateBusy = false; }
}
// رابط دخول المسؤول/المشرف: #login أو #admin (يُخفي شاشة الدخول عن الزوّار العاديين).
function isAdminLoginUrl() {
  const h = (location.hash || '').replace(/^#\/?/, '').toLowerCase();
  return h === 'login' || h === 'admin';
}
// وصف عدد الأجيال (ثلاثي/رباعي…) ومثال للاسم بالتسلسل — لشاشة دخول الزائر.
function gensWord(n) { if (n <= 1) return 'كاملاً (اسمك ثم آباؤك حتى يتميّز)'; return { 2: 'ثنائياً', 3: 'ثلاثياً', 4: 'رباعياً', 5: 'خماسياً', 6: 'سداسياً', 7: 'سباعياً' }[n] || ('بـ ' + n + ' أجيال'); }
function gensExample(n) { return ['محمد', 'سالم', 'خالد', 'عبدالله', 'راشد', 'حمد', 'فهد'].slice(0, Math.max(3, n > 0 ? n : 3)).join(' '); }
// شاشة الدخول — مختصرة: دخول المسؤول/المشرف فقط، أو تصفّح كزائر. لا تسجيل حسابات
// (الحسابات يُنشئها المدير من داخل التطبيق).
function renderAuth() {
  document.querySelectorAll('.fab').forEach(f => f.remove());   // أزل الأزرار العائمة عند الخروج
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  const gated = guestOpen && guestGens > 0;
  const adminMode = isAdminLoginUrl() || !guestOpen;   // واجهة المسؤول على #login أو عند إغلاق الزوّار
  if (!adminMode && gated) {
    // ===== واجهة الزائر: حقل واحد فقط (الاسم بالتسلسل) =====
    box.innerHTML = `<div class="auth-box">
      <div class="logo" style="font-size:3.2rem">🌳</div>
      ${siteTitle ? `<h2 style="margin:.2rem 0 ${occasionText ? '4px' : '12px'}">${esc(siteTitle)}</h2>` : ''}
      ${occasionText ? `<div style="font-weight:800;font-size:1.05rem;margin:0 0 12px;text-align:center;color:${okColor(occasionColor)}">${esc(occasionText)}</div>` : ''}
      <div style="font-size:1.1rem;font-weight:800;margin-bottom:10px;text-align:center">${esc(guestPrompt)}</div>
      ${fInput('اكتب اسمك بالتسلسل هنا', 'g_lineage', '')}
      <div style="font-size:.92rem;font-weight:700;margin:6px 0 4px;text-align:center">تدخل تلقائياً بمجرد أن يتميّز اسمك — مثال: <span style="color:var(--brand)">${esc(gensExample(3))}</span></div>
      <div class="auth-msg" id="a_msg"></div>
      ${sitePowered ? `<div style="font-size:.68rem;opacity:.7;margin-top:18px;text-align:center;width:100%">${esc(sitePowered)}</div>` : ''}
    </div>`;
    const gi = document.getElementById('g_lineage');
    if (gi) {
      try { gi.focus(); } catch (e) {}
      let _gt = null;
      gi.addEventListener('input', () => { clearTimeout(_gt); _gt = setTimeout(guestGateEnter, 350); });
      gi.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(_gt); guestGateEnter(); } });
    }
    return;
  }
  // ===== واجهة المسؤول/المشرف =====
  box.innerHTML = `<div class="auth-box">
    <div class="logo">🌳</div>${siteTitle ? `<h2 style="margin-bottom:0">${esc(siteTitle)}</h2>` : ''}
    ${occasionText ? `<div style="font-weight:800;font-size:1.05rem;margin:4px 0 2px;text-align:center;color:${okColor(occasionColor)}">${esc(occasionText)}</div>` : ''}
    ${sitePowered ? `<div style="font-size:.72rem;opacity:.8;margin-bottom:.4rem">${esc(sitePowered)}</div>` : ''}<div class="sub">دخول المسؤول / مشرف الفرع</div>
    ${fInput('الجوال أو اسم المستخدم', 'a_id', '')}
    ${pinField('الرقم السري', 'a_pin')}
    <button class="btn" id="a_submit">تسجيل الدخول</button>
    <div class="auth-msg" id="a_msg"></div>
    ${guestOpen && guestGens <= 0 ? `<button class="auth-guest-link" id="a_guest">تصفّح الموقع كزائر ←</button>` : ''}
    ${gated ? `<button class="auth-guest-link" id="to_guest">→ دخول الزوّار</button>` : ''}
    </div>`;
  document.getElementById('a_submit').addEventListener('click', submit);
  { const gb = document.getElementById('a_guest'); if (gb) gb.addEventListener('click', () => { const m = document.getElementById('a_msg'); m.className = 'auth-msg'; m.textContent = '… جارٍ فتح التصفّح'; location.hash = '#/home'; try { sessionStorage.removeItem('almfrje_greeted'); } catch (e) {} browseAsGuest(m); }); }
  { const tg = document.getElementById('to_guest'); if (tg) tg.addEventListener('click', () => { location.hash = '#/home'; renderAuth(); }); }
  box.querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => { const inp = document.getElementById(b.dataset.eye); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁'; }));
  box.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));

  async function submit() {
    const msg = document.getElementById('a_msg'); msg.className = 'auth-msg';
    const pin = val('a_pin').trim();
    if (!PIN_RE.test(pin)) { msg.classList.add('err'); msg.textContent = 'الرقم السري ٤ أرقام على الأقل'; return; }
    const ident = val('a_id').trim();
    if (!ident) { msg.classList.add('err'); msg.textContent = 'أدخل الجوال أو اسم المستخدم'; return; }
    msg.textContent = '… لحظة';
    try {
      const digits = normPhone(ident);
      const { data: email } = await sb.rpc('almfrje_resolve_login', { ident: digits || ident });
      const loginEmail = email || (digits ? phoneToEmail(digits) : null);
      if (!loginEmail) { msg.classList.add('err'); msg.textContent = 'بيانات الدخول غير صحيحة'; return; }
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password: pinToPass(pin) });
      if (error) throw error;
      try { sessionStorage.removeItem('almfrje_greeted'); } catch (e2) { /* دخول فعلي → أظهر التهنئة مرّة */ }
    } catch (e) { msg.classList.add('err'); msg.textContent = translateAuthError(e.message); }
  }
}
function translateAuthError(m) {
  if (/Invalid login/i.test(m)) return 'بيانات الدخول غير صحيحة';
  if (/already registered/i.test(m)) return 'رقم الجوال مسجّل مسبقاً';
  if (/duplicate key|unique constraint|Database error saving/i.test(m)) return 'الجوال أو اسم المستخدم مستخدم مسبقاً';
  if (/Email not confirmed/i.test(m)) return 'أوقِف «تأكيد البريد» في إعدادات Supabase';
  return m;
}

/* ===== الدخول للتطبيق ===== */
// ===== التواجد والإحصاء: يُحتسب لكل من يدخل (أي دور) =====
function clientId() {
  try { let c = localStorage.getItem('almfrje_cid'); if (!c) { c = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('almfrje_cid', c); } return c; }
  catch (e) { return 'anon' + Math.random().toString(36).slice(2); }
}
// كل من يدخل يُنسب لفرعه (مدير/مشرف/زائر) — الأصل ألّا يتواجد أحد بلا فرع.
let _myBranchCache;
function myPresenceBranch() {
  // الزائر: فرعه المُتحقَّق عند الدخول (الأدقّ والأسرع).
  try { const v = parseInt(sessionStorage.getItem('almfrje_guest_branch') || '0', 10); if (v) return v; } catch (e) { /* */ }
  if (_myBranchCache !== undefined) return _myBranchCache;
  let b = null;
  try {
    // ٠) شخصه المربوط في القاعدة (يُحفظ تلقائياً عند إنشاء الحساب من المنتقي) — الأدقّ.
    if (me && me.person_id) {
      const p0 = byId.get(me.person_id);
      if (p0 && p0.branch_id != null) { _myBranchCache = p0.branch_id; return p0.branch_id; }
    }
    // ١) شخص مرتبط يدوياً (ملفي الشخصي ← بياناتي في الشجرة).
    if (me && me.user_id) {
      const pid = parseInt(localStorage.getItem('almfrje_me_person_' + me.user_id) || '0', 10);
      if (pid) { const p = byId.get(pid); if (p && p.branch_id != null) b = p.branch_id; }
    }
    // ٢) مطابقة بالجوال (جوال الحساب = جوال شخصه في الشجرة).
    if (b == null && me && me.phone) {
      const mp = normPhone(me.phone);
      if (mp) { const hit = C.persons.find(p => p.phone && normPhone(p.phone) === mp); if (hit && hit.branch_id != null) b = hit.branch_id; }
    }
    // ٣) مطابقة باسمه الكامل (نسبه) عند التفرّد — كدخول الزائر تماماً.
    //    نُنقّي الاسم من علامة الاختصار «…» وشوائب الترقيم (كانت تفسد المطابقة).
    if (b == null && me && me.full_name) {
      const q = String(me.full_name).replace(/[……]/g, ' ').replace(/\.{2,}/g, ' ').trim();
      const matches = C.persons.filter(p => nameMatch(p, q));
      if (matches.length === 1 && matches[0].branch_id != null) {
        b = matches[0].branch_id;
        // خزّن الربط ليثبت (نفس مفتاح الربط اليدوي في «ملفي الشخصي»)
        try { localStorage.setItem('almfrje_me_person_' + me.user_id, String(matches[0].id)); } catch (e2) { /* */ }
      }
    }
    // ٤) مشرفُ فرعٍ واحدٍ محدّد: يُنسب لفرعه. (المشرف العام/متعدّد الفروع لا يُخمَّن
    //    فرعه — كان يُنسب خطأً لأول فرعٍ بالقائمة «مرزوق». يُحسب في الإجمالي بلا فرع،
    //    أو يربط شخصَه من «ملفي الشخصي» فيُنسب لفرعه الحقيقي بدقة.)
    if (b == null && isManager() && !isGeneralManager()) { const mb = myBranches(); if (mb.length === 1) b = mb[0]; }
  } catch (e) { /* أفضل جهد */ }
  _myBranchCache = b;
  return b;
}
// مربّع «المتواجدون الآن» (الرئيسية): المجموع فقط — التفصيل حسب الفرع يظهر أمام كل فرع.
function onlineHomeHtml() {
  return `<div class="oh-title">🟢 المتواجدون الآن: ${onlineNow}</div>`;
}
function updateOnlineDom() {
  const tl = document.getElementById('visitsTotal'); if (tl) tl.textContent = visitStats.total || 0;
  // الرئيسية: المتواجدون الآن حسب الفرع (يظهر الموجود فقط)
  const oh = document.getElementById('onlineHome'); if (oh) oh.innerHTML = onlineHomeHtml();
  // شارة المتواجدين أمام كل فرع في قائمة الفروع بالرئيسية
  document.querySelectorAll('.br-online[data-bid]').forEach(el => {
    const n = (onlineByBranch && onlineByBranch[el.dataset.bid]) || 0;
    el.textContent = n > 0 ? '🟢 ' + n : '';
  });
  // بطاقة الإحصائيات في الإعدادات (إن كانت معروضة)
  const els = document.getElementById('onlineNowSt'); if (els) els.textContent = onlineNow;
  const tls = document.getElementById('visitsTotalSt'); if (tls) tls.textContent = visitStats.total || 0;
  const bb = document.getElementById('onlineByBranchSt');
  if (bb) {
    const ent = Object.entries(onlineByBranch || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    bb.innerHTML = ent.length
      ? ent.map(([bid, n]) => `<div class="row"><span class="k">🗂️ ${esc(branchName(Number(bid)))}</span><span class="v">${n}</span></div>`).join('')
      : '<div class="muted" style="font-size:.85rem;padding:4px 0">لا أحد متواجد الآن ضمن فرع محدّد.</div>';
  }
}
async function pingPresence(first) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const token = session && session.access_token; if (!token) return;
    const res = await fetch('/api/almfrje-presence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ clientId: clientId(), first: !!first, branch: myPresenceBranch() }) });
    const j = await res.json().catch(() => ({}));
    if (j && j.ok) { onlineNow = j.online || 0; onlineByBranch = j.byBranch || {}; if (typeof j.total === 'number') visitStats.total = j.total; updateOnlineDom(); }
  } catch (e) { /* أفضل جهد */ }
}
function startPresence() {
  if (_presenceTimer) clearInterval(_presenceTimer);
  _myBranchCache = undefined;   // أعِد حساب فرع المستخدم الحالي
  pingPresence(true);
  _presenceTimer = setInterval(() => { if (document.visibilityState !== 'hidden') pingPresence(false); }, 60000);
}
function stopPresence() { if (_presenceTimer) { clearInterval(_presenceTimer); _presenceTimer = null; } _myBranchCache = undefined; }
async function enterApp(session) {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildNav();
  showLoading(true);
  let { data: mem } = await sb.from('almfrje_members').select('*').eq('user_id', session.user.id).maybeSingle();
  me = mem || { user_id: session.user.id, full_name: '', role: 'viewer', is_active: false, perms: {} };
  // علاجٌ لمرة واحدة: التتبّع الذي ثُبّت تلقائياً بالخطأ للمشرف العام (كان يعلّقه على فرع مرزوق)
  try {
    if (isGeneralManager() && localStorage.getItem('almfrje_track_healed') !== '1') {
      localStorage.setItem('almfrje_track_healed', '1'); setTracked(0);
    }
  } catch (e) { /* */ }
  // المدير: شغّل ترقية المخطّط بتوكنه (idempotent) فتُطبَّق تحديثات البنية الجديدة تلقائياً (مثل دور «مشرف عام»).
  if (me.role === 'admin' && me.is_active) {
    try {
      // ترقية القاعدة تلقائياً بتوكن المدير — ونُظهر له سبب الفشل بدل الصمت (كي لا تضيع الترقيات)
      fetch('/api/almfrje-setup', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } })
        .then(r => r.json())
        .then(j => {
          if (j && j.ok === false && isAdmin()) {
            // تذكيرٌ لا إزعاج: مرة كل ٢٢ ساعة كحدٍّ أقصى لكل متصفح
            try {
              const k = 'almfrje_upg_warn', last = +localStorage.getItem(k) || 0;
              if (Date.now() - last < 22 * 3600 * 1000) return;
              localStorage.setItem(k, String(Date.now()));
            } catch (e) { /* */ }
            toast('⚠️ تعذّرت ترقية القاعدة تلقائياً: ' + (j.reason || j.error || 'راجع الإعداد'));
          }
        })
        .catch(() => { /* */ });
    } catch (e) { /* تجاهل */ }
  }
  // تبنٍّ تلقائي لصلاحية المدير لأول مستخدم (يعالج فخّ «بانتظار التفعيل»).
  if (!me.is_active) {
    try {
      let { data: claim, error } = await sb.rpc('almfrje_claim_admin');
      // إن لم تُنشأ الدالة بعد، شغّل الإعداد التلقائي ثم أعد المحاولة مرة واحدة.
      if (error && /does not exist|schema cache/i.test(error.message || '')) {
        try { await fetch('/api/almfrje-setup', { method: 'POST' }); } catch (e2) { /* تجاهل */ }
        await new Promise(r => setTimeout(r, 1200));
        ({ data: claim } = await sb.rpc('almfrje_claim_admin'));
      }
      if (claim === 'claimed') {
        const { data: m2 } = await sb.from('almfrje_members').select('*').eq('user_id', session.user.id).maybeSingle();
        if (m2) me = m2;
      }
    } catch (e) { /* أفضل جهد — تجاهل */ }
  }
  if (!me.is_active) { showLoading(false); renderPending(); return; }
  // الزائر حساب مشترك تلقائي — لا يحتاج زرّ خروج (يبقى للمسؤول/المشرف).
  document.getElementById('signoutBtn').classList.toggle('hidden', isGuestUser() && guestGens <= 0);
  try { await loadSettings(); } catch (e) { /* تجاهل — تبقى الافتراضية */ }
  try {
    let fn = '';
    try { fn = (sessionStorage.getItem('almfrje_guest_name') || '').trim().split(/\s+/)[0] || ''; } catch (e) { /* */ }
    showGreeting(fn);
  } catch (e) { /* تجاهل */ }
  try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); }
  showLoading(false);
  // الزائر دخل عبر رابط الإدارة سهواً؟ حوّله للرئيسية بدل بقائه على #login
  if (!location.hash || isAdminLoginUrl()) location.hash = '#/home';
  render();
  startPresence();   // احتساب الزيارة + بدء تتبّع التواجد (لكل من يدخل)
}

/* ===== التهيئة ===== */
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('almfrje_theme', t); } catch (e) { } const b = document.getElementById('themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙'; }
function configMissing() { const c = window.ALMFRJE_CONFIG || {}; return !c.SUPABASE_URL || c.SUPABASE_URL.includes('YOUR_PROJECT') || !c.SUPABASE_ANON_KEY || c.SUPABASE_ANON_KEY.includes('YOUR_'); }
function showSetup() {
  showLoading(false);
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  box.innerHTML = `<div class="auth-box"><div class="logo">⚙️</div><h2>إعداد مطلوب</h2>
    <p class="sub">على alaoufi.me يُضبط الاتصال تلقائياً عبر <b>/api/almfrje-config</b> من متغيّرات البيئة — تأكّد من إضافة <b>NEXT_PUBLIC_SUPABASE_URL</b> و <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>، ثم أعد التحميل.</p>
    <p class="muted" style="font-size:.85rem">جداول المفارجة تُنشأ تلقائياً عند تشغيل ترقية alaoufi.me (<b>/api/migrate</b>) — بلا تنفيذ SQL يدوي. (للاستضافة الثابتة فقط: عبّئ <b>config.js</b>.)</p></div>`;
}
// تعذّر الوصول للقاعدة كلياً (حتى عبر وسيط الموقع): شاشة واضحة بتشخيصٍ تلقائي بدل شاشة دخول خاطئة.
function renderNetFail() {
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  box.innerHTML = `<div class="auth-box"><div class="logo">📡</div>
    <h2>تعذّر الاتصال بقاعدة البيانات</h2>
    <p class="sub" style="line-height:1.9">يبدو أن الشبكة الحالية تمنع الوصول للبيانات.<br>جرّب شبكةً أخرى (مثل نقطة اتصال من الجوال) أو أعد المحاولة.</p>
    <div id="nf_diag" class="auth-msg" style="text-align:center;line-height:2">… جارٍ الفحص</div>
    <button class="btn" id="nf_retry">🔄 إعادة المحاولة</button></div>`;
  document.getElementById('nf_retry').addEventListener('click', () => location.reload());
  (async () => {
    const lines = [];
    try { const r = await fetch('/almfrje-config', { cache: 'no-store' }); lines.push((r.ok ? '✅' : '❌') + ' خادم الموقع'); }
    catch (e) { lines.push('❌ خادم الموقع'); }
    try { const r = await fetch(window.ALMFRJE_CONFIG.SUPABASE_URL + '/auth/v1/health', { headers: { apikey: window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY }, cache: 'no-store' }); lines.push((r.ok ? '✅' : '❌') + ' قاعدة البيانات (مباشرة)'); }
    catch (e) { lines.push('❌ قاعدة البيانات (مباشرة) — محجوبة على هذه الشبكة'); }
    try { const r = await fetch(location.origin + '/sbdb/auth/v1/health', { headers: { apikey: window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY }, cache: 'no-store' }); lines.push((r.ok ? '✅' : '❌') + ' قاعدة البيانات (عبر الموقع)'); }
    catch (e) { lines.push('❌ قاعدة البيانات (عبر الموقع)'); }
    const d = document.getElementById('nf_diag'); if (d) d.innerHTML = lines.join('<br>');
  })();
}
async function init() {
  applyTheme('light');   // الوضع النهاري فقط (أُلغي العرض الليلي)
  { const shb = document.getElementById('shareBtn'); if (shb) shb.addEventListener('click', shareSite); }
  { const gdb = document.getElementById('guideBtn'); if (gdb) gdb.addEventListener('click', () => setHash('#/guide')); }
  { const rfb = document.getElementById('refreshBtn'); if (rfb) rfb.addEventListener('click', () => {
    // تحديث كامل: تجاوز ذاكرة المتصفّح بإعادة تحميل المستند برابطٍ جديد (يُبقي الشاشة الحالية).
    try {
      const hash = location.hash || '#/home';
      location.replace(location.pathname + '?r=' + Date.now() + hash);
    } catch (e) { location.reload(); }
  }); }
  if (configMissing()) { showSetup(); return; }
  // هذا الجهاز احتاج وسيط الموقع سابقاً (شبكته تحجب نطاق القاعدة)؟ ابدأ عليه مباشرةً
  let _dbUrl = window.ALMFRJE_CONFIG.SUPABASE_URL;
  try { if (localStorage.getItem('almfrje_dbproxy') === '1') { _dbProxied = true; _dbUrl = location.origin + '/sbdb'; } } catch (e) { /* */ }
  sb = window.supabase.createClient(_dbUrl, window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY);
  // إعداد تلقائي للقاعدة بأسلوب «أفضل جهد» وبلا انتظار — لا يحجب فتح التطبيق.
  // (الجداول تُنشأ مرة واحدة؛ النداء يعمل في الخلفية دون تعطيل البدء.)
  try { fetch('/api/almfrje-setup', { method: 'POST' }).catch(() => {}); } catch (e) { /* تجاهل */ }
  document.getElementById('backBtn').addEventListener('click', goBack);
  // الخروج (مسؤولاً كان أو زائراً) → بوابة التحقق من الاسم فقط، لا شاشة دخول إدارة.
  // (الإدارة تعود للدخول عبر الرابط المباشر #login.)
  document.getElementById('signoutBtn').addEventListener('click', async () => {
    stopPresence();
    try { sessionStorage.removeItem('almfrje_guest_ts'); } catch (e) { /* */ }
    location.hash = '#/home';
    await sb.auth.signOut();
  });
  window.addEventListener('hashchange', () => { if (me && me.is_active) render(); });
  // جلسة الزائر تنتهي: نشاطه يُجدّد المؤقّت، والخمول (ساعة) أو العودة بعد إغلاق التبويب يُنهيانها.
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (isGuestUser()) bumpGuestTs(); }, { passive: true }));
  setInterval(() => { if (isGuestUser() && guestGens > 0 && !guestSessionFresh()) endGuestSession(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isGuestUser() && guestGens > 0 && !guestSessionFresh()) endGuestSession(); });
  // لا تُعِد دخول التطبيق إلا عند تغيّر هوية المستخدم فعلياً. أحداث مثل
  // TOKEN_REFRESHED تتكرر (خصوصاً على الجوال عند فتح منتقي الملفات والرجوع)،
  // وإعادة الرسم معها كانت تمسح حقل الملف المختار. نتجاهلها هنا.
  sb.auth.onAuthStateChange((event, session) => {
    // الحدث الأولي يُعالَج لاحقاً بعد تحميل الإعدادات (getSession أدناه) — تجاهله هنا
    // لتفادي رسمٍ مبكّر بحالةٍ افتراضية (وميض شاشة دخول الإدارة/صلاحيات قبل ضبط الدور).
    if (event === 'INITIAL_SESSION') return;
    const uid = session && session.user ? session.user.id : null;
    if (uid) {
      if (uid !== _authUid) { _authUid = uid; enterApp(session); }
      // نفس المستخدم (تحديث رمز/تركيز): لا تُعِد الرسم.
    } else {
      _authUid = null; me = null;
      // بعد الخروج: إن كان الموقع مفتوحاً للزوّار ولسنا على رابط الإدارة، اعرض التصفّح مباشرةً.
      if (guestOpen && guestGens <= 0 && !isAdminLoginUrl()) browseAsGuest(); else renderAuth();
    }
  });
  // رابط مُشارَك يحمل ‎#login‎/‎#admin‎؟ يُمسح عند كل فتحٍ جديد للصفحة، فلا تظهر شاشة
  // دخول المسؤول أبداً عبر رابطٍ مرسل — تظهر فقط بالنقر داخل الجلسة (المزيد ← دخول المسؤول).
  if (isAdminLoginUrl()) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
  await loadSettings();
  // فشل تحميل الإعدادات كلياً (حتى عبر الوسيط)؟ لا تعرض شاشة المسؤول خطأً — اعرض شاشة
  // «تعذّر الاتصال» بتشخيصٍ يوضّح الجهة المحجوبة، إلا لمن لديه جلسة قائمة.
  if (!settingsOk) {
    const { data: { session: s0 } } = await sb.auth.getSession();
    if (!s0) { showLoading(false); renderNetFail(); return; }
  }
  const { data: { session } } = await sb.auth.getSession();
  const wantAdmin = isAdminLoginUrl();
  if (session && session.user) {
    const guestSess = session.user.email === GUEST_EMAIL;
    // جلسة زائر مع طلب دخول الإدارة أو إغلاق الموقع → سجّل خروج الزائر واعرض شاشة الدخول
    if (guestSess && (wantAdmin || !guestOpen)) {
      _authUid = null; me = null; await sb.auth.signOut(); showLoading(false); renderAuth();
    } else if (guestSess && guestGens > 0 && !guestSessionFresh()) {
      // جلسة زائر لكن أُغلق التبويب سابقاً (sessionStorage مُسح) أو مرّت ساعة خمول → أعد التحقق
      await endGuestSession(); showLoading(false); renderAuth();
    } else {
      if (guestSess) bumpGuestTs();
      _authUid = session.user.id; await enterApp(session);
    }
  } else if (!wantAdmin && guestOpen && guestGens <= 0) {
    // لا جلسة + الموقع مفتوح بلا بوابة تحقّق → دخول الزائر مباشرةً للتصفّح
    const ok = await browseAsGuest();
    if (!ok) { showLoading(false); renderAuth(); }
  } else {
    showLoading(false); renderAuth();
  }
  setupInstallPrompt();
}

/* ===== إضافة اختصار الموقع إلى شاشة الجهاز (مجرّد اختصار للمتصفّح لا تثبيت تطبيق) ===== */
let _deferredInstall = null;
// قد يتيح أندرويد/كروم حدثاً مؤجّلاً لإضافة الاختصار؛ نلتقطه إن وُجد كي لا نفوّته.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _deferredInstall = e; maybeShowInstall(); });
window.addEventListener('appinstalled', () => { markInstallDone(); const b = document.getElementById('installBar'); if (b) b.remove(); });
function alreadyInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function installDismissed() { try { return localStorage.getItem('almfrje_install_done') === '1'; } catch (e) { return true; } }
function markInstallDone() { try { localStorage.setItem('almfrje_install_done', '1'); } catch (e) { } }
function showInstallBar(html, onAction) {
  if (document.getElementById('installBar')) return;
  const bar = document.createElement('div'); bar.id = 'installBar'; bar.className = 'install-bar';
  bar.innerHTML = `<div class="install-txt">${html}</div><div class="install-actions">
    ${onAction ? '<button class="btn sm" id="install_go">📌 أضِف الاختصار</button>' : ''}
    <button class="btn sm outline" id="install_x">لاحقاً</button></div>`;
  document.body.appendChild(bar);
  const x = document.getElementById('install_x'); x.addEventListener('click', () => { markInstallDone(); bar.remove(); });
  const go = document.getElementById('install_go'); if (go && onAction) go.addEventListener('click', async () => { markInstallDone(); bar.remove(); await onAction(); });
}
// إضافة الاختصار يدوياً من قائمة المزيد (يعمل دائماً): يستخدم الحدث المؤجّل إن وُجد، وإلا يرشد يدوياً.
async function triggerInstall() {
  if (alreadyInstalled()) { toast('الاختصار مضاف بالفعل'); return; }
  if (_deferredInstall) {
    try { _deferredInstall.prompt(); await _deferredInstall.userChoice; _deferredInstall = null; markInstallDone(); } catch (e) { /* تجاهل */ }
    return;
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  openModal('📌 إضافة اختصار الموقع إلى الشاشة', isIOS
    ? '<div class="hint-body">على آيفون/آيباد (سفاري):<br>١) اضغط زر <b>المشاركة</b> ⬆️ في أسفل المتصفّح.<br>٢) اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.<br>٣) اضغط <b>«إضافة»</b>.<br><br>سيظهر اختصار للموقع على شاشة جهازك يفتحه في المتصفّح مباشرة.</div>'
    : '<div class="hint-body">من قائمة المتصفّح (⋮) اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.<br><br>سيظهر اختصار للموقع على شاشة جهازك يفتحه في المتصفّح مباشرة دون تثبيت أي تطبيق.</div>');
}
// يُعرض شريط الاختصار إن توفّر الحدث المؤجّل (يُستدعى من الحدث ومن init).
function maybeShowInstall() {
  if (alreadyInstalled() || installDismissed() || !_deferredInstall) return;
  showInstallBar('📌 أضِف اختصار «المفارجة» إلى شاشة جهازك للوصول السريع.', async () => {
    try { _deferredInstall.prompt(); await _deferredInstall.userChoice; } catch (err) { /* تجاهل */ }
    _deferredInstall = null;
  });
}
function setupInstallPrompt() {
  if (alreadyInstalled() || installDismissed()) return;
  // إن كان الحدث المؤجّل قد وقع مبكراً قبل init، اعرض الشريط الآن.
  maybeShowInstall();
  // iOS (سفاري): لا يوجد حدث مؤجّل — نعرض إرشاداً يدوياً لإضافة الاختصار.
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  if (isIOS) {
    setTimeout(() => { if (!installDismissed() && !alreadyInstalled()) showInstallBar('📌 لإضافة «المفارجة» إلى شاشتك: اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».', null); }, 2500);
  }
}
init();
