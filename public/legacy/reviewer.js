/* reviewer.js - بوابة المراجع */

// ─── أيقونة التعليمات ⓘ ─────────────────────────────────────────────
// تُرسم بجانب أي عنوان قسم أو حقل، وعند الضغط تفتح bottom-sheet
// بالنص المُدار من الإعدادات (D.tips[key]). إذا لا يوجد tip بهذا
// المفتاح، تعود سلسلة فارغة فلا يظهر شيء (هكذا الواجهة لا تتسخ).
window.rvTipIcon = function(key, extra){
  if(!key || !D.tips || !D.tips[key]) return '';
  var st = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#dbeafe;color:#1d4ed8;border:none;font-family:Cairo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;line-height:1;padding:0;margin-right:4px;vertical-align:middle';
  return '<button type="button" data-tip="'+key+'" style="'+st+(extra||'')+'" title="تعليمات">ⓘ</button>';
};

window.rvShowTip = function(key){
  var t = D.tips && D.tips[key];
  if(!t) return;
  var prev = document.getElementById('rv-tip-ov'); if (prev) prev.remove();
  var ov = document.createElement('div');
  ov.id = 'rv-tip-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:14px;font-family:Cairo,sans-serif;animation:wcfade .15s ease-out';
  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:18px 18px 0 0;padding:16px 18px 22px;width:100%;max-width:480px;box-shadow:0 -8px 30px rgba(0,0,0,.25);animation:slide-up .25s ease;max-height:80vh;overflow-y:auto';
  var body = (typeof mdRender==='function') ? mdRender(t.body||'') : String(t.body||'').replace(/</g,'&lt;').replace(/\n/g,'<br>');
  box.innerHTML =
    '<div style="width:40px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 14px"></div>'
    + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">'
    +   '<div style="width:36px;height:36px;border-radius:50%;background:#dbeafe;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800">ⓘ</div>'
    +   '<div style="flex:1"><div style="font-weight:800;font-size:15px;color:#0f172a">'+htmlEsc(t.title||'')+'</div></div>'
    + '</div>'
    + '<div style="font-size:13.5px;line-height:1.85;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">'+body+'</div>'
    + '<button id="rv-tip-close" type="button" style="width:100%;padding:11px;background:#075e54;color:#fff;border:none;border-radius:11px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;margin-top:12px">حسناً</button>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  function close(){ ov.remove(); }
  document.getElementById('rv-tip-close').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
};

// ربط أزرار التعليمات داخل أي حاوية (يُستدعى بعد كل رسم)
window.rvBindTips = function(root){
  (root||document).querySelectorAll('[data-tip]').forEach(function(btn){
    if(btn._tipBound) return;
    btn._tipBound = true;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      e.preventDefault();
      rvShowTip(btn.getAttribute('data-tip'));
    });
  });
};

function rvHome(){
  var myId=(U&&U.id)||0;
  var myName=(U&&U.name)||'مراجع';
  var myForms=(D.frm||[]).filter(function(f){return f.status==='active';});
  var mySubs=(D.sub||[]).filter(function(s){return s.reviewer_id===myId&&s.status!=='archived'&&s.status!=='draft';});
  var myConvs=(D.cvs||[]);
  var totalUnread=myConvs.reduce(function(n,c){return n+(+c.unread||0);},0);
  var myApts=(D.apt||[]).filter(function(a){return a.status==='pending'||a.status==='confirmed';});
  var pubs=(D.pub||[]).filter(function(p){return p.status==='active';});

  // ─── حساب التنبيهات ─────────────────────────────────────────
  // استمارات تحتاج تعبئة = ما له تعيين بدون submission
  var submittedFormIds=new Set(mySubs.map(function(s){return +s.form_id;}));
  var pendingForms=myForms.filter(function(f){return !submittedFormIds.has(+f.id);});
  // أيام مفتوحة للحجز
  var todayStr=new Date().toISOString().slice(0,10);
  var availSlots=(D.dts||[]).filter(function(d){
    return d.status==='available' && (d.date||'').slice(0,10)>=todayStr;
  });
  // أقرب موعد نشط للعرض في المنبثقة عند وجوده
  var nearestApt=null;
  if(myApts.length){
    var sorted=myApts.slice().sort(function(a,b){return (a.date||'').localeCompare(b.date||'');});
    nearestApt=sorted[0];
  }
  // جلسات مكتملة بانتظار تقييم — يحفز الأيقونة في الإشعار العائم
  var completedApts=(D.apt||[]).filter(function(a){return a.status==='completed';});
  var notif={
    pendingForms: pendingForms.length,
    availSlots: availSlots.length,
    activeBooking: nearestApt,    // {date, slot_name, status, ...} إن وُجد
    unread: totalUnread,
    sessionsToEvaluate: completedApts.length,
    latestCompletedApt: completedApts.sort(function(a,b){return (b.date||'').localeCompare(a.date||'');})[0] || null,
  };
  _rvMaybeShowNotifications(notif);

  var h='';

  // ─── بطاقة الترحيب المضغوطة ───────────────────────────────
  h+='<div style="background:linear-gradient(135deg,#075e54 0%,#128c7e 100%);border-radius:14px;padding:14px 16px;color:#fff;margin-bottom:10px;box-shadow:0 4px 12px rgba(7,94,84,.2);display:flex;align-items:center;gap:12px">';
  h+='<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0">'+myName.charAt(0)+'</div>';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:15px;font-weight:800;line-height:1.2">مرحباً، '+htmlEsc(myName)+'</div>';
  h+='<div style="font-size:11.5px;opacity:.85;margin-top:1px">لوحة متابعتك الشخصية</div>';
  h+='</div>';
  if(D.tips&&D.tips.home_welcome){
    h+='<button type="button" data-tip="home_welcome" style="background:rgba(255,255,255,.22);color:#fff;border:none;width:30px;height:30px;border-radius:50%;font-family:Cairo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;flex-shrink:0" title="تعليمات">ⓘ</button>';
  }
  h+='</div>';

  // ─── الاستمارات ───────────────────────────────────────────
  h+=_rvSectionCard('📋','الاستمارات',myForms.length?_rvFormsBlock(myForms,mySubs):_rvEmptyLine('لم يتم ترشيحك في استمارة بعد'),{tipKey:'forms_section'});

  // ─── المحادثات ────────────────────────────────────────────
  h+=_rvSectionCard('💬','المحادثات',_rvChatsBlock(myConvs,totalUnread),{tipKey:'chat_section'});

  // ─── المواعيد ─────────────────────────────────────────────
  h+=_rvSectionCard('📅','المواعيد',_rvAptBlock(myApts),{tipKey:'apt_section'});

  // ─── النشرات (ثانوي) ─────────────────────────────────────
  if(pubs.length){
    var pubLast=pubs.slice(0,3);
    var pubBody='';
    pubLast.forEach(function(p,i){
      var isLast=i===pubLast.length-1;
      pubBody+='<div style="display:flex;align-items:center;gap:8px;padding:8px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+';cursor:pointer" data-pub="'+p.id+'">';
      pubBody+='<div style="font-size:14px;flex-shrink:0">'+(p.type==='pdf'?'📄':'📰')+'</div>';
      pubBody+='<div style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(p.title||'')+'</div>';
      pubBody+='<div style="font-size:11px;color:#94a3b8">←</div>';
      pubBody+='</div>';
    });
    h+=_rvSectionCard('📰','النشرات',pubBody,{secondary:true,linkText:'عرض الكل',linkTarget:'publications',tipKey:'pub_section'});
  }

  // ─── روابط الخصوصية والتعليمات ────────────────────────────
  h+='<div style="text-align:center;margin:14px 0 8px;font-size:11.5px;color:#94a3b8;display:flex;justify-content:center;gap:18px">';
  h+='<a href="#" onclick="oPrivacy();return false" style="color:#64748b;text-decoration:none;font-weight:600">🔒 الخصوصية</a>';
  h+='<a href="#" onclick="oInstructions();return false" style="color:#64748b;text-decoration:none;font-weight:600">📘 التعليمات</a>';
  h+='</div>';

  $h('rv-pg',h);

  setTimeout(function(){
    document.querySelectorAll('[data-openform]').forEach(function(el){
      el.addEventListener('click',function(){rvOpenForm(+el.dataset.openform);});
    });
    document.querySelectorAll('[data-viewsub]').forEach(function(el){
      el.addEventListener('click',function(){rvViewSub(+el.dataset.viewsub);});
    });
    document.querySelectorAll('[data-rvgo]').forEach(function(el){
      el.addEventListener('click',function(){rvGo(el.dataset.rvgo);});
    });
    document.querySelectorAll('[data-pub]').forEach(function(el){
      el.addEventListener('click',function(){
        if(typeof rvOpenPub==='function')rvOpenPub(+el.dataset.pub);
        else rvGo('publications');
      });
    });
    rvBindTips();
  },50);
}

