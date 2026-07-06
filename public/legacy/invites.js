/* invites.js — دعوة أشخاص بسقف ومدّة ٥ أيام
 *
 * يُستخدم من المراجع (لو عنده رصيد) والمدير (يرى كل الدعوات).
 * يُحمَّل بعد reviewer.js / users.js.
 */

window.INV_STATUS_LABEL = {
  pending:   { txt: '⏳ بانتظار',      bg:'#fef3c7', clr:'#92400e' },
  used:      { txt: '✅ سجّل',          bg:'#dcfce7', clr:'#15803d' },
  expired:   { txt: '⏰ انتهت',         bg:'#fee2e2', clr:'#b91c1c' },
  cancelled: { txt: '❌ ملغاة',         bg:'#f1f5f9', clr:'#475569' },
};

window.pInv = async function pInv(){
  ld(1);
  var res = await api('GET','invitations');
  ld(0);
  var list = Array.isArray(res) ? res : [];
  _renderInvPage(list);
};

function _renderInvPage(list){
  var isAdmin = U && U.role==='admin';
  var quota = +(U && U.invite_quota || 0);
  var used  = +(U && U.invite_used  || 0);
  var rem   = Math.max(0, quota - used);
  var pageId = isAdmin ? 'pg' : 'rv-pg';
  var title = isAdmin ? '📨 الدعوات' : '📨 دعواتي';

  var h='<div class="ph"><div><div class="pt">'+title+'</div>';
  if(!isAdmin) h+='<div class="ps">دعوة شخص واحد تخصم من رصيدك</div>';
  h+='</div>';
  if(!isAdmin && rem>0) h+='<button class="btn bp" onclick="oNewInv()">+ دعوة جديدة</button>';
  h+='</div>';

  if(!isAdmin){
    // بطاقة الرصيد
    var rpct = quota>0 ? Math.round(used*100/quota) : 0;
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.05)">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    h+='<div style="font-weight:800;font-size:14px;color:#0f172a">رصيدك</div>';
    h+='<div style="font-weight:800;font-size:18px;color:'+(rem>0?'#15803d':'#b91c1c')+'">'+rem+' / '+quota+'</div>';
    h+='</div>';
    h+='<div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">';
    h+='<div style="height:100%;width:'+rpct+'%;background:#22c55e"></div>';
    h+='</div>';
    h+='<div style="font-size:11px;color:var(--mid);margin-top:6px">استخدم رصيدك بحكمة. كل دعوة لها مدّة ٥ أيام، وإن لم يستجب المدعو خلالها تنتهي ولا يمكن إعادة دعوته.</div>';
    h+='</div>';

    if(!quota){
      h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:30px 16px;text-align:center;color:#94a3b8;font-size:13px">'
        +'<div style="font-size:38px;margin-bottom:8px">📨</div>'
        +'لا يوجد لك رصيد دعوات. اطلب من المدير منحك رصيداً.'
        +'</div>';
      $h(pageId,h);
      return;
    }
  }

  if(!list.length){
    h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:30px 16px;text-align:center;color:#94a3b8;font-size:13px">'
      +'<div style="font-size:38px;margin-bottom:8px">📭</div>لا توجد دعوات بعد</div>';
    $h(pageId,h);
    return;
  }

  list.forEach(function(inv){
    var st = INV_STATUS_LABEL[inv.status] || INV_STATUS_LABEL.pending;
    var exp = inv.expires_at ? new Date(inv.expires_at) : null;
    var now = new Date();
    var daysLeft = exp ? Math.max(0, Math.ceil((exp - now)/86400000)) : 0;
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:800;font-size:14px;color:#0f172a">'+htmlEsc(inv.name||'')+'</div>';
    h+='<div style="font-size:12px;color:var(--mid);margin-top:2px">📞 '+htmlEsc(inv.phone||'')+'</div>';
    if(inv.status==='pending') h+='<div style="font-size:11px;color:#92400e;margin-top:4px">⏰ متبقّي '+daysLeft+' '+(daysLeft===1?'يوم':'أيام')+' من ٥</div>';
    h+='</div>';
    h+='<span style="background:'+st.bg+';color:'+st.clr+';padding:3px 10px;border-radius:14px;font-size:11px;font-weight:800;white-space:nowrap">'+st.txt+'</span>';
    h+='</div>';
    if(inv.status==='pending'){
      var url = location.origin + '/?invite=' + encodeURIComponent(inv.token||'');
      h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-top:8px">';
      h+='<div style="font-size:10.5px;color:var(--mid);margin-bottom:4px">رابط الدعوة:</div>';
      h+='<div style="font-size:11px;color:#1d4ed8;word-break:break-all;font-family:monospace">'+url+'</div>';
      h+='<div style="display:flex;gap:6px;margin-top:6px">';
      h+='<button class="btn bp bsm" onclick="invCopy(\''+url+'\')" style="flex:1">📋 نسخ الرابط</button>';
      h+='<button class="btn bp bsm" onclick="invShare(\''+url+'\',\''+htmlEsc(inv.name||'')+'\')" style="flex:1">📤 مشاركة</button>';
      h+='<button class="btn bd bsm" onclick="invCancel('+inv.id+')">✕</button>';
      h+='</div>';
      h+='</div>';
    }
    h+='</div>';
  });

  $h(pageId,h);
}

