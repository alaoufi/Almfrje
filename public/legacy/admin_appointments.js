/* admin_appointments.js */

function pApt(){
  window.APT_TAB=window.APT_TAB||'calendar';
  window.APT_FILTER=window.APT_FILTER||'all';
  $h('pg',
    '<div class="ph"><div><div class="pt">📅 المواعيد</div></div>'
    +'<button class="btn bp bsm" onclick="oSlt()">+ فترة</button></div>'
    // تبويبات - مصممة للجوال
    +'<div style="display:flex;gap:0;margin-bottom:14px;background:#f1f5f9;padding:4px;border-radius:12px">'
    +'<button style="flex:1;padding:8px 4px;border:none;border-radius:9px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;transition:all .18s;'
      +(window.APT_TAB==='calendar'?'background:#fff;color:var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.1)':'background:transparent;color:var(--mid)')
      +'" data-apttab="calendar">📅 التقويم</button>'
    +'<button style="flex:1;padding:8px 4px;border:none;border-radius:9px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;transition:all .18s;'
      +(window.APT_TAB==='bookings'?'background:#fff;color:var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.1)':'background:transparent;color:var(--mid)')
      +'" data-apttab="bookings">📋 الحجوزات</button>'
    +'<button style="flex:1;padding:8px 4px;border:none;border-radius:9px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;transition:all .18s;'
      +(window.APT_TAB==='slots'?'background:#fff;color:var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.1)':'background:transparent;color:var(--mid)')
      +'" data-apttab="slots">⚙️ الفترات</button>'
    +'</div>'
    +'<div id="ab"></div>');
  // ربط التبويبات
  setTimeout(function(){
    document.querySelectorAll('[data-apttab]').forEach(function(btn){
      btn.addEventListener('click',function(){aptTab(btn.dataset.apttab);});
    });
  },30);
  rAptContent();
}

function aptTab(t){
  window.APT_TAB=t;
  var pg=$g('pg');if(pg){pg.className='';void pg.offsetWidth;pg.className='pg-anim';}
  pApt();
}

function rAptContent(){
  var c=$g('ab');if(!c)return;
  if(window.APT_TAB==='calendar') rAptCalendar();
  else if(window.APT_TAB==='bookings') rAptBookings();
  else rAptSlots();
}