// ─── helpers لصفحة المراجع الرئيسية ────────────────────────────────
function _rvSectionCard(icon,title,body,opts){
  opts=opts||{};
  var h='<div style="background:#fff;border:1px solid #eef2f7;border-radius:13px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(15,23,42,.04)">';
  h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">';
  h+='<span style="font-size:15px">'+icon+'</span>';
  h+='<div style="font-weight:700;font-size:13.5px;color:#0f172a">'+title+'</div>';
  if(opts.tipKey) h+=rvTipIcon(opts.tipKey);
  if(opts.linkText){
    h+='<button data-rvgo="'+opts.linkTarget+'" style="margin-right:auto;background:transparent;border:none;color:#075e54;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer">'+opts.linkText+' ←</button>';
  }
  h+='</div>';
  h+=body;
  h+='</div>';
  return h;
}
function _rvEmptyLine(msg){
  return '<div style="text-align:center;padding:14px 8px;color:#94a3b8;font-size:12.5px;font-weight:600">'+msg+'</div>';
}
function _rvFormsBlock(forms,subs){
  var body='';
  forms.forEach(function(f,i){
    var sub=subs.find(function(s){return s.form_id===f.id;});
    var isLast=i===forms.length-1;
    var done=sub&&sub.status!=='pending'&&sub.status!=='reviewing';
    var label=sub?rvSubStatusLabel(sub.status):'لم تُرسل';
    var labelBg=sub?(done?'#dcfce7':'#dbeafe'):'#fef3c7';
    var labelClr=sub?(done?'#15803d':'#1d4ed8'):'#92400e';
    body+='<div style="padding:9px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+';display:flex;align-items:center;gap:10px">';
    body+='<div style="flex:1;min-width:0">';
    body+='<div style="font-weight:700;font-size:14px;color:#0f172a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(f.title||'')+'</div>';
    body+='<div style="display:flex;align-items:center;gap:6px;margin-top:3px">';
    body+='<span style="background:'+labelBg+';color:'+labelClr+';padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700">'+label+'</span>';
    if(f.section_name) body+='<span style="font-size:10.5px;color:#94a3b8">'+htmlEsc(f.section_name)+'</span>';
    body+='</div></div>';
    if(!sub){
      body+='<button class="btn bp bsm" style="background:#075e54;border:none;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer;flex-shrink:0" data-openform="'+f.id+'">تعبئة</button>';
    } else {
      body+='<button class="btn bs bsm" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer;flex-shrink:0" data-viewsub="'+sub.id+'">عرض</button>';
    }
    body+='</div>';
  });
  return body;
}
function _rvChatsBlock(convs,unread){
  var body='';
  if(unread){
    body+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;cursor:pointer" data-rvgo="chat">';
    body+='<div style="background:#22c55e;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0">'+unread+'</div>';
    body+='<div style="flex:1;font-size:13px;font-weight:700;color:#15803d">رسائل جديدة بانتظارك</div>';
    body+='<div style="font-size:11px;color:#15803d">فتح ←</div>';
    body+='</div>';
  }
  var recent=convs.slice(0,3);
  if(recent.length){
    recent.forEach(function(c,i){
      var isLast=i===recent.length-1;
      var lastMsg=c.last_msg||'لا رسائل بعد';
      if(lastMsg.length>50)lastMsg=lastMsg.slice(0,50)+'…';
      body+='<div style="padding:8px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+';display:flex;align-items:center;gap:10px;cursor:pointer" data-rvgo="chat">';
      body+='<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#075e54,#25d366);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">'+(c.name||'م').charAt(0)+'</div>';
      body+='<div style="flex:1;min-width:0">';
      body+='<div style="font-weight:700;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(c.name||'')+'</div>';
      body+='<div style="font-size:11.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">'+htmlEsc(lastMsg)+'</div>';
      body+='</div>';
      if(+c.unread>0) body+='<div style="background:#22c55e;color:#fff;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;padding:0 5px;flex-shrink:0">'+c.unread+'</div>';
      body+='</div>';
    });
  } else if(!unread){
    body+=_rvEmptyLine('لا توجد محادثات سابقة');
  }
  body+='<button data-rvgo="chat" style="width:100%;margin-top:8px;background:#075e54;color:#fff;border:none;border-radius:9px;padding:9px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">+ محادثة جديدة</button>';
  return body;
}
function _rvAptBlock(apts){
  if(!apts.length){
    var body=_rvEmptyLine('لا مواعيد حالية');
    body+='<button data-rvgo="appointments" style="width:100%;margin-top:8px;background:#fff;color:#075e54;border:1px solid #075e54;border-radius:9px;padding:9px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">📅 حجز موعد</button>';
    return body;
  }
  var body='';
  apts.forEach(function(a,i){
    var isLast=i===apts.length-1;
    var pending=a.status==='pending';
    var bg=pending?'#fffbeb':'#f0fdf4';
    var border=pending?'#fde68a':'#bbf7d0';
    var iconBg=pending?'#f59e0b':'#22c55e';
    var statusClr=pending?'#92400e':'#15803d';
    body+='<div style="padding:10px 12px;background:'+bg+';border:1px solid '+border+';border-radius:10px'+(isLast?'':';margin-bottom:6px')+';display:flex;align-items:center;gap:10px">';
    body+='<div style="width:34px;height:34px;border-radius:50%;background:'+iconBg+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'+(pending?'⏳':'✅')+'</div>';
    body+='<div style="flex:1;min-width:0">';
    body+='<div style="font-weight:700;font-size:13.5px;color:#0f172a;line-height:1.3">'+htmlEsc(a.slot_name||'موعد')+'</div>';
    body+='<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:'+statusClr+';font-weight:600;margin-top:2px">';
    body+='<span>'+(a.date||'')+'</span>';
    if(a.time_from) body+='<span>•</span><span>'+a.time_from+'</span>';
    body+='</div>';
    body+='</div>';
    body+='<span style="background:#fff;color:'+statusClr+';padding:3px 9px;border-radius:10px;font-size:10.5px;font-weight:700;flex-shrink:0">'+rvAptLabel(a.status)+'</span>';
    body+='</div>';
  });
  body+='<button data-rvgo="appointments" style="width:100%;margin-top:10px;background:#fff;color:#075e54;border:1px solid #075e54;border-radius:9px;padding:9px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">📅 إدارة المواعيد</button>';
  return body;
}

function rvSubStatusLabel(s){
  var m={pending:'⏳ بانتظار المراجعة',reviewing:'🔍 قيد المراجعة',
    done:'✅ مكتملة',rejected:'❌ مرفوضة'};
  return m[s]||s;
}

function rvForms(){
  var myForms=D.frm.filter(function(f){return f.status==='active';});
  var h='<div class="ph"><div><div class="pt">📋 الاستمارات '+rvTipIcon('forms_section')+'</div></div></div>';

  if(!myForms.length){
    h+='<div style="text-align:center;padding:48px 16px;color:var(--light)">';
    h+='<div style="font-size:48px;margin-bottom:12px">📋</div>';
    h+='<p>لم يتم ترشيحك في استمارة بعد</p></div>';
    $h('rv-pg',h);return;
  }

  myForms.forEach(function(f){
    var sub=(D.sub||[]).find(function(s){return s.form_id===f.id&&s.reviewer_id===(U&&U.id);});
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.05)">';
    h+='<div style="font-weight:800;font-size:15px;margin-bottom:3px">'+htmlEsc(f.title||'')+'</div>';
    h+='<div style="font-size:12px;color:var(--mid);margin-bottom:10px">'+(f.section_name||'—')+'</div>';
    if(sub){
      h+='<div style="display:flex;align-items:center;justify-content:space-between">';
      h+='<span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">'+rvSubStatusLabel(sub.status)+'</span>';
      h+='<button class="btn bs bsm" data-viewsub="'+sub.id+'">عرض الإجابات</button>';
      h+='</div>';
    } else {
      h+='<button class="btn bp" style="width:100%" data-openform="'+f.id+'">📝 تعبئة الاستمارة</button>';
    }
    h+='</div>';
  });

  $h('rv-pg',h);
  setTimeout(function(){
    document.querySelectorAll('[data-openform]').forEach(function(btn){
      btn.addEventListener('click',function(){rvOpenForm(+btn.dataset.openform);});
    });
    document.querySelectorAll('[data-viewsub]').forEach(function(btn){
      btn.addEventListener('click',function(){rvViewSub(+btn.dataset.viewsub);});
    });
    rvBindTips();
  },50);
}

