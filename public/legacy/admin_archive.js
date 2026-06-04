/* admin_archive.js - أرشيف الأدمن - محادثات + استمارات + مواعيد */

async function pArchiveChats(){
  ld(1);
  var r=await api('GET','archive_chats');
  ld(0);
  var list=Array.isArray(r)?r:[];

  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  h+='<button class="btn bs bsm" onclick="pArchive()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:16px">💬 أرشيف المحادثات</div>';
  h+='</div>';

  if(!list.length){
    h+='<div style="text-align:center;padding:40px;color:var(--light)"><div style="font-size:40px;margin-bottom:10px">📭</div><p>لا توجد محادثات مؤرشفة</p></div>';
    $h('pg',h);return;
  }

  list.forEach(function(cv){
    var name=cv.reviewer_name||'مراجع';
    var title=cv.title||'محادثة';
    var date=(cv.archived_at||cv.created_at||'').slice(0,10);
    var msgs=cv.msg_count||0;
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.04)">';
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">';
    h+='<div style="width:38px;height:38px;border-radius:50%;background:#94a3b8;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0">'+name.charAt(0)+'</div>';
    h+='<div style="flex:1">';
    h+='<div style="font-weight:700;font-size:14px">'+htmlEsc(name)+'</div>';
    h+='<div style="font-size:12px;color:#0369a1;font-weight:600;margin-top:2px">📌 '+htmlEsc(title)+'</div>';
    h+='<div style="font-size:11px;color:var(--mid);margin-top:2px">'+date+' • '+msgs+' رسالة</div>';
    h+='</div></div>';
    h+='<div style="display:flex;gap:6px">';
    h+='<button class="btn bs bsm" onclick="viewArchivedChat('+cv.id+')">👁️ عرض</button>';
    h+='<button class="btn bp bsm" onclick="restoreChat('+cv.id+')">↩️ استعادة</button>';
    h+='</div></div>';
  });

  $h('pg',h);
}

async function pArchiveForms(){
  ld(1);
  var r=await api('GET','archive_forms');
  ld(0);
  var list=Array.isArray(r)?r:(r&&r.items?r.items:[]);

  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  h+='<button class="btn bs bsm" onclick="pArchive()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:16px">📋 أرشيف الاستمارات</div>';
  h+='</div>';

  if(!list.length){
    h+='<div style="text-align:center;padding:40px;color:var(--light)"><div style="font-size:40px;margin-bottom:10px">📭</div><p>لا توجد استمارات مؤرشفة</p></div>';
    $h('pg',h);return;
  }

  list.forEach(function(s){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px">';
    h+='<div style="font-weight:700;margin-bottom:4px">'+htmlEsc(s.form_title||s.title||'استمارة')+'</div>';
    h+='<div style="font-size:12px;color:var(--mid);margin-bottom:10px">'+htmlEsc(s.reviewer_name||'')+'  •  '+(s.created_at||'').slice(0,10)+'</div>';
    h+='<div style="display:flex;gap:6px">';
    h+='<button class="btn bs bsm" onclick="viewArchivedSub('+s.id+')">👁️ عرض</button>';
    h+='<button class="btn bp bsm" onclick="restoreSubmission('+s.id+')">↩️ استعادة</button>';
    h+='</div></div>';
  });

  $h('pg',h);
}

async function pArchiveApts(){
  ld(1);
  var r=await api('GET','archive_apts');
  ld(0);
  var list=Array.isArray(r)?r:(r&&r.items?r.items:[]);

  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  h+='<button class="btn bs bsm" onclick="pArchive()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:16px">📅 أرشيف المواعيد</div>';
  h+='</div>';
  h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:10px 12px;font-size:12px;color:#92400e;margin-bottom:12px">⚠️ المواعيد المؤرشفة للاطلاع فقط — غير قابلة للاستعادة</div>';

  if(!list.length){
    h+='<div style="text-align:center;padding:40px;color:var(--light)"><div style="font-size:40px;margin-bottom:10px">📭</div><p>لا توجد مواعيد مؤرشفة</p></div>';
    $h('pg',h);return;
  }

  list.forEach(function(a){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px">';
    h+='<div style="font-weight:700;margin-bottom:4px">'+htmlEsc(a.slot_name||'موعد')+'</div>';
    h+='<div style="font-size:12px;color:var(--mid)">'+htmlEsc(a.reviewer_name||'')+'  •  📅 '+(a.date||'')+'</div>';
    if(a.notes) h+='<div style="font-size:12px;color:var(--mid);margin-top:4px">📝 '+htmlEsc(a.notes)+'</div>';
    h+='</div>';
  });

  $h('pg',h);
}

