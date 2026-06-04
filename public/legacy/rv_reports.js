/* rv_reports.js — صفحة التقارير والصور (مراجع)
   - يستطيع رفع عدّة ملفات دفعة واحدة
   - يستطيع كتابة تعليقات على ملفاته فقط
   - لا تظهر له الترجمة الآلية (للإدارة فقط)
   - لا يرى التعليقات الخاصة بالإدارة (is_private=1) */

async function rvRpt(){
  ld(1);
  var r=await api('GET','reports?status=active');
  ld(0);
  var list=Array.isArray(r)?r:[];

  var tipBtn = (typeof rvTipIcon==='function') ? rvTipIcon('report_upload') : '';
  var h='<div class="ph"><div><div class="pt">📁 ملفاتي وتقاريري '+tipBtn+'</div>'
    +'<div class="ps">ارفع صور أو ملفات PDF — تطلع الإدارة وتعلّق</div></div>'
    +'<button class="btn bp" onclick="rvRptUpload()">+ رفع</button></div>';

  if(!list.length){
    h+='<div class="empty-state" style="padding:40px 16px">'
      +'<div style="font-size:46px;margin-bottom:10px">📁</div>'
      +'<p style="margin-bottom:14px">لا توجد ملفات بعد</p>'
      +'<button class="btn bp" onclick="rvRptUpload()">+ ارفع أول ملف</button>'
      +'</div>';
    $h('rv-pg',h);
    if(typeof rvBindTips==='function') setTimeout(rvBindTips,30);
    return;
  }

  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:11px">';
  list.forEach(function(rp){ h+=_rvRptCard(rp); });
  h+='</div>';
  $h('rv-pg',h);
  if(typeof rvBindTips==='function') setTimeout(rvBindTips,30);
}

function _rvRptCard(rp){
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
    +'onclick="rvOpenRpt('+rp.id+')" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(0,0,0,.08)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'none\'">'
    +thumb
    +'<div style="padding:8px 10px">'
    +'<div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(rp.title||'')+'</div>'
    +'<div style="font-size:10.5px;color:var(--mid);margin-top:2px">'+date+'</div>'
    +'</div></div>';
}

// ─── رفع متعدّد ───────────────────────────────────────────────────
function _rvMaxMb(){
  var v=parseInt((D.cfg&&D.cfg.max_upload_mb)||'10',10);
  return Number.isFinite(v)&&v>0?Math.min(v,100):10;
}

// state للملفات المختارة قبل الرفع
window._rvUpFiles = [];

function rvRptUpload(){
  window._rvUpFiles = [];
  var maxMb=_rvMaxMb();
  var tipBtn = (typeof rvTipIcon==='function') ? rvTipIcon('report_upload_modal') : '';
  var h=''
    +(tipBtn ? '<div style="display:flex;justify-content:flex-end;margin-bottom:6px">'+tipBtn+'</div>' : '')
    +'<div class="f"><label>اختر ملفاً واحداً أو أكثر (صور / PDF — حد كل ملف '+maxMb+'MB)</label>'
    +'<input id="rvr-file" type="file" accept="image/*,application/pdf" multiple style="width:100%;padding:9px;border:1.5px dashed var(--border);border-radius:10px;background:#f8fafc;font-family:Cairo,sans-serif;font-size:13px"></div>'
    +'<div id="rvr-list" style="margin:8px 0;display:flex;flex-direction:column;gap:7px"></div>'
    +'<div id="rvr-msg" style="font-size:12px;color:var(--mid);margin-bottom:8px;text-align:center;display:none"></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="btn bp" style="flex:1" id="rvr-submit" onclick="rvRptDoUpload()" disabled>رفع</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button>'
    +'</div>';
  oM('📁 رفع ملفات', h);
  setTimeout(function(){
    if(typeof rvBindTips==='function') rvBindTips(document.getElementById('mb'));
    var fi=document.getElementById('rvr-file');
    if(fi) fi.onchange=function(){
      var maxBytes = _rvMaxMb()*1024*1024;
      var arr = Array.prototype.slice.call(fi.files || []);
      var accepted = arr.filter(function(f){
        return (f.type.indexOf('image/')===0 || f.type==='application/pdf') && f.size <= maxBytes;
      });
      // عدّاد الرفض الحقيقي عند الاختيار — منفصل عن حذف المستخدم اليدوي لاحقاً
      window._rvUpRejected = arr.length - accepted.length;
      window._rvUpFiles = accepted.map(function(f){
        var nm = (f.name||'ملف').replace(/\.[^.]+$/,'');
        return { file: f, title: nm };
      });
      _rvRenderUpList();
      var btn=document.getElementById('rvr-submit');
      if(btn) btn.disabled = !window._rvUpFiles.length;
    };
  },50);
}