function rAptCalendar(){
  var c=$g('ab');if(!c)return;
  var y=APT_CAL_DATE.getFullYear();
  var m=APT_CAL_DATE.getMonth();
  var today=new Date().toISOString().slice(0,10);
  var AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var AR_DAYS=['أح','إث','ثل','أر','خم','جم','سب'];
  var firstDay=new Date(y,m,1).getDay();
  var daysInMonth=new Date(y,m+1,0).getDate();
  var h='';

  // ناف مضغوط للجوال
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;background:#fff;padding:10px 12px;border-radius:12px;border:1px solid var(--border)">';
  h+='<button style="background:var(--blue-bg);border:none;color:var(--blue);width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:18px;font-weight:700" data-calmove="-1">‹</button>';
  h+='<div style="font-weight:800;font-size:15px">'+AR_MONTHS[m]+' '+y+'</div>';
  h+='<button style="background:var(--blue-bg);border:none;color:var(--blue);width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:18px;font-weight:700" data-calmove="1">›</button>';
  h+='</div>';

  // رؤوس الأيام
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">';
  AR_DAYS.forEach(function(d){
    h+='<div style="text-align:center;font-size:10px;font-weight:700;color:var(--mid);padding:4px 0">'+d+'</div>';
  });
  h+='</div>';

  // خلايا التقويم
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:12px">';
  for(var i=0;i<firstDay;i++) h+='<div></div>';
  for(var d2=1;d2<=daysInMonth;d2++){
    var dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
    var isPast=dateStr<today;
    var isToday=dateStr===today;
    var daySlots=D.dts.filter(function(dt){return dt.date===dateStr;});
    var hasAvail=daySlots.some(function(s){return s.status==='available';});
    var hasBooked=daySlots.some(function(s){return s.status==='booked';});
    var hasPending=daySlots.some(function(s){return s.status==='pending';});

    var bg='#fff', border='var(--border)', numClr='var(--text)';
    if(isToday){bg='var(--blue-bg)';border='var(--blue)';}
    else if(hasBooked){bg='#eff6ff';}
    else if(hasPending){bg='#fffbeb';}
    else if(hasAvail){bg='#f0fdf4';}
    if(isPast){bg='#f9fafb';numClr='#cbd5e1';}

    var dot='';
    if(hasBooked) dot='<div style="width:5px;height:5px;border-radius:50%;background:#2563b0;margin:1px auto"></div>';
    else if(hasPending) dot='<div style="width:5px;height:5px;border-radius:50%;background:#d97706;margin:1px auto"></div>';
    else if(hasAvail) dot='<div style="width:5px;height:5px;border-radius:50%;background:#16a34a;margin:1px auto"></div>';

    h+='<div style="background:'+bg+';border:1.5px solid '+border+';border-radius:8px;padding:4px 2px;text-align:center;min-height:42px;cursor:'+(isPast?'default':'pointer')
      +'" data-calday="'+dateStr+'">';
    h+='<div style="font-size:12px;font-weight:700;color:'+numClr+'">'+d2+'</div>';
    h+=dot;
    h+='</div>';
  }
  h+='</div>';

  // أزرار الإضافة
  h+='<div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap">';
  h+='<button class="btn bp bsm" data-adddt="1">+ يوم</button>';
  h+='<button class="btn bs bsm" data-addbtch="1">📅 دفعة</button>';
  h+='<button style="padding:5px 12px;border-radius:9px;border:none;background:#fdf4ff;color:#9333ea;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer" data-addexc="1">⭐ استثنائي</button>';
  h+='</div>';

  h+='<div id="apt-day-detail"></div>';
  c.innerHTML=h;

  // ربط الأحداث
  c.querySelectorAll('[data-calmove]').forEach(function(btn){
    btn.addEventListener('click',function(){aptCalMove(+btn.dataset.calmove);});
  });
  c.querySelectorAll('[data-calday]').forEach(function(el){
    el.addEventListener('click',function(){aptCalDayClick(el.dataset.calday);});
  });
  c.querySelector('[data-adddt]')?.addEventListener('click',function(){oDt();});
  c.querySelector('[data-addbtch]')?.addEventListener('click',function(){oDtBatch();});
  c.querySelector('[data-addexc]')?.addEventListener('click',function(){oExceptional();});
}

function aptCalMove(dir){
  APT_CAL_DATE.setMonth(APT_CAL_DATE.getMonth()+dir);
  rAptCalendar();
}

