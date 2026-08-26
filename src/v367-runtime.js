import { db, serverTimestamp } from './firebase.js';

let seedPlan=null,legacyHistory=[],livePlans=[],liveRounds=[];
let annualActive=false,annualDirty=true,activeYear=2026,pendingThemeFilter='';
const filters={status:'all',leader:'all',department:'all',theme:'all'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const first=s=>String(s||'').trim().split(/\s+/)[0].toLowerCase();
const resetFilters=()=>Object.keys(filters).forEach(k=>filters[k]='all');

function isoWeek(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return {year:d.getUTCFullYear(),week:Math.ceil((((d-y0)/86400000)+1)/7)};
}
function weekFromDate(value){return value?isoWeek(new Date(`${value}T12:00:00`)).week:null;}
function endOfWeek(year,week){const jan4=new Date(Date.UTC(year,0,4)),day=jan4.getUTCDay()||7,monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-day+1+(week-1)*7);const sun=new Date(monday);sun.setUTCDate(monday.getUTCDate()+6);sun.setUTCHours(23,59,59,999);return sun.getTime();}

function seedRows(year){
  if(!seedPlan||Number(seedPlan.year)!==Number(year))return[];
  return (seedPlan.records||[]).map((r,i)=>({
    id:`seed-${year}-${r.week}-${i}`,sourceSeedId:`seed-${year}-${r.week}-${i}`,source:'seed',year:Number(year),week:Number(r.week),
    leaderName:r.ownerName||'',theme:r.themeName||'',department:r.department||'',coLeaderName:'',plannedDate:'',needsReview:r.status==='needsReview'
  })).filter(r=>Number.isFinite(r.week)&&r.week>=1&&r.week<=53);
}
function liveRows(year){
  return livePlans.filter(r=>Number(r.year||2026)===Number(year)&&Number.isFinite(Number(r.week))).map(r=>({
    ...r,source:'live',year:Number(r.year||2026),week:Number(r.week),leaderName:r.leaderName||r.ownerName||'',theme:r.theme||r.themeName||'',department:r.department||'',coLeaderName:r.coLeaderName||'',plannedDate:r.plannedDate||''
  }));
}
function mergedRows(year=activeYear){
  const seeds=seedRows(year),live=liveRows(year),overrides=new Map(live.filter(r=>r.sourceSeedId).map(r=>[r.sourceSeedId,r]));
  const rows=seeds.map(s=>overrides.has(s.id)?{...s,...overrides.get(s.id),source:'live'}:s);
  live.filter(r=>!r.sourceSeedId||!seeds.some(s=>s.id===r.sourceSeedId)).forEach(r=>rows.push(r));
  return rows.filter(r=>!r.archived).sort((a,b)=>a.week-b.week||String(a.id).localeCompare(String(b.id)));
}
function completionFor(p){
  const live=liveRounds.find(r=>r.planId===p.id||(p.sourceSeedId&&r.planId===p.sourceSeedId)||(Number(r.planWeek)===Number(p.week)&&(!p.theme||r.theme===p.theme)&&(!p.department||r.department===p.department)&&(!p.leaderName||first(r.leaderName)===first(p.leaderName))));
  if(live)return {time:Number(live.completedAt||live.startedAt||0),source:'digital',round:live};
  if(Number(p.year)===2026){
    const old=legacyHistory.find(r=>Number(r.week)===Number(p.week)&&(!p.leaderName||first(r.leader)===first(p.leaderName)));
    if(old)return {time:old.date?new Date(`${old.date}T12:00:00`).getTime():0,source:'historikk',legacy:old};
  }
  return null;
}
function statusFor(p){
  const c=completionFor(p);
  if(c){const late=c.time&&c.time>endOfWeek(Number(p.year),Number(p.week));return {key:late?'late':'done',label:late?'Gjennomført for sent':'Gjennomført'};}
  const now=isoWeek(),y=Number(p.year),w=Number(p.week);
  if(y<now.year||(y===now.year&&w<now.week))return {key:'overdue',label:'Forfalt'};
  if(y===now.year&&w===now.week)return {key:'current',label:'Denne uken'};
  return {key:'planned',label:'Planlagt'};
}
function availableYears(){return [...new Set([2026,new Date().getFullYear(),...livePlans.map(x=>Number(x.year||2026)).filter(Boolean)])].sort((a,b)=>a-b);}
function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'nb'));}
function filtered(rows){return rows.filter(r=>{const st=statusFor(r).key;return (filters.status==='all'||st===filters.status)&&(filters.leader==='all'||r.leaderName===filters.leader)&&(filters.department==='all'||r.department===filters.department)&&(filters.theme==='all'||r.theme===filters.theme);});}
function stats(rows){const s={done:0,late:0,overdue:0,current:0,planned:0};rows.forEach(r=>s[statusFor(r).key]++);return s;}
function optionList(values,current,all){return `<option value="all">${all}</option>${values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}`;}

