/* مراحي — تطبيق ويب لإدارة الحلال، يعمل أوفلاين ويخزّن محلياً (localStorage) */
'use strict';

/* ============ ثوابت ومسميات ============ */
const TYPES = [
  { k: 'camel',  ar: 'إبل',  gest: 390 },
  { k: 'sheep',  ar: 'غنم',  gest: 150 },
  { k: 'goat',   ar: 'ماعز', gest: 150 },
  { k: 'cattle', ar: 'بقر',  gest: 283 },
];
const SEX = [ { k: 'female', ar: 'أنثى' }, { k: 'male', ar: 'ذكر' } ];
const STATUS = [ { k: 'present', ar: 'موجودة' }, { k: 'sold', ar: 'مباعة' }, { k: 'dead', ar: 'نافقة' } ];
const IDKIND = [
  { k: 'number', ar: 'رقم' }, { k: 'tag', ar: 'وسم' },
  { k: 'chip', ar: 'شريحة إلكترونية' }, { k: 'name', ar: 'اسم / مسمى' },
];
const PREG = [
  { k: 'monitoring', ar: 'تحت المتابعة' }, { k: 'born', ar: 'ولدت' }, { k: 'not_confirmed', ar: 'لم يثبت الحمل' },
];
const arOf = (arr, k) => (arr.find(x => x.k === k) || {}).ar || '—';
const gestOf = (typeKey) => (TYPES.find(t => t.k === typeKey) || TYPES[1]).gest;

/* ============ التخزين المحلي ============ */
const KEY = 'marahi.db.v1';
const empty = () => ({
  seq: 0,
  animals: [], matings: [], pregnancies: [], births: [],
  vaccineTypes: [], vaccinations: [], treatments: [],
});
let DB = load();
function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY)); return j && j.animals ? j : empty(); }
  catch (e) { return empty(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(DB)); }
function nextId() { DB.seq = (DB.seq || 0) + 1; return DB.seq; }