async function rvOpenForm(fid){
  // فحص إذا كانت مُرسلة مسبقاً (status != draft, archived)
  var existSub=(D.sub||[]).find(function(s){return s.form_id===fid&&s.reviewer_id===(U&&U.id)&&s.status!=='draft';});
  if(existSub){rvViewSub(existSub.id);return;}
  ld(1);
  var r=await api('GET','forms/'+fid);
  // جلب المسودة لو موجودة لاستئناف التعبئة
  var draftR=await api('GET','submissions?draft_form_id='+fid);
  ld(0);
  if(r.error){toast(r.error,'er');return;}
  var fields=r.fields||[];
  var cats=[...new Set(fields.map(function(f){return f.category||'عام';}))];
  var draft=(draftR&&draftR.draft)||null;
  window._rvDraftMap={};
  if(draft&&Array.isArray(draft.answers)){
    draft.answers.forEach(function(a){if(a.field_id!=null)window._rvDraftMap[+a.field_id]=a.answer||'';});
  }

  var INP='width:100%;padding:7px 11px;border:1px solid #e2e8f0;border-radius:9px;font-family:Cairo,sans-serif;font-size:15px;font-weight:600;line-height:22px;outline:none;background:#fff;color:#0f172a;transition:border .15s;box-sizing:border-box';
  function _parseOpts(raw){
    if(Array.isArray(raw))return raw;
    if(typeof raw==='string'&&raw.trim()){try{var p=JSON.parse(raw);return Array.isArray(p)?p:[];}catch(e){return[];}}
    return [];
  }

  var h='';

  // كرت العنوان الرئيسي
  h+='<div style="background:linear-gradient(135deg,#075e54 0%,#128c7e 100%);color:#fff;border-radius:16px;padding:18px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(7,94,84,.22)">';
  h+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">';
  h+='<div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📋</div>';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:16px;font-weight:800;line-height:1.3">'+htmlEsc(r.title||'')+'</div>';
  if(r.subtitle) h+='<div style="font-size:12px;opacity:.85;margin-top:2px">'+htmlEsc(r.subtitle)+'</div>';
  h+='</div>';
  if(D.tips&&D.tips.form_fill){
    h+='<button type="button" data-tip="form_fill" style="background:rgba(255,255,255,.22);color:#fff;border:none;width:30px;height:30px;border-radius:50%;font-family:Cairo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;flex-shrink:0" title="تعليمات التعبئة">ⓘ</button>';
  }
  h+='</div>';
  h+='<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;opacity:.9;margin-top:8px"><span>✨</span><span>تعبئة الاستمارة لا تأخذ وقتاً، خطوة بخطوة</span></div>';
  h+='</div>';

  // ── البيانات الشخصية كتصنيف #1 (للقراءة فقط من ملف المراجع) ──
  // نتجاهل أي تصنيف "البيانات الشخصية" قادم من DB لأنه فُرّغ — نضع نسختنا فقط.
  cats = cats.filter(function(c){ return c !== 'البيانات الشخصية'; });
  fields = fields.filter(function(f){ return (f.category||'عام') !== 'البيانات الشخصية'; });
  h += _rvPersonalCategory(1);

  cats.forEach(function(cat,catIdx){
    var catFields=fields.filter(function(f){return (f.category||'عام')===cat;});

    h+='<div style="background:#fff;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px 6px;margin-bottom:10px;box-shadow:0 1px 2px rgba(15,23,42,.04)">';
    h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;padding-bottom:7px;border-bottom:1px solid #f1f5f9">';
    h+='<div style="width:20px;height:20px;border-radius:50%;background:#dcf8c6;color:#075e54;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">'+(catIdx+2)+'</div>';
    h+='<div style="font-weight:700;font-size:13px;color:#1e293b">'+htmlEsc(cat)+'</div>';
    h+='<div style="margin-right:auto;font-size:10.5px;color:#94a3b8">'+catFields.length+' حقل</div>';
    h+='</div>';

    catFields.forEach(function(f,fIdx){
      var fid2='ans_'+f.id;
      var opts=_parseOpts(f.options);
      function getLabel(o){return typeof o==='object'&&o?(o.label||''):String(o);}
      var isLast=fIdx===catFields.length-1;

      h+='<div style="padding:7px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+'">';
      h+='<label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;color:#334155">'+htmlEsc(f.label||'')+(f.required?'<span style="color:#ef4444;margin-right:3px"> *</span>':'')+'</label>';

      if(f.field_type==='textarea'){
        h+='<textarea id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+';height:72px;resize:none"></textarea>';
      } else if(f.field_type==='select'){
        h+='<div style="position:relative">';
        h+='<select id="'+fid2+'" style="'+INP+';-webkit-appearance:none;padding-left:30px;cursor:pointer">';
        h+='<option value="">— اختر —</option>';
        opts.forEach(function(o){var ol=getLabel(o);h+='<option value="'+ol+'">'+ol+'</option>';});
        h+='</select>';
        h+='<span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#94a3b8;font-size:11px">▾</span></div>';
        h+='<div id="sub_'+fid2+'"></div>';
      } else if(f.field_type==='radio'){
        h+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='sub_'+fid2+'_opt_'+oi;
          var wrapId='wrap_'+fid2+'_'+oi;
          h+='<div id="'+wrapId+'">';
          h+='<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;transition:background .12s,border .12s;font-size:14px;font-weight:600;color:#0f172a" onmouseover="this.style.background=\'#f0f9f4\'" onmouseout="this.style.background=\'#fafbfc\'">'
            +'<input type="radio" name="'+fid2+'" value="'+ol+'" style="accent-color:#075e54;width:16px;height:16px;flex-shrink:0"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="rvRadioChange(this);rvShowOptSub(this)"> '+htmlEsc(ol)+'</label>';
          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            h+='<div id="'+subId+'" style="display:none;margin:6px 22px 0 0;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">';
            h+='<label style="display:block;font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">↳ '+htmlEsc(sub.label)+(sub.required?'<span style="color:#ef4444"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              h+='<textarea id="subans_'+fid2+'_'+oi+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+';height:58px;resize:none"></textarea>';
            } else {
              h+='<input type="'+t2+'" id="subans_'+fid2+'_'+oi+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+'">';
            }
            h+='</div>';
          }
          h+='</div>';
        });
        h+='</div>';
      } else if(f.field_type==='checkbox'){
        h+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          h+='<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;transition:background .12s;font-size:14px;font-weight:600;color:#0f172a" onmouseover="this.style.background=\'#f0f9f4\'" onmouseout="this.style.background=\'#fafbfc\'">'
            +'<input type="checkbox" id="'+fid2+'_cb_'+oi+'" value="'+ol+'" style="accent-color:#075e54;width:16px;height:16px;flex-shrink:0"> '+htmlEsc(ol)+'</label>';
        });
        h+='</div>';
      } else if(f.field_type==='date'){
        h+='<input type="date" id="'+fid2+'" style="'+INP+'">';
      } else if(f.field_type==='number'){
        h+='<input type="number" id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      } else if(f.field_type==='phone'){
        h+='<input type="tel" id="'+fid2+'" placeholder="'+(f.placeholder||'+966...')+'" style="'+INP+'">';
      } else {
        h+='<input type="text" id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      }
      h+='</div>';
    });

    h+='</div>';
  });

  // كرت زر الإرسال
  h+='<div style="background:#fff;border:1px solid #eef2f7;border-radius:14px;padding:14px;margin-bottom:14px;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.04)">';
  h+='<div style="font-size:12px;color:#15803d;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px"><span id="rvdraft-status" style="padding:3px 10px;border-radius:14px;background:#f1f5f9;color:#64748b;font-weight:600">·</span></div>';
  h+='<div style="font-size:13px;color:#475569;margin-bottom:10px">جاهز؟ راجع إجاباتك ثم أرسل الاستمارة 👇</div>';
  h+='<button class="btn bp" style="width:100%;padding:14px;font-size:15px;font-weight:800;background:linear-gradient(135deg,#075e54,#128c7e);border:none;border-radius:11px;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(7,94,84,.25)" onclick="rvSubmitForm('+fid+')">✅ إرسال الاستمارة</button>';
  h+='</div>';

  $h('rv-pg',h);
  if(typeof rvBindTips==='function') setTimeout(rvBindTips,30);
  window._rv_current_fields=fields;
  window._rvFormId=fid;

  // املأ القيم من المسودة (لو موجودة)
  if(window._rvDraftMap){
    fields.forEach(function(f){
      var v=window._rvDraftMap[+f.id];
      if(v==null)return;
      var fid2='ans_'+f.id;
      if(f.field_type==='radio'){
        // ابحث عن الـ radio بنفس القيمة
        var r=document.querySelector('input[name="'+fid2+'"][value="'+String(v).replace(/"/g,'')+'"]');
        if(r){r.checked=true;try{rvRadioChange(r);rvShowOptSub(r);}catch(e){}}
      } else if(f.field_type==='checkbox'){
        // checkbox مخزّن كـ سلسلة مفصولة بفاصلة
        var vals=String(v).split(',');
        document.querySelectorAll('input[id^="'+fid2+'_cb_"]').forEach(function(cb){
          if(vals.indexOf(cb.value)>=0)cb.checked=true;
        });
      } else {
        var el=document.getElementById(fid2);
        if(el)el.value=v;
      }
    });
    if(Object.keys(window._rvDraftMap).length){
      rvSetDraftStatus('saved','— تم استئناف مسودة سابقة');
    }
  }

  // event delegation للحفظ التلقائي
  var pg=document.getElementById('rv-pg');
  if(pg){
    pg.addEventListener('input',rvScheduleDraftSave);
    pg.addEventListener('change',rvScheduleDraftSave);
  }
}

// ─── مسوّدة المراجع: حفظ تلقائي + مؤشر ─────────────────────────────
var _rvDraftTimer=null;
function rvSetDraftStatus(state,extra){
  var el=document.getElementById('rvdraft-status');
  if(!el)return;
  if(state==='saving'){el.textContent='⏳ يحفظ المسودة…';el.style.background='#fef3c7';el.style.color='#92400e';}
  else if(state==='saved'){el.textContent='✓ محفوظ كمسودة'+(extra?' '+extra:'');el.style.background='#dcfce7';el.style.color='#15803d';}
  else if(state==='error'){el.textContent='⚠️ تعذّر الحفظ';el.style.background='#fee2e2';el.style.color='#dc2626';}
  else if(state==='dirty'){el.textContent='● تعديلات لم تُحفظ';el.style.background='#fef9c3';el.style.color='#854d0e';}
  else{el.textContent='·';el.style.background='#f1f5f9';el.style.color='#64748b';}
}
function rvScheduleDraftSave(){
  rvSetDraftStatus('dirty');
  clearTimeout(_rvDraftTimer);
  _rvDraftTimer=setTimeout(rvSaveDraft,1800);
}
function rvCollectAnswers(){
  var fields=window._rv_current_fields||[];
  var out=[];
  fields.forEach(function(f){
    var fid2='ans_'+f.id;
    var val=null;
    if(f.field_type==='radio'){
      var r=document.querySelector('input[name="'+fid2+'"]:checked');
      val=r?r.value:'';
    } else if(f.field_type==='checkbox'){
      var vals=[];
      document.querySelectorAll('input[id^="'+fid2+'_cb_"]:checked').forEach(function(cb){vals.push(cb.value);});
      val=vals.join(',');
    } else {
      var el=document.getElementById(fid2);
      val=el?el.value:'';
    }
    if(val!=null&&val!=='') out.push({field_id:f.id,answer:val});
  });
  return out;
}
async function rvSaveDraft(){
  var fid=window._rvFormId;
  if(!fid)return;
  rvSetDraftStatus('saving');
  var answers=rvCollectAnswers();
  var r;
  try{
    r=await api('POST','submissions',{form_id:fid,answers:answers,draft:true});
  }catch(e){rvSetDraftStatus('error');return;}
  if(r&&r.error){rvSetDraftStatus('error');return;}
  rvSetDraftStatus('saved');
}

