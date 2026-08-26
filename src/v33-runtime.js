const NORTURA_LOGO='https://raw.githubusercontent.com/tonyadanielsen-byte/opex-platform/main/icons/nortura-logo.png';
let rounds=[],plans=[],dbBound=false,lastTick='';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function applyBrand(){
  document.querySelectorAll('.brand-logo,.login-opex-logo').forEach(img=>{
    if(img.getAttribute('src')!==NORTURA_LOGO){img.setAttribute('src',NORTURA_LOGO);img.alt='Nortura';}
    if(!img.classList.contains('nortura-logo-v33'))img.classList.add('nortura-logo-v33');
  });
}

function categoryFor(name=''){
  const n=name.toLowerCase();
  if(n.includes('hms')||n.includes('verneutstyr')||n.includes('truck')||n.includes('brann')) return 'HMS & sikkerhet';
  if(n.includes('hygiene')||n.includes('renhold')) return 'Hygiene & renhold';
  if(n.includes('husorden')||n.includes('orden')) return 'Orden & standard';
  if(n.includes('rutine')||n.includes('kontroll')) return 'Rutiner & system';
  if(n.includes('kvalitet')) return 'Kvalitet';
  return 'Øvrige temaer';
}

function enhanceThemeBank(){
  const panel=document.querySelector('.theme-bank-panel');
  if(!panel||panel.dataset.v33Grouped==='1')return;
  const rows=[...panel.querySelectorAll('.theme-bank-row')];
  if(!rows.length)return;
  const groups=new Map();
  rows.forEach(row=>{
    const name=row.querySelector('.theme-bank-main strong')?.textContent?.trim()||'Tema';
    const cat=categoryFor(name);
    if(!groups.has(cat))groups.set(cat,[]);
    groups.get(cat).push(row.outerHTML);
  });
  const order=['HMS & sikkerhet','Hygiene & renhold','Orden & standard','Rutiner & system','Kvalitet','Øvrige temaer'];
  panel.innerHTML=`<div class="theme-bank-intro"><div><span class="eyebrow">Strukturert temabank</span><h2>${rows.length} aktive temaer</h2></div><p>Temaene er gruppert for raskere oversikt. Rediger tema eller opprett nye uten kodeendringer.</p></div>`+
    order.filter(k=>groups.has(k)).map(k=>`<section class="theme-category"><header><div><span class="theme-category-dot"></span><h3>${esc(k)}</h3></div><span>${groups.get(k).length} tema</span></header><div class="theme-category-body">${groups.get(k).join('')}</div></section>`).join('');
  panel.dataset.v33Grouped='1';
}

function bindDb(){
  if(dbBound||!window.firebase?.database)return;
  dbBound=true;
  const db=window.firebase.database();
  db.ref('lor/rounds').on('value',s=>{rounds=[];s.forEach(c=>rounds.push({id:c.key,...(c.val()||{})}));});
  db.ref('lor/plans').on('value',s=>{plans=[];s.forEach(c=>plans.push({id:c.key,...(c.val()||{})}));});
}

document.addEventListener('click',e=>{
  const close=e.target.closest('[data-dialog-close],.dialog-close,.dialog-cancel');
  if(close){e.preventDefault();e.stopImmediatePropagation();close.closest('dialog')?.remove();return;}
  if(e.target.tagName==='DIALOG'){e.preventDefault();e.target.remove();}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('dialog').forEach(d=>d.remove());}},true);

function safeTick(){
  try{
    applyBrand();enhanceThemeBank();bindDb();
    lastTick='ok';
  }catch(err){
    if(lastTick!=='error')console.error('V3.3 enhancement error',err);
    lastTick='error';
  }
}
window.addEventListener('load',safeTick);
setTimeout(safeTick,250);
setInterval(safeTick,1200);
