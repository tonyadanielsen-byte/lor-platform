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

function findingsOf(r){
  const out=[];
  Object.values(r.responses||{}).forEach(x=>{const s=x.status||x.result||x.answer;if(s==='improvement'||s==='Forbedringspunkt')out.push('Forbedringspunkt');if(s==='deviation'||s==='Avvik')out.push('Avvik');});
  Object.values(r.employeeInterviews||{}).forEach(x=>{if(x.needsFollowUp||x.requiresFollowUp||x.followUp)out.push('Medarbeiderinnspill');});
  return out;
}
function monthKey(t){const d=new Date(Number(t||0));return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function lastMonths(n=6){const a=[],now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);a.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('nb-NO',{month:'short'})});}return a;}
function lineSvg(valsA,valsB,labels){
  const w=520,h=150,p=24,max=Math.max(1,...valsA,...valsB),x=i=>p+i*(w-2*p)/Math.max(1,labels.length-1),y=v=>h-p-(v/max)*(h-2*p);
  const path=v=>v.map((n,i)=>`${i?'L':'M'}${x(i)},${y(n)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="v33-chart-svg" role="img" aria-label="Funn over tid"><g class="grid">${[0,.5,1].map(q=>`<line x1="${p}" x2="${w-p}" y1="${p+q*(h-2*p)}" y2="${p+q*(h-2*p)}"/>`).join('')}</g><path class="line imp" d="${path(valsA)}"/><path class="line dev" d="${path(valsB)}"/>${labels.map((l,i)=>`<text x="${x(i)}" y="${h-5}" text-anchor="middle">${l}</text>`).join('')}</svg>`;
}
function donut(rate){const r=52,c=2*Math.PI*r,d=Math.max(0,Math.min(100,rate))/100*c;return `<svg class="v33-donut" viewBox="0 0 140 140"><circle cx="70" cy="70" r="52" class="track"/><circle cx="70" cy="70" r="52" class="value" stroke-dasharray="${d} ${c-d}"/><text x="70" y="66" text-anchor="middle" class="pct">${rate}%</text><text x="70" y="87" text-anchor="middle" class="sub">gjennomført</text></svg>`;}

function dashboardCharts(){
  const kpis=document.querySelector('.dashboard-kpis');
  if(!kpis)return;
  let wrap=document.querySelector('#v33DashboardCharts');
  const sig=JSON.stringify([rounds.map(r=>[r.id,r.updatedAt,r.status]),plans.map(p=>[p.id,p.week,p.status])]);
  if(wrap?.dataset.sig===sig)return;
  if(!wrap){wrap=document.createElement('section');wrap.id='v33DashboardCharts';wrap.className='v33-dashboard-charts';kpis.insertAdjacentElement('afterend',wrap);}
  wrap.dataset.sig=sig;
  const user=window.firebase?.auth?.().currentUser;const ownPlans=plans.filter(p=>!user||!p.leaderUid||p.leaderUid===user.uid);const ownRounds=rounds.filter(r=>!user||!r.leaderUid||r.leaderUid===user.uid);
  const donePlans=ownPlans.filter(p=>ownRounds.some(r=>r.planId===p.id||(r.planWeek&&Number(r.planWeek)===Number(p.week)&&r.theme===(p.theme||p.themeName)))).length;
  const rate=ownPlans.length?Math.round(donePlans/ownPlans.length*100):0;
  const months=lastMonths(),imp=[],dev=[];months.forEach(m=>{const rs=rounds.filter(r=>monthKey(r.completedAt||r.startedAt)===m.key),fs=rs.flatMap(findingsOf);imp.push(fs.filter(x=>x==='Forbedringspunkt').length);dev.push(fs.filter(x=>x==='Avvik').length);});
  const themeCounts={};rounds.forEach(r=>{const n=findingsOf(r).length;if(n)themeCounts[r.theme||'Ukjent']=(themeCounts[r.theme||'Ukjent']||0)+n;});const top=Object.entries(themeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5),mx=Math.max(1,...top.map(x=>x[1]));
  wrap.innerHTML=`<article class="card v33-chart-card v33-plan-card"><div class="v33-card-head"><div><span class="eyebrow">Fremdrift</span><h3>Planlagte runder</h3></div><span class="v33-chip">${donePlans}/${ownPlans.length||0}</span></div><div class="v33-plan-body">${donut(rate)}<div><strong>${ownPlans.length-donePlans} gjenstår</strong><p>Planstatus for innlogget leder.</p></div></div></article><article class="card v33-chart-card"><div class="v33-card-head"><div><span class="eyebrow">Utvikling</span><h3>Funn over tid</h3></div><span class="v33-legend"><i class="imp"></i>Forbedring <i class="dev"></i>Avvik</span></div>${lineSvg(imp,dev,months.map(m=>m.label))}</article><article class="card v33-chart-card"><div class="v33-card-head"><div><span class="eyebrow">Fokus</span><h3>Funn per tema</h3></div></div><div class="v33-bars">${top.length?top.map(([n,c])=>`<button data-view="findings"><span>${esc(n)}</span><i><b style="width:${c/mx*100}%"></b></i><strong>${c}</strong></button>`).join(''):'<div class="v33-empty">Mer data trengs før vi kan vise mønster.</div>'}</div></article>`;
}

function bindDb(){if(dbBound||!window.firebase?.database)return;dbBound=true;const db=window.firebase.database();db.ref('lor/rounds').on('value',s=>{rounds=[];s.forEach(c=>rounds.push({id:c.key,...(c.val()||{})}));dashboardCharts();});db.ref('lor/plans').on('value',s=>{plans=[];s.forEach(c=>plans.push({id:c.key,...(c.val()||{})}));dashboardCharts();});}

document.addEventListener('click',e=>{
  const close=e.target.closest('[data-dialog-close],.dialog-close,.dialog-cancel');
  if(close){e.preventDefault();e.stopImmediatePropagation();close.closest('dialog')?.remove();return;}
  if(e.target.tagName==='DIALOG'){e.preventDefault();e.target.remove();}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('dialog').forEach(d=>d.remove());}},true);

function safeTick(){
  try{
    applyBrand();enhanceThemeBank();bindDb();dashboardCharts();
    lastTick='ok';
  }catch(err){
    if(lastTick!=='error')console.error('V3.3 enhancement error',err);
    lastTick='error';
  }
}
window.addEventListener('load',safeTick);
setTimeout(safeTick,250);
setInterval(safeTick,1200);
