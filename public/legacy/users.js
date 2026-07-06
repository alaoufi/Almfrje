/* users.js */
function pRev(){
  var revs=D.rev||[];
  var canAdd = typeof hasAdminPerm !== 'function' || hasAdminPerm('users');
  var h='<div class="ph"><div><div class="pt">👥 المراجعون</div></div>'
    +(canAdd?'<button class="btn bp" onclick="oAddRev()">+ إضافة</button>':'')+'</div>';

  h+='<div style="position:relative;margin-bottom:12px">'
    +'<input id="rev-search" class="fr-inp" placeholder="🔍 بحث بالاسم أو الجوال..." oninput="filterRevs()" style="padding-right:36px">'
    +'</div>';

  h+='<div class="fields-wrap" id="revs-list">';
  if(!revs.length){
    h+='<div style="text-align:center;padding:40px;color:var(--light)">لا يوجد مراجعون</div>';
  } else {
    revs.forEach(function(r,i){ h+=_revRow(r,i); });
  }
  h+='</div>';
  $h('pg',h);
  setTimeout(_bindRevMenus,50);
}

function _revRow(r,i){
  var initial=(r.name||'م').charAt(0);
  var roleLbl=r.role==='admin'?'مدير':'مراجع';
  var roleBg=r.role==='admin'?'var(--blue-bg)':'#f1f5f9';
  var roleClr=r.role==='admin'?'var(--blue)':'var(--mid)';
  var h='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;'+(i>0?'border-top:1px solid var(--border)':'')+';background:'+(i%2===0?'#fff':'#fafbff')+'">';
  h+='<div style="width:38px;height:38px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex-shrink:0">'+initial+'</div>';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-weight:700;font-size:14px">'+htmlEsc(r.name||'')+'</div>';
  h+='<div style="font-size:12px;color:var(--mid)">@'+(r.username||'')+'  •  '+(r.phone||'')+'</div>';
  h+='<div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap">';
  h+='<span style="background:'+roleBg+';color:'+roleClr+';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">'+roleLbl+'</span>';
  if(+r.allowed_special) h+='<span style="background:#fef3c7;color:#92400e;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">🔑 خاص</span>';
  if(+r.allow_chat===0)  h+='<span style="background:#e2e8f0;color:#475569;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">🔇 لا محادثات</span>';
  if(r.status==='banned') h+='<span style="background:#fee2e2;color:#dc2626;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">محظور</span>';
  h+='</div></div>';
  h+='<div><button class="ib" style="width:32px;height:32px;border:1.5px solid var(--border);background:#f8fafd" data-rev-menu="'+r.id+'">⋯</button></div>';
  h+='</div>';
  return h;
}

function _bindRevMenus(){
  var canUsers  = typeof hasAdminPerm !== 'function' || hasAdminPerm('users');
  var canAssign = typeof hasAdminPerm !== 'function' || hasAdminPerm('assign');
  document.querySelectorAll('[data-rev-menu]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var rid=+btn.dataset.revMenu;
      var rv=D.rev.find(function(x){return x.id==rid;});
      if(!rv)return;
      var actions = '<div style="display:flex;flex-direction:column;gap:6px">';
      if(canUsers)  actions += '<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();oEditRev('+rid+')">✏️ تعديل البيانات</button>';
      if(canAssign) actions += '<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();oNomRev('+rid+')">📋 ترشيح استمارة</button>';
      if(canUsers){
        actions += '<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();tRevBan('+rid+',\''+rv.status+'\')">'+(rv.status==='banned'?'✅ رفع الحظر':'🚫 حظر')+'</button>';
        actions += '<button class="btn bd" style="width:100%;justify-content:flex-start" onclick="cM();dRev('+rid+')">🗑️ حذف</button>';
      }
      actions += '</div>';
      oM('إجراءات: '+rv.name, actions);
    });
  });
}

function filterRevs(){
  var q=($g('rev-search')?.value||'').trim().toLowerCase();
  var revs=D.rev||[];
  var filtered=q?revs.filter(function(r){return (r.name||'').toLowerCase().includes(q)||(r.phone||'').includes(q)||(r.username||'').toLowerCase().includes(q);}):revs;
  var list=$g('revs-list');
  if(!list)return;
  if(!filtered.length){
    list.innerHTML='<div style="padding:24px;text-align:center;color:var(--light)">لا نتائج</div>';
    return;
  }
  var h='';
  filtered.forEach(function(r,i){ h+=_revRow(r,i); });
  list.innerHTML=h;
  setTimeout(_bindRevMenus,30);
}

