/* ================================================
   chat_admin.js - نظام المحادثة بالمواضيع
   ================================================ */
(function(){

/* ── CSS ── */
var s=document.createElement('style');
s.textContent=
'.wca{display:flex;flex-direction:column;height:calc(100vh - 56px);background:#e5ddd5;overflow:hidden}'+
'.wca-h{background:linear-gradient(180deg,#075e54,#0a7264);color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:58px;flex-shrink:0;position:relative;box-shadow:0 2px 6px rgba(0,0,0,.12)}'+
'.wca-av{width:40px;height:40px;border-radius:50%;background:#128c7e;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:16px;flex-shrink:0;border:2px solid rgba(255,255,255,.25)}'+
'.wca-ni{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.25}'+
'.wca-nm{font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.wca-sb{font-size:11px;color:rgba(255,255,255,.7)}'+
'.wca-btn{background:transparent;border:none;color:#fff;cursor:pointer;padding:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}'+
'.wca-btn:hover{background:rgba(255,255,255,.18)}'+
'.wca-btn:active{background:rgba(255,255,255,.28)}'+
'.wca-nbtn{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.32);color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 11px;border-radius:18px;white-space:nowrap;font-family:Cairo,sans-serif;display:inline-flex;align-items:center;gap:3px;transition:background .15s}'+
'.wca-nbtn:hover{background:rgba(255,255,255,.28)}'+
'.wca-nbtn:active{background:rgba(255,255,255,.36)}'+
'.wca-m{flex:1;overflow-y:auto;padding:6px 0}'+
'.wca-dl{text-align:center;margin:8px 0}.wca-dl span{background:rgba(255,255,255,.85);color:#54656f;font-size:11px;padding:3px 10px;border-radius:8px}'+
'.wca-out{display:flex;justify-content:flex-end;padding:1px 4px;margin-bottom:1px}'+
'.wca-in{display:flex;justify-content:flex-start;padding:1px 4px;margin-bottom:1px}'+
'.wca-bo{background:#d9f7be;border-radius:0 12px 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.12);word-break:break-word}'+
'.wca-bi{background:#fff;border-radius:12px 0 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.12);word-break:break-word}'+
'.wca-tx{font-size:14px;color:#111;line-height:1.45;white-space:pre-wrap}'+
'.wca-mt{display:flex;justify-content:flex-end;align-items:center;gap:3px;margin-top:2px}'+
'.wca-tm{font-size:10.5px;color:rgba(0,0,0,.4)}.wca-tk{font-size:12px}'+
'.wca-tk.s{color:#94a3b8}.wca-tk.r{color:#53bdeb}'+
'.wca-f{background:#f0f2f5;padding:6px 8px;display:flex;align-items:flex-end;gap:6px;flex-shrink:0;position:relative}'+
'.wca-bx{flex:1;background:#fff;border-radius:24px;display:flex;align-items:flex-end;padding:5px 12px;gap:6px;min-height:42px}'+
'.wca-ta{flex:1;border:none;outline:none;font-family:Cairo,sans-serif;font-size:14px;resize:none;background:none;max-height:100px;line-height:1.4;min-height:22px;color:#111;direction:rtl}'+
'.wca-ta::placeholder{color:#aab8c2}'+
'.wca-ic{background:none;border:none;color:#8d9db5;font-size:20px;cursor:pointer;padding:2px;line-height:1}'+
'.wca-ic:hover{color:#075e54}'+
'.wca-snd{width:46px;height:46px;border-radius:50%;background:#25d366;border:none;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(37,211,102,.4)}'+
'.wca-snd:active{transform:scale(.9)}'+
'.wca-ep{position:absolute;bottom:60px;left:8px;right:8px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.18);display:none;z-index:200}'+
'.wca-ep.on{display:block}'+
'.wca-et{display:flex;border-bottom:1px solid #f0f0f0;padding:4px 6px 0}'+
'.wca-etb{background:none;border:none;font-size:18px;cursor:pointer;padding:5px 9px;border-bottom:2px solid transparent;opacity:.6}'+
'.wca-etb.on{border-color:#25d366;opacity:1}'+
'.wca-eg{display:flex;flex-wrap:wrap;padding:8px 6px;gap:2px;max-height:160px;overflow-y:auto}'+
'.wca-em{font-size:22px;cursor:pointer;padding:4px;border-radius:6px;user-select:none}'+
'.wca-em:hover{background:#f0f0f0}'+
'.wca-tr{position:absolute;top:54px;right:8px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);z-index:300;min-width:180px;display:none;overflow:hidden}'+
'.wca-tr.on{display:block}'+
'.wca-tri{padding:11px 14px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:8px}'+
'.wca-tri:last-child{border:none}.wca-tri:hover{background:#f9f9f9}'+
'.wca-tav{width:26px;height:26px;border-radius:50%;background:#075e54;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}'+
'.wca-ld{display:flex;justify-content:center;gap:6px;padding:32px}'+
'.wca-ld i{width:9px;height:9px;border-radius:50%;background:#25d366;display:inline-block;animation:wca-b .7s infinite alternate}'+
'.wca-ld i:nth-child(2){animation-delay:.15s}.wca-ld i:nth-child(3){animation-delay:.3s}'+
'@keyframes wca-b{0%{opacity:.3;transform:translateY(0)}100%{opacity:1;transform:translateY(-5px)}}'+
'.wca-topic{font-size:11.5px;color:rgba(255,255,255,.78);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;max-width:100%}'+
// شريط الإجراءات + قائمة منسدلة احترافية
'.wca-menu{position:absolute;top:calc(100% + 4px);left:8px;background:#fff;border-radius:11px;box-shadow:0 8px 24px rgba(0,0,0,.18);min-width:175px;display:none;overflow:hidden;z-index:400}'+
'.wca-menu.on{display:block}'+
'.wca-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;background:none;border:none;border-bottom:1px solid #f1f5f9;font-family:Cairo,sans-serif;font-size:13.5px;color:#1e293b;cursor:pointer;text-align:right}'+
'.wca-menu-item:last-child{border-bottom:none}'+
'.wca-menu-item:hover{background:#f8fafc}';
document.head.appendChild(s);

/* ── Emoji ── */
var EM=[
  ['😀','😂','🤣','😊','🙂','😉','😍','😎','🤩','😏','😒','😢','😭','😤','😠','🤔'],
  ['👍','👎','👌','✌️','🤞','👋','🙌','🙏','💪','🫶','👏','🤝'],
  ['❤️','🧡','💛','💚','💙','💜','💔','🔥','⭐','✨','🎉','🏆','💯','✅','❌'],
  ['😴','🤒','🥴','🤢','😵','🥱','🤫','😐','🙄','😯']
];

/* ── State ── */
var A={uid:0,tid:0,msgs:[],ids:null,last:0,tmr:null,name:''};

function aStop(){A._stop=true;if(A.tmr){clearTimeout(A.tmr);clearInterval(A.tmr);A.tmr=null;}}
function aSchedule(){
  if(A._stop) return;
  if(document.hidden) return;
  if(!document.getElementById('wca-m')){ aStop(); return; }
  // فاصل قصير بين دورات long-poll — السيرفر هو من ينتظر الرسالة الجديدة
  A.tmr=setTimeout(function(){
    if(A._stop||!document.getElementById('wca-m')){ aStop(); return; }
    aLoad(false).then(aSchedule);
  }, 100);
}

window.aBurst=function(){};
// expose so inline onclick handlers can reach it (the file is wrapped in an IIFE)
window.aStop=aStop;
window.aBack=function(){ try{aStop();}catch(e){} try{gT('home');}catch(e){} };

window.aToggleMenu=function(){
  var m=document.getElementById('wca-menu');
  if(!m)return;
  var willShow=!m.classList.contains('on');
  m.classList.toggle('on');
  if(willShow){
    // إغلاق عند الضغط خارج القائمة
    setTimeout(function(){
      function close(e){
        if(e.target.closest('#wca-menu')||e.target.closest('#wca-menu-btn'))return;
        m.classList.remove('on');
        document.removeEventListener('click',close);
      }
      document.addEventListener('click',close);
    },10);
  }
};

function aStart(uid,tid){
  aStop();
  A.uid=+uid;A.tid=+tid;A.msgs=[];A.ids=null;A.last=0;A.opt=0;
  A._stop=false;
  aLoad(true).then(aSchedule);
  if(!A._visBound){
    A._visBound=true;
    document.addEventListener('visibilitychange', function(){
      if(document.hidden){ aStop(); }
      else if(A.tid && document.getElementById('wca-m')){
        A._stop=false; aLoad(false).then(aSchedule);
      }
    });
  }
}

async function aLoad(init){
  var box=document.getElementById('wca-m');
  if(!box)return;
  // long_poll=1: السيرفر يحتفظ بالاتصال حتى تصل رسالة جديدة (مثل واتساب)
  var url='threads/'+A.tid+((!init&&A.last>0)?'?long_poll=1&after='+A.last:'');
  var r=await api('GET',url);
  var list=Array.isArray(r)?r:(r&&r.messages?r.messages:[]);

  // ✓✓ في الوقت الفعلي — حدّث علامات القراءة على رسائلي السابقة (sender side)
  var readUpTo = (r && typeof r.read_up_to === 'number') ? r.read_up_to : 0;
  var receiptsChanged = false;
  if(readUpTo > 0 && A.msgs && A.msgs.length){
    var myIdA = +(U && U.id) || 0;
    A.msgs.forEach(function(m){
      var mid = +m.id;
      if(+m.from_id === myIdA && Number.isFinite(mid) && mid <= readUpTo && +m.is_read !== 1){
        m.is_read = 1; receiptsChanged = true;
      }
    });
  }

  if(!list.length){
    if(init) box.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:#aab8c2;font-family:Cairo,sans-serif;font-size:13px"><span style="font-size:48px">💬</span><span>لا رسائل بعد</span></div>';
    else if(receiptsChanged){ box.innerHTML=aRender(A.msgs); wcaAddLongPress(box); }
    return;
  }
  list.forEach(function(m){if(+m.id>A.last)A.last=+m.id;});
  // حدّث شارة الإشعارات فوراً عند استلام رسائل جديدة
  if(typeof window._checkUnread==='function') window._checkUnread();
  if(init){
    A.msgs=list;A.ids=new Set(list.map(function(m){return +m.id;}));
    box.innerHTML=aRender(list);box.scrollTop=box.scrollHeight;wcaAddLongPress(box);
    return;
  }
  if(!A.ids)A.ids=new Set(A.msgs.filter(function(m){return !m._pending;}).map(function(m){return +m.id;}));
  var nw=list.filter(function(m){return !A.ids.has(+m.id);});
  if(!nw.length){
    if(receiptsChanged){ box.innerHTML=aRender(A.msgs); wcaAddLongPress(box); }
    return;
  }
  // إذا الرسائل الجديدة فيها رسائل منّا، احذف الرسائل المؤقتة المطابقة
  var myId=+(U&&U.id)||0;
  var newFromMe=nw.filter(function(m){return +m.from_id===myId;});
  if(newFromMe.length){
    A.msgs=A.msgs.filter(function(m){return !m._pending;});
    A.ids=new Set(A.msgs.map(function(m){return +m.id;}));
    nw.forEach(function(m){A.msgs.push(m);A.ids.add(+m.id);});
    box.innerHTML=aRender(A.msgs);
    wcaAddLongPress(box);
    box.scrollTop=box.scrollHeight;
    return;
  }
  if(receiptsChanged){
    nw.forEach(function(m){A.msgs.push(m);A.ids.add(+m.id);});
    var bot1=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
    box.innerHTML=aRender(A.msgs); wcaAddLongPress(box);
    if(bot1) box.scrollTop=box.scrollHeight;
    return;
  }
  var bot=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
  var fr=document.createDocumentFragment();
  nw.forEach(function(m){A.msgs.push(m);A.ids.add(+m.id);var el=document.createElement('div');el.innerHTML=aMsg(m);while(el.firstChild)fr.appendChild(el.firstChild);});
  box.appendChild(fr);if(bot)box.scrollTop=box.scrollHeight;
}

function aRender(list){
  var h='',td=new Date().toISOString().slice(0,10),ld='';
  list.forEach(function(m){
    var d=(m.created_at||'').slice(0,10);
    if(d&&d!==ld){h+='<div class="wca-dl"><span>'+(d===td?'اليوم':d)+'</span></div>';ld=d;}
    h+=aMsg(m);
  });
  return h;
}

function aMsg(m){
  var myId=+(U&&U.id)||0;
  var mine=+m.from_id===+myId;
  var bd=htmlEsc(m.body||''),t=(m.created_at||'').slice(11,16),rd=+m.is_read===1;
  var tk='s',ti='✓';
  if(m._failed){tk='x';ti='✕';}
  else if(m._pending){tk='s';ti='🕓';}
  else if(rd){tk='r';ti='✓✓';}
  // رسالة موقع — بطاقة خاصة
  if(m.file_type==='location' && m.file_url){
    var safeUrl=String(m.file_url).replace(/"/g,'&quot;');
    var card='<div style="background:#fff;border-radius:12px;padding:9px;min-width:200px;max-width:260px;border:1px solid rgba(0,0,0,.08)">'
      +'<div style="background:linear-gradient(135deg,#fee2e2,#fef3c7);border-radius:9px;height:90px;display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:7px">📍</div>'
      +'<div style="font-weight:800;font-size:13px;color:#111;margin-bottom:3px">'+bd+'</div>'
      +'<div style="font-size:11px;color:#64748b;margin-bottom:8px">موقع المكان</div>'
      +'<a href="'+safeUrl+'" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:6px;background:#dc2626;color:#fff;border-radius:8px;padding:8px 12px;text-decoration:none;font-size:12.5px;font-weight:800">'
      +'<span>🗺️</span><span>فتح في الخرائط</span></a>'
      +'</div>';
    if(mine) return '<div class="wca-out" data-mid="'+m.id+'">'+card+'<div class="wca-mt" style="margin-top:-18px;margin-left:8px"><span class="wca-tm">'+t+'</span><span class="wca-tk '+tk+'">'+ti+'</span></div></div>';
    return '<div class="wca-in" data-mid="'+m.id+'">'+card+'<div class="wca-mt" style="margin-top:-18px;margin-right:8px"><span class="wca-tm">'+t+'</span></div></div>';
  }
  if(mine)
    return '<div class="wca-out" data-mid="'+m.id+'"><div class="wca-bo"><div class="wca-tx">'+bd+'</div>'
      +'<div class="wca-mt"><span class="wca-tm">'+t+'</span>'
      +'<span class="wca-tk '+tk+'">'+ti+'</span></div></div></div>';
  return '<div class="wca-in" data-mid="'+m.id+'"><div class="wca-bi"><div class="wca-tx">'+bd+'</div>'
    +'<div class="wca-mt"><span class="wca-tm">'+t+'</span></div></div></div>';
}

/* ── Delete Message ── */
window.aDelMsg=function(mid){
  oConfirm('حذف هذه الرسالة؟',function(){
    api('DELETE','messages/'+mid).then(function(){
      // إزالة من القائمة المحلية وإعادة رسم
      A.msgs=A.msgs.filter(function(m){return +m.id!==+mid;});
      var box=document.getElementById('wca-m');
      if(box)box.innerHTML=aRender(A.msgs);
    });
  },{icon:'🗑️',yes:'حذف',no:'إلغاء',danger:true});
};


/* ── Long Press to Delete ── */
var _wca_lp=null;
function wcaAddLongPress(box){
  if(!box)return;
  box.addEventListener('pointerdown',function(e){
    var row=e.target.closest('[data-mid]');
    if(!row)return;
    _wca_lp=setTimeout(function(){
      var mid=+row.dataset.mid;
      if(!mid)return;
      oConfirm('حذف هذه الرسالة؟',function(){
        api('DELETE','messages/'+mid).then(function(){
          A.msgs=A.msgs.filter(function(m){return +m.id!==mid;});
          var b=document.getElementById('wca-m');
          if(b){b.innerHTML=aRender(A.msgs);wcaAddLongPress(b);}
        });
      },{icon:'🗑️',yes:'حذف',no:'إلغاء',danger:true});
    },600);
  });
  box.addEventListener('pointerup',function(){clearTimeout(_wca_lp);});
  box.addEventListener('pointercancel',function(){clearTimeout(_wca_lp);});
  box.addEventListener('pointermove',function(){clearTimeout(_wca_lp);});
}

/* ── Send (optimistic UI) ── */
window.aSend=function(){
  var ta=document.getElementById('wca-ta');
  var msg=(ta?ta.value:'').trim();
  if(!msg||!A.uid||!A.tid)return;
  ta.value='';ta.style.height='auto';ta.focus();

  // أضف الرسالة فوراً للواجهة بهوية مؤقتة قبل ما يردّ الـ API
  A.opt=(A.opt||0)+1;
  var tempId='opt_'+Date.now()+'_'+A.opt;
  var now=new Date();
  var iso=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')
    +' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  var optMsg={id:tempId,from_id:+(U&&U.id),to_id:+A.uid,body:msg,is_read:0,created_at:iso,_pending:true};
  A.msgs.push(optMsg);
  if(!A.ids)A.ids=new Set();
  var box=document.getElementById('wca-m');
  if(box){
    var el=document.createElement('div');
    el.innerHTML=aMsg(optMsg);
    while(el.firstChild)box.appendChild(el.firstChild);
    box.scrollTop=box.scrollHeight;
  }

  // فعّل burst polling لرؤية رد المراجع بسرعة
  aBurst();

  api('POST','thread_msg',{thread_id:A.tid,to_id:A.uid,body:msg}).then(function(r){
    // إذا فشل، علّم الرسالة بعلامة خطأ
    if(r&&r.error){
      var msgs=A.msgs.filter(function(m){return m.id===tempId;});
      if(msgs.length)msgs[0]._failed=true;
      var b=document.getElementById('wca-m');
      if(b){b.innerHTML=aRender(A.msgs);wcaAddLongPress(b);b.scrollTop=b.scrollHeight;}
    }
    // النجاح: aLoad في الـ tick القادم راح يجلب الرسالة الحقيقية ويستبدل المؤقتة
  }).catch(function(){});
};

/* ── محادثة جديدة ── */
window.aNewChat=function(uid,name){
  var label=(D.cfg&&D.cfg.thread_label)||'موضوع المحادثة';
  var prev=document.getElementById('wca-modal');if(prev)prev.remove();
  var ov=document.createElement('div');
  ov.id='wca-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:20px 20px 0 0;padding:16px 16px 24px;width:90%;max-width:360px;font-family:Cairo,sans-serif';
  box.innerHTML=
    '<div style="width:36px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 14px"></div>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<div style="width:36px;height:36px;background:#075e54;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">💬</div>'
    +'<div><div style="font-weight:800;font-size:14px;color:#1e293b">محادثة جديدة</div>'
    +'<div style="font-size:12px;color:#64748b">'+htmlEsc(name)+'</div></div>'
    +'</div>'
    +'<div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:6px">'+htmlEsc(label)+'</div>'
    +'<input id="wca-ti" type="text" placeholder="مثال: متابعة الطلب..." '
    +'style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;outline:none;box-sizing:border-box;background:#f8faff;direction:rtl">'
    +'<div style="display:flex;gap:10px;margin-top:10px">'
    +'<button id="wca-sb" style="flex:1;padding:10px;background:#075e54;color:#fff;border:none;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer">▶ ابدأ</button>'
    +'<button id="wca-cb" style="padding:10px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;cursor:pointer">إلغاء</button>'
    +'</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  var inp=document.getElementById('wca-ti');
  var btn=document.getElementById('wca-sb');
  var cnl=document.getElementById('wca-cb');
  if(cnl)cnl.onclick=function(){ov.remove();};
  if(inp){inp.focus();inp.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();btn&&btn.click();}}}
  if(btn)btn.onclick=function(){
    var title=(inp?inp.value:'').trim();
    ov.remove();
    if(!title){toast('أدخل عنوان الموضوع','er');return;}
    if(A.tid){api('PUT','threads/archive',{thread_id:A.tid}).then(function(){aCreateThread(uid,name,title);});}
    else aCreateThread(uid,name,title);
  };
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
};

async function aCreateThread(uid,name,title){
  ld(1);
  var r=await api('POST','threads',{reviewer_id:+uid,title:title});
  ld(0);
  if(r&&r.ok){
    toast('✅ '+title);
    A.tid=+r.id;A.name=name;
    // تحديث عنوان الموضوع في الهيدر
    var sub=document.getElementById('wca-topic');
    if(sub)sub.textContent=title;
    aStart(+uid,+r.id);
  } else {
    toast((r&&r.error)||'فشل','er');
  }
}

/* ── أرشفة ── */
window.archiveChat=function(uid,tid){
  oConfirm('أرشفة هذا الموضوع؟\nيمكن الاطلاع عليه من قسم الأرشيف.',async function(){
    ld(1);
    var r=await api('PUT','threads/archive',{thread_id:tid||A.tid});
    ld(0);
    if(r&&r.ok){
      toast('✅ تم الأرشفة');aStop();
      if(typeof lCvs==='function')await lCvs();
      pCht();
    } else toast((r&&r.error)||'فشل','er');
  },{icon:'🗄️',yes:'أرشفة',no:'إلغاء',danger:true});
};

/* ── تحويل المحادثة ── */
window.showTransferMenu=function(uid){
  var tid=A&&A.tid;
  if(!tid){toast('افتح محادثة أولاً','er');return;}
  var otherAdmins=(D.rev||[]).filter(function(u){return u.role==='admin'&&u.id!==(U&&U.id);});
  if(!otherAdmins.length){toast('لا يوجد مدراء آخرون','er');return;}
  var rv=(D.cvs||[]).find(function(x){return x.id==uid;});
  var rvName=rv?rv.name:'المراجع';
  var h='<div style="font-size:13px;color:var(--mid);margin-bottom:12px">تحويل محادثة <b>'+htmlEsc(rvName)+'</b> إلى:</div>';
  otherAdmins.forEach(function(adm){
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8faff;border:1.5px solid var(--border);border-radius:11px;margin-bottom:8px;cursor:pointer" data-transfer-to="'+adm.id+'" data-transfer-tid="'+tid+'" data-adm-name="'+htmlEsc(adm.name||'')+'">';
    h+='<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex-shrink:0">'+(adm.name||'م').charAt(0)+'</div>';
    h+='<div><div style="font-weight:700;font-size:14px">'+htmlEsc(adm.name||'')+'</div>';
    if(adm.username) h+='<div style="font-size:12px;color:var(--mid)">@'+adm.username+'</div>';
    h+='</div>';
    h+='<span style="margin-right:auto;font-size:13px;color:var(--blue)">تحويل ←</span>';
    h+='</div>';
  });
  h+='<button class="btn bs" style="width:100%;margin-top:8px" onclick="cM()">إلغاء</button>';
  oM('↪ تحويل المحادثة', h);
  setTimeout(function(){
    document.querySelectorAll('[data-transfer-to]').forEach(function(el){
      el.addEventListener('click',function(){
        confirmTransfer(+el.dataset.transferTid, +el.dataset.transferTo, el.dataset.admName);
      });
    });
  },50);
};

window.confirmTransfer=async function(threadId, newAdminId, admName){
  cM();
  ld(1);
  var r=await api('POST','threads/transfer',{thread_id:threadId,new_admin_id:newAdminId});
  ld(0);
  if(r&&r.ok){
    toast('✅ تم تحويل المحادثة إلى '+admName);
    aStop();
    if(typeof lCvs==='function')await lCvs();
    pCht();
  } else toast((r&&r.error)||'فشل التحويل','er');
};

/* ── Emoji ── */
window.aEp=function(){var e=document.getElementById('wca-ep');if(e)e.classList.toggle('on');};
window.aEpT=function(i){
  document.querySelectorAll('.wca-etb').forEach(function(b,j){b.classList.toggle('on',j===i);});
  var g=document.getElementById('wca-eg');
  if(g)g.innerHTML=(EM[i]||[]).map(function(e){return '<span class="wca-em" onclick="aEpA(\''+e+'\')">'+e+'</span>';}).join('');
};
window.aEpA=function(em){
  var ta=document.getElementById('wca-ta');if(!ta)return;
  var s=ta.selectionStart||ta.value.length;
  ta.value=ta.value.slice(0,s)+em+ta.value.slice(s);
  ta.focus();ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,100)+'px';
  var ep=document.getElementById('wca-ep');if(ep)ep.classList.remove('on');
};

