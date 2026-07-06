/* مراحي — تطبيق ويب متعدد المستخدمين (Supabase) — مزرعة واحدة مشتركة + صلاحيات تفصيلية */
'use strict';

/* ===== مسميات ===== */
let TYPES = [
  { k: 'camel', ar: 'إبل', gest: 390 }, { k: 'sheep', ar: 'غنم', gest: 150 },
  { k: 'goat', ar: 'ماعز', gest: 150 }, { k: 'cattle', ar: 'بقر', gest: 283 },
];
const SEX = [{ k: 'female', ar: 'أنثى' }, { k: 'male', ar: 'ذكر' }];
const STATUS = [{ k: 'present', ar: 'موجودة' }, { k: 'sold', ar: 'مباعة' }, { k: 'dead', ar: 'نافقة' }];
const SOURCE = [{ k: 'purchased', ar: 'مشترى' }, { k: 'born', ar: 'ولادة' }];
const TREAT_FORM = [{ k: 'injection', ar: 'إبرة (حقن)' }, { k: 'oral', ar: 'تجريع (فموي)' }, { k: 'spray', ar: 'رش' }, { k: 'topical', ar: 'دهن' }];
const IDKIND = [{ k: 'number', ar: 'رقم' }, { k: 'tag', ar: 'وسم' }, { k: 'chip', ar: 'شريحة إلكترونية' }, { k: 'name', ar: 'اسم / مسمى' }];
const PREG = [{ k: 'monitoring', ar: 'تحت المتابعة' }, { k: 'born', ar: 'ولدت' }, { k: 'not_confirmed', ar: 'لم يثبت الحمل' }];
const MODULES = [
  { k: 'animals', ar: 'الحلال' }, { k: 'breeding', ar: 'التلقيح/الولادات' },
  { k: 'vaccines', ar: 'التطعيمات' }, { k: 'treatments', ar: 'العلاجات' },
];
const arOf = (arr, k) => (arr.find(x => x.k === k) || {}).ar || '—';
const gestOf = (t) => (TYPES.find(x => x.k === t) || TYPES[1]).gest;

