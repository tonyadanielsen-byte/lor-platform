import { db, serverTimestamp } from './firebase.js';

const BUILD='3.8.3';
let seedPlan=null,legacy2026=[],livePlans=[],liveRounds=[],annualMode=false,activeYear=2026,ready=false;
const filters={status:'all',leader:'all',department:'all',theme:'all'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const first=n=>String(n||'').trim().split(/\s+/)[0].toLocaleLowerCase('nb-NO');
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('nb-NO');
const resetFilters=()=>Object.keys(filters).forEach(k=>filters[k]='all');

function isoWeek(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return {year:d.getUTCFullYear(),week:Math.ceil((((d-y0)/86400000)+1)/7)};
}
function weekFromDate(value){return value?isoWeek(new Date(`${value}T12:00:00`)).week:null;}
function endOfIsoWeek(year,week){
  const jan4=new Date(Date.UTC(year,0,4)),day=jan4.getUTCDay()||7,monday=new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate()-day+1+(week-1)*7);
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);sunday.setUTCHours(23,59,59,999);return sunday.getTime();
}
function seedRows(year){
  if(!seedPlan||Number(seedPlan.year)!==Number(year))return[];
  return (seedPlan.records||[]).map((r,i)=>({
    id:`seed-${year}-${r.week}-${i}`,sourceSeedId:`seed-${year}-${r.week}-${i}`,year:Number(year),week:Number(r.week),
    leaderName:r.ownerName||'',ownerName:r.ownerName||'',theme:r.themeName||'',themeName:r.themeName||'',department:r.department||'',
    coLeaderName:'',plannedDate:'',source:'seed',needsReview:r.status==='needsReview'
  })).filter(r=>Number.isFinite(r.week)&&r.week>=1&&r.week<=53&&r.theme);
}
function liveRows(year){
  return livePlans.filter(r=>Number(r.year||2026)===Number(year)&&Number.isFinite(Number(r.week))).map(r=>({
    ...r,year:Number(r.year||year),week:Number(r.week),leaderName:r.leaderName||r.ownerName||'',ownerName:r.leaderName||r.ownerName||'',
    theme:r.theme||r.themeName||'',themeName:r.theme||r.themeName||'',department:r.department||'',coLeaderName:r.coLeaderName||'',
    plannedDate:r.plannedDate||'',source:'live'
  }));
}
function newestBySeed(live){
  const map=new Map();
  for(const row of live.filter(r=>r.sourceSeedId)){
    const old=map.get(row.sourceSeedId);
    const a=Number(row.updatedAt||row.completedAt||0),b=Number(old?.updatedAt||old?.completedAt||0);
    if(!old||a>b||(a===b&&String(row.id)>String(old.id)))map.set(row.sourceSeedId,row);
  }
  return map;
}
function mergedRows(year=activeYear){
  const seeds=seedRows(year),live=liveRows(year),latest=newestBySeed(live);
  const rows=seeds.map(seed=>latest.has(seed.id)?{...seed,...latest.get(seed.id),source:'live'}:seed);
  live.filter(r=>!r.sourceSeedId||!seeds.some(s=>s.id===r.sourceSeedId)).forEach(r=>rows.push(r));
  return rows.filter(r=>!r.archived&&r.theme).sort((a,b)=>a.week-b.week||String(a.id).localeCompare(String(b.id)));
}
function roundFor(plan){
  if(plan.completedRoundId){const exact=liveRounds.find(r=>String(r.id)===String(plan.completedRoundId));if(exact)return exact;}
  return liveRounds.find(r=>
    String(r.planId||'')===String(plan.id||'')||
    (!!plan.sourceSeedId&&String(r.sourceSeedId||'')===String(plan.sourceSeedId))||
    (!!plan.sourceSeedId&&String(r.planId||'')===String(plan.sourceSeedId))||
    (Number(r.planWeek)===Number(plan.week)&&(!plan.theme||norm(r.theme)===norm(plan.theme))&&(!plan.department||norm(r.department)===norm(plan.department))&&(!plan.leaderName||first(r.leaderName)===first(plan.leaderName)))
  )||null;
}
function completedFor(plan){
  const round=roundFor(plan);
  if(round)return {time:Number(round.completedAt||round.startedAt||plan.completedAt||0),source:'digital',round};
  if(String(plan.status||'').toLowerCase()==='completed'||Number(plan.completedAt)>0){
    return {time:Number(plan.completedAt||0),source:'plan',round:null};
  }
  if(Number(plan.year)===2026){
    const old=legacy2026.find(r=>Number(r.week)===Number(plan.week)&&(!plan.leaderName||first(r.leader)===first(plan.leaderName))&&r.date);
    if(old)return {time:new Date(`${old.date}T12:00:00`).getTime(),source:'historikk',round:null};
  }
  return null;
}
function statusFor(plan){
  const c=completedFor(plan);
  if(c){const late=c.time&&c.time>endOfIsoWeek(Number(plan.year),Number(plan.week));return{key:late?'late':'done',label:late?'Gjennomført for sent':'Gjennomført'};}
  const now=isoWeek(),y=Number(plan.year),w=Number(plan.week);
  if(y<now.year||(y===now.year&&w<now.week))return{key:'overdue',label:'Forfalt'};
  if(y===now.year&&w===now.week)return{key:'current',label:'Denne uken'};
  return{key:'planned',label:'Planlagt'};
}
function years(){return[...new Set([2026,new Date().getFullYear(),...livePlans.map(x=>Number(x.year||2026)).filter(Boolean)])].sort((a,b)=>a-b);}
function unique(rows,key){return[...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'nb'));}
function filteredRows(rows){return rows.filter(r=>{const st=statusFor(r).key;return(filters.status==='all'||st===filters.status)&&(filters.leader==='all'||r.leaderName===filters.leader)&&(filters.department==='all'||r.department===filters.department)&&(filters.theme==='all'||r.theme===filters.theme);});}
function stats(rows){const out={done:0,late:0,overdue:0,current:0,planned:0};rows.forEach(r=>out[statusFor(r).key]++);return out;}
function opt(values,current,label){return`<option value="all">${label}</option>${values.map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('')}`;}