function ensureNav(){
  const nav=document.querySelector('.nav');if(!nav)return;
  const hist=nav.querySelector('[data-view="rounds"]');if(hist)hist.textContent='Historikk';
  let btn=nav.querySelector('[data-v367-annual]');
  if(!btn){btn=document.createElement('button');btn.type='button';btn.textContent='Årsplan';btn.dataset.v367Annual='1';const ref=[...nav.children].find(x=>x.dataset.view==='findings');nav.insertBefore(btn,ref||null);}
  btn.classList.toggle('active',annualActive);
  if(annualActive)nav.querySelectorAll('button:not([data-v367-annual])').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.v35-footerbtn[data-view="rounds"]').forEach(b=>b.textContent='Gå til historikk');
}
function rowHtml(r){const st=statusFor(r);return `<button type="button" class="v36-row ${st.key}" data-v367-edit="${esc(r.id)}"><strong>Uke ${r.week}</strong><span>${esc(r.leaderName||'Ikke fordelt')}</span><span>${esc(r.theme||'Tema mangler')}</span><span>${esc(r.department||'Avdeling mangler')}</span><span>${esc(r.coLeaderName||'—')}</span><em class="v36-status ${st.key}">${st.label}</em><b>→</b></button>`;}
function updateResults(){
  const all=mergedRows(activeYear),rows=filtered(all),list=document.querySelector('[data-v367-results]'),count=document.querySelector('[data-v367-count]');
  if(list)list.innerHTML=rows.map(rowHtml).join('')||'<div class="empty-state">Ingen runder matcher filtrene.</div>';
  if(count)count.innerHTML=`Viser <strong>${rows.length}</strong> av ${all.length} runder`;
}
function renderAnnual(force=false){
  if(!annualActive)return;
  const main=document.querySelector('main.main');if(!main)return;
  if(!force&&!annualDirty&&main.dataset.v367Annual==='1')return;
  const all=mergedRows(activeYear),rows=filtered(all),s=stats(all);
  main.className='main v367-annual-main';main.dataset.v367Annual='1';
  main.innerHTML=`<section class="v36-hero"><div><span class="eyebrow">Planlegging · ${activeYear}</span><h1>Årsplan</h1><p>Ukentlig plan for lederoppfølgingsrunder – ansvarlig, tema, avdeling og status.</p></div><div class="v36-year-actions"><select data-v367-year>${availableYears().map(y=>`<option value="${y}" ${y===activeYear?'selected':''}>${y}</option>`).join('')}</select><button class="secondary-action" data-v367-new-year>+ Nytt år</button><button class="primary-action" data-v367-new-plan>+ Planlegg runde</button></div></section><section class="v36-summary"><article><span>Gjennomført</span><strong>${s.done}</strong></article><article><span>Gjennomført sent</span><strong>${s.late}</strong></article><article class="danger"><span>Forfalt</span><strong>${s.overdue}</strong></article><article><span>Gjenstår</span><strong>${s.current+s.planned}</strong></article></section><section class="v367-filters"><label><span>Status</span><select data-v367-filter="status"><option value="all">Alle statuser</option><option value="overdue" ${filters.status==='overdue'?'selected':''}>Forfalt</option><option value="current" ${filters.status==='current'?'selected':''}>Denne uken</option><option value="planned" ${filters.status==='planned'?'selected':''}>Planlagt</option><option value="done" ${filters.status==='done'?'selected':''}>Gjennomført</option><option value="late" ${filters.status==='late'?'selected':''}>Gjennomført for sent</option></select></label><label><span>Ansvarlig</span><select data-v367-filter="leader">${optionList(unique(all,'leaderName'),filters.leader,'Alle ansvarlige')}</select></label><label><span>Avdeling</span><select data-v367-filter="department">${optionList(unique(all,'department'),filters.department,'Alle avdelinger')}</select></label><label><span>Tema</span><select data-v367-filter="theme">${optionList(unique(all,'theme'),filters.theme,'Alle temaer')}</select></label><button type="button" class="secondary-action" data-v367-reset>Nullstill filtre</button></section><div class="v367-resultbar"><span data-v367-count>Viser <strong>${rows.length}</strong> av ${all.length} runder</span>${Object.values(filters).some(v=>v!=='all')?'<button type="button" class="text-action" data-v367-reset>Vis alle runder</button>':''}</div><section class="card panel v36-plan"><div class="v36-head"><span>Uke</span><span>Ansvarlig</span><span>Tema</span><span>Avdeling</span><span>Medleder</span><span>Status</span><span></span></div><div data-v367-results>${rows.map(rowHtml).join('')||'<div class="empty-state">Ingen runder matcher filtrene.</div>'}</div></section>`;
  annualDirty=false;ensureNav();
}