window.oNewInv = function(){
  oM('+ دعوة جديدة',
    '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#92400e;line-height:1.7">'
    +'⏰ المدعو لديه <b>٥ أيام فقط</b> للتسجيل عبر الرابط، وإلا تنتهي الدعوة ولا يمكن إعادة دعوته.'
    +'</div>'
    +'<div class="f"><label>الاسم *</label><input id="iv-nm" class="fr-inp" placeholder="الاسم الكامل"></div>'
    +'<div class="f"><label>رقم الجوال *</label><input id="iv-ph" class="fr-inp" type="tel" inputmode="tel" placeholder="+9665XXXXXXXX"></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svNewInv()">📨 إنشاء الدعوة</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
};

window.svNewInv = async function(){
  var nm = ($g('iv-nm')?.value||'').trim();
  var ph = ($g('iv-ph')?.value||'').trim();
  if(!nm || !ph){ toast('أدخل الاسم والجوال','er'); return; }
  ld(1);
  var r = await api('POST','invitations',{ name: nm, phone: ph });
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('✅ تم إنشاء الدعوة');
  // حدّث U.invite_used محلياً ليُحتسب الرصيد فوراً
  if(U) U.invite_used = (+(U.invite_used||0)) + 1;
  cM();
  pInv();
};

window.invCancel = async function(id){
  if(!confirmDel('إلغاء الدعوة؟ سيُسترَدّ الرصيد')) return;
  ld(1);
  var r = await api('DELETE','invitations/'+id);
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('تم الإلغاء ✅');
  if(U && +U.invite_used>0) U.invite_used = +U.invite_used - 1;
  pInv();
};

window.invCopy = async function(url){
  try { await navigator.clipboard.writeText(url); toast('📋 تم النسخ'); }
  catch(e){
    var ta = document.createElement('textarea'); ta.value=url; document.body.appendChild(ta);
    ta.select(); try{ document.execCommand('copy'); toast('📋 تم النسخ'); }catch(_){ toast('تعذّر النسخ','er'); }
    document.body.removeChild(ta);
  }
};

window.invShare = async function(url, name){
  var days = (U && +U.invite_days) || 5;
  var text = (name?('دعوة لـ '+name+': '):'') + 'انضم لمنصّة الاستشارات عبر هذا الرابط (صالح '+days+' أيام)\n' + url;
  if(navigator.share){
    try{ await navigator.share({ title:'دعوة', text: text }); return; }catch(_){}
  }
  // Fallback: WhatsApp
  var wa = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(wa, '_blank', 'noopener');
};

// ─── صفحة "المدعوّون" — لأصحاب دور 'دعوات' ──────────────────────────
// قائمة بمن دعاهم هذا الحساب مع متابعة بسيطة (مواعيد فقط).
// لا تُكشف هنا (ولا في أي مكان آخر): محادثاتهم مع الإدارة، تقاريرهم، استماراتهم.
window.pInvitees = async function(){
  var pageId = (U && U.role==='admin') ? 'pg' : 'rv-pg';
  $h(pageId,'<div style="text-align:center;padding:30px;color:var(--mid)">جاري التحميل…</div>');
  var r = await api('GET','my_invitees');
  if(r && r.error){ $h(pageId,'<div style="color:#dc2626;text-align:center;padding:30px">'+r.error+'</div>'); return; }
  var list = Array.isArray(r) ? r : [];

  var h='<div class="ph"><div><div class="pt">👥 المدعوّون</div><div class="ps">متابعة مواعيد من دعوتهم — خصوصيتهم محفوظة</div></div>';
  if(U && +U.invite_quota - +(U.invite_used||0) > 0) h+='<button class="btn bp" onclick="oNewInv()">+ دعوة</button>';
  h+='</div>';

  // تنبيه خصوصية
  h+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-right:4px solid #3b82f6;border-radius:10px;padding:10px 12px;font-size:12px;color:#1e40af;margin-bottom:12px;line-height:1.7">'
    +'🔒 محادثات المدعوّين مع الإدارة وتقاريرهم واستماراتهم سرّية — لا تظهر هنا. تتابع فقط مواعيدهم وتراسلهم مباشرة.'
    +'</div>';

  if(!list.length){
    h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:36px 16px;text-align:center;color:#94a3b8;font-size:13px">'
      +'<div style="font-size:38px;margin-bottom:8px">👥</div>'
      +'لم يسجّل أي شخص من دعواتك بعد. الدعوات المعلّقة موجودة في «📨 دعواتي».'
      +'</div>';
    $h(pageId,h);
    return;
  }

  list.forEach(function(u){
    var hasUpc = +u.apt_upcoming > 0;
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">';
    h+='<div style="width:40px;height:40px;border-radius:50%;background:'+(hasUpc?'#dbeafe':'#f1f5f9')+';color:'+(hasUpc?'#1e40af':'#475569')+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0">'+(u.name||'م').charAt(0)+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:800;font-size:14px;color:#0f172a">'+htmlEsc(u.name||'')+'</div>';
    h+='<div style="font-size:11.5px;color:var(--mid);margin-top:2px">📞 '+htmlEsc(u.phone||'')+'</div>';
    h+='<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap">';
    if(hasUpc){
      h+='<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700">📅 '+u.apt_upcoming+' موعد قادم</span>';
    } else if(+u.apt_total>0){
      h+='<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700">سجل: '+u.apt_total+' موعد</span>';
    } else {
      h+='<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700">⏳ لم يحجز بعد</span>';
    }
    h+='</div></div>';
    h+='<button class="btn bs bsm" onclick="rvGo(\'appointments\')" title="عرض مواعيد المدعو في تبويب المواعيد">📅</button>';
    h+='</div>';
  });

  $h(pageId,h);
};

// ─── محادثات المدعي — مع الإدارة وكل مدعو مستقلاً ──────────────────
window.pInviterChat = async function(){
  ld(1);
  var threads = await api('GET','threads');
  ld(0);
  if(!Array.isArray(threads)) threads = [];
  D.cvs = threads;
  // قائمة المدعوّين لإمكانية بدء محادثة معهم
  var invitees = await api('GET','my_invitees');
  if(!Array.isArray(invitees)) invitees = [];
  // أيّ مدعو ليس لديه thread مع المدعي حتى الآن
  var openIds = {};
  threads.forEach(function(t){
    if(t.other_side==='reviewer') openIds[+t.other_uid] = true;
  });
  var available = invitees.filter(function(u){ return !openIds[+u.id]; });

  var h='<div class="ph"><div><div class="pt">💬 المحادثات</div><div class="ps">مع الإدارة + كل مدعوّ مستقلاً</div></div></div>';

  // بطاقة بدء محادثة جديدة مع مدعو
  if(available.length){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:12px">';
    h+='<div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:8px">بدء محادثة مع مدعو</div>';
    h+='<div style="display:flex;gap:8px">';
    h+='<select id="ic-rev" class="fr-inp" style="flex:1">';
    available.forEach(function(u){
      h+='<option value="'+u.id+'">'+htmlEsc(u.name||'')+' — '+htmlEsc(u.phone||'')+'</option>';
    });
    h+='</select>';
    h+='<button class="btn bp" onclick="invStartChat()">+ محادثة</button>';
    h+='</div></div>';
  }

  if(!threads.length){
    h+='<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:36px 16px;text-align:center;color:#94a3b8;font-size:13px">'
      +'<div style="font-size:38px;margin-bottom:8px">💬</div>'
      +'لا توجد محادثات بعد'
      +'</div>';
    $h('rv-pg',h); return;
  }

  // قائمة المحادثات (مع الإدارة + المدعوّين)
  h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;overflow:hidden">';
  threads.forEach(function(t,i){
    var unread = +t.unread||0;
    var nm = t.name || (t.other_side==='admin'?'الإدارة':'مدعو');
    var sideTag = t.other_side==='admin'
      ? '<span style="background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">الإدارة</span>'
      : '<span style="background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">👥 مدعو</span>';
    h+='<div data-ictid="'+t.id+'" data-icuid="'+t.other_uid+'" data-icname="'+htmlEsc(nm)+'" data-ictit="'+htmlEsc(t.title||'')+'" style="display:flex;align-items:center;gap:11px;padding:11px 13px;cursor:pointer;'+(i>0?'border-top:1px solid var(--border)':'')+'">';
    h+='<div style="width:36px;height:36px;border-radius:50%;background:'+(t.other_side==='admin'?'#f59e0b':'#22c55e')+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0">'+nm.charAt(0)+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:1px"><div style="font-weight:700;font-size:13px">'+htmlEsc(nm)+'</div>'+sideTag+'</div>';
    if(t.last_msg) h+='<div style="font-size:11px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(String(t.last_msg).slice(0,40))+'</div>';
    h+='</div>';
    if(unread) h+='<span style="background:#22c55e;color:#fff;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0">'+unread+'</span>';
    h+='</div>';
  });
  h+='</div>';

  $h('rv-pg',h);
  setTimeout(function(){
    document.querySelectorAll('[data-ictid]').forEach(function(el){
      el.addEventListener('click', function(){
        var tid = +el.dataset.ictid;
        var uid = +el.dataset.icuid;
        var nm  = el.dataset.icname||'';
        var tit = el.dataset.ictit||'';
        if(typeof rvOpenChat==='function') rvOpenChat({ id: uid, name: nm }, tid, tit);
      });
    });
  }, 30);
};

window.invStartChat = async function(){
  var rev = $g('ic-rev')?.value;
  if(!rev){ toast('اختر المدعو','er'); return; }
  ld(1);
  var r = await api('POST','threads',{ reviewer_id: +rev, title: 'محادثة المتابعة' });
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('✅ تم إنشاء المحادثة');
  pInviterChat();
};