// ─── toggle احترافي: قابل للنقر، يحفظ لحظياً ─────────────────────────
function _userTog(id, active, label, desc, accent){
  var bg=active?accent:'#cbd5e1';
  var lft=active?'21px':'3px';
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:10px;background:#fafbff;border:1px solid #e2e8f0;margin-bottom:8px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-weight:700;font-size:13px;color:#1e293b">'+label+'</div>'
    +'<div style="font-size:11px;color:var(--mid);margin-top:2px">'+desc+'</div>'
    +'</div>'
    +'<button type="button" id="'+id+'" class="tog" data-v="'+(active?'1':'0')+'" data-accent="'+accent+'" style="background:'+bg+';flex-shrink:0;margin-right:10px" '
    +'onclick="_togFlipUser(this)">'
    +'<div class="tok" style="left:'+lft+'"></div></button>'
    +'</div>';
}

window._togFlipUser=function(btn){
  var nv = btn.dataset.v==='1' ? '0' : '1';
  btn.dataset.v=nv;
  btn.style.background = nv==='1' ? (btn.dataset.accent||'var(--blue)') : '#cbd5e1';
  var tok=btn.querySelector('.tok');
  if(tok) tok.style.left = nv==='1' ? '21px' : '3px';
  // عند تشغيل «مشرف عام»: عطّل بقية الصلاحيات بصريّاً
  if(btn.id==='pm-super'){ _syncPermsSuper(); }
};

function _readTog(id){ var el=document.getElementById(id); return el && el.dataset.v==='1' ? 1 : 0; }

// ─── صندوق صلاحيات المدير ────────────────────────────────────────────
// permsRaw: نص JSON كـ '["users","appts"]'، أو فارغ/null = مشرف عام.
function _parsePerms(permsRaw){
  if(!permsRaw) return ['super'];
  try{
    var arr = JSON.parse(permsRaw);
    if(Array.isArray(arr) && arr.length) return arr;
  }catch(e){}
  return ['super'];
}

function _adminPermsBox(permsRaw){
  var perms = _parsePerms(permsRaw);
  function has(k){ return perms.indexOf(k)>=0; }
  var sup = has('super');
  return '<div id="adm-perms-box" style="background:#fef3c7;border:1.5px solid #fbbf24;border-right:5px solid #f59e0b;border-radius:12px;padding:12px;margin-top:10px">'
    +'<div style="font-weight:800;font-size:13px;color:#92400e;margin-bottom:4px">🛡️ صلاحيات المدير</div>'
    +'<div style="font-size:11px;color:#78350f;margin-bottom:10px">حدّد ما يستطيع هذا المدير الوصول إليه</div>'
    + _userTog('pm-super',        sup,                      '👑 مشرف عام',         'كل الصلاحيات بلا قيود',                  '#f59e0b')
    + _userTog('pm-users',        sup||has('users'),        '👥 إدارة المراجعين',  'إضافة وتعديل وحذف المراجعين',            '#3b82f6')
    + _userTog('pm-appts',        sup||has('appts'),        '📅 المواعيد',         'إضافة مواعيد وحجز استثنائي',             '#10b981')
    + _userTog('pm-assign',       sup||has('assign'),       '📋 ترشيح الاستمارات', 'ترشيح استمارات للمراجعين',               '#a855f7')
    + _userTog('pm-sections',     sup||has('sections'),     '📂 الأقسام والاستمارات', 'إنشاء وتعديل الأقسام والاستمارات',     '#0ea5e9')
    + _userTog('pm-reports',      sup||has('reports'),      '📁 التقارير',         'إدارة تقارير المراجعين والتعليقات',      '#ef4444')
    + _userTog('pm-chats',        sup||has('chats'),        '💬 المحادثات',        'الوصول لمحادثات المراجعين والرد عليها',  '#22c55e')
    + _userTog('pm-publications', sup||has('publications'), '📰 إضافة النشرات',    'إنشاء وتعديل وحذف النشرات',              '#6366f1')
    + _userTog('pm-archive',      sup||has('archive'),      '🗄️ الأرشيف',           'الاطلاع على الأرشيف',                    '#64748b')
    + _userTog('pm-location',     sup||has('location'),     '📍 إرسال الموقع',      'إرسال موقع المكان للمراجع في المحادثة',  '#dc2626')
    + _userTog('pm-settings',     sup||has('settings'),     '⚙️ الإعدادات',          'تعديل إعدادات الموقع',                   '#475569')
    +'</div>';
}