function nextOverall(){
  const rows=mergedRows(new Date().getFullYear()).filter(r=>!completionFor(r));
  const now=isoWeek();
  return rows.sort((a,b)=>{const ac=Number(a.week)===now.week?0:Number(a.week)>now.week?1:2,bc=Number(b.week)===now.week?0:Number(b.week)>now.week?1:2;return ac-bc||Number(a.week)-Number(b.week);})[0]||null;
}
function patchNextTask(){
  const box=document.querySelector('#v35Dashboard .v35-next');if(!box)return;
  const n=nextOverall(),sig=n?`${n.id}|${n.week}|${n.theme}|${n.department}`:'none';if(box.dataset.v367Sig===sig)return;box.dataset.v367Sig=sig;
  box.innerHTML=n?`<span class="eyebrow">Neste oppgave</span><h2>Uke ${n.week} · ${esc(n.theme||'LOR')}</h2><p>${esc(n.department||'')} · ansvarlig ${esc(n.leaderName||'Ikke fordelt')}</p><button type="button" class="primary-action full-action" data-v367-start-plan="${esc(n.id)}">Start planlagt LOR →</button><div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`:`<span class="eyebrow">Neste oppgave</span><h2>Ingen planlagt runde</h2><p>Årsplanen har ingen åpne runder.</p>`;
}
function patchDashboard(){
  if(annualActive)return;
  const dash=document.querySelector('#v35Dashboard');if(!dash)return;
  patchNextTask();
  const year=new Date().getFullYear(),all=mergedRows(year),overdue=all.filter(r=>statusFor(r).key==='overdue'),upcoming=all.filter(r=>['current','planned'].includes(statusFor(r).key)).sort((a,b)=>a.week-b.week).slice(0,4);
  let sec=dash.querySelector('#v367AnnualDash');if(!sec){sec=document.createElement('section');sec.id='v367AnnualDash';sec.className='v367-dash';dash.prepend(sec);}
  const sig=JSON.stringify([overdue.map(r=>r.id),upcoming.map(r=>r.id)]);if(sec.dataset.sig===sig)return;sec.dataset.sig=sig;
  const oldest=overdue.slice(0,3);
  sec.innerHTML=`<div class="v367-dash-title"><div><span class="eyebrow">Årsplan ${year}</span><h2>Kommende runder</h2></div><button type="button" class="text-action" data-v367-annual>Åpne årsplan →</button></div><div class="v367-dash-grid">${overdue.length?`<button type="button" class="v367-overdue-card" data-v367-overdue><span>Forfalt</span><strong>${overdue.length}</strong><small>${oldest.map(r=>`Uke ${r.week} · ${esc(r.leaderName||'Ikke fordelt')}`).join(' · ')}</small><b>Se forfalte →</b></button>`:''}<div class="v367-upcoming-grid">${upcoming.map(r=>{const st=statusFor(r);return `<button type="button" data-v367-edit="${esc(r.id)}"><span>Uke ${r.week}</span><strong>${esc(r.theme||'Tema mangler')}</strong><small>${esc(r.department||'')} · ${esc(r.leaderName||'Ikke fordelt')}</small><em class="v36-status ${st.key}">${st.label}</em></button>`}).join('')||'<div class="empty-state">Ingen kommende runder.</div>'}</div></div>`;
}