async function rvSubmitForm(fid){
  var fields=window._rv_current_fields||[];
  var answers=[];
  var errors=[];

  fields.forEach(function(f){
    var fid2='ans_'+f.id;
    var val='';
    if(f.field_type==='radio'){
      var sel=document.querySelector('[name="'+fid2+'"]:checked');
      val=sel?sel.value:'';
    } else if(f.field_type==='checkbox'){
      var checked=[];
      var opts=Array.isArray(f.options)?f.options:[];
      opts.forEach(function(o,oi){
        var cb=$g(fid2+'_cb_'+oi);
        if(cb&&cb.checked) checked.push(typeof o==='object'?(o.label||''):String(o));
      });
      val=checked.join('، ');
    } else {
      var el=$g(fid2);
      val=el?el.value:'';
    }
    if(f.required&&!String(val).trim()){
      errors.push(f.label);
    }
    if(val) answers.push({field_id:f.id,answer:String(val)});
  });

  if(errors.length){
    // تمييز الحقول الفارغة بالأحمر
    fields.forEach(function(f){
      if(errors.includes(f.label)){
        var el=$g('ans_'+f.id);
        if(el){
          el.style.borderColor='#ef4444';
          el.style.background='#fff5f5';
          setTimeout(function(){
            el.style.borderColor='';
            el.style.background='';
          },3000);
        }
        // تمييز radio/checkbox
        var wrap=$g('wrap_ans_'+f.id+'_0')||document.querySelector('[name="ans_'+f.id+'"]');
        if(wrap){
          var parent=wrap.closest('div');
          if(parent){
            parent.style.border='2px solid #ef4444';
            parent.style.borderRadius='8px';
            parent.style.padding='6px';
            setTimeout(function(){parent.style.border='';parent.style.padding='';},3000);
          }
        }
      }
    });
    toast('⚠️ يرجى تعبئة: '+errors.join('، '),'er');
    // التمرير للحقل الأول الفارغ
    var firstErr=errors[0];
    var firstField=fields.find(function(f){return f.label===firstErr;});
    if(firstField){
      var el2=$g('ans_'+firstField.id);
      if(el2) el2.scrollIntoView({behavior:'smooth',block:'center'});
    }
    return;
  }
  if(!answers.length){toast('لا توجد إجابات','er');return;}
  oConfirm('بعد الإرسال لا يمكن التعديل.\nهل تريد إرسال الاستمارة الآن؟',async function(){
    clearTimeout(_rvDraftTimer); // ألغ أي حفظ مسوّدة معلّق
    ld(1);
    var r=await api('POST','submissions',{form_id:fid,answers:answers});
    ld(0);
    if(r&&r.error){toast(r.error,'er');return;}
    toast('✅ تم إرسال الاستمارة بنجاح');
    await lSub();
    rvHome();
  },{icon:'📋',yes:'إرسال',no:'مراجعة'});
}

async function rvViewSub(sid){
  ld(1);
  var r=await api('GET','submissions/'+sid);
  ld(0);
  if(r.error){toast(r.error,'er');return;}

  var h='';

  // الهيدر
  h+='<div style="margin-bottom:12px">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
  h+='<button class="btn bs bsm" onclick="rvForms()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:16px">'+htmlEsc(r.form_title||'')+'</div>';
  h+='</div>';
  h+='<div style="font-size:12px;color:var(--mid)">👤 '+(r.reviewer_name||'')+'  •  '+((r.created_at||'')).slice(0,16)+'</div>';
  h+='<div style="margin-top:6px"><span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">'+rvSubStatusLabel(r.status)+'</span></div>';
  h+='</div>';

  // ملاحظات الإدارة - تظهر فقط إذا وجدت
  if(r.reviewer_notes){
    h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-right:4px solid #f59e0b;border-radius:10px;padding:12px;margin-bottom:12px">';
    h+='<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:5px">💬 ملاحظات الإدارة</div>';
    h+='<div style="font-size:14px;color:#1e293b">'+htmlEsc(r.reviewer_notes)+'</div>';
    h+='</div>';
  }

  // بطاقات الإجابات - للاطلاع فقط بدون تمييز
  (r.answers||[]).forEach(function(a){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)">';
    h+='<div style="font-size:12px;font-weight:700;color:var(--blue2);margin-bottom:6px">'+htmlEsc(a.label||'')+'</div>';
    h+='<div style="font-size:14px;color:#1e293b;line-height:1.6">'+htmlEsc(a.answer||'—')+'</div>';
    h+='</div>';
  });

  $h('rv-pg',h);
}

async function rvChat(){
  // فحص إذا كانت المحادثات مسموحة
  if(D.cfg && D.cfg.allow_reviewer_chat === '0'){
    $h('rv-pg','<div style="text-align:center;padding:60px 16px">'
      +'<div style="font-size:48px;margin-bottom:12px">🔒</div>'
      +'<div style="font-weight:700;font-size:16px;margin-bottom:8px">المحادثات موقوفة</div>'
      +'<div style="color:var(--mid);font-size:13px">المحادثات مع الإدارة موقوفة مؤقتاً</div>'
      +'</div>');
    return;
  }

  // استخدم cache فوراً — حدّث في الخلفية صامتاً
  if(!D.cvs || !D.cvs.length){
    // أول تحميل بلا cache: اظهر مؤشّر تحميل
    try{ ld(1); var r=await api('GET','messages'); ld(0); D.cvs=Array.isArray(r)?r:[]; }catch(e){ ld(0); }
  } else {
    // cache موجود — تحديث في الخلفية بدون انتظار
    api('GET','messages').then(function(r){
      if(!Array.isArray(r)) return;
      // re-render فقط لو فيه فعلاً تغيير في عدد الرسائل غير المقروءة
      var oldUnread = (D.cvs||[]).reduce(function(n,c){return n+(+c.unread||0);},0);
      var newUnread = r.reduce(function(n,c){return n+(+c.unread||0);},0);
      D.cvs = r;
      if(oldUnread !== newUnread && window.RV_NAV === 'chat') rvChat();
    }).catch(function(){});
  }
  if(typeof window._checkUnread==='function') window._checkUnread();
  var admins=D.cvs.filter(function(x){return x.role==='admin';});
  if(!admins.length) admins=D.cvs; // fallback
  
  if(admins.length===1){
    // مدير واحد → افتح مباشرة
    rvOpenChat(admins[0]);
    return;
  }
  
  // قائمة منسدلة لاختيار المدير
  var selOpts=admins.map(function(adm){
    var unread=+adm.unread||0;
    return '<option value="'+adm.id+'">'+(adm.name||'')+(unread?' ('+unread+' جديد)':'')+'</option>';
  }).join('');
  var h='<div class="ph"><div><div class="pt">💬 المحادثات '+rvTipIcon('chat_section')+'</div></div></div>';
  h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:16px;margin-bottom:14px">';
  h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px"><div style="font-weight:700;font-size:14px;color:var(--text)">اختر المدير للمراسلة</div>'+rvTipIcon('chat_topic')+'</div>';
  h+='<div style="position:relative;margin-bottom:12px">';
  h+='<select id="adm-sel" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fff;-webkit-appearance:none;cursor:pointer">';
  h+=selOpts;
  h+='</select>';
  h+='<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:16px;color:var(--mid)">▾</span>';
  h+='</div>';
  // عرض آخر رسالة للمدير المختار
  h+='<div id="adm-preview" style="font-size:12px;color:var(--mid);min-height:18px;padding:0 4px"></div>';
  h+='<button class="btn bp" style="width:100%;margin-top:12px;padding:11px" id="adm-open-btn">💬 فتح المحادثة</button>';
  h+='</div>';
  // قائمة آخر المحادثات
  h+='<div style="font-weight:700;font-size:12px;color:var(--mid);margin-bottom:8px">آخر المحادثات</div>';
  h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;overflow:hidden">';
  admins.forEach(function(adm,i){
    var unread=+adm.unread||0;
    h+='<div style="display:flex;align-items:center;gap:11px;padding:11px 13px;cursor:pointer;'+(i>0?'border-top:1px solid var(--border)':'')+'" data-admid="'+adm.id+'">';
    h+='<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;flex-shrink:0">'+(adm.name||'م').charAt(0)+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:700;font-size:13px">'+htmlEsc(adm.name||'')+'</div>';
    if(adm.last_msg) h+='<div style="font-size:11px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(adm.last_msg.slice(0,40))+'</div>';
    h+='</div>';
    if(unread) h+='<span style="background:var(--blue);color:#fff;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0">'+unread+'</span>';
    h+='</div>';
  });
  h+='</div>';
  $h('rv-pg',h);
  // ربط الأحداث
  setTimeout(function(){
    var sel=$g('adm-sel');
    var preview=$g('adm-preview');
    function updatePreview(){
      var selAdm=admins.find(function(a){return a.id==sel.value;});
      if(preview&&selAdm&&selAdm.last_msg) preview.textContent='آخر رسالة: '+selAdm.last_msg.slice(0,60);
      else if(preview) preview.textContent='';
    }
    if(sel) sel.addEventListener('change',updatePreview);
    updatePreview();
    var btn=$g('adm-open-btn');
    if(btn) btn.addEventListener('click',function(){
      var selAdm=admins.find(function(a){return a.id==sel.value;});
      if(selAdm) rvOpenChat(selAdm);
    });
    document.querySelectorAll('[data-admid]').forEach(function(el){
      el.addEventListener('click',function(){
        var adm=admins.find(function(a){return a.id==el.dataset.admid;});
        if(adm) rvOpenChat(adm);
      });
    });
    rvBindTips();
  },50);
}