/* ============ أدوات التاريخ ============ */
const todayStr = () => new Date().toISOString().slice(0, 10);
function addDays(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const a = new Date(dateStr + 'T00:00:00'), b = new Date(todayStr() + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return dateStr.replace(/-/g, '/');
}

/* ============ أدوات عامة ============ */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => document.getElementById('view');
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function animalById(id) { return DB.animals.find(a => a.id === id); }
function display(a) {
  if (!a) return '—';
  return esc(a.code || '—') + (a.name ? ' • ' + esc(a.name) : '');
}

/* أدوات إنشاء الحقول */
function fInput(label, id, val, type = 'text', extra = '') {
  return `<div class="field"><label>${label}</label>
    <input id="${id}" type="${type}" value="${esc(val || '')}" ${extra}></div>`;
}
function fTextarea(label, id, val) {
  return `<div class="field"><label>${label}</label><textarea id="${id}">${esc(val || '')}</textarea></div>`;
}
function fSelect(label, id, options, selected, blank) {
  const opts = (blank ? `<option value="">${blank}</option>` : '') +
    options.map(o => `<option value="${o.k}" ${o.k === selected ? 'selected' : ''}>${o.ar}</option>`).join('');
  return `<div class="field"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
function fAnimalSelect(label, id, selectedId, list, blank = '— اختر —') {
  const opts = `<option value="">${blank}</option>` + list.map(a =>
    `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${a.code || '—'}${a.name ? ' • ' + a.name : ''}</option>`).join('');
  return `<div class="field"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
const val = (id) => (document.getElementById(id) || {}).value || '';
const num = (id) => parseInt(val(id), 10) || 0;

/* ============ التوجيه ============ */
function setHash(h) { location.hash = h; }
function goBack() { history.length > 1 ? history.back() : setHash('#/home'); }

const ROUTES = {
  home: { title: 'مراحي', back: false, fn: screenHome },
  animals: { title: 'الحلال', back: false, fn: screenAnimals },
  alerts: { title: 'التنبيهات', back: false, fn: screenAlerts },
  more: { title: 'المزيد', back: false, fn: screenMore },
  animal: { title: 'سجل البهيمة', back: true, fn: screenAnimalDetail },
  'animal-edit': { title: 'بهيمة', back: true, fn: screenAnimalEdit },
  mating: { title: 'تلقيح / حمل', back: true, fn: screenMating },
  pregnancies: { title: 'الحمل والمتابعة', back: true, fn: screenPregnancies },
  'vaccine-types': { title: 'أنواع التطعيمات', back: true, fn: screenVaccineTypes },
  vaccinate: { title: 'إعطاء تطعيم', back: true, fn: screenVaccinate },
  treat: { title: 'إضافة علاج', back: true, fn: screenTreat },
  backup: { title: 'النسخ الاحتياطي', back: true, fn: screenBackup },
};

function parseHash() {
  const raw = (location.hash || '#/home').replace(/^#\//, '');
  const parts = raw.split('/');
  return { name: parts[0] || 'home', arg: parts[1] };
}

function render() {
  const { name, arg } = parseHash();
  const route = ROUTES[name] || ROUTES.home;
  document.getElementById('screenTitle').textContent = route.title;
  const back = document.getElementById('backBtn');
  back.classList.toggle('hidden', !route.back);
  // تفعيل التبويب
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.route === '#/' + name));
  document.querySelectorAll('.fab').forEach(f => f.remove());
  window.scrollTo(0, 0);
  route.fn(arg);
}

/* ============ الشاشة الرئيسية ============ */
function screenHome() {
  const present = DB.animals.filter(a => a.status === 'present').length;
  const births = upcomingBirths();
  const vaccs = upcomingVaccinations();
  const treats = activeTreatments();
  view().innerHTML = `
    <div class="title-lg">مراحي</div>
    <div class="muted">متابعة الحلال من الولادة حتى البيع</div>
    <div class="stats">
      <div class="stat green"><div class="n">${present}</div><div class="l">عدد الحلال</div></div>
      <div class="stat amber"><div class="n">${births.length}</div><div class="l">ولادات قادمة</div></div>
      <div class="stat blue"><div class="n">${vaccs.length}</div><div class="l">تطعيمات قادمة</div></div>
      <div class="stat red"><div class="n">${treats.length}</div><div class="l">علاجات حالية</div></div>
    </div>
    <div class="search"><input id="q" placeholder="ابحث برقم/وسم/شريحة/اسم البهيمة"></div>
    <div id="qResults"></div>
    ${sectionUpcomingBirths(births)}
    ${sectionActiveTreatments(treats)}
  `;
  const q = document.getElementById('q');
  q.addEventListener('input', () => {
    const term = q.value.trim();
    const box = document.getElementById('qResults');
    if (!term) { box.innerHTML = ''; return; }
    const res = searchAnimals(term).slice(0, 8);
    box.innerHTML = res.length ? res.map(animalCard).join('') :
      '<div class="muted" style="padding:8px">لا نتائج</div>';
    bindAnimalCards(box);
  });
}
function sectionUpcomingBirths(births) {
  return `<div class="card"><h3>الولادات القادمة (٧ أيام)</h3>${
    births.length ? births.map(p => {
      const a = animalById(p.animalId);
      return `<div class="row"><span class="k">${display(a)}</span><span class="v">${fmtDate(p.expected)} (بعد ${daysUntil(p.expected)} يوم)</span></div>`;
    }).join('') : '<div class="muted">لا يوجد</div>'}</div>`;
}
function sectionActiveTreatments(treats) {
  return `<div class="card"><h3>العلاجات الحالية (تحت التحريم)</h3>${
    treats.length ? treats.map(t => {
      const a = animalById(t.animalId);
      return `<div class="row"><span class="k">${display(a)}</span><span class="v">${esc(t.medName)} • ينتهي ${fmtDate(t.withdrawalEnd)}</span></div>`;
    }).join('') : '<div class="muted">لا يوجد</div>'}</div>`;
}

/* ============ التنبيهات ============ */
function upcomingBirths() {
  return DB.pregnancies.filter(p => p.status === 'monitoring' && p.expected)
    .filter(p => { const d = daysUntil(p.expected); return d !== null && d >= 0 && d <= 7; })
    .sort((a, b) => a.expected.localeCompare(b.expected));
}
function upcomingVaccinations() {
  return DB.vaccinations.filter(v => v.nextDue)
    .filter(v => { const d = daysUntil(v.nextDue); return d !== null && d >= 0 && d <= 30; })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}
function activeTreatments() {
  return DB.treatments.filter(t => t.withdrawalEnd && daysUntil(t.withdrawalEnd) >= 0)
    .sort((a, b) => a.withdrawalEnd.localeCompare(b.withdrawalEnd));
}
function screenAlerts() {
  const births = upcomingBirths(), vaccs = upcomingVaccinations(), treats = activeTreatments();
  view().innerHTML = `
    <div class="card"><h3>ولادة متوقعة خلال ٧ أيام</h3>${
      births.length ? births.map(p => row(display(animalById(p.animalId)), `${fmtDate(p.expected)} • ${daysUntil(p.expected)} يوم`)).join('') : noItem()}</div>
    <div class="card"><h3>انتهاء مدة التحريم (علاجات جارية)</h3>${
      treats.length ? treats.map(t => row(display(animalById(t.animalId)), `${esc(t.medName)} • ينتهي ${fmtDate(t.withdrawalEnd)}`)).join('') : noItem()}</div>
    <div class="card"><h3>مواعيد تطعيم قادمة</h3>${
      vaccs.length ? vaccs.map(v => row(display(animalById(v.animalId)), fmtDate(v.nextDue))).join('') : noItem()}</div>
  `;
}
const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const noItem = () => '<div class="muted">لا يوجد</div>';

/* ============ قائمة الحلال ============ */
let animalFilter = '';
function searchAnimals(term) {
  const t = term.toLowerCase();
  return DB.animals.filter(a =>
    (a.code || '').toLowerCase().includes(t) ||
    (a.name || '').toLowerCase().includes(t) ||
    (a.pen || '').toLowerCase().includes(t));
}
function animalCard(a) {
  const st = a.status === 'sold' ? 'sold' : a.status === 'dead' ? 'dead' : '';
  return `<div class="card click" data-aid="${a.id}">
    <div class="li-title">${display(a)}</div>
    <div class="li-sub">${arOf(TYPES, a.type)} • ${arOf(SEX, a.sex)} • <span class="badge ${st}">${arOf(STATUS, a.status)}</span></div>
    ${a.pen ? `<div class="li-sub">المراح: ${esc(a.pen)}</div>` : ''}
  </div>`;
}
function bindAnimalCards(root) {
  root.querySelectorAll('[data-aid]').forEach(c =>
    c.addEventListener('click', () => setHash('#/animal/' + c.dataset.aid)));
}
function screenAnimals() {
  const chips = `<div class="chips">
    <span class="chip ${!animalFilter ? 'active' : ''}" data-f="">الكل</span>
    ${TYPES.map(t => `<span class="chip ${animalFilter === t.k ? 'active' : ''}" data-f="${t.k}">${t.ar}</span>`).join('')}
  </div>`;
  const list = DB.animals.filter(a => !animalFilter || a.type === animalFilter)
    .sort((a, b) => b.id - a.id);
  view().innerHTML = chips + (list.length ? list.map(animalCard).join('')
    : '<div class="center-empty">لا توجد بهائم بعد.<br>اضغط (+ إضافة بهيمة).</div>');
  view().querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    animalFilter = c.dataset.f; screenAnimals();
  }));
  bindAnimalCards(view());
  addFab('+ إضافة بهيمة', () => setHash('#/animal-edit/0'));
}
function addFab(label, onClick) {
  const fab = document.createElement('button');
  fab.className = 'fab'; fab.textContent = label;
  fab.addEventListener('click', onClick);
  document.body.appendChild(fab);
}

