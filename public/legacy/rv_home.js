/* rv_home.js */

function rvHome(){
  var h='';
  // ترحيب
  h+='<div style="background:linear-gradient(135deg,#1a2e52,#2a6fdb);border-radius:16px;padding:18px;color:#fff;margin-bottom:14px">';
  h+='<div style="font-size:16px;font-weight:800;margin-bottom:4px">مرحباً '+(U&&U.name||'')+'</div>';
  h+='<div style="font-size:12px;opacity:.8">لوحة متابعتك الشخصية</div></div>';

  // الاستمارات المرشحة
  var myForms=D.frm.filter(function(f){return f.status==='active';});
  var mySubs=D.sub.filter(function(s){return s.reviewer_id===(U&&U.id);});
  var pendingSubs=mySubs.filter(function(s){return ['pending','reviewing'].includes(s.status);});

  if(myForms.length){
    h+='<div style="font-weight:800;font-size:13px;margin-bottom:8px;color:var(--blue2)">📋 استماراتي</div>';
    myForms.forEach(function(f){
      var sub=mySubs.find(function(s){return s.form_id===f.id;});
      var bc=sub?'#2563b0':'#e2e8f0';
      var statusLbl=sub?rvSubStatusLabel(sub.status):'لم تُرسل بعد';
      var statusBg=sub?'#dbeafe':'#f1f5f9';
      var statusClr=sub?'#1d4ed8':'#64748b';
      h+='<div style="background:#fff;border:1.5px solid var(--border);border-right:4px solid '+bc
        +';border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.05)">';
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
      h+='<div style="flex:1">';
      h+='<div style="font-weight:700;font-size:14px;margin-bottom:4px">'+htmlEsc(f.title||'')+'</div>';
      h+='<div style="font-size:11px;color:var(--mid);margin-bottom:8px">'+(f.section_name||'')+'</div>';
      h+='<span style="background:'+statusBg+';color:'+statusClr+';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">'+statusLbl+'</span>';
      h+='</div>';
      if(!sub){
        h+='<button class="btn bp bsm" data-openform="'+f.id+'">تعبئة</button>';
      } else {
        h+='<button class="btn bs bsm" data-viewsub="'+sub.id+'">عرض</button>';
      }
      h+='</div></div>';
    });
  } else {
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:20px;text-align:center;color:var(--light);margin-bottom:14px">';
    h+='<div style="font-size:32px;margin-bottom:8px">📋</div>';
    h+='<p style="font-size:13px">لم يتم ترشيحك في استمارة بعد</p></div>';
  }

  // آخر رسائل
  var unread=D.cvs.filter(function(c){return +c.unread>0;});
  if(unread.length){
    h+='<div style="background:#fff;border:1.5px solid #bbf7d0;border-right:4px solid #16a34a;border-radius:13px;padding:14px;margin-bottom:10px;cursor:pointer" data-rvgo="chat">';
    h+='<div style="display:flex;align-items:center;gap:10px">';
    h+='<div style="width:38px;height:38px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">💬</div>';
    h+='<div><div style="font-weight:700;font-size:13px">رسائل جديدة</div>';
    h+='<div style="font-size:12px;color:var(--mid)">اضغط للاطلاع</div></div></div></div>';
  }

  // المواعيد
  var myApts=(D.apt||[]).filter(function(a){return ['pending','confirmed'].includes(a.status);});
  if(myApts.length){
    h+='<div style="background:#fff;border:1.5px solid #bfdbfe;border-right:4px solid #2563b0;border-radius:13px;padding:14px;margin-bottom:10px">';
    h+='<div style="font-weight:700;font-size:13px;margin-bottom:8px">📅 مواعيدي</div>';
    myApts.forEach(function(a){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border)">';
      h+='<div><div style="font-weight:600;font-size:13px">'+(a.slot_name||'—')+'</div>';
      h+='<div style="font-size:11px;color:var(--mid)">'+a.date+'</div></div>';
      h+='<span class="apt-badge '+a.status+'">'+rvAptLabel(a.status)+'</span>';
      h+='</div>';
    });
    h+='</div>';
  }

  $h('rv-pg',h);

  setTimeout(function(){
    document.querySelectorAll('[data-openform]').forEach(function(btn){
      btn.addEventListener('click',function(){rvOpenForm(+btn.dataset.openform);});
    });
    document.querySelectorAll('[data-viewsub]').forEach(function(btn){
      btn.addEventListener('click',function(){rvViewSub(+btn.dataset.viewsub);});
    });
    document.querySelectorAll('[data-rvgo]').forEach(function(el){
      el.addEventListener('click',function(){rvGo(el.dataset.rvgo);});
    });
  },50);
}

function rvSubStatusLabel(s){
  var m={pending:'⏳ بانتظار المراجعة',reviewing:'🔍 قيد المراجعة',
    done:'✅ مكتملة',rejected:'❌ مرفوضة'};
  return m[s]||s;
}