async function rvPub(){
  // استخدم D.pub المخزّن لو موجود (للسرعة)، وإلا اطلب من API
  var pubs = D.pub || [];
  if(!pubs.length){
    ld(1);
    var r = await api('GET','publications');
    ld(0);
    pubs = Array.isArray(r) ? r : [];
    D.pub = pubs;
  } else {
    // عرض من cache فوراً + تحديث صامت في الخلفية لو طرأ جديد
    api('GET','publications').then(function(r){
      if(!Array.isArray(r)) return;
      // أعد الرسم فقط لو تغيّر العدد أو آخر id (تحقّق رخيص يتجنّب re-render بلا داعٍ)
      var oldKey = (D.pub||[]).length + ':' + (((D.pub||[])[0]||{}).id||'');
      var newKey = r.length + ':' + ((r[0]||{}).id||'');
      if(oldKey === newKey) return;
      D.pub = r;
      if(window.RV_NAV === 'publications') rvPub();
    }).catch(function(){});
  }
  pubs = pubs.filter(function(p){ return p.status !== 'archived'; });

  var h = '<div class="ph"><div><div class="pt">📖 النشرات '+rvTipIcon('pub_section')+'</div>'
    + '<div class="ps">مكتبة المعرفة — قراءة وتنزيل</div></div></div>';

  if(!pubs.length){
    h += '<div style="text-align:center;padding:48px 16px;color:var(--light)">'
      + '<div style="font-size:48px;margin-bottom:12px">📖</div>'
      + '<p>لا توجد نشرات منشورة بعد</p></div>';
    $h('rv-pg', h);
    return;
  }

  if(pubs.length > 3){
    h += '<div style="margin-bottom:14px">'
      + '<input id="pub-search" type="text" placeholder="🔍 ابحث في النشرات..." '
      + 'style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:11px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fff;box-sizing:border-box" '
      + 'oninput="rvPubFilter(this.value)"></div>';
  }

  h += '<div style="font-size:11.5px;color:var(--mid);margin-bottom:10px;text-align:center">'
    + pubs.length + ' '+(pubs.length===1?'نشرة':'نشرات')+' متاحة</div>';

  h += '<div id="pub-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:11px">';
  pubs.forEach(function(p){ h += _rvPubCard(p); });
  h += '</div>';

  $h('rv-pg', h);
  setTimeout(function(){ rvBindTips(); }, 30);
}

function _rvPubCard(p){
  var isPdf = p.type === 'pdf';
  var icon, color, label, labelBg, coverBg;
  if(isPdf){
    icon = '📄'; color = '#dc2626'; label = 'PDF'; labelBg = '#fee2e2';
    coverBg = 'linear-gradient(135deg,#fee2e2,#fef2f2)';
  } else {
    icon = '📝'; color = '#2563b0'; label = 'مقال'; labelBg = '#dbeafe';
    coverBg = 'linear-gradient(135deg,#dbeafe,#eff6ff)';
  }
  var title = htmlEsc(p.title || 'بدون عنوان');
  var titleQ = ((p.title || '') + ' ' + (p.description || '')).toLowerCase().replace(/"/g,'&quot;');
  var desc = htmlEsc(p.description || '');
  var date = (p.created_at || '').slice(0, 10);
  return '<div class="pub-card" data-q="' + titleQ + '" '
    + 'style="background:#fff;border:1px solid var(--border);border-radius:13px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:transform .15s,box-shadow .15s" '
    + 'onclick="rvOpenPub(' + p.id + ')" '
    + 'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(0,0,0,.08)\'" '
    + 'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
    + '<div style="position:relative;aspect-ratio:1;background:' + coverBg + ';display:flex;align-items:center;justify-content:center">'
    + '<div style="font-size:48px">' + icon + '</div>'
    + '<span style="position:absolute;top:8px;right:8px;background:' + labelBg + ';color:' + color + ';font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">' + label + '</span>'
    + '</div>'
    + '<div style="padding:10px;flex:1;display:flex;flex-direction:column;gap:4px">'
    + '<div style="font-weight:700;font-size:13px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + title + '</div>'
    + (desc ? '<div style="font-size:11px;color:var(--mid);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + desc + '</div>' : '')
    + '<div style="font-size:10px;color:var(--light);margin-top:auto;padding-top:4px">' + date + '</div>'
    + '</div></div>';
}

window.rvPubFilter = function(query){
  var q = (query || '').toLowerCase().trim();
  document.querySelectorAll('#pub-grid .pub-card').forEach(function(el){
    var t = el.dataset.q || '';
    el.style.display = (!q || t.indexOf(q) >= 0) ? '' : 'none';
  });
};

window.rvOpenPub = async function(id){
  var p = (D.pub || []).find(function(x){ return x.id == id; });
  if(!p){
    ld(1);
    p = await api('GET', 'publications/' + id);
    ld(0);
    if(!p || p.error){ toast((p && p.error) || 'تعذّر التحميل', 'er'); return; }
  } else {
    api('GET', 'publications/' + id).catch(function(){});
  }
  if(p.type === 'pdf'){ rvShowPubPdf(p); }
  else { rvShowPubArticle(p); }
};

function rvShowPubPdf(p){
  var url = p.file_path || '';
  if(!url){
    if(typeof oAlert==='function') oAlert('الملف غير متوفّر', {icon: '⚠️', danger: true});
    else toast('الملف غير متوفّر','er');
    return;
  }
  // عارض PDF.js احترافي بداخل الموقع — تكبير/تصغير، عدد الصفحات، تمرير سلس
  if (typeof window.openPdfViewer === 'function'){
    window.openPdfViewer(url, p.title || '', {
      description: p.description || '',
      onDownload: function(){ rvDownloadPub(url, p.title); }
    });
    return;
  }
  // احتياط لو لم تُحمَّل المكتبة: افتح في تبويب جديد
  window.open(url, '_blank', 'noopener');
}

function rvShowPubArticle(p){
  var content = (p.content || '').trim();
  if(!content){
    if(typeof oAlert==='function') oAlert('لا يوجد محتوى في هذا المقال', {icon: 'ℹ️'});
    else toast('لا يوجد محتوى','er');
    return;
  }
  var rendered = (typeof mdRender === 'function')
    ? mdRender(content)
    : '<div style="white-space:pre-wrap">' + htmlEsc(content) + '</div>';
  var h = '';
  if(p.description){
    h += '<div style="font-size:12.5px;color:var(--mid);font-style:italic;margin-bottom:14px;padding:9px 12px;background:#f8fafc;border-right:3px solid #cbd5e1;border-radius:8px">'
      + htmlEsc(p.description) + '</div>';
  }
  h += '<div style="font-size:14.5px;color:#1e293b;line-height:1.85">' + rendered + '</div>';
  h += '<div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--border)">'
    + '<button class="btn bs" style="width:100%" onclick="cM()">إغلاق</button></div>';
  oM('📝 ' + htmlEsc(p.title || ''), h);
}

window.rvDownloadPub = async function(url, title){
  try {
    var r = await fetch(url);
    if(!r.ok) throw new Error('fetch failed: ' + r.status);
    var blob = await r.blob();
    var dlUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = dlUrl;
    a.download = ((title || 'publication') + '').replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(dlUrl); }, 1500);
    toast('✅ بدأ التنزيل');
  } catch(e) {
    var a = document.createElement('a');
    a.href = url;
    a.download = ((title || 'publication') + '').replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('📥 افتح الرابط ثم احفظ من المتصفّح');
  }
};

async function rvAppointments(){
  // اعرض من cache فوراً (لا انتظار) — ثم حدّث في الخلفية
  var hasCache = (D.apt && D.apt.length) || (D.dts && D.dts.length);
  if(hasCache){
    _rvAptsRender(D.apt||[], D.dts||[]);
    // حدّث في الخلفية بصمت
    Promise.all([api('GET','appointments'),api('GET','dates')]).then(function(res){
      var a = Array.isArray(res[0])?res[0]:[];
      var d = Array.isArray(res[1])?res[1]:[];
      D.apt = a; D.dts = d;
      _rvAptsRender(a, d);
    }).catch(function(){});
    return;
  }
  // أوّل تحميل (لا cache) — اعرض مؤشّر تحميل
  ld(1);
  var res=await Promise.all([api('GET','appointments'),api('GET','dates')]);
  ld(0);
  var myApts=Array.isArray(res[0])?res[0]:[];
  var allDates=Array.isArray(res[1])?res[1]:[];
  D.apt = myApts; D.dts = allDates;
  _rvAptsRender(myApts, allDates);
}