function aptCalDayClick(dateStr){
  var slots=D.dts.filter(function(d){return d.date===dateStr;});
  var apts=D.apt.filter(function(a){return a.date===dateStr;});
  var dd=$g('apt-day-detail');if(!dd)return;

  var AR_DAYS2=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  var dt2=new Date(dateStr);
  var dayName=AR_DAYS2[dt2.getDay()];

  var h='<div style="background:#fff;border:1.5px solid var(--blue);border-radius:14px;padding:14px;margin-top:6px;box-shadow:0 3px 12px rgba(42,111,219,.12)">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div><div style="font-weight:800;font-size:14px">'+dayName+'</div>'
    +'<div style="font-size:12px;color:var(--mid)">'+dateStr+'</div></div>';
  h+='<div style="display:flex;gap:6px">';
  h+='<button class="btn bp bsm" data-dtfor="'+dateStr+'">+ فترة</button>';
  h+='<button class="btn bs bsm" data-closedd="1" style="width:30px;padding:5px 0;text-align:center">✕</button>';
  h+='</div></div>';

  if(!slots.length){
    h+='<div style="text-align:center;color:var(--light);padding:14px;font-size:13px">لا توجد فترات لهذا اليوم</div>';
  } else {
    slots.forEach(function(s){
      var apt=apts.find(function(a){return a.date_id==s.id;});
      var statusColors={available:'#f0fdf4',pending:'#fffbeb',booked:'#eff6ff',locked:'#f8fafc'};
      var dotColors={available:'#16a34a',pending:'#d97706',booked:'#2563b0',locked:'#94a3b8'};
      var st=s.status;
      h+='<div style="background:'+(statusColors[st]||'#fff')+';border:1px solid var(--border);border-right:4px solid '+(dotColors[st]||'#e2e8f0')+';border-radius:10px;padding:10px 12px;margin-bottom:8px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
      h+='<div>';
      h+='<div style="font-weight:700;font-size:14px">'+s.slot_name+'</div>';
      if(apt) h+='<div style="font-size:12px;color:var(--mid);margin-top:2px">👤 '+(apt.reviewer_name||'—')+'</div>';
      h+='<div style="margin-top:4px"><span class="apt-badge '+st+'">'+aptStatusLabel(st)+'</span>';
      if(apt) h+=' <span class="apt-badge '+(apt.status||'')+'" style="margin-right:4px">'+aptStatusLabel(apt.status)+'</span>';
      h+='</div></div>';
      h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">';
      if(s.status==='available') h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="locked">🔒 إغلاق</button>';
      if(s.status==='locked') h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="available">🔓 فتح</button>';
      if(apt&&apt.status==='pending') h+='<button class="btn bp bsm" data-uaptid="'+apt.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
      if(apt&&['pending','confirmed'].includes(apt.status)) h+='<button class="btn bd bsm" data-uaptid="'+apt.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
      h+='<button class="ib id" style="width:28px;height:28px;font-size:13px" data-deldt="'+s.id+'">'+SVG.del+'</button>';
      h+='</div></div></div>';
    });
  }
  h+='</div>';
  dd.innerHTML=h;
  dd.scrollIntoView({behavior:'smooth',block:'nearest'});

  // ربط الأزرار
  dd.querySelectorAll('[data-dtfor]').forEach(function(btn){
    btn.addEventListener('click',function(){oDtFor(btn.dataset.dtfor);});
  });
  dd.querySelectorAll('[data-closedd]').forEach(function(btn){
    btn.addEventListener('click',function(){dd.innerHTML='';});
  });
  dd.querySelectorAll('[data-tdt]').forEach(function(btn){
    btn.addEventListener('click',function(){tDtStatus(+btn.dataset.tdt,btn.dataset.tdtst);});
  });
  dd.querySelectorAll('[data-deldt]').forEach(function(btn){
    btn.addEventListener('click',function(){if(confirmDel('حذف؟'))delDt(+btn.dataset.deldt);});
  });
  dd.querySelectorAll('[data-uaptid]').forEach(function(btn){
    btn.addEventListener('click',function(){uApt(+btn.dataset.uaptid,btn.dataset.uaptst).then(function(){aptCalDayClick(dateStr);});});
  });
}

function aptStatusLabel(s){
  var m={available:'متاح',pending:'بانتظار التأكيد',confirmed:'مؤكد',
    booked:'محجوز',completed:'مكتمل',locked:'مغلق',
    exceptional:'استثنائي',cancelled_admin:'ألغته الإدارة',
    cancelled_reviewer:'ألغاه المراجع'};
  return m[s]||s;
}