function _rvRenderUpList(){
  var box = document.getElementById('rvr-list');
  if(!box) return;
  if(!window._rvUpFiles.length){ box.innerHTML=''; return; }
  var maxMb = _rvMaxMb();
  box.innerHTML = window._rvUpFiles.map(function(item, i){
    var f = item.file;
    var isImg = f.type.indexOf('image/')===0;
    var icon = isImg
      ? '<div style="width:42px;height:42px;border-radius:8px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🖼️</div>'
      : '<div style="width:42px;height:42px;border-radius:8px;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📄</div>';
    var safeTitle = (item.title||'').replace(/"/g,'&quot;');
    return '<div style="display:flex;align-items:center;gap:9px;background:#fafbff;border:1px solid #e2e8f0;border-radius:10px;padding:8px">'
      + icon
      + '<div style="flex:1;min-width:0">'
      +   '<input type="text" value="'+safeTitle+'" placeholder="عنوان الملف" oninput="window._rvUpFiles['+i+'].title=this.value" '
      +   'style="width:100%;padding:6px 9px;border:1px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:12.5px;outline:none;box-sizing:border-box;background:#fff">'
      +   '<div style="font-size:10.5px;color:var(--mid);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      +     htmlEsc(f.name)+' • '+Math.round(f.size/1024)+' KB'
      +   '</div>'
      + '</div>'
      + '<button type="button" onclick="window._rvUpFiles.splice('+i+',1);_rvRenderUpList()" '
      + 'style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:18px;padding:4px 8px;flex-shrink:0" title="حذف">🗑️</button>'
      + '</div>';
  }).join('');
  // اعرض عدّ الرفض الحقيقي (المسجّل وقت الاختيار)، لا الفرق مع الحذف اليدوي
  var rejectedCount = window._rvUpRejected || 0;
  if(rejectedCount > 0){
    box.innerHTML += '<div style="font-size:11px;color:#dc2626;text-align:center;padding:4px">⚠️ تجاهلنا '+rejectedCount+' ملفاً (الحد '+maxMb+'MB أو نوع غير مدعوم)</div>';
  }
}

async function rvRptDoUpload(){
  // حماية من الضغط المزدوج / لمس متكرّر
  if(window._rvUploading) return;
  window._rvUploading = true;

  // التقط نسخة محلية من الملفات حتى لا تتأثر العملية بأي تعديل لاحق
  var files = (window._rvUpFiles || []).slice();
  if(!files.length){ window._rvUploading=false; return; }

  // تأكّد أن كل العناوين معبّأة
  for(var i=0;i<files.length;i++){
    var t = (files[i].title||'').trim();
    if(!t){ toast('أدخل عنواناً للملف رقم '+(i+1),'er'); window._rvUploading=false; return; }
  }
  var msg = document.getElementById('rvr-msg');
  var btn = document.getElementById('rvr-submit');
  function show(t,err){ if(msg){ msg.style.display='block'; msg.style.color=err?'#dc2626':'var(--mid)'; msg.textContent=t; } }
  if(btn){ btn.disabled=true; btn.textContent='جاري الرفع…'; }

  var done = 0, errors = [];
  for(var i2=0; i2<files.length; i2++){
    var item = files[i2];
    show('('+(i2+1)+'/'+files.length+') رفع: '+item.title);
    var fd = new FormData(); fd.append('file', item.file);
    var up;
    try{
      var res = await fetch('/api/upload', {
        method:'POST',
        headers:{'Authorization':'Bearer '+(localStorage.getItem('tk')||'')},
        body: fd,
      });
      up = await res.json();
    }catch(e){ up={error:'خطأ شبكة'}; }
    if(!up || !up.ok){ errors.push(item.title+': '+(up&&up.error?up.error:'فشل الرفع')); continue; }
    var rec = await api('POST','reports',{
      title: item.title.trim(),
      file_url: up.url,
      file_type: up.type,
      file_name: up.filename,
    });
    if(rec && rec.error){ errors.push(item.title+': '+rec.error); continue; }
    done++;
  }
  if(btn){ btn.disabled=false; btn.textContent='رفع'; }
  window._rvUploading = false;
  cM();
  if(done && !errors.length) toast('✅ رُفع '+done+' '+(done===1?'ملف':'ملفات'));
  else if(done && errors.length) toast('رُفع '+done+'، فشل '+errors.length+': '+errors[0],'er');
  else toast('فشل الرفع: '+(errors[0]||'خطأ غير معروف'),'er');
  rvRpt();
}

// ─── عرض ملف ────────────────────────────────────────────────────
async function rvOpenRpt(id){
  ld(1);
  var r=await api('GET','reports/'+id);
  ld(0);
  if(!r||r.error){toast((r&&r.error)||'تعذّر التحميل','er');return;}
  _rvShowRptModal(r);
}

function _rvShowRptModal(rp){
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
      +'<img src="'+url+'" style="max-width:100%;max-height:60vh;border-radius:8px;cursor:zoom-in;display:inline-block" loading="lazy" onclick="rptLightbox(\''+url.replace(/\\/g,'\\\\').replace(/\'/g,'\\\'')+'\')">'
      +'</div>'
      +'<div style="font-size:11px;color:var(--mid);text-align:center;margin-bottom:8px">انقر على الصورة للتكبير</div>';
  }

  // التعليقات العامة فقط (السيرفر يُخفي الخاصّة من المراجع)
  var commentsHtml=(rp.comments||[]).map(_rvRptCommentRow).join('');
  if(!commentsHtml) commentsHtml='<div style="text-align:center;color:var(--light);padding:14px;font-size:12px">لا توجد تعليقات بعد</div>';

  var h=''
    +'<div style="font-weight:800;font-size:15px;margin-bottom:10px">'+htmlEsc(rp.title||'')+'</div>'
    + preview
    +'<div style="display:flex;gap:6px;margin:8px 0 12px;flex-wrap:wrap">'
    +'<a class="btn bs bsm" href="'+url+'" target="_blank" rel="noopener" style="text-decoration:none">⬇ تنزيل</a>'
    +'<button class="btn bd bsm" onclick="rvDelRpt('+rp.id+')">🗑 حذف</button>'
    +'</div>'
    +'<div style="font-weight:800;font-size:13px;margin:14px 0 8px;color:var(--text)">💬 النقاش</div>'
    +'<div id="rvrpt-comments" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px">'+commentsHtml+'</div>'
    +'<div style="display:flex;gap:6px;align-items:flex-end;border-top:1px solid var(--border);padding-top:10px">'
    +'<textarea id="rvrpt-comment-input" placeholder="اكتب تعليقك..." rows="2" style="flex:1;border:1.5px solid var(--border);border-radius:10px;padding:8px 11px;font-family:Cairo,sans-serif;font-size:13px;outline:none;resize:none"></textarea>'
    +'<button class="btn bp bsm" onclick="rvAddRptComment('+rp.id+')">إرسال</button>'
    +'</div>';

  oM('📁 '+htmlEsc(rp.title||'ملفي'), h);

  // فتح العارض تلقائياً للملفات (دون الحاجة لضغط زر إضافي)
  if(isPdf && typeof window.openPdfViewer === 'function'){
    setTimeout(function(){
      window.openPdfViewer(url, rp.title || '', { description: rp.file_name || '' });
    }, 80);
  } else if(!isPdf && typeof window.openImageViewer === 'function'){
    setTimeout(function(){ window.openImageViewer(url, rp.title || 'صورة التقرير'); }, 80);
  }
}