// لو «مشرف عام» مُشغّل: اظهر الباقي مُعطَّل لكن مُضيء (إشارة أن كلها تابعة)
function _syncPermsSuper(){
  var sup = _readTog('pm-super')===1;
  ['pm-users','pm-appts','pm-assign','pm-sections','pm-reports','pm-chats','pm-publications','pm-archive','pm-location','pm-settings'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.opacity = sup ? '0.55' : '1';
    el.style.pointerEvents = sup ? 'none' : 'auto';
  });
}

// اقرأ التشغيلات وأَرجِع نص JSON. لو مشرف عام = ["super"].
function _readAdminPerms(){
  if(_readTog('pm-super')===1) return JSON.stringify(['super']);
  var out = [];
  if(_readTog('pm-users')===1)        out.push('users');
  if(_readTog('pm-appts')===1)        out.push('appts');
  if(_readTog('pm-assign')===1)       out.push('assign');
  if(_readTog('pm-sections')===1)     out.push('sections');
  if(_readTog('pm-reports')===1)      out.push('reports');
  if(_readTog('pm-chats')===1)        out.push('chats');
  if(_readTog('pm-publications')===1) out.push('publications');
  if(_readTog('pm-archive')===1)      out.push('archive');
  if(_readTog('pm-location')===1)     out.push('location');
  if(_readTog('pm-settings')===1)     out.push('settings');
  // لا تترك المدير بلا أي صلاحية — افتراض ضمني = مشرف عام
  if(!out.length) return JSON.stringify(['super']);
  return JSON.stringify(out);
}

// إظهار/إخفاء صندوق الصلاحيات حسب القائمة المختارة (مدير/مراجع)
window._rvRoleChange = function(){
  var rl = $g('rv-rl');
  var box = $g('adm-perms-box');
  var invBox = $g('rv-inv-box');
  if(!rl) return;
  var isAdmin = rl.value === 'admin';
  var isInviter = rl.value === 'inviter';
  if(box) box.style.display = isAdmin ? '' : 'none';
  // صندوق إعدادات الدعوات يظهر فقط لدور "دعوات"
  if(invBox) invBox.style.display = isInviter ? '' : 'none';
};

// لتحقّق الصلاحية من جانب الواجهة (للمستخدم الحالي U)
window.hasAdminPerm = function(key){
  try{
    if(!U) return false;
    if(U.role !== 'admin') return false;
    if(!U.admin_perms) return true; // NULL = مشرف عام
    var arr = JSON.parse(U.admin_perms);
    if(!Array.isArray(arr)) return true;
    return arr.indexOf('super')>=0 || arr.indexOf(key)>=0;
  }catch(e){ return true; }
};

