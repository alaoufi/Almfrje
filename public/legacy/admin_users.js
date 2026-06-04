/* admin_users.js */

function pRev(){
  var revs=D.rev||[];
  var h='<div class="ph"><div><div class="pt">👥 المراجعون</div></div>'
    +'<button class="btn bp" onclick="oAddRev()">+ إضافة</button></div>';

  // بحث
  h+='<div style="position:relative;margin-bottom:12px">'
    +'<input id="rev-search" class="fr-inp" placeholder="🔍 بحث بالاسم أو الجوال..." oninput="filterRevs()" style="padding-right:36px">'
    +'</div>';

  h+='<div class="fields-wrap" id="revs-list">';
  if(!revs.length){
    h+='<div style="text-align:center;padding:40px;color:var(--light)">لا يوجد مراجعون</div>';
  } else {
    revs.forEach(function(r,i){
      var initial=(r.name||'م').charAt(0);
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;'+(i>0?'border-top:1px solid var(--border)':'')
        +';background:'+(i%2===0?'#fff':'#fafbff')+'">';
      h+='<div style="width:38px;height:38px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex-shrink:0">'+initial+'</div>';
      h+='<div style="flex:1;min-width:0">';
      h+='<div style="font-weight:700;font-size:14px">'+htmlEsc(r.name||'')+'</div>';
      h+='<div style="font-size:12px;color:var(--mid)">@'+(r.username||'')+'  •  '+(r.phone||'')+'</div>';
      h+='<div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap">';
      var roleLbl=r.role==='admin'?'مدير':'مراجع';
      var roleBg=r.role==='admin'?'var(--blue-bg)':'#f1f5f9';
      var roleClr=r.role==='admin'?'var(--blue)':'var(--mid)';
      h+='<span style="background:'+roleBg+';color:'+roleClr+';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">'+roleLbl+'</span>';
      if(+r.allowed_special) h+='<span style="background:#dcfce7;color:#15803d;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">🔑 خاص</span>';
      if(r.status==='banned') h+='<span style="background:#fee2e2;color:#dc2626;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">محظور</span>';
      h+='</div></div>';
      h+='<div style="position:relative">';
      h+='<button class="ib" style="width:32px;height:32px;border:1.5px solid var(--border);background:#f8fafd" data-rev-menu="'+r.id+'">⋯</button>';
      h+='</div></div>';
    });
  }
  h+='</div>';
  $h('pg',h);
  // ربط قوائم الإجراءات
  setTimeout(function(){
    document.querySelectorAll('[data-rev-menu]').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var rid=+btn.dataset.revMenu;
        var rv=D.rev.find(function(x){return x.id==rid;});
        if(!rv)return;
        oM('إجراءات: '+rv.name,
          '<div style="display:flex;flex-direction:column;gap:6px">'
          +'<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();oEditRev('+rid+')">✏️ تعديل البيانات</button>'
          +'<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();oNomRev('+rid+')">📋 ترشيح استمارة</button>'
          +'<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();tRevSpecial('+rid+','+rv.allowed_special+')">'+(+rv.allowed_special?'🔑 إلغاء الدخول الخاص':'🔑 منح الدخول الخاص')+'</button>'
          +'<button class="btn bs" style="width:100%;justify-content:flex-start" onclick="cM();tRevBan('+rid+',\''+rv.status+'\')">'+(rv.status==='banned'?'✅ رفع الحظر':'🚫 حظر')+'</button>'
          +'<button class="btn bd" style="width:100%;justify-content:flex-start" onclick="cM();dRev('+rid+')">🗑️ حذف</button>'
          +'</div>');
      });
    });
  },50);
}