function ensureNav(){
  const nav=document.querySelector('.nav');if(!nav)return;
  const hist=nav.querySelector('[data-view="rounds"]');if(hist)hist.textContent='Historikk';
  let btn=nav.querySelector('[data-v363-annual]');
  if(!btn){btn=document.createElement('button');btn.textContent='Årsplan';btn.dataset.v363Annual='1';const ref=[...nav.children].find(x=>x.dataset.view==='findings');nav.insertBefore(btn,ref||null);}
  btn.classList.toggle('active',annualMode);
  if(annualMode)nav.querySelectorAll('button:not([data-v363-annual])').forEach(b=>b.classList.remove('active'));
}
function rowsHtml(rows){
  return`<div class="v36-head"><span>Uke</span><span>Ansvarlig</span><span>Tema</span><span>Avdeling</span><span>Medleder</span><span>Status</span><span></span></div>${rows.map(r=>{const st=statusFor(r);return`<button class="v36-row ${st.key}" data-v363-edit="${esc(r.id)}"><strong>Uke ${r.week}</strong><span>${esc(r.leaderName||'Ikke fordelt')}</span><span>${esc(r.theme||'Tema mangler')}</span><span>${esc(r.department||'Avdeling mangler')}</span><span>${esc(r.coLeaderName||'—')}</span><em class="v36-status ${st.key}">${st.label}</em><b>→</b></button>`}).join('')||'<div class="empty-state">Ingen runder matcher filteret.</div>'}`;
}
function updateFilteredRows(){
  const all=mergedRows(activeYear),rows=filteredRows(all),plan=document.querySelector('.v36-plan'),count=document.querySelector('.v363-result-count');
  if(plan)plan.innerHTML=rowsHtml(rows);if(count)count.innerHTML=`Viser <strong>${rows.length}</strong> av ${all.length} runder`;
}
function renderAnnual(){
  if(!annualMode||!ready)return;
  const main=document.querySelector('main.main');if(!main)return;
  ensureNav();const all=mergedRows(activeYear),rows=filteredRows(all),s=stats(all);
  main.className='main v363-annual-main';
  main.innerHTML=`<section class="v36-hero"><div><span class="eyebrow">Planlegging · ${activeYear}</span><h1>Årsplan</h1><p>Ukentlig plan for lederoppfølgingsrunder – ansvarlig, tema, avdeling og status.</p></div><div class="v36-year-actions"><select data-v363-year>${years().map(y=>`<option ${y===activeYear?'selected':''}>${y}</option>`).join('')}</select><button class="secondary-action" data-v363-new-year>+ Nytt år</button><button class="primary-action" data-v363-new-plan>+ Planlegg runde</button></div></section><section class="v36-summary"><article><span>Gjennomført</span><strong>${s.done}</strong></article><article><span>Gjennomført sent</span><strong>${s.late}</strong></article><article class="danger"><span>Forfalt</span><strong>${s.overdue}</strong></article><article><span>Gjenstår</span><strong>${s.current+s.planned}</strong></article></section><section class="v363-filters"><label><span>Status</span><select data-v363-filter="status"><option value="all">Alle statuser</option><option value="overdue" ${filters.status==='overdue'?'selected':''}>Forfalt</option><option value="current" ${filters.status==='current'?'selected':''}>Denne uken</option><option value="planned" ${filters.status==='planned'?'selected':''}>Planlagt</option><option value="done" ${filters.status==='done'?'selected':''}>Gjennomført</option><option value="late" ${filters.status==='late'?'selected':''}>Gjennomført for sent</option></select></label><label><span>Ansvarlig</span><select data-v363-filter="leader">${opt(unique(all,'leaderName'),filters.leader,'Alle ansvarlige')}</select></label><label><span>Avdeling</span><select data-v363-filter="department">${opt(unique(all,'department'),filters.department,'Alle avdelinger')}</select></label><label><span>Tema</span><select data-v363-filter="theme">${opt(unique(all,'theme'),filters.theme,'Alle temaer')}</select></label><button class="secondary-action" data-v363-reset-filter>Nullstill filtre</button></section><div class="v363-result-count">Viser <strong>${rows.length}</strong> av ${all.length} runder</div><section class="card panel v36-plan">${rowsHtml(rows)}</section>`;
  document.body.classList.remove('v363-view-loading');
}