function _rvRptCommentRow(c){
  var isAdmin=c.user_role==='admin';
  var bg=isAdmin?'#f0f9ff':'#f8fafc';
  var bdrColor=isAdmin?'#0369a1':'#475569';
  return '<div style="background:'+bg+';border-right:3px solid '+bdrColor+';border-radius:10px;padding:9px 11px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
    +'<div style="font-size:11.5px;font-weight:800;color:'+bdrColor+'">'+(isAdmin?'👨‍💼 ':'👤 ')+htmlEsc(c.user_name||'')+'</div>'
    +'<div style="font-size:10px;color:var(--light)">'+((c.created_at||'').slice(0,16))+'</div>'
    +'</div>'
    +'<div style="font-size:13px;color:#1e293b;line-height:1.5;white-space:pre-wrap">'+htmlEsc(c.body||'')+'</div>'
    +'</div>';
}

async function rvAddRptComment(id){
  var ta=document.getElementById('rvrpt-comment-input');
  if(!ta)return;
  var v=(ta.value||'').trim();
  if(!v){toast('اكتب التعليق','er');return;}
  ld(1);
  var r=await api('POST','report_comments',{report_id:id,body:v});
  ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  ta.value='';
  var fresh=await api('GET','reports/'+id);
  if(fresh&&!fresh.error) _rvShowRptModal(fresh);
}

async function rvDelRpt(id){
  oConfirm('حذف هذا الملف نهائياً؟',async function(){
    ld(1);var r=await api('DELETE','reports/'+id);ld(0);
    if(r&&r.error){toast(r.error,'er');return;}
    cM();toast('🗑 تم الحذف');rvRpt();
  },{icon:'🗑',yes:'حذف',no:'إلغاء',danger:true});
}