function _rvAptsRender(myApts, allDates){
  myApts = myApts || [];
  allDates = allDates || [];
  var today=new Date().toISOString().slice(0,10);
  // حالة التنقّل بالشهر — يبقى محفوظاً بين الـ renders
  if(!window._rvAptCalDate) window._rvAptCalDate = new Date();
  // كل أيام المستقبل بكل الحالات (يُعرض للمراجع — الحجز فقط للمتاح)
  var futureDates=allDates.filter(function(d){
    return !d.date || (d.date||'').slice(0,10)>=today;
  });
  // "نشط" = pending/confirmed وتاريخه اليوم أو لاحقاً.
  function isActiveApt(a){
    if(!['pending','confirmed'].includes(a.status)) return false;
    return !a.date || a.date >= today;
  }
  var activApts=myApts.filter(isActiveApt);
  var pastApts =myApts.filter(function(a){ return !isActiveApt(a); });
  // فهرس الحجوزات بـ date_id لمعرفة من حجز كل فترة
  var bookingByDateId={};
  myApts.forEach(function(a){
    if(a.date_id && ['pending','confirmed'].includes(a.status)) bookingByDateId[+a.date_id]=a;
  });

  var h='';

  // رأس مع تعليمات
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
  h+='<div style="font-weight:800;font-size:15px;color:#0f172a">📅 المواعيد</div>';
  h+=rvTipIcon('apt_section');
  h+=rvTipIcon('apt_calendar');
  h+=rvTipIcon('apt_book');
  h+='</div>';

  // ─── تقويم بصري للمراجع: كل الأيام القادمة بألوانها ──────────────
  h += _rvAptCalendar(futureDates, myApts, today);

  // تنبيه مضغوط
  h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-right:4px solid #f59e0b;border-radius:10px;padding:10px 12px;font-size:12px;color:#92400e;margin-bottom:12px">'
    +'💡 يتم تأكيد المواعيد في نفس اليوم بعد الظهر.</div>';

  // مواعيدي النشطة
  if(activApts.length){
    h+='<div style="font-weight:800;font-size:13px;margin-bottom:8px;color:var(--blue2)">📌 مواعيدي النشطة</div>';
    activApts.forEach(function(a){
      var isExc=a.is_exceptional;
      var bc=a.status==='confirmed'?'#2563b0':'#d97706';
      h+='<div style="background:#fff;border:1.5px solid var(--border);border-right:5px solid '+bc
        +';border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,.06)">';
      if(isExc) h+='<span style="background:#fdf4ff;color:#9333ea;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;display:inline-block;margin-bottom:6px">⭐ استثنائي</span><br>';
      h+='<div style="font-weight:800;font-size:16px;margin-bottom:5px">'+(a.slot_name||'—')+'</div>';
      h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
      h+='<span style="font-size:13px;color:var(--mid)">📅 '+(a.date||'—')+'</span>';
      h+='<span class="apt-badge '+a.status+'">'+rvAptLabel(a.status)+'</span>';
      h+='</div>';
      if(a.notes) h+='<div style="font-size:12px;color:var(--mid);background:#f8fafd;padding:6px 10px;border-radius:8px;margin-bottom:8px">📝 '+a.notes+'</div>';
      if(a.status==='pending'){
        h+='<button class="btn bd bsm" style="width:100%" data-cancelapt="'+a.id+'">↩️ إلغاء الحجز</button>';
      }
      h+='</div>';
    });
  }

  // قائمة كل الأيام القادمة (متاح + محجوز + مغلق) — الحجز للمتاح فقط
  h+='<div style="font-weight:800;font-size:13px;margin-bottom:10px;color:var(--blue2)">📅 المواعيد القادمة</div>';

  if(!futureDates.length){
    h+='<div style="text-align:center;padding:40px 16px;color:var(--light)">'
      +'<div style="font-size:40px;margin-bottom:10px">📅</div>'
      +'<p>لا توجد مواعيد قادمة</p></div>';
  } else {
    var grouped={};
    futureDates.forEach(function(d){
      var key=(d.date||'').slice(0,10);
      if(!grouped[key])grouped[key]=[];
      grouped[key].push(d);
    });
    var AR_DAYS3=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    var hasActive = activApts.length > 0;
    Object.keys(grouped).sort().forEach(function(date){
      var slots=grouped[date];
      var isToday=date===today;
      var dt3=new Date(date);
      var dayName=AR_DAYS3[dt3.getDay()];
      h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.04)">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
      h+='<span style="font-weight:800;font-size:14px">'+dayName+'</span>';
      h+='<span style="font-size:12px;color:var(--mid)">'+date+'</span>';
      if(isToday) h+='<span style="background:var(--blue);color:#fff;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:700">اليوم</span>';
      h+='</div>';
      slots.forEach(function(s){
        var booking = bookingByDateId[+s.id];
        var st = s.status;
        if(booking) st = 'booked';
        // ألوان وأنماط حسب الحالة
        var bg='#f0fdf4', bdr='#bbf7d0', label='', labelClr='', labelBg='';
        var canBook = false, isMine = false;
        if(st === 'available'){
          bg='#f0fdf4'; bdr='#bbf7d0'; label='✓ متاح'; labelClr='#15803d'; labelBg='#dcfce7';
          canBook = !hasActive; // لا يستطيع الحجز لو لديه موعد نشط
        } else if(st === 'booked'){
          isMine = booking && +booking.reviewer_id === +(U && U.id);
          bg = isMine ? '#eff6ff' : '#f8fafc';
          bdr = isMine ? '#bfdbfe' : '#e2e8f0';
          label = isMine ? '📌 محجوز لك' : '📌 محجوز';
          labelClr = isMine ? '#1e40af' : '#64748b';
          labelBg = isMine ? '#dbeafe' : '#f1f5f9';
        } else if(st === 'locked'){
          bg='#f8fafc'; bdr='#e2e8f0'; label='🔒 مغلق'; labelClr='#64748b'; labelBg='#f1f5f9';
        }
        h+='<div style="display:flex;align-items:center;justify-content:space-between;background:'+bg+';border:1px solid '+bdr+';border-radius:9px;padding:10px 12px;margin-bottom:6px;gap:8px">';
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="font-weight:700;font-size:14px;color:#0f172a">'+s.slot_name+'</div>';
        if(s.time_from) h+='<div style="font-size:11px;color:var(--mid);margin-top:1px">'+(s.time_from||'').slice(0,5)+'</div>';
        h+='</div>';
        h+='<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">';
        if(label) h+='<span style="background:'+labelBg+';color:'+labelClr+';padding:3px 9px;border-radius:18px;font-size:11px;font-weight:700;white-space:nowrap">'+label+'</span>';
        if(canBook) h+='<button class="btn bp" style="padding:7px 12px;font-size:12px" data-book="'+s.id+'">حجز</button>';
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
    });
    if(hasActive){
      h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:10px 12px;font-size:12px;color:#92400e;margin-bottom:10px">'
        +'⚠️ لديك موعد نشط. أتمم الموعد أو ألغه لتتمكّن من حجز موعد جديد.</div>';
    }
  }

  // السجل — يشمل المواعيد الفائتة (مؤكدة/معلّقة مرّ تاريخها)
  if(pastApts.length){
    // الأحدث أولاً
    pastApts.sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
    h+='<div style="display:flex;align-items:center;gap:6px;margin:14px 0 8px"><div style="font-weight:800;font-size:12px;color:var(--mid)">السجل</div>'+rvTipIcon('apt_eval')+'</div>';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;overflow:hidden">';
    pastApts.slice(0,8).forEach(function(a,i){
      // حدّد الحالة المعروضة — pending/confirmed مرّ تاريخها = موعد فائت
      var displayStatus=a.status;
      if(['pending','confirmed'].includes(a.status) && a.date && a.date < today){
        displayStatus='missed';
      }
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;gap:8px;flex-wrap:wrap;'+(i>0?'border-top:1px solid var(--border)':'')+';">';
      h+='<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">'+(a.slot_name||'—')+'</div>'
        +'<div style="font-size:11px;color:var(--mid)">'+a.date+'</div></div>';
      h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
      h+='<span class="apt-badge '+displayStatus+'" style="white-space:nowrap">'+rvAptLabel(displayStatus)+'</span>';
      // زر التقييم — يظهر فقط للجلسات التي اعتمدها المشرف
      if(displayStatus==='completed'){
        h+='<button class="btn bp bsm" data-rveval="'+a.id+'" data-rvevaldate="'+(a.date||'')+'" data-rvevalslot="'+htmlEsc(a.slot_name||'')+'" style="background:#075e54;font-size:11.5px;padding:5px 10px">📝 التقييم</button>';
      }
      h+='</div>';
      h+='</div>';
    });
    h+='</div>';
  }

  $h('rv-pg',h);

  // ربط الأزرار
  setTimeout(function(){
    document.querySelectorAll('[data-book]').forEach(function(btn){
      btn.addEventListener('click',function(){rvBook(+btn.dataset.book);});
    });
    document.querySelectorAll('[data-cancelapt]').forEach(function(btn){
      btn.addEventListener('click',function(){rvCancelApt(+btn.dataset.cancelapt);});
    });
    document.querySelectorAll('[data-rveval]').forEach(function(btn){
      btn.addEventListener('click',function(){
        rvOpenSessionEval(+btn.dataset.rveval, btn.dataset.rvevaldate||'', btn.dataset.rvevalslot||'');
      });
    });
    rvBindTips();
  },50);
}

// ─── تقويم بصري للمراجع — متاح/محجوز/مغلق + اضغط للحجز ─────────────
function _rvAptCalendar(futureDates, myApts, today){
  var d = window._rvAptCalDate;
  var y = d.getFullYear();
  var m = d.getMonth();
  var AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var AR_DAYS=['أح','إث','ثل','أر','خم','جم','سب'];
  var firstDay = new Date(y, m, 1).getDay();
  var daysInMonth = new Date(y, m+1, 0).getDate();
  // ربط الحجوزات لمعرفة من حجزها
  var myId = +(U && U.id) || 0;
  var bookByDateId = {};
  myApts.forEach(function(a){
    if(a.date_id && ['pending','confirmed'].includes(a.status)) bookByDateId[+a.date_id]=a;
  });

  var h='';
  // هيدر التنقل
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;background:#fff;padding:8px 10px;border-radius:10px;border:1px solid var(--border)">';
  h+='<button data-rvcalmove="-1" style="background:var(--blue-bg);border:none;color:var(--blue);width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:17px;font-weight:700">‹</button>';
  h+='<div style="font-weight:800;font-size:14px">'+AR_MONTHS[m]+' '+y+'</div>';
  h+='<button data-rvcalmove="1" style="background:var(--blue-bg);border:none;color:var(--blue);width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:17px;font-weight:700">›</button>';
  h+='</div>';

  // رؤوس الأيام
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">';
  AR_DAYS.forEach(function(d){
    h+='<div style="text-align:center;font-size:10px;font-weight:700;color:var(--mid);padding:3px 0">'+d+'</div>';
  });
  h+='</div>';

  // الخلايا
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px">';
  for(var i=0;i<firstDay;i++) h+='<div></div>';
  for(var d2=1;d2<=daysInMonth;d2++){
    var dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
    var isPast = dateStr<today;
    var isToday = dateStr===today;
    var daySlots = futureDates.filter(function(s){ return (s.date||'').slice(0,10)===dateStr; });
    var hasMyBooking = daySlots.some(function(s){ var b=bookByDateId[+s.id]; return b && +b.reviewer_id===myId; });
    var hasBooked = daySlots.some(function(s){ return bookByDateId[+s.id]; });
    var hasAvail = daySlots.some(function(s){ return s.status==='available' && !bookByDateId[+s.id]; });
    var hasLocked = daySlots.some(function(s){ return s.status==='locked'; });

    var bg='#fff', border='var(--border)', numClr='var(--text)';
    if(isPast){ bg='#f9fafb'; numClr='#cbd5e1'; }
    else if(hasMyBooking){ bg='#dbeafe'; border='#1e40af'; numClr='#1e3a8a'; }
    else if(hasBooked){ bg='#f1f5f9'; border='#94a3b8'; numClr='#475569'; }
    else if(hasAvail){ bg='#dcfce7'; border='#22c55e'; numClr='#15803d'; }
    else if(hasLocked){ bg='#f1f5f9'; border='#94a3b8'; numClr='#475569'; }
    if(isToday && !hasMyBooking && !hasBooked && !hasAvail && !hasLocked){ bg='var(--blue-bg)'; border='var(--blue)'; }

    var mark='';
    if(hasMyBooking){
      mark='<div style="background:#1e40af;color:#fff;font-size:8px;font-weight:800;padding:1px 3px;border-radius:5px;margin:1px 1px 0;line-height:1.3">✓ حجزك</div>';
    } else if(hasBooked){
      mark='<div style="background:#64748b;color:#fff;font-size:8px;font-weight:800;padding:1px 3px;border-radius:5px;margin:1px 1px 0;line-height:1.3">محجوز</div>';
    } else if(hasAvail){
      mark='<div style="background:#15803d;color:#fff;font-size:8px;font-weight:800;padding:1px 3px;border-radius:5px;margin:1px 1px 0;line-height:1.3">متاح</div>';
    } else if(hasLocked){
      mark='<div style="background:#64748b;color:#fff;font-size:8px;font-weight:800;padding:1px 3px;border-radius:5px;margin:1px 1px 0;line-height:1.3">مغلق</div>';
    }

    h+='<div style="background:'+bg+';border:1.5px solid '+border+';border-radius:7px;padding:3px 1px;text-align:center;min-height:44px">';
    h+='<div style="font-size:12px;font-weight:700;color:'+numClr+'">'+d2+'</div>';
    h+=mark;
    h+='</div>';
  }
  h+='</div>';

  // مفتاح ألوان
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10.5px;color:var(--mid);justify-content:center;margin-bottom:10px">';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#dcfce7;border:1.5px solid #22c55e;border-radius:3px"></span>متاح</span>';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#dbeafe;border:1.5px solid #1e40af;border-radius:3px"></span>حجزك</span>';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#f1f5f9;border:1.5px solid #94a3b8;border-radius:3px"></span>محجوز/مغلق</span>';
  h+='</div>';

  // اربط أزرار التنقل بعد رسم الصفحة
  setTimeout(function(){
    document.querySelectorAll('[data-rvcalmove]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window._rvAptCalDate.setMonth(window._rvAptCalDate.getMonth() + (+btn.dataset.rvcalmove));
        rvAppointments();
      });
    });
  }, 30);

  return h;
}