/* ===== أدوات ===== */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => document.getElementById('view');
const todayStr = () => new Date().toISOString().slice(0, 10);
function addDays(d, n) { if (!d) return null; const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function daysUntil(d) { if (!d) return null; return Math.round((new Date(d + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000); }
const fmtDate = (d) => d ? String(d).slice(0, 10).replace(/-/g, '/') : '—';
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
const val = (id) => (document.getElementById(id) || {}).value || '';
const num = (id) => parseInt(val(id), 10) || 0;

function fInput(label, id, v, type = 'text', extra = '') { return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(v == null ? '' : v)}" ${extra}></div>`; }
function fTextarea(label, id, v) { return `<div class="field"><label>${label}</label><textarea id="${id}">${esc(v || '')}</textarea></div>`; }
function fSelect(label, id, options, selected, blank) {
  const opts = (blank ? `<option value="">${blank}</option>` : '') + options.map(o => `<option value="${o.k}" ${o.k === selected ? 'selected' : ''}>${o.ar}</option>`).join('');
  return `<div class="field"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
function fAnimalSelect(label, id, selectedId, list, blank = '— اختر —') {
  const opts = `<option value="">${blank}</option>` + list.map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${esc(a.code || '—')}${a.name ? ' • ' + esc(a.name) : ''}</option>`).join('');
  return `<div class="field"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const noItem = () => '<div class="muted">لا يوجد</div>';

/* ===== الحالة العامة ===== */
let sb = null;        // عميل Supabase
let me = null;        // صف العضو الحالي (الصلاحيات)
let signupOpen = true; // هل التسجيل (حساب جديد) مفتوح؟ يتحكّم به المدير
const C = { animals: [], matings: [], pregnancies: [], births: [], vaccineTypes: [], vaccinations: [], treatments: [], treatmentTypes: [], members: [], backups: [], types: [] };
const TABLES = {
  animals: 'mrahi_animals', matings: 'mrahi_matings', pregnancies: 'mrahi_pregnancies',
  births: 'mrahi_births', vaccineTypes: 'mrahi_vaccine_types', vaccinations: 'mrahi_vaccinations',
  treatments: 'mrahi_treatments', treatmentTypes: 'mrahi_treatment_types', members: 'mrahi_members', backups: 'mrahi_backups',
};
function can(mod, act) { return !!(me && me.is_active && (me.role === 'admin' || (me.perms && me.perms[mod] && me.perms[mod][act]))); }
const isAdmin = () => !!(me && me.role === 'admin' && me.is_active);
const animalById = (id) => C.animals.find(a => a.id === id);
function display(a) { if (!a) return '—'; return esc(a.code || '—') + (a.name ? ' • ' + esc(a.name) : ''); }

/* ===== طبقة البيانات ===== */
async function loadAll() {
  const keys = Object.keys(TABLES);
  const results = await Promise.all(keys.map(k => sb.from(TABLES[k]).select('*')));
  keys.forEach((k, i) => { C[k] = results[i].error ? [] : (results[i].data || []); });
  // أنواع الحلال القابلة للإدارة (تُحدّث القائمة العامة TYPES)
  try {
    const tr = await sb.from('mrahi_types').select('*');
    C.types = tr.error ? [] : (tr.data || []);
    if (C.types.length) TYPES = C.types.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(t => ({ k: t.key, ar: t.ar, gest: t.gest }));
  } catch (e) { /* تجاهل */ }
  await loadSignupOpen();
  try { await sb.rpc('mrahi_purge_trash'); } catch (e) { /* تنظيف أفضل جهد */ }
}
async function loadSignupOpen() {
  try {
    const { data } = await sb.from('mrahi_settings').select('value').eq('key', 'signup_open').maybeSingle();
    signupOpen = !data || data.value !== false;
  } catch (e) { signupOpen = true; }
}
async function refreshAndRender() { showLoading(true); try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); } showLoading(false); render(); }
function showLoading(b) { document.getElementById('loading').classList.toggle('hidden', !b); }

// سلة المحذوفات/الأرشيف: نحفظ لقطة قبل أي حذف أو تعديل (أفضل جهد، لا تُعطّل العملية)
function trashLabel(key, rec) {
  const names = { animals: 'بهيمة', matings: 'تلقيح', pregnancies: 'حمل', births: 'ولادة', vaccineTypes: 'نوع تطعيم', vaccinations: 'تطعيم', treatments: 'علاج', treatmentTypes: 'نوع علاج' };
  const base = names[key] || key;
  let extra = '';
  if (key === 'animals') extra = rec.code || rec.name || '';
  else if (rec.animal_id) { const a = animalById(rec.animal_id); extra = a ? (a.code || a.name || '') : ''; }
  else extra = rec.name || rec.code || '';
  return base + (extra ? ' • ' + extra : '');
}
async function trashSnap(key, id, action) {
  const rec = (C[key] || []).find(x => x.id === id);
  if (!rec) return;
  try { await sb.from('mrahi_trash').insert({ tbl: key, rec_id: id, action, label: trashLabel(key, rec), data: rec, actor_name: (me && me.full_name) || '' }); } catch (e) { /* أفضل جهد */ }
}
async function dbInsert(key, obj) { const { data, error } = await sb.from(TABLES[key]).insert(obj).select().single(); if (error) throw error; return data; }
async function dbUpdate(key, id, obj) { await trashSnap(key, id, 'edit'); const { error } = await sb.from(TABLES[key]).update(obj).eq('id', id); if (error) throw error; }
async function dbDelete(key, id) { await trashSnap(key, id, 'delete'); const { error } = await sb.from(TABLES[key]).delete().eq('id', id); if (error) throw error; }
async function guard(fn) { try { await fn(); } catch (e) { const msg = (e.message || '' + e); toast(/Could not find the table|schema cache/i.test(msg) ? 'هذه الميزة تحتاج تنفيذ سكربت قاعدة البيانات أولاً (راجع التعليمات).' : 'تعذّر الحفظ: ' + msg); return false; } return true; }
// تأكيد مزدوج (للحذف والتعديل لأهميتهما)
function confirm2(msg) { return confirm('⚠️ ' + msg) && confirm('تأكيد نهائي:\n' + msg); }

/* ===== التوجيه ===== */
function setHash(h) { location.hash = h; }
function goBack() { history.length > 1 ? history.back() : setHash('#/home'); }
const ROUTES = {
  home: { t: 'مراحي', back: false, fn: screenHome },
  animals: { t: 'الحلال', back: false, fn: screenAnimals },
  alerts: { t: 'التنبيهات', back: false, fn: screenAlerts },
  more: { t: 'المزيد', back: false, fn: screenMore },
  animal: { t: 'سجل البهيمة', back: true, fn: screenAnimalDetail },
  'animal-edit': { t: 'بهيمة', back: true, fn: screenAnimalEdit },
  mating: { t: 'تلقيح / حمل', back: true, fn: screenMating },
  pregnancies: { t: 'الحمل والمتابعة', back: true, fn: screenPregnancies },
  'vaccine-types': { t: 'أنواع التطعيمات', back: true, fn: screenVaccineTypes },
  vaccinate: { t: 'إعطاء تطعيم', back: true, fn: screenVaccinate },
  'treatment-types': { t: 'أنواع العلاج', back: true, fn: screenTreatmentTypes },
  treat: { t: 'إضافة علاج', back: true, fn: screenTreat },
  bulk: { t: 'عمليات بالجملة', back: true, fn: screenBulk },
  backup: { t: 'النسخ الاحتياطي', back: true, fn: screenBackup },
  members: { t: 'المستخدمون والصلاحيات', back: true, fn: screenMembers },
  types: { t: 'أنواع الحلال', back: true, fn: screenTypes },
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
}
function addFab(label, onClick) { const f = document.createElement('button'); f.className = 'fab'; f.textContent = label; f.addEventListener('click', onClick); document.body.appendChild(f); }

/* ===== التنبيهات (حسابات) ===== */
const upcomingBirths = () => C.pregnancies.filter(p => p.status === 'monitoring' && p.expected).filter(p => { const d = daysUntil(p.expected); return d !== null && d >= 0 && d <= 7; }).sort((a, b) => (a.expected || '').localeCompare(b.expected || ''));
const upcomingVacc = () => C.vaccinations.filter(v => v.next_due).filter(v => { const d = daysUntil(v.next_due); return d !== null && d >= 0 && d <= 30; }).sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));
const activeTreatments = () => C.treatments.filter(t => t.withdrawal_end && daysUntil(t.withdrawal_end) >= 0).sort((a, b) => (a.withdrawal_end || '').localeCompare(b.withdrawal_end || ''));

/* ===== الرئيسية ===== */
function screenHome() {
  const present = C.animals.filter(a => a.status === 'present').length;
  const births = upcomingBirths(), vaccs = upcomingVacc(), treats = activeTreatments();
  view().innerHTML = `
    <div class="title-lg">مراحي</div>
    <div class="muted">أهلاً ${esc(me.full_name || '')} • ${isAdmin() ? 'مدير' : 'مستخدم'}</div>
    <div class="stats">
      <div class="stat green"><div class="n">${present}</div><div class="l">عدد الحلال</div></div>
      <div class="stat amber"><div class="n">${births.length}</div><div class="l">ولادات قادمة</div></div>
      <div class="stat blue"><div class="n">${vaccs.length}</div><div class="l">تطعيمات قادمة</div></div>
      <div class="stat red"><div class="n">${treats.length}</div><div class="l">علاجات حالية</div></div>
    </div>
    ${can('animals', 'view') ? `<div class="search"><input id="q" placeholder="ابحث برقم/وسم/شريحة/اسم البهيمة"></div><div id="qr"></div>` : ''}
    <div class="card"><h3>الولادات القادمة (٧ أيام)</h3>${births.length ? births.map(p => row(display(animalById(p.animal_id)), `${fmtDate(p.expected)} (بعد ${daysUntil(p.expected)} يوم)`)).join('') : noItem()}</div>
    <div class="card"><h3>العلاجات الحالية (تحت التحريم)</h3>${treats.length ? treats.map(t => row(display(animalById(t.animal_id)), `${esc(t.med_name)} • ينتهي ${fmtDate(t.withdrawal_end)}`)).join('') : noItem()}</div>`;
  const q = document.getElementById('q');
  if (q) q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase(); const box = document.getElementById('qr');
    if (!term) { box.innerHTML = ''; return; }
    const res = C.animals.filter(a => (a.code || '').toLowerCase().includes(term) || (a.name || '').toLowerCase().includes(term) || (a.pen || '').toLowerCase().includes(term)).slice(0, 8);
    box.innerHTML = res.length ? res.map(animalCard).join('') : '<div class="muted" style="padding:8px">لا نتائج</div>';
    bindCards(box);
  });
}

/* ===== التنبيهات ===== */
function screenAlerts() {
  const births = upcomingBirths(), vaccs = upcomingVacc(), treats = activeTreatments();
  view().innerHTML = `
    <div class="card"><h3>ولادة متوقعة خلال ٧ أيام</h3>${births.length ? births.map(p => row(display(animalById(p.animal_id)), `${fmtDate(p.expected)} • ${daysUntil(p.expected)} يوم`)).join('') : noItem()}</div>
    <div class="card"><h3>انتهاء مدة التحريم (علاجات جارية)</h3>${treats.length ? treats.map(t => row(display(animalById(t.animal_id)), `${esc(t.med_name)} • ينتهي ${fmtDate(t.withdrawal_end)}`)).join('') : noItem()}</div>
    <div class="card"><h3>مواعيد تطعيم قادمة</h3>${vaccs.length ? vaccs.map(v => row(display(animalById(v.animal_id)), fmtDate(v.next_due))).join('') : noItem()}</div>`;
}

/* ===== الحلال ===== */
let animalFilter = '';
let animalStatusFilter = 'present';
function animalCard(a) {
  const st = a.status === 'sold' ? 'sold' : a.status === 'dead' ? 'dead' : '';
  return `<div class="card click" data-aid="${a.id}">
    <div class="li-title">${display(a)}</div>
    <div class="li-sub">${arOf(TYPES, a.type)} • ${arOf(SEX, a.sex)} • <span class="badge ${st}">${arOf(STATUS, a.status)}</span></div>
    ${a.pen ? `<div class="li-sub">المراح: ${esc(a.pen)}</div>` : ''}</div>`;
}
function bindCards(root) { root.querySelectorAll('[data-aid]').forEach(c => c.addEventListener('click', () => setHash('#/animal/' + c.dataset.aid))); }
function screenAnimals() {
  if (!can('animals', 'view')) { view().innerHTML = noPerm(); return; }
  const chips = `<div class="chips"><span class="chip ${!animalFilter ? 'active' : ''}" data-f="">الكل</span>${TYPES.map(t => `<span class="chip ${animalFilter === t.k ? 'active' : ''}" data-f="${t.k}">${t.ar}</span>`).join('')}</div>`;
  const stChips = `<div class="chips"><span class="chip ${animalStatusFilter === 'present' ? 'active' : ''}" data-s="present">في المراح</span><span class="chip ${animalStatusFilter === 'sold' ? 'active' : ''}" data-s="sold">مباعة</span><span class="chip ${animalStatusFilter === 'dead' ? 'active' : ''}" data-s="dead">نافقة</span><span class="chip ${!animalStatusFilter ? 'active' : ''}" data-s="">الكل</span></div>`;
  const list = C.animals.filter(a => (!animalFilter || a.type === animalFilter) && (!animalStatusFilter || a.status === animalStatusFilter)).sort((a, b) => b.id - a.id);
  view().innerHTML = chips + stChips + `<div class="muted" style="margin-bottom:6px">العدد: ${list.length}</div>` + (list.length ? list.map(animalCard).join('') : '<div class="center-empty">لا توجد بهائم في هذا التصنيف.</div>');
  view().querySelectorAll('[data-f]').forEach(c => c.addEventListener('click', () => { animalFilter = c.dataset.f; screenAnimals(); }));
  view().querySelectorAll('[data-s]').forEach(c => c.addEventListener('click', () => { animalStatusFilter = c.dataset.s; screenAnimals(); }));
  bindCards(view());
  if (can('animals', 'edit')) addFab('+ إضافة بهيمة', () => setHash('#/animal-edit/0'));
}

/* ===== إضافة/تعديل بهيمة ===== */
function screenAnimalEdit(arg) {
  if (!can('animals', 'edit')) { view().innerHTML = noPerm(); return; }
  const id = parseInt(arg, 10) || 0;
  const a = id ? animalById(id) : null;
  const females = C.animals.filter(x => x.sex === 'female' && x.id !== id);
  document.getElementById('screenTitle').textContent = id ? 'تعديل بهيمة' : 'إضافة بهيمة';
  view().innerHTML = `
    <div class="card"><h3>البيانات الأساسية</h3>
      ${fSelect('نوع الحلال', 'f_type', TYPES, a ? a.type : 'sheep')}
      ${fInput('رقم المراح (الحظيرة)', 'f_pen', a && a.pen)}
      ${fSelect('نوع المعرّف', 'f_kind', IDKIND, a ? a.idkind : 'number')}
      ${fInput('المعرّف (رقم/وسم/شريحة/اسم)', 'f_code', a && a.code)}
      ${fInput('الاسم/المسمى (اختياري)', 'f_name', a && a.name)}
      ${fSelect('الجنس', 'f_sex', SEX, a ? a.sex : 'female')}
      ${fSelect('المصدر', 'f_source', SOURCE, a ? (a.source || 'purchased') : 'purchased')}
      ${fInput('تاريخ الميلاد (اختياري للمشترى)', 'f_birth', a && a.birth, 'date')}
      ${fInput('اللون', 'f_color', a && a.color)}
      ${fSelect('الحالة', 'f_status', STATUS, a ? a.status : 'present')}
      <div id="saleBox">${fInput('تاريخ البيع', 'f_saledate', a && a.sale_date, 'date')}${fInput('سعر البيع', 'f_saleprice', a && a.sale_price, 'number', 'min="0" step="any" inputmode="decimal"')}</div>
      <div id="deadBox">${fInput('تاريخ النفوق', 'f_deaddate', a && a.dead_date, 'date')}</div></div>
    <div class="card"><h3>النسب</h3>
      ${fAnimalSelect('الأم', 'f_mother', a && a.mother_id, females, '— بدون —')}
      ${fInput('الأب / الفحل (اسم أو رقم)', 'f_father', a && a.father_name)}</div>
    <div class="card"><h3>ملاحظات</h3>${fTextarea('ملاحظات', 'f_notes', a && a.notes)}</div>
    <button class="btn" id="saveBtn">حفظ</button>
    ${id ? '<button class="btn danger" id="delBtn">حذف البهيمة</button>' : ''}`;
  const syncExit = () => {
    const s = val('f_status');
    document.getElementById('saleBox').style.display = s === 'sold' ? '' : 'none';
    document.getElementById('deadBox').style.display = s === 'dead' ? '' : 'none';
  };
  document.getElementById('f_status').addEventListener('change', syncExit); syncExit();
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const code = val('f_code').trim(), name = val('f_name').trim();
    if (!code && !name) { toast('أدخل المعرّف أو الاسم'); return; }
    const status = val('f_status');
    const obj = { type: val('f_type'), pen: val('f_pen').trim(), idkind: val('f_kind'), code: code || name, name, sex: val('f_sex'), source: val('f_source'), birth: val('f_birth') || null, color: val('f_color').trim(), status, mother_id: parseInt(val('f_mother'), 10) || null, father_name: val('f_father').trim(), notes: val('f_notes').trim(),
      sale_date: status === 'sold' ? (val('f_saledate') || null) : null,
      sale_price: status === 'sold' && val('f_saleprice') !== '' ? parseFloat(val('f_saleprice')) : null,
      dead_date: status === 'dead' ? (val('f_deaddate') || null) : null };
    if (a && !confirm2('حفظ التعديل على هذه البهيمة؟ النسخة السابقة ستبقى في سلة المحذوفات.')) return;
    const ok = await guard(async () => { if (a) await dbUpdate('animals', id, obj); else await dbInsert('animals', obj); });
    if (ok) { toast('تم الحفظ'); await loadAll(); goBack(); }
  });
  if (id) document.getElementById('delBtn').addEventListener('click', async () => {
    if (!confirm2('حذف هذه البهيمة؟ ستنتقل إلى سلة المحذوفات (يمكن استعادتها خلال ٣٠ يوماً).')) return;
    const ok = await guard(async () => { await dbDelete('animals', id); });
    if (ok) { toast('نُقلت إلى سلة المحذوفات'); await loadAll(); setHash('#/animals'); }
  });
}

/* ===== سجل البهيمة ===== */
function screenAnimalDetail(arg) {
  if (!can('animals', 'view')) { view().innerHTML = noPerm(); return; }
  const id = parseInt(arg, 10); const a = animalById(id);
  if (!a) { view().innerHTML = '<div class="center-empty">غير موجودة</div>'; return; }
  document.getElementById('screenTitle').textContent = a.code || 'سجل البهيمة';
  const offspring = C.animals.filter(x => x.mother_id === id || x.father_id === id).sort((x, y) => (y.birth || '').localeCompare(x.birth || ''));
  const matings = C.matings.filter(m => m.animal_id === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const pregs = C.pregnancies.filter(p => p.animal_id === id);
  const vaccs = C.vaccinations.filter(v => v.animal_id === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const treats = C.treatments.filter(t => t.animal_id === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const mother = a.mother_id ? animalById(a.mother_id) : null;
  const vtName = (tid) => { const v = C.vaccineTypes.find(x => x.id === tid); return v ? esc(v.name) : 'تطعيم'; };
  view().innerHTML = `
    <div class="card"><h3>البيانات الأساسية</h3>
      ${row('النوع', arOf(TYPES, a.type))}
      ${row('المعرّف', esc(a.code) + ' (' + arOf(IDKIND, a.idkind) + ')')}
      ${a.name ? row('الاسم', esc(a.name)) : ''}
      ${row('الجنس', arOf(SEX, a.sex))}
      ${row('المراح', esc(a.pen) || '—')}
      ${row('المصدر', arOf(SOURCE, a.source || 'purchased'))}
      ${row('تاريخ الميلاد', fmtDate(a.birth))}
      ${row('اللون', esc(a.color) || '—')}
      ${row('الحالة', arOf(STATUS, a.status))}
      ${(a.source || 'purchased') === 'purchased' && (a.sale_date == null) && a.buy_date ? row('تاريخ الشراء', fmtDate(a.buy_date)) : ''}
      ${(a.source || 'purchased') === 'purchased' && a.buy_price != null ? row('سعر الشراء', a.buy_price) : ''}
      ${a.status === 'sold' ? row('تاريخ البيع', fmtDate(a.sale_date)) + row('سعر البيع', a.sale_price != null ? a.sale_price : '—') : ''}
      ${a.status === 'dead' ? row('تاريخ النفوق', fmtDate(a.dead_date)) : ''}
      ${can('animals', 'edit') ? `<div class="btn-row" style="margin-top:8px">${a.status === 'present'
        ? `<button class="btn sm" id="qSell">💰 تسجيل بيع</button><button class="btn sm danger" id="qDead">📉 تسجيل نفوق</button>`
        : `<button class="btn sm outline" id="qBack">↩ إعادة للمراح</button>`}</div>` : ''}</div>
    <div class="card"><h3>النسب</h3>
      ${row('الأم', mother ? display(mother) : '—')}
      ${row('الأب / الفحل', esc(a.father_name) || '—')}
      ${a.notes ? row('ملاحظات', esc(a.notes)) : ''}</div>
    <div class="card"><h3>أنتجت (${offspring.length})</h3>
      ${offspring.length ? offspring.map(o => `<div class="card click" data-aid="${o.id}" style="margin:6px 0"><div class="li-title">${display(o)}</div><div class="li-sub">${arOf(SEX, o.sex)} • ${fmtDate(o.birth)}</div></div>`).join('') : noItem()}</div>
    ${can('breeding', 'view') ? `<div class="card"><h3>التلقيح والحمل</h3>
      ${can('breeding', 'edit') ? `<button class="btn outline" id="addMating">إضافة تلقيح / متابعة حمل</button>` : ''}
      ${matings.map(m => row('تلقيح ' + fmtDate(m.date), 'الفحل: ' + (esc(m.sire_name) || esc(m.sire_code) || '—'))).join('')}
      ${pregs.map(p => row('حمل (' + arOf(PREG, p.status) + ')', 'متوقع ' + fmtDate(p.expected))).join('')}</div>` : ''}
    ${can('vaccines', 'view') ? `<div class="card"><h3>التطعيمات (${vaccs.length})</h3>
      ${can('vaccines', 'edit') ? `<button class="btn outline" id="addVacc">إعطاء تطعيم</button>` : ''}
      ${vaccs.map(v => row(fmtDate(v.date) + ' — ' + vtName(v.type_id), 'تحريم حتى ' + fmtDate(v.withdrawal_end))).join('')}</div>` : ''}
    ${can('treatments', 'view') ? `<div class="card"><h3>العلاجات (${treats.length})</h3>
      ${can('treatments', 'edit') ? `<button class="btn outline" id="addTreat">إضافة علاج</button>` : ''}
      ${treats.map(t => row(esc(t.med_name) + ' (' + fmtDate(t.date) + ')', 'تحريم حتى ' + fmtDate(t.withdrawal_end))).join('')}</div>` : ''}
    <div style="height:30px"></div>`;
  bindCards(view());
  const qs = document.getElementById('qSell'); if (qs) qs.addEventListener('click', () => quickSell(a));
  const qd = document.getElementById('qDead'); if (qd) qd.addEventListener('click', () => quickDead(a));
  const qb = document.getElementById('qBack'); if (qb) qb.addEventListener('click', () => quickRevert(a));
  const am = document.getElementById('addMating'); if (am) am.addEventListener('click', () => setHash('#/mating/' + id));
  const av = document.getElementById('addVacc'); if (av) av.addEventListener('click', () => setHash('#/vaccinate/' + id));
  const at = document.getElementById('addTreat'); if (at) at.addEventListener('click', () => setHash('#/treat/' + id));
  if (can('animals', 'edit')) addFab('✎ تعديل', () => setHash('#/animal-edit/' + id));
}

/* ===== التلقيح والحمل ===== */
function screenMating(arg) {
  if (!can('breeding', 'edit')) { view().innerHTML = noPerm(); return; }
  const animalId = parseInt(arg, 10) || 0;
  const females = C.animals.filter(a => a.sex === 'female');
  const preset = animalId ? animalById(animalId) : null;
  view().innerHTML = `<div class="card"><h3>سجل التلقيح</h3>
    ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة (الأم)', 'm_animal', 0, females)}
    ${fInput('تاريخ التلقيح', 'm_date', todayStr(), 'date')}
    ${fInput('رقم الفحل', 'm_sireCode', '')}
    ${fInput('اسم الفحل', 'm_sireName', '')}
    ${fTextarea('ملاحظات', 'm_notes', '')}
    <div class="check"><input type="checkbox" id="m_preg" checked><label for="m_preg" style="margin:0">بدء متابعة الحمل (يحسب الولادة المتوقعة تلقائياً)</label></div>
    <div class="hint" id="m_hint"></div>
    <button class="btn" id="m_save">حفظ</button></div>`;
  const hint = document.getElementById('m_hint');
  const upd = () => { const a = preset || animalById(parseInt(val('m_animal'), 10)); const d = val('m_date'); hint.textContent = (a && d) ? `مدة الحمل: ${gestOf(a.type)} يوم → الولادة ${fmtDate(addDays(d, gestOf(a.type)))}` : ''; };
  ['m_date', 'm_animal'].forEach(i => { const el = document.getElementById(i); if (el) el.addEventListener('change', upd); });
  upd();
  document.getElementById('m_save').addEventListener('click', async () => {
    const a = preset || animalById(parseInt(val('m_animal'), 10)); const d = val('m_date');
    if (!a) { toast('اختر البهيمة'); return; } if (!d) { toast('أدخل التاريخ'); return; }
    const ok = await guard(async () => {
      await dbInsert('matings', { animal_id: a.id, date: d, sire_code: val('m_sireCode').trim(), sire_name: val('m_sireName').trim(), notes: val('m_notes').trim() });
      if (document.getElementById('m_preg').checked) { const g = gestOf(a.type); await dbInsert('pregnancies', { animal_id: a.id, mating_date: d, gest: g, expected: addDays(d, g), status: 'monitoring', notes: val('m_notes').trim() }); }
    });
    if (ok) { toast('تم الحفظ'); await loadAll(); goBack(); }
  });
}
function screenPregnancies() {
  if (!can('breeding', 'view')) { view().innerHTML = noPerm(); return; }
  const list = C.pregnancies.slice().sort((a, b) => (a.expected || '').localeCompare(b.expected || ''));
  view().innerHTML = list.length ? list.map(p => {
    const a = animalById(p.animal_id);
    const actions = (p.status === 'monitoring' && can('breeding', 'edit')) ? `<div class="btn-row" style="margin-top:8px"><button class="btn sm" data-birth="${p.id}">تسجيل ولادة</button><button class="btn sm outline" data-nope="${p.id}">لم يثبت</button></div>` : '';
    return `<div class="card"><h3>${display(a)}</h3>${row('تاريخ التلقيح', fmtDate(p.mating_date))}${row('مدة الحمل', p.gest + ' يوم')}${row('الولادة المتوقعة', fmtDate(p.expected))}${row('الحالة', arOf(PREG, p.status))}${actions}</div>`;
  }).join('') : '<div class="center-empty">لا توجد حالات حمل مسجّلة.</div>';
  view().querySelectorAll('[data-nope]').forEach(b => b.addEventListener('click', async () => {
    const ok = await guard(async () => { await dbUpdate('pregnancies', parseInt(b.dataset.nope, 10), { status: 'not_confirmed' }); });
    if (ok) { await loadAll(); screenPregnancies(); }
  }));
  view().querySelectorAll('[data-birth]').forEach(b => b.addEventListener('click', () => openBirthModal(C.pregnancies.find(x => x.id === parseInt(b.dataset.birth, 10)))));
}
function openBirthModal(preg) {
  const mother = animalById(preg.animal_id);
  openModal('تسجيل ولادة — ' + display(mother), `
    ${fInput('رقم المولود', 'b_code', '')}
    ${fInput('تاريخ الولادة', 'b_date', todayStr(), 'date')}
    ${fSelect('الجنس', 'b_sex', SEX, 'female')}
    ${fInput('الأب / الفحل', 'b_father', '')}
    ${fTextarea('ملاحظات', 'b_notes', '')}
    <div class="check"><input type="checkbox" id="b_create" checked><label for="b_create" style="margin:0">إضافة المولود كبهيمة جديدة</label></div>
    <button class="btn" id="b_save">حفظ</button>`, () => {
    document.getElementById('b_save').addEventListener('click', async () => {
      const code = val('b_code').trim(), date = val('b_date') || todayStr(), sex = val('b_sex'), father = val('b_father').trim(), notes = val('b_notes').trim();
      const ok = await guard(async () => {
        let offId = null;
        if (document.getElementById('b_create').checked && code) {
          const created = await dbInsert('animals', { type: mother.type, pen: mother.pen || '', idkind: 'number', code, name: '', sex, source: 'born', birth: date, color: '', status: 'present', mother_id: mother.id, father_name: father, notes });
          offId = created.id;
        }
        await dbInsert('births', { mother_id: mother.id, offspring_id: offId, offspring_code: code, date, sex, father_name: father, notes });
        await dbUpdate('pregnancies', preg.id, { status: 'born' });
      });
      if (ok) { closeModal(); toast('تم تسجيل الولادة'); await loadAll(); screenPregnancies(); }
    });
  });
}

/* ===== اختيار متعدد لأنواع البهائم (يُستخدم في أنواع التطعيم/العلاج) ===== */
function fSpecies(selected) {
  const sel = Array.isArray(selected) ? selected : [];
  return `<div class="field"><label>نوع البهيمة (اختيار متعدد — اتركه فارغاً = كل الأنواع)</label>
    <div class="chips" id="sp_box">${TYPES.map(t => `<span class="chip ${sel.includes(t.k) ? 'active' : ''}" data-sp="${t.k}">${t.ar}</span>`).join('')}</div></div>`;
}
function bindSpecies() { document.querySelectorAll('#sp_box [data-sp]').forEach(c => c.addEventListener('click', () => c.classList.toggle('active'))); }
function getSpecies() { return [...document.querySelectorAll('#sp_box [data-sp].active')].map(c => c.dataset.sp); }
function speciesLabel(arr) { return (Array.isArray(arr) && arr.length) ? arr.map(k => arOf(TYPES, k)).join('، ') : 'كل الأنواع'; }

/* ===== أنواع التطعيمات ===== */
function screenVaccineTypes() {
  if (!can('vaccines', 'view')) { view().innerHTML = noPerm(); return; }
  const list = C.vaccineTypes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  view().innerHTML = (list.length ? list.map(v => `<div class="card">
      <div class="li-title">${esc(v.name)}</div>
      ${v.vaccine_name ? `<div class="li-sub">اللقاح: ${esc(v.vaccine_name)}</div>` : ''}
      <div class="li-sub">نوع البهيمة: ${esc(speciesLabel(v.species))}</div>
      <div class="li-sub">مدة التحريم: ${v.withdrawal_days} يوم</div>
      ${v.notes ? `<div class="li-sub">${esc(v.notes)}</div>` : ''}
      ${can('vaccines', 'edit') ? `<div class="btn-row" style="margin-top:6px"><button class="btn sm outline" data-edit="${v.id}">تعديل</button><button class="btn sm danger" data-del="${v.id}">حذف</button></div>` : ''}
    </div>`).join('') : '<div class="center-empty">عرّف أنواع التطعيمات مرة واحدة.</div>');
  view().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => vaccineTypeModal(C.vaccineTypes.find(v => String(v.id) === b.dataset.edit))));
  view().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm2('حذف نوع التطعيم؟ سينتقل إلى سلة المحذوفات.')) return;
    const ok = await guard(async () => { await dbDelete('vaccineTypes', parseInt(b.dataset.del, 10)); });
    if (ok) { toast('نُقل إلى سلة المحذوفات'); await loadAll(); screenVaccineTypes(); }
  }));
  if (can('vaccines', 'edit')) addFab('+ نوع تطعيم', () => vaccineTypeModal(null));
}
function vaccineTypeModal(v) {
  openModal(v ? 'تعديل نوع تطعيم' : 'نوع تطعيم جديد', `
    ${fInput('اسم التطعيم', 'vt_name', v && v.name)}${fInput('اسم اللقاح', 'vt_vacc', v && v.vaccine_name)}
    ${fInput('مدة التحريم (أيام)', 'vt_days', v ? v.withdrawal_days : '', 'number', 'min="0"')}
    ${fSpecies(v && v.species)}
    ${fTextarea('ملاحظات', 'vt_notes', v && v.notes)}
    <button class="btn" id="vt_save">حفظ</button>`, () => {
    bindSpecies();
    document.getElementById('vt_save').addEventListener('click', async () => {
      const name = val('vt_name').trim(); if (!name) { toast('أدخل اسم التطعيم'); return; }
      if (v && !confirm2('حفظ تعديل نوع التطعيم؟')) return;
      const obj = { name, vaccine_name: val('vt_vacc').trim(), withdrawal_days: num('vt_days'), species: getSpecies(), notes: val('vt_notes').trim() };
      const ok = await guard(async () => { if (v) await dbUpdate('vaccineTypes', v.id, obj); else await dbInsert('vaccineTypes', obj); });
      if (ok) { closeModal(); toast('تم الحفظ'); await loadAll(); screenVaccineTypes(); }
    });
  });
}

/* ===== أنواع العلاج (كتالوج) ===== */
function screenTreatmentTypes() {
  if (!can('treatments', 'view')) { view().innerHTML = noPerm(); return; }
  const list = C.treatmentTypes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  view().innerHTML = `<div class="muted" style="margin-bottom:8px">عرّف العلاجات المتكررة مرة واحدة لاستخدامها بسرعة عند تسجيل علاج.</div>`
    + (list.length ? list.map(t => `<div class="card">
      <div class="li-title">${esc(t.name)} <span class="muted" style="font-weight:400">${t.form ? '• ' + arOf(TREAT_FORM, t.form) : ''}</span></div>
      ${t.dose ? `<div class="li-sub">الجرعة: ${esc(t.dose)}</div>` : ''}
      ${t.duration_days ? `<div class="li-sub">مدة العلاج: ${t.duration_days} يوم</div>` : ''}
      <div class="li-sub">مدة التحريم: ${t.withdrawal_days || 0} يوم</div>
      <div class="li-sub">نوع البهيمة: ${esc(speciesLabel(t.species))}</div>
      ${t.treats ? `<div class="li-sub">يعالج: ${esc(t.treats)}</div>` : ''}
      ${t.notes ? `<div class="li-sub">${esc(t.notes)}</div>` : ''}
      ${can('treatments', 'edit') ? `<div class="btn-row" style="margin-top:6px"><button class="btn sm outline" data-edit="${t.id}">تعديل</button><button class="btn sm danger" data-del="${t.id}">حذف</button></div>` : ''}
    </div>`).join('') : '<div class="center-empty">لا توجد أنواع علاج — أضِف نوعاً.</div>');
  view().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => treatmentTypeModal(C.treatmentTypes.find(t => String(t.id) === b.dataset.edit))));
  view().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm2('حذف نوع العلاج؟ سينتقل إلى سلة المحذوفات.')) return;
    const ok = await guard(async () => { await dbDelete('treatmentTypes', parseInt(b.dataset.del, 10)); });
    if (ok) { toast('نُقل إلى سلة المحذوفات'); await loadAll(); screenTreatmentTypes(); }
  }));
  if (can('treatments', 'edit')) addFab('+ نوع علاج', () => treatmentTypeModal(null));
}
function treatmentTypeModal(t) {
  openModal(t ? 'تعديل نوع علاج' : 'نوع علاج جديد', `
    ${fInput('اسم العلاج', 'tt_name', t && t.name)}
    ${fSelect('نوع العلاج', 'tt_form', TREAT_FORM, t ? t.form : '', '— اختر —')}
    ${fInput('الجرعة', 'tt_dose', t && t.dose)}
    ${fInput('مدة العلاج (أيام)', 'tt_dur', t ? t.duration_days : '', 'number', 'min="0"')}
    ${fInput('مدة التحريم (أيام)', 'tt_days', t ? t.withdrawal_days : '', 'number', 'min="0"')}
    ${fSpecies(t && t.species)}
    ${fInput('يعالج (الأعراض/المرض)', 'tt_treats', t && t.treats)}
    ${fTextarea('ملاحظات', 'tt_notes', t && t.notes)}
    <button class="btn" id="tt_save">حفظ</button>`, () => {
    bindSpecies();
    document.getElementById('tt_save').addEventListener('click', async () => {
      const name = val('tt_name').trim(); if (!name) { toast('أدخل اسم العلاج'); return; }
      if (t && !confirm2('حفظ تعديل نوع العلاج؟')) return;
      const obj = { name, form: val('tt_form') || null, dose: val('tt_dose').trim(), duration_days: num('tt_dur'), withdrawal_days: num('tt_days'), species: getSpecies(), treats: val('tt_treats').trim(), notes: val('tt_notes').trim() };
      const ok = await guard(async () => { if (t) await dbUpdate('treatmentTypes', t.id, obj); else await dbInsert('treatmentTypes', obj); });
      if (ok) { closeModal(); toast('تم الحفظ'); await loadAll(); screenTreatmentTypes(); }
    });
  });
}

/* ===== إعطاء تطعيم ===== */
function screenVaccinate(arg) {
  if (!can('vaccines', 'edit')) { view().innerHTML = noPerm(); return; }
  const animalId = parseInt(arg, 10) || 0; const preset = animalId ? animalById(animalId) : null;
  if (!C.vaccineTypes.length) { view().innerHTML = `<div class="center-empty">لا توجد أنواع تطعيمات.</div><button class="btn" id="g">الذهاب لأنواع التطعيمات</button>`; document.getElementById('g').addEventListener('click', () => setHash('#/vaccine-types')); return; }
  const typeOpts = C.vaccineTypes.map(v => ({ k: String(v.id), ar: `${v.name} (${v.withdrawal_days}ي)` }));
  view().innerHTML = `<div class="card"><h3>بيانات التطعيم</h3>
    ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة', 'v_animal', 0, C.animals)}
    ${fSelect('التطعيم', 'v_type', typeOpts, '', '— اختر —')}
    ${fInput('تاريخ التطعيم', 'v_date', todayStr(), 'date')}
    <div class="hint" id="v_hint"></div>
    ${fInput('موعد الجرعة القادمة (اختياري)', 'v_next', '', 'date')}
    ${fTextarea('ملاحظات', 'v_notes', '')}
    <button class="btn" id="v_save">حفظ</button></div>`;
  const hint = document.getElementById('v_hint');
  const upd = () => { const t = C.vaccineTypes.find(x => x.id === parseInt(val('v_type'), 10)); const d = val('v_date'); hint.textContent = (t && d) ? `انتهاء التحريم: ${fmtDate(addDays(d, t.withdrawal_days))}` : ''; };
  document.getElementById('v_type').addEventListener('change', upd); document.getElementById('v_date').addEventListener('change', upd);
  document.getElementById('v_save').addEventListener('click', async () => {
    const a = preset || animalById(parseInt(val('v_animal'), 10)); const t = C.vaccineTypes.find(x => x.id === parseInt(val('v_type'), 10)); const d = val('v_date');
    if (!a) { toast('اختر البهيمة'); return; } if (!t) { toast('اختر التطعيم'); return; }
    const ok = await guard(async () => { await dbInsert('vaccinations', { animal_id: a.id, type_id: t.id, date: d, withdrawal_end: addDays(d, t.withdrawal_days), next_due: val('v_next') || null, notes: val('v_notes').trim() }); });
    if (ok) { toast('تم الحفظ'); await loadAll(); goBack(); }
  });
}

/* ===== العلاجات ===== */
function screenTreat(arg) {
  if (!can('treatments', 'edit')) { view().innerHTML = noPerm(); return; }
  const animalId = parseInt(arg, 10) || 0; const preset = animalId ? animalById(animalId) : null;
  view().innerHTML = `<div class="card"><h3>بيانات العلاج</h3>
    ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة', 't_animal', 0, C.animals)}
    ${C.treatmentTypes.length ? fSelect('اختر من أنواع العلاج (اختياري)', 't_pick', C.treatmentTypes.map(x => ({ k: String(x.id), ar: x.name })), '', '— للتعبئة التلقائية —') : ''}
    ${fInput('نوع العلاج (مثال: مضاد حيوي)', 't_type', '')}
    ${fInput('اسم العلاج (مثال: أوكسي تترا)', 't_med', '')}
    ${fInput('مدة التحريم (أيام)', 't_days', '', 'number', 'min="0"')}
    ${fInput('تاريخ العلاج', 't_date', todayStr(), 'date')}
    <div class="hint" id="t_hint"></div>
    ${fInput('الإجراء', 't_action', '')}${fTextarea('ملاحظات', 't_notes', '')}
    <button class="btn" id="t_save">حفظ</button></div>`;
  const hint = document.getElementById('t_hint');
  const upd = () => { const days = num('t_days'), d = val('t_date'); hint.textContent = (days > 0 && d) ? `انتهاء التحريم: ${fmtDate(addDays(d, days))}` : ''; };
  document.getElementById('t_days').addEventListener('input', upd); document.getElementById('t_date').addEventListener('change', upd);
  const pick = document.getElementById('t_pick'); if (pick) pick.addEventListener('change', () => {
    const tt = C.treatmentTypes.find(x => String(x.id) === val('t_pick')); if (!tt) return;
    document.getElementById('t_type').value = tt.form ? arOf(TREAT_FORM, tt.form) : (tt.treats || '');
    document.getElementById('t_med').value = tt.name || '';
    document.getElementById('t_days').value = tt.withdrawal_days || '';
    document.getElementById('t_notes').value = [tt.dose ? 'الجرعة: ' + tt.dose : '', tt.treats ? 'يعالج: ' + tt.treats : '', tt.notes || ''].filter(Boolean).join(' — ');
    upd();
  });
  document.getElementById('t_save').addEventListener('click', async () => {
    const a = preset || animalById(parseInt(val('t_animal'), 10)); const d = val('t_date'), days = num('t_days');
    if (!a) { toast('اختر البهيمة'); return; }
    const ok = await guard(async () => { await dbInsert('treatments', { animal_id: a.id, treatment_type: val('t_type').trim(), med_name: val('t_med').trim(), withdrawal_days: days, date: d, withdrawal_end: addDays(d, days), action: val('t_action').trim(), notes: val('t_notes').trim() }); });
    if (ok) { toast('تم الحفظ'); await loadAll(); goBack(); }
  });
}

/* ===== إجراءات سريعة من ملف البهيمة (بيع/نفوق/إعادة) ===== */
function quickSell(a) {
  openModal('تسجيل بيع', `
    ${fInput('تاريخ البيع', 'qs_date', todayStr(), 'date')}
    ${fInput('سعر البيع (اختياري)', 'qs_price', '', 'number', 'min="0" step="any" inputmode="decimal"')}
    <button class="btn" id="qs_save">حفظ البيع</button>`, () => {
    document.getElementById('qs_save').addEventListener('click', async () => {
      if (!confirm2('تسجيل بيع هذه البهيمة وإخراجها من المراح؟')) return;
      const price = val('qs_price') !== '' ? parseFloat(val('qs_price')) : null;
      const ok = await guard(async () => { await dbUpdate('animals', a.id, { status: 'sold', sale_date: val('qs_date') || null, sale_price: price, dead_date: null }); });
      if (ok) { closeModal(); toast('تم تسجيل البيع'); await loadAll(); screenAnimalDetail(String(a.id)); }
    });
  });
}
function quickDead(a) {
  openModal('تسجيل نفوق', `
    ${fInput('تاريخ النفوق', 'qd_date', todayStr(), 'date')}
    <button class="btn danger" id="qd_save">حفظ النفوق</button>`, () => {
    document.getElementById('qd_save').addEventListener('click', async () => {
      if (!confirm2('تسجيل نفوق هذه البهيمة وإخراجها من المراح؟')) return;
      const ok = await guard(async () => { await dbUpdate('animals', a.id, { status: 'dead', dead_date: val('qd_date') || null, sale_date: null, sale_price: null }); });
      if (ok) { closeModal(); toast('تم تسجيل النفوق'); await loadAll(); screenAnimalDetail(String(a.id)); }
    });
  });
}
async function quickRevert(a) {
  if (!confirm2('إعادة هذه البهيمة إلى المراح؟ ستُلغى بيانات البيع/النفوق.')) return;
  const ok = await guard(async () => { await dbUpdate('animals', a.id, { status: 'present', sale_date: null, sale_price: null, dead_date: null }); });
  if (ok) { toast('أُعيدت للمراح'); await loadAll(); screenAnimalDetail(String(a.id)); }
}

/* ===== عمليات بالجملة (قائمة) ===== */
let bulkOp = 'vaccinate';
const bulkSel = new Set();
const BULK_PERM = { vaccinate: ['vaccines', 'edit'], mate: ['breeding', 'edit'], treat: ['treatments', 'edit'], sell: ['animals', 'edit'], buy: ['animals', 'add'] };
function screenBulk() {
  const ops = [
    { k: 'vaccinate', ar: '💉 تطعيم' }, { k: 'mate', ar: '❤ تلقيح' }, { k: 'treat', ar: '💊 علاج' },
    { k: 'sell', ar: '💰 بيع' }, { k: 'buy', ar: '🛒 مشترى' },
  ].filter(o => can(BULK_PERM[o.k][0], BULK_PERM[o.k][1]));
  if (!ops.length) { view().innerHTML = noPerm(); return; }
  if (!ops.find(o => o.k === bulkOp)) bulkOp = ops[0].k;
  view().innerHTML = `<div class="chips">${ops.map(o => `<span class="chip ${bulkOp === o.k ? 'active' : ''}" data-op="${o.k}">${o.ar}</span>`).join('')}</div><div id="bulkBody"></div>`;
  view().querySelectorAll('[data-op]').forEach(c => c.addEventListener('click', () => { bulkOp = c.dataset.op; bulkSel.clear(); screenBulk(); }));
  renderBulkBody();
}
function renderBulkBody() {
  const body = document.getElementById('bulkBody');
  if (bulkOp === 'buy') {
    body.innerHTML = `<div class="card"><h3>بيانات مشتركة لكل الرؤوس</h3>
      ${fSelect('نوع الحلال', 'bk_type', TYPES, 'sheep')}
      ${fInput('رقم المراح (الحظيرة)', 'bk_pen', '')}
      ${fSelect('الجنس', 'bk_sex', SEX, 'female')}
      ${fInput('تاريخ الشراء', 'bk_date', todayStr(), 'date')}
      ${fInput('سعر الرأس (اختياري)', 'bk_price', '', 'number', 'min="0" step="any" inputmode="decimal"')}
      ${fInput('اللون (اختياري)', 'bk_color', '')}
      ${fInput('تاريخ الميلاد (اختياري)', 'bk_birth', '', 'date')}</div>
     <div class="card"><h3>قائمة المعرّفات</h3>
      <div class="muted" style="margin-bottom:6px">اكتب معرّفاً واحداً في كل سطر (رقم/وسم) — يُنشأ رأس مشترى لكل سطر.</div>
      ${fTextarea('المعرّفات (سطر لكل رأس)', 'bk_codes', '')}</div>
     <button class="btn" id="bk_apply">➕ إضافة القائمة</button>`;
    document.getElementById('bk_apply').addEventListener('click', async () => {
      const codes = val('bk_codes').split('\n').map(s => s.trim()).filter(Boolean);
      if (!codes.length) { toast('أدخل معرّفاً واحداً على الأقل'); return; }
      if (!confirm2(`إضافة ${codes.length} رأساً مشترى للمراح؟`)) return;
      const base = { type: val('bk_type'), pen: val('bk_pen').trim(), idkind: 'number', sex: val('bk_sex'), source: 'purchased', status: 'present', color: val('bk_color').trim(), birth: val('bk_birth') || null, buy_date: val('bk_date') || null, buy_price: val('bk_price') !== '' ? parseFloat(val('bk_price')) : null };
      const ok = await guard(async () => { for (const code of codes) await dbInsert('animals', { ...base, code, name: '', mother_id: null, father_name: '', notes: '' }); });
      if (ok) { toast(`تمت إضافة ${codes.length} رأساً`); bulkSel.clear(); await loadAll(); setHash('#/animals'); }
    });
    return;
  }
  let form = '';
  if (bulkOp === 'vaccinate') {
    if (!C.vaccineTypes.length) { body.innerHTML = '<div class="center-empty">عرّف أنواع التطعيمات أولاً من «أنواع التطعيمات».</div>'; return; }
    const typeOpts = C.vaccineTypes.map(v => ({ k: String(v.id), ar: `${v.name} (${v.withdrawal_days}ي)` }));
    form = `${fSelect('التطعيم', 'bk_type', typeOpts, '', '— اختر —')}${fInput('تاريخ التطعيم', 'bk_date', todayStr(), 'date')}${fInput('موعد الجرعة القادمة (اختياري)', 'bk_next', '', 'date')}${fTextarea('ملاحظات', 'bk_notes', '')}`;
  } else if (bulkOp === 'mate') {
    form = `${fInput('رقم الفحل', 'bk_sirecode', '')}${fInput('اسم الفحل', 'bk_sirename', '')}${fInput('تاريخ التلقيح', 'bk_date', todayStr(), 'date')}<div class="check"><input type="checkbox" id="bk_preg" checked><label for="bk_preg" style="margin:0">بدء متابعة الحمل لكل بهيمة</label></div>${fTextarea('ملاحظات', 'bk_notes', '')}`;
  } else if (bulkOp === 'treat') {
    form = `${fInput('نوع العلاج', 'bk_ttype', '')}${fInput('اسم العلاج', 'bk_med', '')}${fInput('مدة التحريم (أيام)', 'bk_days', '', 'number', 'min="0"')}${fInput('تاريخ العلاج', 'bk_date', todayStr(), 'date')}${fInput('الإجراء', 'bk_action', '')}${fTextarea('ملاحظات', 'bk_notes', '')}`;
  } else if (bulkOp === 'sell') {
    form = `${fInput('تاريخ البيع', 'bk_date', todayStr(), 'date')}${fInput('سعر البيع للرأس (اختياري)', 'bk_price', '', 'number', 'min="0" step="any" inputmode="decimal"')}`;
  }
  let cands = C.animals.filter(a => a.status === 'present');
  if (bulkOp === 'mate') cands = cands.filter(a => a.sex === 'female');
  cands.sort((a, b) => b.id - a.id);
  const listHtml = cands.length ? cands.map(a => `<label class="bulk-row"><input type="checkbox" data-sel="${a.id}" ${bulkSel.has(a.id) ? 'checked' : ''}><span>${display(a)} <span class="muted">${arOf(TYPES, a.type)}${a.pen ? ' • ' + esc(a.pen) : ''}</span></span></label>`).join('') : '<div class="muted">لا توجد بهائم مطابقة.</div>';
  body.innerHTML = `<div class="card"><h3>بيانات العملية</h3>${form}</div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">اختر البهائم</h3>${cands.length ? '<button class="btn sm outline" id="bk_all">تحديد/إلغاء الكل</button>' : ''}</div>
      <div class="muted" id="bk_count" style="margin:4px 0">المحدد: ${bulkSel.size}</div>${listHtml}</div>
    <button class="btn" id="bk_apply">تطبيق على المحدد (${bulkSel.size})</button>`;
  const refresh = () => { document.getElementById('bk_count').textContent = 'المحدد: ' + bulkSel.size; document.getElementById('bk_apply').textContent = 'تطبيق على المحدد (' + bulkSel.size + ')'; };
  body.querySelectorAll('[data-sel]').forEach(cb => cb.addEventListener('change', () => { const id = parseInt(cb.dataset.sel, 10); cb.checked ? bulkSel.add(id) : bulkSel.delete(id); refresh(); }));
  const allBtn = document.getElementById('bk_all'); if (allBtn) allBtn.addEventListener('click', () => { const all = cands.every(a => bulkSel.has(a.id)); cands.forEach(a => all ? bulkSel.delete(a.id) : bulkSel.add(a.id)); renderBulkBody(); });
  document.getElementById('bk_apply').addEventListener('click', bulkApply);
}
async function bulkApply() {
  const ids = [...bulkSel];
  if (!ids.length) { toast('اختر بهيمة واحدة على الأقل'); return; }
  const d = val('bk_date');
  if (!d) { toast('أدخل التاريخ'); return; }
  let vt = null;
  if (bulkOp === 'vaccinate') { vt = C.vaccineTypes.find(x => x.id === parseInt(val('bk_type'), 10)); if (!vt) { toast('اختر التطعيم'); return; } }
  if (!confirm2(`تطبيق العملية على ${ids.length} بهيمة؟`)) return;
  const notes = document.getElementById('bk_notes') ? val('bk_notes').trim() : '';
  const ok = await guard(async () => {
    for (const id of ids) {
      const a = animalById(id); if (!a) continue;
      if (bulkOp === 'vaccinate') await dbInsert('vaccinations', { animal_id: id, type_id: vt.id, date: d, withdrawal_end: addDays(d, vt.withdrawal_days), next_due: val('bk_next') || null, notes });
      else if (bulkOp === 'mate') { await dbInsert('matings', { animal_id: id, date: d, sire_code: val('bk_sirecode').trim(), sire_name: val('bk_sirename').trim(), notes }); if (document.getElementById('bk_preg').checked) { const g = gestOf(a.type); await dbInsert('pregnancies', { animal_id: id, mating_date: d, gest: g, expected: addDays(d, g), status: 'monitoring', notes }); } }
      else if (bulkOp === 'treat') { const days = num('bk_days'); await dbInsert('treatments', { animal_id: id, treatment_type: val('bk_ttype').trim(), med_name: val('bk_med').trim(), withdrawal_days: days, date: d, withdrawal_end: addDays(d, days), action: val('bk_action').trim(), notes }); }
      else if (bulkOp === 'sell') { const price = val('bk_price') !== '' ? parseFloat(val('bk_price')) : null; await dbUpdate('animals', id, { status: 'sold', sale_date: d, sale_price: price, dead_date: null }); }
    }
  });
  if (ok) { toast(`تم تطبيق العملية على ${ids.length} بهيمة`); bulkSel.clear(); await loadAll(); screenBulk(); }
}

/* ===== المزيد ===== */
function screenMore() {
  const items = [];
  if (can('breeding', 'view')) items.push(['🤰 الحمل والمتابعة', '#/pregnancies']);
  if (can('vaccines', 'view')) items.push(['💉 أنواع التطعيمات', '#/vaccine-types']);
  if (can('vaccines', 'edit')) items.push(['💉 إعطاء تطعيم', '#/vaccinate/0']);
  if (can('treatments', 'view')) items.push(['💊 أنواع العلاج', '#/treatment-types']);
  if (can('treatments', 'edit')) items.push(['💊 إضافة علاج', '#/treat/0']);
  if (can('animals', 'add') || can('animals', 'edit') || can('vaccines', 'edit') || can('treatments', 'edit') || can('breeding', 'edit')) items.push(['📋 عمليات بالجملة (قائمة)', '#/bulk']);
  if (can('backup', 'view')) items.push(['💾 النسخ الاحتياطي', '#/backup']);
  if (isAdmin()) items.push(['🐑 أنواع الحلال', '#/types']);
  if (isAdmin()) items.push(['🗑️ سلة المحذوفات', '#/trash']);
  if (isAdmin()) items.push(['👥 المستخدمون والصلاحيات', '#/members']);
  view().innerHTML = (items.length ? items.map(([l, h]) => `<div class="card click" data-go="${h}"><div class="li-title">${l}</div></div>`).join('') : '<div class="center-empty">لا توجد عناصر متاحة بصلاحياتك.</div>')
    + `<div class="muted" style="text-align:center;margin-top:18px;font-size:.85rem">مراحي — مزرعة مشتركة • بياناتك على Supabase</div>`;
  view().querySelectorAll('[data-go]').forEach(c => c.addEventListener('click', () => setHash(c.dataset.go)));
}

/* ===== النسخ الاحتياطي (تصدير) ===== */
function snapshot() {
  return {
    exportedAt: new Date().toISOString(),
    animals: C.animals, matings: C.matings, pregnancies: C.pregnancies, births: C.births,
    vaccineTypes: C.vaccineTypes, vaccinations: C.vaccinations, treatments: C.treatments,
  };
}
function screenBackup() {
  if (!can('backup', 'view')) { view().innerHTML = noPerm(); return; }
  const counts = `${C.animals.length} بهيمة • ${C.births.length} ولادة • ${C.vaccinations.length} تطعيم • ${C.treatments.length} علاج`;
  const mine = C.backups.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  view().innerHTML = `
    <div class="card"><h3>سجل نسخي الاحتياطية</h3>
      <div class="muted">${counts}</div>
      <button class="btn" id="bk_save">➕ حفظ نسخة الآن (في حسابي)</button>
      <div class="muted" style="font-size:.82rem;margin-top:6px">نسخك خاصة بك — لا يراها بقية المستخدمين.</div>
    </div>
    <div class="card"><h3>نسخي المحفوظة (${mine.length})</h3>
      ${mine.length ? mine.map(b => `<div class="card" style="margin:6px 0">
          <div class="li-title">${esc(b.label || 'نسخة')}</div>
          <div class="li-sub">${fmtDateTime(b.created_at)} • ${b.animals_count || 0} بهيمة</div>
          <div class="btn-row" style="margin-top:6px">
            <button class="btn sm" data-restore="${b.id}">استعادة</button>
            <button class="btn sm outline" data-dl="${b.id}">تنزيل JSON</button>
            <button class="btn sm danger" data-bdel="${b.id}">حذف</button>
          </div></div>`).join('') : '<div class="muted">لا توجد نسخ بعد.</div>'}
    </div>
    <div class="card"><h3>تصدير خارجي</h3>
      <div class="muted">تنزيل نسخة على جهازك أو مشاركتها.</div>
      <button class="btn outline" id="bk_json">📤 تنزيل JSON</button>
      <button class="btn outline" id="bk_csv">📊 تصدير Excel (CSV)</button>
    </div>`;

  document.getElementById('bk_save').addEventListener('click', async () => {
    const label = prompt('اسم النسخة (اختياري):', 'نسخة ' + fmtDateTime(new Date().toISOString())) ?? '';
    const snap = snapshot();
    const ok = await guard(async () => {
      await sb.from('mrahi_backups').insert({ label: label.trim(), payload: snap, animals_count: C.animals.length });
    });
    if (ok) { toast('تم حفظ النسخة في حسابك'); await loadAll(); screenBackup(); }
  });
  view().querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => restoreBackup(parseInt(b.dataset.restore, 10))));
  view().querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', () => {
    const bk = C.backups.find(x => x.id === parseInt(b.dataset.dl, 10));
    if (bk) shareOrDownload('mrahi_backup_' + stamp() + '.json', JSON.stringify(bk.payload, null, 2), 'application/json');
  }));
  view().querySelectorAll('[data-bdel]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف هذه النسخة؟')) return;
    const ok = await guard(async () => { await sb.from('mrahi_backups').delete().eq('id', parseInt(b.dataset.bdel, 10)); });
    if (ok) { toast('تم الحذف'); await loadAll(); screenBackup(); }
  }));
  document.getElementById('bk_json').addEventListener('click', exportJson);
  document.getElementById('bk_csv').addEventListener('click', exportCsv);
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ar', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
/* استعادة نسخة: تتطلب صلاحيات تعديل على الأقسام لإعادة الكتابة */
async function restoreBackup(id) {
  const bk = C.backups.find(x => x.id === id);
  if (!bk || !bk.payload) { toast('النسخة غير موجودة'); return; }
  if (!isAdmin()) { toast('الاستعادة للمدير فقط (تستبدل بيانات المزرعة)'); return; }
  if (!confirm('استعادة هذه النسخة ستستبدل بيانات المزرعة الحالية بالكامل. متابعة؟')) return;
  const p = bk.payload;
  const ok = await guard(async () => {
    // حذف الحالي بترتيب يحترم المفاتيح الأجنبية
    for (const t of ['mrahi_treatments', 'mrahi_vaccinations', 'mrahi_births', 'mrahi_pregnancies', 'mrahi_matings', 'mrahi_vaccine_types']) {
      await sb.from(t).delete().neq('id', -1);
    }
    await sb.from('mrahi_animals').delete().neq('id', -1);
    // إعادة الإدخال مع تعيين معرفات جديدة وربط الأمهات/المواليد
    const idMap = {};
    const ordered = (p.animals || []).slice().sort((a, b) => a.id - b.id);
    for (const a of ordered) {
      const ins = await dbInsert('animals', stripIds(a, ['id', 'mother_id', 'father_id']));
      idMap[a.id] = ins.id;
    }
    // تحديث الروابط الأبوية بعد توفّر كل المعرفات
    for (const a of ordered) {
      const patch = {};
      if (a.mother_id && idMap[a.mother_id]) patch.mother_id = idMap[a.mother_id];
      if (a.father_id && idMap[a.father_id]) patch.father_id = idMap[a.father_id];
      if (Object.keys(patch).length) await dbUpdate('animals', idMap[a.id], patch);
    }
    const vtMap = {};
    for (const v of (p.vaccineTypes || [])) { const ins = await dbInsert('vaccineTypes', stripIds(v, ['id'])); vtMap[v.id] = ins.id; }
    for (const m of (p.matings || [])) await dbInsert('matings', remap(stripIds(m, ['id']), { animal_id: idMap }));
    for (const pr of (p.pregnancies || [])) await dbInsert('pregnancies', remap(stripIds(pr, ['id']), { animal_id: idMap }));
    for (const bt of (p.births || [])) await dbInsert('births', remap(stripIds(bt, ['id']), { mother_id: idMap, offspring_id: idMap }));
    for (const vc of (p.vaccinations || [])) await dbInsert('vaccinations', remap(stripIds(vc, ['id']), { animal_id: idMap, type_id: vtMap }));
    for (const tr of (p.treatments || [])) await dbInsert('treatments', remap(stripIds(tr, ['id']), { animal_id: idMap }));
  });
  if (ok) { toast('تمت الاستعادة'); await loadAll(); setHash('#/home'); render(); }
}
function stripIds(obj, keys) {
  const o = Object.assign({}, obj);
  keys.forEach(k => delete o[k]);
  delete o.created_at; delete o.created_by;
  return o;
}
function remap(obj, maps) {
  const o = Object.assign({}, obj);
  for (const key in maps) {
    if (o[key] != null) o[key] = maps[key][o[key]] || null; // أعِد التعيين أو صفّر المرجع المفقود
  }
  return o;
}
function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }
async function shareOrDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime }); const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'نسخة احتياطية — مراحي' }); return; } catch (e) {} }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('تم تنزيل الملف');
}
function exportJson() { const data = { exportedAt: new Date().toISOString(), animals: C.animals, matings: C.matings, pregnancies: C.pregnancies, births: C.births, vaccineTypes: C.vaccineTypes, vaccinations: C.vaccinations, treatments: C.treatments }; shareOrDownload('mrahi_backup_' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json'); }
function exportCsv() {
  const cell = s => { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['النوع', 'المراح', 'المعرف', 'نوع المعرف', 'الاسم', 'الجنس', 'المصدر', 'تاريخ الميلاد', 'اللون', 'الحالة', 'تاريخ البيع', 'سعر البيع', 'تاريخ النفوق', 'رقم الأم', 'اسم الأب', 'ملاحظات'];
  const rows = C.animals.map(a => [arOf(TYPES, a.type), a.pen, a.code, arOf(IDKIND, a.idkind), a.name, arOf(SEX, a.sex), arOf(SOURCE, a.source || 'purchased'), a.birth, a.color, arOf(STATUS, a.status), a.sale_date || '', a.sale_price != null ? a.sale_price : '', a.dead_date || '', a.mother_id ? (animalById(a.mother_id) || {}).code || '' : '', a.father_name, a.notes].map(cell).join(','));
  shareOrDownload('mrahi_animals_' + stamp() + '.csv', '﻿' + head.join(',') + '\n' + rows.join('\n'), 'text/csv');
}

/* ===== المستخدمون والصلاحيات (للمدير) ===== */
function screenMembers() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const list = C.members.slice().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  view().innerHTML = `
    <div class="card">
      <div class="li-title">🔐 تسجيل الحسابات الجديدة</div>
      <div class="li-sub">${signupOpen ? 'مفتوح — يمكن لأي شخص إنشاء حساب (ثم تفعّله أنت).' : 'مغلق — لا يمكن إنشاء حسابات جديدة الآن.'}</div>
      <button class="btn sm ${signupOpen ? 'danger' : ''}" id="signupToggle" style="margin-top:6px">${signupOpen ? '🔒 إغلاق التسجيل' : '🔓 فتح التسجيل'}</button>
    </div>
    <button class="btn" id="addUser" style="margin-bottom:10px">➕ إضافة مستخدم جديد</button>
    <div class="muted" style="margin-bottom:8px">فعّل المستخدمين وحدّد صلاحياتهم. يمكنك إضافة مستخدم بنفسك، أو يسجّل هو ثم يظهر هنا بانتظار التفعيل.</div>` +
    list.map(m => memberCard(m)).join('');
  view().querySelector('#addUser').addEventListener('click', adminAddUser);
  const tg = view().querySelector('#signupToggle');
  if (tg) tg.addEventListener('click', async () => {
    const ok = await guard(async () => {
      const { error } = await sb.from('mrahi_settings').upsert({ key: 'signup_open', value: !signupOpen, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    });
    if (ok) { signupOpen = !signupOpen; toast(signupOpen ? 'فُتح التسجيل' : 'أُغلق التسجيل'); screenMembers(); }
  });
  list.forEach(m => bindMemberCard(m));
}
function memberCard(m) {
  const p = m.perms || {};
  const cb = (mod, act) => `<input type="checkbox" data-u="${m.user_id}" data-mod="${mod}" data-act="${act}" ${p[mod] && p[mod][act] ? 'checked' : ''} ${m.role === 'admin' ? 'disabled' : ''}>`;
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div class="li-title">${esc(m.full_name || '—')}</div>
        <div class="li-sub"><span class="badge ${m.role === 'admin' ? 'role' : ''}">${m.role === 'admin' ? 'مدير' : 'مستخدم'}</span>
        <span class="badge ${m.is_active ? '' : 'off'}">${m.is_active ? 'مفعّل' : 'موقوف'}</span>
        ${m.user_id === me.user_id ? '<span class="badge">أنت</span>' : ''}</div>
        ${(m.phone || m.username) ? `<div class="li-sub">${m.phone ? '📱 ' + esc(m.phone) : ''}${m.phone && m.username ? ' • ' : ''}${m.username ? '@' + esc(m.username) : ''}</div>` : '<div class="li-sub muted">لا توجد بيانات اتصال</div>'}</div>
    </div>
    <div class="perm-grid">
      <div class="h">القسم</div><div class="h">عرض</div><div class="h">إضافة</div><div class="h">تعديل</div><div class="h">حذف</div>
      ${MODULES.map(mod => `<div>${mod.ar}</div><label>${cb(mod.k, 'view')}</label><label>${cb(mod.k, 'add')}</label><label>${cb(mod.k, 'edit')}</label><label>${cb(mod.k, 'delete')}</label>`).join('')}
      <div>النسخ الاحتياطي</div><label>${cb('backup', 'view')}</label><label></label><label></label><label></label>
    </div>
    <div class="btn-row" style="margin-top:6px">
      <button class="btn sm ${m.is_active ? 'danger' : ''}" data-toggle="${m.user_id}" ${m.user_id === me.user_id ? 'disabled' : ''}>${m.is_active ? 'إيقاف' : 'تفعيل'}</button>
      <button class="btn sm outline" data-role="${m.user_id}" ${m.user_id === me.user_id ? 'disabled' : ''}>${m.role === 'admin' ? 'إنزال لمستخدم' : 'ترقية لمدير'}</button>
      <button class="btn sm outline" data-edit="${m.user_id}">✎ تعديل البيانات</button>
      <button class="btn sm" data-save="${m.user_id}">حفظ الصلاحيات</button>
    </div></div>`;
}
function bindMemberCard(m) {
  const q = (sel) => view().querySelector(sel);
  const tg = q(`[data-toggle="${m.user_id}"]`); if (tg) tg.addEventListener('click', async () => {
    const ok = await guard(async () => { await dbUpdateMember(m.user_id, { is_active: !m.is_active }); }); if (ok) { await loadAll(); screenMembers(); }
  });
  const rl = q(`[data-role="${m.user_id}"]`); if (rl) rl.addEventListener('click', async () => {
    const ok = await guard(async () => { await dbUpdateMember(m.user_id, { role: m.role === 'admin' ? 'member' : 'admin' }); }); if (ok) { await loadAll(); screenMembers(); }
  });
  const ed = q(`[data-edit="${m.user_id}"]`); if (ed) ed.addEventListener('click', () => adminEditUser(m));
  const sv = q(`[data-save="${m.user_id}"]`); if (sv) sv.addEventListener('click', async () => {
    const perms = {};
    view().querySelectorAll(`input[data-u="${m.user_id}"]`).forEach(cbx => {
      const mod = cbx.dataset.mod, act = cbx.dataset.act;
      if (cbx.checked) { perms[mod] = perms[mod] || {}; perms[mod][act] = true; }
    });
    const ok = await guard(async () => { await dbUpdateMember(m.user_id, { perms }); }); if (ok) { toast('تم حفظ الصلاحيات'); await loadAll(); }
  });
}
async function dbUpdateMember(uid, obj) { const { error } = await sb.from('mrahi_members').update(obj).eq('user_id', uid); if (error) throw error; }

// المدير يعدّل بيانات مستخدم (الاسم/الجوال/اسم المستخدم) — الدخول يُحلّ من جدول الأعضاء فلا يتأثر
function adminEditUser(m) {
  openModal('تعديل بيانات المستخدم', `
    ${fInput('الاسم', 'eu_name', m.full_name || '')}
    ${fInput('رقم الجوال', 'eu_phone', m.phone || '', 'tel', 'inputmode="tel"')}
    ${fInput('اسم المستخدم', 'eu_user', m.username || '', 'text', 'autocomplete="off"')}
    <button class="btn" id="eu_save" style="margin-top:6px">حفظ البيانات</button>
    <div class="muted" style="font-size:.82rem;margin-top:6px">الرقم السري لا يُغيَّر من هنا — يغيّره المستخدم من حسابه. يدخل المستخدم بالجوال أو اسم المستخدم.</div>`, () => {
    document.getElementById('eu_save').addEventListener('click', async () => {
      const full_name = val('eu_name').trim();
      const phone = normPhone(val('eu_phone'));
      const username = val('eu_user').trim();
      if (!full_name) { toast('أدخل الاسم'); return; }
      if (phone.length < 7) { toast('أدخل رقم جوال صحيح'); return; }
      if (!confirm2('حفظ تعديل بيانات هذا المستخدم؟')) return;
      const ok = await guard(async () => { await dbUpdateMember(m.user_id, { full_name, phone, username: username || null }); });
      if (ok) { closeModal(); toast('تم حفظ البيانات'); await loadAll(); screenMembers(); }
    });
  });
}

// المدير يُنشئ حساباً جديداً مباشرةً (عبر عميل مؤقت كي لا تُستبدل جلسة المدير)
function adminAddUser() {
  openModal('إضافة مستخدم جديد', `
    ${fInput('الاسم', 'nu_name', '')}
    ${fInput('رقم الجوال', 'nu_phone', '', 'tel', 'inputmode="tel"')}
    ${fInput('اسم المستخدم (اختياري)', 'nu_user', '', 'text', 'autocomplete="off"')}
    ${fInput('رقم سري مؤقت (٤ أرقام)', 'nu_pin', '', 'text', 'inputmode="numeric" maxlength="4"')}
    <button class="btn" id="nu_save" style="margin-top:6px">إنشاء الحساب</button>
    <div class="muted" style="font-size:.82rem;margin-top:6px">يُنشأ موقوفاً — بعد ظهوره في القائمة فعّله وامنحه الصلاحيات. أعطِه الجوال والرقم السري ليدخل (ويغيّره لاحقاً).</div>`, () => {
    document.getElementById('nu_save').addEventListener('click', async () => {
      const full_name = val('nu_name').trim();
      const phone = normPhone(val('nu_phone'));
      const username = val('nu_user').trim();
      const pin = val('nu_pin').trim();
      if (!full_name) { toast('أدخل الاسم'); return; }
      if (phone.length < 7) { toast('أدخل رقم جوال صحيح'); return; }
      if (!/^\d{4}$/.test(pin)) { toast('الرقم السري ٤ أرقام'); return; }
      const ok = await guard(async () => {
        const tmp = window.supabase.createClient(window.MARAHI_CONFIG.SUPABASE_URL, window.MARAHI_CONFIG.SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'mrahi_admin_tmp' } });
        const { error } = await tmp.auth.signUp({ email: phoneToEmail(phone), password: pinToPass(pin), options: { data: { full_name, username, phone } } });
        if (error) throw error;
        try { await tmp.auth.signOut(); } catch (e) { /* تجاهل */ }
      });
      if (ok) { closeModal(); toast('تم إنشاء الحساب — فعّله وامنحه الصلاحيات'); await loadAll(); screenMembers(); }
    });
  });
}

