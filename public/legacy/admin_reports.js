/* admin_reports.js — صفحة التقارير والصور (إدارة)
   - تجميع حسب المراجع مع سهم لطيّ/فتح ملفاته
   - ترجمة طبية بالذكاء الاصطناعي
   - حقلان للتعليقات: ملاحظات داخلية (لا يراها المراجع) + نقاش مع المراجع
   - أرشفة + استعادة */

var RPT_TAB='active'; // 'active' or 'archived'
window._rptOpenGroups = window._rptOpenGroups || {}; // تذكّر أيّ مجموعات مفتوحة

async function pRpt(){
  pRptTab(RPT_TAB||'active');
}

async function pRptTab(tab){
  RPT_TAB=tab;
  // اعرض من cache فوراً (لو موجود لنفس التبويب)، حدّث في الخلفية
  var cached = (D.rpts && D._rptsTab === tab) ? D.rpts : null;
  if(cached){
    _renderRptPage(cached, tab);
    api('GET','reports?status='+tab).then(function(r){
      if(!Array.isArray(r)) return;
      D.rpts = r; D._rptsTab = tab;
      if(RPT_TAB === tab) _renderRptPage(r, tab);
    }).catch(function(){});
    return;
  }
  ld(1);
  var r=await api('GET','reports?status='+tab);
  ld(0);
  var list=Array.isArray(r)?r:[];
  D._rptsTab = tab;
  D.rpts=list;
  _renderRptPage(list,tab);
}

function _renderRptPage(list,tab){
  var tabBar=''
    +'<div style="display:flex;gap:4px;margin-bottom:14px;background:#f1f5f9;padding:5px;border-radius:12px">'
    +_rptTabBtn('active',  '📁 الجارية',  tab==='active')
    +_rptTabBtn('archived','🗄 المؤرشفة', tab==='archived')
    +'</div>';

  // التجميع حسب المراجع — مفتاحه reviewer_id فقط (آمن من XSS، ثابت عند تغيير الاسم)
  var groups={};
  list.forEach(function(r){
    var k = String(r.reviewer_id || 0);
    if(!groups[k]) groups[k]={id:r.reviewer_id,name:r.reviewer_name||'مراجع',phone:r.reviewer_phone,items:[]};
    groups[k].items.push(r);
  });
  var groupKeys=Object.keys(groups);
  groupKeys.sort(function(a,b){
    var la=groups[a].items[0].updated_at||groups[a].items[0].created_at||'';
    var lb=groups[b].items[0].updated_at||groups[b].items[0].created_at||'';
    return lb.localeCompare(la);
  });

  var body='';
  if(!list.length){
    body+='<div class="empty-state"><div style="font-size:42px">📁</div>'
      +'<p>'+(tab==='active'?'لا توجد تقارير جارية':'لا توجد تقارير مؤرشفة')+'</p></div>';
  } else {
    groupKeys.forEach(function(k){
      var g=groups[k];
      var initial=(g.name||'م').charAt(0);
      var isOpen = !!window._rptOpenGroups[k];
      var groupId = 'rpt-grp-'+k;
      body+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04)">';
      // header قابل للضغط مع سهم — k هو رقم فقط، آمن في الـ attribute
      body+='<button type="button" data-rpt-grp="'+k+'" '
        +'style="width:100%;display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#f0f4f8,#fff);padding:12px 13px;border:none;cursor:pointer;font-family:Cairo,sans-serif;text-align:right">'
        +'<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">'+initial+'</div>'
        +'<div style="flex:1;text-align:right"><div style="font-weight:800;font-size:14px;color:var(--text)">'+htmlEsc(g.name)+'</div>'
        +'<div style="font-size:11px;color:var(--mid)">'+g.items.length+' '+(g.items.length===1?'ملف':'ملفات')+'</div></div>'
        +'<div id="'+groupId+'-arrow" style="font-size:18px;color:var(--mid);transition:transform .2s;transform:rotate('+(isOpen?'90':'0')+'deg);flex-shrink:0">◀</div>'
        +'</button>';
      body+='<div id="'+groupId+'-body" style="display:'+(isOpen?'grid':'none')+';grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:11px;border-top:1px solid #f1f5f9">';
      g.items.forEach(function(rp){ body+=_rptCard(rp); });
      body+='</div></div>';
    });
  }

  $h('pg',
    '<div class="ph"><div><div class="pt">📁 التقارير والصور</div>'
    +'<div class="ps">يرفعها المراجع — تطلع عليها وتعلّق</div></div></div>'
    + tabBar
    + body
  );
  // اربط أزرار طيّ/فتح المجموعات (data-rpt-grp يحوي reviewer_id كرقم آمن)
  setTimeout(function(){
    document.querySelectorAll('[data-rpt-grp]').forEach(function(btn){
      btn.addEventListener('click', function(){ rptToggleGroup(btn.getAttribute('data-rpt-grp')); });
    });
  }, 30);
}