function filterRevs(){
  var q=($g('rev-search')?.value||'').trim().toLowerCase();
  var revs=D.rev||[];
  var filtered=q?revs.filter(function(r){return (r.name||'').toLowerCase().includes(q)||(r.phone||'').includes(q)||(r.username||'').toLowerCase().includes(q);}):revs;
  var list=$g('revs-list');
  if(!list)return;
  var h='';
  filtered.forEach(function(r,i){
    var initial=(r.name||'م').charAt(0);
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;'+(i>0?'border-top:1px solid var(--border)':'')
      +';background:'+(i%2===0?'#fff':'#fafbff')+'">';
    h+='<div style="width:38px;height:38px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex-shrink:0">'+initial+'</div>';
    h+='<div style="flex:1"><div style="font-weight:700">'+htmlEsc(r.name||'')+'</div>'
      +'<div style="font-size:12px;color:var(--mid)">'+(r.phone||'')+'</div></div>';
    h+='<button class="ib" style="width:32px;height:32px;border:1.5px solid var(--border)" data-rev-menu="'+r.id+'">⋯</button>';
    h+='</div>';
  });
  list.innerHTML=h||'<div style="padding:24px;text-align:center;color:var(--light)">لا نتائج</div>';
}

function oAddRev(){
  oM('إضافة مراجع',
    '<div class="f"><label>الاسم *</label><input id="rv-nm" class="fr-inp" placeholder="الاسم الكامل"></div>'
    +'<div class="f"><label>اسم المستخدم *</label><input id="rv-un" class="fr-inp" placeholder="username"></div>'
    +'<div class="f"><label>الجوال *</label><input id="rv-ph" class="fr-inp" type="tel" placeholder="+966..."></div>'
    +'<div class="f"><label>كلمة المرور (فارغ = تلقائي)</label><input id="rv-pw" class="fr-inp" type="password"></div>'
    +'<div style="display:flex;gap:9px;margin-top:8px">'
    +'<button class="btn bp" onclick="svAddRev()">إنشاء الحساب</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function oEditRev(id){
  var rv=D.rev.find(function(x){return x.id==id;});
  if(!rv)return;
  oM('تعديل: '+rv.name,
    '<div class="f"><label>الاسم</label><input id="rv-nm" class="fr-inp" value="'+htmlEsc(rv.name||'')+'"></div>'
    +'<div class="f"><label>اسم المستخدم</label><input id="rv-un" class="fr-inp" value="'+htmlEsc(rv.username||'')+'" placeholder="username"></div>'
    +'<div class="f"><label>الجوال</label><input id="rv-ph" class="fr-inp" type="tel" value="'+htmlEsc(rv.phone||'')+'"></div>'
    +'<div class="f"><label>كلمة مرور جديدة</label><input id="rv-pw" class="fr-inp" type="password" placeholder="فارغ = بدون تغيير"></div>'
    +'<div style="display:flex;gap:9px;margin-top:8px">'
    +'<button class="btn bp" onclick="svEditRev('+id+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svAddRev(){
  var nm=($g('rv-nm')?.value||'').trim();
  var un=($g('rv-un')?.value||'').trim();
  var ph=($g('rv-ph')?.value||'').trim();
  var pw=$g('rv-pw')?.value||'';
  if(!nm||!un||!ph){toast('أدخل الاسم والمستخدم والجوال','er');return;}
  ld(1);var r=await api('POST','users',{name:nm,username:un,phone:ph,password:pw,role:'reviewer'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  if(r.generated_password) alert('✅ تم\nكلمة المرور: '+r.generated_password+'\nاحفظها!');
  else toast('تم إنشاء الحساب ✅');
  cM();await lRev();pRev();
}

async function svEditRev(id){
  var nm=($g('rv-nm')?.value||'').trim();
  var un=($g('rv-un')?.value||'').trim();
  var ph=($g('rv-ph')?.value||'').trim();
  var pw=$g('rv-pw')?.value||'';
  var b={name:nm,phone:ph};
  if(un)b.username=un;
  if(pw)b.password=pw;
  ld(1);var r=await api('PUT','users/'+id,b);ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');cM();await lRev();pRev();
}

async function tRevSpecial(id,cur){
  ld(1);await api('PUT','users/'+id,{allowed_special:+cur?0:1});ld(0);
  toast('تم');await lRev();pRev();
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
  if(r.error){toast(r.error,'er');return;}
  toast('تم الترشيح ✅');
}

