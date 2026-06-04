/* admin_submissions.js */

function pFol(){
  $h('pg','<div class="ph"><div><div class="pt">المتابعة</div><div class="ps">استمارات المراجعين</div></div></div><div id="sl2"></div>');
  rSubs();
}

function rSubs(){
  var c=$g('sl2');if(!c)return;
  var STATUS_COLORS={pending:'#fef3c7',reviewing:'#dbeafe',done:'#dcfce7',rejected:'#fee2e2'};
  var subs=(D.sub||[]).filter(function(s){return s.status!=='archived';});
  if(!subs.length){c.innerHTML='<div class="empty-state">لا توجد استمارات</div>';return;}
  var h='';
  subs.forEach(function(s){
    h+='<div class="card" style="border-right:4px solid '+(STATUS_COLORS[s.status]||'#e2e8f0')+';margin-bottom:8px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">';
    h+='<div>';
    h+='<div style="font-weight:700">'+(s.form_title||'—')+'</div>';
    h+='<div class="ps">👤 '+(s.reviewer_name||'')+' • '+((s.created_at||'').slice(0,16))+'</div>';
    h+='<div style="margin-top:5px">'+bdg(s.status)+'</div>';
    h+='</div>';
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap">';
    h+='<button class="btn bs bsm" onclick="viewSub('+s.id+')">👁️ عرض</button>';
    if(s.status==='pending') h+='<button class="btn bp bsm" onclick="uSub('+s.id+',\'reviewing\')">▶ مراجعة</button>';
    if(s.status==='reviewing') h+='<button class="btn bp bsm" onclick="uSub('+s.id+',\'done\')">✔ مكتمل</button><button class="btn bd bsm" onclick="uSub('+s.id+',\'rejected\')">✕ رفض</button>';
    h+='<button class="btn bs bsm" onclick="archiveSubmission('+s.id+')" title="أرشفة">🗄️</button>';
    h+='</div></div></div>';
  });
  c.innerHTML=h;
}

async function uSub(id,st){
  cM();
  ld(1);await api('PUT','submissions/'+id,{status:st});ld(0);
  toast('تم ✅');await lSub();
  // أعد رسم العرض الحالي
  if(typeof NAV!=='undefined' && NAV==='forms' && typeof pFrm==='function') pFrm();
  else if(typeof rSubs==='function') rSubs();
  // بعد التحديث → أعد فتح الاستمارة
  viewSub(id);
}