function planData(){
  const now=isoWeek(),rows=mergedRows(now.year),overdue=rows.filter(r=>statusFor(r).key==='overdue'),open=rows.filter(r=>!completedFor(r));
  const next=open.find(r=>Number(r.week)>=now.week)||open[0]||null;
  const upcoming=open.filter(r=>Number(r.week)>=now.week).sort((a,b)=>a.week-b.week).slice(0,4);
  return{now,rows,overdue,next,upcoming};
}
function renderDashboardPlan(){
  if(annualMode||!ready)return;
  const dash=document.querySelector('#v35Dashboard');if(!dash)return;
  const {now,overdue,next,upcoming}=planData();
  let bar=dash.querySelector('#v370PlanOverview');
  if(!bar){bar=document.createElement('section');bar.id='v370PlanOverview';bar.className='v370-plan-overview';dash.prepend(bar);}
  bar.innerHTML=`<div class="v370-plan-head"><div><span class="eyebrow">Årsplan ${now.year}</span><strong>Uke ${now.week}</strong></div><button class="text-action" data-v363-annual>Åpne årsplan →</button></div><div class="v370-plan-grid"><button class="v370-plan-card overdue" data-v363-status-jump="overdue"><small>Forfalte</small><strong>${overdue.length}</strong><span>${overdue.length?'Krever avklaring / etterregistrering':'Ingen forfalte runder'}</span>${overdue.length?'<em>Se runder →</em>':''}</button>${upcoming.map(r=>{const st=statusFor(r);return`<button class="v370-plan-card ${st.key}" data-v363-edit="${esc(r.id)}"><small>${st.key==='current'?'Denne uken':'Kommende'}</small><strong>Uke ${r.week} · ${esc(r.theme)}</strong><span>${esc(r.department)} · ${esc(r.leaderName||'Ikke fordelt')}</span></button>`}).join('')}</div>`;
  const card=dash.querySelector('.v35-next');
  if(card){
    if(next){card.dataset.v370Plan=next.id;card.innerHTML=`<span class="eyebrow">Neste oppgave</span><h2>Uke ${next.week} · ${esc(next.theme)}</h2><p>${esc(next.department)} · planlagt for ${esc(next.leaderName||'Ikke fordelt')}</p><button class="primary-action full-action" data-v383-start-id="${esc(next.id)}">Start planlagt LOR →</button><div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`;}
    else{card.dataset.v370Plan='none';card.innerHTML='<span class="eyebrow">Neste oppgave</span><h2>Ingen planlagt runde</h2><p>Årsplanen har ingen åpne runder.</p>';}
  }
  dash.classList.add('v371-ready');
}

