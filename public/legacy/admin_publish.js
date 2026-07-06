/* admin_publish.js */

function pPub(){
  var pubs=D.pub||[];
  var h='<div class="ph"><div><div class="pt">📖 النشرات</div></div>'
    +'<button class="btn bp" onclick="oAddPub()">+ نشرة</button></div>';

  if(!pubs.length){
    h+='<div style="text-align:center;padding:60px 16px;color:var(--light)">'
      +'<div style="font-size:48px;margin-bottom:12px">📖</div>'
      +'<p>لا توجد نشرات</p>'
      +'<button class="btn bp" style="margin-top:12px" onclick="oAddPub()">+ إضافة نشرة</button></div>';
    $h('pg',h);return;
  }

  h+='<div style="display:flex;flex-direction:column;gap:10px">';
  pubs.forEach(function(p){
    var isPdf=p.type==='pdf';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
    h+='<div style="flex:1">';
    h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">';
    h+='<span style="font-size:18px">'+(isPdf?'📄':'📝')+'</span>';
    h+='<span style="font-weight:700;font-size:14px">'+htmlEsc(p.title||'')+'</span>';
    h+='</div>';
    if(p.description) h+='<div style="font-size:12px;color:var(--mid);margin-bottom:7px">'+htmlEsc(p.description)+'</div>';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
    var typeLbl=isPdf?'PDF':'مقال';
    var typeBg=isPdf?'#dcfce7':'#dbeafe';
    var typeClr=isPdf?'#15803d':'#2563b0';
    h+='<span style="background:'+typeBg+';color:'+typeClr+';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">'+typeLbl+'</span>';
    if(p.created_at) h+='<span style="font-size:11px;color:var(--light)">'+p.created_at.slice(0,10)+'</span>';
    h+='</div></div>';
    h+='<div style="display:flex;gap:5px;flex-shrink:0">';
    if(isPdf&&p.file_path) h+='<button class="btn bs bsm" onclick="window.open(\''+p.file_path+'\')">👁️</button>';
    h+='<button class="ib id" style="width:30px;height:30px" onclick="if(confirmDel(\'حذف النشرة؟\'))dPub('+p.id+')">'+SVG.del+'</button>';
    h+='</div></div></div>';
  });
  h+='</div>';
  $h('pg',h);
}

function oAddPub(){
  oM('نشرة جديدة',
    '<div style="display:flex;gap:6px;margin-bottom:12px">'
    +'<button class="btn bp" style="flex:1" id="pub-type-pdf" onclick="setPubType(\'pdf\')">📄 PDF</button>'
    +'<button class="btn bs" style="flex:1" id="pub-type-text" onclick="setPubType(\'text\')">📝 مقال</button>'
    +'</div>'
    +'<input type="hidden" id="pub-type" value="pdf">'
    +'<div class="f"><label>العنوان *</label><input id="pub-title" class="fr-inp" placeholder="عنوان النشرة"></div>'
    +'<div class="f"><label>الوصف</label><input id="pub-desc" class="fr-inp" placeholder="وصف مختصر..."></div>'
    +'<div id="pub-pdf-wrap" class="f"><label>ملف PDF</label>'
    +'<input type="file" id="pub-file" accept=".pdf" style="width:100%;padding:8px;border:1.5px dashed var(--border);border-radius:9px"></div>'
    +'<div id="pub-text-wrap" class="f" style="display:none"><label>المحتوى</label>'
    +'<textarea id="pub-content" class="fr-inp" style="height:120px;resize:none" placeholder="اكتب المحتوى..."></textarea></div>'
    +'<div style="display:flex;gap:9px;margin-top:8px">'
    +'<button class="btn bp" onclick="svPub()">💾 نشر</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function setPubType(t){
  $g('pub-type').value=t;
  $g('pub-pdf-wrap').style.display=t==='pdf'?'':'none';
  $g('pub-text-wrap').style.display=t==='text'?'':'none';
  $g('pub-type-pdf').className='btn '+(t==='pdf'?'bp':'bs');
  $g('pub-type-text').className='btn '+(t==='text'?'bp':'bs');
}

async function svPub(){
  var title=($g('pub-title')?.value||'').trim();
  var desc=($g('pub-desc')?.value||'').trim();
  var type=$g('pub-type')?.value||'pdf';
  if(!title){toast('العنوان مطلوب','er');return;}
  var body={title,description:desc,type};
  if(type==='text'){
    body.content=$g('pub-content')?.value||'';
  } else {
    var fileEl=$g('pub-file');
    if(fileEl&&fileEl.files&&fileEl.files[0]){
      ld(1);
      var b64=await new Promise(function(res){
        var fr=new FileReader();
        fr.onload=function(e){res(e.target.result.split(',')[1]);};
        fr.readAsDataURL(fileEl.files[0]);
      });
      ld(0);
      body.file_data=b64;
      body.file_name=fileEl.files[0].name;
    }
  }
  ld(1);var r=await api('POST','publications',body);ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم النشر ✅');cM();await lPub();pPub();
}

async function dPub(id){
  ld(1);await api('DELETE','publications/'+id);ld(0);
  toast('تم الحذف');await lPub();pPub();
}

