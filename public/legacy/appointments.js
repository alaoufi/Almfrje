/* appointments.js */
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
      +(window.APT_TAB==='available'?'background:#fff;color:var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.1)':'background:transparent;color:var(--mid)')
      +'" data-apttab="available">📋 المتاحة</button>'
    +'<button style="flex:1;padding:8px 4px;border:none;border-radius:9px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;transition:all .18s;'
      +(window.APT_TAB==='bookings'?'background:#fff;color:var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.1)':'background:transparent;color:var(--mid)')
      +'" data-apttab="bookings">📌 الحجوزات</button>'
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
  else if(window.APT_TAB==='available') rAptAvailable();
  else if(window.APT_TAB==='bookings') rAptBookings();
  else rAptSlots();
}

// قائمة كل الأيام القادمة بكل حالاتها (متاح/محجوز/مغلق)
// المدير يرى الكل + إجراءات لكل حالة.
function rAptAvailable(){
  var c=$g('ab');if(!c)return;
  var today=new Date().toISOString().slice(0,10);
  // كل الأيام القادمة بأيّ حالة + ربط الحجز إن وُجد (نُطبّع التاريخ لـ YYYY-MM-DD)
  var allFuture=(D.dts||[]).filter(function(d){ return (d.date||'').slice(0,10)>=today; });
  var apts=(D.apt||[]);
  // اجمع حسب التاريخ
  var byDate={};
  allFuture.forEach(function(d){
    var key=(d.date||'').slice(0,10);
    if(!byDate[key]) byDate[key]=[];
    // اربط بالحجز إن وُجد
    var booking = apts.find(function(a){ return +a.date_id === +d.id; });
    byDate[key].push({slot:d, booking:booking});
  });
  var dates=Object.keys(byDate).sort();

  // إحصاء حسب الحالة
  var stats={available:0,booked:0,locked:0,pending:0};
  allFuture.forEach(function(d){
    if(stats[d.status]!==undefined) stats[d.status]++;
    else stats.available++; // افتراض
  });

  var h='';
  // أزرار سريعة
  h+='<div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap">';
  h+='<button class="btn bp bsm" onclick="oDt()">+ يوم واحد</button>';
  h+='<button class="btn bs bsm" onclick="oDtBatch()">📅 دفعة بمدى</button>';
  h+='<button style="padding:5px 12px;border-radius:9px;border:none;background:#fdf4ff;color:#9333ea;font-family:Cairo,sans-serif;font-weight:700;font-size:12px;cursor:pointer" onclick="oExceptional()">⭐ استثنائي</button>';
  h+='</div>';

  // ملخّص بالحالات
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px;margin-bottom:12px">';
  h+=_aptStatPill('✅','متاحة',stats.available,'#15803d','#dcfce7');
  h+=_aptStatPill('📌','محجوزة',stats.booked+stats.pending,'#1e40af','#dbeafe');
  h+=_aptStatPill('🔒','مغلقة',stats.locked,'#475569','#f1f5f9');
  h+='</div>';

  if(!dates.length){
    h+='<div class="empty-state" style="padding:40px 16px"><div style="font-size:42px;margin-bottom:10px">📭</div>'
      +'<p style="margin-bottom:14px">لا توجد أيام مُعدّة بعد</p>'
      +'<button class="btn bp" onclick="oDtBatch()">📅 إضافة دفعة</button>'
      +'</div>';
    c.innerHTML=h;
    return;
  }

  var AR_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  dates.forEach(function(date){
    var items=byDate[date];
    var dt=new Date(date);
    var dayName=AR_DAYS[dt.getDay()];
    var isToday=date===today;
    h+='<div style="background:#fff;border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden">';
    // header اليوم
    h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,#f8fafc,#fff);border-bottom:1px solid #f1f5f9">';
    h+='<div><div style="font-weight:800;font-size:13.5px">'+dayName+(isToday?' <span style="background:var(--blue);color:#fff;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-right:4px">اليوم</span>':'')+'</div>';
    h+='<div style="font-size:11.5px;color:var(--mid)">'+date+'</div></div>';
    h+='<span style="background:#f1f5f9;color:#475569;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">'+items.length+' '+(items.length===1?'فترة':'فترة')+'</span>';
    h+='</div>';
    // الفترات بحالاتها
    items.forEach(function(it){
      var s=it.slot, b=it.booking;
      var st=s.status;
      // إذا فيه حجز، اعتبر الحالة "محجوز" بدلاً من المخزّن
      if(b && ['pending','confirmed'].includes(b.status)) st='booked';
      var conf=_aptRowConfig(st);
      h+='<div style="display:flex;align-items:center;gap:9px;padding:10px 12px;border-top:1px dashed #f1f5f9;background:'+conf.bg+'">';
      h+='<div style="font-size:18px">'+conf.icon+'</div>';
      h+='<div style="flex:1;min-width:0">';
      h+='<div style="font-weight:700;font-size:13px;color:'+conf.titleClr+'">'+(s.slot_name||'فترة')+'</div>';
      var sub=[];
      if(s.time_from && s.time_to) sub.push(s.time_from.slice(0,5)+' — '+s.time_to.slice(0,5));
      if(b && b.reviewer_name) sub.push('👤 '+b.reviewer_name);
      h+='<div style="font-size:11px;color:'+conf.subClr+';margin-top:2px">'+(sub.join(' · ')||conf.label)+'</div>';
      h+='</div>';
      // الإجراءات حسب الحالة
      h+='<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">';
      if(st==='available'){
        h+='<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700">متاح</span>';
        h+='<button class="btn bs bsm" onclick="tDtStatus('+s.id+',\'locked\')" title="حجب من الحجز">🔒</button>';
        h+='<button class="ib id" style="width:28px;height:28px;font-size:13px" onclick="if(confirmDel(\'حذف هذه الفترة؟\'))delDt('+s.id+')" title="حذف">'+SVG.del+'</button>';
      } else if(st==='booked'){
        var bookSt = b ? b.status : 'booked';
        var lbl = bookSt==='confirmed' ? 'محجوز · مؤكد' : 'محجوز · بانتظار';
        h+='<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700">'+lbl+'</span>';
        if(b && b.status==='pending') h+='<button class="btn bp bsm" onclick="uApt('+b.id+',\'confirmed\').then(rAptContent)" title="تأكيد">✔</button>';
        if(b) h+='<button class="btn bd bsm" onclick="uApt('+b.id+',\'cancelled_admin\').then(rAptContent)" title="إلغاء">✕</button>';
      } else if(st==='locked'){
        h+='<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700">مغلق</span>';
        h+='<button class="btn bp bsm" onclick="tDtStatus('+s.id+',\'available\')" title="فتح للحجز">🔓</button>';
        h+='<button class="ib id" style="width:28px;height:28px;font-size:13px" onclick="if(confirmDel(\'حذف هذه الفترة؟\'))delDt('+s.id+')" title="حذف">'+SVG.del+'</button>';
      } else {
        h+='<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700">'+st+'</span>';
      }
      h+='</div></div>';
    });
    h+='</div>';
  });
  c.innerHTML=h;
}

function _aptStatPill(icon,lbl,n,clr,bg){
  return '<div style="background:'+bg+';border-radius:10px;padding:8px 9px;text-align:center;border:1px solid '+clr+'33">'
    +'<div style="font-size:18px;font-weight:800;color:'+clr+';line-height:1">'+n+'</div>'
    +'<div style="font-size:10.5px;color:'+clr+';font-weight:700;margin-top:3px">'+icon+' '+lbl+'</div>'
    +'</div>';
}