window.rptToggleGroup = function(k){
  window._rptOpenGroups[k] = !window._rptOpenGroups[k];
  var safeId = 'rpt-grp-' + k;
  var bodyEl = document.getElementById(safeId+'-body');
  var arrow = document.getElementById(safeId+'-arrow');
  var isOpen = !!window._rptOpenGroups[k];
  if(bodyEl) bodyEl.style.display = isOpen ? 'grid' : 'none';
  if(arrow) arrow.style.transform = 'rotate('+(isOpen?'90':'0')+'deg)';
};

function _rptTabBtn(k,lbl,active){
  return '<button type="button" onclick="pRptTab(\''+k+'\')" '
    +'style="flex:1;padding:10px 6px;border:none;'
    +'background:'+(active?'#fff':'transparent')+';'
    +'color:'+(active?'var(--blue)':'var(--mid)')+';'
    +'font-family:Cairo,sans-serif;font-size:12.5px;font-weight:'+(active?'800':'700')+';'
    +'cursor:pointer;border-radius:9px;transition:all .15s;'
    +'box-shadow:'+(active?'0 2px 6px rgba(42,111,219,.12)':'none')+'">'
    +lbl+'</button>';
}

function _rptCard(rp){
  var isPdf=rp.file_type==='pdf';
  var thumb;
  if(isPdf){
    thumb='<div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,#fee2e2,#fef2f2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">'
      +'<div style="font-size:34px">📄</div>'
      +'<div style="font-size:10px;color:#dc2626;font-weight:800;letter-spacing:1px">PDF</div>'
      +'</div>';
  } else {
    thumb='<div style="width:100%;aspect-ratio:1;background:#f1f5f9;overflow:hidden">'
      +'<img src="'+(rp.file_url||'').replace(/"/g,'&quot;')+'" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display=\'none\'">'
      +'</div>';
  }
  var date=(rp.created_at||'').slice(0,10);
  return '<div style="background:#fff;border:1px solid var(--border);border-radius:11px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s" '
    +'onclick="oRpt('+rp.id+')" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(0,0,0,.08)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'none\'">'
    +thumb
    +'<div style="padding:8px 10px">'
    +'<div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(rp.title||'بدون عنوان')+'</div>'
    +'<div style="font-size:10.5px;color:var(--mid);margin-top:2px">'+date+'</div>'
    +'</div></div>';
}

async function oRpt(id){
  ld(1);
  var r=await api('GET','reports/'+id);
  ld(0);
  if(!r||r.error){toast((r&&r.error)||'تعذّر التحميل','er');return;}
  _showRptModal(r);
}

function _showRptModal(rp){
  var isPdf=rp.file_type==='pdf';
  var url=rp.file_url||'';
  var preview;
  if(isPdf){
    // العارض يُفتح تلقائياً بعد الـ modal — هذا الزر للفتح من جديد لو أُغلق
    preview=''
      +'<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;margin-bottom:8px">'
      +'<div style="font-size:32px">📄</div>'
      +'<div style="flex:1;min-width:0">'
      +  '<div style="font-weight:800;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(rp.file_name||'ملف PDF')+'</div>'
      +  '<div style="font-size:11px;color:var(--mid)">العارض مفتوح — أَغلِقه للعودة هنا</div>'
      +'</div>'
      +'<button class="btn bs bsm" onclick="if(typeof openPdfViewer===\'function\')openPdfViewer(\''+url.replace(/'/g,"\\'")+'\',\''+(rp.title||'').replace(/'/g,"\\'")+'\',{description:\''+(rp.file_name||'').replace(/'/g,"\\'")+'\'});else window.open(\''+url.replace(/'/g,"\\'")+'\',\'_blank\');">👁️ فتح</button>'
      +'</div>';
  } else {
    preview=''
      +'<div style="text-align:center;background:#0f172a;border-radius:12px;padding:8px;margin-bottom:8px">'
      +'<img src="'+url+'" style="max-width:100%;max-height:65vh;border-radius:8px;cursor:zoom-in;display:inline-block" loading="lazy" onclick="rptLightbox(\''+url.replace(/\\/g,'\\\\').replace(/\'/g,'\\\'')+'\')">'
      +'</div>'
      +'<div style="font-size:11px;color:var(--mid);text-align:center;margin-bottom:8px">انقر على الصورة للتكبير</div>';
  }

  var allComments = rp.comments || [];
  // استخدم Number() للأمان من القيم النصية كـ "0"/"1" أو undefined
  var publicComments  = allComments.filter(function(c){ return Number(c.is_private) !== 1; });
  var privateComments = allComments.filter(function(c){ return Number(c.is_private) === 1; });

  var publicHtml = publicComments.map(_rptCommentRow).join('') ||
    '<div style="text-align:center;color:var(--light);padding:12px;font-size:12px">لا توجد رسائل بعد</div>';
  var privateHtml = privateComments.map(_rptCommentRow).join('') ||
    '<div style="text-align:center;color:#a78bfa;padding:12px;font-size:12px">لا توجد ملاحظات داخلية</div>';

  var isActive=rp.status==='active';
  var archBtn = isActive
    ? '<button class="btn bs bsm" onclick="archiveRpt('+rp.id+')">🗄 أرشفة</button>'
    : '<button class="btn bp bsm" onclick="restoreRpt('+rp.id+')">↩ استعادة</button>';

  // زر ترجمة طبية بالذكاء الاصطناعي
  var aiBtn = '<button class="btn bsm" id="ai-trans-btn" onclick="aiTranslateRpt('+rp.id+')" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;border:none;font-weight:800">🩺 ترجمة طبية</button>';

  var h=''
    +'<div style="font-size:12px;color:var(--mid);margin-bottom:4px">👤 '+htmlEsc(rp.reviewer_name||'مراجع')+'</div>'
    +'<div style="font-weight:800;font-size:15px;margin-bottom:10px">'+htmlEsc(rp.title||'')+'</div>'
    + preview
    +'<div style="display:flex;gap:6px;margin:8px 0 12px;flex-wrap:wrap">'+archBtn
      + aiBtn
      +'<a class="btn bs bsm" href="'+url+'" target="_blank" rel="noopener" style="text-decoration:none">⬇ تنزيل</a>'
      +'<button class="btn bd bsm" onclick="delRpt('+rp.id+')">🗑 حذف</button>'
    +'</div>'
    +'<div id="ai-trans-result"></div>'

    // ─── ١) نقاش مع المراجع (يراه الطرفان) ───────────────────────
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px;margin-top:14px">'
    +'<div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px;margin-bottom:8px;color:#0f172a">'
    +  '<span style="font-size:14px">💬</span><span>نقاش مع المراجع</span>'
    +  '<span style="font-size:10.5px;font-weight:600;color:var(--mid);margin-right:auto">يراه المراجع ويردّ عليه</span>'
    +'</div>'
    +'<div id="rpt-comments-pub" style="display:flex;flex-direction:column;gap:6px;margin-bottom:9px">'+publicHtml+'</div>'
    +'<div style="display:flex;gap:6px;align-items:flex-end;border-top:1px dashed #cbd5e1;padding-top:9px">'
    +'<textarea id="rpt-comment-pub" placeholder="اكتب ردّاً للمراجع..." rows="2" style="flex:1;border:1.5px solid var(--border);border-radius:9px;padding:7px 10px;font-family:Cairo,sans-serif;font-size:13px;outline:none;resize:none"></textarea>'
    +'<button class="btn bp bsm" onclick="addRptComment('+rp.id+',0)">إرسال</button>'
    +'</div></div>'

    // ─── ٢) ملاحظات داخلية للإدارة (سرّية — لا يراها المراجع) ─────
    +'<div style="background:linear-gradient(135deg,#fef3c7,#fff);border:1.5px solid #fcd34d;border-right:5px solid #f59e0b;border-radius:12px;padding:11px;margin-top:10px">'
    +'<div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px;margin-bottom:8px;color:#92400e">'
    +  '<span style="font-size:14px">🔒</span><span>ملاحظات داخلية للإدارة</span>'
    +  '<span style="font-size:10.5px;font-weight:600;color:#b45309;margin-right:auto">لا يراها المراجع</span>'
    +'</div>'
    +'<div id="rpt-comments-priv" style="display:flex;flex-direction:column;gap:6px;margin-bottom:9px">'+privateHtml+'</div>'
    +'<div style="display:flex;gap:6px;align-items:flex-end;border-top:1px dashed #fcd34d;padding-top:9px">'
    +'<textarea id="rpt-comment-priv" placeholder="ملاحظة سرّية بين الإدارة فقط..." rows="2" style="flex:1;border:1.5px solid #fcd34d;border-radius:9px;padding:7px 10px;font-family:Cairo,sans-serif;font-size:13px;outline:none;resize:none;background:#fffbeb"></textarea>'
    +'<button class="btn bsm" onclick="addRptComment('+rp.id+',1)" style="background:#f59e0b;color:#fff;border:none;font-weight:800">حفظ</button>'
    +'</div></div>';

  oM('📁 '+htmlEsc(rp.title||'تقرير'), h);

  // فتح العارض تلقائياً للملفات (دون الحاجة لضغط زر إضافي)
  if(isPdf && typeof window.openPdfViewer === 'function'){
    setTimeout(function(){
      window.openPdfViewer(url, rp.title || '', { description: rp.file_name || '' });
    }, 80);
  } else if(!isPdf && typeof window.openImageViewer === 'function'){
    setTimeout(function(){ window.openImageViewer(url, rp.title || 'صورة التقرير'); }, 80);
  }
}

// ─── ترجمة طبية بالذكاء الاصطناعي ──────────────────────────────
window.aiTranslateRpt=async function(reportId){
  var btn=document.getElementById('ai-trans-btn');
  var box=document.getElementById('ai-trans-result');
  if(!box) return;
  var origText=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.innerHTML='⏳ جاري التحليل...';}
  box.innerHTML='<div style="background:linear-gradient(135deg,#faf5ff,#f5f3ff);border:1px solid #ddd6fe;border-radius:12px;padding:18px;margin:12px 0;text-align:center;color:#6d28d9">'
    +'<div style="font-size:30px;margin-bottom:8px">🩺</div>'
    +'<div style="font-weight:700;font-size:13px">الذكاء الاصطناعي يقرأ التقرير الطبي...</div>'
    +'<div style="font-size:11px;color:#7c3aed;margin-top:4px">قد يستغرق 10-25 ثانية للملفات متعدّدة الصفحات</div>'
    +'</div>';
  var r;
  try{
    var res=await fetch('/api/ai/translate',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('tk')||'')},
      body:JSON.stringify({report_id:reportId}),
    });
    r=await res.json();
  }catch(e){ r={error:'خطأ في الاتصال'}; }
  if(btn){btn.disabled=false;btn.innerHTML=origText;}
  if(!r||!r.ok){
    box.innerHTML='<div style="background:#fef2f2;border:1px solid #fecaca;border-right:3px solid #dc2626;border-radius:10px;padding:11px 13px;margin:12px 0;color:#991b1b;font-size:12.5px">'
      +'<b>⚠️ تعذّر الترجمة:</b> '+htmlEsc((r&&r.error)||'خطأ غير معروف')
      +'</div>';
    return;
  }
  var rendered = (typeof mdRender==='function') ? mdRender(r.text) : ('<div style="white-space:pre-wrap">'+htmlEsc(r.text)+'</div>');
  if(typeof window.styleAbnormalValues==='function') rendered = window.styleAbnormalValues(rendered);
  box.innerHTML='<div style="background:linear-gradient(135deg,#faf5ff,#fff);border:1.5px solid #ddd6fe;border-right:4px solid #8b5cf6;border-radius:12px;padding:14px;margin:12px 0;box-shadow:0 2px 8px rgba(139,92,246,.08)">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e9d5ff">'
    +'<div style="display:flex;align-items:center;gap:7px">'
    +'<span style="font-size:18px">🩺</span>'
    +'<span style="font-weight:800;font-size:13px;color:#6d28d9">ترجمة طبية</span>'
    +'</div>'
    +'<button onclick="document.getElementById(\'ai-trans-result\').innerHTML=\'\'" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0;width:24px;height:24px" title="إغلاق">✕</button>'
    +'</div>'
    +'<div style="font-size:13.5px;color:#1e293b;line-height:1.85">'+rendered+'</div>'
    +'</div>';
};