function oAddRev(){
  oM('إضافة مستخدم',
    '<div class="f"><label>الاسم *</label><input id="rv-nm" class="fr-inp" placeholder="الاسم الكامل"></div>'
    +'<div class="f"><label>اسم المستخدم *</label><input id="rv-un" class="fr-inp" placeholder="username"></div>'
    +'<div class="f"><label>الجوال *</label><input id="rv-ph" class="fr-inp" type="tel" placeholder="+966..."></div>'
    +'<div class="f"><label>كلمة المرور (فارغ = تلقائي)</label><input id="rv-pw" class="fr-inp" type="password"></div>'
    +'<div class="f"><label>الصلاحية</label>'
    +'<select id="rv-rl" class="fr-inp" onchange="_rvRoleChange()">'
    +'<option value="reviewer" selected>مراجع</option>'
    +'<option value="admin">مدير</option>'
    +'</select></div>'
    + _userTog('rv-sp',   false, '🔑 السماح بالدخول الخاص', 'يدخل حتى لو الموقع مغلق',         '#f59e0b')
    + _userTog('rv-chat', true,  '💬 السماح بالمحادثات',     'يظهر في قائمة المحادثات',          '#22c55e')
    + _adminPermsBox(null)
    +'<div style="display:flex;gap:9px;margin-top:8px">'
    +'<button class="btn bp" onclick="svAddRev()">إنشاء الحساب</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
  setTimeout(function(){ _rvRoleChange(); _syncPermsSuper(); }, 30);
}

function oEditRev(id){
  var rv=D.rev.find(function(x){return x.id==id;});
  if(!rv)return;
  var sp = !!+rv.allowed_special;
  var ch = rv.allow_chat==null || +rv.allow_chat===1;
  oM('تعديل: '+rv.name,
    '<div class="f"><label>الاسم</label><input id="rv-nm" class="fr-inp" value="'+htmlEsc(rv.name||'')+'"></div>'
    +'<div class="f"><label>اسم المستخدم</label><input id="rv-un" class="fr-inp" value="'+htmlEsc(rv.username||'')+'" placeholder="username"></div>'
    +'<div class="f"><label>الجوال</label><input id="rv-ph" class="fr-inp" type="tel" value="'+htmlEsc(rv.phone||'')+'"></div>'
    +'<div class="f"><label>كلمة مرور جديدة</label><input id="rv-pw" class="fr-inp" type="password" placeholder="فارغ = بدون تغيير"></div>'
    +'<div class="f"><label>الصلاحية</label>'
    +'<select id="rv-rl" class="fr-inp" onchange="_rvRoleChange()">'
    +'<option value="reviewer"'+(rv.role==='reviewer'?' selected':'')+'>مراجع</option>'
    +'<option value="inviter"'+(rv.role==='inviter'?' selected':'')+'>📨 دعوات (يدعو ويُشرف على متابعة المدعوّين)</option>'
    +'<option value="admin"'+(rv.role==='admin'?' selected':'')+'>مدير</option>'
    +'</select></div>'
    + _userTog('rv-sp',   sp, '🔑 السماح بالدخول الخاص', 'يدخل حتى لو الموقع مغلق',  '#f59e0b')
    + _userTog('rv-chat', ch, '💬 السماح بالمحادثات',     'يظهر في قائمة المحادثات',   '#22c55e')
    + '<div id="rv-inv-box" style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin:6px 0">'
    +   '<div style="font-weight:800;font-size:13px;color:#92400e;margin-bottom:8px">📨 إعدادات الدعوات</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +     '<div class="f" style="margin:0"><label style="font-size:11.5px">عدد الدعوات</label>'
    +       '<input id="rv-iq" type="number" min="0" class="fr-inp" value="'+(rv.invite_quota||0)+'"></div>'
    +     '<div class="f" style="margin:0"><label style="font-size:11.5px">مدّة كل دعوة (يوم)</label>'
    +       '<input id="rv-id" type="number" min="1" max="60" class="fr-inp" value="'+(rv.invite_days||5)+'"></div>'
    +   '</div>'
    +   '<div style="font-size:10.5px;color:#78350f;margin-top:4px">المستخدم حالياً: '+(rv.invite_used||0)+' من '+(rv.invite_quota||0)+'</div>'
    + '</div>'
    + _adminPermsBox(rv.admin_perms)
    // ─── البيانات الشخصية ───
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px">'
    +'<div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:10px">👤 البيانات الشخصية</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div class="f" style="margin:0"><label>الجنس</label><select id="rv-gender" class="fr-inp"><option value="">—</option><option value="male"'+(rv.gender==='male'?' selected':'')+'>رجل</option><option value="female"'+(rv.gender==='female'?' selected':'')+'>امرأة</option></select></div>'
    +'<div class="f" style="margin:0"><label>العمر</label><input id="rv-age" class="fr-inp" type="number" min="1" value="'+(rv.age||'')+'" placeholder="مثلاً: 30"></div>'
    +'<div class="f" style="margin:0"><label>الطول (سم)</label><input id="rv-height" class="fr-inp" type="number" min="50" value="'+(rv.height||'')+'" placeholder="170"></div>'
    +'<div class="f" style="margin:0"><label>الوزن (كجم)</label><input id="rv-weight" class="fr-inp" type="number" min="20" value="'+(rv.weight||'')+'" placeholder="70"></div>'
    +'</div>'
    +'<div class="f" style="margin:8px 0 0"><label>طبيعة العمل</label><input id="rv-occ" class="fr-inp" value="'+htmlEsc(rv.occupation||'')+'" placeholder="مثلاً: موظف"></div>'
    +'<div class="f" style="margin:8px 0 0"><label>مكان الإقامة</label><input id="rv-res" class="fr-inp" value="'+htmlEsc(rv.residence||'')+'" placeholder="مثلاً: الرياض"></div>'
    +'</div>'
    +'<div style="display:flex;gap:9px;margin-top:12px">'
    +'<button class="btn bp" onclick="svEditRev('+id+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
  setTimeout(function(){ _rvRoleChange(); _syncPermsSuper(); }, 30);
}

async function svAddRev(){
  var nm=($g('rv-nm')?.value||'').trim();
  var un=($g('rv-un')?.value||'').trim();
  var ph=($g('rv-ph')?.value||'').trim();
  var pw=$g('rv-pw')?.value||'';
  var rl=$g('rv-rl')?.value||'reviewer';
  var sp=_readTog('rv-sp');
  var ch=_readTog('rv-chat');
  if(!nm||!un||!ph){toast('أدخل الاسم والمستخدم والجوال','er');return;}
  var body={name:nm,username:un,phone:ph,password:pw,role:rl,allowed_special:sp,allow_chat:ch};
  if(rl==='admin') body.admin_perms = _readAdminPerms();
  if(rl==='inviter'){
    var iqA=$g('rv-iq'); if(iqA && iqA.value!=='') body.invite_quota=Math.max(0,+iqA.value||0);
    var idA=$g('rv-id'); if(idA && idA.value!=='') body.invite_days=Math.max(1,+idA.value||5);
  }
  ld(1);var r=await api('POST','users',body);ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  if(r&&r.generated_password) oAlert('✅ تم إنشاء الحساب\n\nكلمة المرور: '+r.generated_password+'\n\nاحفظها — لن تظهر مرة أخرى!',{icon:'🔑'});
  else toast('تم إنشاء الحساب ✅');
  cM();await lRev();pRev();
}

async function svEditRev(id){
  var nm=($g('rv-nm')?.value||'').trim();
  var un=($g('rv-un')?.value||'').trim();
  var ph=($g('rv-ph')?.value||'').trim();
  var pw=$g('rv-pw')?.value||'';
  var rl=$g('rv-rl')?.value||'reviewer';
  var sp=_readTog('rv-sp');
  var ch=_readTog('rv-chat');
  var b={name:nm,phone:ph,role:rl,allowed_special:sp,allow_chat:ch};
  if(un)b.username=un;
  if(pw)b.password=pw;
  if(rl==='admin') b.admin_perms = _readAdminPerms();
  var iq=$g('rv-iq');         if(iq && iq.value!=='') b.invite_quota=Math.max(0,+iq.value||0);
  var idE=$g('rv-id');        if(idE && idE.value!=='') b.invite_days=Math.max(1,+idE.value||5);
  // البيانات الشخصية (نُرسلها فقط لو كانت موجودة في النافذة الحالية)
  var g=$g('rv-gender');     if(g) b.gender=g.value||'';
  var age=$g('rv-age');      if(age && age.value!=='') b.age=+age.value;
  var hgt=$g('rv-height');   if(hgt && hgt.value!=='') b.height=+hgt.value;
  var wgt=$g('rv-weight');   if(wgt && wgt.value!=='') b.weight=+wgt.value;
  var occ=$g('rv-occ');      if(occ) b.occupation=(occ.value||'').trim();
  var res=$g('rv-res');      if(res) b.residence=(res.value||'').trim();
  ld(1);var r=await api('PUT','users/'+id,b);ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  toast('✅ تم حفظ التعديلات');
  cM();await lRev();pRev();
}

async function tRevBan(id,status){
  ld(1);await api('PUT','users/'+id,{status:status==='banned'?'active':'banned'});ld(0);
  toast('تم');await lRev();pRev();
}

async function dRev(id){
  if(!confirmDel('حذف المراجع؟'))return;
  ld(1);await api('DELETE','users/'+id);ld(0);
  toast('تم الحذف');await lRev();pRev();
}

function oNomRev(uid){
  var actFrms=D.frm.filter(function(f){return f.status==='active';});
  var h=actFrms.length
    ?actFrms.map(function(f){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">'
      +'<div><div style="font-weight:700">'+htmlEsc(f.title||'')+'</div><div class="ps">'+(f.section_name||'—')+'</div></div>'
      +'<button class="btn bp bsm" onclick="doNom('+f.id+','+uid+')">ترشيح</button></div>';}).join('')
    :'<div style="text-align:center;padding:24px;color:var(--light)">لا توجد استمارات منشورة</div>';
  oM('ترشيح استمارة',h+'<button class="btn bs" style="width:100%;margin-top:12px" onclick="cM()">إغلاق</button>');
}

async function doNom(fid,uid){
  ld(1);var r=await api('POST','assignments',{form_id:fid,user_id:uid});ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  toast('تم الترشيح ✅');
}