function _aptRowConfig(st){
  if(st==='available') return {icon:'⏰',bg:'#f0fdf4',titleClr:'#15803d',subClr:'#16a34a',label:'مفتوح للحجز'};
  if(st==='booked')    return {icon:'📌',bg:'#eff6ff',titleClr:'#1e40af',subClr:'#2563b0',label:'محجوز'};
  if(st==='locked')    return {icon:'🔒',bg:'#f8fafc',titleClr:'#475569',subClr:'#64748b',label:'مغلق'};
  if(st==='pending')   return {icon:'⏳',bg:'#fffbeb',titleClr:'#92400e',subClr:'#d97706',label:'بانتظار التأكيد'};
  return {icon:'⏰',bg:'#fff',titleClr:'#0f172a',subClr:'#475569',label:''};
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
  // وضع التحديد المتعدّد — مجموعة تواريخ مختارة
  window._aptMulti = window._aptMulti || false;
  window._aptMultiSet = window._aptMultiSet || new Set();
  var h='';

  // ناف مضغوط للجوال
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;background:#fff;padding:10px 12px;border-radius:12px;border:1px solid var(--border)">';
  h+='<button style="background:var(--blue-bg);border:none;color:var(--blue);width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:18px;font-weight:700" data-calmove="-1">‹</button>';
  h+='<div style="font-weight:800;font-size:15px">'+AR_MONTHS[m]+' '+y+'</div>';
  h+='<button style="background:var(--blue-bg);border:none;color:var(--blue);width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:18px;font-weight:700" data-calmove="1">›</button>';
  h+='</div>';

  // وضع التحديد المتعدّد
  var multiBg = window._aptMulti ? '#3b82f6' : '#fff';
  var multiClr = window._aptMulti ? '#fff' : 'var(--blue)';
  var multiBdr = window._aptMulti ? '#3b82f6' : 'var(--border)';
  h+='<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">';
  h+='<button data-aptmulti="1" style="flex:1;min-width:140px;padding:9px;background:'+multiBg+';color:'+multiClr+';border:1.5px solid '+multiBdr+';border-radius:10px;cursor:pointer;font-family:Cairo,sans-serif;font-weight:700;font-size:12.5px">'
    + (window._aptMulti ? '✓ وضع التحديد المتعدّد' : '☑ تحديد عدّة أيام') + '</button>';
  if(window._aptMulti && window._aptMultiSet.size){
    h+='<button data-aptmulticlear="1" style="padding:9px 12px;background:#fff;color:#dc2626;border:1.5px solid #fecaca;border-radius:10px;cursor:pointer;font-family:Cairo,sans-serif;font-weight:700;font-size:12.5px">✕ إلغاء التحديد</button>';
  }
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
  // اقرأ كل الحجوزات النشطة لربط slot.id → booking لاكتشاف الأيام المحجوزة بصرياً
  var aptByDateId={};
  (D.apt||[]).forEach(function(a){
    if(a.date_id && ['pending','confirmed'].includes(a.status)) aptByDateId[+a.date_id]=a;
  });
  for(var d2=1;d2<=daysInMonth;d2++){
    var dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
    var isPast=dateStr<today;
    var isToday=dateStr===today;
    var isSelected=window._aptMultiSet.has(dateStr);
    var daySlots=D.dts.filter(function(dt){return (dt.date||'').slice(0,10)===dateStr;});
    // فحص دقيق: الفترة "محجوزة" إن كان لها حجز نشط أو حالتها booked
    var hasBooked=daySlots.some(function(s){ return s.status==='booked' || aptByDateId[+s.id]; });
    var hasPending=daySlots.some(function(s){return s.status==='pending';});
    var hasAvail=daySlots.some(function(s){return s.status==='available' && !aptByDateId[+s.id];});
    var hasLocked=daySlots.some(function(s){return s.status==='locked';});

    // ألوان أكثر تشبّعاً لتوضيح الحالة (الأولوية: محجوز > معلّق > متاح > مغلق)
    var bg='#fff', border='var(--border)', numClr='var(--text)';
    if(isPast){
      bg='#f9fafb'; numClr='#cbd5e1';
    } else if(hasBooked){
      bg='#dbeafe'; border='#3b82f6'; numClr='#1e40af';
    } else if(hasPending){
      bg='#fef3c7'; border='#f59e0b'; numClr='#92400e';
    } else if(hasAvail){
      bg='#dcfce7'; border='#22c55e'; numClr='#15803d';
    } else if(hasLocked){
      bg='#f1f5f9'; border='#94a3b8'; numClr='#475569';
    }
    if(isToday && !hasBooked && !hasPending && !hasAvail && !hasLocked){
      bg='var(--blue-bg)'; border='var(--blue)';
    }
    if(isSelected){ bg='#bfdbfe'; border='#1e40af'; numClr='#1e3a8a'; }

    var mark='';
    if(isSelected){
      mark='<div style="color:#1e3a8a;font-size:14px;font-weight:900;margin:1px 0 0;line-height:1">✓</div>';
    } else if(hasBooked){
      mark='<div style="background:#1e40af;color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:6px;margin:2px 1px 0;line-height:1.3">محجوز</div>';
    } else if(hasPending){
      mark='<div style="background:#b45309;color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:6px;margin:2px 1px 0;line-height:1.3">معلّق</div>';
    } else if(hasAvail){
      mark='<div style="background:#15803d;color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:6px;margin:2px 1px 0;line-height:1.3">متاح</div>';
    } else if(hasLocked){
      mark='<div style="background:#64748b;color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:6px;margin:2px 1px 0;line-height:1.3">مغلق</div>';
    }

    h+='<div style="background:'+bg+';border:'+(isSelected?'2.5px':'1.5px')+' solid '+border+';border-radius:8px;padding:4px 2px;text-align:center;min-height:48px;cursor:'+(isPast?'default':'pointer')+';transition:all .12s'
      +'" data-calday="'+dateStr+'">';
    h+='<div style="font-size:12px;font-weight:800;color:'+numClr+'">'+d2+'</div>';
    h+=mark;
    h+='</div>';
  }
  h+='</div>';

  // مفتاح الألوان — للمستخدم ليفهم الترميز
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;font-size:10.5px;color:var(--mid);justify-content:center">';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#dcfce7;border:1.5px solid #22c55e;border-radius:3px"></span>متاح</span>';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#dbeafe;border:1.5px solid #3b82f6;border-radius:3px"></span>محجوز</span>';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#fef3c7;border:1.5px solid #f59e0b;border-radius:3px"></span>معلّق</span>';
  h+='<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#f1f5f9;border:1.5px solid #94a3b8;border-radius:3px"></span>مغلق</span>';
  h+='</div>';

  // أزرار الإضافة (مخفية في وضع التحديد المتعدّد)
  if(!window._aptMulti){
    h+='<div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap">';
    h+='<button class="btn bp bsm" data-adddt="1">+ يوم</button>';
    h+='<button class="btn bs bsm" data-addbtch="1">📅 دفعة بمدى</button>';
    h+='<button style="padding:5px 12px;border-radius:9px;border:none;background:#fdf4ff;color:#9333ea;font-family:Cairo,sans-serif;font-weight:700;font-size:12px;cursor:pointer" data-addexc="1">⭐ استثنائي</button>';
    h+='</div>';
  } else if(window._aptMultiSet.size){
    // شريط عائم: عدد الأيام + أزرار الإجراءات (إضافة/حجب/فتح/حذف فترات)
    h+='<div style="position:sticky;bottom:8px;background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;border-radius:14px;padding:12px 14px;margin-bottom:12px;box-shadow:0 6px 18px rgba(37,99,235,.35);z-index:10">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">';
    h+='<div style="flex:1"><div style="font-weight:800;font-size:14px">'+window._aptMultiSet.size+' '+(window._aptMultiSet.size===1?'يوم محدّد':'يوم محدّد')+'</div>';
    h+='<div style="font-size:11px;opacity:.85">اختر إجراءً لتطبيقه على كل الأيام</div></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px">';
    h+='<button data-aptmultiadd="1" style="background:#fff;color:#1e40af;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:800;font-size:12px;cursor:pointer">+ إضافة فترات</button>';
    h+='<button data-aptmultilock="1" style="background:rgba(255,255,255,.15);color:#fff;border:1.5px solid rgba(255,255,255,.4);padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:800;font-size:12px;cursor:pointer">🔒 حجب الكل</button>';
    h+='<button data-aptmultiopen="1" style="background:rgba(255,255,255,.15);color:#fff;border:1.5px solid rgba(255,255,255,.4);padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:800;font-size:12px;cursor:pointer">🔓 فتح الكل</button>';
    h+='<button data-aptmultidel="1" style="background:#fee2e2;color:#dc2626;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:800;font-size:12px;cursor:pointer">🗑 حذف الفترات</button>';
    h+='</div></div>';
  } else {
    h+='<div style="text-align:center;color:var(--mid);font-size:12px;padding:8px;background:#f0f9ff;border:1px dashed #93c5fd;border-radius:10px;margin-bottom:12px">اضغط على الأيام لإضافة/حجب/حذف الفترات بالجملة</div>';
  }

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
  c.querySelector('[data-aptmulti]')?.addEventListener('click',function(){
    window._aptMulti = !window._aptMulti;
    if(!window._aptMulti) window._aptMultiSet.clear();
    rAptCalendar();
  });
  c.querySelector('[data-aptmulticlear]')?.addEventListener('click',function(){
    window._aptMultiSet.clear(); rAptCalendar();
  });
  c.querySelector('[data-aptmultiadd]')?.addEventListener('click',function(){ oDtMulti(); });
  c.querySelector('[data-aptmultilock]')?.addEventListener('click',function(){ _aptMultiBulk('locked'); });
  c.querySelector('[data-aptmultiopen]')?.addEventListener('click',function(){ _aptMultiBulk('available'); });
  c.querySelector('[data-aptmultidel]')?.addEventListener('click',function(){ _aptMultiBulkDelete(); });
}