// ─── Lightbox للصور (مُحوَّل إلى openImageViewer إن وُجد) ─────────
window.rptLightbox=function(url){
  if(typeof window.openImageViewer === 'function'){
    window.openImageViewer(url, 'صورة التقرير'); return;
  }
  var prev=document.getElementById('rpt-lightbox');if(prev)prev.remove();
  var ov=document.createElement('div');
  ov.id='rpt-lightbox';
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.95);z-index:10001;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;cursor:zoom-out';
  ov.innerHTML=''
    +'<button id="rptlb-close" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,.15);border:none;color:#fff;width:42px;height:42px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="إغلاق">✕</button>'
    +'<img src="'+url+'" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,.5);cursor:default" onclick="event.stopPropagation()">';
  document.body.appendChild(ov);
  function close(){ ov.remove(); }
  ov.addEventListener('click',close);
  document.getElementById('rptlb-close').addEventListener('click',function(e){e.stopPropagation();close();});
};

function _rptCommentRow(c){
  var isAdmin = c.user_role === 'admin';
  var isPriv = Number(c.is_private) === 1;
  var bg, bdrColor, icon;
  if(isPriv){
    bg = '#fffbeb'; bdrColor = '#f59e0b'; icon = '🔒 ';
  } else if(isAdmin){
    bg = '#f0f9ff'; bdrColor = '#0369a1'; icon = '👨‍💼 ';
  } else {
    bg = '#f8fafc'; bdrColor = '#475569'; icon = '👤 ';
  }
  return '<div style="background:'+bg+';border-right:3px solid '+bdrColor+';border-radius:10px;padding:8px 11px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
    +'<div style="font-size:11.5px;font-weight:800;color:'+bdrColor+'">'+icon+htmlEsc(c.user_name||'')+'</div>'
    +'<div style="font-size:10px;color:var(--light)">'+((c.created_at||'').slice(0,16))+'</div>'
    +'</div>'
    +'<div style="font-size:13px;color:#1e293b;line-height:1.5;white-space:pre-wrap">'+htmlEsc(c.body||'')+'</div>'
    +'</div>';
}