function dialog(row={}){
  const people=unique(mergedRows(activeYear),'leaderName'),completion=completedFor(row),opts=(arr,val)=>`<option value="">Velg</option>${arr.map(x=>`<option ${x===val?'selected':''}>${esc(x)}</option>`).join('')}`;
  const dlg=document.createElement('dialog');dlg.open=true;dlg.className='lor-dialog v36-dialog v363-dialog';
  dlg.innerHTML=`<form data-v363-form data-id="${esc(row.source==='live'?row.id:'')}" data-seed-id="${esc(row.sourceSeedId||'')}"><div class="dialog-head"><div><span class="eyebrow">Årsplan ${activeYear}</span><h2>${row.week?`Uke ${row.week} · ${esc(row.theme||'LOR')}`:'Planlegg runde'}</h2></div><button type="button" data-v363-close>×</button></div><div class="v36-form"><label>Uke<input name="week" type="number" min="1" max="53" required value="${row.week||''}"></label><label>Planlagt dato<input name="plannedDate" type="date" value="${esc(row.plannedDate||'')}"></label><label>Ansvarlig<select name="leaderName" required>${opts(people,row.leaderName)}</select></label><label>Tema<input name="theme" required value="${esc(row.theme||'')}"></label><label>Avdeling<select name="department" required>${opts(['Renhold','Ferdigmat','Rekvisita'],row.department)}</select></label><label>Inviter med / medleder<select name="coLeaderName">${opts(people.filter(x=>x!==row.leaderName),row.coLeaderName)}</select></label></div><section class="v363-completion"><div><span class="eyebrow">Gjennomføring</span><h3>${completion?'Runden er registrert gjennomført':'Ikke registrert gjennomført'}</h3></div>${completion?`<p>${completion.time?new Date(completion.time).toLocaleDateString('nb-NO'):'Registrert gjennomført'} · ${completion.source==='historikk'?'importert historikk':'LOR'}</p>${completion.round?`<button type="button" class="secondary-action" data-v363-open-round="${esc(completion.round.id)}">Åpne gjennomført LOR →</button>`:''}`:`<label>Faktisk gjennomført dato<input type="date" name="completedDate" value="${new Date().toISOString().slice(0,10)}"></label><button type="button" class="secondary-action" data-v363-afterregister>Etterregistrer gjennomført</button><button type="button" class="primary-action" data-v363-start>Start denne LOR →</button>`}</section><div class="dialog-actions"><button type="button" class="secondary-action" data-v363-close>Avbryt</button><button class="primary-action">Lagre endringer</button></div></form>`;
  document.body.appendChild(dlg);
}
function formValues(form){
  const fd=new FormData(form),plannedDate=String(fd.get('plannedDate')||''),rawWeek=Number(fd.get('week'));
  return{year:activeYear,week:plannedDate?(weekFromDate(plannedDate)||rawWeek):rawWeek,plannedDate,leaderName:String(fd.get('leaderName')||'').trim(),theme:String(fd.get('theme')||'').trim(),department:String(fd.get('department')||'').trim(),coLeaderName:String(fd.get('coLeaderName')||'').trim(),completedDate:String(fd.get('completedDate')||'').trim()};
}
async function resolvePlan(form){
  const direct=String(form.dataset.id||'').trim(),seedId=String(form.dataset.seedId||'').trim();
  if(direct)return{id:direct,seedId};
  if(seedId){
    const matches=livePlans.filter(p=>String(p.sourceSeedId||'')===seedId).sort((a,b)=>Number(b.updatedAt||b.completedAt||0)-Number(a.updatedAt||a.completedAt||0)||String(b.id).localeCompare(String(a.id)));
    if(matches[0])return{id:matches[0].id,seedId};
  }
  return{id:db.ref('lor/plans').push().key,seedId};
}
async function savePlan(form){
  const v=formValues(form),resolved=await resolvePlan(form),now=serverTimestamp();
  const existing=livePlans.find(p=>p.id===resolved.id)||{};
  const data={...existing,year:v.year,week:v.week,plannedDate:v.plannedDate,leaderName:v.leaderName,ownerName:v.leaderName,theme:v.theme,themeName:v.theme,department:v.department,coLeaderName:v.coLeaderName,status:existing.status==='completed'?'completed':'planned',updatedAt:now};
  if(resolved.seedId)data.sourceSeedId=resolved.seedId;
  delete data.id;
  await db.ref(`lor/plans/${resolved.id}`).set(data);return{id:resolved.id,...data};
}
async function afterRegister(form){
  if(!form.reportValidity())throw new Error('Fyll ut obligatoriske felt først.');
  const v=formValues(form);if(!v.completedDate)throw new Error('Velg faktisk gjennomført dato.');
  const completedAt=new Date(`${v.completedDate}T12:00:00`).getTime();if(!Number.isFinite(completedAt))throw new Error('Ugyldig dato.');
  const resolved=await resolvePlan(form),roundId=db.ref('lor/rounds').push().key,user=window.firebase?.auth?.().currentUser,now=Date.now();
  const plan={year:v.year,week:v.week,plannedDate:v.plannedDate,leaderName:v.leaderName,ownerName:v.leaderName,theme:v.theme,themeName:v.theme,department:v.department,coLeaderName:v.coLeaderName,status:'completed',completedAt,completedRoundId:roundId,updatedAt:now};
  if(resolved.seedId)plan.sourceSeedId=resolved.seedId;
  const round={planId:resolved.id,sourceSeedId:resolved.seedId||'',planWeek:v.week,planYear:v.year,theme:v.theme,themeName:v.theme,department:v.department,leaderUid:user?.uid||'afterregistered',leaderName:v.leaderName,coLeaderName:v.coLeaderName,status:'Gjennomført',startedAt:completedAt,completedAt,updatedAt:now,registeredAfterwards:true,themeVersion:1,responses:{},employeeInterviews:{},summary:{note:'Etterregistrert fra årsplan',counts:{ok:0,improvement:0,deviation:0,followUp:0}}};
  await db.ref().update({[`lor/plans/${resolved.id}`]:plan,[`lor/rounds/${roundId}`]:round});
  const [ps,rs]=await Promise.all([db.ref(`lor/plans/${resolved.id}`).once('value'),db.ref(`lor/rounds/${roundId}`).once('value')]);
  if(!ps.exists()||!rs.exists()||String(ps.val()?.status)!=='completed')throw new Error('Firebase bekreftet ikke etterregistreringen.');
  return{planId:resolved.id,roundId,week:v.week};
}
function notify(msg,error=false){const t=document.querySelector('#toast');if(t){t.textContent=msg;t.classList.toggle('error',error);t.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('show'),4500);}if(error)alert(msg);}
function sync(){if(!ready)return;ensureNav();if(annualMode)renderAnnual();else renderDashboardPlan();document.body.classList.remove('v363-view-loading');}