function rvAptLabel(s){
  // التصنيف الموحّد: متاح / محجوز / ملغى / فائت / مغلق
  const m={
    available:'✓ متاح',
    pending:'📌 محجوز · بانتظار التأكيد',
    confirmed:'✅ محجوز · مؤكد',
    booked:'📌 محجوز',
    completed:'🏁 انتهى',
    missed:'⏰ فائت',
    no_show:'⏰ فائت',
    locked:'🔒 مغلق',
    exceptional:'⭐ استثنائي',
    cancelled_admin:'❌ ملغى (الإدارة)',
    cancelled_reviewer:'↩️ ملغى (أنت)'
  };
  return m[s]||s;
}

async function rvBook(dateId){
  if(!confirm('تأكيد حجز هذا الموعد؟\n\nسيتم التأكيد من قبل الإدارة في نفس اليوم.'))return;
  ld(1);const r=await api('POST','appointments',{date_id:+dateId});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('✅ تم الحجز — بانتظار التأكيد');

  await Promise.all([lApt(),lDts()]);
  rvAppointments();
}

async function rvCancelApt(id){
  if(!confirm('إلغاء هذا الموعد؟'))return;
  ld(1);await api('PUT','appointments/'+id,{status:'cancelled_reviewer'});ld(0);
  toast('تم الإلغاء');
  await Promise.all([lApt(),lDts()]);
  rvAppointments();
}

// ─── البيانات الشخصية كتصنيف #1 (شكل التصنيف، حقول معطّلة) ───────
function _rvPersonalCategory(catNumber){
  if(!U) return '';
  // الحقول السبعة بنفس شكل حقول الاستمارة لكن disabled
  // الزرّ ✏️ يوجّه المراجع لتعديل ملفه الأصلي
  var DIS_INP = 'width:100%;padding:7px 11px;border:1px solid #e2e8f0;border-radius:9px;font-family:Cairo,sans-serif;font-size:15px;font-weight:600;line-height:22px;outline:none;background:#f8fafc;color:#0f172a;box-sizing:border-box;cursor:not-allowed';

  var fields = [
    { lbl:'الاسم',       val: U.name || '',                            icon:'🪪' },
    { lbl:'الجنس',       val: U.gender==='male'?'رجل':(U.gender==='female'?'امرأة':''), icon:'⚧' },
    { lbl:'العمر',       val: U.age ? String(U.age) : '',              icon:'🎂' },
    { lbl:'الطول',       val: U.height ? (U.height+' سم') : '',        icon:'📏' },
    { lbl:'الوزن',       val: U.weight ? (U.weight+' كجم') : '',       icon:'⚖️' },
    { lbl:'طبيعة العمل', val: U.occupation || '',                       icon:'💼' },
    { lbl:'مكان الإقامة', val: U.residence || '',                       icon:'📍' }
  ];

  var h = '<div style="background:#fff;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px 6px;margin-bottom:10px;box-shadow:0 1px 2px rgba(15,23,42,.04)">';
  // هيدر التصنيف — مطابق لبقية التصنيفات + زر تعديل
  h += '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;padding-bottom:7px;border-bottom:1px solid #f1f5f9">';
  h += '<div style="width:20px;height:20px;border-radius:50%;background:#dcf8c6;color:#075e54;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">'+catNumber+'</div>';
  h += '<div style="font-weight:700;font-size:13px;color:#1e293b">البيانات الشخصية</div>';
  h += '<div style="margin-right:auto;display:flex;align-items:center;gap:8px">';
  h += '<span style="font-size:10.5px;color:#94a3b8">'+fields.length+' حقل</span>';
  h += '<button type="button" onclick="rvProfile()" title="تعديل بياناتك من الملف الأصلي" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;cursor:pointer;font-size:11px;font-weight:700;padding:3px 9px;border-radius:14px;display:inline-flex;align-items:center;gap:4px;font-family:Cairo,sans-serif">✏️ تعديل</button>';
  h += '</div></div>';

  fields.forEach(function(f, i){
    var isLast = i === fields.length - 1;
    h += '<div style="padding:7px 0'+(isLast?'':';border-bottom:1px solid #f1f5f9')+'">';
    h += '<label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;color:#334155">'
      + '<span style="margin-left:4px">'+f.icon+'</span>'
      + htmlEsc(f.lbl)
      + '</label>';
    h += '<input type="text" disabled value="'+htmlEsc(f.val||'').replace(/"/g,'&quot;')+'" style="'+DIS_INP+'" placeholder="—">';
    h += '</div>';
  });

  h += '<div style="font-size:10.5px;color:#94a3b8;margin-top:6px;text-align:center;padding:5px 0">🔒 للقراءة فقط — لتعديلها من ملفك الشخصي</div>';
  h += '</div>';
  return h;
}


// ─── منبثقة التنبيهات الترحيبية للمراجع ─────────────────────────────
// تظهر في كل مرة يدخل المراجع الرئيسية ما دامت هناك أمور معلّقة
// (استمارة لم تُعبّأ / موعد متاح / رسائل غير مقروءة).
// تختفي تلقائياً حين تُحلّ — لا تحتاج تذكُّر إغلاقها.
// Cool-down قصير ٨ ثوانٍ يمنع إعادة الظهور فوراً بعد إغلاقها (UX).
function _rvMaybeShowNotifications(notif){
  // اعرض المنبثقة لو فيه أيّ شيء يستحقّ الانتباه — بما في ذلك حجز نشط
  var total = (notif.pendingForms||0) + (notif.availSlots||0) + (notif.unread||0) + (notif.activeBooking?1:0) + (notif.sessionsToEvaluate||0);
  if (!total) return;
  var now = Date.now();
  var cooldown = +(window._rvNotifClosedAt || 0);
  if (cooldown && (now - cooldown) < 8000) return;
  setTimeout(function(){ _rvNotifShow(notif); }, 250);
}

window._rvNotifShow = function(notif){
  var prev = document.getElementById('rv-notif-ov'); if (prev) prev.remove();
  var ov = document.createElement('div');
  ov.id = 'rv-notif-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;padding:14px;font-family:Cairo,sans-serif;animation:wcfade .15s ease-out';

  var items = [];
  if (notif.pendingForms > 0){
    items.push({
      icon: '📋', bg: '#fef3c7', clr: '#92400e', bdr: '#fbbf24',
      title: 'استمارات تحتاج تعبئة',
      sub: 'لديك ' + notif.pendingForms + ' ' + (notif.pendingForms===1?'استمارة مرشّحة':'استمارات مرشّحة') + ' لم تُعبّأ بعد',
      goto: 'forms', btn: 'افتح الاستمارات',
    });
  }
  // بطاقة المواعيد — تظهر دائماً حسب الحالة:
  //   • عنده حجز نشط → تذكير بالموعد القادم
  //   • لا حجز + يوجد متاح → دعوة للحجز
  //   • لا حجز + لا متاح → لا بطاقة
  if (notif.activeBooking){
    var b = notif.activeBooking;
    var statusLbl = b.status==='confirmed' ? 'مؤكّد ✅' : 'بانتظار التأكيد ⏳';
    items.push({
      icon: '📅', bg: '#dbeafe', clr: '#1e40af', bdr: '#3b82f6',
      title: 'موعدك القادم',
      sub: (b.slot_name||'موعد') + ' · ' + (b.date||'—') + ' · ' + statusLbl,
      goto: 'appointments', btn: 'عرض موعدي',
    });
  } else if (notif.availSlots > 0){
    items.push({
      icon: '📅', bg: '#dcfce7', clr: '#15803d', bdr: '#22c55e',
      title: 'مواعيد متاحة للحجز',
      sub: 'يوجد ' + notif.availSlots + ' ' + (notif.availSlots===1?'موعد متاح':'موعد متاح') + ' لحجزه',
      goto: 'appointments', btn: 'احجز موعداً',
    });
  }
  if (notif.unread > 0){
    items.push({
      icon: '💬', bg: '#dbeafe', clr: '#1e40af', bdr: '#3b82f6',
      title: 'رسائل جديدة',
      sub: 'لديك ' + notif.unread + ' ' + (notif.unread===1?'رسالة لم تُقرأ':'رسائل لم تُقرأ'),
      goto: 'chat', btn: 'افتح المحادثة',
    });
  }
  if (notif.sessionsToEvaluate > 0){
    var lc = notif.latestCompletedApt;
    var subTxt = lc ? ('جلسة '+(lc.slot_name||'')+' · '+(lc.date||'')) : (notif.sessionsToEvaluate+' جلسة');
    items.push({
      icon: '📝', bg: '#fef3c7', clr: '#075e54', bdr: '#0d9488',
      title: 'تقييم بعد الجلسة',
      sub: subTxt,
      goto: 'appointments', btn: 'افتح التقييم',
    });
  }

  var cards = items.map(function(it){
    return '<div style="display:flex;align-items:center;gap:11px;background:'+it.bg+';border:1px solid '+it.bdr+';border-right:5px solid '+it.clr+';border-radius:12px;padding:11px 12px;margin-bottom:9px">'
      + '<div style="font-size:28px;flex-shrink:0">'+it.icon+'</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-weight:800;font-size:13.5px;color:'+it.clr+'">'+it.title+'</div>'
      +   '<div style="font-size:11.5px;color:'+it.clr+';opacity:.85;margin-top:1px;line-height:1.5">'+it.sub+'</div>'
      + '</div>'
      + '<button data-rvnotifgo="'+it.goto+'" style="background:'+it.clr+';color:#fff;border:none;padding:8px 12px;border-radius:9px;font-family:Cairo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;white-space:nowrap">'+it.btn+' ←</button>'
      + '</div>';
  }).join('');

  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:18px 18px 0 0;padding:18px 16px 22px;width:100%;max-width:480px;box-shadow:0 -8px 30px rgba(0,0,0,.25);animation:slide-up .25s ease;max-height:80vh;overflow-y:auto';
  box.innerHTML =
    '<div style="width:40px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 14px"></div>'
    + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">'
    +   '<div style="font-size:24px">⚡</div>'
    +   '<div style="flex:1"><div style="font-weight:800;font-size:16px;color:#0f172a">مرحباً '+htmlEsc((U&&U.name)||'')+'</div>'
    +   '<div style="font-size:12px;color:var(--mid);margin-top:1px">إليك ما يحتاج اهتمامك:</div></div>'
    + '</div>'
    + cards
    + '<button id="rv-notif-close" style="width:100%;padding:11px;background:#f1f5f9;color:#475569;border:none;border-radius:11px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;margin-top:6px">حسناً، لاحقاً</button>';

  ov.appendChild(box);
  document.body.appendChild(ov);

  function close(){
    window._rvNotifClosedAt = Date.now(); // فعّل الـ cooldown ضد إعادة الظهور الفوري
    ov.remove();
  }
  document.getElementById('rv-notif-close').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
  box.querySelectorAll('[data-rvnotifgo]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var page = btn.getAttribute('data-rvnotifgo');
      close();
      if (typeof rvGo === 'function') rvGo(page);
    });
  });
};

