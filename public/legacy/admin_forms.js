/* admin_forms.js */

var FRM_TAB='ready';

function pFrm(){
  pFrmTab(FRM_TAB||'ready');
}

// تصفية submissions حسب الحالة
function _subsBy(statuses){
  return (D.sub||[]).filter(function(s){return statuses.indexOf(s.status)>=0;});
}

function pFrmTab(tab){
  FRM_TAB=tab;
  var ready  = (D.frm||[]);
  var review = _subsBy(['pending','reviewing']);
  var done   = _subsBy(['done','rejected']);
  var arch   = _subsBy(['archived']);
  var hotReview = _subsBy(['pending']).length;

  var tabs=[
    {k:'ready',     icon:'📋', l:'جاهزة',    n:ready.length,  c:'#2563b0', cBg:'#dbeafe'},
    {k:'review',    icon:'⏳', l:'للمراجعة',  n:review.length, c:'#d97706', cBg:'#fef3c7', hot:hotReview>0},
    {k:'completed', icon:'✓',  l:'مكتملة',   n:done.length,   c:'#15803d', cBg:'#dcfce7'},
    {k:'archived',  icon:'🗄', l:'مؤرشفة',   n:arch.length,   c:'#475569', cBg:'#f1f5f9'}
  ];

  // شريط التبويبات الاحترافي
  var tabBar='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  tabs.forEach(function(t){
    var active=(t.k===tab);
    var bg     = active ? t.cBg : '#fff';
    var border = active ? t.c   : 'var(--border)';
    var col    = active ? t.c   : 'var(--mid)';
    var weight = active ? 800   : 700;
    var shadow = active ? '0 4px 12px rgba(0,0,0,.07)' : '0 1px 3px rgba(0,0,0,.04)';
    var hotDot = t.hot ? '<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#dc2626;border:2px solid #fff;border-radius:50%;animation:pulseAlert 1.5s infinite"></span>' : '';
    tabBar+='<button type="button" onclick="pFrmTab(\''+t.k+'\')" '
      +'style="position:relative;background:'+bg+';border:1.5px solid '+border+';border-radius:13px;'
      +'padding:11px 4px 9px;cursor:pointer;font-family:Cairo,sans-serif;'
      +'box-shadow:'+shadow+';transition:transform .15s,box-shadow .15s;text-align:center" '
      +'onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">'
      +hotDot
      +'<div style="font-size:20px;line-height:1;margin-bottom:5px">'+t.icon+'</div>'
      +'<div style="font-size:18px;font-weight:900;color:'+col+';line-height:1">'+t.n+'</div>'
      +'<div style="font-size:11px;font-weight:'+weight+';color:'+col+';margin-top:3px">'+t.l+'</div>'
      +'</button>';
  });
  tabBar+='</div>';

  // محتوى التبويب
  var content='';
  if(tab==='ready')          content=_rFrmReady(ready);
  else if(tab==='review')    content=_rFrmReview(review);
  else if(tab==='completed') content=_rFrmCompleted(done);
  else if(tab==='archived')  content=_rFrmArchived(arch);

  // أزرار الإجراء بحسب التبويب
  var actionBtn='';
  if(tab==='ready'){
    actionBtn='<button class="btn bp" onclick="cFrm()">+ استمارة</button>';
  }

  $h('pg',
    '<div class="ph" style="margin-bottom:8px">'
    +'<div><div class="pt">📋 الاستمارات</div></div>'
    +actionBtn
    +'</div>'
    + tabBar
    + '<div id="frm-tab-content">'+content+'</div>'
    + '<style>@keyframes pulseAlert{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.6)}50%{box-shadow:0 0 0 5px rgba(220,38,38,0)}}</style>'
  );
}