/* ===== أنواع الحلال (للمدير) ===== */
function screenTypes() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  const list = (C.types || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  view().innerHTML = `<div class="muted" style="margin-bottom:8px">أنواع الحلال المستخدمة عند تسجيل البهائم. مدة الحمل (بالأيام) تُستخدم لحساب موعد الولادة المتوقّع.</div>`
    + (list.length ? list.map(t => `<div class="card">
        <div class="li-title">${esc(t.ar)} <span class="muted" style="font-weight:400">(${t.gest} يوم)</span></div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn sm outline" data-edit="${t.id}">تعديل</button>
          <button class="btn sm danger" data-del="${t.id}">حذف</button>
        </div></div>`).join('') : '<div class="muted">لا توجد أنواع — أضِف نوعاً.</div>')
    + `<button class="btn" id="addType" style="margin-top:10px">➕ إضافة نوع</button>`;
  view().querySelector('#addType').addEventListener('click', () => typeModal(null));
  view().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => typeModal((C.types || []).find(t => String(t.id) === b.dataset.edit))));
  view().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف هذا النوع؟ (البهائم المسجّلة مسبقاً لا تتأثر)')) return;
    const ok = await guard(async () => { const { error } = await sb.from('mrahi_types').delete().eq('id', b.dataset.del); if (error) throw error; });
    if (ok) { toast('تم الحذف'); await loadAll(); screenTypes(); }
  }));
}
function typeModal(t) {
  openModal(t ? 'تعديل نوع' : 'إضافة نوع', `
    ${fInput('الاسم (مثل: خيل)', 'ty_ar', t && t.ar)}
    ${fInput('مدة الحمل (يوم)', 'ty_gest', t ? t.gest : 150, 'number')}
    <button class="btn" id="ty_save" style="margin-top:6px">حفظ</button>`, () => {
    document.getElementById('ty_save').addEventListener('click', async () => {
      const ar = val('ty_ar').trim(); const gest = num('ty_gest') || 150;
      if (!ar) { toast('أدخل الاسم'); return; }
      const ok = await guard(async () => {
        if (t) { const { error } = await sb.from('mrahi_types').update({ ar, gest }).eq('id', t.id); if (error) throw error; }
        else {
          const key = 't_' + Date.now().toString(36);
          const sort = (C.types || []).reduce((m, x) => Math.max(m, x.sort || 0), 0) + 10;
          const { error } = await sb.from('mrahi_types').insert({ key, ar, gest, sort }); if (error) throw error;
        }
      });
      if (ok) { closeModal(); toast('تم الحفظ'); await loadAll(); screenTypes(); }
    });
  });
}