// ─── تقييم ما بعد الجلسة ───────────────────────────────────────────
// المعايير تُحمَّل ديناميكياً من session_eval_fields ويمكن إدارتها من الإعدادات.
window.rvOpenSessionEval = async function(aptId, dateStr, slotName){
  oM('📝 تقييم الجلسة',
    '<div style="text-align:center;padding:30px 8px;color:var(--mid);font-size:13px">'
    + '<div style="font-size:28px;margin-bottom:8px">⏳</div>جاري تحميل التقييمات…</div>');
  var res = await Promise.all([
    api('GET','session_evals?appointment_id='+aptId),
    api('GET','session_eval_fields')
  ]);
  if(res[0] && res[0].error){ toast(res[0].error,'er'); cM(); return; }
  var rows = Array.isArray(res[0]) ? res[0] : [];
  var fields = Array.isArray(res[1]) ? res[1] : [];
  _rvRenderSessionEval(aptId, dateStr, slotName, rows, fields);
};

function _rvRenderSessionEval(aptId, dateStr, slotName, rows, fields){
  var h='';
  h+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:10px">';
  h+='<div style="font-weight:800;font-size:13px;color:#075e54">جلسة '+(slotName||'—')+'</div>';
  h+='<div style="font-size:11.5px;color:#15803d;margin-top:2px">📅 '+(dateStr||'—')+' · يمكنك إضافة أكثر من تقييم</div>';
  h+='</div>';

  if(rows.length){
    h+='<div style="max-height:38vh;overflow-y:auto;padding:2px;margin-bottom:10px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">';
    rows.forEach(function(r){
      var isAdmin = r.author_role==='admin';
      var bg = isAdmin ? '#fef3c7' : '#dbeafe';
      var bdr = isAdmin ? '#fbbf24' : '#3b82f6';
      var clr = isAdmin ? '#92400e' : '#1e40af';
      var nm = htmlEsc(r.author_name || (isAdmin?'المشرف':'مراجع'));
      var dt = (r.created_at||'').replace('T',' ').slice(0,16);
      h+='<div style="background:'+bg+';border:1px solid '+bdr+';border-right:4px solid '+clr+';border-radius:8px;padding:8px 10px;margin:6px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px">';
      h+='<div style="font-weight:800;font-size:11.5px;color:'+clr+'">'+(isAdmin?'👨‍⚕️ ':'👤 ')+nm+'</div>';
      h+='<div style="font-size:10.5px;color:'+clr+';opacity:.75">'+dt+'</div>';
      h+='</div>';
      var ans = r.answers || {};
      var any=false;
      // أولاً المعايير الحالية بترتيبها
      fields.forEach(function(f){
        var v=ans[String(f.id)];
        if(v && String(v).trim()){
          any=true;
          h+='<div style="margin-top:4px;font-size:12px;color:#0f172a"><b style="color:'+clr+'">'+(f.icon||'·')+' '+htmlEsc(f.label)+':</b> '+htmlEsc(v)+'</div>';
        }
      });
      // ثم أي إجابات معاييرها محذوفة (يظهر مفتاحها فقط)
      var knownIds = {}; fields.forEach(function(f){ knownIds[String(f.id)]=1; });
      Object.keys(ans).forEach(function(k){
        if(!knownIds[k] && ans[k] && String(ans[k]).trim()){
          any=true;
          h+='<div style="margin-top:4px;font-size:12px;color:#94a3b8;font-style:italic">(معيار محذوف): '+htmlEsc(ans[k])+'</div>';
        }
      });
      if(!any) h+='<div style="font-size:12px;color:#0f172a;font-style:italic">—</div>';
      h+='</div>';
    });
    h+='</div>';
  } else {
    h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;color:#94a3b8;font-size:12.5px;margin-bottom:10px">لا تقييمات سابقة لهذه الجلسة</div>';
  }

  h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">';
  h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><div style="font-weight:800;font-size:13px;color:#0f172a">✍️ تقييم جديد</div>'+rvTipIcon('apt_eval')+'</div>';
  if(!fields.length){
    h+='<div style="font-size:12px;color:var(--mid);text-align:center;padding:10px">لا توجد معايير معدّة. اطلب من الإدارة إضافتها.</div>';
  } else {
    fields.forEach(function(f){
      h+='<div style="margin-bottom:8px">';
      h+='<label style="display:block;font-size:11.5px;color:#475569;font-weight:700;margin-bottom:3px">'+(f.icon||'·')+' '+htmlEsc(f.label)+'</label>';
      h+='<textarea id="se-'+f.id+'" rows="2" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;outline:none;resize:vertical;box-sizing:border-box" placeholder="اكتب ملاحظتك..."></textarea>';
      h+='</div>';
    });
  }
  h+='<div style="display:flex;gap:9px;margin-top:8px">';
  if(fields.length) h+='<button class="btn bp" id="se-save" data-apt="'+aptId+'" style="background:#075e54;flex:1">💾 إرسال التقييم</button>';
  h+='<button class="btn bs" onclick="cM()">إغلاق</button>';
  h+='</div>';
  h+='</div>';

  $h('mb', h);

  setTimeout(function(){
    var btn=document.getElementById('se-save'); if(!btn) return;
    btn.addEventListener('click', async function(){
      var answers={};
      var hasAny=false;
      fields.forEach(function(f){
        var v=(document.getElementById('se-'+f.id)?.value||'').trim();
        if(v){ answers[String(f.id)]=v; hasAny=true; }
      });
      if(!hasAny){ toast('أضف ملاحظة واحدة على الأقل','er'); return; }
      ld(1);
      var r=await api('POST','session_evals',{ appointment_id: aptId, answers: answers });
      ld(0);
      if(r&&r.error){ toast(r.error,'er'); return; }
      toast('✅ تم الإرسال');
      var res = await api('GET','session_evals?appointment_id='+aptId);
      _rvRenderSessionEval(aptId, dateStr, slotName, Array.isArray(res)?res:[], fields);
    });
    rvBindTips(document.getElementById('mb'));
  }, 30);
}
