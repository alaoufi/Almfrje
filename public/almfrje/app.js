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
function nickSuffix(p) { return p && p.nickname ? ` <span class="nick">«${esc(p.nickname)}»</span>` : ''; }
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
const ROLES = [{ k: 'admin', ar: 'مدير النظام' }, { k: 'branch_manager', ar: 'مسؤول فرع' }, { k: 'viewer', ar: 'زائر' }];
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
  recent: ['آخر الإضافات', 'أحدث الأسماء المُضافة. اضغط أي اسم لرؤية أبيه وجدّه وتاريخ إضافته.\n\nزر «↺ تصفير» (للمدير) يبدأ العدّ من جديد دون حذف أي بيانات.'],
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
  descendants: ['فهرس الذرية', 'قائمة مرقّمة بكل ذرية الشخص (نظام أنساب: ١، ١-١، ١-١-١…).\nمنها تصدّر Excel ملوّن أو PDF أو نص.'],
  // ——— إضافة وتعديل ———
  add_person: ['إضافة مولود', 'الخطوات:\n١) اختر الأب من الشجرة.\n٢) اكتب اسم المولود.\n٣) (اختياري) أضف بقية البيانات.\n٤) اضغط «إضافة المولود».\n\nيُحدَّد الفرع تلقائياً من فرع الأب.'],
  add_father: ['الأب المباشر', 'اضغط «اختيار الأب» وابحث عن والد المولود.\nيُحدَّد فرع المولود تلقائياً من فرع أبيه.\n\nمسؤول الفرع يختار أباً ضمن فرعه فقط.'],
  add_status: ['الحالة', 'حي أو متوفى.\nتظهر شارة «متوفى» فقط لمن حالته متوفى.'],
  add_work: ['الحالة الوظيفية', 'اختياري:\nلم تحدد (الافتراضي) / موظف / متقاعد.'],
  edit_lock: ['تعديل البيانات', 'يمكنك تعديل بيانات الشخص.\nحذف الأسماء متاح لمدير النظام فقط (مع تأكيد)، وتُحفظ نسخة في سلة المحذوفات للتراجع.'],
  // ——— الأدوات ———
  bulk: ['التعديل الجماعي', 'لتعديل عدّة أشخاص دفعة واحدة:\n١) حدّد المجموعة (الجيل أو ضمن جدّ).\n٢) اختر الحقل (الحالة/المدينة…) وقيمته.\n٣) تظهر الأسماء كلها مؤشّرة — أزل تأشير من لا تريد.\n٤) طبّق على المحدّدين.\n\nملاحظة: عند تعديل الجوال أو الحالة الوظيفية أو المدينة أو سنة الميلاد، تظهر أسماء المتوفّين بلا إمكان اختيار لأنها لا تخصّهم.'],
  import: ['استيراد Excel', 'لإدخال الشجرة كاملة من ملف Excel مرة واحدة:\nكل عمود = جيل (العمود الأقصى يميناً = الأصل).\nالأسماء المتتالية في نفس العمود = إخوة.\n\nيتجاهل جدول الإحصائيات في نهاية الملف تلقائياً. راجع المعاينة قبل التنفيذ.'],
  branches: ['الفروع', 'الفرع = جدّ معيّن وكل ذريّته، له مشرف أو أكثر.\nالمدير يعيّن أي جدّ كفرع ويحدّد مشرفيه.\nكل مشرف يرى ويضيف في فرعه فقط.'],
  branch_root: ['جذر الفرع (الجدّ)', 'الجدّ الذي يبدأ منه الفرع.\nعند الحفظ يُضمّ هو وكل ذريّته إلى هذا الفرع تلقائياً.'],
  branch_sup: ['المشرفون', 'أشّر عضواً أو أكثر للإشراف على الفرع.\nالمشرف يضيف ويعدّل أفراد فرعه فقط، ولا يرى الفروع الأخرى.'],
  backups: ['النسخ الاحتياطية', 'احفظ نسخة كاملة من كل البيانات في أي وقت (للأمان).\nتقدر تنزّلها كملف أو ترجع لها لاحقاً.\nأخذ نسخة لا يؤثّر على بياناتك الحالية.'],
  audit: ['سجل التعديلات', 'سجلّ كامل: كل إضافة أو تعديل على الأسماء، مع اسم من قام بها ووقتها.'],
  trash: ['سلة المحذوفات', 'تحفظ النسخ السابقة من البيانات المعدّلة، فتقدر تتراجع عن أي تعديل.'],
  export: ['التصدير', 'نزّل البيانات كملف:\n• Excel ملوّن منسّق.\n• CSV للجداول.\n• PDF للطباعة.'],
  // ——— المستخدمون والصلاحيات ———
  members: ['المستخدمون والصلاحيات', 'إدارة الحسابات: تفعيل/إيقاف، تحديد الدور والفروع، وتعديل البيانات.\nمن هنا أيضاً تتحكّم في فتح الموقع للعموم ونص الرئيسية.'],
  add_user: ['إضافة مستخدم', 'أنشئ حساباً جديداً:\nالاسم + الجوال + رقم سري.\nثم اختر الدور (مدير/مسؤول فرع/زائر) والفروع.\nيُفعّل مباشرةً.'],
  control_panel: ['لوحة التحكم', 'كل وظائف مدير النظام في مكان واحد بتبويبات:\nالمستخدمون والصلاحيات • النصوص (نص الرئيسية وتعريف الألوان) • التعليمات • سجل التعديلات • سلة المحذوفات • النسخ والتصدير.'],
  guest_browse: ['فتح الموقع للزوّار', 'مفتوح = يدخل أي زائر مباشرةً للتصفّح (قراءة فقط) دون شاشة دخول.\nمغلق = تظهر شاشة الدخول للجميع.\n\nالزائر لا يضيف ولا يعدّل ولا يحذف، وتقدر تحدّد ما يُخفى عنه (الجوال، الصور والمستندات، الملاحظات والحالة الوظيفية).\n\nدخول المدير/المشرف دائماً عبر الرابط: #login'],
  member_role: ['الأدوار', 'مدير النظام: صلاحية كاملة على كل شيء.\nمسؤول فرع: يضيف ويعدّل في فروعه فقط.\nزائر: يتصفّح ويبحث فقط.'],
  member_edit: ['تعديل بيانات المستخدم', 'عدّل اسم المستخدم أو جواله أو كلمة مروره.\nيعمل لأي حساب بما فيهم المدير.'],
  profile: ['ملفي الشخصي', 'عدّل اسمك وجوالك وكلمة مرورك.\n⚠️ تغيير الجوال يعني الدخول لاحقاً بالرقم الجديد — احفظه.'],
  banner: ['نص الرئيسية', 'النص الذي يظهر أعلى الصفحة الرئيسية لكل المستخدمين (مثل تعريف القبيلة).'],
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
const GUEST_HIDE_DEFAULT = { phone: true, media: true, notes: true };  // ما يُخفى عن الزائر افتراضياً
let guestHide = { ...GUEST_HIDE_DEFAULT };
let recentSince = '';      // تاريخ تصفير «آخر الإضافات» (ISO) — يُحدّده المدير
const DEFAULT_BANNER = 'المفرجي قبيلة من ولد حسين من الصواعد من عوف من حرب';
let bannerText = DEFAULT_BANNER;
const C = { persons: [], branches: [], members: [], documents: [] };
const TABLES = { persons: 'almfrje_persons', branches: 'almfrje_branches', members: 'almfrje_members', documents: 'almfrje_documents' };

// فهارس
let byId = new Map();
let kids = new Map();          // father_id -> [children]
let branchById = new Map();
let childCount = new Map();
let descCount = new Map();     // إجمالي الذرية

