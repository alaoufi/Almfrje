/* rv_publish.js */

async function rvPub(){
  ld(1);
  var r=await api('GET','publications');
  ld(0);
  var pubs=Array.isArray(r)?r:[];
  var h='<div class="ph"><div><div class="pt">📖 النشرات</div></div></div>';
  if(!pubs.length){
    h+='<div style="text-align:center;padding:48px 16px;color:var(--light)">'
      +'<div style="font-size:48px;margin-bottom:12px">📖</div><p>لا توجد نشرات</p></div>';
    $h('rv-pg',h);return;
  }
  pubs.forEach(function(p){
    var isPdf=p.type==='pdf';
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.04)">';
    h+='<div style="display:flex;align-items:flex-start;gap:12px">';
    h+='<div style="font-size:28px;flex-shrink:0">'+(isPdf?'📄':'📝')+'</div>';
    h+='<div style="flex:1">';
    h+='<div style="font-weight:700;font-size:15px;margin-bottom:4px">'+htmlEsc(p.title||'')+'</div>';
    if(p.description) h+='<div style="font-size:12px;color:var(--mid);margin-bottom:8px">'+htmlEsc(p.description)+'</div>';
    if(isPdf&&p.file_path){
      h+='<button class="btn bs bsm" onclick="window.open(\''+p.file_path+'\')">👁️ فتح PDF</button>';
    } else if(p.content){
      h+='<div style="font-size:13px;color:var(--text);margin-top:6px;line-height:1.6">'+htmlEsc(p.content.slice(0,200))
        +(p.content.length>200?'...<button class="btn bs bsm" style="margin-right:6px" onclick="alert(\''+p.content.replace(/'/g,"\\'").slice(0,500)+'\')">المزيد</button>':'')+'</div>';
    }
    h+='</div></div></div>';
  });
  $h('rv-pg',h);
}