async function viewArchivedChat(tid){
  ld(1);
  var r=await api('GET','threads/'+tid);
  ld(0);
  var msgs=Array.isArray(r)?r:(r&&r.messages?r.messages:[]);
  
  // جلب بيانات الـ thread
  var threads=await api('GET','archive_chats');
  var thread=(Array.isArray(threads)?threads:[]).find(function(t){return +t.id===+tid;})||{};
  var name=thread.reviewer_name||'مراجع';
  var title=thread.title||'محادثة';

  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  h+='<button class="btn bs bsm" onclick="pArchiveChats()">← رجوع</button>';
  h+='<div style="flex:1">';
  h+='<div style="font-weight:800;font-size:15px">'+htmlEsc(name)+'</div>';
  h+='<div style="font-size:12px;color:#0369a1;font-weight:600">📌 '+htmlEsc(title)+'</div>';
  h+='</div>';
  h+='<button class="btn bp bsm" onclick="restoreChat('+tid+')">↩️ استعادة</button>';
  h+='</div>';

  if(!msgs.length){
    h+='<div style="text-align:center;padding:30px;color:var(--light)">لا توجد رسائل</div>';
    $h('pg',h);return;
  }

  var today=new Date().toISOString().slice(0,10),ld2='';
  msgs.forEach(function(m){
    var d=(m.created_at||'').slice(0,10),t=(m.created_at||'').slice(11,16);
    if(d&&d!==ld2){h+='<div style="text-align:center;margin:8px 0"><span style="background:rgba(0,0,0,.1);color:#54656f;font-size:11px;padding:3px 10px;border-radius:8px">'+(d===today?'اليوم':d)+'</span></div>';ld2=d;}
    var isAdmin=m.from_name&&(m.from_role==='admin'||+m.from_id!==+thread.reviewer_id);
    var bd=htmlEsc(m.body||'');
    if(isAdmin){
      h+='<div style="display:flex;justify-content:flex-end;padding:1px 4px;margin-bottom:1px"><div style="background:#d9f7be;border-radius:0 12px 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.1)">';
      h+='<div style="font-size:14px;color:#111">'+bd+'</div>';
      h+='<div style="font-size:10.5px;color:rgba(0,0,0,.4);text-align:left;margin-top:2px">'+t+'</div></div></div>';
    } else {
      h+='<div style="display:flex;padding:1px 4px;margin-bottom:1px"><div style="background:#fff;border-radius:12px 0 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.1)">';
      h+='<div style="font-size:14px;color:#111">'+bd+'</div>';
      h+='<div style="font-size:10.5px;color:rgba(0,0,0,.4);text-align:left;margin-top:2px">'+t+'</div></div></div>';
    }
  });

  $h('pg',h);
}

async function viewArchivedSub(sid){
  ld(1);
  var r=await api('GET','submissions/'+sid);
  ld(0);
  if(r.error){toast(r.error,'er');return;}
  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  h+='<button class="btn bs bsm" onclick="pArchiveForms()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:15px">'+htmlEsc(r.form_title||'')+'</div>';
  h+='<span style="margin-right:auto;background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">🗄️ مؤرشفة</span>';
  h+='</div>';
  (r.answers||[]).forEach(function(a){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
    h+='<div style="font-size:12px;font-weight:700;color:var(--blue2);margin-bottom:6px">'+htmlEsc(a.label||'')+'</div>';
    h+='<div style="font-size:14px;color:#1e293b">'+htmlEsc(a.answer||'—')+'</div>';
    h+='</div>';
  });
  $h('pg',h);
}


async function archiveChat(uid,tid){
  oConfirm('أرشفة هذا الموضوع؟',async function(){
    ld(1);var r=await api('PUT','threads/archive',{thread_id:tid||0});ld(0);
    if(r&&r.ok){toast('✅ تم الأرشفة');if(typeof aStop==='function')aStop();if(typeof lCvs==='function')await lCvs();pCht();}
    else toast((r&&r.error)||'فشل','er');
  },{icon:'🗄️',yes:'أرشفة',no:'إلغاء'});
}
async function archiveSubmission(id){
  oConfirm('أرشفة هذه الاستمارة؟',async function(){
    ld(1);var r=await api('PUT','submissions/'+id,{status:'archived'});ld(0);
    if(r&&r.ok){
      toast('✅ تم الأرشفة');await lSub();
      if(typeof NAV!=='undefined' && NAV==='forms' && typeof pFrm==='function') pFrm();
      else if(typeof rSubs==='function') rSubs();
    }
    else toast((r&&r.error)||'فشل','er');
  },{icon:'🗄️',yes:'أرشفة',no:'إلغاء'});
}
async function archiveApt(id){
  oConfirm('أرشفة هذا الموعد؟ لا يمكن استعادته.',async function(){
    ld(1);var r=await api('PUT','appointments/'+id,{status:'archived'});ld(0);
    if(r&&r.ok){toast('✅ تم الأرشفة');await lApt();pApt();}
    else toast((r&&r.error)||'فشل','er');
  },{icon:'🗄️',yes:'أرشفة',no:'إلغاء',danger:true});
}
async function restoreChat(tid){
  oConfirm('استعادة هذه المحادثة؟',async function(){
    ld(1);var r=await api('PUT','threads/restore',{thread_id:tid});ld(0);
    if(r&&r.ok){toast('✅ تم الاستعادة');await lCvs();pArchiveChats();}
    else toast((r&&r.error)||'فشل','er');
  },{icon:'↩️',yes:'استعادة',no:'إلغاء'});
}
async function restoreSubmission(id){
  oConfirm('استعادة هذه الاستمارة؟',async function(){
    ld(1);var r=await api('PUT','submissions/'+id,{status:'done'});ld(0);
    if(r&&r.ok){
      toast('✅ تم الاستعادة');await lSub();
      if(typeof NAV!=='undefined' && NAV==='forms' && typeof pFrm==='function') pFrm();
      else if(typeof pArchiveForms==='function') pArchiveForms();
    }
    else toast((r&&r.error)||'فشل','er');
  },{icon:'↩️',yes:'استعادة',no:'إلغاء'});
}