/* ============ إضافة/تعديل بهيمة ============ */
function screenAnimalEdit(arg) {
  const id = parseInt(arg, 10) || 0;
  const a = id ? animalById(id) : null;
  const females = DB.animals.filter(x => x.sex === 'female' && x.id !== id);
  document.getElementById('screenTitle').textContent = id ? 'تعديل بهيمة' : 'إضافة بهيمة';
  view().innerHTML = `
    <div class="card"><h3>البيانات الأساسية</h3>
      ${fSelect('نوع الحلال', 'f_type', TYPES, a ? a.type : 'sheep')}
      ${fInput('رقم المراح (الحظيرة)', 'f_pen', a && a.pen)}
      ${fSelect('نوع المعرّف', 'f_kind', IDKIND, a ? a.idkind : 'number')}
      ${fInput('المعرّف (رقم/وسم/شريحة/اسم)', 'f_code', a && a.code)}
      ${fInput('الاسم/المسمى (اختياري)', 'f_name', a && a.name)}
      ${fSelect('الجنس', 'f_sex', SEX, a ? a.sex : 'female')}
      ${fInput('تاريخ الميلاد', 'f_birth', a && a.birth, 'date')}
      ${fInput('اللون', 'f_color', a && a.color)}
      ${fSelect('الحالة', 'f_status', STATUS, a ? a.status : 'present')}
    </div>
    <div class="card"><h3>النسب</h3>
      ${fAnimalSelect('الأم', 'f_mother', a && a.motherId, females, '— بدون —')}
      ${fInput('الأب / الفحل (اسم أو رقم)', 'f_father', a && a.fatherName)}
    </div>
    <div class="card"><h3>ملاحظات</h3>${fTextarea('ملاحظات', 'f_notes', a && a.notes)}</div>
    <button class="btn" id="saveBtn">حفظ</button>
    ${id ? '<button class="btn danger" id="delBtn">حذف البهيمة</button>' : ''}
  `;
  document.getElementById('saveBtn').addEventListener('click', () => {
    const code = val('f_code').trim(), name = val('f_name').trim();
    if (!code && !name) { toast('أدخل المعرّف أو الاسم'); return; }
    const obj = {
      id: id || nextId(),
      type: val('f_type'), pen: val('f_pen').trim(),
      idkind: val('f_kind'), code: code || name, name,
      sex: val('f_sex'), birth: val('f_birth'), color: val('f_color').trim(),
      status: val('f_status'),
      motherId: parseInt(val('f_mother'), 10) || null,
      fatherName: val('f_father').trim(),
      notes: val('f_notes').trim(),
      createdAt: a ? a.createdAt : Date.now(),
    };
    if (a) { Object.assign(a, obj); } else { DB.animals.push(obj); }
    save(); toast('تم الحفظ'); goBack();
  });
  if (id) document.getElementById('delBtn').addEventListener('click', () => {
    if (confirm('حذف هذه البهيمة نهائياً؟')) {
      DB.animals = DB.animals.filter(x => x.id !== id); save(); toast('تم الحذف'); setHash('#/animals');
    }
  });
}