/* ===== سلة المحذوفات / الأرشيف (للمدير) ===== */
async function screenTrash() {
  if (!isAdmin()) { view().innerHTML = noPerm(); return; }
  showLoading(true);
  let list = [];
  try { const { data } = await sb.from('mrahi_trash').select('*').order('created_at', { ascending: false }); list = data || []; } catch (e) { toast('خطأ تحميل السلة'); }
  showLoading(false);
  const actionAr = { delete: 'محذوف', edit: 'نسخة قبل تعديل' };
  const whoOf = (t) => t.actor_name || ((C.members.find(m => m.user_id === t.actor) || {}).full_name) || '—';
  view().innerHTML = `<div class="muted" style="margin-bottom:8px">العناصر المحذوفة والنُّسخ السابقة قابلة للاستعادة. تُحذف نهائياً تلقائياً بعد ٣٠ يوماً، أو احذفها يدوياً بعد التأكّد.</div>`
    + (list.length ? list.map(t => `<div class="card">
        <div class="li-title">${esc(t.label || t.tbl)}</div>
        <div class="li-sub"><span class="badge ${t.action === 'delete' ? 'off' : ''}">${actionAr[t.action] || t.action}</span> ${fmtDateTime(t.created_at)}</div>
        <div class="li-sub">بواسطة: ${esc(whoOf(t))}</div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn sm" data-rest="${t.id}">استعادة</button>
          <button class="btn sm danger" data-perm="${t.id}">حذف نهائي</button>
        </div></div>`).join('') : '<div class="center-empty">السلة فارغة.</div>');
  view().querySelectorAll('[data-rest]').forEach(b => b.addEventListener('click', () => restoreTrash(list.find(x => String(x.id) === b.dataset.rest))));
  view().querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm2('حذف نهائي لا يمكن التراجع عنه إطلاقاً. متأكّد؟')) return;
    const ok = await guard(async () => { const { error } = await sb.from('mrahi_trash').delete().eq('id', b.dataset.perm); if (error) throw error; });
    if (ok) { toast('تم الحذف النهائي'); screenTrash(); }
  }));
}
async function restoreTrash(t) {
  if (!t) return;
  const data = Object.assign({}, t.data); delete data.id; delete data.created_at;
  const ok = await guard(async () => {
    if (t.action === 'edit') { const { error } = await sb.from(TABLES[t.tbl]).update(data).eq('id', t.rec_id); if (error) throw error; }
    else { const { error } = await sb.from(TABLES[t.tbl]).insert(data); if (error) throw error; }
    const { error: de } = await sb.from('mrahi_trash').delete().eq('id', t.id); if (de) throw de;
  });
  if (ok) { toast('تمت الاستعادة'); await loadAll(); screenTrash(); }
}