// تطبيق حالة (locked/available) على كل فترات الأيام المحدّدة
// لو الأيام جديدة بلا فترات → افتح نافذة الإضافة بحالة preselected
async function _aptMultiBulk(newStatus){
  var dates = Array.from(window._aptMultiSet||[]);
  if(!dates.length) return;
  var aptDateIds = {};
  (D.apt||[]).forEach(function(a){
    if(a.date_id && ['pending','confirmed'].includes(a.status)) aptDateIds[+a.date_id]=true;
  });
  var slotIds = (D.dts||[])
    .filter(function(s){ return dates.indexOf(s.date)>=0 && !aptDateIds[+s.id]; })
    .map(function(s){ return s.id; });
  if(!slotIds.length){
    // لا توجد فترات بعد — افتح نافذة إضافة الفترات مع اختيار الحالة المطلوبة مسبقاً
    var lblNew = newStatus==='locked' ? 'مغلقة' : 'متاحة';
    toast('لا فترات بعد — اختر الفترات لإضافتها كـ ' + lblNew);
    setTimeout(function(){ oDtMulti(newStatus); }, 350);
    return;
  }
  var lbl = newStatus==='locked' ? 'حجب' : 'فتح';
  oConfirm(lbl+' '+slotIds.length+' فترة في '+dates.length+' يوم؟', async function(){
    ld(1);
    var done=0, fail=0;
    for(var i=0;i<slotIds.length;i++){
      var r = await api('PUT','dates/'+slotIds[i],{status:newStatus});
      if(r && r.error) fail++; else done++;
    }
    ld(0);
    if(done) toast('✅ تم تعديل '+done+' فترة');
    if(fail) toast(fail+' فترة فشلت','er');
    window._aptMultiSet.clear();
    window._aptMulti = false;
    await lDts();
    rAptContent();
  },{icon: newStatus==='locked'?'🔒':'🔓', yes: lbl, no:'إلغاء'});
}

// حذف كل الفترات في الأيام المحدّدة (ما عدا المحجوزة)
async function _aptMultiBulkDelete(){
  var dates = Array.from(window._aptMultiSet||[]);
  if(!dates.length) return;
  var aptDateIds = {};
  (D.apt||[]).forEach(function(a){
    if(a.date_id && ['pending','confirmed'].includes(a.status)) aptDateIds[+a.date_id]=true;
  });
  var slotIds = (D.dts||[])
    .filter(function(s){ return dates.indexOf(s.date)>=0 && !aptDateIds[+s.id]; })
    .map(function(s){ return s.id; });
  if(!slotIds.length){
    toast('لا توجد فترات قابلة للحذف (قد تكون محجوزة)','er');
    return;
  }
  oConfirm('حذف '+slotIds.length+' فترة في '+dates.length+' يوم؟ لا يمكن التراجع.', async function(){
    ld(1);
    var done=0;
    for(var i=0;i<slotIds.length;i++){
      var r = await api('DELETE','dates/'+slotIds[i]);
      if(!r || !r.error) done++;
    }
    ld(0);
    toast('🗑 حُذفت '+done+' فترة');
    window._aptMultiSet.clear();
    window._aptMulti = false;
    await lDts();
    rAptContent();
  },{icon:'🗑',yes:'حذف',no:'إلغاء',danger:true});
}

function aptCalMove(dir){
  APT_CAL_DATE.setMonth(APT_CAL_DATE.getMonth()+dir);
  rAptCalendar();
}

function aptCalDayClick(dateStr){
  var today=new Date().toISOString().slice(0,10);
  if(dateStr < today) return; // لا تختر تاريخ ماضٍ
  // وضع التحديد المتعدّد: أَضِف/أَزِل من المجموعة
  if(window._aptMulti){
    if(window._aptMultiSet.has(dateStr)) window._aptMultiSet.delete(dateStr);
    else window._aptMultiSet.add(dateStr);
    rAptCalendar();
    return;
  }
  // الوضع العادي: عرض تفاصيل اليوم
  _aptShowDayDetail(dateStr);
}