function people(){return unique(mergedRows(activeYear),'leaderName');}
function dialog(row={}){
  const completion=completionFor(row),opts=(arr,val)=>`<option value="">Velg</option>${arr.map(x=>`<option value="${esc(x)}" ${x===val?'selected':''}>${esc(x)}</option>`).join('')}`;
  const dlg=document.createElement('dialog');dlg.open=true;dlg.className='lor-dialog v36-dialog v367-dialog';
  dlg.innerHTML=`<form data-v367-form data-id="${row.source==='live'?esc(row.id):''}" data-seed-id="${esc(row.sourceSeedId||'')}"><div class="dialog-head"><div><span class="eyebrow">Årsplan ${activeYear}</span><h2>${row.week?`Uke ${row.week} · ${esc(row.theme||'LOR')}`:'Planlegg runde'}</h2></div><button type="button" data-v367-close>×</button></div><div class="v36-form"><label>Uke<input name="week" type="number" min="1" max="53" required value="${row.week||''}"><small>Kan flyttes. Flere runder kan ligge i samme uke.</small></label><label>Planlagt dato<input name="plannedDate" type="date" value="${esc(row.plannedDate||'')}"></label><label>Ansvarlig<select name="leaderName" required>${opts(people(),row.leaderName)}</select></label><label>Tema<input name="theme" required value="${esc(row.theme||'')}"></label><label>Avdeling<select name="department" required>${opts(['Renhold','Ferdigmat','Rekvisita'],row.department)}</select></label><label>Inviter med / medleder<select name="coLeaderName">${opts(people().filter(x=>x!==row.leaderName),row.coLeaderName)}</select></label></div><section class="v367-completion"><div><span class="eyebrow">Gjennomføring</span><h3>${completion?'Registrert gjennomført':'Ikke registrert gjennomført'}</h3></div>${completion?`<p>${completion.time?new Date(completion.time).toLocaleDateString('nb-NO'):'Historisk registrering'} · ${completion.source==='historikk'?'importert historikk':'digital LOR'}</p>${completion.round?`<button type="button" class="secondary-action" data-v367-open-round="${esc(completion.round.id)}">Åpne gjennomført LOR →</button>`:''}`:`<label>Faktisk gjennomført dato<input type="date" name="completedDate" value="${new Date().toISOString().slice(0,10)}"></label><button type="button" class="secondary-action" data-v367-afterregister>Etterregistrer gjennomført</button><button type="button" class="primary-action" data-v367-start-from-dialog>Start denne LOR →</button>`}</section><div class="dialog-actions"><button type="button" class="secondary-action" data-v367-close>Avbryt</button><button class="primary-action">Lagre endringer</button></div></form>`;
  document.body.appendChild(dlg);
}
async function savePlan(form){
  const fd=new FormData(form),plannedDate=String(fd.get('plannedDate')||''),week=plannedDate?(weekFromDate(plannedDate)||Number(fd.get('week'))):Number(fd.get('week'));
  const existing=form.dataset.id||'',id=existing||db.ref('lor/plans').push().key,theme=String(fd.get('theme')||'');
  const data={year:activeYear,week,plannedDate,leaderName:String(fd.get('leaderName')||''),theme,themeName:theme,department:String(fd.get('department')||''),coLeaderName:String(fd.get('coLeaderName')||''),status:'planned',updatedAt:serverTimestamp()};
  if(!existing&&form.dataset.seedId)data.sourceSeedId=form.dataset.seedId;
  await db.ref(`lor/plans/${id}`).update(data);return {id,...data};
}
async function afterRegister(form){
  const plan=await savePlan(form),fd=new FormData(form),date=String(fd.get('completedDate')||'');if(!date)throw new Error('Velg gjennomført dato');
  const ts=new Date(`${date}T12:00:00`).getTime(),key=db.ref('lor/rounds').push().key,user=window.firebase?.auth?.().currentUser;
  await db.ref(`lor/rounds/${key}`).set({planId:plan.id,planWeek:plan.week,theme:plan.theme,department:plan.department,leaderUid:user?.uid||'afterregistered',leaderName:plan.leaderName||user?.email||'Etterregistrert',coLeaderName:plan.coLeaderName||'',status:'Gjennomført',startedAt:ts,completedAt:ts,updatedAt:serverTimestamp(),registeredAfterwards:true});
}
function resetAnnualUi(){resetFilters();document.querySelectorAll('[data-v367-filter]').forEach(s=>s.value='all');updateResults();}
function syncThemeFilter(){if(!pendingThemeFilter)return;const bank=document.querySelector('#v35ThemeBank');if(!bank)return;const btn=[...bank.querySelectorAll('[data-v35-theme-filter]')].find(b=>b.dataset.v35ThemeFilter===pendingThemeFilter);if(btn){btn.click();pendingThemeFilter='';}}
function sync(){
  ensureNav();
  if(annualActive){const main=document.querySelector('main.main');if(!main?.dataset.v367Annual||annualDirty)renderAnnual();}
  else patchDashboard();
  syncThemeFilter();
}

