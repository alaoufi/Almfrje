/* chat.js - نظام محادثة WhatsApp */
(function(){

/* ── CSS ── */
var st=document.createElement('style');
st.textContent=[
'.wc{display:flex;flex-direction:column;height:calc(100vh - 56px);background:#e5ddd5;overflow:hidden}',
'.wc-h{background:#075e54;color:#fff;display:flex;align-items:center;gap:10px;padding:8px 12px;min-height:54px;flex-shrink:0}',
'.wc-av{width:38px;height:38px;border-radius:50%;background:#128c7e;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0}',
'.wc-ni{flex:1;min-width:0}.wc-nm{font-size:15px;font-weight:600}.wc-sb{font-size:11px;color:rgba(255,255,255,.7)}',
'.wc-b{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:6px;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
'.wc-b:hover{background:rgba(255,255,255,.15)}',
'.wc-m{flex:1;overflow-y:auto;padding:6px 0}',
'.wc-dl{text-align:center;margin:8px 0}.wc-dl span{background:rgba(255,255,255,.85);color:#54656f;font-size:11px;padding:3px 10px;border-radius:8px}',
'.wc-ro{display:flex;justify-content:flex-end;padding:2px 4px 2px 52px;margin-bottom:1px}',
'.wc-ri{display:flex;justify-content:flex-start;padding:2px 52px 2px 4px;margin-bottom:1px}',
'.wc-bo{position:relative;background:#d9f7be;border-radius:4px 16px 16px 16px;padding:8px 12px 6px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.15);word-break:break-word}.wc-bo::before{content:'';position:absolute;top:0;right:-8px;border-style:solid;border-width:0 0 10px 10px;border-color:transparent transparent transparent #d9f7be}',
'.wc-bi{position:relative;background:#fff;border-radius:16px 4px 16px 16px;padding:8px 12px 6px;max-width:75%;box-shadow:0 1px 2px rgba(0,0,0,.15);word-break:break-word}.wc-bi::before{content:'';position:absolute;top:0;left:-8px;border-style:solid;border-width:0 10px 10px 0;border-color:transparent #fff transparent transparent}',
'.wc-sn{font-size:11px;font-weight:700;color:#075e54;margin-bottom:2px}',
'.wc-tx{font-size:14px;color:#111;line-height:1.45;white-space:pre-wrap}',
'.wc-mt{display:flex;justify-content:flex-end;align-items:center;gap:3px;margin-top:2px}',
'.wc-tm{font-size:10.5px;color:rgba(0,0,0,.4)}.wc-tk{font-size:12px}',
'.wc-tk.s{color:#94a3b8}.wc-tk.r{color:#53bdeb}',
'.wc-f{background:#f0f2f5;padding:6px 8px;display:flex;align-items:flex-end;gap:6px;flex-shrink:0;position:relative}',
'.wc-bx{flex:1;background:#fff;border-radius:24px;display:flex;align-items:flex-end;padding:5px 12px;gap:6px;min-height:42px}',
'.wc-ta{flex:1;border:none;outline:none;font-family:Cairo,sans-serif;font-size:14px;resize:none;background:none;max-height:100px;line-height:1.4;min-height:22px;color:#111;direction:rtl}',
'.wc-ta::placeholder{color:#aab8c2}',
'.wc-ic{background:none;border:none;color:#8d9db5;font-size:20px;cursor:pointer;padding:2px;line-height:1}',
'.wc-ic:hover{color:#075e54}',
'.wc-snd{width:46px;height:46px;border-radius:50%;background:#25d366;border:none;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(37,211,102,.4)}',
'.wc-snd:active{transform:scale(.9)}',
'.wc-ep{position:absolute;bottom:60px;left:8px;right:8px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.18);display:none;z-index:200}',
'.wc-ep.on{display:block}',
'.wc-et{display:flex;border-bottom:1px solid #f0f0f0;padding:4px 6px 0}',
'.wc-etb{background:none;border:none;font-size:18px;cursor:pointer;padding:5px 9px;border-bottom:2px solid transparent;opacity:.6}',
'.wc-etb.on{border-color:#25d366;opacity:1}',
'.wc-eg{display:flex;flex-wrap:wrap;padding:8px 6px;gap:2px;max-height:160px;overflow-y:auto}',
'.wc-em{font-size:22px;cursor:pointer;padding:4px;border-radius:6px;user-select:none}',
'.wc-em:hover{background:#f0f0f0}',
'.wc-tr{position:absolute;top:56px;right:8px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);z-index:300;min-width:180px;display:none;overflow:hidden}',
'.wc-tr.on{display:block}',
'.wc-tri{padding:11px 14px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:8px}',
'.wc-tri:last-child{border:none}.wc-tri:hover{background:#f9f9f9}',
'.wc-tav{width:26px;height:26px;border-radius:50%;background:#075e54;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}',
'.wc-ld{display:flex;justify-content:center;gap:6px;padding:32px}',
'.wc-ld i{width:9px;height:9px;border-radius:50%;background:#25d366;display:inline-block;animation:wc-b .7s infinite alternate}',
'.wc-ld i:nth-child(2){animation-delay:.15s}.wc-ld i:nth-child(3){animation-delay:.3s}',
'@keyframes wc-b{0%{opacity:.3;transform:translateY(0)}100%{opacity:1;transform:translateY(-5px)}}',
'.wc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:#aab8c2;font-family:Cairo,sans-serif;font-size:13px}'
].join('');
document.head.appendChild(st);

/* ── Emoji ── */
var EM=[
  ['😀','😂','🤣','😊','🙂','😉','😍','😎','🤩','😏','😒','😢','😭','😤','😠','🤔','😶','😬'],
  ['👍','👎','👌','✌️','🤞','👋','🙌','🙏','💪','🫶','👏','🤝'],
  ['❤️','🧡','💛','💚','💙','💜','💔','🔥','⭐','✨','🎉','🏆','💯','✅','❌','💬'],
  ['😴','🤒','🥴','🤢','😵','🥱','🤫','😐','🙄','😯']
];

/* ── State ── */
var W={uid:0,msgs:[],ids:null,last:0,tmr:null,adm:true};

/* ── API ── */
function wStop(){clearInterval(W.tmr);W.tmr=null;}

function wStart(uid,isAdm){
  wStop();
  W.uid=+uid;W.msgs=[];W.ids=null;W.last=0;W.adm=isAdm;
  wLoad(uid,true);
  W.tmr=setInterval(function(){
    if(!document.getElementById('wc-m')){wStop();return;}
    wLoad(uid,false);
  },3000);
}

async function wLoad(uid,init){
  var box=document.getElementById('wc-m');
  if(!box)return;
  var url='messages/'+uid+((!init&&W.last>0)?'?after='+W.last:'');
  var r=await api('GET',url);
  var list=Array.isArray(r)?r:(r&&r.messages?r.messages:[]);
  if(!list.length){
    if(init)box.innerHTML='<div class="wc-empty"><span style="font-size:48px">💬</span><span>لا رسائل بعد</span></div>';
    return;
  }
  list.forEach(function(m){if(+m.id>W.last)W.last=+m.id;});
  if(init){
    W.msgs=list;
    W.ids=new Set(list.map(function(m){return +m.id;}));
    box.innerHTML=wRender(list,uid);
    box.scrollTop=box.scrollHeight;
    api('PUT','messages/read?partner='+uid,{});
  } else {
    if(!W.ids)W.ids=new Set(W.msgs.map(function(m){return +m.id;}));
    var nw=list.filter(function(m){return !W.ids.has(+m.id);});
    if(!nw.length){
      if(list.some(function(m){return +m.from_id===+uid&&+m.is_read===1;}))
        box.querySelectorAll('.wc-tk.s').forEach(function(t){t.className='wc-tk r';t.textContent='✓✓';});
      return;
    }
    var bot=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
    var fr=document.createDocumentFragment();
    nw.forEach(function(m){
      W.msgs.push(m);W.ids.add(+m.id);
      var el=document.createElement('div');
      el.innerHTML=wMsg(m,+uid);
      while(el.firstChild)fr.appendChild(el.firstChild);
    });
    box.appendChild(fr);
    if(bot)box.scrollTop=box.scrollHeight;
    if(nw.some(function(m){return +m.from_id===+uid;}))
      box.querySelectorAll('.wc-tk.s').forEach(function(t){t.className='wc-tk r';t.textContent='✓✓';});
  }
}

function wRender(list,uid){
  var h='',td=new Date().toISOString().slice(0,10),ld='';
  list.forEach(function(m){
    var d=(m.created_at||'').slice(0,10);
    if(d&&d!==ld){h+='<div class="wc-dl"><span>'+(d===td?'اليوم':d)+'</span></div>';ld=d;}
    h+=wMsg(m,+uid);
  });
  return h;
}

function wMsg(m,uid){
  var mu=+(window.U&&U.id)||0;
  var mine=+m.from_id!==+uid;
  var bd=htmlEsc(m.body||''),t=(m.created_at||'').slice(11,16),rd=+m.is_read===1;
  if(mine)
    return '<div class="wc-ro"><div class="wc-bo"><div class="wc-tx">'+bd+'</div>'
      +'<div class="wc-mt"><span class="wc-tm">'+t+'</span>'
      +'<span class="wc-tk '+(rd?'r':'s')+'">'+(rd?'✓✓':'✓')+'</span></div></div></div>';
  return '<div class="wc-ri"><div class="wc-bi">'
    +(!W.adm?'<div class="wc-sn">الإدارة</div>':'')
    +'<div class="wc-tx">'+bd+'</div>'
    +'<div class="wc-mt"><span class="wc-tm">'+t+'</span></div></div></div>';
}

/* ── Send ── */
window.wcSend=function(){
  var ta=document.getElementById('wc-ta');
  var msg=(ta?ta.value:'').trim();
  if(!msg||!W.uid)return;
  ta.value='';ta.style.height='auto';
  var box=document.getElementById('wc-m');
  if(box){
    var n=new Date(),h2=n.getHours(),mi=n.getMinutes();
    var t=(h2<10?'0':'')+h2+':'+(mi<10?'0':'')+mi;
    var el=document.createElement('div');
    el.innerHTML='<div class="wc-ro"><div class="wc-bo"><div class="wc-tx">'+htmlEsc(msg)+'</div>'
      +'<div class="wc-mt"><span class="wc-tm">'+t+'</span><span class="wc-tk s">✓</span></div></div></div>';
    while(el.firstChild)box.appendChild(el.firstChild);
    box.scrollTop=box.scrollHeight;
  }
  api('POST','messages/'+W.uid,{to_id:W.uid,body:msg}).then(function(r){if(r&&r.id){if(!W.ids)W.ids=new Set();W.ids.add(+r.id);if(+r.id>W.last)W.last=+r.id;}});
  ta.focus();
};

/* ── Emoji ── */
var epTab=0;
window.wcEp=function(){var e=document.getElementById('wc-ep');if(e)e.classList.toggle('on');};
window.wcEpT=function(i){
  epTab=i;
  document.querySelectorAll('.wc-etb').forEach(function(b,j){b.classList.toggle('on',j===i);});
  var g=document.getElementById('wc-eg');
  if(g)g.innerHTML=(EM[i]||[]).map(function(e){return '<span class="wc-em" onclick="wcEpA(\''+e+'\')">'+e+'</span>';}).join('');
};
window.wcEpA=function(em){
  var ta=document.getElementById('wc-ta');if(!ta)return;
  var s=ta.selectionStart||ta.value.length;
  ta.value=ta.value.slice(0,s)+em+ta.value.slice(s);
  ta.focus();ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,100)+'px';
  var ep=document.getElementById('wc-ep');if(ep)ep.classList.remove('on');
};

/* ── Transfer ── */
window.wcTr=function(){var m=document.getElementById('wc-tr');if(m)m.classList.toggle('on');};
window.wcTrTo=function(aid,aname,uid){
  if(!confirm('تحويل إلى '+aname+'؟'))return;
  var tr=document.getElementById('wc-tr');if(tr)tr.classList.remove('on');
  api('POST','transfer_chat',{reviewer_id:uid,to_admin_id:aid}).then(function(r){
    if(r&&r.ok){
      toast('✅ تم التحويل إلى '+aname);
      api('POST','messages/'+uid,{to_id:+uid,body:'📢 تم تحويل محادثتك إلى '+aname+'. سيتابع معك قريباً.'});
      setTimeout(function(){wStop();pCht();},800);
    }else toast((r&&r.error)||'فشل التحويل','er');
  });
};

/* ── Footer HTML ── */
function wFtr(){
  return '<div class="wc-f">'
    +'<div class="wc-bx">'
    +'<button class="wc-ic" onclick="wcEp()">😊</button>'
    +'<textarea class="wc-ta" id="wc-ta" placeholder="اكتب رسالة..." rows="1"'
    +' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'"'
    +' onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();wcSend();}"></textarea>'
    +'<input type="file" id="wc-fi" accept=".pdf,image/*" style="display:none" onchange="wcUp()">'
    +'<button class="wc-ic" onclick="document.getElementById(\'wc-fi\').click()">📎</button>'
    +'</div>'
    +'<button class="wc-snd" onclick="wcSend()">&#9658;</button>'
    +'<div class="wc-ep" id="wc-ep">'
    +'<div class="wc-et">'
    +['😊','👍','❤️','😴'].map(function(ic,i){return '<button class="wc-etb'+(i===0?' on':'')+'" onclick="wcEpT('+i+')">'+ic+'</button>';}).join('')
    +'</div>'
    +'<div class="wc-eg" id="wc-eg">'
    +(EM[0]||[]).map(function(e){return '<span class="wc-em" onclick="wcEpA(\''+e+'\')">'+e+'</span>';}).join('')
    +'</div></div></div>';
}

/* ── Build Admin Chat ── */
function buildAdm(uid,name){
  var adms=(window.D&&D.rev||[]).filter(function(u){return u.role==='admin'&&u.id!==(window.U&&U.id);});
  var h='<div class="wc">';
  h+='<div class="wc-h">';
  h+='<button class="wc-b" onclick="wStop();pCht()">←</button>';
  h+='<div class="wc-av">'+name.charAt(0)+'</div>';
  h+='<div class="wc-ni"><div class="wc-nm">'+htmlEsc(name)+'</div><div class="wc-sb">مراجع</div></div>';
  if(adms.length){
    h+='<button class="wc-b" onclick="wcTr()" title="تحويل">↪️</button>';
    h+='<div class="wc-tr" id="wc-tr">';
    h+='<div style="padding:8px 12px;font-size:11px;color:#8d9db5;font-family:Cairo,sans-serif">تحويل إلى:</div>';
    adms.forEach(function(a){
      h+='<div class="wc-tri" onclick="wcTrTo('+a.id+',\''+a.name.replace(/\\/g,'').replace(/'/g,'')+'\','+uid+')"><div class="wc-tav">'+a.name.charAt(0)+'</div>'+htmlEsc(a.name)+'</div>';
    });
    h+='</div>';
  }
  h+='<button class="wc-b" onclick="closeChatSession('+uid+')" title="إغلاق">🔒</button>';
  h+='</div>';
  h+='<div class="wc-m" id="wc-m"><div class="wc-ld"><i></i><i></i><i></i></div></div>';
  h+=wFtr();
  h+='</div>';
  return h;
}

/* ── Build Reviewer Chat ── */
function buildRv(adm){
  var h='<div class="wc">';
  h+='<div class="wc-h">';
  h+='<button class="wc-b" onclick="wStop();rvChat()">←</button>';
  h+='<div class="wc-av">'+(adm.name||'م').charAt(0)+'</div>';
  h+='<div class="wc-ni"><div class="wc-nm">'+htmlEsc(adm.name||'الإدارة')+'</div><div class="wc-sb">محادثة خاصة 🔒</div></div>';
  h+='</div>';
  h+='<div class="wc-m" id="wc-m"><div class="wc-ld"><i></i><i></i><i></i></div></div>';
  h+=wFtr();
  h+='</div>';
  return h;
}

/* ── Close menus on outside click ── */
document.addEventListener('click',function(e){
  var tr=document.getElementById('wc-tr'),ep=document.getElementById('wc-ep');
  if(tr&&!tr.contains(e.target)&&!e.target.closest('.wc-b[onclick*="wcTr"]'))tr.classList.remove('on');
  if(ep&&!ep.contains(e.target)&&!e.target.closest('.wc-ic[onclick*="wcEp"]'))ep.classList.remove('on');
});

/* ── Override oCht ── */
window.oCht=function(uid){
  window.D=window.D||{};D.cc=uid;
  var cv=(D.cvs||[]).find(function(x){return x.id==uid;});
  $h('pg',buildAdm(uid,(cv&&cv.name)||'مراجع'));
  setTimeout(function(){var ta=document.getElementById('wc-ta');if(ta)ta.focus();},100);
  wStart(uid,true);
};

/* ── Override rvOpenChat ── */
window.rvOpenChat=function(adm){
  window._rv_adm_id=adm.id;
  $h('rv-pg',buildRv(adm));
  setTimeout(function(){var ta=document.getElementById('wc-ta');if(ta)ta.focus();},100);
  wStart(adm.id,false);
};

/* ── File Upload ── */
window.wcUp=function(){
  var fi=document.getElementById('wc-fi');
  var file=fi&&fi.files[0];if(!file)return;fi.value='';
  if(file.size>20*1024*1024){toast('الحد 20MB','er');return;}
  toast('جاري الرفع...');
  var fd=new FormData();fd.append('file',file);
  fetch('./upload_file.php',{method:'POST',headers:{'Authorization':'Bearer '+(localStorage.getItem('tk')||'')},body:fd})
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.ok){toast(d.error||'فشل الرفع','er');return;}
      toast('تم الرفع ✅');
      var body=d.type==='image'?'📷 صورة':'📄 '+d.filename;
      api('POST','messages/'+W.uid,{to_id:W.uid,body:body,file_url:d.url,file_type:d.type,file_name:d.filename,file_size:d.size});
    }).catch(function(){toast('خطأ في الرفع','er');});
};

})();