/* ── Transfer ── */
window.aTr=function(){var m=document.getElementById('wca-tr');if(m)m.classList.toggle('on');};

/* ── Footer ── */
function aFtr(uid){
  var canLocation = (typeof hasAdminPerm !== 'function') || hasAdminPerm('location');
  var hasLocation = !!(D.cfg && D.cfg.location_url);
  var locBtn = (canLocation && hasLocation)
    ? '<button class="wca-ic" onclick="aSendLocation()" title="إرسال الموقع" style="color:#dc2626">📍</button>'
    : '';
  return '<div class="wca-f">'
    +'<div class="wca-bx">'
    +'<button class="wca-ic" onclick="aEp()">😊</button>'
    + locBtn
    +'<textarea class="wca-ta" id="wca-ta" placeholder="اكتب رسالة..." rows="1"'
    +' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'"'
    +' onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();aSend();}"></textarea>'
    +'</div>'
    +'<button class="wca-snd" onclick="aSend()">&#9658;</button>'
    +'<div class="wca-ep" id="wca-ep">'
    +'<div class="wca-et">'+['😊','👍','❤️','😴'].map(function(ic,i){
      return '<button class="wca-etb'+(i===0?' on':'')+'" onclick="aEpT('+i+')">'+ic+'</button>';
    }).join('')+'</div>'
    +'<div class="wca-eg" id="wca-eg">'+(EM[0]||[]).map(function(e){
      return '<span class="wca-em" onclick="aEpA(\''+e+'\')">'+e+'</span>';
    }).join('')+'</div>'
    +'</div></div>';
}

