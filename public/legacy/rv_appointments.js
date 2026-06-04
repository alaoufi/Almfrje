/* rv_appointments.js */

async function rvAppointments(){
  ld(1);
  var res=await Promise.all([api('GET','appointments'),api('GET','dates')]);
  ld(0);
  var myApts=Array.isArray(res[0])?res[0]:[];
  var allDates=Array.isArray(res[1])?res[1]:[];
  var availDates=allDates.filter(function(d){return d.status==='available';});
  var today=new Date().toISOString().slice(0,10);
  var activApts=myApts.filter(function(a){return ['pending','confirmed'].includes(a.status);});
  var pastApts=myApts.filter(function(a){return !['pending','confirmed'].includes(a.status);});

  var h='';

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

  // الجدول المتاح
  h+='<div style="font-weight:800;font-size:13px;margin-bottom:10px;color:var(--blue2)">📅 المواعيد المتاحة</div>';

  if(activApts.length){
    h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px;font-size:13px;color:#92400e">'
      +'⚠️ لديك موعد نشط. أتمم الموعد أو ألغه لحجز موعد جديد.</div>';
  } else if(!availDates.length){
    h+='<div style="text-align:center;padding:40px 16px;color:var(--light)">'
      +'<div style="font-size:40px;margin-bottom:10px">📅</div>'
      +'<p>لا توجد مواعيد متاحة الآن</p></div>';
  } else {
    // تجميع حسب اليوم
    var grouped={};
    availDates.forEach(function(d){
      if(!grouped[d.date])grouped[d.date]=[];
      grouped[d.date].push(d);
    });
    var AR_DAYS3=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
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
        h+='<div style="display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:10px 12px;margin-bottom:6px">';
        h+='<div>';
        h+='<div style="font-weight:700;font-size:14px">'+s.slot_name+'</div>';
        if(s.time_from) h+='<div style="font-size:11px;color:var(--mid)">'+(s.time_from||'').slice(0,5)+'</div>';
        h+='</div>';
        h+='<button class="btn bp" style="min-width:70px;padding:8px 14px" data-book="'+s.id+'">📌 حجز</button>';
        h+='</div>';
      });
      h+='</div>';
    });
  }

  // السجل
  if(pastApts.length){
    h+='<div style="font-weight:800;font-size:12px;margin:14px 0 8px;color:var(--mid)">السجل</div>';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;overflow:hidden">';
    pastApts.slice(0,5).forEach(function(a,i){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;'+(i>0?'border-top:1px solid var(--border)':'')+';">';
      h+='<div><div style="font-weight:600;font-size:13px">'+(a.slot_name||'—')+'</div>'
        +'<div style="font-size:11px;color:var(--mid)">'+a.date+'</div></div>';
      h+='<span class="apt-badge '+a.status+'">'+rvAptLabel(a.status)+'</span>';
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
  },50);
}

function rvAptLabel(s){
  const m={pending:'⏳ بانتظار التأكيد',confirmed:'✅ مؤكد',completed:'🏁 مكتمل',
    booked:'📌 محجوز',locked:'🔒 مغلق',exceptional:'⭐ استثنائي',
    cancelled_admin:'❌ ألغته الإدارة',cancelled_reviewer:'↩️ ألغيته'};
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