document.addEventListener('click',async ev=>{
  const annual=ev.target.closest('[data-v367-annual]');if(annual){ev.preventDefault();ev.stopImmediatePropagation();annualActive=true;resetFilters();annualDirty=true;renderAnnual(true);return;}
  const overdue=ev.target.closest('[data-v367-overdue]');if(overdue){ev.preventDefault();ev.stopImmediatePropagation();annualActive=true;resetFilters();filters.status='overdue';annualDirty=true;renderAnnual(true);return;}
  const normal=ev.target.closest('.nav [data-view]');if(normal){annualActive=false;resetFilters();return;}
  const edit=ev.target.closest('[data-v367-edit]');if(edit){const row=mergedRows(activeYear).find(r=>String(r.id)===String(edit.dataset.v367Edit));if(row)dialog(row);return;}
  const close=ev.target.closest('[data-v367-close]');if(close){close.closest('dialog')?.remove();return;}
  if(ev.target.closest('[data-v367-reset]')){resetAnnualUi();return;}
  if(ev.target.closest('[data-v367-new-plan]')){dialog({});return;}
  if(ev.target.closest('[data-v367-new-year]')){const y=Number(prompt('Hvilket år vil du opprette årsplan for?',String(Math.max(...availableYears())+1)));if(y>=2026&&y<=2100){activeYear=y;resetFilters();annualDirty=true;renderAnnual(true);}return;}
  const start=ev.target.closest('[data-v367-start-plan]');if(start){const row=mergedRows(new Date().getFullYear()).find(r=>String(r.id)===String(start.dataset.v367StartPlan));if(row){ev.preventDefault();ev.stopImmediatePropagation();annualActive=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:row}));}return;}
  const startDialog=ev.target.closest('[data-v367-start-from-dialog]');if(startDialog){const form=startDialog.closest('form');try{const plan=await savePlan(form);form.closest('dialog')?.remove();annualActive=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:plan}));}catch(err){alert('Kunne ikke starte planlagt runde.');}return;}
  const after=ev.target.closest('[data-v367-afterregister]');if(after){const form=after.closest('form');try{after.disabled=true;await afterRegister(form);form.closest('dialog')?.remove();annualDirty=true;renderAnnual(true);}catch(err){after.disabled=false;alert(err.message||'Kunne ikke etterregistrere runden.');}return;}
  const open=ev.target.closest('[data-v367-open-round]');if(open){ev.target.closest('dialog')?.remove();annualActive=false;window.dispatchEvent(new CustomEvent('lor:open-round',{detail:{id:open.dataset.v367OpenRound}}));return;}
  const theme=ev.target.closest('.v35-focusgrid button');if(theme){const label=theme.querySelector('strong')?.textContent?.trim()||'';pendingThemeFilter=label==='HMS'?'HMS & sikkerhet':label==='Orden'?'Orden & standard':label==='Rutiner'?'Rutiner & system':label==='Hygiene'?'Hygiene & renhold':label==='Kvalitet'?'Kvalitet':'';}
},true);

document.addEventListener('change',ev=>{
  if(ev.target.matches('[data-v367-year]')){activeYear=Number(ev.target.value);resetFilters();annualDirty=true;renderAnnual(true);return;}
  const filter=ev.target.closest('[data-v367-filter]');if(filter){filters[filter.dataset.v367Filter]=filter.value;updateResults();return;}
},true);

document.addEventListener('submit',async ev=>{
  if(!ev.target.matches('[data-v367-form]'))return;ev.preventDefault();
  try{await savePlan(ev.target);ev.target.closest('dialog')?.remove();annualDirty=true;renderAnnual(true);}catch(err){console.error(err);alert('Kunne ikke lagre årsplan.');}
},true);

const app=document.querySelector('#app');if(app)new MutationObserver(()=>queueMicrotask(sync)).observe(app,{childList:true,subtree:true});
Promise.all([fetch('./data/seed/plan-2026.json',{cache:'no-store'}).then(r=>r.json()),fetch('./data/seed/history-2026.json',{cache:'no-store'}).then(r=>r.json())]).then(([p,h])=>{seedPlan=p;legacyHistory=h.records||[];annualDirty=true;sync();});
db.ref('lor/plans').on('value',s=>{livePlans=[];s.forEach(c=>livePlans.push({id:c.key,...(c.val()||{})}));annualDirty=true;sync();});
db.ref('lor/rounds').on('value',s=>{liveRounds=[];s.forEach(c=>liveRounds.push({id:c.key,...(c.val()||{})}));annualDirty=true;sync();});
window.addEventListener('load',sync);setTimeout(sync,250);