// type: 0 = عام (نقاش)، 1 = خاص (داخلي)
async function addRptComment(id, type){
  var inputId = type === 1 ? 'rpt-comment-priv' : 'rpt-comment-pub';
  var ta = document.getElementById(inputId);
  if(!ta) return;
  var v = (ta.value||'').trim();
  if(!v){ toast('اكتب التعليق','er'); return; }
  ld(1);
  var r = await api('POST','report_comments', { report_id:id, body:v, is_private: type===1 ? 1 : 0 });
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  ta.value = '';
  // أعد فتح الـ modal للحصول على القائمة المحدّثة
  var fresh = await api('GET','reports/'+id);
  if(fresh && !fresh.error) _showRptModal(fresh);
}

async function archiveRpt(id){
  oConfirm('أرشفة هذا التقرير؟',async function(){
    ld(1);var r=await api('PUT','reports/'+id,{status:'archived'});ld(0);
    if(r&&r.error){toast(r.error,'er');return;}
    cM();toast('✅ تم الأرشفة');pRptTab(RPT_TAB);
  },{icon:'🗄️',yes:'أرشفة',no:'إلغاء'});
}

async function restoreRpt(id){
  oConfirm('استعادة هذا التقرير؟',async function(){
    ld(1);var r=await api('PUT','reports/'+id,{status:'active'});ld(0);
    if(r&&r.error){toast(r.error,'er');return;}
    cM();toast('✅ تم الاستعادة');pRptTab(RPT_TAB);
  },{icon:'↩️',yes:'استعادة',no:'إلغاء'});
}

async function delRpt(id){
  oConfirm('حذف التقرير نهائياً؟ لا يمكن التراجع.',async function(){
    ld(1);var r=await api('DELETE','reports/'+id);ld(0);
    if(r&&r.error){toast(r.error,'er');return;}
    cM();toast('🗑 تم الحذف');pRptTab(RPT_TAB);
  },{icon:'🗑',yes:'حذف',no:'إلغاء',danger:true});
}