/* ============ سجل البهيمة ============ */
function screenAnimalDetail(arg) {
  const id = parseInt(arg, 10);
  const a = animalById(id);
  if (!a) { view().innerHTML = '<div class="center-empty">غير موجودة</div>'; return; }
  document.getElementById('screenTitle').textContent = a.code || 'سجل البهيمة';
  const offspring = DB.animals.filter(x => x.motherId === id || x.fatherId === id).sort((x, y) => (y.birth || '').localeCompare(x.birth || ''));
  const matings = DB.matings.filter(m => m.animalId === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const pregs = DB.pregnancies.filter(p => p.animalId === id);
  const vaccs = DB.vaccinations.filter(v => v.animalId === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const treats = DB.treatments.filter(t => t.animalId === id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const mother = a.motherId ? animalById(a.motherId) : null;

  view().innerHTML = `
    <div class="card"><h3>البيانات الأساسية</h3>
      ${row('النوع', arOf(TYPES, a.type))}
      ${row('المعرّف', esc(a.code) + ' (' + arOf(IDKIND, a.idkind) + ')')}
      ${a.name ? row('الاسم', esc(a.name)) : ''}
      ${row('الجنس', arOf(SEX, a.sex))}
      ${row('المراح', esc(a.pen) || '—')}
      ${row('تاريخ الميلاد', fmtDate(a.birth))}
      ${row('اللون', esc(a.color) || '—')}
      ${row('الحالة', arOf(STATUS, a.status))}
    </div>
    <div class="card"><h3>النسب</h3>
      ${row('الأم', mother ? display(mother) : '—')}
      ${row('الأب / الفحل', esc(a.fatherName) || '—')}
      ${a.notes ? row('ملاحظات', esc(a.notes)) : ''}
    </div>
    <div class="card"><h3>أنتجت (${offspring.length})</h3>
      ${offspring.length ? offspring.map(o => `<div class="card click" data-aid="${o.id}" style="margin:6px 0">
          <div class="li-title">${display(o)}</div>
          <div class="li-sub">${arOf(SEX, o.sex)} • ${fmtDate(o.birth)}</div></div>`).join('') : '<div class="muted">لا يوجد</div>'}
    </div>
    <div class="card"><h3>التلقيح والحمل</h3>
      <button class="btn outline" id="addMating">إضافة تلقيح / متابعة حمل</button>
      ${matings.map(m => row('تلقيح ' + fmtDate(m.date), 'الفحل: ' + (esc(m.sireName) || esc(m.sireCode) || '—'))).join('')}
      ${pregs.map(p => row('حمل (' + arOf(PREG, p.status) + ')', 'متوقع ' + fmtDate(p.expected))).join('')}
    </div>
    <div class="card"><h3>التطعيمات (${vaccs.length})</h3>
      <button class="btn outline" id="addVacc">إعطاء تطعيم</button>
      ${vaccs.map(v => row(fmtDate(v.date) + ' — ' + esc(vtName(v.typeId)), 'تحريم حتى ' + fmtDate(v.withdrawalEnd))).join('')}
    </div>
    <div class="card"><h3>العلاجات (${treats.length})</h3>
      <button class="btn outline" id="addTreat">إضافة علاج</button>
      ${treats.map(t => row(esc(t.medName) + ' (' + fmtDate(t.date) + ')', 'تحريم حتى ' + fmtDate(t.withdrawalEnd))).join('')}
    </div>
    <div style="height:30px"></div>
  `;
  bindAnimalCards(view());
  document.getElementById('addMating').addEventListener('click', () => setHash('#/mating/' + id));
  document.getElementById('addVacc').addEventListener('click', () => setHash('#/vaccinate/' + id));
  document.getElementById('addTreat').addEventListener('click', () => setHash('#/treat/' + id));
  addFab('✎ تعديل', () => setHash('#/animal-edit/' + id));
}
function vtName(typeId) {
  const v = DB.vaccineTypes.find(x => x.id === typeId); return v ? v.name : 'تطعيم';
}

/* ============ التلقيح والحمل ============ */
function screenMating(arg) {
  const animalId = parseInt(arg, 10) || 0;
  const females = DB.animals.filter(a => a.sex === 'female');
  const preset = animalId ? animalById(animalId) : null;
  view().innerHTML = `
    <div class="card"><h3>سجل التلقيح</h3>
      ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة (الأم)', 'm_animal', 0, females)}
      ${fInput('تاريخ التلقيح', 'm_date', todayStr(), 'date')}
      ${fInput('رقم الفحل', 'm_sireCode', '')}
      ${fInput('اسم الفحل', 'm_sireName', '')}
      ${fTextarea('ملاحظات', 'm_notes', '')}
      <div class="check"><input type="checkbox" id="m_preg" checked><label for="m_preg" style="margin:0">بدء متابعة الحمل (يحسب تاريخ الولادة المتوقع تلقائياً)</label></div>
      <div class="hint" id="m_hint"></div>
      <button class="btn" id="m_save">حفظ</button>
    </div>`;
  const hint = document.getElementById('m_hint');
  function updateHint() {
    const a = preset || animalById(parseInt(val('m_animal'), 10));
    const d = val('m_date');
    if (a && d) {
      const g = gestOf(a.type);
      hint.textContent = `مدة الحمل المتوقعة: ${g} يوم → الولادة ${fmtDate(addDays(d, g))}`;
    } else hint.textContent = '';
  }
  ['m_date', 'm_animal'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', updateHint); });
  updateHint();
  document.getElementById('m_save').addEventListener('click', () => {
    const a = preset || animalById(parseInt(val('m_animal'), 10));
    const d = val('m_date');
    if (!a) { toast('اختر البهيمة'); return; }
    if (!d) { toast('أدخل التاريخ'); return; }
    DB.matings.push({ id: nextId(), animalId: a.id, date: d, sireCode: val('m_sireCode').trim(), sireName: val('m_sireName').trim(), notes: val('m_notes').trim() });
    if (document.getElementById('m_preg').checked) {
      const g = gestOf(a.type);
      DB.pregnancies.push({ id: nextId(), animalId: a.id, matingDate: d, gest: g, expected: addDays(d, g), status: 'monitoring', notes: val('m_notes').trim() });
    }
    save(); toast('تم الحفظ'); goBack();
  });
}

function screenPregnancies() {
  const list = DB.pregnancies.slice().sort((a, b) => (a.expected || '').localeCompare(b.expected || ''));
  view().innerHTML = list.length ? list.map(p => {
    const a = animalById(p.animalId);
    const actions = p.status === 'monitoring' ? `<div class="btn-row" style="margin-top:8px">
        <button class="btn sm" data-birth="${p.id}">تسجيل ولادة</button>
        <button class="btn sm outline" data-nope="${p.id}">لم يثبت</button></div>` : '';
    return `<div class="card"><h3>${display(a)}</h3>
      ${row('تاريخ التلقيح', fmtDate(p.matingDate))}
      ${row('مدة الحمل', p.gest + ' يوم')}
      ${row('الولادة المتوقعة', fmtDate(p.expected))}
      ${row('الحالة', arOf(PREG, p.status))}
      ${actions}</div>`;
  }).join('') : '<div class="center-empty">لا توجد حالات حمل مسجّلة.</div>';
  view().querySelectorAll('[data-nope]').forEach(b => b.addEventListener('click', () => {
    const p = DB.pregnancies.find(x => x.id === parseInt(b.dataset.nope, 10));
    p.status = 'not_confirmed'; save(); screenPregnancies();
  }));
  view().querySelectorAll('[data-birth]').forEach(b => b.addEventListener('click', () =>
    openBirthModal(DB.pregnancies.find(x => x.id === parseInt(b.dataset.birth, 10)))));
}

function openBirthModal(preg) {
  const mother = animalById(preg.animalId);
  openModal('تسجيل ولادة — ' + display(mother), `
    ${fInput('رقم المولود', 'b_code', '')}
    ${fInput('تاريخ الولادة', 'b_date', todayStr(), 'date')}
    ${fSelect('الجنس', 'b_sex', SEX, 'female')}
    ${fInput('الأب / الفحل', 'b_father', '')}
    ${fTextarea('ملاحظات', 'b_notes', '')}
    <div class="check"><input type="checkbox" id="b_create" checked><label for="b_create" style="margin:0">إضافة المولود كبهيمة جديدة</label></div>
    <button class="btn" id="b_save">حفظ</button>
  `, () => {
    document.getElementById('b_save').addEventListener('click', () => {
      const code = val('b_code').trim(), date = val('b_date') || todayStr();
      const sex = val('b_sex'), father = val('b_father').trim(), notes = val('b_notes').trim();
      let offId = null;
      if (document.getElementById('b_create').checked && code) {
        offId = nextId();
        DB.animals.push({
          id: offId, type: mother.type, pen: mother.pen || '', idkind: 'number', code, name: '',
          sex, birth: date, color: '', status: 'present', motherId: mother.id, fatherName: father, notes, createdAt: Date.now(),
        });
      }
      DB.births.push({ id: nextId(), motherId: mother.id, offspringId: offId, offspringCode: code, date, sex, fatherName: father, notes });
      preg.status = 'born';
      save(); closeModal(); toast('تم تسجيل الولادة'); screenPregnancies();
    });
  });
}

/* ============ أنواع التطعيمات ============ */
function screenVaccineTypes() {
  const list = DB.vaccineTypes.slice().sort((a, b) => a.name.localeCompare(b.name));
  view().innerHTML = list.length ? list.map(v => `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="li-title">${esc(v.name)}</div>
          ${v.vaccineName ? `<div class="li-sub">اللقاح: ${esc(v.vaccineName)}</div>` : ''}
          <div class="li-sub">مدة التحريم: ${v.withdrawalDays} يوم</div>
          ${v.notes ? `<div class="li-sub">${esc(v.notes)}</div>` : ''}</div>
        <button class="btn sm danger" data-del="${v.id}">حذف</button></div></div>`).join('')
    : '<div class="center-empty">عرّف أنواع التطعيمات مرة واحدة لاستخدامها لاحقاً.</div>';
  view().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    DB.vaccineTypes = DB.vaccineTypes.filter(x => x.id !== parseInt(b.dataset.del, 10)); save(); screenVaccineTypes();
  }));
  addFab('+ نوع تطعيم', () => openModal('نوع تطعيم جديد', `
    ${fInput('اسم التطعيم', 'vt_name', '')}
    ${fInput('اسم اللقاح', 'vt_vacc', '')}
    ${fInput('مدة التحريم (أيام)', 'vt_days', '', 'number', 'min="0"')}
    ${fTextarea('ملاحظات', 'vt_notes', '')}
    <button class="btn" id="vt_save">حفظ</button>
  `, () => {
    document.getElementById('vt_save').addEventListener('click', () => {
      const name = val('vt_name').trim();
      if (!name) { toast('أدخل اسم التطعيم'); return; }
      DB.vaccineTypes.push({ id: nextId(), name, vaccineName: val('vt_vacc').trim(), withdrawalDays: num('vt_days'), notes: val('vt_notes').trim() });
      save(); closeModal(); screenVaccineTypes();
    });
  }));
}

/* ============ إعطاء تطعيم ============ */
function screenVaccinate(arg) {
  const animalId = parseInt(arg, 10) || 0;
  const preset = animalId ? animalById(animalId) : null;
  if (!DB.vaccineTypes.length) {
    view().innerHTML = `<div class="center-empty">لا توجد أنواع تطعيمات.<br>عرّفها أولاً.</div>
      <button class="btn" id="goTypes">الذهاب لأنواع التطعيمات</button>`;
    document.getElementById('goTypes').addEventListener('click', () => setHash('#/vaccine-types'));
    return;
  }
  const typeOpts = DB.vaccineTypes.map(v => ({ k: String(v.id), ar: `${v.name} (${v.withdrawalDays}ي)` }));
  view().innerHTML = `<div class="card"><h3>بيانات التطعيم</h3>
    ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة', 'v_animal', 0, DB.animals)}
    ${fSelect('التطعيم', 'v_type', typeOpts, '', '— اختر —')}
    ${fInput('تاريخ التطعيم', 'v_date', todayStr(), 'date')}
    <div class="hint" id="v_hint"></div>
    ${fInput('موعد الجرعة القادمة (اختياري)', 'v_next', '', 'date')}
    ${fTextarea('ملاحظات', 'v_notes', '')}
    <button class="btn" id="v_save">حفظ</button></div>`;
  const hint = document.getElementById('v_hint');
  function upd() {
    const t = DB.vaccineTypes.find(x => x.id === parseInt(val('v_type'), 10));
    const d = val('v_date');
    hint.textContent = (t && d) ? `انتهاء التحريم: ${fmtDate(addDays(d, t.withdrawalDays))}` : '';
  }
  document.getElementById('v_type').addEventListener('change', upd);
  document.getElementById('v_date').addEventListener('change', upd);
  document.getElementById('v_save').addEventListener('click', () => {
    const a = preset || animalById(parseInt(val('v_animal'), 10));
    const t = DB.vaccineTypes.find(x => x.id === parseInt(val('v_type'), 10));
    const d = val('v_date');
    if (!a) { toast('اختر البهيمة'); return; }
    if (!t) { toast('اختر التطعيم'); return; }
    DB.vaccinations.push({ id: nextId(), animalId: a.id, typeId: t.id, date: d, withdrawalEnd: addDays(d, t.withdrawalDays), nextDue: val('v_next') || null, notes: val('v_notes').trim() });
    save(); toast('تم الحفظ'); goBack();
  });
}

/* ============ العلاجات ============ */
function screenTreat(arg) {
  const animalId = parseInt(arg, 10) || 0;
  const preset = animalId ? animalById(animalId) : null;
  view().innerHTML = `<div class="card"><h3>بيانات العلاج</h3>
    ${preset ? row('البهيمة', display(preset)) : fAnimalSelect('البهيمة', 't_animal', 0, DB.animals)}
    ${fInput('نوع العلاج (مثال: مضاد حيوي)', 't_type', '')}
    ${fInput('اسم العلاج (مثال: أوكسي تترا)', 't_med', '')}
    ${fInput('مدة التحريم (أيام)', 't_days', '', 'number', 'min="0"')}
    ${fInput('تاريخ العلاج', 't_date', todayStr(), 'date')}
    <div class="hint" id="t_hint"></div>
    ${fInput('الإجراء', 't_action', '')}
    ${fTextarea('ملاحظات', 't_notes', '')}
    <button class="btn" id="t_save">حفظ</button></div>`;
  const hint = document.getElementById('t_hint');
  function upd() {
    const days = num('t_days'), d = val('t_date');
    hint.textContent = (days > 0 && d) ? `انتهاء التحريم: ${fmtDate(addDays(d, days))}` : '';
  }
  document.getElementById('t_days').addEventListener('input', upd);
  document.getElementById('t_date').addEventListener('change', upd);
  document.getElementById('t_save').addEventListener('click', () => {
    const a = preset || animalById(parseInt(val('t_animal'), 10));
    const d = val('t_date'), days = num('t_days');
    if (!a) { toast('اختر البهيمة'); return; }
    DB.treatments.push({ id: nextId(), animalId: a.id, treatmentType: val('t_type').trim(), medName: val('t_med').trim(), withdrawalDays: days, date: d, withdrawalEnd: addDays(d, days), action: val('t_action').trim(), notes: val('t_notes').trim() });
    save(); toast('تم الحفظ'); goBack();
  });
}

/* ============ المزيد ============ */
function screenMore() {
  const items = [
    ['🤰 الحمل والمتابعة', '#/pregnancies'],
    ['💉 أنواع التطعيمات', '#/vaccine-types'],
    ['💉 إعطاء تطعيم', '#/vaccinate/0'],
    ['💊 إضافة علاج', '#/treat/0'],
    ['💾 النسخ الاحتياطي', '#/backup'],
  ];
  view().innerHTML = items.map(([l, h]) =>
    `<div class="card click" data-go="${h}"><div class="li-title">${l}</div></div>`).join('') +
    `<div class="muted" style="text-align:center;margin-top:20px;font-size:.85rem">مراحي — يعمل أوفلاين • البيانات محفوظة على جهازك فقط</div>`;
  view().querySelectorAll('[data-go]').forEach(c => c.addEventListener('click', () => setHash(c.dataset.go)));
}

/* ============ النسخ الاحتياطي ============ */
function screenBackup() {
  const counts = `${DB.animals.length} بهيمة • ${DB.births.length} ولادة • ${DB.vaccinations.length} تطعيم • ${DB.treatments.length} علاج`;
  view().innerHTML = `
    <div class="card"><h3>حفظ ومشاركة</h3>
      <div class="muted">${counts}</div>
      <button class="btn" id="bk_json">📤 نسخة JSON (حفظ/مشاركة)</button>
      <button class="btn outline" id="bk_csv">📊 تصدير Excel (CSV)</button>
    </div>
    <div class="card"><h3>استعادة</h3>
      <div class="muted">استعادة من ملف JSON سابق — سيستبدل البيانات الحالية.</div>
      <button class="btn outline" id="bk_import">📥 استعادة من ملف</button>
      <input type="file" id="bk_file" accept="application/json,.json" class="hidden">
    </div>
    <div class="card"><h3>تنبيه</h3>
      <div class="muted">البيانات محفوظة في متصفّح هذا الجهاز فقط. احرص على أخذ نسخة احتياطية بانتظام.</div>
      <button class="btn danger" id="bk_clear">حذف كل البيانات</button>
    </div>`;
  document.getElementById('bk_json').addEventListener('click', exportJson);
  document.getElementById('bk_csv').addEventListener('click', exportCsv);
  document.getElementById('bk_import').addEventListener('click', () => document.getElementById('bk_file').click());
  document.getElementById('bk_file').addEventListener('change', importJson);
  document.getElementById('bk_clear').addEventListener('click', () => {
    if (confirm('حذف كل البيانات نهائياً؟')) { DB = empty(); save(); toast('تم الحذف'); setHash('#/home'); }
  });
}
function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }
async function shareOrDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'نسخة احتياطية — مراحي' }); return; } catch (e) { /* تجاهل */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تنزيل الملف');
}
function exportJson() {
  shareOrDownload('marahi_backup_' + stamp() + '.json', JSON.stringify(DB, null, 2), 'application/json');
}
function exportCsv() {
  const cell = s => { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['النوع', 'المراح', 'المعرف', 'نوع المعرف', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'اللون', 'الحالة', 'رقم الأم', 'اسم الأب', 'ملاحظات'];
  const rows = DB.animals.map(a => [
    arOf(TYPES, a.type), a.pen, a.code, arOf(IDKIND, a.idkind), a.name, arOf(SEX, a.sex),
    a.birth, a.color, arOf(STATUS, a.status), a.motherId ? (animalById(a.motherId) || {}).code || '' : '', a.fatherName, a.notes,
  ].map(cell).join(','));
  const csv = '﻿' + head.join(',') + '\n' + rows.join('\n');
  shareOrDownload('marahi_animals_' + stamp() + '.csv', csv, 'text/csv');
}
function importJson(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.animals)) throw new Error('ملف غير صالح');
      DB = Object.assign(empty(), data);
      if (!DB.seq) DB.seq = Math.max(0, ...DB.animals.map(a => a.id || 0));
      save(); toast('تمت الاستعادة (' + DB.animals.length + ' بهيمة)'); setHash('#/home'); render();
    } catch (err) { toast('فشلت الاستعادة: ' + err.message); }
  };
  reader.readAsText(file);
}

/* ============ المودال ============ */
function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3>${bodyHtml}
    <button class="btn outline" id="modalClose" style="margin-top:10px">إلغاء</button></div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) closeModal(); });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  if (onMount) onMount();
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

/* ============ التهيئة ============ */
document.getElementById('backBtn').addEventListener('click', goBack);
document.querySelectorAll('.nav-item').forEach(b =>
  b.addEventListener('click', () => setHash(b.dataset.route)));
window.addEventListener('hashchange', render);
if (!location.hash) location.hash = '#/home';
render();

/* تسجيل service worker للعمل أوفلاين (يُتجاهل عند فتح file://) */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