/* ── oCht: render shell instantly, fetch in parallel ── */
function _wcaShell(uid, name, topicTitle, tid, adms, loadingMsgs){
  var h='<div class="wca"><div class="wca-h">';
  // زر الرجوع
  h+='<button class="wca-btn" onclick="aBack()" title="رجوع" aria-label="رجوع">'
    +'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    +'</button>';
  h+='<div class="wca-av">'+name.charAt(0)+'</div>';
  h+='<div class="wca-ni">'
    +'<div class="wca-nm">'+htmlEsc(name)+'</div>'
    +'<div id="wca-topic" class="wca-topic">'+htmlEsc(topicTitle||'لا يوجد موضوع')+'</div>'
    +'</div>';
  h+='<button class="wca-nbtn" onclick="aNewChat('+uid+',\''+name.replace(/'/g,'')+'\')" title="محادثة جديدة">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> جديدة'
    +'</button>';
  h+='<button class="wca-btn" id="wca-menu-btn" onclick="aToggleMenu()" title="المزيد" aria-label="المزيد">'
    +'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
    +'</button>';
  h+='<div id="wca-menu" class="wca-menu">';
  if(adms.length){
    h+='<button class="wca-menu-item" onclick="aToggleMenu();showTransferMenu('+uid+')">'
      +'<span style="font-size:16px">↪️</span><span>تحويل المحادثة</span></button>';
  }
  h+='<button class="wca-menu-item" onclick="aToggleMenu();archiveChat('+uid+','+tid+')">'
    +'<span style="font-size:16px">🗄️</span><span>أرشفة</span></button>';
  h+='</div></div>';
  // body
  if(loadingMsgs){
    h+='<div class="wca-m" id="wca-m"><div class="wca-ld"><i></i><i></i><i></i></div></div>';
  } else {
    h+='<div class="wca-m" id="wca-m"></div>';
  }
  h+=aFtr(uid);
  h+='</div>';
  return h;
}

window.oCht=async function(uid){
  window.D=window.D||{};D.cc=uid;
  var cv=(D.cvs||[]).find(function(x){return x.id==uid;});
  var name=(cv&&cv.name)||'مراجع';
  var adms=(D.rev||[]).filter(function(u){return u.role==='admin'&&+u.id!==+(U&&U.id);});

  A.uid=+uid;A.tid=0;A.name=name;

  // ⚡ 1) ارسم الواجهة الكاملة فوراً — لا spinner عام
  $h('pg', _wcaShell(uid, name, 'جارٍ التحميل…', 0, adms, true));
  setTimeout(function(){
    var ta=document.getElementById('wca-ta');if(ta)ta.focus();
  },50);

  // ⚡ 2) ابدأ جلب المواضيع بالتوازي مع عرض الواجهة
  var threads;
  try { threads = await api('GET','threads'); } catch(e) { threads = []; }
  var activThread=(Array.isArray(threads)?threads:[]).find(function(t){return +t.reviewer_id===+uid;});
  var tid=activThread?+activThread.id:0;
  var topicTitle=activThread?activThread.title:'';

  // 3) لا يوجد thread — اطلب من المدير عنواناً
  if(!tid){
    var label=(D.cfg&&D.cfg.thread_label)||'موضوع المحادثة';
    var title = (typeof oPrompt==='function')
      ? await oPrompt('💬 محادثة جديدة مع '+name, { label:label+':', placeholder:'مثال: استفسار عن الموعد...', icon:'💬', ok:'ابدأ' })
      : prompt(label+' مع '+name+':');
    if(!title || !title.trim()){ try{gT('home');}catch(e){} return; }
    ld(1);
    var nr=await api('POST','threads',{reviewer_id:+uid,title:title.trim()});
    ld(0);
    if(!nr||!nr.ok){ toast('فشل إنشاء المحادثة','er'); try{gT('home');}catch(e){} return; }
    tid=+nr.id; topicTitle=title.trim();
  }

  A.tid=tid;

  // 4) حدّث العنوان والقائمة (دون إعادة رسم كامل) ثم ابدأ polling
  var topicEl=document.getElementById('wca-topic');
  if(topicEl) topicEl.textContent = topicTitle || 'لا يوجد موضوع';
  // أعد ربط زر الأرشفة بـ tid الجديد
  var menu=document.getElementById('wca-menu');
  if(menu){
    var btns=menu.querySelectorAll('.wca-menu-item');
    btns.forEach(function(b){
      var oc=b.getAttribute('onclick')||'';
      if(oc.indexOf('archiveChat')>=0){
        b.setAttribute('onclick','aToggleMenu();archiveChat('+uid+','+tid+')');
      }
    });
  }

  aStart(+uid,tid);
};

/* ── إرسال الموقع ── */
window.aSendLocation = function(){
  if (typeof hasAdminPerm === 'function' && !hasAdminPerm('location')){
    toast('لا تملك صلاحية إرسال الموقع','er'); return;
  }
  var url = D.cfg && D.cfg.location_url;
  var label = (D.cfg && D.cfg.location_label) || 'الموقع';
  if (!url){
    toast('احفظ رابط الموقع من الإعدادات أوّلاً','er'); return;
  }
  if (!A.tid || !A.uid){ toast('المحادثة غير جاهزة','er'); return; }

  oConfirm('إرسال الموقع «' + label + '» للمراجع؟', function(){
    api('POST', 'thread_msg', {
      thread_id: A.tid, to_id: A.uid,
      body: label,
      file_url: url,
      file_type: 'location',
    }).then(function(r){
      if (r && r.error){ toast(r.error, 'er'); return; }
      toast('📍 تم إرسال الموقع');
      // burst polling لرؤية الرسالة في القائمة
      if (typeof aBurst === 'function') aBurst();
    });
  }, { icon: '📍', yes: 'إرسال', no: 'إلغاء' });
};

/* ── Upload ── */
window.aUp=function(){
  var fi=document.getElementById('wca-fi');
  var file=fi&&fi.files[0];if(!file)return;fi.value='';
  if(file.size>20*1024*1024){toast('الحد 20MB','er');return;}
  toast('جاري الرفع...');
  var fd=new FormData();fd.append('file',file);
  fetch('./upload_file.php',{method:'POST',headers:{'Authorization':'Bearer '+(localStorage.getItem('tk')||'')},body:fd})
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.ok){toast(d.error||'فشل','er');return;}
      toast('تم ✅');
      api('POST','thread_msg',{thread_id:A.tid,to_id:A.uid,body:d.type==='image'?'📷 صورة':'📄 '+d.filename,file_url:d.url,file_type:d.type});
    }).catch(function(){toast('خطأ','er');});
};

})();