async function viewSub(id){
  ld(1);var r=await api('GET','submissions/'+id);ld(0);
  if(r.error){toast(r.error,'er');return;}
  var ans=r.answers||[];
  var isDone=(r.status==='done'||r.status==='rejected');

  // ── hl colors ──
  var HLC=[
    {cls:'hl-yellow',bg:'#fef08a',label:'أصفر'},
    {cls:'hl-green', bg:'#86efac',label:'أخضر'},
    {cls:'hl-blue',  bg:'#93c5fd',label:'أزرق'},
    {cls:'hl-pink',  bg:'#f9a8d4',label:'وردي'},
  ];
  window._rvHL={color:HLC[0]};

  var h='';

  // هيدر
  h+='<div style="margin-bottom:10px">';
  h+='<div style="font-weight:800;font-size:15px">'+(r.form_title||'—')+'</div>';
  h+='<div class="ps">👤 '+(r.reviewer_name||'')+' • '+((r.created_at||'').slice(0,16))+'</div>';
  h+='<div style="margin-top:5px">'+bdg(r.status)+'</div>';
  h+='</div>';

  // شريط التمييز
  h+='<div class="rv-color-bar" id="hl-bar" style="margin-bottom:10px">';
  h+='<span class="rv-color-label">تمييز:</span>';
  HLC.forEach(function(col,i){
    h+='<div class="rv-color-dot'+(i===0?' active':'')+'" style="background:'+col.bg+'" data-hlcls="'+col.cls+'" title="'+col.label+'"></div>';
  });
  h+='<button class="rv-eraser" id="rv-eraser" title="إزالة">🧹</button>';
  h+='</div>';

  // بطاقات الإجابات
  var ABGS=['#eff6ff','#f0fdf4','#fffbeb','#fff1f2','#fdf4ff','#fff7ed'];
  var ACLS=['#2563b0','#16a34a','#d97706','#e11d48','#9333ea','#ea580c'];
  ans.forEach(function(a,ai){
    var ci=ai%6;
    h+='<div class="rv-field-card" id="rvc-'+ai+'">';
    h+='<div style="font-size:11px;font-weight:700;color:'+ACLS[ci]+';margin-bottom:5px;display:flex;align-items:center;gap:5px">';
    h+='<span style="background:'+ACLS[ci]+';color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(ai+1)+'</span>';
    h+=htmlEsc(a.label||'')+'</div>';
    h+='<div class="hl-content rv-field-answer" id="ans-'+ai+'">'+htmlEsc(a.answer||'—')+'</div>';
    h+='</div>';
  });

  // ملاحظات + أزرار
  if(!isDone){
    h+='<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">';
    h+='<div class="f"><label>📝 ملاحظات داخلية</label><textarea id="sub-in" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;resize:none;height:70px">'+(r.internal_notes||'')+'</textarea></div>';
    h+='<div class="f"><label>💬 ملاحظات للمراجع</label><textarea id="sub-rv" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;resize:none;height:70px">'+(r.reviewer_notes||'')+'</textarea></div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h+='<button class="btn bp" onclick="svSubNotes('+id+')">💾 حفظ الملاحظات</button>';
    h+='<button class="btn bp" onclick="uSub('+id+',\'done\')">✔ مكتمل</button>';
    h+='<button class="btn bd" onclick="uSub('+id+',\'rejected\')">✕ رفض</button>';
    h+='<button class="btn bs" onclick="cM()">إغلاق</button>';
    h+='</div></div>';
  } else {
    // مكتمل - اطلاع + ملاحظات للمراجع
    if(r.reviewer_notes){
      h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-right:4px solid #f59e0b;border-radius:10px;padding:12px;margin-top:12px">';
      h+='<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:5px">💬 ملاحظات للمراجع</div>';
      h+='<div style="font-size:14px">'+htmlEsc(r.reviewer_notes)+'</div>';
      h+='</div>';
    }
    h+='<div style="display:flex;gap:8px;margin-top:12px">';
    h+='<button class="btn bp" onclick="cM();archiveSubmission('+id+')">🗄️ أرشفة</button>';
    h+='<button class="btn bs" onclick="cM()">إغلاق</button>';
    h+='</div>';
  }

  oM('تفاصيل الاستمارة',h);

  // ربط أحداث التمييز
  setTimeout(function(){
    // اختيار اللون
    document.querySelectorAll('[data-hlcls]').forEach(function(dot){
      dot.addEventListener('click',function(){
        document.querySelectorAll('[data-hlcls]').forEach(function(d){d.classList.remove('active');});
        dot.classList.add('active');
        window._rvHL.color=HLC.find(function(c){return c.cls===dot.dataset.hlcls;})||HLC[0];
      });
    });
    // الممحاة
    var eraser=document.getElementById('rv-eraser');
    if(eraser) eraser.addEventListener('click',function(){
      window._rvHL.color=null;
      document.querySelectorAll('[data-hlcls]').forEach(function(d){d.classList.remove('active');});
    });
    // تطبيق التمييز عند تحديد النص
    var mb=document.getElementById('mb');
    if(mb){
      mb.addEventListener('mouseup',applyHL);
      mb.addEventListener('touchend',function(){setTimeout(applyHL,100);});
    }
  },100);
}

function applyHL(){
  var sel=window.getSelection?window.getSelection():null;
  if(!sel||sel.isCollapsed||!sel.rangeCount)return;
  var col=window._rvHL?window._rvHL.color:null;
  try{
    var range=sel.getRangeAt(0);
    var span=document.createElement('span');
    if(col){span.className=col.cls;}
    else{
      // إزالة تمييز
      var frag=range.extractContents();
      frag.querySelectorAll('[class^="hl-"]').forEach(function(s){
        while(s.firstChild)s.parentNode.insertBefore(s.firstChild,s);
        s.remove();
      });
      range.insertNode(frag);
      sel.removeAllRanges();return;
    }
    range.surroundContents(span);
    sel.removeAllRanges();
  }catch(e){}
}

async function svSubNotes(id){
  var inp=$g('sub-in');var srv=$g('sub-rv');
  ld(1);await api('PUT','submissions/'+id,{
    internal_notes:inp?inp.value:'',
    reviewer_notes:srv?srv.value:''
  });ld(0);
  toast('تم حفظ الملاحظات ✅');
}