/* ===== المودال ===== */
function openModal(title, body, onMount) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3>${body}<button class="btn outline" id="modalClose" style="margin-top:10px">إلغاء</button></div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) closeModal(); });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  if (onMount) onMount();
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

const noPerm = () => '<div class="center-empty">ليست لديك صلاحية الوصول لهذا القسم.<br>راجع مدير النظام.</div>';

/* ===== شاشة بانتظار التفعيل ===== */
function renderPending() {
  document.getElementById('screenTitle').textContent = 'مراحي';
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('bottomnav').innerHTML = '';
  document.querySelectorAll('.fab').forEach(f => f.remove());
  view().innerHTML = `<div class="center-empty"><div style="font-size:3rem">⏳</div>
    <h3>حسابك بانتظار التفعيل</h3>
    <p class="muted">تم إنشاء حسابك بنجاح. يرجى أن يقوم مدير النظام بتفعيلك ومنحك الصلاحيات، ثم أعد تسجيل الدخول.</p>
    <div class="muted">${esc((me && me.full_name) || '')}</div></div>`;
}

/* ===== المصادقة ===== */
function buildNav() {
  const tabs = [['#/home', '🏠', 'الرئيسية'], ['#/animals', '🐑', 'الحلال'], ['#/alerts', '🔔', 'التنبيهات'], ['#/more', '☰', 'المزيد']];
  const nav = document.getElementById('bottomnav');
  nav.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
  nav.innerHTML = tabs.map(([r, i, l]) => `<button class="nav-item" data-route="${r}"><span>${i}</span>${l}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => setHash(b.dataset.route)));
}
// الدخول بالجوال أو اسم المستخدم — نبني بريداً داخلياً خفياً لكل حساب.
const normPhone = (s) => (s || '').replace(/\D/g, '');           // أرقام فقط
const phoneToEmail = (p) => `${p}@mrahi.app`;                    // بريد داخلي وهمي
const pinToPass = (pin) => `${pin}@Mrahi`;                       // لاحقة ثابتة لتجاوز حد الطول
const PIN_RE = /^\d{4}$/;
// حقل رقم سري مع زر عين لإظهار/إخفاء القيمة
function pinField(label, id) {
  return `<div class="field pw">
    <label>${label}</label>
    <input id="${id}" type="password" inputmode="numeric" maxlength="4" pattern="\\d*" autocomplete="off">
    <button type="button" class="eye" data-eye="${id}" aria-label="إظهار/إخفاء الرقم السري">👁</button>
  </div>`;
}

function renderAuth() {
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  let mode = 'signin';
  function draw() {
    box.innerHTML = `<div class="auth-box">
      <div class="logo">🐪</div><h2>مراحي</h2><div class="sub">إدارة الحلال — دخول الفريق</div>
      <div class="auth-tabs"><button id="t_in" class="${mode === 'signin' ? 'active' : ''}">دخول</button>${signupOpen ? `<button id="t_up" class="${mode === 'signup' ? 'active' : ''}">حساب جديد</button>` : ''}</div>
      ${signupOpen ? '' : '<div class="muted" style="text-align:center;font-size:.85rem;margin:-4px 0 8px">التسجيل مغلق حالياً. راجع مدير النظام.</div>'}
      ${mode === 'signup'
        ? fInput('الاسم', 'a_name', '') +
          fInput('رقم الجوال', 'a_phone', '', 'tel', 'inputmode="tel"') +
          fInput('اسم المستخدم (اختياري)', 'a_user', '', 'text', 'autocomplete="off"') +
          pinField('الرقم السري (٤ أرقام)', 'a_pin')
        : fInput('الجوال أو اسم المستخدم', 'a_id', '') +
          pinField('الرقم السري (٤ أرقام)', 'a_pin')}
      <button class="btn" id="a_submit">${mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'}</button>
      <div class="auth-msg" id="a_msg"></div></div>`;
    document.getElementById('t_in').addEventListener('click', () => { mode = 'signin'; draw(); });
    { const up = document.getElementById('t_up'); if (up) up.addEventListener('click', () => { mode = 'signup'; draw(); }); }
    if (!signupOpen && mode === 'signup') { mode = 'signin'; }
    document.getElementById('a_submit').addEventListener('click', submit);
    box.querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => {
      const inp = document.getElementById(b.dataset.eye);
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.textContent = show ? '🙈' : '👁';
    }));
    box.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  }
  async function submit() {
    const msg = document.getElementById('a_msg'); msg.className = 'auth-msg';
    const pin = val('a_pin').trim();
    if (!PIN_RE.test(pin)) { msg.classList.add('err'); msg.textContent = 'الرقم السري يجب أن يكون ٤ أرقام'; return; }
    msg.textContent = '… لحظة';
    try {
      if (mode === 'signin') {
        const ident = val('a_id').trim();
        if (!ident) { msg.classList.add('err'); msg.textContent = 'أدخل الجوال أو اسم المستخدم'; return; }
        // المُعرّف قد يكون جوالاً أو اسم مستخدم → حوّله إلى البريد الداخلي
        const digits = normPhone(ident);
        const { data: email } = await sb.rpc('mrahi_resolve_login', { ident: digits || ident });
        const loginEmail = email || (digits ? phoneToEmail(digits) : null);
        if (!loginEmail) { msg.classList.add('err'); msg.textContent = 'بيانات الدخول غير صحيحة'; return; }
        const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password: pinToPass(pin) });
        if (error) throw error;
      } else {
        const full_name = val('a_name').trim();
        const phone = normPhone(val('a_phone'));
        const username = val('a_user').trim();
        if (!full_name) { msg.classList.add('err'); msg.textContent = 'أدخل الاسم'; return; }
        if (phone.length < 7) { msg.classList.add('err'); msg.textContent = 'أدخل رقم جوال صحيح'; return; }
        const { data, error } = await sb.auth.signUp({
          email: phoneToEmail(phone), password: pinToPass(pin),
          options: { data: { full_name, username, phone } },
        });
        if (error) throw error;
        if (!data.session) { msg.classList.add('ok'); msg.textContent = 'تم إنشاء الحساب. حسابك بانتظار تفعيل المدير، ثم سجّل الدخول.'; mode = 'signin'; return; }
      }
    } catch (e) {
      msg.classList.add('err'); msg.textContent = translateAuthError(e.message);
    }
  }
  draw();
}
function translateAuthError(m) {
  if (/Invalid login/i.test(m)) return 'بيانات الدخول غير صحيحة';
  if (/already registered/i.test(m)) return 'رقم الجوال مسجّل مسبقاً';
  if (/duplicate key|unique constraint/i.test(m)) return 'الجوال أو اسم المستخدم مستخدم مسبقاً';
  if (/Database error saving/i.test(m)) return 'الجوال أو اسم المستخدم مستخدم مسبقاً';
  if (/Password should be at least/i.test(m)) return 'الرقم السري قصير';
  if (/Email not confirmed/i.test(m)) return 'أوقِف «تأكيد البريد» في إعدادات Supabase';
  return m;
}

async function enterApp(session) {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildNav();
  showLoading(true);
  // تحميل صف العضو الحالي
  const { data: mem } = await sb.from('mrahi_members').select('*').eq('user_id', session.user.id).maybeSingle();
  me = mem || { user_id: session.user.id, full_name: '', role: 'member', is_active: false, perms: {} };
  if (!me.is_active) { showLoading(false); renderPending(); return; }
  try { await loadAll(); } catch (e) { toast('خطأ تحميل: ' + e.message); }
  showLoading(false);
  if (!location.hash) location.hash = '#/home';
  render();
}

/* ===== التهيئة ===== */
function configMissing() {
  const c = window.MARAHI_CONFIG || {};
  return !c.SUPABASE_URL || c.SUPABASE_URL.includes('YOUR_PROJECT') || !c.SUPABASE_ANON_KEY || c.SUPABASE_ANON_KEY.includes('YOUR_');
}
function showSetup() {
  showLoading(false);
  document.getElementById('app').classList.add('hidden');
  const box = document.getElementById('auth'); box.classList.remove('hidden');
  box.innerHTML = `<div class="auth-box"><div class="logo">⚙️</div><h2>إعداد مطلوب</h2>
    <p class="sub">افتح ملف <b>config.js</b> وضع رابط مشروع Supabase والمفتاح العام (anon key)، ثم أعد التحميل.</p>
    <p class="muted" style="font-size:.85rem">ونفّذ ملف <b>schema.sql</b> في Supabase → SQL Editor لإنشاء الجداول والصلاحيات.</p></div>`;
}

async function init() {
  if (configMissing()) { showSetup(); return; }
  sb = window.supabase.createClient(window.MARAHI_CONFIG.SUPABASE_URL, window.MARAHI_CONFIG.SUPABASE_ANON_KEY);

  document.getElementById('backBtn').addEventListener('click', goBack);
  document.getElementById('signoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); });
  window.addEventListener('hashchange', () => { if (me && me.is_active) render(); });

  sb.auth.onAuthStateChange((event, session) => {
    if (session && session.user) { enterApp(session); }
    else { me = null; renderAuth(); }
  });

  await loadSignupOpen();
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) await enterApp(session); else { showLoading(false); renderAuth(); }
}

init();
