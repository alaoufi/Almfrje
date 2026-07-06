/* chat_reviewer.js */
(function(){

var s=document.createElement('style');
s.textContent=
'.wcr{display:flex;flex-direction:column;height:100%;background:#e5ddd5;overflow:hidden}'+
'.wcr-h{background:linear-gradient(180deg,#075e54,#0a7264);color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:58px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.12)}'+
'.wcr-av{width:40px;height:40px;border-radius:50%;background:#128c7e;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:16px;flex-shrink:0;border:2px solid rgba(255,255,255,.25)}'+
'.wcr-ni{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.25}'+
'.wcr-nm{font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.wcr-sb{font-size:11px;color:rgba(255,255,255,.7)}'+
'.wcr-btn{background:transparent;border:none;color:#fff;cursor:pointer;padding:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}'+
'.wcr-btn:hover{background:rgba(255,255,255,.18)}'+
'.wcr-btn:active{background:rgba(255,255,255,.28)}'+
'.wcr-nbtn{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.32);color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 11px;border-radius:18px;white-space:nowrap;font-family:Cairo,sans-serif;display:inline-flex;align-items:center;gap:3px;transition:background .15s}'+
'.wcr-nbtn:hover{background:rgba(255,255,255,.28)}'+
'.wcr-nbtn:active{background:rgba(255,255,255,.36)}'+
'.wcr-m{flex:1;overflow-y:auto;padding:6px 0;min-height:0}'+
'.wcr-dl{text-align:center;margin:8px 0}.wcr-dl span{background:rgba(255,255,255,.85);color:#54656f;font-size:11px;padding:3px 10px;border-radius:8px}'+
'.wcr-out{display:flex;justify-content:flex-end;padding:1px 4px;margin-bottom:1px}'+
'.wcr-in{display:flex;justify-content:flex-start;padding:1px 4px;margin-bottom:1px}'+
'.wcr-bo{background:#d9f7be;border-radius:0 12px 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.12);word-break:break-word}'+
'.wcr-bi{background:#fff;border-radius:12px 0 12px 12px;padding:6px 10px 4px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.12);word-break:break-word}'+
'.wcr-sn{font-size:11px;font-weight:700;color:#075e54;margin-bottom:2px}'+
'.wcr-tx{font-size:14px;color:#111;line-height:1.45;white-space:pre-wrap}'+
'.wcr-mt{display:flex;justify-content:flex-end;align-items:center;gap:3px;margin-top:2px}'+
'.wcr-tm{font-size:10.5px;color:rgba(0,0,0,.4)}.wcr-tk{font-size:12px}'+
'.wcr-tk.s{color:#94a3b8}.wcr-tk.r{color:#53bdeb}'+
'.wcr-f{background:#f0f2f5;padding:6px 8px;display:flex;align-items:flex-end;gap:6px;flex-shrink:0}'+
'.wcr-bx{flex:1;background:#fff;border-radius:24px;display:flex;align-items:flex-end;padding:5px 12px;gap:6px;min-height:42px}'+
'.wcr-ta{flex:1;border:none;outline:none;font-family:Cairo,sans-serif;font-size:14px;resize:none;background:none;max-height:100px;line-height:1.4;min-height:22px;color:#111;direction:rtl}'+
'.wcr-ta::placeholder{color:#aab8c2}'+
'.wcr-ic{background:none;border:none;color:#8d9db5;font-size:20px;cursor:pointer;padding:2px;line-height:1}'+
'.wcr-snd{width:46px;height:46px;border-radius:50%;background:#25d366;border:none;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(37,211,102,.4)}'+
'.wcr-ep{position:absolute;bottom:58px;left:8px;right:8px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.18);display:none;z-index:200}'+
'.wcr-ep.on{display:block}'+
'.wcr-et{display:flex;border-bottom:1px solid #f0f0f0;padding:4px 6px 0}'+
'.wcr-etb{background:none;border:none;font-size:18px;cursor:pointer;padding:5px 9px;border-bottom:2px solid transparent;opacity:.6}'+
'.wcr-etb.on{border-color:#25d366;opacity:1}'+
'.wcr-eg{display:flex;flex-wrap:wrap;padding:8px 6px;gap:2px;max-height:160px;overflow-y:auto}'+
'.wcr-em{font-size:22px;cursor:pointer;padding:4px;border-radius:6px;user-select:none}'+
'.wcr-topic{font-size:11.5px;color:rgba(255,255,255,.78);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;max-width:100%}'+
'.wcr-ld{display:flex;justify-content:center;gap:6px;padding:32px}'+
'.wcr-ld i{width:9px;height:9px;border-radius:50%;background:#25d366;display:inline-block;animation:wcr-b .7s infinite alternate}'+
'.wcr-ld i:nth-child(2){animation-delay:.15s}.wcr-ld i:nth-child(3){animation-delay:.3s}'+
'@keyframes wcr-b{0%{opacity:.3}100%{opacity:1;transform:translateY(-5px)}}';
document.head.appendChild(s);

var EM=[
  ['😀','😂','🤣','😊','🙂','😉','😍','😎','🤩','😏','😒','😢','😭','😤','😠','🤔'],
  ['👍','👎','👌','✌️','🤞','👋','🙌','🙏','💪','🫶','👏','🤝'],
  ['❤️','🧡','💛','💚','💙','💜','💔','🔥','⭐','✨','🎉','🏆','💯','✅','❌'],
  ['😴','🤒','🥴','🤢','😵','🥱','🤫','😐','🙄','😯']
];

var R={uid:0,tid:0,msgs:[],ids:null,last:0,tmr:null,opt:0};

function rStop(){R._stop=true;if(R.tmr){clearTimeout(R.tmr);clearInterval(R.tmr);R.tmr=null;}}

function rStart(admUid,tid){
  rStop();
  R.uid=+admUid;R.tid=+tid;R.msgs=[];R.ids=null;R.last=0;R.opt=0;
  R._stop=false;
  rLoad(true).then(rSchedule);
  // أوقف polling لو التبويب مخفي، استأنفه فور رجوع المستخدم
  if(!R._visBound){
    R._visBound=true;
    document.addEventListener('visibilitychange', function(){
      if(document.hidden){ rStop(); }
      else if(R.tid && document.getElementById('wcr-m')){
        R._stop=false; rLoad(false).then(rSchedule);
      }
    });
  }
}

function rSchedule(){
  if(R._stop) return;
  if(document.hidden) return;
  if(!document.getElementById('wcr-m')){ rStop(); return; }
  // مع long polling، الاتصال يحتفظ نفسه حتى ٨ ثوان أو يردّ فور وصول رسالة.
  // فاصل 100ms بين الدورات يكفي — السيرفر هو من ينتظر، ليس الواجهة.
  R.tmr=setTimeout(function(){
    if(R._stop||!document.getElementById('wcr-m')){ rStop(); return; }
    rLoad(false).then(rSchedule);
  }, 100);
}

// متروكة للتوافق — لم تعد ضرورية مع long polling
window.rBurst=function(){};

async function rLoad(init){
  var box=document.getElementById('wcr-m');if(!box)return;
  // long_poll=1: السيرفر يحتفظ بالاتصال حتى تصل رسالة جديدة (مثل واتساب)
  var url='threads/'+R.tid+((!init&&R.last>0)?'?long_poll=1&after='+R.last:'');
  var r=await api('GET',url);
  var list=Array.isArray(r)?r:(r&&r.messages?r.messages:[]);

  // ✓✓ في الوقت الفعلي — حدّث علامات القراءة على رسائلي السابقة (sender side)
  var readUpTo = (r && typeof r.read_up_to === 'number') ? r.read_up_to : 0;
  var receiptsChanged = false;
  if(readUpTo > 0 && R.msgs && R.msgs.length){
    var myIdR = +(U && U.id) || 0;
    R.msgs.forEach(function(m){
      var mid = +m.id;
      if(+m.from_id === myIdR && Number.isFinite(mid) && mid <= readUpTo && +m.is_read !== 1){
        m.is_read = 1; receiptsChanged = true;
      }
    });
  }

  if(!list.length){
    if(init) box.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:#aab8c2;font-size:13px"><span style="font-size:48px">💬</span><span>لا رسائل بعد</span></div>';
    else if(receiptsChanged) box.innerHTML = rRender(R.msgs);
    return;
  }
  list.forEach(function(m){if(+m.id>R.last)R.last=+m.id;});
  // حدّث شارة الإشعارات فوراً عند استلام رسائل جديدة (السيرفر علّمها مقروءة)
  if(typeof window._checkUnread==='function') window._checkUnread();
  if(init){
    R.msgs=list;R.ids=new Set(list.map(function(m){return +m.id;}));
    box.innerHTML=rRender(list);box.scrollTop=box.scrollHeight;
    return;
  }
  if(!R.ids)R.ids=new Set(R.msgs.filter(function(m){return !m._pending;}).map(function(m){return +m.id;}));
  var nw=list.filter(function(m){return !R.ids.has(+m.id);});
  if(!nw.length){
    if(receiptsChanged) box.innerHTML = rRender(R.msgs);
    return;
  }
  var myId=+(U&&U.id)||0;
  var newFromMe=nw.filter(function(m){return +m.from_id===myId;});
  if(newFromMe.length){
    R.msgs=R.msgs.filter(function(m){return !m._pending;});
    R.ids=new Set(R.msgs.map(function(m){return +m.id;}));
    nw.forEach(function(m){R.msgs.push(m);R.ids.add(+m.id);});
    box.innerHTML=rRender(R.msgs);box.scrollTop=box.scrollHeight;
    return;
  }
  // لو receipts تغيّرت أيضاً، ارسم كل القائمة (لتظهر ✓✓ على رسائلي القديمة)
  if(receiptsChanged){
    nw.forEach(function(m){R.msgs.push(m);R.ids.add(+m.id);});
    var bot1=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
    box.innerHTML=rRender(R.msgs);
    if(bot1) box.scrollTop=box.scrollHeight;
    return;
  }
  var bot=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
  var fr=document.createDocumentFragment();
  nw.forEach(function(m){R.msgs.push(m);R.ids.add(+m.id);var el=document.createElement('div');el.innerHTML=rMsg(m);while(el.firstChild)fr.appendChild(el.firstChild);});
  box.appendChild(fr);if(bot)box.scrollTop=box.scrollHeight;
}

function rRender(list){
  var h='',td=new Date().toISOString().slice(0,10),ld='';
  list.forEach(function(m){
    var d=(m.created_at||'').slice(0,10);
    if(d&&d!==ld){h+='<div class="wcr-dl"><span>'+(d===td?'اليوم':d)+'</span></div>';ld=d;}
    h+=rMsg(m);
  });
  return h;
}

function rMsg(m){
  var myId=+(U&&U.id)||0;
  var mine=+m.from_id===+myId;
  var bd=htmlEsc(m.body||''),t=(m.created_at||'').slice(11,16),rd=+m.is_read===1;
  var tk='s',ti='✓';
  if(m._failed){tk='x';ti='✕';}
  else if(m._pending){tk='s';ti='🕓';}
  else if(rd){tk='r';ti='✓✓';}
  // رسالة موقع — بطاقة خاصة بزر «فتح في الخرائط»
  if(m.file_type==='location' && m.file_url){
    var safeUrl=String(m.file_url).replace(/"/g,'&quot;');
    var card='<div style="background:#fff;border-radius:12px;padding:9px;min-width:200px;max-width:260px;border:1px solid rgba(0,0,0,.08)">'
      +'<div style="background:linear-gradient(135deg,#fee2e2,#fef3c7);border-radius:9px;height:90px;display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:7px">📍</div>'
      +'<div style="font-weight:800;font-size:13px;color:#111;margin-bottom:3px">'+bd+'</div>'
      +'<div style="font-size:11px;color:#64748b;margin-bottom:8px">موقع المكان</div>'
      +'<a href="'+safeUrl+'" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:6px;background:#dc2626;color:#fff;border-radius:8px;padding:8px 12px;text-decoration:none;font-size:12.5px;font-weight:800">'
      +'<span>🗺️</span><span>فتح في الخرائط</span></a>'
      +'</div>';
    if(mine) return '<div class="wcr-out">'+card+'<div class="wcr-mt" style="margin-top:-18px;margin-left:8px"><span class="wcr-tm">'+t+'</span><span class="wcr-tk '+tk+'">'+ti+'</span></div></div>';
    return '<div class="wcr-in">'+card+'<div class="wcr-mt" style="margin-top:-18px;margin-right:8px"><span class="wcr-tm">'+t+'</span></div></div>';
  }
  if(mine)
    return '<div class="wcr-out"><div class="wcr-bo"><div class="wcr-tx">'+bd+'</div>'
      +'<div class="wcr-mt"><span class="wcr-tm">'+t+'</span>'
      +'<span class="wcr-tk '+tk+'">'+ti+'</span></div></div></div>';
  return '<div class="wcr-in"><div class="wcr-bi">'
    +'<div class="wcr-tx">'+bd+'</div>'
    +'<div class="wcr-mt"><span class="wcr-tm">'+t+'</span></div></div></div>';
}

window.rSend=function(){
  var ta=document.getElementById('wcr-ta');
  var msg=(ta?ta.value:'').trim();
  if(!msg||!R.uid||!R.tid)return;
  ta.value='';ta.style.height='auto';ta.focus();

  // optimistic UI
  R.opt=(R.opt||0)+1;
  var tempId='ropt_'+Date.now()+'_'+R.opt;
  var now=new Date();
  var iso=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')
    +' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  var optMsg={id:tempId,from_id:+(U&&U.id),to_id:+R.uid,body:msg,is_read:0,created_at:iso,_pending:true};
  R.msgs.push(optMsg);
  var box=document.getElementById('wcr-m');
  if(box){
    var el=document.createElement('div');
    el.innerHTML=rMsg(optMsg);
    while(el.firstChild)box.appendChild(el.firstChild);
    box.scrollTop=box.scrollHeight;
  }

  // فعّل burst polling لرؤية رد المدير بسرعة
  rBurst();

  api('POST','thread_msg',{thread_id:R.tid,to_id:R.uid,body:msg}).then(function(r){
    if(r&&r.error){
      var msgs=R.msgs.filter(function(m){return m.id===tempId;});
      if(msgs.length)msgs[0]._failed=true;
      var b=document.getElementById('wcr-m');
      if(b){b.innerHTML=rRender(R.msgs);b.scrollTop=b.scrollHeight;}
    }
  }).catch(function(){});
};

window.rEp=function(){var e=document.getElementById('wcr-ep');if(e)e.classList.toggle('on');};
window.rEpT=function(i){
  document.querySelectorAll('.wcr-etb').forEach(function(b,j){b.classList.toggle('on',j===i);});
  var g=document.getElementById('wcr-eg');
  if(g)g.innerHTML=(EM[i]||[]).map(function(e){return '<span class="wcr-em" onclick="rEpA(\''+e+'\')">'+e+'</span>';}).join('');
};
window.rEpA=function(em){
  var ta=document.getElementById('wcr-ta');if(!ta)return;
  var s=ta.selectionStart||ta.value.length;
  ta.value=ta.value.slice(0,s)+em+ta.value.slice(s);
  ta.focus();
  var ep=document.getElementById('wcr-ep');if(ep)ep.classList.remove('on');
};

function rFtr(){
  return '<div class="wcr-f">'
    +'<div class="wcr-bx">'
    +'<button class="wcr-ic" onclick="rEp()">😊</button>'
    +'<textarea class="wcr-ta" id="wcr-ta" placeholder="اكتب رسالة..." rows="1"'
    +' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'"'
    +' onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();rSend();}"></textarea>'
    +'</div>'
    +'<button class="wcr-snd" onclick="rSend()">&#9658;</button>'
    +'<div class="wcr-ep" id="wcr-ep">'
    +'<div class="wcr-et">'+['😊','👍','❤️','😴'].map(function(ic,i){
      return '<button class="wcr-etb'+(i===0?' on':'')+'" onclick="rEpT('+i+')">'+ic+'</button>';
    }).join('')+'</div>'
    +'<div class="wcr-eg" id="wcr-eg">'+(EM[0]||[]).map(function(e){
      return '<span class="wcr-em" onclick="rEpA(\''+e+'\')">'+e+'</span>';
    }).join('')+'</div>'
    +'</div></div>';
}

/* ── rBack: العودة للصفحة الرئيسية ── */
window.rBack=function(){
  rStop();
  // إخفاء overlay لو موجود + إعادة nav
  var ov=document.getElementById('rv-chat-overlay');
  if(ov){ov.style.display='none';ov.classList.remove('on');ov.innerHTML='';}
  var bn=document.getElementById('rev-bnav');
  if(bn){bn.removeAttribute('style');}
  // ارجع إلى الصفحة الرئيسية — لأن rvChat قد يفتح المحادثة تلقائياً (مدير واحد)
  if(typeof rvGo==='function') rvGo('home');
  else if(typeof rvChat==='function') rvChat();
};

/* ── rNewChat: محادثة جديدة ── */
window.rNewChat=function(admUid,admName){
  var label=(D.cfg&&D.cfg.thread_label)||'موضوع المحادثة';
  var prev=document.getElementById('wcr-modal');if(prev)prev.remove();
  var ov=document.createElement('div');ov.id='wcr-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:20px 20px 0 0;padding:16px 16px 24px;width:90%;max-width:360px;font-family:Cairo,sans-serif';
  box.innerHTML='<div style="width:36px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 14px"></div>'
    +'<div style="font-weight:800;font-size:14px;color:#1e293b;margin-bottom:12px">💬 محادثة جديدة مع '+htmlEsc(admName)+'</div>'
    +'<div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:6px">'+htmlEsc(label)+'</div>'
    +'<input id="wcr-ti" type="text" placeholder="مثال: استفسار عن الموعد..." style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;outline:none;box-sizing:border-box;direction:rtl">'
    +'<div style="display:flex;gap:8px;margin-top:10px">'
    +'<button id="wcr-sb" style="flex:1;padding:10px;background:#075e54;color:#fff;border:none;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer">▶ ابدأ</button>'
    +'<button id="wcr-cb" style="padding:10px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;cursor:pointer">إلغاء</button>'
    +'</div>';
  ov.appendChild(box);document.body.appendChild(ov);
  var inp=document.getElementById('wcr-ti');
  var btn=document.getElementById('wcr-sb');
  document.getElementById('wcr-cb').onclick=function(){ov.remove();};
  if(inp){inp.focus();inp.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();btn.click();}};}
  btn.onclick=function(){
    var title=(inp?inp.value:'').trim();ov.remove();
    if(!title){toast('أدخل عنوان الموضوع','er');return;}
    api('POST','threads',{admin_id:+admUid,title:title}).then(function(nr){
      if(nr&&nr.ok){
        toast('✅ '+title);
        // أعد فتح الـ overlay الكامل مع tid الجديد لتُبنى عناصر #wcr-m و #wcr-ta،
        // ثم يبدأ rStart من داخل rvOpenChat. تمرير tid مباشرة يتجاوز إعادة جلب /threads.
        rvOpenChat({id:+admUid, name:admName}, +nr.id, title);
      } else {
        toast((nr&&nr.error)||'فشل','er');
      }
    });
  };
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
};

/* ── rvOpenChat: فتح المحادثة في overlay ──
   preTid/preTitle اختياريّان — يُمرّرهما rNewChat فور إنشاء thread جديد
   لتفادي race condition عند إعادة الاستعلام عن threads قبل أن يظهر الجديد. */
window.rvOpenChat=async function(adm, preTid, preTitle){
  window._rv_adm_id=adm.id;
  var name=adm.name||'الإدارة';
  var tid=+preTid||0;
  var topicTitle=preTitle||'';

  if(!tid){
    ld(1);
    var threads=await api('GET','threads');
    ld(0);
    var actThread=(Array.isArray(threads)?threads:[]).find(function(t){return +t.admin_id===+adm.id;});
    if(actThread){ tid=+actThread.id; topicTitle=actThread.title||''; }
  }

  if(!tid){
    rNewChat(+adm.id,name);
    return;
  }

  R.uid=+adm.id;R.tid=tid;

  var h='<div class="wcr"><div class="wcr-h">';
  // زر الرجوع
  h+='<button class="wcr-btn" onclick="rBack()" title="رجوع" aria-label="رجوع">'
    +'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    +'</button>';
  // الأفاتار + الاسم + الموضوع
  h+='<div class="wcr-av">'+name.charAt(0)+'</div>';
  h+='<div class="wcr-ni">'
    +'<div class="wcr-nm">'+htmlEsc(name)+'</div>'
    +'<div id="wcr-topic" class="wcr-topic">'+htmlEsc(topicTitle||'لا يوجد موضوع')+'</div>'
    +'</div>';
  // زر محادثة جديدة
  h+='<button class="wcr-nbtn" onclick="rNewChat('+adm.id+',\''+name.replace(/'/g,'')+'\')" title="محادثة جديدة">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    +' جديدة'
    +'</button>';
  h+='</div>';
  h+='<div class="wcr-m" id="wcr-m"><div class="wcr-ld"><i></i><i></i><i></i></div></div>';
  h+=rFtr();
  h+='</div>';

  // فتح في overlay مستقل فوق كل شيء
  var ov=document.getElementById('rv-chat-overlay');
  if(ov){ov.innerHTML=h;ov.style.display='flex';ov.classList.add('on');}
  else{$h('rv-pg',h);}

  setTimeout(function(){
    var ta=document.getElementById('wcr-ta');if(ta)ta.focus();
  },100);

  rStart(+adm.id,tid);
};

})();