// ─── تبويب: استمارات جاهزة (Templates) ───────────────────────────────
function _rFrmReady(forms){
  if(!forms.length){
    return '<div class="empty-state"><div style="font-size:36px">📋</div>'
      +'<p>لا توجد استمارات</p>'
      +'<button class="btn bp" onclick="cFrm()">+ إنشاء استمارة جديدة</button></div>';
  }
  var h='';
  forms.forEach(function(f){
    var isActive=f.status==='active';
    var dot      = isActive ? '#22c55e' : '#cbd5e1';
    var statusLbl= isActive ? 'منشور'   : 'مسودة';
    var statusBg = isActive ? '#dcfce7' : '#fef3c7';
    var statusCo = isActive ? '#15803d' : '#92400e';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:13px;margin-bottom:9px;box-shadow:0 1px 4px rgba(0,0,0,.04);transition:border .15s" onmouseover="this.style.borderColor=\'#cbd5e1\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0"></span>'
      +'<div style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+htmlEsc(f.title||'')+'</div>'
      +'</div>'
      +'<div style="font-size:12px;color:var(--mid);margin-right:16px">📂 '+htmlEsc(f.section_name||'بدون قسم')+'</div>'
      +'<div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      +'<span style="background:'+statusBg+';color:'+statusCo+';font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:14px">'+statusLbl+'</span>'
      +'<button class="btn bsm" style="background:'+(isActive?'#fee2e2':'#dcfce7')+';color:'+(isActive?'#dc2626':'#15803d')+';border:none;font-size:11px;padding:4px 10px" onclick="tFS('+f.id+',\''+(f.status||'draft')+'\')">'
      +(isActive?'🔒 إخفاء':'👁 نشر')+'</button>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-shrink:0">'
      +'<button class="ib" style="background:#f5f3ff;color:#7c3aed" onclick="previewForm('+f.id+')" title="معاينة">'+SVG.view+'</button>'
      +'<button class="ib ie" onclick="oBld('+f.id+')" title="تعديل">'+SVG.edit+'</button>'
      +'<button class="ib" style="background:#ecfeff;color:#0e7490" onclick="copyForm('+f.id+',\''+(f.title||'').replace(/[\\\'\"]/g,'')+'\')" title="نسخ باسم جديد">📄</button>'
      +'<button class="ib id" onclick="if(confirmDel(\'حذف الاستمارة؟\'))dFrm('+f.id+')" title="حذف">'+SVG.del+'</button>'
      +'</div></div></div>';
  });
  return h;
}

// ─── تبويب: استمارات للمراجعة ────────────────────────────────────────
function _rFrmReview(subs){
  if(!subs.length){
    return '<div class="empty-state"><div style="font-size:36px">⏳</div><p>لا توجد استمارات بانتظار المراجعة</p></div>';
  }
  // ابدأ بـ pending، ثم reviewing
  subs.sort(function(a,b){
    if(a.status===b.status) return (b.created_at||'').localeCompare(a.created_at||'');
    return a.status==='pending' ? -1 : 1;
  });
  var h='';
  subs.forEach(function(s){
    var isPending=s.status==='pending';
    var brColor   = isPending ? '#dc2626' : '#2563b0';
    var brBg      = isPending ? '#fef2f2' : '#eff6ff';
    var lblBg     = isPending ? '#fee2e2' : '#dbeafe';
    var lblCo     = isPending ? '#dc2626' : '#1d4ed8';
    var lblTxt    = isPending ? 'جديد' : 'قيد المراجعة';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-right:4px solid '+brColor+';border-radius:13px;padding:13px;margin-bottom:9px;box-shadow:0 1px 4px rgba(0,0,0,.04)">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:800;font-size:14px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(s.form_title||'استمارة')+'</div>'
      +'<div style="font-size:12px;color:var(--mid);display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<span>👤 '+htmlEsc(s.reviewer_name||'مراجع')+'</span>'
      +'<span style="opacity:.5">•</span>'
      +'<span>📅 '+((s.created_at||'').slice(0,16))+'</span>'
      +'</div>'
      +'<div style="margin-top:7px">'
      +'<span style="background:'+lblBg+';color:'+lblCo+';font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:14px">'+lblTxt+'</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap">'
      +'<button class="btn bs bsm" onclick="viewSub('+s.id+')">👁 عرض</button>'
      +(isPending?'<button class="btn bp bsm" onclick="uSub('+s.id+',\'reviewing\')">▶ ابدأ المراجعة</button>':'')
      +(!isPending?'<button class="btn bp bsm" onclick="uSub('+s.id+',\'done\')">✔ أنهِ</button>':'')
      +'</div></div></div>';
  });
  return h;
}

// ─── تبويب: استمارات مكتملة ──────────────────────────────────────────
function _rFrmCompleted(subs){
  if(!subs.length){
    return '<div class="empty-state"><div style="font-size:36px">✓</div><p>لا توجد استمارات مكتملة بعد</p></div>';
  }
  subs.sort(function(a,b){return (b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||'');});
  var h='';
  subs.forEach(function(s){
    var isRej=s.status==='rejected';
    var brColor= isRej ? '#dc2626' : '#15803d';
    var lblBg  = isRej ? '#fee2e2' : '#dcfce7';
    var lblCo  = isRej ? '#dc2626' : '#15803d';
    var lblTxt = isRej ? '✕ مرفوض' : '✓ مكتمل';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-right:4px solid '+brColor+';border-radius:13px;padding:13px;margin-bottom:9px;box-shadow:0 1px 4px rgba(0,0,0,.04)">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:800;font-size:14px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(s.form_title||'استمارة')+'</div>'
      +'<div style="font-size:12px;color:var(--mid);display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<span>👤 '+htmlEsc(s.reviewer_name||'مراجع')+'</span>'
      +'<span style="opacity:.5">•</span>'
      +'<span>📅 '+((s.created_at||'').slice(0,16))+'</span>'
      +'</div>'
      +'<div style="margin-top:7px">'
      +'<span style="background:'+lblBg+';color:'+lblCo+';font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:14px">'+lblTxt+'</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap">'
      +'<button class="btn bs bsm" onclick="viewSub('+s.id+')">👁 عرض</button>'
      +'<button class="btn bs bsm" onclick="archiveSubmission('+s.id+')" title="أرشفة">🗄 أرشفة</button>'
      +'</div></div></div>';
  });
  return h;
}

// ─── تبويب: استمارات مؤرشفة ──────────────────────────────────────────
function _rFrmArchived(subs){
  if(!subs.length){
    return '<div class="empty-state"><div style="font-size:36px">🗄</div><p>لا توجد استمارات مؤرشفة</p></div>';
  }
  subs.sort(function(a,b){return (b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||'');});
  var h='';
  subs.forEach(function(s){
    h+='<div style="background:#f8fafc;border:1.5px solid var(--border);border-right:4px solid #94a3b8;border-radius:13px;padding:13px;margin-bottom:9px;opacity:.85">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:800;font-size:14px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(s.form_title||'استمارة')+'</div>'
      +'<div style="font-size:12px;color:var(--mid);display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<span>👤 '+htmlEsc(s.reviewer_name||'مراجع')+'</span>'
      +'<span style="opacity:.5">•</span>'
      +'<span>📅 '+((s.created_at||'').slice(0,16))+'</span>'
      +'</div>'
      +'<div style="margin-top:7px">'
      +'<span style="background:#e2e8f0;color:#475569;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:14px">🗄 مؤرشف</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap">'
      +'<button class="btn bs bsm" onclick="viewSub('+s.id+')">👁 عرض</button>'
      +(typeof restoreSubmission==='function' ? '<button class="btn bp bsm" onclick="restoreSubmission('+s.id+')">↩ استعادة</button>' : '')
      +'</div></div></div>';
  });
  return h;
}

// نُبقي rFL للتوافق مع أي استدعاء قديم — تعيد رسم تبويب «جاهزة»
function rFL(){ if(FRM_TAB==='ready') pFrmTab('ready'); }


async function cFrm(){
  const t = await oPrompt('استمارة جديدة', { label:'اسم الاستمارة:', placeholder:'مثال: استمارة الفحص الأوّلي', icon:'📋', ok:'إنشاء' });
  if(!t || !t.trim()) return;
  ld(1);const r=await api('POST','forms',{title:t.trim(),subtitle:'',status:'draft',section_id:D.sec[0]?.id||null});ld(0);
  if(r.error){toast(r.error,'er');return;}toast('تم الإنشاء ✅');await lFrm();rFL();
}

// نسخ استمارة مع جميع حقولها — الناتج "مسودة" دائماً ويُفتح للتعديل
async function copyForm(srcId, srcTitle){
  var defaultTitle = (srcTitle ? 'نسخة من ' + srcTitle : 'نسخة جديدة');
  var t = await oPrompt('نسخ استمارة', { label:'اسم النسخة الجديدة:', default:defaultTitle, icon:'📄', ok:'انسخ' });
  if(!t || !t.trim()) return;
  ld(1);
  var r = await api('POST','forms',{ duplicate_from: srcId, title: t.trim() });
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  if(!r || !r.id){ toast('فشل النسخ','er'); return; }
  toast('✅ تم النسخ — يمكنك التعديل الآن');
  await lFrm();
  if(typeof oBld === 'function') oBld(r.id);
  else { FRM_TAB='ready'; pFrm(); }
}

async function dFrm(id){ld(1);await api('DELETE','forms/'+id);ld(0);toast('تم الحذف');await lFrm();rFL();}

async function tFS(id,cur){
  const ns=cur==='active'?'draft':'active';
  ld(1);await api('PUT','forms/'+id,{status:ns});ld(0);await lFrm();rFL();
}

async function oBld(fid){
  ld(1);const r=await api('GET','forms/'+fid);ld(0);
  BID=fid;
  const fields=r.fields||[];
  const cats=[...new Set(fields.map(f=>f.category||'عام'))];
  if(!cats.length)cats.push('البيانات الشخصية');
  BC=cats.map(nm=>({name:nm,open:true,fields:fields.filter(f=>(f.category||'عام')===nm)}));
  if(!BC.length)BC=[{name:'البيانات الشخصية',open:true,fields:[]}];
  // لقطة أوّليّة: تستخدمها زر "تراجع" لاسترجاع حالة فتح الاستمارة
  window._initialBC=JSON.parse(JSON.stringify(BC));
  window._lastSavedAt=Date.now();
  const so=D.sec.map(s=>`<option value="${s.id}"${s.id==r.section_id?' selected':''}>${s.name}</option>`).join('');
  $h('pg',
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
    +'<button class="btn bs bsm" onclick="gT(\'forms\')">← رجوع</button>'
    +'<div class="pt" style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+htmlEsc(r.title||'')+'</div>'
    +'<span id="autosave-status" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#64748b;font-weight:600;white-space:nowrap">·</span>'
    +'<button type="button" class="btn bs bsm" onclick="undoForm()" title="تراجع لآخر فتح" style="padding:5px 10px">↶ تراجع</button>'
    +'</div>'
    +'<div class="card" style="margin-bottom:12px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div class="f" style="margin:0"><label>العنوان *</label><input id="bt" value="'+(r.title||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div class="f" style="margin:0"><label>القسم</label><select id="bsc">'+so+'</select></div>'
    +'</div>'
    +'<div class="f" style="margin:8px 0 0"><label>الحالة</label>'
    +'<select id="bst" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;outline:none">'
    +'<option value="draft"'+(r.status==='draft'?' selected':'')+'>مسودة</option>'
    +'<option value="active"'+(r.status==='active'?' selected':'')+'>منشور</option>'
    +'</select></div>'
    +'<button class="btn bp" style="width:100%;margin-top:10px" onclick="nomFormModal('+fid+')">👤 ترشيح لمراجع</button>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<span style="font-weight:700;font-size:14px">التصنيفات والحقول</span>'
    +'<button class="btn bp bsm" onclick="addCat()">+ تصنيف</button></div>'
    +'<div id="cats-wrap"></div>'
    +'<div style="height:40px"></div>');
  rCats();
  // event delegation للحفظ التلقائي عند أي تعديل في الـ pg
  var pg=document.getElementById('pg');
  if(pg){
    pg.addEventListener('input',scheduleAutoSave);
    pg.addEventListener('change',scheduleAutoSave);
  }
  setSaveStatus('saved'); // عند الفتح نعتبر الحالة الحالية محفوظة
}

// ─── حفظ تلقائي + مؤشّر حالة + تراجع ───────────────────────────────
var _autoSaveTimer=null;
function setSaveStatus(state,extra){
  var el=document.getElementById('autosave-status');
  if(!el)return;
  if(state==='saving'){el.textContent='⏳ يحفظ…';el.style.background='#fef3c7';el.style.color='#92400e';}
  else if(state==='saved'){el.textContent='✓ محفوظ'+(extra?' '+extra:'');el.style.background='#dcfce7';el.style.color='#15803d';}
  else if(state==='error'){el.textContent='⚠️ فشل الحفظ';el.style.background='#fee2e2';el.style.color='#dc2626';}
  else if(state==='dirty'){el.textContent='● تعديلات لم تُحفظ';el.style.background='#fef9c3';el.style.color='#854d0e';}
  else{el.textContent='·';el.style.background='#f1f5f9';el.style.color='#64748b';}
}
function scheduleAutoSave(){
  setSaveStatus('dirty');
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(function(){window.autoSaveForm&&window.autoSaveForm();},1800);
}
function collectFormFields(){
  var allF=[];
  try{saveCurrentInputs();}catch(e){console.error('[autosave] saveCurrentInputs failed:',e);}
  BC.forEach(function(cat,ci){
    cat.fields.forEach(function(f,fi){
      var opts=readOptsFromDOM(ci,fi,f);
      allF.push({
        id:f.id||null,
        label:$g('lbl_'+ci+'_'+fi)?.value||f.label,
        placeholder:$g('ph_'+ci+'_'+fi)?.value||(f.placeholder||''),
        field_type:$g('tp_'+ci+'_'+fi)?.value||f.field_type,
        required:$g('rq_'+ci+'_'+fi)?.checked?1:0,
        category:cat.name,sort_order:ci*100+fi,
        // المربع الأصفر مُخفي — نحافظ على القيم المخزّنة كما هي
        conditional_field: ($g('cf_'+ci+'_'+fi) ? $g('cf_'+ci+'_'+fi).value : (f.conditional_field||'')) || null,
        conditional_value: ($g('cv_'+ci+'_'+fi) ? $g('cv_'+ci+'_'+fi).value : (f.conditional_value||'')) || null,
        options:opts
      });
    });
  });
  return allF;
}
window.autoSaveForm=async function(){
  if(!BID)return;
  var t=($g('bt')?.value||'').trim();
  if(!t){setSaveStatus('idle');return;} // لا نحفظ بدون عنوان
  setSaveStatus('saving');
  var allF;
  try{allF=collectFormFields();}catch(e){setSaveStatus('error');console.error('[autosave] collect failed:',e);return;}
  var r;
  try{
    r=await api('PUT','forms/'+BID,{
      title:t,
      section_id:+$g('bsc')?.value||null,
      status:$g('bst')?.value||'draft',
      subtitle:'',
      fields:allF
    });
  }catch(e){setSaveStatus('error');console.error('[autosave] api failed:',e);return;}
  if(r&&r.error){setSaveStatus('error');console.error('[autosave] api error:',r.error);return;}
  window._lastSavedAt=Date.now();
  setSaveStatus('saved');
};
window.undoForm=function(){
  if(!window._initialBC){toast('لا توجد نسخة سابقة','er');return;}
  oConfirm('تراجع عن كل التعديلات منذ فتح الاستمارة؟',function(){
    BC=JSON.parse(JSON.stringify(window._initialBC));
    rCats();
    // أعد ضبط حقول العنوان/القسم/الحالة من الـ DOM لأنها خارج cats-wrap — نتركها كما هي للمستخدم
    scheduleAutoSave();
    toast('تم استرجاع آخر نسخة محفوظة');
  },{icon:'↶',yes:'تراجع',no:'إلغاء'});
};

function rCats(){
  const c=$g('cats-wrap');if(!c)return;
  c.innerHTML=BC.map((cat,ci)=>
    '<div class="cat-wrap" id="cw_'+ci+'">'
    +'<div class="cat-hdr" onclick="toggleCat('+ci+')">'
    +'<span>🗂️</span>'
    +'<input class="cat-name" value="'+cat.name+'" onclick="event.stopPropagation()" oninput="BC['+ci+'].name=this.value" placeholder="اسم التصنيف">'
    +'<div style="display:flex;gap:5px" onclick="event.stopPropagation()">'
    +'<button class="btn bp bsm" style="font-size:11px;padding:4px 10px" onclick="addField('+ci+')">+ حقل</button>'
    +'<button class="ib id" style="width:28px;height:28px" onclick="if(confirmDel(\'حذف التصنيف؟\'))delCat('+ci+')">'+SVG.del+'</button>'
    +'</div>'
    +'<span style="font-size:11px;color:var(--light);transition:transform .2s"'+(cat.open?' class="cat-arrow open"':' class="cat-arrow"')+'>▼</span>'
    +'</div>'
    +'<div class="cat-body'+(cat.open?' open':'')+'"><div id="flds_'+ci+'">'
    +(cat.fields.length?'':'<div style="text-align:center;color:var(--light);padding:14px;font-size:13px">لا توجد حقول</div>')
    +'</div></div></div>').join('');
  BC.forEach((cat,ci)=>{const c2=$g('flds_'+ci);if(c2)c2.innerHTML=cat.fields.length?rFields(cat.fields,ci):'<div style="text-align:center;color:var(--light);padding:14px;font-size:13px">لا توجد حقول — اضغط "+ حقل"</div>';});
  attachFldEvents();
}

function rFields(fields,ci){
  return fields.map(function(f,fi){
    var ft=f.field_type||'text';
    var ftypes=FTYPES.map(function(t){
      return '<option value="'+t[0]+'"'+(ft===t[0]?' selected':'')+'>'+t[1]+'</option>';
    }).join('');
    var hasOpts=['select','radio','checkbox'].includes(ft);
    var opts=normalizeOptions(f.options);

    // —— حقل واحد: الكرت بالكامل ——————————————————————————
    var inpStyle='width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;outline:none;background:#fff;box-sizing:border-box';
    var labelStyle='font-size:11px;font-weight:600;color:var(--mid);display:block;margin-bottom:4px';

    var h='<div class="fr" id="fr_'+ci+'_'+fi+'" ondragover="fldDragOver(event)" ondragleave="fldDragLeave(event)" ondrop="fldDrop(event,'+ci+','+fi+')" ondragend="fldDragEnd(event)" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 1px 3px rgba(15,23,42,.04);transition:border-color .15s,background .15s">';

    // ── السطر الأول: drag + عنوان الحقل + حذف ────────────────
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
      +'<span draggable="true" ondragstart="fldDragStart(event,'+ci+','+fi+')" title="اسحب لإعادة الترتيب" style="cursor:grab;color:#94a3b8;font-size:20px;flex-shrink:0;line-height:1;padding:4px 6px;border-radius:6px;user-select:none;touch-action:none">⠿</span>'
      +'<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">'
      +'<button type="button" onclick="moveFld('+ci+','+fi+',-1)" title="أعلى" style="background:#f1f5f9;border:none;color:#475569;width:22px;height:18px;border-radius:4px;cursor:pointer;font-size:9px;padding:0;line-height:1">▲</button>'
      +'<button type="button" onclick="moveFld('+ci+','+fi+',1)" title="أسفل" style="background:#f1f5f9;border:none;color:#475569;width:22px;height:18px;border-radius:4px;cursor:pointer;font-size:9px;padding:0;line-height:1">▼</button>'
      +'</div>'
      +'<input id="lbl_'+ci+'_'+fi+'" placeholder="عنوان الحقل *" value="'+(f.label||'').replace(/"/g,'&quot;')+'" '
      +'style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;outline:none;background:#fff;color:var(--text)">'
      +'<button class="ib id" style="width:32px;height:32px;flex-shrink:0" onclick="confirmDelField('+ci+','+fi+')" title="حذف الحقل">'+SVG.del+'</button>'
      +'</div>';

    // ── السطر الثاني: النوع + إلزامي ─────────────────────────
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 12px;background:#f8fafd;border-radius:8px">'
      +'<label style="font-size:12px;font-weight:600;color:var(--mid);min-width:42px">النوع</label>'
      +'<select id="tp_'+ci+'_'+fi+'" onchange="onFldTypeChange('+ci+','+fi+',this.value)" '
      +'style="flex:1;padding:7px 11px;border:1.5px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:13px;outline:none;background:#fff">'+ftypes+'</select>'
      +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;font-weight:600;color:var(--mid);white-space:nowrap">'
      +'<input id="rq_'+ci+'_'+fi+'" type="checkbox"'+(f.required?' checked':'')+' style="width:15px;height:15px;accent-color:var(--blue)"> إلزامي</label>'
      +'</div>';

    // ── Placeholder ──────────────────────────────────────────
    h+='<div style="margin-bottom:10px">'
      +'<label style="'+labelStyle+'">نص توضيحي للحقل (Placeholder)</label>'
      +'<input id="ph_'+ci+'_'+fi+'" placeholder="مثال: اكتب اسمك الكامل…" value="'+(f.placeholder||'').replace(/"/g,'&quot;')+'" '
      +'style="'+inpStyle+';color:#64748b">'
      +'</div>';

    // (مربع «يظهر هذا الحقل فقط عند» تمّ إخفاؤه — قيم conditional_field/value
    // لا تزال محفوظة في DB ويُعاد إرسالها كما هي عند الحفظ.)

    // ── الخيارات (للنوع select/radio/checkbox) ───────────────
    if(hasOpts){
      h+='<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
        +'<span style="font-size:13px;font-weight:700;color:#0369a1">📋 الخيارات</span>'
        +'<button type="button" onclick="addOption('+ci+','+fi+')" '
        +'style="padding:5px 14px;border:1px solid #0369a1;border-radius:7px;background:#fff;color:#0369a1;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer">+ إضافة خيار</button>'
        +'</div>';

      opts.forEach(function(opt,oi){
        var ol=typeof opt==='object'?(opt.label||''):String(opt);
        var hasSub=opt.has_sub===true||opt.has_sub===1;
        var sub=(typeof opt==='object'&&opt.sub)?opt.sub:{type:'text',label:'',placeholder:'',required:false};
        var subTypes=[['text','نص'],['number','رقم'],['textarea','نص طويل'],['date','تاريخ'],['phone','جوال']].map(function(t){
          return '<option value="'+t[0]+'"'+(sub.type===t[0]?' selected':'')+'>'+t[1]+'</option>';
        }).join('');
        var tbg=hasSub?'var(--blue)':'#cbd5e1';
        var tleft=hasSub?'21px':'3px';

        h+='<div style="background:#fff;border:1px solid var(--border);border-radius:9px;padding:10px;margin-bottom:8px">';

        // عنوان الخيار + حذف
        h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          +'<span style="color:#0369a1;font-size:14px;flex-shrink:0">◉</span>'
          +'<input id="opt_'+ci+'_'+fi+'_'+oi+'" placeholder="نص الخيار" value="'+ol.replace(/"/g,'&quot;')+'" '
          +'style="flex:1;padding:8px 11px;border:1.5px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:13px;outline:none">'
          +'<button class="ib id" style="width:28px;height:28px;flex-shrink:0" onclick="delOption('+ci+','+fi+','+oi+')" title="حذف الخيار">✕</button>'
          +'</div>';

        // مفتاح حقل التوضيح
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#f8fafd;border-radius:7px'+(hasSub?';margin-bottom:10px':'')+'">'
          +'<span style="font-size:12px;color:var(--mid);font-weight:600">إظهار حقل توضيحي عند اختياره</span>'
          +'<button id="subtog_'+ci+'_'+fi+'_'+oi+'" class="tog" onclick="toggleOptSub('+ci+','+fi+','+oi+',this)" style="background:'+tbg+'" data-v="'+(hasSub?'1':'0')+'">'
          +'<div class="tok" style="left:'+tleft+'"></div></button>'
          +'</div>';

        // لوحة الحقل التوضيحي
        h+='<div id="sub_'+ci+'_'+fi+'_'+oi+'" style="display:'+(hasSub?'block':'none')+';background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:10px;margin-right:18px;border-right:3px solid #f59e0b">'
          +'<div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:8px">↳ الحقل التوضيحي</div>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
          +'<div>'
          +'<label style="'+labelStyle+';color:#92400e">النوع</label>'
          +'<select id="subtype_'+ci+'_'+fi+'_'+oi+'" style="width:100%;padding:6px 9px;border:1.5px solid #fde68a;border-radius:6px;font-family:Cairo,sans-serif;font-size:12px;background:#fff;outline:none">'+subTypes+'</select>'
          +'</div>'
          +'<div>'
          +'<label style="'+labelStyle+';color:#92400e">إلزامي؟</label>'
          +'<label style="display:flex;align-items:center;gap:6px;padding:5px 0;font-size:12px;cursor:pointer;font-weight:600;color:#92400e">'
          +'<input id="subrq_'+ci+'_'+fi+'_'+oi+'" type="checkbox"'+(sub.required?' checked':'')+' style="width:14px;height:14px;accent-color:#f59e0b"> نعم</label>'
          +'</div>'
          +'</div>'
          +'<div style="margin-bottom:8px">'
          +'<label style="'+labelStyle+';color:#92400e">عنوان الحقل</label>'
          +'<input id="sublbl_'+ci+'_'+fi+'_'+oi+'" placeholder="مثلاً: كم القراءة؟" value="'+(sub.label||'').replace(/"/g,'&quot;')+'" '
          +'style="width:100%;padding:7px 11px;border:1.5px solid #fde68a;border-radius:6px;font-family:Cairo,sans-serif;font-size:12px;outline:none;background:#fff;box-sizing:border-box">'
          +'</div>'
          +'<div>'
          +'<label style="'+labelStyle+';color:#92400e">نص توضيحي (Placeholder)</label>'
          +'<input id="subph_'+ci+'_'+fi+'_'+oi+'" placeholder="مثلاً: اكتب القيمة…" value="'+(sub.placeholder||'').replace(/"/g,'&quot;')+'" '
          +'style="width:100%;padding:7px 11px;border:1.5px solid #fde68a;border-radius:6px;font-family:Cairo,sans-serif;font-size:12px;outline:none;background:#fff;box-sizing:border-box">'
          +'</div>'
          +'</div>'; // sub panel

        h+='</div>'; // option card
      });

      h+='</div>'; // options wrap
    }

    h+='</div>'; // fr
    return h;
  }).join('');
}

function onFldTypeChange(ci,fi,type){
  saveCurrentInputs();
  var f=BC[ci].fields[fi];
  f.field_type=type;
  var hasOpts=['select','radio','checkbox'].includes(type);
  if(hasOpts&&(!f.options||!f.options.length)){
    f.options=[
      {label:'نعم',has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}},
      {label:'لا', has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}}
    ];
  }
  rCats();
}

function addField(ci){
  if(!BC[ci])return;
  saveCurrentInputs();
  BC[ci].fields.push({
    id:null,label:'',field_type:'text',required:0,
    placeholder:'',conditional_field:'',conditional_value:'',options:[]
  });
  BC[ci].open=true;
  rCats();

  setTimeout(function(){
    var c=$g('cats-wrap');
    if(c)c.querySelector('#flds_'+ci+' .fr:last-child')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function delField(ci,fi){
  saveCurrentInputs();
  if(BC[ci]&&BC[ci].fields)BC[ci].fields.splice(fi,1);
  rCats();
}

function addCat(){
  saveCurrentInputs();
  BC.push({name:'تصنيف جديد',open:true,fields:[]});
  rCats();
  setTimeout(function(){
    var c=$g('cats-wrap');
    if(c&&c.lastElementChild)c.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function delCat(ci){
  saveCurrentInputs();
  BC.splice(ci,1);
  rCats();
}

function toggleCat(ci){
  saveCurrentInputs();
  if(BC[ci])BC[ci].open=!BC[ci].open;
  rCats();
}

function saveCurrentInputs(){
  // حفظ قيم الحقول الحالية في BC قبل إعادة الرسم
  BC.forEach(function(cat,ci){
    cat.fields.forEach(function(f,fi){
      var lbl=$g('lbl_'+ci+'_'+fi);if(lbl)f.label=lbl.value;
      var ph=$g('ph_'+ci+'_'+fi);if(ph)f.placeholder=ph.value;
      var tp=$g('tp_'+ci+'_'+fi);if(tp)f.field_type=tp.value;
      var rq=$g('rq_'+ci+'_'+fi);if(rq)f.required=rq.checked?1:0;
      var cf=$g('cf_'+ci+'_'+fi);if(cf)f.conditional_field=cf.value;
      var cv=$g('cv_'+ci+'_'+fi);if(cv)f.conditional_value=cv.value;
      // حفظ الخيارات (طبّع الـ option إلى كائن مع sub قبل القراءة)
      var rawOpts=normalizeOptions(f.options);
      if(rawOpts.length){
        f.options=rawOpts.map(function(opt,oi){
          // طبّع: لو string يصير {label}، ولو ناقص sub نضيفه
          var normalized=typeof opt==='object'&&opt!==null
            ?{label:opt.label||'',has_sub:opt.has_sub===true||opt.has_sub===1,sub:opt.sub||{type:'text',label:'',placeholder:'',required:false}}
            :{label:String(opt||''),has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}};
          var ol=$g('opt_'+ci+'_'+fi+'_'+oi);if(ol)normalized.label=ol.value;
          var sl=$g('sublbl_'+ci+'_'+fi+'_'+oi);if(sl)normalized.sub.label=sl.value;
          var sp=$g('subph_'+ci+'_'+fi+'_'+oi);if(sp)normalized.sub.placeholder=sp.value;
          var st=$g('subtype_'+ci+'_'+fi+'_'+oi);if(st)normalized.sub.type=st.value;
          var sr=$g('subrq_'+ci+'_'+fi+'_'+oi);if(sr)normalized.sub.required=sr.checked;
          return normalized;
        });
      } else {
        f.options=[];
      }
    });
  });
}

// أزرار صفّ الحقل / صفّ الخيار تستخدم onclick مباشر في HTML — ما نحتاج ربط بعد إعادة الرسم.
function attachFldEvents(){ /* no-op: handlers attached inline via onclick */ }

// ─── ترتيب الحقول: سحب وإفلات + أزرار ▲▼ كاحتياط للجوال ──────────
var _fldDrag=null;
window.fldDragStart=function(e, ci, fi){
  _fldDrag={ci:ci, fi:fi};
  try{
    e.dataTransfer.effectAllowed='move';
    // استخدم الكرت الكامل كصورة للسحب
    var card=document.getElementById('fr_'+ci+'_'+fi);
    if(card && e.dataTransfer.setDragImage){
      e.dataTransfer.setDragImage(card, 20, 20);
    }
  }catch(err){}
};
window.fldDragOver=function(e){
  if(!_fldDrag) return;
  e.preventDefault();
  try{ e.dataTransfer.dropEffect='move'; }catch(err){}
  var card=e.currentTarget;
  if(card && card.classList && card.classList.contains('fr')){
    card.style.borderColor='var(--blue)';
    card.style.background='#f0f6ff';
  }
};
window.fldDragLeave=function(e){
  var card=e.currentTarget;
  if(card){ card.style.borderColor=''; card.style.background='#fff'; }
};
window.fldDrop=function(e, ci, fi){
  e.preventDefault();
  var card=e.currentTarget;
  if(card){ card.style.borderColor=''; card.style.background='#fff'; }
  if(!_fldDrag) return;
  if(_fldDrag.ci!==ci){ _fldDrag=null; return; } // داخل نفس التصنيف فقط
  if(_fldDrag.fi===fi){ _fldDrag=null; return; }
  try{ saveCurrentInputs(); }catch(err){}
  var fields=BC[ci].fields;
  var moved=fields.splice(_fldDrag.fi, 1)[0];
  fields.splice(fi, 0, moved);
  _fldDrag=null;
  rCats();
  try{ scheduleAutoSave(); }catch(err){}
};
window.fldDragEnd=function(){
  _fldDrag=null;
  document.querySelectorAll('.fr').forEach(function(card){
    card.style.borderColor=''; card.style.background='#fff';
  });
};

// زر ▲▼ — يعمل على الجوال حيث HTML5 drag-and-drop غير مدعوم
window.moveFld=function(ci, fi, dir){
  if(!BC[ci] || !BC[ci].fields) return;
  var newFi=fi+dir;
  if(newFi<0 || newFi>=BC[ci].fields.length) return;
  try{ saveCurrentInputs(); }catch(err){}
  var fields=BC[ci].fields;
  var tmp=fields[fi];
  fields[fi]=fields[newFi];
  fields[newFi]=tmp;
  rCats();
  try{ scheduleAutoSave(); }catch(err){}
};

window.confirmDelField=function(ci,fi){
  oConfirm('حذف هذا الحقل؟ لا يمكن التراجع.',function(){delField(ci,fi);},{icon:'🗑️',yes:'حذف',no:'إلغاء',danger:true});
};

window.addOption=function(ci,fi){
  if(!BC[ci]||!BC[ci].fields[fi]){return;}
  try{saveCurrentInputs();}catch(e){console.error('[addOption] saveCurrentInputs:',e);}
  if(!BC[ci].fields[fi].options)BC[ci].fields[fi].options=[];
  BC[ci].fields[fi].options.push({label:'خيار جديد',has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}});
  rCats();
};

window.delOption=function(ci,fi,oi){
  oConfirm('حذف هذا الخيار؟',function(){
    if(!BC[ci]||!BC[ci].fields[fi]||!BC[ci].fields[fi].options)return;
    try{saveCurrentInputs();}catch(e){console.error('[delOption] saveCurrentInputs:',e);}
    BC[ci].fields[fi].options.splice(oi,1);
    rCats();
  },{icon:'🗑️',yes:'حذف',no:'إلغاء',danger:true});
};

window.toggleOptSub=function(ci,fi,oi,btn){
  var nv=btn.dataset.v==='1'?false:true;
  btn.dataset.v=nv?'1':'0';
  btn.style.background=nv?'var(--blue)':'#cbd5e1';
  var tok=btn.querySelector('.tok');
  if(tok)tok.style.left=nv?'21px':'3px';
  var subBox=document.getElementById('sub_'+ci+'_'+fi+'_'+oi);
  if(subBox)subBox.style.display=nv?'block':'none';
  if(BC[ci]&&BC[ci].fields[fi]&&BC[ci].fields[fi].options[oi]){
    BC[ci].fields[fi].options[oi].has_sub=nv;
  }
};

// طبّع f.options إلى array دائماً — قد تأتي string (JSON غير مفكوك) أو null.
function normalizeOptions(raw){
  if(Array.isArray(raw))return raw;
  if(typeof raw==='string'&&raw.trim()){
    try{var p=JSON.parse(raw);if(Array.isArray(p))return p;}catch(e){}
  }
  return [];
}

function readOptsFromDOM(ci,fi,f){
  var ft=$g('tp_'+ci+'_'+fi)?.value||f.field_type;
  if(!['select','radio','checkbox'].includes(ft))return null;
  var opts=normalizeOptions(f.options);
  return opts.map(function(opt,oi){
    var o=typeof opt==='object'&&opt!==null?opt:{label:String(opt||'')};
    return {
      label:$g('opt_'+ci+'_'+fi+'_'+oi)?.value||o.label||'',
      has_sub:$g('subtog_'+ci+'_'+fi+'_'+oi)?.dataset.v==='1'||false,
      sub:{
        type:$g('subtype_'+ci+'_'+fi+'_'+oi)?.value||(o.sub&&o.sub.type)||'text',
        label:$g('sublbl_'+ci+'_'+fi+'_'+oi)?.value||(o.sub&&o.sub.label)||'',
        placeholder:$g('subph_'+ci+'_'+fi+'_'+oi)?.value||(o.sub&&o.sub.placeholder)||'',
        required:$g('subrq_'+ci+'_'+fi+'_'+oi)?.checked||false
      }
    };
  });
}

// svBld احتفظ به للتوافق الخلفي لأي مكان قد ينادي svBld — يحفظ مباشرة بدون انتظار debounce.
window.svBld=async function(){
  clearTimeout(_autoSaveTimer);
  await window.autoSaveForm();
};

async function previewForm(fid){
  ld(1);var r=await api('GET','forms/'+fid);ld(0);
  if(r.error){toast(r.error,'er');return;}
  var fields=r.fields||[];
  var cats=[...new Set(fields.map(function(f){return f.category||'عام';}))];

  var INP='width:100%;padding:7px 11px;border:1px solid #e2e8f0;border-radius:9px;font-family:Cairo,sans-serif;font-size:15px;font-weight:600;line-height:22px;outline:none;background:#fff;color:#0f172a;transition:border .15s;box-sizing:border-box';

  var body='';

  // شارة معاينة + رجوع
  body+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  body+='<button class="btn bs bsm" onclick="gT(\'forms\')">← رجوع</button>';
  body+='<div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600">👁️ معاينة — لن تُحفظ البيانات</div>';
  body+='</div>';

  // كرت العنوان البطل (نفس تصميم المراجع)
  body+='<div style="background:linear-gradient(135deg,#075e54 0%,#128c7e 100%);color:#fff;border-radius:16px;padding:18px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(7,94,84,.22)">';
  body+='<div style="display:flex;align-items:center;gap:12px">';
  body+='<div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📋</div>';
  body+='<div style="flex:1;min-width:0">';
  body+='<div style="font-size:16px;font-weight:800;line-height:1.3">'+htmlEsc(r.title||'')+'</div>';
  if(r.subtitle) body+='<div style="font-size:12px;opacity:.85;margin-top:2px">'+htmlEsc(r.subtitle)+'</div>';
  body+='</div></div></div>';

  cats.forEach(function(cat,catIdx){
    var catFields=fields.filter(function(f){return (f.category||'عام')===cat;});
    body+='<div style="background:#fff;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px 6px;margin-bottom:10px;box-shadow:0 1px 2px rgba(15,23,42,.04)">';
    body+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;padding-bottom:7px;border-bottom:1px solid #f1f5f9">';
    body+='<div style="width:20px;height:20px;border-radius:50%;background:#dcf8c6;color:#075e54;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">'+(catIdx+1)+'</div>';
    body+='<div style="font-weight:700;font-size:13px;color:#1e293b">'+htmlEsc(cat)+'</div>';
    body+='<div style="margin-right:auto;font-size:10.5px;color:#94a3b8">'+catFields.length+' حقل</div>';
    body+='</div>';

    catFields.forEach(function(f,fIdx){
      var id='pv_'+f.id;
      var opts=normalizeOptions(f.options);
      function getLabel(o){return typeof o==='object'&&o!==null?(o.label||''):String(o);}
      var isLast=fIdx===catFields.length-1;

      body+='<div style="padding:7px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+'">';
      body+='<label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;color:#334155">'+htmlEsc(f.label||'')+(f.required?'<span style="color:#ef4444;margin-right:3px"> *</span>':'')+'</label>';

      if(f.field_type==='textarea'){
        body+='<textarea id="'+id+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+';height:72px;resize:none"></textarea>';
      } else if(f.field_type==='select'){
        body+='<div style="position:relative">';
        body+='<select id="'+id+'" data-pvfid="'+f.id+'" onchange="pvHandleSelect(this)" style="'+INP+';-webkit-appearance:none;padding-left:30px;cursor:pointer">';
        body+='<option value="">— اختر —</option>';
        opts.forEach(function(o){var ol=getLabel(o);body+='<option value="'+ol+'">'+ol+'</option>';});
        body+='</select>';
        body+='<span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#94a3b8;font-size:11px">▾</span></div>';
        body+='<div id="pvsub_'+id+'"></div>';
      } else if(f.field_type==='radio'){
        body+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='pvrsub_'+id+'_'+oi;
          var wrapId='pvwrap_'+id+'_'+oi;
          body+='<div id="'+wrapId+'">';
          body+='<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:14px;font-weight:600;color:#0f172a">'
            +'<input type="radio" name="'+id+'" value="'+ol+'" style="accent-color:#075e54;width:16px;height:16px;flex-shrink:0"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="pvRadioChange(this)"> '+htmlEsc(ol)+'</label>';
          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            body+='<div id="'+subId+'" style="display:none;margin:6px 22px 0 0;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">';
            body+='<label style="display:block;font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">↳ '+htmlEsc(sub.label)+(sub.required?'<span style="color:#ef4444"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              body+='<textarea placeholder="'+(sub.placeholder||'')+'" style="'+INP+';height:58px;resize:none"></textarea>';
            } else {
              body+='<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+'">';
            }
            body+='</div>';
          }
          body+='</div>';
        });
        body+='</div>';
      } else if(f.field_type==='checkbox'){
        body+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='pvcsub_'+id+'_'+oi;
          var wrapId='pvcwrap_'+id+'_'+oi;
          body+='<div id="'+wrapId+'">';
          body+='<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;font-size:14px;font-weight:600;color:#0f172a">'
            +'<input type="checkbox" value="'+ol+'" id="'+id+'_cb_'+oi+'" style="accent-color:#075e54;width:16px;height:16px;flex-shrink:0"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="pvCheckChange(this)"> '+htmlEsc(ol)+'</label>';
          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            body+='<div id="'+subId+'" style="display:none;margin:6px 22px 0 0;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">';
            body+='<label style="display:block;font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">↳ '+htmlEsc(sub.label)+(sub.required?'<span style="color:#ef4444"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              body+='<textarea placeholder="'+(sub.placeholder||'')+'" style="'+INP+';height:58px;resize:none"></textarea>';
            } else {
              body+='<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+'">';
            }
            body+='</div>';
          }
          body+='</div>';
        });
        body+='</div>';
      } else if(f.field_type==='date'){
        body+='<input type="date" id="'+id+'" style="'+INP+'">';
      } else if(f.field_type==='number'){
        body+='<input type="number" id="'+id+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      } else if(f.field_type==='phone'){
        body+='<input type="tel" id="'+id+'" placeholder="'+(f.placeholder||'+966...')+'" style="'+INP+'">';
      } else {
        body+='<input type="text" id="'+id+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      }
      body+='</div>';
    });
    body+='</div>';
  });

  $h('pg',body);
}

function pvSubFromEl(el){
  var fldId=el.dataset.pvid;
  var opts=JSON.parse(decodeURIComponent(el.dataset.pvopts||'[]'));
  pvApplySub(fldId,opts,el.value);
}

function pvApplySub(fldId,opts,selectedVal){
  var subWrap=document.getElementById('pvsub_'+fldId);
  if(!subWrap)return;
  subWrap.innerHTML='';
  var selVals=selectedVal?[selectedVal]:[];
  if(!selVals.length){
    var ch=document.querySelector('[name="'+fldId+'"]:checked');
    if(ch)selVals=[ch.value];
    var sel=document.getElementById(fldId);
    if(sel&&sel.value)selVals=[sel.value];
  }
  opts.forEach(function(opt,oi){
    var ol=typeof opt==='object'?opt.label:opt;
    var sub=typeof opt==='object'?opt.sub:null;
    if(!selVals.includes(ol)||!sub||!opt.has_sub||!sub.label)return;
    var BASE='width:100%;padding:9px 12px;border:1.5px solid var(--blue);border-radius:9px;font-family:Cairo,sans-serif;font-size:14px;outline:none;margin-top:6px';
    var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
    subWrap.innerHTML+='<div style="background:#f0f6ff;border-radius:9px;padding:10px;border:1px solid #bfdbfe;margin-top:6px">'
      +'<label style="font-size:12px;font-weight:700;color:var(--blue2)">↳ '+sub.label+'</label>'
      +(sub.type==='textarea'?'<textarea placeholder="'+(sub.placeholder||'')+'" style="'+BASE+';height:70px;resize:none"></textarea>'
        :'<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+BASE+'">')
      +'</div>';
  });
}

function pvRadioChange(inp){
  var name=inp.name;

  document.querySelectorAll('[name="'+name+'"]').forEach(function(r){
    if(r.dataset.subid){
      var box=document.getElementById(r.dataset.subid);
      if(box)box.style.display='none';
    }
    if(r.dataset.wrapid){
      var w=document.getElementById(r.dataset.wrapid);
      if(w)w.classList.remove('has-sub-open');
    }
  });

  if(inp.checked&&inp.dataset.hassub==='1'&&inp.dataset.subid){
    var myBox=document.getElementById(inp.dataset.subid);
    if(myBox){
      myBox.style.display='block';
      var fi=myBox.querySelector('input,textarea');
      if(fi)setTimeout(function(){fi.focus();},80);
    }
    if(inp.dataset.wrapid){
      var w2=document.getElementById(inp.dataset.wrapid);
      if(w2)w2.classList.add('has-sub-open');
    }
  }
}

function pvCheckChange(chk){
  if(chk.dataset.subid){
    var box=document.getElementById(chk.dataset.subid);
    if(box)box.style.display=chk.checked?'block':'none';
  }
  if(chk.dataset.wrapid){
    var w=document.getElementById(chk.dataset.wrapid);
    if(w)w.classList.toggle('has-sub-open',chk.checked);
  }
}

function pvHandleRadio(inp){pvRadioChange(inp);}

function pvHandleSelect(sel){
  pvShowSub(sel.dataset.pvfid, sel.value, 'pvsub_'+sel.id);
}

function pvShowSub(fieldDbId, selectedVal, subWrapId){
  var subWrap=document.getElementById(subWrapId);
  if(!subWrap)return;
  subWrap.innerHTML='';
  if(!selectedVal)return;

  var fields=window._pvFields||[];
  var f=fields.find(function(x){return String(x.id)===String(fieldDbId);});
  if(!f||!f.options)return;

  var opts=f.options;
  opts.forEach(function(opt){
    if(typeof opt!=='object'||!opt.has_sub)return;
    var ol=opt.label||'';
    if(ol!==selectedVal)return;
    var sub=opt.sub||{};
    if(!sub.label)return;
    var INP2='width:100%;padding:10px 12px;border:1.5px solid var(--blue);border-radius:9px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fff;margin-top:6px';
    var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
    subWrap.innerHTML='<div class="pv-opt-sub">'
      +'<label style="display:block;font-size:12px;font-weight:700;color:var(--blue2);margin-bottom:5px">↳ '+sub.label+(sub.required?'<span style="color:var(--red)"> *</span>':'')+'</label>'
      +(sub.type==='textarea'
        ?'<textarea placeholder="'+(sub.placeholder||'')+'" style="'+INP2+';height:70px;resize:none"></textarea>'
        :'<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP2+'">')
      +'</div>';
  });
}

function nomFormModal(fid){
  const revs=D.rev.filter(r=>r.role==='reviewer');
  oM('ترشيح استمارة',
    '<div style="margin-bottom:10px;font-size:13px;color:var(--mid)">اختر المراجع لترشيح الاستمارة له</div>'
    +revs.map(r=>'<div class="list-item" style="margin-bottom:6px;padding:10px 14px">'
      +'<div style="flex:1"><div style="font-weight:700">'+r.name+'</div><div class="ps">@'+r.username+'</div></div>'
      +'<button class="btn bp bsm" onclick="assignForm('+fid+','+r.id+')">ترشيح</button>'
      +'</div>').join('')
    +(revs.length?'':'<div class="empty-state">لا يوجد مراجعون</div>')
    +'<button class="btn bs" onclick="cM()" style="width:100%;margin-top:10px">إغلاق</button>');
}

async function assignForm(fid,uid){
  await api('POST','assignments',{form_id:fid,user_id:uid});
  toast('تم الترشيح ✅');
}