let afterBusy=false;
document.addEventListener('click',async ev=>{
  const jump=ev.target.closest('[data-v363-status-jump]');if(jump){ev.preventDefault();ev.stopImmediatePropagation();resetFilters();filters.status=jump.dataset.v363StatusJump;annualMode=true;renderAnnual();return;}
  const annual=ev.target.closest('[data-v363-annual]');if(annual){ev.preventDefault();ev.stopImmediatePropagation();resetFilters();annualMode=true;renderAnnual();return;}
  const normal=ev.target.closest('.nav [data-view]');if(normal){annualMode=false;resetFilters();return;}
  const close=ev.target.closest('[data-v363-close]');if(close){close.closest('dialog')?.remove();return;}
  const edit=ev.target.closest('[data-v363-edit]');if(edit){const row=mergedRows(activeYear).find(r=>String(r.id)===String(edit.dataset.v363Edit));if(row)dialog(row);return;}
  if(ev.target.closest('[data-v363-new-plan]')){dialog({});return;}
  if(ev.target.closest('[data-v363-new-year]')){const y=Number(prompt('Hvilket år vil du opprette årsplan for?',String(Math.max(...years())+1)));if(y>=2026&&y<=2100){activeYear=y;resetFilters();renderAnnual();}return;}
  if(ev.target.closest('[data-v363-reset-filter]')){resetFilters();renderAnnual();return;}
  const startId=ev.target.closest('[data-v383-start-id]');if(startId){const plan=mergedRows(new Date().getFullYear()).find(r=>String(r.id)===String(startId.dataset.v383StartId));if(plan){annualMode=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:plan}));}return;}
  const after=ev.target.closest('[data-v363-afterregister]');if(after){
    ev.preventDefault();ev.stopImmediatePropagation();if(afterBusy)return;afterBusy=true;
    const form=after.closest('form[data-v363-form]');try{after.disabled=true;after.textContent='Etterregistrerer…';const r=await afterRegister(form);form.closest('dialog')?.remove();notify(`Uke ${r.week} er etterregistrert ✓`);setTimeout(sync,50);}catch(err){console.error(`[LOR ${BUILD}]`,err);after.disabled=false;after.textContent='Etterregistrer gjennomført';notify(err.message||'Etterregistrering feilet.',true);}finally{afterBusy=false;}return;
  }
  const start=ev.target.closest('[data-v363-start]');if(start){try{const plan=await savePlan(start.closest('form'));start.closest('dialog')?.remove();annualMode=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:plan}));}catch(err){notify('Kunne ikke starte runden.',true);}return;}
  const open=ev.target.closest('[data-v363-open-round]');if(open){open.closest('dialog')?.remove();annualMode=false;window.dispatchEvent(new CustomEvent('lor:open-round',{detail:{id:open.dataset.v363OpenRound}}));return;}
},true);
document.addEventListener('change',ev=>{if(ev.target.matches('[data-v363-year]')){activeYear=Number(ev.target.value);resetFilters();renderAnnual();return;}const f=ev.target.closest('[data-v363-filter]');if(f){filters[f.dataset.v363Filter]=f.value;updateFilteredRows();}},true);
document.addEventListener('submit',async ev=>{if(!ev.target.matches('[data-v363-form]'))return;ev.preventDefault();try{await savePlan(ev.target);ev.target.closest('dialog')?.remove();sync();}catch(err){console.error(err);notify('Kunne ikke lagre årsplan.',true);}},true);

const app=document.querySelector('#app');if(app)new MutationObserver(()=>setTimeout(sync,0)).observe(app,{childList:true,subtree:false});
Promise.all([fetch('./data/seed/plan-2026.json',{cache:'no-store'}).then(r=>r.json()),fetch('./data/seed/history-2026.json',{cache:'no-store'}).then(r=>r.json())]).then(([p,h])=>{seedPlan=p;legacy2026=h.records||[];ready=true;sync();}).catch(()=>{ready=true;sync();});
db.ref('lor/plans').on('value',s=>{livePlans=[];s.forEach(c=>livePlans.push({id:c.key,...(c.val()||{})}));sync();});
db.ref('lor/rounds').on('value',s=>{liveRounds=[];s.forEach(c=>liveRounds.push({id:c.key,...(c.val()||{})}));sync();});
window.addEventListener('load',sync);setTimeout(sync,250);
document.documentElement.dataset.planEngine=BUILD;