function _aptShowDayDetail(dateStr){
  var slots=D.dts.filter(function(d){return (d.date||'').slice(0,10)===dateStr;});
  var apts=D.apt.filter(function(a){return (a.date||'').slice(0,10)===dateStr;});
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
    h+='<div style="font-size:11px;color:var(--mid);background:#f0f9ff;border:1px dashed #93c5fd;border-radius:8px;padding:6px 9px;margin-bottom:8px;text-align:center">💡 لكل فترة: ✅ متاح · 🔒 مغلق · ⭐ حجز لمراجع · 🗑 حذف</div>';
    var today=new Date().toISOString().slice(0,10);
    slots.forEach(function(s){
      var apt=apts.find(function(a){return a.date_id==s.id;});
      // المواعيد المؤكّدة/المعلّقة التي مرّ تاريخها = فائتة
      var aptDisplay = apt ? apt.status : null;
      var isPastBooking = apt && ['pending','confirmed'].includes(apt.status) && dateStr < today;
      if(isPastBooking) aptDisplay = 'missed';
      var statusColors={available:'#f0fdf4',pending:'#fffbeb',booked:'#eff6ff',locked:'#f8fafc'};
      var dotColors={available:'#16a34a',pending:'#d97706',booked:'#2563b0',locked:'#94a3b8'};
      // الحالة المعروضة: لو فيه حجز نشط فالفترة محجوزة بصرياً مهما كانت s.status
      var st=s.status;
      if(apt && ['pending','confirmed'].includes(apt.status)) st='booked';
      var slotNameEsc=htmlEsc(s.slot_name||'فترة');
      h+='<div style="background:'+(statusColors[st]||'#fff')+';border:1px solid var(--border);border-right:4px solid '+(dotColors[st]||'#e2e8f0')+';border-radius:10px;padding:10px 12px;margin-bottom:8px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
      h+='<div>';
      h+='<div style="font-weight:700;font-size:14px">'+slotNameEsc+'</div>';
      if(apt) h+='<div style="font-size:12px;color:var(--mid);margin-top:2px">👤 '+htmlEsc(apt.reviewer_name||'—')+(apt.is_exceptional?' <span style="color:#9333ea">⭐</span>':'')+'</div>';
      h+='<div style="margin-top:4px"><span class="apt-badge '+st+'">'+aptStatusLabel(st)+'</span>';
      if(apt) h+=' <span class="apt-badge '+(aptDisplay||'')+'" style="margin-right:4px">'+aptStatusLabel(aptDisplay)+'</span>';
      h+='</div></div>';
      h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">';
      // فترة بلا حجز: أتاحة/إغلاق + حجز لمراجع
      if(!apt || !['pending','confirmed'].includes(apt.status)){
        if(s.status==='available') h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="locked">🔒 إغلاق</button>';
        if(s.status==='locked')    h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="available">✅ إتاحة</button>';
        h+='<button class="btn bp bsm" data-bookslot="'+s.id+'" data-slotname="'+slotNameEsc+'" style="background:#9333ea">⭐ حجز لمراجع</button>';
      }
      // فترة محجوزة (حجز نشط): تأكيد/إلغاء
      if(apt&&apt.status==='pending' && !isPastBooking) h+='<button class="btn bp bsm" data-uaptid="'+apt.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
      if(apt&&['pending','confirmed'].includes(apt.status) && !isPastBooking) h+='<button class="btn bd bsm" data-uaptid="'+apt.id+'" data-uaptst="cancelled_admin">✕ إلغاء الحجز</button>';
      // للمواعيد الفائتة: زرّان لتسجيل النتيجة
      if(isPastBooking){
        h+='<button class="btn bp bsm" data-uaptid="'+apt.id+'" data-uaptst="completed" title="حضر">🏁 حضر</button>';
        h+='<button class="btn bs bsm" data-uaptid="'+apt.id+'" data-uaptst="missed" title="لم يحضر">⏰ لم يحضر</button>';
      }
      // جلسة مكتملة: زر التقييم بعد الجلسة
      if(apt && apt.status==='completed'){
        h+='<button class="btn bp bsm" data-aptevalid="'+apt.id+'" data-aptevalrev="'+htmlEsc(apt.reviewer_name||'')+'" data-aptevaldate="'+(apt.date||dateStr)+'" data-aptevalslot="'+slotNameEsc+'" style="background:#075e54">📝 التقييم</button>';
      }
      // الحذف متاح فقط لو لا حجز نشط
      if(!apt || !['pending','confirmed'].includes(apt.status)){
        h+='<button class="ib id" style="width:28px;height:28px;font-size:13px" data-deldt="'+s.id+'">'+SVG.del+'</button>';
      }
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
  dd.querySelectorAll('[data-bookslot]').forEach(function(btn){
    btn.addEventListener('click',function(){ oBookSlot(+btn.dataset.bookslot, btn.dataset.slotname||'فترة', dateStr); });
  });
  dd.querySelectorAll('[data-aptevalid]').forEach(function(btn){
    btn.addEventListener('click',function(){
      oAdmSessionEval(+btn.dataset.aptevalid, btn.dataset.aptevalrev||'', btn.dataset.aptevaldate||'', btn.dataset.aptevalslot||'');
    });
  });
}

// حجز فترة محدّدة (موجودة) لمراجع معيّن — من لوحة اليوم
function oBookSlot(dateRowId, slotName, dateStr){
  var revs=(D.rev||[]).filter(function(r){return r.role==='reviewer';});
  if(!revs.length){ toast('لا يوجد مراجعون مسجّلون','er'); return; }
  var ro=revs.map(function(r){return '<option value="'+r.id+'">'+htmlEsc(r.name||'')+'</option>';}).join('');
  oM('⭐ حجز لمراجع',
    '<div class="apt-notice">سيظهر للمراجع كموعد مؤكّد بإشعار مميّز ⭐</div>'
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 11px;margin-bottom:10px;font-size:12.5px">'
    +'<b>'+htmlEsc(slotName)+'</b> · '+dateStr+'</div>'
    +'<div class="f"><label>المراجع *</label><select id="bk-rv" class="fr-inp">'+ro+'</select></div>'
    +'<div class="f"><label>ملاحظة (اختياري)</label><input id="bk-nt" class="fr-inp" placeholder="سبب الحجز..."></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svBookSlot('+dateRowId+',\''+dateStr+'\')" style="background:#9333ea">✅ تأكيد الحجز</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

window.svBookSlot = async function(dateRowId, dateStr){
  var rv=$g('bk-rv')?.value, nt=$g('bk-nt')?.value||'';
  if(!rv){ toast('اختر المراجع','er'); return; }
  ld(1);
  var ar=await api('POST','appointments',{reviewer_id:+rv,date_id:+dateRowId,status:'confirmed',notes:nt,is_exceptional:1});
  if(ar&&ar.error){ ld(0); toast(ar.error,'er'); return; }
  // علّم الفترة "محجوزة"
  await api('PUT','dates/'+dateRowId,{status:'booked'});
  ld(0);
  toast('✅ تم الحجز للمراجع');
  cM();
  await Promise.all([(typeof lApt==='function'?lApt():Promise.resolve()), lDts()]);
  rAptContent();
  // أعد فتح لوحة اليوم بعد إعادة الرسم (rAptContent يُنشئ apt-day-detail فارغاً)
  if(dateStr && window.APT_TAB==='calendar') _aptShowDayDetail(dateStr);
};

function aptStatusLabel(s){
  // التصنيف الموحّد: متاح / محجوز / ملغى / فائت / مغلق
  var m={
    available:'متاح',
    pending:'محجوز (بانتظار التأكيد)',
    confirmed:'محجوز (مؤكد)',
    booked:'محجوز',
    completed:'انتهى',
    missed:'فائت',
    no_show:'فائت',
    locked:'مغلق',
    exceptional:'استثنائي',
    cancelled_admin:'ملغى (الإدارة)',
    cancelled_reviewer:'ملغى (المراجع)'
  };
  return m[s]||s;
}

// يحدّد حالة العرض للموعد بناءً على التاريخ (مرجع وحيد للتصنيف)
function aptDisplayStatus(a, today){
  today = today || new Date().toISOString().slice(0,10);
  if(['pending','confirmed'].includes(a.status) && a.date && a.date < today){
    return 'missed';
  }
  return a.status;
}

function rAptBookings(){
  var c=$g('ab');if(!c)return;
  var today=new Date().toISOString().slice(0,10);
  var f=window.APT_FILTER||'all';
  var allApts=(D.apt||[]).slice();

  // احسب حالة العرض لكل موعد مرّة واحدة
  allApts.forEach(function(a){ a._ds=aptDisplayStatus(a,today); });

  // عدّاد لكل تصنيف
  var counts={all:allApts.length,booked:0,missed:0,completed:0,cancelled_admin:0,cancelled_reviewer:0};
  allApts.forEach(function(a){
    if(a._ds==='pending'||a._ds==='confirmed') counts.booked++;
    else if(a._ds==='missed') counts.missed++;
    else if(a._ds==='completed') counts.completed++;
    else if(a._ds==='cancelled_admin') counts.cancelled_admin++;
    else if(a._ds==='cancelled_reviewer') counts.cancelled_reviewer++;
  });

  function matches(ds,filter){
    if(filter==='all') return true;
    if(filter==='booked') return ds==='pending'||ds==='confirmed';
    return ds===filter;
  }
  var filtered = allApts.filter(function(a){ return matches(a._ds, f); });

  // شريط التبويبات — التصنيفات الست
  var h='<div class="apt-filter-wrap">';
  [
    ['all',               'الكل',            counts.all],
    ['booked',            '📌 محجوز',         counts.booked],
    ['missed',            '⏰ فائت',          counts.missed],
    ['completed',         '🏁 انتهى',         counts.completed],
    ['cancelled_admin',   '❌ ملغى',          counts.cancelled_admin],
    ['cancelled_reviewer','↩ ملغى المراجع',  counts.cancelled_reviewer]
  ].forEach(function(x){
    h+='<button class="apt-filter-btn'+(f===x[0]?' on':'')+'" data-aptfilter="'+x[0]+'">'
      +x[1]+(x[2]?' ('+x[2]+')':'')+'</button>';
  });
  h+='</div>';

  if(!filtered.length){
    h+='<div class="empty-state">لا توجد حجوزات في هذا التصنيف</div>';
    c.innerHTML=h;
    c.querySelectorAll('[data-aptfilter]').forEach(function(btn){
      btn.addEventListener('click',function(){aptFilter(btn.dataset.aptfilter);});
    });
    return;
  }

  // ترتيب: المعلّقة أولاً، ثم بحسب التاريخ (الأحدث أعلى)
  filtered.sort(function(a,b){
    if(a._ds==='pending'&&b._ds!=='pending')return -1;
    if(b._ds==='pending'&&a._ds!=='pending')return 1;
    return (b.date||b.created_at||'').localeCompare(a.date||a.created_at||'');
  });

  filtered.forEach(function(a){
    var isExc=a.is_exceptional;
    var ds=a._ds;
    h+='<div class="apt-card '+ds+(isExc?' exceptional':'')+'">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">';
    h+='<div style="font-weight:800;font-size:14px">'+(a.reviewer_name||'—')+'</div>';
    if(isExc) h+='<span class="apt-badge exceptional">⭐ استثنائي</span>';
    h+='<span class="apt-badge '+ds+'">'+aptStatusLabel(ds)+'</span>';
    h+='</div>';
    h+='<div class="ps" style="display:flex;gap:10px;flex-wrap:wrap">';
    h+='<span>📞 '+(a.phone||'—')+'</span>';
    h+='<span>📅 '+(a.date||'—')+'</span>';
    h+='<span>⏰ '+(a.slot_name||'—')+'</span>';
    h+='</div>';
    if(a.notes) h+='<div style="font-size:11px;color:var(--mid);margin-top:4px;background:#f8fafd;padding:4px 8px;border-radius:6px">📝 '+a.notes+'</div>';
    h+='</div>';
    // الإجراءات تتبع التصنيف الفعلي (ds)
    h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">';
    if(ds==='pending'){
      h+='<button class="btn bp bsm" data-uaptid="'+a.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
      h+='<button class="btn bs bsm" data-chgapt="'+a.id+'">📅 تغيير</button>';
      h+='<button class="btn bd bsm" data-uaptid="'+a.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
    } else if(ds==='confirmed'){
      h+='<button class="btn bp bsm" data-uaptid="'+a.id+'" data-uaptst="completed">🏁 حضر</button>';
      h+='<button class="btn bs bsm" data-uaptid="'+a.id+'" data-uaptst="missed">⏰ لم يحضر</button>';
      h+='<button class="btn bs bsm" data-chgapt="'+a.id+'">📅 تغيير</button>';
      h+='<button class="btn bd bsm" data-uaptid="'+a.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
    } else if(ds==='missed'){
      // موعد فائت: السماح بتصحيح الحالة فقط
      h+='<button class="btn bp bsm" data-uaptid="'+a.id+'" data-uaptst="completed">🏁 حضر</button>';
    } else if(ds==='completed'){
      // جلسة مكتملة: زر التقييم بعد الجلسة
      h+='<button class="btn bp bsm" data-aptevalid="'+a.id+'" data-aptevalrev="'+(a.reviewer_name||'')+'" data-aptevaldate="'+(a.date||'')+'" data-aptevalslot="'+(a.slot_name||'')+'" style="background:#075e54">📝 التقييم</button>';
    }
    h+='</div></div>';
  });
  c.innerHTML=h;

  // ربط
  c.querySelectorAll('[data-aptfilter]').forEach(function(btn){
    btn.addEventListener('click',function(){aptFilter(btn.dataset.aptfilter);});
  });
  c.querySelectorAll('[data-uaptid]').forEach(function(btn){
    btn.addEventListener('click',function(){uApt(+btn.dataset.uaptid,btn.dataset.uaptst);});
  });
  c.querySelectorAll('[data-chgapt]').forEach(function(btn){
    btn.addEventListener('click',function(){changeApt(+btn.dataset.chgapt);});
  });
  c.querySelectorAll('[data-aptevalid]').forEach(function(btn){
    btn.addEventListener('click',function(){
      oAdmSessionEval(+btn.dataset.aptevalid, btn.dataset.aptevalrev||'', btn.dataset.aptevaldate||'', btn.dataset.aptevalslot||'');
    });
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
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  const today=new Date().toISOString().slice(0,10);
  const d90=new Date(); d90.setDate(d90.getDate()+90);
  // فترات بـ checkboxes (multi-slot)
  var slotsHtml = D.slt.map(function(s){
    var t = (s.time_from && s.time_to) ? (s.time_from.slice(0,5)+'—'+s.time_to.slice(0,5)) : '';
    return '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:#fff;border:1.5px solid #e2e8f0;border-radius:9px;margin-bottom:5px;cursor:pointer;transition:all .12s" onclick="_slotChipToggle(this)">'
      + '<input type="checkbox" data-slotid="'+s.id+'" style="width:17px;height:17px;accent-color:#3b82f6;flex-shrink:0">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">⏰ '+(s.name||'فترة')+'</div>'
      + (t?'<div style="font-size:11px;color:var(--mid)">'+t+'</div>':'')
      + '</div></label>';
  }).join('');
  // أيام الأسبوع
  var dayNames=[{idx:0,name:'الأحد'},{idx:1,name:'الاثنين'},{idx:2,name:'الثلاثاء'},{idx:3,name:'الأربعاء'},{idx:4,name:'الخميس'},{idx:5,name:'الجمعة'},{idx:6,name:'السبت'}];
  var dayBtns = dayNames.map(function(d){
    var checked = d.idx < 5;
    return '<button type="button" id="dw'+d.idx+'" data-checked="'+(checked?'1':'0')+'" onclick="_dwToggle('+d.idx+');_batchPreview()" '
      + 'style="padding:9px 5px;border-radius:8px;border:1.5px solid '+(checked?'#3b82f6':'#e2e8f0')+';'
      + 'background:'+(checked?'#dbeafe':'#fff')+';color:'+(checked?'#1e40af':'#475569')+';'
      + 'font-family:Cairo,sans-serif;font-size:11.5px;font-weight:'+(checked?'800':'600')+';cursor:pointer;transition:all .12s">'
      + d.name + '</button>';
  }).join('');

  oM('⚡ جدولة ذكية للمواعيد',
    // ١. الحالة
    '<div class="f"><label>الحالة *</label>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:5px">'
    +'<label onclick="_statChipToggle(this,\'available\')" style="display:flex;align-items:center;gap:7px;padding:10px;background:#dcfce7;border:2px solid #22c55e;border-radius:9px;cursor:pointer">'
    +'<input type="radio" name="dt-status" value="available" checked style="width:17px;height:17px;accent-color:#16a34a">'
    +'<span style="font-weight:800;font-size:12.5px;color:#15803d">✓ متاحة للحجز</span></label>'
    +'<label onclick="_statChipToggle(this,\'locked\')" style="display:flex;align-items:center;gap:7px;padding:10px;background:#fff;border:2px solid #e2e8f0;border-radius:9px;cursor:pointer">'
    +'<input type="radio" name="dt-status" value="locked" style="width:17px;height:17px;accent-color:#64748b">'
    +'<span style="font-weight:800;font-size:12.5px;color:#475569">🔒 مغلقة</span></label>'
    +'</div></div>'

    // ٢. المدى الزمني مع presets
    +'<div class="f"><label>المدى الزمني *</label>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:6px">'
    +'<div><div style="font-size:11px;color:var(--mid);margin-bottom:2px">من</div><input id="dt-from" class="fr-inp" type="date" min="'+today+'" value="'+today+'" oninput="_batchPreview()"></div>'
    +'<div><div style="font-size:11px;color:var(--mid);margin-bottom:2px">إلى</div><input id="dt-to" class="fr-inp" type="date" min="'+today+'" value="'+d90.toISOString().slice(0,10)+'" oninput="_batchPreview()"></div>'
    +'</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap">'
    +'<button type="button" onclick="_rangePreset(7)" style="flex:1;padding:5px 8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:7px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer">أسبوع</button>'
    +'<button type="button" onclick="_rangePreset(30)" style="flex:1;padding:5px 8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:7px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer">شهر</button>'
    +'<button type="button" onclick="_rangePreset(60)" style="flex:1;padding:5px 8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:7px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer">شهران</button>'
    +'<button type="button" onclick="_rangePreset(90)" style="flex:1;padding:5px 8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:7px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer">٣ أشهر</button>'
    +'</div></div>'

    // ٣. أيام الأسبوع
    +'<div class="f"><label>أيام الأسبوع *</label>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:5px">'+dayBtns+'</div>'
    +'<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">'
    +'<button type="button" onclick="_dwPreset(\'workdays\');_batchPreview()" style="flex:1;min-width:70px;padding:5px;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:7px;font-family:Cairo,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer">⚙️ عمل (أحد-خميس)</button>'
    +'<button type="button" onclick="_dwPreset(\'all\');_batchPreview()" style="flex:1;min-width:70px;padding:5px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:7px;font-family:Cairo,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer">📅 كل الأيام</button>'
    +'<button type="button" onclick="_dwPreset(\'weekend\');_batchPreview()" style="flex:1;min-width:70px;padding:5px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:7px;font-family:Cairo,sans-serif;font-size:10.5px;font-weight:700;cursor:pointer">🛌 عطلة</button>'
    +'</div></div>'

    // ٤. الفترات
    +'<div class="f"><label>الفترات (واحدة أو أكثر) *</label>'
    +'<div id="dtsl-list" onclick="setTimeout(_batchPreview,30)" style="max-height:160px;overflow-y:auto;padding:2px">'+slotsHtml+'</div>'
    +'</div>'

    // ٥. معاينة ذكية
    +'<div id="batch-preview" style="background:linear-gradient(135deg,#eff6ff,#fff);border:1.5px solid #3b82f6;border-right:5px solid #1e40af;border-radius:10px;padding:11px 13px;margin-bottom:8px">'
    +'<div style="font-weight:800;font-size:13px;color:#1e40af">⚡ المعاينة</div>'
    +'<div id="batch-preview-text" style="font-size:12px;color:#1e3a8a;margin-top:4px;line-height:1.6">اختر فترة لعرض النتيجة</div>'
    +'</div>'

    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDtBatch()" style="flex:1">💾 إنشاء كل الفترات</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');

  // معاينة فورية
  setTimeout(_batchPreview, 50);
}

// preset للمدى الزمني
window._rangePreset = function(days){
  var from = $g('dt-from'); var to = $g('dt-to');
  if(!from || !to) return;
  var t = new Date(); from.value = t.toISOString().slice(0,10);
  t.setDate(t.getDate()+days); to.value = t.toISOString().slice(0,10);
  _batchPreview();
};

// معاينة لحظية للنتيجة المتوقّعة (عدد فترات × أيام)
window._batchPreview = function(){
  var box = $g('batch-preview-text'); if(!box) return;
  var from = $g('dt-from')?.value; var to = $g('dt-to')?.value;
  if(!from || !to){ box.textContent = 'حدّد المدى'; return; }
  var days = [0,1,2,3,4,5,6].filter(function(i){ var b=$g('dw'+i); return b && b.dataset.checked==='1'; });
  if(!days.length){ box.textContent = 'اختر أيام الأسبوع'; return; }
  var slots = document.querySelectorAll('#dtsl-list input[type="checkbox"]:checked').length;
  if(!slots){ box.textContent = 'اختر فترة واحدة على الأقل'; return; }
  // احسب عدد الأيام المطابقة في المدى
  var dates = [], cur = new Date(from), end = new Date(to);
  while(cur <= end){ if(days.indexOf(cur.getDay())>=0) dates.push(1); cur.setDate(cur.getDate()+1); }
  if(!dates.length){ box.textContent = 'لا أيام مطابقة في هذا المدى'; return; }
  var status = (document.querySelector('[name="dt-status"]:checked')||{}).value === 'locked' ? 'مغلقة' : 'متاحة';
  box.innerHTML = 'سيُنشَأ <b>'+(slots*dates.length)+' فترة</b> '+status
    +'<br><span style="font-size:11px;color:var(--mid)">('+slots+' فترة × '+dates.length+' يوم)</span>';
};

// زر يوم أسبوع — يقلب الحالة
window._dwToggle = function(i){
  var b = document.getElementById('dw'+i);
  if(!b) return;
  var on = b.dataset.checked === '1';
  on = !on;
  b.dataset.checked = on ? '1' : '0';
  b.style.background = on ? '#dbeafe' : '#fff';
  b.style.color = on ? '#1e40af' : '#475569';
  b.style.borderColor = on ? '#3b82f6' : '#e2e8f0';
  b.style.fontWeight = on ? '800' : '600';
};

// preset سريع لأيام الأسبوع
window._dwPreset = function(mode){
  var picks = {
    workdays: [0,1,2,3,4],     // الأحد-الخميس
    all:      [0,1,2,3,4,5,6], // كل الأيام
    weekend:  [5,6],           // الجمعة-السبت
    none:     [],              // مسح
  }[mode] || [];
  for(var i=0;i<7;i++){
    var b = document.getElementById('dw'+i);
    if(!b) continue;
    var on = picks.indexOf(i) >= 0;
    b.dataset.checked = on ? '1' : '0';
    b.style.background = on ? '#dbeafe' : '#fff';
    b.style.color = on ? '#1e40af' : '#475569';
    b.style.borderColor = on ? '#3b82f6' : '#e2e8f0';
    b.style.fontWeight = on ? '800' : '600';
  }
};

// إضافة فترات لكل الأيام المحدّدة من التقويم (multi-select mode)
// يدعم: اختيار الحالة (متاح / مغلق) + اختيار عدّة فترات معاً
// presetStatus اختياري ('available' | 'locked') لتفعيل الحالة مسبقاً
function oDtMulti(presetStatus){
  if(!window._aptMultiSet || !window._aptMultiSet.size){
    toast('لم تُحدِّد أيّ يوم','er'); return;
  }
  if(!D.slt.length){toast('أضف فترات أولاً','er'); return;}
  var dates = Array.from(window._aptMultiSet).sort();
  var defStatus = presetStatus === 'locked' ? 'locked' : 'available';
  var slotsHtml = D.slt.map(function(s){
    var timeStr = (s.time_from && s.time_to) ? (s.time_from.slice(0,5)+' — '+s.time_to.slice(0,5)) : '';
    return '<label style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:6px;cursor:pointer;transition:all .12s" onclick="_slotChipToggle(this)">'
      + '<input type="checkbox" data-slotid="'+s.id+'" style="width:18px;height:18px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-weight:700;font-size:13.5px;color:#0f172a">⏰ '+(s.name||'فترة')+'</div>'
      +   (timeStr ? '<div style="font-size:11.5px;color:var(--mid);margin-top:1px">'+timeStr+'</div>' : '')
      + '</div>'
      + '</label>';
  }).join('');

  var availSel = defStatus==='available';
  var lockedSel = defStatus==='locked';
  oM('إضافة فترات لـ '+dates.length+' يوم',
    // ١. اختيار الحالة — متاح أو مغلق (مُحدَّد افتراضياً حسب presetStatus)
    '<div class="f"><label>الحالة المطلوبة *</label>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:5px">'
    +'<label onclick="_statChipToggle(this,\'available\')" style="display:flex;align-items:center;gap:8px;padding:11px;background:'+(availSel?'#dcfce7':'#fff')+';border:2px solid '+(availSel?'#22c55e':'#e2e8f0')+';border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="dt-status" value="available"'+(availSel?' checked':'')+' style="width:18px;height:18px;accent-color:#16a34a">'
    +'<div><div style="font-weight:800;font-size:13px;color:'+(availSel?'#15803d':'#475569')+'">✓ متاحة للحجز</div>'
    +'<div style="font-size:11px;color:'+(availSel?'#16a34a':'#64748b')+'">يستطيع المراجعون الحجز</div></div></label>'
    +'<label onclick="_statChipToggle(this,\'locked\')" style="display:flex;align-items:center;gap:8px;padding:11px;background:'+(lockedSel?'#f1f5f9':'#fff')+';border:2px solid '+(lockedSel?'#94a3b8':'#e2e8f0')+';border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="dt-status" value="locked"'+(lockedSel?' checked':'')+' style="width:18px;height:18px;accent-color:#64748b">'
    +'<div><div style="font-weight:800;font-size:13px;color:#475569">🔒 مغلقة</div>'
    +'<div style="font-size:11px;color:#64748b">معدّة لكن مغلقة للحجز</div></div></label>'
    +'</div></div>'

    // ٢. اختيار الفترات
    +'<div class="f"><label>الفترات (واحدة أو أكثر) *</label>'
    +'<div id="dtsl-list" style="max-height:200px;overflow-y:auto;padding:2px">'+slotsHtml+'</div>'
    +'</div>'

    // ٣. ملخّص الأيام
    +'<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:9px;padding:8px 11px;max-height:80px;overflow-y:auto;margin-bottom:8px">'
    +'<div style="font-size:11px;font-weight:800;color:#0369a1;margin-bottom:3px">الأيام ('+dates.length+'):</div>'
    +'<div style="font-size:11.5px;color:#1e293b;line-height:1.6">'+dates.join('، ')+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDtMulti()" style="flex:1">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

window._slotChipToggle = function(label){
  setTimeout(function(){
    var cb = label.querySelector('input[type="checkbox"]');
    if(!cb) return;
    label.style.borderColor = cb.checked ? '#3b82f6' : '#e2e8f0';
    label.style.background  = cb.checked ? '#eff6ff' : '#fff';
  }, 0);
};

window._statChipToggle = function(label, val){
  setTimeout(function(){
    document.querySelectorAll('[name="dt-status"]').forEach(function(r){
      var lab = r.closest('label');
      if(!lab) return;
      var on = r.value === val && r.checked;
      if(on){
        lab.style.background = val==='available' ? '#dcfce7' : '#f1f5f9';
        lab.style.borderColor = val==='available' ? '#22c55e' : '#94a3b8';
      } else {
        lab.style.background = '#fff';
        lab.style.borderColor = '#e2e8f0';
      }
    });
  }, 0);
};

window.svDtMulti = async function(){
  var checks = document.querySelectorAll('#dtsl-list input[type="checkbox"]:checked');
  if(!checks.length){ toast('اختر فترة واحدة على الأقل','er'); return; }
  var dates = Array.from(window._aptMultiSet || []);
  if(!dates.length){ toast('لا توجد أيام محدّدة','er'); return; }
  var slotIds = Array.from(checks).map(function(c){ return +c.getAttribute('data-slotid'); });
  // اقرأ الحالة المختارة (default: available)
  var statusEl = document.querySelector('[name="dt-status"]:checked');
  var newStatus = (statusEl && statusEl.value === 'locked') ? 'locked' : 'available';

  ld(1);
  var done = 0, errs = [];
  for(var i=0;i<slotIds.length;i++){
    var r = await api('POST','dates', { slot_id: slotIds[i], dates: dates, status: newStatus });
    if(r && r.error) errs.push(r.error);
    else done++;
  }
  ld(0);

  if(done){
    var totalCells = slotIds.length * dates.length;
    var statLbl = newStatus==='locked' ? 'مغلقة' : 'متاحة';
    toast('✅ تمت إضافة '+totalCells+' فترة '+statLbl+' ('+slotIds.length+'×'+dates.length+')');
    window._aptMultiSet.clear();
    window._aptMulti = false;
    cM();
    // تحديث كامل: إعادة تحميل D.dts و D.apt ثم انتقل لـ «المتاحة» لرؤية النتيجة
    await Promise.all([lDts(), (typeof lApt==='function'?lApt():Promise.resolve())]);
    window.APT_TAB = 'available';
    pApt();
  } else {
    toast('فشل الحفظ: ' + (errs[0] || 'خطأ'),'er');
  }
};

async function svDt(){
  const sl=$g('dtsl')?.value,dt=$g('dtd')?.value;
  if(!sl||!dt){toast('أدخل الفترة والتاريخ','er');return;}
  ld(1);const r=await api('POST','dates',{slot_id:+sl,date:dt,status:'available'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تمت الإضافة ✅');cM();await lDts();rAptContent();
}

async function svDtBatch(){
  const from=$g('dt-from')?.value, to=$g('dt-to')?.value;
  if(!from||!to){toast('حدّد المدى الزمني','er');return;}
  const days=[0,1,2,3,4,5,6].filter(function(i){
    var b=$g('dw'+i); return b && b.dataset.checked==='1';
  });
  if(!days.length){toast('اختر يوماً واحداً على الأقل من أيام الأسبوع','er');return;}
  // multi-slot من checkboxes الجديدة
  var checks = document.querySelectorAll('#dtsl-list input[type="checkbox"]:checked');
  if(!checks.length){toast('اختر فترة واحدة على الأقل','er');return;}
  var slotIds = Array.from(checks).map(function(c){ return +c.getAttribute('data-slotid'); });
  // الحالة من الـ radio
  var statusEl = document.querySelector('[name="dt-status"]:checked');
  var newStatus = (statusEl && statusEl.value === 'locked') ? 'locked' : 'available';

  const dates=[];let cur=new Date(from);const end=new Date(to);
  while(cur<=end){if(days.indexOf(cur.getDay())>=0)dates.push(cur.toISOString().slice(0,10));cur.setDate(cur.getDate()+1);}
  if(!dates.length){toast('لا توجد أيام مطابقة في هذا المدى','er');return;}

  ld(1);
  var done=0, errs=[];
  for(var i=0;i<slotIds.length;i++){
    var r = await api('POST','dates', { slot_id: slotIds[i], dates: dates, status: newStatus });
    if(r && r.error) errs.push(r.error);
    else done++;
  }
  ld(0);
  if(done){
    var total = slotIds.length*dates.length;
    var lbl = newStatus==='locked' ? 'مغلقة' : 'متاحة';
    toast('✅ تم إنشاء '+total+' فترة '+lbl);
    cM();
    await Promise.all([lDts(), (typeof lApt==='function'?lApt():Promise.resolve())]);
    window.APT_TAB = 'available';
    pApt();
  } else {
    toast('فشل: '+(errs[0]||'خطأ'),'er');
  }
}

async function tDtStatus(id,newStatus){
  ld(1);await api('PUT','dates/'+id,{status:newStatus});ld(0);
  await lDts();rAptContent();
}

async function tDt(id,cur){await tDtStatus(id,cur==='available'?'locked':'available');}

async function toggleAllDay(date,allOpen){
  ld(1);
  await Promise.all(D.dts.filter(d=>(d.date||'').slice(0,10)===date&&d.status!=='booked').map(s=>api('PUT','dates/'+s.id,{status:allOpen?'locked':'available'})));
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

// ─── تقييم ما بعد الجلسة — جانب المشرف ──────────────────────────────
// المعايير ديناميكية من session_eval_fields — يديرها المشرف من الإعدادات.
window.oAdmSessionEval = async function(aptId, reviewerName, dateStr, slotName){
  oM('📝 تقييم الجلسة',
    '<div style="text-align:center;padding:30px 8px;color:var(--mid);font-size:13px">'
    + '<div style="font-size:28px;margin-bottom:8px">⏳</div>جاري التحميل…</div>');
  var res = await Promise.all([
    api('GET','session_evals?appointment_id='+aptId),
    api('GET','session_eval_fields')
  ]);
  if(res[0] && res[0].error){ toast(res[0].error,'er'); cM(); return; }
  var rows = Array.isArray(res[0]) ? res[0] : [];
  var fields = Array.isArray(res[1]) ? res[1] : [];
  _admRenderSessionEval(aptId, reviewerName, dateStr, slotName, rows, fields);
};

function _admRenderSessionEval(aptId, reviewerName, dateStr, slotName, rows, fields){
  var h='';
  h+='<div style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;margin-bottom:10px">';
  h+='<div style="font-weight:800;font-size:13px;color:#1e40af">👤 '+htmlEsc(reviewerName||'—')+'</div>';
  h+='<div style="font-size:11.5px;color:#1e3a8a;margin-top:2px">⏰ '+htmlEsc(slotName||'—')+' · 📅 '+htmlEsc(dateStr||'—')+'</div>';
  h+='</div>';

  if(rows.length){
    h+='<div style="max-height:40vh;overflow-y:auto;padding:2px;margin-bottom:10px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">';
    rows.forEach(function(r){
      var isAdmin = r.author_role==='admin';
      var bg = isAdmin ? '#fef3c7' : '#dbeafe';
      var bdr = isAdmin ? '#fbbf24' : '#3b82f6';
      var clr = isAdmin ? '#92400e' : '#1e40af';
      var nm = htmlEsc(r.author_name || (isAdmin?'المشرف':'مراجع'));
      var dt = (r.created_at||'').replace('T',' ').slice(0,16);
      h+='<div style="background:'+bg+';border:1px solid '+bdr+';border-right:4px solid '+clr+';border-radius:8px;padding:8px 10px;margin:6px;position:relative">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px">';
      h+='<div style="font-weight:800;font-size:11.5px;color:'+clr+'">'+(isAdmin?'👨‍⚕️ ':'👤 ')+nm+'</div>';
      h+='<div style="display:flex;align-items:center;gap:6px">';
      h+='<div style="font-size:10.5px;color:'+clr+';opacity:.75">'+dt+'</div>';
      h+='<button class="ib id" data-delseval="'+r.id+'" style="width:22px;height:22px;font-size:11px" title="حذف">×</button>';
      h+='</div>';
      h+='</div>';
      var ans = r.answers || {};
      var any=false;
      fields.forEach(function(f){
        var v=ans[String(f.id)];
        if(v && String(v).trim()){
          any=true;
          h+='<div style="margin-top:4px;font-size:12px;color:#0f172a"><b style="color:'+clr+'">'+(f.icon||'·')+' '+htmlEsc(f.label)+':</b> '+htmlEsc(v)+'</div>';
        }
      });
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
    h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;color:#94a3b8;font-size:12.5px;margin-bottom:10px">لا توجد تقييمات بعد — يستطيع المراجع كتابتها بعد اعتماد الجلسة</div>';
  }

  h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">';
  h+='<div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:8px">✍️ ردّك / تقييمك</div>';
  if(!fields.length){
    h+='<div style="font-size:12px;color:var(--mid);text-align:center;padding:10px">لا توجد معايير — أضف من الإعدادات.</div>';
  } else {
    h+='<div style="font-size:11px;color:var(--mid);margin-bottom:8px">املأ المعايير المعنيّة.</div>';
    fields.forEach(function(f,i){
      var rows2 = (i===fields.length-1) ? 3 : 2;
      h+='<div style="margin-bottom:8px">';
      h+='<label style="display:block;font-size:11.5px;color:#475569;font-weight:700;margin-bottom:3px">'+(f.icon||'·')+' '+htmlEsc(f.label)+'</label>';
      h+='<textarea id="ase-'+f.id+'" rows="'+rows2+'" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;outline:none;resize:vertical;box-sizing:border-box" placeholder="اكتب هنا..."></textarea>';
      h+='</div>';
    });
  }
  h+='<div style="display:flex;gap:9px;margin-top:8px">';
  if(fields.length) h+='<button class="btn bp" id="ase-save" data-apt="'+aptId+'" style="flex:1">💾 إرسال</button>';
  h+='<button class="btn bs" onclick="cM()">إغلاق</button>';
  h+='</div>';
  h+='</div>';

  $h('mb', h);

  setTimeout(function(){
    var btn=document.getElementById('ase-save');
    if(btn){
      btn.addEventListener('click', async function(){
        var answers={};
        var hasAny=false;
        fields.forEach(function(f){
          var v=(document.getElementById('ase-'+f.id)?.value||'').trim();
          if(v){ answers[String(f.id)]=v; hasAny=true; }
        });
        if(!hasAny){ toast('اكتب ردّاً واحداً على الأقل','er'); return; }
        ld(1);
        var r=await api('POST','session_evals',{ appointment_id: aptId, answers: answers });
        ld(0);
        if(r&&r.error){ toast(r.error,'er'); return; }
        toast('✅ تم الإرسال');
        var res = await api('GET','session_evals?appointment_id='+aptId);
        _admRenderSessionEval(aptId, reviewerName, dateStr, slotName, Array.isArray(res)?res:[], fields);
      });
    }
    document.querySelectorAll('[data-delseval]').forEach(function(b){
      b.addEventListener('click', async function(){
        if(!confirmDel('حذف هذا الإدخال؟')) return;
        ld(1);
        var r=await api('DELETE','session_evals/'+(+b.dataset.delseval));
        ld(0);
        if(r&&r.error){ toast(r.error,'er'); return; }
        toast('تم الحذف ✅');
        var res = await api('GET','session_evals?appointment_id='+aptId);
        _admRenderSessionEval(aptId, reviewerName, dateStr, slotName, Array.isArray(res)?res:[], fields);
      });
    });
  }, 30);
}