const isAdmin = () => !!(me && me.role === 'admin' && me.is_active);
const isManager = () => !!(me && me.role === 'branch_manager' && me.is_active);
const isViewer = () => !!(me && me.role === 'viewer');
// حساب الزائر المدمج المشترك (للتصفّح بلا تسجيل) — يُميَّز باسم المستخدم 'guest'.
const isGuestUser = () => !!(me && me.username === 'guest');
// هل يُخفى عن الزائر (دور viewer) هذا الصنف من البيانات؟ what: phone | media | notes
const hideForGuest = (what) => isViewer() && !!guestHide[what];
// فروع المستخدم التي يُشرف عليها (يدعم القديم branch_id + الجديد branch_ids[])
function myBranches() {
  if (!me) return [];
  const arr = Array.isArray(me.branch_ids) ? me.branch_ids.map(Number) : [];
  if (me.branch_id) arr.push(Number(me.branch_id));
  return [...new Set(arr.filter(Boolean))];
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
//  • مسؤول فرع: الإضافة والتعديل ضمن فروعه/جدّه المصرّح له بها فقط (لا يتجاوزها).
//  • زائر: تصفّح فقط.
function canAddBirth() { return isAdmin() || isManager(); }   // مسؤول الفرع يضيف في فروعه
// هل يجوز إضافة ابن لهذا الشخص تحديداً؟ لا للمتوفى، ولمسؤول الفرع ضمن فرعه فقط.
function canAddChildTo(p) {
  if (!p) return false;
  if (p.status === 'dead') return false;       // المتوفى لا يُضاف له أبناء
  if (isAdmin()) return true;
  if (isManager()) return inMyBranch(p);       // ضمن فرعه المصرّح به فقط
  return false;
}
function canEditPerson(p) { return isAdmin() || (isManager() && inMyBranch(p)); }
function canAdd() { return canAddBirth(); }
function canExport() { return isAdmin() || isManager(); }
function canDelete() { return isAdmin(); }                    // الحذف للمدير فقط

/* ===== طبقة البيانات ===== */
// جلب كل صفوف جدول عبر صفحات — Supabase يحدّ كل طلب بـ 1000 صف افتراضياً،
// وشجرتنا تتجاوز ذلك، فنكرّر بـ range حتى تنتهي الصفوف.
async function fetchAll(table, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from(table).select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
async function loadAll() {
  const [pr, br, mr] = await Promise.all([
    fetchAll('almfrje_persons').then(d => ({ data: d }), e => ({ error: e })),
    fetchAll('almfrje_branches').then(d => ({ data: d }), e => ({ error: e })),
    fetchAll('almfrje_members').then(d => ({ data: d }), e => ({ error: e })),
  ]);
  C.persons = pr.error ? [] : (pr.data || []);
  C.branches = br.error ? [] : (br.data || []);
  C.members = mr.error ? [] : (mr.data || []);
  await loadSettings();
  buildIndex();
}
async function loadSettings() {
  try {
    const { data } = await sb.from('almfrje_settings').select('key,value');
    const map = {}; (data || []).forEach(r => map[r.key] = r.value);
    imported = map.imported === true;
    guestOpen = map.guest_open === true;
    guestHide = Object.assign({ ...GUEST_HIDE_DEFAULT }, (map.guest_hide && typeof map.guest_hide === 'object') ? map.guest_hide : {});
    statLabels = Object.assign({ ...LABELS_DEFAULT }, (map.status_labels && typeof map.status_labels === 'object') ? map.status_labels : {});
    recentSince = typeof map.recent_since === 'string' ? map.recent_since : '';
    bannerText = typeof map.banner_text === 'string' ? map.banner_text : DEFAULT_BANNER;
    // تطبيق نصوص التعليمات المعدّلة من الإعدادات فوق الافتراضية
    applyHintOverrides(map.hints_overrides);
  } catch (e) { /* تجاهل — تبقى القيم الافتراضية */ }
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
  byId = new Map(); kids = new Map(); branchById = new Map();
  C.branches.forEach(b => branchById.set(b.id, b));
  C.persons.forEach(p => { p._n = normalizeAr(p.name + ' ' + (p.nickname || '')); byId.set(p.id, p); });
  C.persons.forEach(p => { if (p.father_id != null) { if (!kids.has(p.father_id)) kids.set(p.father_id, []); kids.get(p.father_id).push(p); } });
  const cmp = (a, b) => (a.sort - b.sort) || (a.id - b.id);
  kids.forEach(arr => arr.sort(cmp));
  computeCounts();
}
function computeCounts() {
  childCount = new Map(); descCount = new Map();
  C.persons.forEach(p => childCount.set(p.id, (kids.get(p.id) || []).length));
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
  const b = branchById.get(bid); if (!b) return null;
  // ابدأ من root_id المخزّن إن وُجد، وإلا من أيّ عضو
  let start = b.root_id ? byId.get(b.root_id) : null;
  if (!start) { const mem = C.persons.filter(p => p.branch_id === bid); if (!mem.length) return null; start = mem[0]; }
  // اصعد بالأب حتى الوصول للجيل الثاني (رأس الفرع) أو الجذر الأعلى
  let cur = start, guard = 0;
  while (cur && cur.generation > 2 && cur.father_id && byId.has(cur.father_id) && guard++ < 60) {
    cur = byId.get(cur.father_id);
  }
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
function descendants(id) { const out = []; const st = [...childrenOf(id)]; while (st.length) { const p = st.pop(); out.push(p); for (const c of childrenOf(p.id)) st.push(c); } return out; }
const maxGen = () => C.persons.reduce((m, p) => Math.max(m, p.generation || 1), 0);

async function refreshAndRender() { showLoading(true); try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); } showLoading(false); render(); }
async function guard(fn) {
  try { await fn(); } catch (e) {
    const msg = (e.message || ('' + e));
    toast(/Could not find the table|schema cache/i.test(msg) ? 'لم تُنشأ جداول المفارجة بعد — شغّل ترقية alaoufi.me (/api/migrate) مرة واحدة.' : 'تعذّر الحفظ: ' + msg);
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
  import: { t: 'استيراد Excel', back: true, fn: screenImport },
  members: { t: 'المستخدمون والصلاحيات', back: true, fn: screenMembers },
  bulk: { t: 'تعديل جماعي', back: true, fn: screenBulkEdit },
  audit: { t: 'سجل التعديلات', back: true, fn: screenAudit },
  hints: { t: 'تعديل التعليمات', back: true, fn: screenHints },
  texts: { t: 'النصوص', back: true, fn: screenTexts },
  backups: { t: 'النسخ والتصدير', back: true, fn: screenBackups },
  profile: { t: 'ملفي الشخصي', back: true, fn: screenProfile },
  stats: { t: 'التقرير الإحصائي', back: true, fn: screenStats },
  dups: { t: 'الأسماء المكرّرة', back: true, fn: screenDuplicates },
  feedback: { t: 'إرسال ملاحظة للإدارة', back: true, fn: screenFeedback },
  feedbacks: { t: 'ملاحظات الزوار', back: true, fn: screenFeedbacks },
  trash: { t: 'سلة المحذوفات', back: true, fn: screenTrash },
};
function parseHash() { const raw = (location.hash || '#/home').replace(/^#\//, ''); const p = raw.split('/'); return { name: p[0] || 'home', arg: p[1] }; }
function render() {
  if (!me || !me.is_active) { renderPending(); return; }
  const { name, arg } = parseHash();
  const r = ROUTES[name] || ROUTES.home;
  document.getElementById('screenTitle').textContent = r.t;
  document.getElementById('backBtn').classList.toggle('hidden', !r.back);
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === '#/' + name));
  document.querySelectorAll('.fab').forEach(f => f.remove());
  window.scrollTo(0, 0);
  r.fn(arg);
  bindHints(view());   // فعّل أزرار (i) في كل شاشة
  bindEyes(view());    // فعّل أزرار العين في كل شاشة
  // تبويبات لوحة التحكم (تظهر في شاشات المدير فقط)
  view().querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => setHash(b.dataset.go)));
}
function addFab(label, onClick) { const f = document.createElement('button'); f.className = 'fab'; f.textContent = label; f.addEventListener('click', onClick); document.body.appendChild(f); }
// شريط تبويبات لوحة التحكم (للمدير) — كل شاشة إدارية تعرضه أعلاها.
const ADMIN_TABS = [
  ['members', '👥 المستخدمون', '#/members'],
  ['texts', '📝 النصوص', '#/texts'],
  ['hints', '💡 التعليمات', '#/hints'],
  ['audit', '📋 سجل التعديلات', '#/audit'],
  ['trash', '🗑️ سلة المحذوفات', '#/trash'],
  ['backups', '💾 النسخ والتصدير', '#/backups'],
];
function adminTabBar(active) {
  if (!isAdmin()) return '';
  return `<div class="admin-tabs">${ADMIN_TABS.map(([k, label, href]) => `<button class="admin-tab${k === active ? ' active' : ''}" data-go="${href}">${label}</button>`).join('')}</div>`;
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
  return `<div class="card" style="padding:12px">
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
function branchCount(bid) { return C.persons.filter(p => p.branch_id === bid).length; }
function branchGroupsHtml() {
  if (!C.branches.length) return `<div class="card"><h3>الفروع</h3>${noItem()}</div>`;
  const groups = new Map();   // rootId -> { root, items:[{b,n}] }
  for (const b of C.branches) {
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
      .map(x => row(`<a href="#/branch/${x.b.id}" style="color:var(--brand);text-decoration:none">${esc(x.b.name)}</a>`, x.n + ' فرد')).join('');
    return `<div class="card"><h3>${head} <span class="muted" style="font-weight:normal;font-size:.8rem">(${g.items.length} فروع • ${g.total} فرد)</span></h3>${items}</div>`;
  }).join('');
}

/* ===== لوحة التحكم ===== */
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
    ${bannerText ? `<div class="banner">${esc(bannerText)}</div>` : ''}
    ${!isGuestUser() && !pwChanged() ? `<div class="notice-pw">🔐 ننصحك بتغيير كلمة المرور الآن لحماية حسابك. <button class="btn sm" id="pwGo" style="margin-top:6px">تغيير كلمة المرور</button> <button class="btn sm outline" id="pwSkip" style="margin-top:6px">لاحقاً</button></div>` : ''}
    <div class="title-lg">شجرة المفارجة</div>
    <div class="muted">أهلاً ${esc(me.full_name || '')} • ${arOf(ROLES, me.role)}${isManager() && myBranches().length ? ' (' + myBranches().map(b => esc(branchName(b))).join('، ') + ')' : ''}</div>
    <div class="card" style="border:2px solid var(--brand);background:color-mix(in srgb, var(--brand) 7%, transparent)">
      <h3 style="margin:0 0 4px">📝 ملاحظات الزوار</h3>
      <p class="muted" style="margin:0 0 8px;font-size:.88rem">لاحظت خطأً في اسم أو نسب؟ أو لديك إضافة أو تصحيح؟ أرسل ملاحظتك للإدارة وستُراجَع.</p>
      <button class="btn" data-go="#/feedback">✉️ أرسل ملاحظة للإدارة</button>
      ${isAdmin() ? `<button class="btn outline" data-go="#/feedbacks" style="margin-top:8px">📨 عرض الملاحظات الواردة</button>` : ''}
    </div>
    <div class="search"><input id="q" placeholder="ابحث بالاسم أو اللقب…"></div><div id="qr"></div>
    <div class="stats">
      <div class="stat"><div class="n">${total}</div><div class="l">إجمالي الأفراد</div></div>
      <div class="stat a"><div class="n">${C.branches.length}</div><div class="l">الفروع</div></div>
      <div class="stat g"><div class="n">${maxGen()}</div><div class="l">الأجيال</div></div>
      <div class="stat"><div class="n">${sinceMs ? newCount : (recent.length ? '#' + recent[0].id : '—')}</div><div class="l">${sinceMs ? 'إضافات جديدة' : 'آخر إضافة'}</div></div>
    </div>
    ${branchGroupsHtml()}
    <div class="card"><div class="recent-head"><h3 style="margin:0">آخر الإضافات${sinceMs ? ` (${newCount})` : ''} ${hintBtn('recent')}</h3>${isAdmin() ? '<button class="btn sm outline" id="resetRecent">↺ تصفير</button>' : ''}</div>
      ${recent.length ? recent.map(p => `<div class="row click" data-recent="${p.id}"><span class="k">${esc(p.name)}</span><span class="v">${p.created_at ? fmtDate(p.created_at) : esc(branchName(p.branch_id))}</span></div>`).join('') : '<div class="muted" style="padding:6px">لا إضافات جديدة بعد التصفير.</div>'}</div>
    ${legendHtml()}`;
  const q = document.getElementById('q');
  q.addEventListener('input', () => instantSearch(q.value, document.getElementById('qr')));
  const pwGo = document.getElementById('pwGo'); if (pwGo) pwGo.addEventListener('click', () => setHash('#/profile'));
  const pwSkip = document.getElementById('pwSkip'); if (pwSkip) pwSkip.addEventListener('click', () => { markPwChanged(); screenHome(); });
  const rr = document.getElementById('resetRecent'); if (rr) rr.addEventListener('click', resetRecent);
  view().querySelectorAll('[data-recent]').forEach(el => el.addEventListener('click', () => recentInfoModal(parseInt(el.dataset.recent, 10))));
  bindGo();
  // زر عائم لإضافة مولود جديد (لمن يملك صلاحية الإضافة)
  if (canAdd()) addFab('+ مولود', () => setHash('#/person-edit/0'));
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
    screenHome();
    // إتاحة التراجع لمدة ٨ ثوانٍ
    showUndoToast('تم التصفير', async () => { await guard(async () => { await setRecentSince(prev); }); toast('تم التراجع'); screenHome(); });
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
function instantSearch(term, box) {
  const t = normalizeAr(term.trim());
  if (!t) { box.innerHTML = ''; return; }
  const res = C.persons.filter(p => p._n.includes(t)).slice(0, 30);
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
    if (n && !p._n.includes(n)) return false;
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
      ${p.created_by_name ? row('أضافه', esc(p.created_by_name)) : ''}
      ${p.updated_by_name ? row('آخر تعديل', esc(p.updated_by_name) + (p.updated_at ? ' • ' + fmtDateTime(p.updated_at) : '')) : ''}
    </div>
    <div class="stats" style="grid-template-columns:1fr 1fr 1fr">
      <div class="stat"><div class="n">${cs.length}</div><div class="l">الأبناء</div></div>
      <div class="stat a"><div class="n">${grand.length}</div><div class="l">الأحفاد</div></div>
      <div class="stat g"><div class="n">${descCount.get(id) || 0}</div><div class="l">إجمالي الذرية</div></div>
    </div>
    <div class="card"><h3>الأبناء (${cs.length})</h3>${cs.length > 1 && canEditPerson(p) ? '<div class="reorder-hint">↕️ لإعادة الترتيب: اضغط مطوّلاً على الابن (ثانية تقريباً) ثم اسحبه لأعلى/أسفل بين إخوته.</div>' : ''}<div id="childList" class="${cs.length > 1 && canEditPerson(p) ? 'reorder-list' : ''}">${cs.length ? cs.map(c => `<div class="row child-row"${cs.length > 1 && canEditPerson(p) ? ` data-reorder-id="${c.id}"` : ''}>${cs.length > 1 && canEditPerson(p) ? '<span class="reorder-grip">⠿</span>' : ''}<span class="k"><a href="#/person/${c.id}" style="color:var(--brand);text-decoration:none">${esc(c.name)}</a></span><span class="v">${descCount.get(c.id) || 0} ذرية</span></div>`).join('') : noItem()}</div></div>
    ${showDocs ? `<div class="card"><h3>الوثائق والصور (${docs.length})</h3>
      ${docs.length ? docs.map(d => `<div class="row"><span class="k">${d.kind === 'photo' ? '🖼️' : d.kind === 'pdf' ? '📄' : '📎'} <a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:none">${esc(d.label || 'ملف')}</a></span>${canDelete() ? `<button class="btn sm danger" data-ddel="${d.id}">حذف</button>` : ''}</div>`).join('') : noItem()}
      ${canEditPerson(p) ? `<button class="btn outline" id="addDoc" style="margin-top:8px">➕ إضافة صورة/وثيقة</button>` : ''}
    </div>` : ''}
    <div class="btn-row no-print">
      <button class="btn outline" data-go="#/tree/${id}">🌳 الشجرة</button>
      <button class="btn outline" data-go="#/descendants/${id}">👨‍👩‍👧 الذرية</button>
      ${canExport() ? `<button class="btn outline" id="printP">🖨️ تقرير / PDF</button>` : ''}
      ${canAddChildTo(p) ? `<button class="btn" id="addSon">➕ إضافة ابن</button>` : ''}
      ${canEditPerson(p) ? `<button class="btn outline" data-go="#/person-edit/${id}">✎ تعديل</button>` : ''}
    </div>`;
  bindGo();
  const as = document.getElementById('addSon'); if (as) as.addEventListener('click', () => { presetFather = p; setHash('#/person-edit/0'); });
  const pr = document.getElementById('printP'); if (pr) pr.addEventListener('click', () => window.print());
  const ad = document.getElementById('addDoc'); if (ad) ad.addEventListener('click', () => addDocModal(p));
  if (cs.length > 1 && canEditPerson(p)) enableReorder(document.getElementById('childList'), cs.map(c => c.id), id);
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
      timer = setTimeout(() => {
        active = true;
        row.classList.add('reorder-grab'); listEl.classList.add('reordering');
        try { row.setPointerCapture(e.pointerId); } catch (_) { }
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { } }
      }, 550);
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
function addDocModal(p) {
  openModal('إضافة صورة / وثيقة', `
    ${fSelect('النوع', 'd_kind', [{ k: 'photo', ar: 'صورة' }, { k: 'pdf', ar: 'ملف PDF' }, { k: 'doc', ar: 'وثيقة أخرى' }], 'photo')}
    ${fInput('الوصف', 'd_label', '')}
    <div class="field"><label>رفع ملف (إلى التخزين) — أو ضع رابطاً أدناه</label><input id="d_file" type="file"></div>
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
  // تأكّد مرة واحدة في الجلسة أن مجلّد التخزين موجود وعام (يعالج المجلّدات القديمة الخاصة).
  if (!_bucketReady) { try { await fetch('/api/almfrje-setup', { method: 'POST' }); _bucketReady = true; } catch (e) { /* تجاهل */ } }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  let { error } = await sb.storage.from('almfrje').upload(path, file, { upsert: false, contentType: file.type || undefined });
  // شفاء ذاتي إضافي: إن لم يكن المجلّد موجوداً بعد، أعد الإعداد ثم المحاولة.
  if (error && /bucket not found|not found/i.test(error.message || '')) {
    try { await fetch('/api/almfrje-setup', { method: 'POST' }); } catch (e) { /* تجاهل */ }
    await new Promise(r => setTimeout(r, 1000));
    ({ error } = await sb.storage.from('almfrje').upload(path, file, { upsert: false, contentType: file.type || undefined }));
  }
  if (error) throw new Error('فشل رفع الصورة: ' + error.message);
  return sb.storage.from('almfrje').getPublicUrl(path).data.publicUrl;
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
    return `<div class="idx-row${isRoot ? ' idx-root' : ''}" style="padding-right:${depth * 16}px">
      <span class="idx-num">${numStr(num)}</span>
      <a href="#/person/${x.id}" class="idx-name ${nameCls(x)}"${nameTitle(x)}>${esc(x.name)}</a>${statusTag(x)}
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
function screenTree(arg) {
  const rs = roots();
  let rootId = parseInt(arg, 10);
  if (!rootId || !byId.has(rootId)) rootId = rs.length ? rs[0].id : 0;
  if (!rootId) { view().innerHTML = '<div class="center-empty">لا توجد بيانات بعد.</div>'; return; }
  const rootOpts = rs.map(r => ({ k: String(r.id), ar: r.name }));
  view().innerHTML = `
    <div class="card no-print"><div class="grid2">
      ${rootOpts.length > 1 ? fSelect('ابدأ من', 't_root', rootOpts, rootId) : ''}
      <div class="field"><label>اذهب لشخص</label><button class="btn outline" id="t_pick" style="margin-top:0">🔍 اختر شخصاً</button></div>
    </div>
    <div class="btn-row"><button class="btn sm outline" id="t_expand">توسيع المستوى الأول</button><button class="btn sm outline" id="t_collapse">طيّ الكل</button>
      <button class="btn sm outline" data-go="#/hierarchy/${rootId}">عرض هرمي</button></div>
    </div>
    <div class="card tree" id="treeBox"></div>`;
  treeOpen.add(rootId);
  renderTree(rootId);
  bindGo();
  const sel = document.getElementById('t_root'); if (sel) sel.addEventListener('change', () => setHash('#/tree/' + sel.value));
  document.getElementById('t_pick').addEventListener('click', () => pickPerson('اختر شخصاً للشجرة', (p) => p && setHash('#/tree/' + p.id)));
  document.getElementById('t_expand').addEventListener('click', () => { childrenOf(rootId).forEach(c => treeOpen.add(c.id)); renderTree(rootId); });
  document.getElementById('t_collapse').addEventListener('click', () => { treeOpen.clear(); treeOpen.add(rootId); renderTree(rootId); });
}
function renderTree(rootId) {
  const box = document.getElementById('treeBox'); if (!box) return;
  box.innerHTML = treeNodeHtml(rootId);
  box.querySelectorAll('[data-tog]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const id = parseInt(b.dataset.tog, 10);
    treeOpen.has(id) ? treeOpen.delete(id) : treeOpen.add(id); renderTree(rootId);
  }));
  box.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => setHash('#/person/' + b.dataset.open)));
}
function treeNodeHtml(id) {
  const p = byId.get(id); if (!p) return '';
  const cs = childrenOf(id); const open = treeOpen.has(id); const has = cs.length > 0;
  const toggle = has ? `<button class="ttoggle" data-tog="${id}">${open ? '−' : '+'}</button>` : `<span class="ttoggle leaf">•</span>`;
  let html = `<div class="tnode"><div class="trow">${toggle}<span class="tname ${nameCls(p)}" data-open="${id}"${nameTitle(p)}>${esc(p.name)}</span>${statusTag(p)}${has ? `<span class="tcount">(${cs.length} • ${descCount.get(id) || 0})</span>` : ''}</div>`;
  if (open && has) html += `<div class="tkids">${cs.map(c => treeNodeHtml(c.id)).join('')}</div>`;
  html += `</div>`;
  return html;
}
function pickPerson(title, onPick, filterFn) {
  openModal(title, `<div class="search"><input id="pp_q" placeholder="ابحث بالاسم…"></div><div id="pp_res" style="max-height:50vh;overflow:auto"></div>`, () => {
    const q = document.getElementById('pp_q'), res = document.getElementById('pp_res');
    const run = () => {
      const t = normalizeAr(q.value.trim()); let list = C.persons;
      if (filterFn) list = list.filter(filterFn);
      if (t) list = list.filter(p => p._n.includes(t));
      list = list.slice(0, 40);
      res.innerHTML = list.length ? list.map(p => `<div class="card click" data-pid="${p.id}" style="margin:6px 0;padding:10px"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${esc(lineageShort(p.id))}</div></div>`).join('') : '<div class="muted" style="padding:8px">لا نتائج</div>';
      res.querySelectorAll('[data-pid]').forEach(c => c.addEventListener('click', () => { onPick(byId.get(parseInt(c.dataset.pid, 10))); closeModal(); }));
    };
    q.addEventListener('input', run); q.focus(); run();
  });
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
  box.querySelectorAll('[data-hopen]').forEach(b => b.addEventListener('click', () => setHash('#/person/' + b.dataset.hopen)));
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
      <span class="hier-name ${nameCls(p)}" data-hopen="${id}"${nameTitle(p)}>${esc(p.name)}</span>${statusTag(p)}
      ${meta}
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
      <div class="field"><label>سنة الوفاة</label><input id="p_death" type="text" value="${esc(p.death || '')}" placeholder="إن وُجدت"></div>
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
          <div class="field"><label>سنة الميلاد</label><input id="p_birth" type="text" placeholder="مثال: 1440هـ"></div>
          <div class="field"><label>مكان الميلاد (اختياري)</label><input id="p_birthplace" type="text" placeholder="اختياري"></div>
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
  // عرض سلسلة النسب الكاملة للموافقة النهائية
  const okConfirm = await confirm2(`تأكيد إضافة:\n${[name].concat(lineage(editFather ? editFather.id : 0).map(x => x.name)).join(' بن ')}`, { title: 'مراجعة النسب', okText: 'حفظ المولود', danger: false });
  if (!okConfirm) return;
  await saveBirth(name);
}
async function saveBirth(name) {
  const father = editFather;
  // حارس صلاحية صارم لمسؤول الفرع: يجب وجود أب ضمن فرعه المصرّح به فقط
  if (!isAdmin()) {
    if (!isManager()) { toast('ليست لديك صلاحية الإضافة'); return; }
    if (!father) { toast('اختر الأب أولاً'); return; }
    if (!inMyBranch(father)) { toast('الأب خارج فرعك المصرّح به — لا يمكن الإضافة'); return; }
  }
  // حارس نهائي: يُمنع فقط تطابق الاسم مع أخٍ حيّ (التكرار على متوفّى مسموح بعد تأكيد المعالج)
  if (sameNameSiblings(father, name).some(c => c.status !== 'dead')) { toast('يوجد ابن حيّ بنفس الاسم لنفس الأب — اختر اسماً مختلفاً'); return; }
  const generation = father ? (father.generation + 1) : 1;
  let branch_id = father ? father.branch_id : null;
  if (isManager() && branch_id == null) branch_id = myBranch();
  const who = (me && (me.full_name || me.username || me.phone)) || '';
  const obj = {
    name, father_id: father ? father.id : null, branch_id, generation,
    status: 'alive', birth: val('p_birth').trim(), birthplace: val('p_birthplace').trim(),
    created_by_name: who,
  };
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
  // مسؤول الفرع لا ينشئ أصلاً بلا أب — يجب اختيار والد ضمن فرعه
  if (!existing && !father && !isAdmin()) { toast('اختر الأب أولاً (يجب أن يكون ضمن فرعك)'); return; }
  if (!existing && father && isManager() && !inMyBranch(father)) { toast('الأب المختار خارج فرعك المصرّح به'); return; }
  // لا اسمان متطابقان لنفس الأب (عند الإضافة أو إعادة التسمية) — نستثني الشخص نفسه
  if (siblingNameExists(father, name, existing ? existing.id : undefined)) { toast('يوجد ابن بنفس الاسم لنفس الأب — اختر اسماً مختلفاً'); return; }
  const generation = father ? (father.generation + 1) : 1;
  // الفرع: يرث فرع الأب؛ إن كان الأب هو الأصل (جيل 1) فالفرع يُحدَّد لاحقاً من الإدارة.
  // مسؤول الفرع يضيف ضمن فروعه فقط — يرث الفرع من الأب (المقيَّد أصلاً باختيار أب من فرعه).
  let branch_id = father ? (father.generation === 1 ? (father.branch_id || null) : father.branch_id) : null;
  if (isManager() && branch_id == null) branch_id = myBranch();
  const photofile = document.getElementById('p_photofile').files[0];
  let photo_url = val('p_photo').trim();
  const who = (me && (me.full_name || me.username || me.phone)) || '';
  const obj = {
    name, father_id: father ? father.id : null, branch_id, generation,
    nickname: val('p_nickname').trim(),
    status: val('p_status'), work: val('p_work'), birth: val('p_birth').trim(), birthplace: val('p_birthplace').trim(), death: val('p_death').trim(),
    city: val('p_city').trim(), phone: val('p_phone').trim(), email: val('p_email').trim(), notes: val('p_notes').trim(),
  };
  if (existing && !(await confirm2('حفظ التعديل على هذا الشخص؟ النسخة السابقة تبقى في سلة المحذوفات.'))) return;
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
function screenBranches() {
  const list = C.branches.slice().sort((a, b) => branchCount(b.id) - branchCount(a.id));
  // عدّ المشرفين لكل فرع (الأعضاء الذين يضمّون هذا الفرع في فروعهم)
  const supCount = (bid) => C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(bid))).length;
  view().innerHTML = `
    ${isAdmin() ? '<div class="muted" style="margin-bottom:8px">الفرع = جدّ وذريّته، له مشرف أو أكثر. عيّن أي جدّ كفرع وحدّد مشرفيه. كل مشرف يرى ويضيف في فرعه فقط.</div>' : ''}
    ${(list.length ? list.map(b => {
    const n = branchCount(b.id);
    const sc = supCount(b.id);
    const sups = C.members.filter(m => m.is_active && memberBranchSet(m).has(Number(b.id))).map(m => m.full_name || m.username || '—');
    return `<div class="card click" data-go="#/branch/${b.id}">
      <div class="li-title">🗂️ ${esc(b.name)}</div>
      <div class="li-sub">عدد الأفراد: ${n} • المشرفون: ${sc ? esc(sups.join('، ')) : '—'}</div></div>`;
  }).join('') : '<div class="center-empty">لا توجد فروع بعد.</div>')}`;
  bindGo();
  if (isAdmin()) addFab('+ تعيين فرع', () => branchModal(null));
}
let branchRootPick = null;   // الجذر المختار في نافذة الفرع
function branchModal(b) {
  branchRootPick = b && b.root_id ? byId.get(b.root_id) : null;
  // مشرفون متعدّدون: صناديق اختيار من الأعضاء المفعّلين
  const supSet = new Set(C.members.filter(m => b && memberBranchSet(m).has(Number(b.id))).map(m => m.user_id));
  const supChks = C.members.filter(m => m.is_active && m.role !== 'admin').length
    ? C.members.filter(m => m.is_active && m.role !== 'admin').map(m => `<label class="perm-chk"><input type="checkbox" data-bsup="${m.user_id}" ${supSet.has(m.user_id) ? 'checked' : ''}><span>${esc(m.full_name || m.username || m.phone || '—')}</span></label>`).join('')
    : '<div class="muted">لا أعضاء بعد. أضِف مستخدمين أولاً.</div>';
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
      <button class="btn sm outline" id="h_expand">توسيع الكل</button>
      <button class="btn sm outline" id="h_collapse">طيّ الكل</button>
      ${canExport() ? `<button class="btn sm outline" id="prn">🖨️ طباعة / PDF</button>` : ''}
      ${isAdmin() ? `<button class="btn sm" id="editB">✎ تعديل الفرع</button>` : ''}
    </div>
    <div class="hier-wrap" id="hierBox"></div>`;
  bindGo();
  const eb = document.getElementById('editB'); if (eb) eb.addEventListener('click', () => branchModal(b));
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
  // لكل أب: جمّع أبناءه حسب الاسم المطبّع (يتجاهل التشكيل/الهمزات) — أي مجموعة فيها أكثر من واحد = تكرار
  const scan = (father, sibs) => {
    const m = new Map();
    sibs.forEach(c => { const k = normalizeAr(c.name); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(c); } });
    m.forEach(arr => { if (arr.length > 1) groups.push({ father, items: arr }); });
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
      <div style="margin-top:6px">${g.items.map(c => `<div class="row"><span class="k"><a href="#/person/${c.id}" style="color:var(--brand);text-decoration:none">${esc(c.name)}</a></span><span class="v" style="font-size:.8rem">${esc(lineageShort(c.id))}</span></div>`).join('')}</div>
    </div>`).join('')}`;
  bindGo();
}

/* ===== التقرير الإحصائي ===== */
function screenStats() {
  const total = C.persons.length;
  const alive = C.persons.filter(p => p.status === 'alive').length;
  const dead = total - alive;                                  // كل المتوفين (يشمل من لم يعقب)
  // من توفّي ولم يعقب = متوفّى وبلا ذرية (إحصائية منفردة، لكنه ضمن المتوفين أعلاه)
  const deadNoIssue = C.persons.filter(p => p.status === 'dead' && (descCount.get(p.id) || 0) === 0).length;
  const deadWithIssue = dead - deadNoIssue;
  const branchSizes = C.branches.map(b => ({ b, n: branchCount(b.id) })).sort((x, y) => y.n - x.n);
  view().innerHTML = `
    <div class="card"><h3>إحصاءات عامة</h3>
      ${row('إجمالي الأفراد', total)}${row('إجمالي الفروع', C.branches.length)}${row('عدد الأجيال', maxGen())}
      ${row('الأحياء', alive)}
      ${row('<span class="status-dot died" style="margin:0 0 0 6px"></span> المتوفون (الإجمالي)', '<b>' + dead + '</b>')}</div>
    <div class="card"><h3>تفصيل المتوفين</h3>
      ${row('<span class="status-dot died" style="margin:0 0 0 6px"></span> متوفّى وله ذرية', deadWithIssue)}
      ${row('<span class="status-dot died-noissue" style="margin:0 0 0 6px"></span> لم يعقب', '<b class="died-noissue-txt">' + deadNoIssue + '</b>')}</div>
    <div class="card"><h3>الفروع حسب العدد</h3>${branchSizes.length ? branchSizes.map(x => row(esc(x.b.name), x.n)).join('') : noItem()}</div>
    ${canExport() ? `<button class="btn outline no-print" id="prn">🖨️ طباعة / PDF</button>` : ''}`;
  const prn = document.getElementById('prn'); if (prn) prn.addEventListener('click', () => window.print());
}

/* ===== ملاحظات الزوار ===== */
// نموذج إرسال ملاحظة/خطأ للإدارة — متاح للجميع (زائر/عضو).
let fbFather = null;     // الأب المختار عند موضوع «إضافة مولود»
let fbFilter = 'new';    // تبويب شاشة المدير: new | done | all
function screenFeedback() {
  fbFather = null;
  view().innerHTML = `
    <div class="muted" style="margin-bottom:8px">اختر نوع الملاحظة ثم أكمل الحقول المطلوبة. ستصل للإدارة لمراجعتها واتخاذ الإجراء.</div>
    <div class="card">
      <div class="field"><label>الموضوع *</label>
        <select id="fb_subject">
          <option value="">— اختر الموضوع —</option>
          <option value="إضافة مولود">👶 إضافة مولود</option>
          <option value="ملاحظة">📝 ملاحظة / تصحيح</option>
          <option value="اقتراح">💡 اقتراح</option>
        </select>
      </div>
      <div id="fb_dynamic"></div>
      <div class="field"><label id="fb_details_lbl">التفاصيل *</label><textarea id="fb_details" rows="4" placeholder="اكتب التفاصيل…"></textarea></div>
      <button class="btn btn-lg" id="fb_send">✉️ إرسال للإدارة</button>
    </div>`;
  const sub = document.getElementById('fb_subject');
  sub.addEventListener('change', () => renderFbDynamic(sub.value));
  document.getElementById('fb_send').addEventListener('click', sendFeedback);
  renderFbDynamic('');
}
// حقول النموذج تتغيّر حسب الموضوع:
//  إضافة مولود → اختيار الأب بالبحث/التنقّل (لا فرع).  ملاحظة → الفرع + الخطأ.  اقتراح → بلا فرع.
function renderFbDynamic(subject) {
  const wrap = document.getElementById('fb_dynamic');
  const lbl = document.getElementById('fb_details_lbl');
  fbFather = null;
  if (subject === 'إضافة مولود') {
    lbl.textContent = 'تفاصيل المولود (الاسم، الحالة، الأم… اختياري)';
    wrap.innerHTML = `
      <div class="field"><label>اختر الأب (ابحث ثم اضغط الاسم للوصول إليه) *</label>
        <input id="fb_fsearch" type="text" placeholder="ابحث باسم الأب…">
        <div id="fb_fresults" style="max-height:220px;overflow:auto"></div>
        <div id="fb_fselected" class="muted" style="margin-top:6px"></div>
      </div>`;
    const fs = document.getElementById('fb_fsearch');
    fs.addEventListener('input', () => fbSearchFather(fs.value));
  } else if (subject === 'ملاحظة') {
    lbl.textContent = 'تفاصيل الملاحظة *';
    const branchOpts = C.branches.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'))
      .map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    wrap.innerHTML = `
      <div class="field"><label>الفرع</label><select id="fb_branch"><option value="">— اختر الفرع —</option>${branchOpts}</select></div>
      <div class="field"><label>الخطأ — ما هو الخطأ؟</label><textarea id="fb_error" rows="3" placeholder="صِف الخطأ والتصحيح المقترح (اختياري)"></textarea></div>`;
  } else {
    lbl.textContent = subject === 'اقتراح' ? 'اقتراحك *' : 'التفاصيل *';
    wrap.innerHTML = '';   // اقتراح: بلا فرع
  }
}
function fbSearchFather(term) {
  const res = document.getElementById('fb_fresults');
  const t = normalizeAr((term || '').trim());
  if (!t) { res.innerHTML = ''; return; }
  const list = C.persons.filter(p => (p._n || '').includes(t)).slice(0, 20);
  res.innerHTML = list.length
    ? list.map(p => `<div class="row click" data-fbf="${p.id}"><span class="k">${esc(p.name)}</span><span class="v" style="font-size:.78rem">${esc(lineageShort(p.id, 6))}</span></div>`).join('')
    : '<div class="muted" style="padding:6px">لا نتائج</div>';
  res.querySelectorAll('[data-fbf]').forEach(el => el.addEventListener('click', () => {
    fbFather = byId.get(parseInt(el.dataset.fbf, 10));
    document.getElementById('fb_fselected').innerHTML = fbFather ? '✅ الأب المختار: <b>' + esc(lineageShort(fbFather.id, 10)) + '</b>' : '';
    res.innerHTML = '';
    document.getElementById('fb_fsearch').value = fbFather ? fbFather.name : '';
  }));
}
async function sendFeedback() {
  const subject = val('fb_subject').trim();
  if (!subject) { toast('اختر الموضوع أولاً'); return; }
  const details = val('fb_details').trim();
  let branch_id = null, error_desc = '', fullDetails = details;
  if (subject === 'إضافة مولود') {
    if (!fbFather) { toast('اختر الأب من البحث أولاً'); return; }
    branch_id = fbFather.branch_id || null;
    fullDetails = 'الأب: ' + lineageShort(fbFather.id, 12) + (details ? '\n' + details : '');
  } else if (subject === 'ملاحظة') {
    branch_id = val('fb_branch') ? parseInt(val('fb_branch'), 10) : null;
    error_desc = document.getElementById('fb_error') ? val('fb_error').trim() : '';
  }
  if (!fullDetails && !error_desc) { toast('اكتب التفاصيل'); return; }
  const who = (me && (me.full_name || me.username)) || 'زائر';
  const ok = await guard(async () => {
    const { error } = await sb.from('almfrje_feedback').insert({ subject, branch_id, details: fullDetails, error_desc, created_by_name: who });
    if (error) throw error;
  });
  if (ok) { toast('تم إرسال ملاحظتك للإدارة ✅ شكراً لك'); goBack(); }
}
// عرض الملاحظات للمدير — مرتّب باحترافية: تبويبات (قيد المراجعة/منجزة/الكل) + بطاقات مصنّفة بالنوع.
async function screenFeedbacks() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  showLoading(true);
  let list = [];
  try {
    const { data, error } = await sb.from('almfrje_feedback').select('*').order('created_at', { ascending: false }).limit(2000);
    if (error) throw error; list = data || [];
  } catch (e) { showLoading(false); view().innerHTML = '<div class="center-empty">تعذّر تحميل الملاحظات.<br>' + esc(e.message || '') + '</div>'; return; }
  showLoading(false);
  const newCount = list.filter(f => f.status !== 'done').length;
  const doneCount = list.length - newCount;
  const icon = { 'إضافة مولود': '👶', 'ملاحظة': '📝', 'اقتراح': '💡' };
  const shown = list.filter(f => fbFilter === 'all' ? true : fbFilter === 'done' ? f.status === 'done' : f.status !== 'done');
  const tab = (k, t) => `<button class="btn sm ${fbFilter === k ? '' : 'outline'}" data-fbfilter="${k}" style="margin:0 3px 6px 0">${t}</button>`;
  view().innerHTML = `
    <div class="muted" style="margin-bottom:6px">ملاحظات الزوار — الإجمالي ${list.length} • قيد المراجعة ${newCount} • منجزة ${doneCount}</div>
    <div style="margin-bottom:10px">${tab('new', '🔵 قيد المراجعة (' + newCount + ')')}${tab('done', '✓ منجزة (' + doneCount + ')')}${tab('all', 'الكل (' + list.length + ')')}</div>
    ${shown.length ? shown.map(f => `
      <div class="card" style="padding:12px;${f.status !== 'done' ? 'border-right:4px solid var(--brand)' : 'opacity:.72'}">
        <div class="row" style="border:0;padding:0;align-items:center">
          <span class="li-title">${icon[f.subject] || '•'} ${esc(f.subject)}</span>
          <span>${f.status === 'done' ? '<span class="badge add">✓ تم</span>' : '<span class="badge off">جديد</span>'}</span>
        </div>
        ${f.branch_id ? `<div class="li-sub" style="margin-top:4px">🗂️ الفرع: <b>${esc(branchName(f.branch_id))}</b></div>` : ''}
        ${f.details ? `<div class="li-sub" style="margin-top:4px;white-space:pre-wrap">${esc(f.details)}</div>` : ''}
        ${f.error_desc ? `<div class="li-sub" style="margin-top:4px;white-space:pre-wrap">⚠️ ${esc(f.error_desc)}</div>` : ''}
        <div class="muted" style="margin-top:6px;font-size:.74rem">👤 ${esc(f.created_by_name || 'زائر')} • ${fmtDateTime(f.created_at)}${f.status === 'done' && f.done_by_name ? ' • أنجزها ' + esc(f.done_by_name) : ''}</div>
        <div class="btn-row" style="margin-top:8px">
          ${f.status !== 'done' ? `<button class="btn sm" data-fbdone="${f.id}">✓ تم</button>` : `<button class="btn sm outline" data-fbreopen="${f.id}">↩ إعادة فتح</button>`}
          <button class="btn sm danger" data-fbdel="${f.id}">حذف</button>
        </div>
      </div>`).join('') : '<div class="center-empty">لا توجد عناصر في هذا التبويب.</div>'}`;
  view().querySelectorAll('[data-fbfilter]').forEach(b => b.addEventListener('click', () => { fbFilter = b.dataset.fbfilter; screenFeedbacks(); }));
  view().querySelectorAll('[data-fbdone]').forEach(b => b.addEventListener('click', () => markFeedback(b.dataset.fbdone, 'done')));
  view().querySelectorAll('[data-fbreopen]').forEach(b => b.addEventListener('click', () => markFeedback(b.dataset.fbreopen, 'new')));
  view().querySelectorAll('[data-fbdel]').forEach(b => b.addEventListener('click', () => delFeedback(b.dataset.fbdel)));
}
async function markFeedback(id, status) {
  const upd = status === 'done'
    ? { status: 'done', done_by_name: (me && me.full_name) || '', done_at: new Date().toISOString() }
    : { status: 'new', done_at: null, done_by_name: '' };
  const ok = await guard(async () => { const { error } = await sb.from('almfrje_feedback').update(upd).eq('id', id); if (error) throw error; });
  if (ok) { toast(status === 'done' ? 'تم وضع علامة «تم» ✓' : 'أُعيد فتح الملاحظة'); screenFeedbacks(); }
}
async function delFeedback(id) {
  if (!(await confirm2('حذف هذه الملاحظة نهائياً؟', { title: 'تأكيد الحذف', okText: 'حذف', danger: true }))) return;
  const ok = await guard(async () => { const { error } = await sb.from('almfrje_feedback').delete().eq('id', id); if (error) throw error; });
  if (ok) { toast('حُذفت الملاحظة'); screenFeedbacks(); }
}

/* ===== المزيد ===== */
function screenMore() {
  const r0 = roots()[0];
  // مجموعات متقاربة — كل مجموعة عنوان وعناصرها [label, action, hint?]
  const groups = [];
  // العرض والتصفّح (للجميع)
  const browse = [['📊 التقرير الإحصائي', '#/stats']];
  if (r0) { browse.push(['🌳 العرض الهرمي العام', '#/hierarchy/all', 'hierarchy']); browse.push(['🗒️ نموذج الأعمدة', '#/outline/all', 'outline']); }
  browse.push(['📇 فهرس ذرية شخص', '#pickdesc', 'relations']);
  groups.push(['🔎 العرض والتقارير', browse]);
  // البيانات (إضافة/تعديل/استيراد)
  const data = [];
  if (isAdmin()) data.push(['📥 استيراد ملف Excel', '#/import', 'import']);
  if (isAdmin() || isManager()) data.push(['✏️ تعديل جماعي', '#/bulk', 'bulk']);
  if (isAdmin() || isManager()) data.push(['🔁 كشف الأسماء المكرّرة لنفس الأب', '#/dups', 'dups']);
  if (isAdmin()) data.push(['📨 ملاحظات الزوار الواردة', '#/feedbacks', 'feedbacks']);
  if (isManager() && !isAdmin()) data.push(['📋 سجل تعديلاتي (تراجع)', '#/audit', 'audit']);
  if (canExport() && !isAdmin()) data.push(['💾 النسخ والتصدير', '#/backups', 'backups']);   // للمدير ضمن لوحة التحكم
  if (data.length) groups.push(['🗂️ البيانات', data]);
  // لوحة التحكم (للمدير) — مدخل واحد يفتح التبويبات (المستخدمون/النصوص/التعليمات/السجل/السلة/النسخ)
  if (isAdmin()) groups.push(['⚙️ الإدارة', [['⚙️ لوحة التحكم', '#/members', 'control_panel']]]);
  // الحساب — حساب الزائر المشترك لا يملك ملفاً شخصياً (لا يغيّر جوال/كلمة مرور الحساب المشترك)
  const acct = [];
  if (!isGuestUser()) acct.push(['👤 ملفي الشخصي (الجوال/كلمة المرور)', '#/profile', 'profile']);
  if (!alreadyInstalled()) acct.push(['📌 إضافة اختصار الموقع إلى الشاشة', '#install']);
  if (isGuestUser()) acct.push(['🔐 دخول المسؤول / مسؤول الفرع', '#adminlogin']);
  if (acct.length) groups.push(['👤 حسابي', acct]);

  view().innerHTML = groups.map(([title, items]) => `
    <div class="more-group">
      <div class="more-group-title">${title}</div>
      ${items.map(([l, h, hint]) => `<div class="card click more-card" data-act="${h}"><div class="li-title">${l}</div>${hint ? hintBtn(hint) : ''}</div>`).join('')}
    </div>`).join('')
    + `<div class="muted" style="text-align:center;margin-top:14px;font-size:.85rem">المفارجة — شجرة الأنساب</div>`;
  view().querySelectorAll('[data-act]').forEach(c => c.addEventListener('click', (e) => {
    if (e.target.closest('[data-hint]')) return;   // لا تتنقّل عند الضغط على (i)
    if (c.dataset.act === '#pickdesc') pickDescendantStart();
    else if (c.dataset.act === '#install') triggerInstall();
    else if (c.dataset.act === '#adminlogin') { location.hash = '#login'; sb.auth.signOut(); }
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
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    download(`almfrje_backup_${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
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
    const clean = (o, drop = []) => { const r = {}; for (const k in o) { if (!k.startsWith('_') && !drop.includes(k)) r[k] = o[k]; } return r; };
    const insChunks = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 300) {
        const { error } = await sb.from(table).insert(rows.slice(i, i + 300)); if (error) throw error;
      }
    };
    const persons = d.persons || [], branches = d.branches || [], docs = d.documents || [];
    if (persons.length) await insChunks('almfrje_persons', persons.map(p => clean(p, ['father_id', 'branch_id'])));
    if (branches.length) await insChunks('almfrje_branches', branches.map(b => clean(b, ['root_id'])));
    for (const p of persons) {
      if (p.father_id != null || p.branch_id != null) {
        await sb.from('almfrje_persons').update({ father_id: p.father_id ?? null, branch_id: p.branch_id ?? null }).eq('id', p.id);
      }
    }
    for (const b of branches) {
      if (b.root_id != null) await sb.from('almfrje_branches').update({ root_id: b.root_id }).eq('id', b.id);
    }
    if (docs.length) await insChunks('almfrje_documents', docs.map(x => clean(x)));
    if (d.settings && d.settings.length) {
      for (const s of d.settings) { await sb.from('almfrje_settings').upsert(clean(s), { onConflict: 'key' }); }
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
// نافذة اختيار جدّ هرمية: المدير يبدأ من الأصول (فراج/مفرج)، ومسؤول الفرع من فرعه
// (الجيل الثاني). تتنقّل بالضغط على الاسم للدخول لأبنائه، مع زر «اختيار» لكل اسم.
let _ancNav = null;   // الشخص المعروض حالياً (null = القمة)
function pickAncestorModal(onPick) {
  // نقاط البداية: للمسؤول جذور فروعه (ج٢)، للمدير الأصول
  const tops = (!isAdmin() && isManager())
    ? myBranches().map(bid => branchRoot(bid)).filter(Boolean)
    : roots();
  _ancNav = null;
  const render = () => {
    const cur = _ancNav;
    const list = cur ? childrenOf(cur.id) : tops;
    const crumb = cur ? lineage(cur.id).slice().reverse() : [];
    const body = `
      <div class="anc-bar">
        <button class="btn sm outline" id="anc_top" ${!cur ? 'disabled' : ''}>⌂ القمة</button>
        ${cur ? `<button class="btn sm outline" id="anc_up">↑ للأعلى</button>` : ''}
      </div>
      ${cur ? `<div class="anc-crumb">${crumb.map((x, i) => `<span class="anc-cl" data-ancgo="${x.id}">${esc(x.name)}</span>`).join(' › ')}</div>
        <div class="anc-cur"><b>${esc(cur.name)}</b> (جيل ${cur.generation}) <button class="btn sm" id="anc_pickcur">✅ اختيار هذا</button></div>` : '<div class="muted" style="margin-bottom:6px">اختر الأصل ثم تنقّل لأبنائه:</div>'}
      <div class="anc-list">
        ${list.length ? list.map(c => {
          const kc = childCount.get(c.id) || 0;
          return `<div class="anc-row">
            <span class="anc-name" data-ancinto="${c.id}">${esc(c.name)} <span class="muted" style="font-size:.78rem">(جيل ${c.generation}${kc ? ' • ' + kc + ' ابن' : ''})</span></span>
            <button class="btn sm" data-ancpick="${c.id}">اختيار</button>
          </div>`;
        }).join('') : '<div class="muted" style="padding:8px">لا أبناء.</div>'}
      </div>`;
    openModal('اختيار الجدّ', body, () => {
      const top = document.getElementById('anc_top'); if (top) top.addEventListener('click', () => { _ancNav = null; render(); });
      const up = document.getElementById('anc_up'); if (up) up.addEventListener('click', () => { _ancNav = (cur && cur.father_id) ? byId.get(cur.father_id) : null; render(); });
      const pc = document.getElementById('anc_pickcur'); if (pc) pc.addEventListener('click', () => { closeModal(); onPick(cur); });
      document.querySelectorAll('[data-ancinto]').forEach(b => b.addEventListener('click', () => { _ancNav = byId.get(parseInt(b.dataset.ancinto, 10)); render(); }));
      document.querySelectorAll('[data-ancpick]').forEach(b => b.addEventListener('click', () => { closeModal(); onPick(byId.get(parseInt(b.dataset.ancpick, 10))); }));
      document.querySelectorAll('[data-ancgo]').forEach(b => b.addEventListener('click', () => { _ancNav = byId.get(parseInt(b.dataset.ancgo, 10)); render(); }));
    });
  };
  render();
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

/* ===== النصوص: نص الرئيسية + تعريف ألوان الحالة (للمدير) ===== */
function screenTexts() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  view().innerHTML = adminTabBar('texts') + `
    <div class="card"><h3>📝 نص الرئيسية ${hintBtn('banner')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">يظهر أعلى الصفحة الرئيسية للجميع.</p>
      ${fTextarea('النص', 'tx_banner', bannerText)}
      <button class="btn sm" id="tx_bannerSave" style="margin-top:6px">حفظ النص</button></div>
    <div class="card"><h3>🎨 تعريف ألوان الحالة</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-2px">تظهر دلالة الألوان أسفل الرئيسية. عدّل المسميات كما تريد.</p>
      ${fInput('الاسم بلون عادي يعني', 'tx_alive', statLabels.alive)}
      ${fInput('الاسم بلون رمادي يعني', 'tx_dead', statLabels.dead)}
      ${fInput('الاسم بلون أحمر يعني', 'tx_noissue', statLabels.noissue)}
      <button class="btn sm" id="tx_lblSave">حفظ المسميات</button>
      <div class="status-legend" style="margin-top:12px">
        <span class="n-alive">${esc(statLabels.alive)}</span>
        <span class="n-died">${esc(statLabels.dead)}</span>
        <span class="n-noissue">${esc(statLabels.noissue)}</span>
      </div></div>`;
  document.getElementById('tx_bannerSave').addEventListener('click', async () => {
    const txt = val('tx_banner').trim();
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'banner_text', value: txt, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { bannerText = txt; toast('تم حفظ النص'); }
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
  const mine = !isAdmin();   // مسؤول الفرع يرى أفعاله فقط (تقييد على الخادم أيضاً)
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
  bindGo();
}

/* ===== النسخ الاحتياطية (محفوظة في القاعدة — يطلبها المدير في أي وقت) ===== */
// تبويب «النسخ والتصدير» الموحّد (يتفرّع داخلياً بتبويبات حسب الدور)
let dataTab = 'export';
async function screenBackups() {
  // المدير: نسخ احتياطية + تصدير + استعادة. غير المدير (مصرّح بالتصدير): تصدير فقط.
  if (!isAdmin() && !canExport()) { view().innerHTML = noPerm(); return; }
  const tabs = [];
  if (isAdmin()) tabs.push(['backup', '💾 النسخ الاحتياطية']);
  if (canExport()) tabs.push(['export', '📤 التصدير']);
  if (isAdmin()) tabs.push(['restore', '♻️ الاستعادة']);
  if (!tabs.find(t => t[0] === dataTab)) dataTab = tabs[0][0];

  let list = [];
  if (dataTab === 'backup') {
    showLoading(true);
    try {
      const { data, error } = await sb.from('almfrje_backups')
        .select('id,label,note,persons_count,branches_count,actor_name,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error; list = data || [];
    } catch (e) { toast('تعذّر تحميل النسخ: ' + (e.message || e)); }
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
    </div>`;
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
}

/* ===== المستخدمون والصلاحيات ===== */
let expandedMember = null;   // user_id للعضو المفتوح حالياً
function screenMembers() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const list = C.members.slice().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  view().innerHTML = adminTabBar('members') + `
    <div class="card"><div class="li-title">➕ إضافة مستخدم جديد ${hintBtn('add_user')}</div>
      <div class="li-sub">أنشئ حساباً وحدّد الفروع التي يُشرف عليها وصلاحياته.</div>
      <button class="btn sm" id="addUserBtn" style="margin-top:6px">➕ إضافة مستخدم</button></div>
    <div class="card"><div class="li-title">👁 فتح الموقع للزوّار (تصفّح مباشر) ${hintBtn('guest_browse')}</div>
      <div class="li-sub">${guestOpen ? 'مفتوح — يدخل الزائر مباشرةً للتصفّح (قراءة فقط) دون تسجيل. دخول الإدارة عبر الرابط <b>#login</b>.' : 'مغلق — تظهر شاشة الدخول للجميع (للمسؤولين فقط).'}</div>
      <button class="btn sm ${guestOpen ? 'danger' : ''}" id="guestToggle" style="margin-top:6px">${guestOpen ? '🔒 إغلاق الموقع عن الزوّار' : '👁 فتح الموقع للزوّار'}</button>
      ${guestOpen ? `<div style="margin-top:10px"><div class="li-sub" style="font-weight:700;margin-bottom:4px">ماذا يُخفى عن الزائر؟</div>
        <label class="perm-chk"><input type="checkbox" data-ghide="phone" ${guestHide.phone ? 'checked' : ''}><span>أرقام الجوال والبريد</span></label>
        <label class="perm-chk"><input type="checkbox" data-ghide="media" ${guestHide.media ? 'checked' : ''}><span>الصور والمستندات</span></label>
        <label class="perm-chk"><input type="checkbox" data-ghide="notes" ${guestHide.notes ? 'checked' : ''}><span>الملاحظات والحالة الوظيفية</span></label>
        <div class="muted" style="font-size:.78rem;margin-top:4px">تُحفظ التغييرات فور التأشير. الأسماء والنسب والأجيال والمدن وتواريخ الميلاد/الوفاة تبقى ظاهرة.</div></div>` : ''}</div>
    <div class="card"><h3>المستخدمون (${list.length}) ${hintBtn('member_role')}</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-4px">اضغط على اسم لعرض تفاصيله والتحكّم به.</p>
      <div class="mlist">${list.map(memberRow).join('')}</div>
    </div>`;
  const au = document.getElementById('addUserBtn'); if (au) au.addEventListener('click', addUserModal);
  const gTg = document.getElementById('guestToggle');
  if (gTg) gTg.addEventListener('click', async () => {
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_open', value: !guestOpen, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestOpen = !guestOpen; toast(guestOpen ? 'الموقع مفتوح للزوّار' : 'الموقع مغلق (للمسؤولين فقط)'); screenMembers(); }
  });
  view().querySelectorAll('input[data-ghide]').forEach(cb => cb.addEventListener('change', async () => {
    const next = Object.assign({ ...GUEST_HIDE_DEFAULT }, guestHide, { [cb.dataset.ghide]: cb.checked });
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_settings').upsert({ key: 'guest_hide', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw error; });
    if (ok) { guestHide = next; toast('تم الحفظ'); } else { cb.checked = !cb.checked; }
  }));
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
const ROLE_HINT = { admin: 'صلاحيات كاملة على كل الأقسام والإدارة.', branch_manager: 'إضافة أفراد في فروعه فقط (التعديل/الحذف للمدير).', viewer: 'تصفّح فقط.' };
function memberCardBody(m) {
  const roleOpts = ROLES.map(r => `<option value="${r.k}" ${m.role === r.k ? 'selected' : ''}>${r.ar}</option>`).join('');
  const bset = memberBranchSet(m);
  const branchChks = C.branches.length
    ? C.branches.map(b => `<label class="perm-chk"><input type="checkbox" data-mbranch="${b.id}" data-uid="${m.user_id}" ${bset.has(Number(b.id)) ? 'checked' : ''}><span>${esc(b.name)}</span></label>`).join('')
    : '<div class="muted">لا فروع بعد.</div>';
  const showBranches = m.role === 'branch_manager';
  return `
    <div class="li-sub">${m.phone ? '📱 ' + esc(m.phone) : 'بلا جوال'}${m.phone && m.username ? ' • ' : ''}${m.username ? '@' + esc(m.username) : ''} <span class="badge ${m.is_active ? '' : 'off'}">${m.is_active ? 'مفعّل' : 'موقوف'}</span></div>
    <div class="field" style="margin-top:8px"><label>الدور</label><select data-role="${m.user_id}">${roleOpts}</select></div>
    <div class="perm-note" data-rolehint="${m.user_id}" style="margin:-4px 0 8px">${ROLE_HINT[m.role] || ''}</div>
    <div class="perm-box" data-branchbox="${m.user_id}" style="${showBranches ? '' : 'display:none'}">
      <div class="perm-title">الفروع المسؤول عنها:</div>
      ${branchChks}
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
    const box = q(`[data-branchbox="${m.user_id}"]`); if (box) box.style.display = roleSel.value === 'branch_manager' ? '' : 'none';
    const hint = q(`[data-rolehint="${m.user_id}"]`); if (hint) hint.textContent = ROLE_HINT[roleSel.value] || '';
  });
  const tg = q(`[data-toggle="${m.user_id}"]`); if (tg) tg.addEventListener('click', async () => { const ok = await guard(async () => { await updMember(m.user_id, { is_active: !m.is_active }); }); if (ok) { await loadAll(); screenMembers(); } });
  const sv = q(`[data-save="${m.user_id}"]`); if (sv) sv.addEventListener('click', async () => {
    const role = q(`[data-role="${m.user_id}"]`).value;
    const isMgr = role === 'branch_manager';
    const branch_ids = [];
    if (isMgr) view().querySelectorAll(`input[data-mbranch][data-uid="${m.user_id}"]`).forEach(cb => { if (cb.checked) branch_ids.push(parseInt(cb.dataset.mbranch, 10)); });
    const ok = await guard(async () => { await updMember(m.user_id, {
      role,
      branch_ids: isMgr ? branch_ids : [],
      branch_id: isMgr && branch_ids.length ? branch_ids[0] : null,   // توافق مع القديم
      perms: {},
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
      if (!(await confirm2('حفظ تعديل بيانات هذا المستخدم؟'))) return;
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
  openModal('إضافة مستخدم جديد', `
    ${fInput('الاسم الكامل', 'nu_name', '')}
    ${fInput('رقم الجوال', 'nu_phone', '', 'tel', 'inputmode="tel"')}
    ${fInput('اسم المستخدم (اختياري)', 'nu_user', '', 'text', 'autocomplete="off"')}
    ${pinField('الرقم السري (٤ أرقام فأكثر)', 'nu_pin')}
    <div class="field"><label>الدور</label><select id="nu_role">${roleOpts}</select></div>
    <div id="nu_mgrbox">
      <div class="perm-box"><div class="perm-title">الفروع المسؤول عنها (يضيف فيها فقط):</div>${branchChks}</div>
    </div>
    <div id="nu_rolenote" class="muted" style="font-size:.85rem;margin:6px 0"></div>
    <button class="btn" id="nu_save">إنشاء الحساب وتفعيله</button>`, () => {
    const roleSel = document.getElementById('nu_role');
    const mgrBox = document.getElementById('nu_mgrbox');
    const roleNote = document.getElementById('nu_rolenote');
    const syncRole = () => {
      const r = roleSel.value;
      mgrBox.style.display = (r === 'branch_manager') ? '' : 'none';
      roleNote.textContent = ROLE_HINT[r] || '';
    };
    roleSel.addEventListener('change', syncRole); syncRole();

    document.getElementById('nu_save').addEventListener('click', async () => {
      const full_name = val('nu_name').trim();
      const phone = normPhone(val('nu_phone'));
      const username = val('nu_user').trim();
      const pin = val('nu_pin').trim();
      const role = roleSel.value;
      if (!full_name) { toast('أدخل الاسم'); return; }
      if (phone.length < 7) { toast('أدخل رقم جوال صحيح'); return; }
      if (!PIN_RE.test(pin)) { toast('الرقم السري ٤ أرقام على الأقل'); return; }
      const isMgr = role === 'branch_manager';
      const branch_ids = [];
      if (isMgr) document.querySelectorAll('input[data-nubranch]').forEach(cb => { if (cb.checked) branch_ids.push(parseInt(cb.dataset.nubranch, 10)); });
      const perms = {};
      if (role === 'admin' && !(await confirm2('إنشاء مستخدم بصلاحية مدير نظام كاملة؟'))) return;
      const ok = await guard(async () => {
        // أنشئ حساب المصادقة عبر عميل مؤقّت كي لا يبدّل جلسة المدير
        const tmp = window.supabase.createClient(window.ALMFRJE_CONFIG.SUPABASE_URL, window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'almfrje_admin_tmp' } });
        const { data, error } = await tmp.auth.signUp({ email: phoneToEmail(phone), password: pinToPass(pin), options: { data: { full_name, username, phone } } });
        if (error) throw error;
        try { await tmp.auth.signOut(); } catch (e) { /* تجاهل */ }
        const uid = data && data.user && data.user.id;
        if (uid) {
          // فعّله مباشرةً بالدور المحدّد (المُشغّل ينشئ الصف، نحدّثه)
          await new Promise(r => setTimeout(r, 600));
          await sb.from('almfrje_members').update({
            full_name, username: username || null, phone,
            role, is_active: true,
            branch_ids: isMgr ? branch_ids : [],
            branch_id: isMgr && branch_ids.length ? branch_ids[0] : null,
            perms,
          }).eq('user_id', uid);
        }
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
  view().innerHTML = adminTabBar('trash') + `<div class="muted" style="margin-bottom:8px">العناصر المحذوفة والنُّسخ السابقة قابلة للاستعادة.</div>`
    + (list.length ? list.map(t => `<div class="card"><div class="li-title">${esc(t.label || t.tbl)}</div>
        <div class="li-sub"><span class="badge ${t.action === 'delete' ? 'off' : ''}">${actionAr[t.action] || t.action}</span> ${fmtDateTime(t.created_at)} • ${esc(t.actor_name || '')}</div>
        <div class="btn-row" style="margin-top:6px"><button class="btn sm" data-rest="${t.id}">استعادة</button><button class="btn sm danger" data-perm="${t.id}">حذف نهائي</button></div></div>`).join('') : '<div class="center-empty">السلة فارغة.</div>');
  view().querySelectorAll('[data-rest]').forEach(b => b.addEventListener('click', () => restoreTrash(list.find(x => String(x.id) === b.dataset.rest))));
  view().querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirm2('حذف نهائي لا تراجع عنه. متأكّد؟'))) return;
    const ok = await guard(async () => { const { error } = await sb.from('almfrje_trash').delete().eq('id', b.dataset.perm); if (error) throw error; });
    if (ok) { toast('تم الحذف النهائي'); screenTrash(); }
  }));
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
function openModal(title, body, onMount) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3>${body}<button class="btn outline" id="modalClose" style="margin-top:10px">إلغاء</button></div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) closeModal(); });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  bindHints(root);
  if (onMount) onMount();
  bindEyes(root);   // فعّل أزرار العين بعد بناء محتوى النافذة
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

/* ===== شاشة بانتظار التفعيل ===== */
function renderPending() {
  document.getElementById('screenTitle').textContent = 'المفارجة';
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('bottomnav').innerHTML = '';
  document.querySelectorAll('.fab').forEach(f => f.remove());
  view().innerHTML = `<div class="center-empty"><div style="font-size:3rem">⏳</div>
    <h3>حسابك بانتظار التفعيل</h3>
    <p class="muted">تم إنشاء حسابك. يرجى أن يقوم مدير النظام بتفعيلك ومنحك الدور المناسب، ثم أعد تسجيل الدخول.</p>
    <div class="muted">${esc((me && me.full_name) || '')}</div>
    <div style="margin-top:18px"><button class="btn outline" id="claimAdmin">أنا أول مستخدم — فعّلني كمدير</button>
    <p class="muted" style="font-size:.8rem;margin-top:8px">يعمل فقط إن لم يوجد مدير بعد.</p></div></div>`;
  const cb = document.getElementById('claimAdmin');
  if (cb) cb.addEventListener('click', async () => {
    const reset = () => { cb.disabled = false; cb.textContent = 'أنا أول مستخدم — فعّلني كمدير'; };
    cb.disabled = true; cb.textContent = '… جارٍ';
    const tryClaim = async () => await sb.rpc('almfrje_claim_admin');
    try {
      let { data: claim, error } = await tryClaim();
      // إن لم تكن الدالة منشأة بعد، شغّل الإعداد التلقائي ثم أعد المحاولة.
      if (error && /does not exist|schema cache/i.test(error.message || '')) {
        cb.textContent = '… تهيئة النظام'; await fetch('/api/almfrje-setup', { method: 'POST' });
        await new Promise(r => setTimeout(r, 1200));
        ({ data: claim, error } = await tryClaim());
      }
      if (error) throw error;
      if (claim === 'claimed') { toast('تم تفعيلك كمدير'); const { data: { session } } = await sb.auth.getSession(); if (session) await enterApp(session); }
      else if (claim === 'exists') { toast('يوجد مدير بالفعل — راجعه للتفعيل'); reset(); }
      else { toast('تعذّر التفعيل'); reset(); }
    } catch (e) {
      toast('تعذّر: ' + (e.message || e)); reset();
    }
  });
}

/* ===== المصادقة (جوال/اسم مستخدم + رقم سري ٤ أرقام) ===== */
function buildNav() {
  const tabs = [['#/home', '🏠', 'الرئيسية'], ['#/search', '🔍', 'البحث'], ['#/tree', '🌳', 'الشجرة'], ['#/branches', '🗂️', 'الفروع'], ['#/more', '☰', 'المزيد']];
  const nav = document.getElementById('bottomnav');
  nav.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
  nav.innerHTML = tabs.map(([r, i, l]) => `<button class="nav-item" data-route="${r}"><span>${i}</span>${l}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => setHash(b.dataset.route)));
}
const normPhone = (s) => (s || '').replace(/\D/g, '');
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
async function browseAsGuest(msgEl) {
  try {
    let { error } = await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASS });
    if (error) {
      // أول مرة: أنشئ الحساب ثم ادخل به
      await sb.auth.signUp({ email: GUEST_EMAIL, password: GUEST_PASS, options: { data: { full_name: 'زائر', username: 'guest' } } });
      await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASS });
    }
    await rpcEnsureGuest();   // فعّل دور viewer للحساب المخصّص (آمن — لا يمنح أعلى)
    const { data: { session } } = await sb.auth.getSession();
    if (session) { _authUid = session.user.id; await enterApp(session); return true; }
    if (msgEl) { msgEl.classList.add('err'); msgEl.textContent = 'تعذّر فتح وضع الزائر'; }
    return false;
  } catch (e) { if (msgEl) { msgEl.classList.add('err'); msgEl.textContent = translateAuthError(e.message); } return false; }
}
// رابط دخول المسؤول/المشرف: #login أو #admin (يُخفي شاشة الدخول عن الزوّار العاديين).
function isAdminLoginUrl() {
  const h = (location.hash || '').replace(/^#\/?/, '').toLowerCase();
  return h === 'login' || h === 'admin';
}
// شاشة الدخول — مختصرة: دخول المسؤول/المشرف فقط، أو تصفّح كزائر. لا تسجيل حسابات
// (الحسابات يُنشئها المدير من داخل التطبيق).
function renderAuth() {
  document.querySelectorAll('.fab').forEach(f => f.remove());   // أزل الأزرار العائمة عند الخروج
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  box.innerHTML = `<div class="auth-box">
    <div class="logo">🌳</div><h2>المفارجة</h2><div class="sub">دخول المسؤول / مسؤول الفرع</div>
    ${fInput('الجوال أو اسم المستخدم', 'a_id', '')}
    ${pinField('الرقم السري', 'a_pin')}
    <button class="btn" id="a_submit">تسجيل الدخول</button>
    <div class="auth-msg" id="a_msg"></div>
    ${guestOpen ? `<button class="auth-guest-link" id="a_guest">تصفّح الموقع كزائر ←</button>` : ''}
    </div>`;
  document.getElementById('a_submit').addEventListener('click', submit);
  { const gb = document.getElementById('a_guest'); if (gb) gb.addEventListener('click', () => { const m = document.getElementById('a_msg'); m.className = 'auth-msg'; m.textContent = '… جارٍ فتح التصفّح'; location.hash = '#/home'; browseAsGuest(m); }); }
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
async function enterApp(session) {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildNav();
  showLoading(true);
  let { data: mem } = await sb.from('almfrje_members').select('*').eq('user_id', session.user.id).maybeSingle();
  me = mem || { user_id: session.user.id, full_name: '', role: 'viewer', is_active: false, perms: {} };
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
  document.getElementById('signoutBtn').classList.toggle('hidden', isGuestUser());
  try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); }
  showLoading(false);
  // الزائر دخل عبر رابط الإدارة سهواً؟ حوّله للرئيسية بدل بقائه على #login
  if (!location.hash || isAdminLoginUrl()) location.hash = '#/home';
  render();
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
async function init() {
  let t = 'light'; try { t = localStorage.getItem('almfrje_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { }
  applyTheme(t);
  document.getElementById('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  if (configMissing()) { showSetup(); return; }
  sb = window.supabase.createClient(window.ALMFRJE_CONFIG.SUPABASE_URL, window.ALMFRJE_CONFIG.SUPABASE_ANON_KEY);
  // إعداد تلقائي للقاعدة بأسلوب «أفضل جهد» وبلا انتظار — لا يحجب فتح التطبيق.
  // (الجداول تُنشأ مرة واحدة؛ النداء يعمل في الخلفية دون تعطيل البدء.)
  try { fetch('/api/almfrje-setup', { method: 'POST' }).catch(() => {}); } catch (e) { /* تجاهل */ }
  document.getElementById('backBtn').addEventListener('click', goBack);
  // خروج المسؤول/المشرف يعيده لشاشة الدخول (#login). الزائر لا يملك زرّ خروج.
  document.getElementById('signoutBtn').addEventListener('click', async () => { location.hash = '#login'; await sb.auth.signOut(); });
  window.addEventListener('hashchange', () => { if (me && me.is_active) render(); });
  // لا تُعِد دخول التطبيق إلا عند تغيّر هوية المستخدم فعلياً. أحداث مثل
  // TOKEN_REFRESHED تتكرر (خصوصاً على الجوال عند فتح منتقي الملفات والرجوع)،
  // وإعادة الرسم معها كانت تمسح حقل الملف المختار. نتجاهلها هنا.
  sb.auth.onAuthStateChange((event, session) => {
    const uid = session && session.user ? session.user.id : null;
    if (uid) {
      if (uid !== _authUid) { _authUid = uid; enterApp(session); }
      // نفس المستخدم (تحديث رمز/تركيز): لا تُعِد الرسم.
    } else {
      _authUid = null; me = null;
      // بعد الخروج: إن كان الموقع مفتوحاً للزوّار ولسنا على رابط الإدارة، اعرض التصفّح مباشرةً.
      if (guestOpen && !isAdminLoginUrl()) browseAsGuest(); else renderAuth();
    }
  });
  await loadSettings();
  const { data: { session } } = await sb.auth.getSession();
  const wantAdmin = isAdminLoginUrl();
  if (session && session.user) {
    const guestSess = session.user.email === GUEST_EMAIL;
    // جلسة زائر مع طلب دخول الإدارة أو إغلاق الموقع → سجّل خروج الزائر واعرض شاشة الدخول
    if (guestSess && (wantAdmin || !guestOpen)) {
      _authUid = null; me = null; await sb.auth.signOut(); showLoading(false); renderAuth();
    } else {
      _authUid = session.user.id; await enterApp(session);
    }
  } else if (!wantAdmin && guestOpen) {
    // لا جلسة + الموقع مفتوح + لسنا على رابط الإدارة → دخول الزائر مباشرةً للتصفّح
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