function rAptBookings(){
  var c=$g('ab');if(!c)return;
  var f=window.APT_FILTER||'all';
  var allApts=D.apt;
  var filtered=f==='all'?allApts:allApts.filter(function(a){return a.status===f;});
  var counts={all:allApts.length,pending:0,confirmed:0,completed:0};
  allApts.forEach(function(a){if(counts[a.status]!==undefined)counts[a.status]++;});
  var h='';

  h+='<div class="apt-filter-wrap">';
  [['all','الكل',counts.all],['pending','بانتظار التأكيد',counts.pending],
   ['confirmed','مؤكد',counts.confirmed],['completed','مكتمل',counts.completed]].forEach(function(x){
    h+='<button class="apt-filter-btn'+(f===x[0]?' on':'')+'" data-aptfilter="'+x[0]+'">'+x[1]+(x[2]?' ('+x[2]+')':'')+'</button>';
  });
  h+='</div>';
  if(!filtered.length){
    h+='<div class="empty-state">لا توجد حجوزات</div>';
    c.innerHTML=h;return;
  }

  filtered.sort(function(a,b){
    if(a.status==='pending'&&b.status!=='pending')return -1;
    if(b.status==='pending'&&a.status!=='pending')return 1;
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  filtered.forEach(function(a){
    var isExc=a.is_exceptional;
    h+='<div class="apt-card '+a.status+(isExc?' exceptional':'')+'">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">';
    h+='<div style="font-weight:800;font-size:14px">'+(a.reviewer_name||'—')+'</div>';
    if(isExc) h+='<span class="apt-badge exceptional">⭐ استثنائي</span>';
    h+='<span class="apt-badge '+a.status+'">'+aptStatusLabel(a.status)+'</span>';
    h+='</div>';
    h+='<div class="ps" style="display:flex;gap:10px;flex-wrap:wrap">';
    h+='<span>📞 '+(a.phone||'—')+'</span>';
    h+='<span>📅 '+(a.date||'—')+'</span>';
    h+='<span>⏰ '+(a.slot_name||'—')+'</span>';
    h+='</div>';
    if(a.notes) h+='<div style="font-size:11px;color:var(--mid);margin-top:4px;background:#f8fafd;padding:4px 8px;border-radius:6px">📝 '+a.notes+'</div>';
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">';
    if(a.status==='pending') h+='<button class="btn bp bsm" data-uaptid="'+a.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
    if(a.status==='confirmed') h+='<button class="btn bs bsm" data-uaptid="'+a.id+'" data-uaptst="completed">⏹ إنهاء</button>';
    if(['pending','confirmed'].includes(a.status)){
      h+='<button class="btn bs bsm" data-chgapt="'+a.id+'">📅 تغيير</button>';
      h+='<button class="btn bd bsm" data-uaptid="'+a.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
    }
    h+='</div></div>';
  });
  c.innerHTML=h;

  c.querySelectorAll('[data-aptfilter]').forEach(function(btn){
    btn.addEventListener('click',function(){aptFilter(btn.dataset.aptfilter);});
  });
  c.querySelectorAll('[data-uaptid]').forEach(function(btn){
    btn.addEventListener('click',function(){uApt(+btn.dataset.uaptid,btn.dataset.uaptst);});
  });
  c.querySelectorAll('[data-chgapt]').forEach(function(btn){
    btn.addEventListener('click',function(){changeApt(+btn.dataset.chgapt);});
  });
}

function aptFilter(f){window.APT_FILTER=f;rAptBookings();}

function rAptSlots(){
  var c=$g('ab');if(!c)return;
  var h='<div style="display:flex;justify-content:flex-end;margin-bottom:10px">';
  h+='<button class="btn bp" onclick="oSlt()">+ إضافة فترة</button></div>';
  if(!D.slt.length){h+='<div class="empty-state">لا توجد فترات</div>';c.innerHTML=h;return;}
  h+='<div class="fields-wrap">';
  D.slt.forEach(function(s,i){
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:'+(i%2===0?'#fff':'#f9fbff')+';'+(i>0?'border-top:1px solid var(--border)':'')+'";>';
    h+='<div style="font-size:20px">⏰</div>';
    h+='<div style="flex:1"><div style="font-weight:700;font-size:14px">'+s.name+'</div>';
    h+='<div class="ps">'+(s.time_from?s.time_from.slice(0,5)+' — '+s.time_to.slice(0,5):'نصية فقط')+'</div></div>';
    h+='<span class="apt-badge '+(s.status==='open'?'available':'locked')+'">'+(s.status==='open'?'نشط':'موقوف')+'</span>';
    h+='<div style="display:flex;gap:5px">';
    h+='<button class="ib ie" style="width:30px;height:30px" data-editslt="'+s.id+'">'+SVG.edit+'</button>';
    h+='<button class="ib id" style="width:30px;height:30px" data-delslt="'+s.id+'">'+SVG.del+'</button>';
    h+='</div></div>';
  });
  h+='</div>';
  c.innerHTML=h;
  c.querySelectorAll('[data-editslt]').forEach(function(btn){
    btn.addEventListener('click',function(){oSlt(+btn.dataset.editslt);});
  });
  c.querySelectorAll('[data-delslt]').forEach(function(btn){
    btn.addEventListener('click',function(){if(confirmDel('حذف الفترة؟'))dSlt(+btn.dataset.delslt);});
  });
}

async function uApt(id,st){
  if(st==='cancelled_admin'&&!confirmDel('إلغاء الموعد؟'))return;
  ld(1);const r=await api('PUT','appointments/'+id,{status:st});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');await lApt();await lDts();rAptContent();
}

function oSlt(id){
  const s=id?D.slt.find(x=>x.id==id):null;
  oM((s?'تعديل':'إضافة')+' فترة',
    '<div class="f"><label>اسم الفترة *</label>'
    +'<input id="slnm" class="fr-inp" value="'+(s?.name||'')+'" placeholder="مثال: بعد العصر"></div>'
    +'<div class="f"><label>وقت البداية (نص أو ساعة)</label>'
    +'<input id="slf" class="fr-inp" value="'+(s?.time_from||'')+'" placeholder="مثال: 16:00 أو بعد العصر"></div>'
    +'<div class="f"><label>وقت النهاية (اختياري)</label>'
    +'<input id="slt2" class="fr-inp" value="'+(s?.time_to||'')+'" placeholder="مثال: 18:00"></div>'
    +'<div style="display:flex;gap:9px;margin-top:6px">'
    +'<button class="btn bp" onclick="svSlt('+(id||0)+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svSlt(id){
  const n=($g('slnm')?.value||'').trim();
  if(!n){toast('اسم الفترة مطلوب','er');return;}
  const b={name:n,time_from:$g('slf')?.value||'',time_to:$g('slt2')?.value||'',status:'open'};
  ld(1);const r=id?await api('PUT','slots/'+id,b):await api('POST','slots',b);ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');cM();await lSlt();rAptContent();
}

async function dSlt(id){
  ld(1);await api('DELETE','slots/'+id);ld(0);
  toast('تم الحذف');await lSlt();rAptContent();
}

function oDt(){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  oM('إضافة يوم متاح',
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<div class="f"><label>التاريخ *</label>'
    +'<input id="dtd" class="fr-inp" type="date" min="'+new Date().toISOString().slice(0,10)+'"></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDt()">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function oDtFor(dateStr){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  oM('إضافة فترة ليوم '+dateStr,
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<input type="hidden" id="dtd" value="'+dateStr+'">'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDt()">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function oDtBatch(){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  const today=new Date().toISOString().slice(0,10);
  const d30=new Date();d30.setDate(d30.getDate()+30);
  oM('إضافة دفعة أيام',
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div class="f"><label>من</label><input id="dt-from" class="fr-inp" type="date" min="'+today+'" value="'+today+'"></div>'
    +'<div class="f"><label>إلى</label><input id="dt-to" class="fr-inp" type="date" min="'+today+'" value="'+d30.toISOString().slice(0,10)+'"></div></div>'
    +'<div class="f"><label>أيام الأسبوع</label>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">'
    +['ح','ن','ث','ر','خ','ج','س'].map((d,i)=>'<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:#fff"><input type="checkbox" id="dw'+i+'" '+(i<5?'checked':'')+' style="accent-color:var(--blue)"> '+d+'</label>').join('')
    +'</div></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDtBatch()">✅ إضافة</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svDt(){
  const sl=$g('dtsl')?.value,dt=$g('dtd')?.value;
  if(!sl||!dt){toast('أدخل الفترة والتاريخ','er');return;}
  ld(1);const r=await api('POST','dates',{slot_id:+sl,date:dt,status:'available'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تمت الإضافة ✅');cM();await lDts();rAptContent();
}

async function svDtBatch(){
  const sl=$g('dtsl')?.value,from=$g('dt-from')?.value,to=$g('dt-to')?.value;
  if(!sl||!from||!to){toast('أدخل جميع البيانات','er');return;}
  const days=[0,1,2,3,4,5,6].filter(i=>$g('dw'+i)?.checked);
  const dates=[];let cur=new Date(from);const end=new Date(to);
  while(cur<=end){if(days.includes(cur.getDay()))dates.push(cur.toISOString().slice(0,10));cur.setDate(cur.getDate()+1);}
  if(!dates.length){toast('لا توجد أيام مطابقة','er');return;}
  ld(1);const r=await api('POST','dates',{slot_id:+sl,dates,status:'available'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تمت إضافة '+dates.length+' يوم ✅');cM();await lDts();rAptContent();
}

async function tDtStatus(id,newStatus){
  ld(1);await api('PUT','dates/'+id,{status:newStatus});ld(0);
  await lDts();rAptContent();
}

async function tDt(id,cur){await tDtStatus(id,cur==='available'?'locked':'available');}

async function toggleAllDay(date,allOpen){
  ld(1);
  await Promise.all(D.dts.filter(d=>d.date===date&&d.status!=='booked').map(s=>api('PUT','dates/'+s.id,{status:allOpen?'locked':'available'})));
  ld(0);await lDts();rAptContent();
}

async function delDt(id){
  ld(1);await api('DELETE','dates/'+id);ld(0);
  toast('تم الحذف');await lDts();rAptContent();
}

function changeApt(id){
  const av=D.dts.filter(d=>d.status==='available');
  oM('تغيير الموعد',
    (av.length
      ? av.map(d=>'<div class="rv-slot-row available" style="margin-bottom:6px">'
          +'<div><div style="font-weight:700">'+d.slot_name+'</div>'
          +'<div class="ps">'+d.date+'</div></div>'
          +'<button class="btn bp bsm" onclick="confirmChangeApt('+id+','+d.id+')">اختيار</button></div>').join('')
      : '<div class="empty-state">لا توجد مواعيد متاحة</div>')
    +'<button class="btn bs" onclick="cM()" style="width:100%;margin-top:10px">إلغاء</button>');
}

async function confirmChangeApt(aptId,newDateId){
  const apt=D.apt.find(a=>a.id==aptId);
  ld(1);
  if(apt?.date_id) await api('PUT','dates/'+apt.date_id,{status:'available'});
  await api('PUT','appointments/'+aptId,{status:'confirmed'});
  await api('PUT','dates/'+newDateId,{status:'booked'});
  ld(0);toast('تم تغيير الموعد ✅');cM();await lApt();await lDts();rAptContent();
}

function oExceptional(){
  const revs=D.rev.filter(r=>r.role==='reviewer');
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  const ro=revs.map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('');
  const today=new Date().toISOString().slice(0,10);
  oM('⭐ حجز استثنائي',
    '<div class="apt-notice">الحجز الاستثنائي يظهر للمراجع مع إشعار مميز</div>'
    +'<div class="f"><label>المراجع *</label><select id="exc-rv" class="fr-inp">'+ro+'</select></div>'
    +'<div class="f"><label>الفترة *</label><select id="exc-sl" class="fr-inp">'+so+'</select></div>'
    +'<div class="f"><label>التاريخ *</label><input id="exc-dt" class="fr-inp" type="date" min="'+today+'"></div>'
    +'<div class="f"><label>ملاحظة</label><input id="exc-nt" class="fr-inp" placeholder="سبب الحجز الاستثنائي..."></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svExceptional()">✅ تأكيد الحجز</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svExceptional(){
  const rv=$g('exc-rv')?.value,sl=$g('exc-sl')?.value,dt=$g('exc-dt')?.value,nt=$g('exc-nt')?.value||'';
  if(!rv||!sl||!dt){toast('أدخل جميع البيانات','er');return;}
  ld(1);

  let dateId=null;
  const existing=D.dts.find(d=>d.slot_id==sl&&d.date===dt);
  if(existing){dateId=existing.id;}
  else{
    const dr=await api('POST','dates',{slot_id:+sl,date:dt,status:'booked'});
    if(dr.error){ld(0);toast(dr.error,'er');return;}
    dateId=dr.id;
  }

  const ar=await api('POST','appointments',{reviewer_id:+rv,date_id:dateId,status:'confirmed',notes:nt,is_exceptional:1});
  ld(0);
  if(ar.error){toast(ar.error,'er');return;}

  if(existing) await api('PUT','dates/'+dateId,{status:'booked'});
  toast('تم الحجز الاستثنائي ✅');cM();await lApt();await lDts();rAptContent();
}

