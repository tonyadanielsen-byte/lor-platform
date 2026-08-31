import { db, serverTimestamp } from './firebase.js';

const BUILD='3.8.4';
const LOGO='./lor-shield-v384.svg';
let seedPlan=null,legacy2026=[],livePlans=[],liveRounds=[],participants=[],annualMode=false,activeYear=2026,ready=false,afterBusy=false;
const filters={status:'all',leader:'all',department:'all',theme:'all'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('nb-NO');
const first=s=>norm(s).split(/\s+/)[0]||'';
const resetFilters=()=>Object.keys(filters).forEach(k=>filters[k]='all');

function applyIdentity(){
  document.querySelectorAll('.brand-logo,.login-opex-logo').forEach(img=>{
    if(img.getAttribute('src')!==LOGO){img.setAttribute('src',LOGO);img.setAttribute('alt','OpEx LOR');}
  });
}

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
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);sunday.setUTCHours(23,59,59,999);
  return sunday.getTime();
}
const stamp=p=>Number(p?.updatedAt||p?.completedAt||p?.createdAt||0);

function seedRows(year){
  if(!seedPlan||Number(seedPlan.year)!==Number(year))return[];
  return (seedPlan.records||[]).map((r,i)=>({
    id:`seed-${year}-${r.week}-${i}`,sourceSeedId:`seed-${year}-${r.week}-${i}`,year:Number(year),week:Number(r.week),
    leaderName:r.ownerName||'',ownerName:r.ownerName||'',theme:r.themeName||'',themeName:r.themeName||'',department:r.department||'',
    coLeaderName:'',plannedDate:'',source:'seed',needsReview:r.status==='needsReview',status:r.status||'planned'
  })).filter(r=>Number.isFinite(r.week)&&r.week>=1&&r.week<=53);
}
function liveRows(year){
  return livePlans.filter(r=>Number(r.year||2026)===Number(year)&&Number.isFinite(Number(r.week))).map(r=>({
    ...r,year:Number(r.year||year),week:Number(r.week),leaderName:r.leaderName||r.ownerName||'',ownerName:r.leaderName||r.ownerName||'',
    theme:r.theme||r.themeName||'',themeName:r.theme||r.themeName||'',department:r.department||'',coLeaderName:r.coLeaderName||'',
    plannedDate:r.plannedDate||'',source:'live'
  }));
}
function chooseGroup(base,group){
  if(!group.length)return {...base,_aliases:[base.id]};
  const latest=[...group].sort((a,b)=>stamp(b)-stamp(a)||String(b.id).localeCompare(String(a.id)))[0];
  const completed=[...group].filter(p=>String(p.status||'').toLowerCase()==='completed'||Number(p.completedAt)>0)
    .sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)||stamp(b)-stamp(a))[0];
  const row={...base,...latest,source:'live',_aliases:[base.id,...group.map(x=>x.id)]};
  if(completed){
    row.status='completed';
    row.completedAt=Number(completed.completedAt||row.completedAt||0);
    row.completedRoundId=completed.completedRoundId||row.completedRoundId||'';
  }
  return row;
}
function mergedRows(year=activeYear){
  const seeds=seedRows(year),live=liveRows(year),seedIds=new Set(seeds.map(s=>s.id)),bySeed=new Map(),standalone=[];
  for(const row of live){
    if(row.sourceSeedId){
      if(!bySeed.has(row.sourceSeedId))bySeed.set(row.sourceSeedId,[]);
      bySeed.get(row.sourceSeedId).push(row);
    }else standalone.push({...row,_aliases:[row.id]});
  }
  const rows=seeds.map(seed=>chooseGroup(seed,bySeed.get(seed.id)||[]));
  for(const [seedId,group] of bySeed.entries()){
    if(seedIds.has(seedId))continue;
    const base={...group[0],id:group[0].id,sourceSeedId:seedId};
    rows.push(chooseGroup(base,group));
  }
  rows.push(...standalone);
  return rows.filter(r=>!r.archived).sort((a,b)=>a.week-b.week||String(a.id).localeCompare(String(b.id)));
}
function roundFor(plan){
  const aliases=new Set([String(plan.id||''),String(plan.sourceSeedId||''),...(plan._aliases||[]).map(String)].filter(Boolean));
  if(plan.completedRoundId){
    const exact=liveRounds.find(r=>String(r.id)===String(plan.completedRoundId));
    if(exact)return exact;
  }
  const direct=liveRounds.find(r=>aliases.has(String(r.planId||''))||aliases.has(String(r.sourceSeedId||'')));
  if(direct)return direct;
  const year=Number(plan.year||2026),week=Number(plan.week),theme=norm(plan.theme);
  return liveRounds.find(r=>{
    const time=Number(r.completedAt||r.startedAt||0),ry=Number(r.planYear||(time?new Date(time).getFullYear():year));
    if(ry!==year||Number(r.planWeek)!==week)return false;
    if(theme&&norm(r.theme)!==theme)return false;
    return !!r.registeredAfterwards;
  })||liveRounds.find(r=>
    Number(r.planWeek)===week &&
    (!theme||norm(r.theme)===theme) &&
    (!plan.department||norm(r.department)===norm(plan.department)) &&
    (!plan.leaderName||first(r.leaderName)===first(plan.leaderName))
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
  if(c){
    const late=c.time&&c.time>endOfIsoWeek(Number(plan.year),Number(plan.week));
    return {key:late?'late':'done',label:late?'Gjennomført for sent':'Gjennomført'};
  }
  const now=isoWeek(),y=Number(plan.year),w=Number(plan.week);
  if(y<now.year||(y===now.year&&w<now.week))return {key:'overdue',label:'Forfalt'};
  if(y===now.year&&w===now.week)return {key:'current',label:'Denne uken'};
  return {key:'planned',label:'Planlagt'};
}
function years(){return [...new Set([2026,new Date().getFullYear(),...livePlans.map(x=>Number(x.year||2026)).filter(Boolean)])].sort((a,b)=>a-b);}
function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'nb'));}
function filteredRows(rows){return rows.filter(r=>{const st=statusFor(r).key;return(filters.status==='all'||st===filters.status)&&(filters.leader==='all'||r.leaderName===filters.leader)&&(filters.department==='all'||r.department===filters.department)&&(filters.theme==='all'||r.theme===filters.theme);});}
function stats(rows){const out={done:0,late:0,overdue:0,current:0,planned:0};rows.forEach(r=>out[statusFor(r).key]++);return out;}
function opt(values,current,label){return `<option value="all">${label}</option>${values.map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('')}`;}

function ensureNav(){
  const nav=document.querySelector('.nav');if(!nav)return;
  const hist=nav.querySelector('[data-view="rounds"]');if(hist)hist.textContent='Historikk';
  let btn=nav.querySelector('[data-v384-annual]');
  if(!btn){btn=document.createElement('button');btn.textContent='Årsplan';btn.dataset.v384Annual='1';const ref=[...nav.children].find(x=>x.dataset.view==='findings');nav.insertBefore(btn,ref||null);}
  btn.classList.toggle('active',annualMode);
  if(annualMode)nav.querySelectorAll('button:not([data-v384-annual])').forEach(b=>b.classList.remove('active'));
}
function rowsHtml(rows){
  return `<div class="v36-head"><span>Uke</span><span>Ansvarlig</span><span>Tema</span><span>Avdeling</span><span>Deltaker</span><span>Status</span><span></span></div>${rows.map(r=>{
    const st=statusFor(r);return `<button class="v36-row ${st.key}" data-v384-edit="${esc(r.id)}"><strong>Uke ${r.week}</strong><span>${esc(r.leaderName||'Ikke fordelt')}</span><span>${esc(r.theme||'Tema mangler')}</span><span>${esc(r.department||'Avdeling mangler')}</span><span>${esc(r.coLeaderName||'—')}</span><em class="v36-status ${st.key}">${st.label}</em><b>→</b></button>`;
  }).join('')||'<div class="empty-state">Ingen runder matcher filteret.</div>'}`;
}
function updateFilteredRows(){
  const all=mergedRows(activeYear),rows=filteredRows(all),plan=document.querySelector('.v36-plan'),count=document.querySelector('.v384-result-count');
  if(plan)plan.innerHTML=rowsHtml(rows);
  if(count)count.innerHTML=`Viser <strong>${rows.length}</strong> av ${all.length} runder`;
}
function renderAnnual(){
  if(!annualMode||!ready)return;
  const main=document.querySelector('main.main');if(!main)return;
  ensureNav();
  const all=mergedRows(activeYear),rows=filteredRows(all),s=stats(all);
  main.className='main v363-annual-main v370-annual-main';
  main.innerHTML=`<section class="v36-hero"><div><span class="eyebrow">Planlegging · ${activeYear}</span><h1>Årsplan</h1><p>Ukentlig plan for lederoppfølgingsrunder – ansvarlig, tema, avdeling og status.</p></div><div class="v36-year-actions"><select data-v384-year>${years().map(y=>`<option ${y===activeYear?'selected':''}>${y}</option>`).join('')}</select><button class="secondary-action" data-v384-new-year>+ Nytt år</button><button class="primary-action" data-v384-new-plan>+ Planlegg runde</button></div></section><section class="v36-summary"><article><span>Gjennomført</span><strong>${s.done}</strong></article><article><span>Gjennomført sent</span><strong>${s.late}</strong></article><article class="danger"><span>Forfalt</span><strong>${s.overdue}</strong></article><article><span>Gjenstår</span><strong>${s.current+s.planned}</strong></article></section><section class="v363-filters"><label><span>Status</span><select data-v384-filter="status"><option value="all">Alle statuser</option><option value="overdue" ${filters.status==='overdue'?'selected':''}>Forfalt</option><option value="current" ${filters.status==='current'?'selected':''}>Denne uken</option><option value="planned" ${filters.status==='planned'?'selected':''}>Planlagt</option><option value="done" ${filters.status==='done'?'selected':''}>Gjennomført</option><option value="late" ${filters.status==='late'?'selected':''}>Gjennomført for sent</option></select></label><label><span>Ansvarlig</span><select data-v384-filter="leader">${opt(unique(all,'leaderName'),filters.leader,'Alle ansvarlige')}</select></label><label><span>Avdeling</span><select data-v384-filter="department">${opt(unique(all,'department'),filters.department,'Alle avdelinger')}</select></label><label><span>Tema</span><select data-v384-filter="theme">${opt(unique(all,'theme'),filters.theme,'Alle temaer')}</select></label><button class="secondary-action" data-v384-reset-filter>Nullstill filtre</button></section><div class="v384-result-count">Viser <strong>${rows.length}</strong> av ${all.length} runder</div><section class="card panel v36-plan v370-annual-plan">${rowsHtml(rows)}</section>`;
  document.body.classList.remove('v363-view-loading');
}
function planData(){
  const now=isoWeek(),rows=mergedRows(now.year),overdue=rows.filter(r=>statusFor(r).key==='overdue'),open=rows.filter(r=>!completedFor(r));
  const next=open.find(r=>Number(r.week)>=now.week)||open[0]||null;
  const upcoming=open.filter(r=>Number(r.week)>=now.week).sort((a,b)=>a.week-b.week).slice(0,4);
  return {now,rows,overdue,next,upcoming};
}
function renderDashboardPlan(){
  if(annualMode||!ready)return;
  const dash=document.querySelector('#v35Dashboard');if(!dash)return;
  dash.querySelectorAll('#v363AnnualDash').forEach(x=>x.remove());
  const {now,overdue,next,upcoming}=planData();
  let bar=dash.querySelector('#v370PlanOverview');
  if(!bar){bar=document.createElement('section');bar.id='v370PlanOverview';bar.className='v370-plan-overview';dash.prepend(bar);}
  [...dash.querySelectorAll('#v370PlanOverview')].slice(1).forEach(x=>x.remove());
  const sig=JSON.stringify({week:now.week,overdue:overdue.map(r=>r.id),next:next?[next.id,next.week,next.theme,next.department,next.leaderName]:null,upcoming:upcoming.map(r=>[r.id,r.week,r.theme,r.department,r.leaderName])});
  if(bar.dataset.sig!==sig){
    bar.dataset.sig=sig;
    bar.innerHTML=`<div class="v370-plan-title"><div><span class="eyebrow">Årsplan ${now.year}</span><strong>Uke ${now.week}</strong></div><button type="button" class="text-action" data-v384-annual>Åpne årsplan →</button></div><div class="v370-plan-cards"><button type="button" class="v370-overdue-card ${overdue.length?'has-overdue':''}" data-v384-status-jump="overdue"><span>Forfalte</span><strong>${overdue.length}</strong><small>${overdue.length?'Krever avklaring / etterregistrering':'Ingen forfalte runder'}</small><b>${overdue.length?'Se runder →':'Ajour'}</b></button>${upcoming.map((r,i)=>`<button type="button" class="v370-upcoming-card ${i===0?'primary':''}" data-v384-edit="${esc(r.id)}"><span>${Number(r.week)===now.week?'Denne uken':'Kommende'}</span><strong>Uke ${r.week} · ${esc(r.theme||'Tema mangler')}</strong><small>${esc(r.department||'Avdeling mangler')} · ${esc(r.leaderName||'Ikke fordelt')}</small></button>`).join('')}</div>`;
  }
  const card=dash.querySelector('.v35-next');
  if(card){
    const nextSig=next?`${next.id}|${next.week}|${next.theme}|${next.department}|${next.leaderName}`:'none';
    if(card.dataset.v370Plan!==nextSig){
      card.dataset.v370Plan=nextSig;
      card.innerHTML=next?`<span class="eyebrow">Neste oppgave</span><h2>Uke ${next.week} · ${esc(next.theme||'Tema mangler')}</h2><p>${esc(next.department||'Avdeling mangler')} · planlagt for ${esc(next.leaderName||'Ikke fordelt')}</p><button class="primary-action full-action" type="button" data-v384-start-id="${esc(next.id)}">Start planlagt LOR →</button><div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`:'<span class="eyebrow">Neste oppgave</span><h2>Ingen åpne runder</h2><p>Årsplanen er ajour.</p>';
    }
  }
  dash.classList.add('v371-ready');
}

function allPeople(){
  const names=[...unique(mergedRows(activeYear),'leaderName'),...participants.map(p=>p.name)];
  return [...new Map(names.filter(Boolean).map(n=>[norm(n),n])).values()].sort((a,b)=>a.localeCompare(b,'nb'));
}
function participantMemory(current=''){
  if(!participants.length)return '<small>Ingen ekstra deltakere er lagret ennå.</small>';
  return `<small>Lagrede deltakere</small><div>${participants.filter(p=>norm(p.name)!==norm(current)).map(p=>`<span class="v377-person-chip"><button type="button" data-v384-pick-person="${esc(p.name)}">${esc(p.name)}</button><button type="button" aria-label="Slett ${esc(p.name)}" data-v384-delete-person="${esc(p.id)}">×</button></span>`).join('')}</div>`;
}
function closeAnnualDialogs(){document.querySelectorAll('dialog.v384-annual-dialog,dialog.v363-dialog').forEach(d=>d.remove());}
function dialog(row={}){
  closeAnnualDialogs();
  const completion=completedFor(row),people=allPeople(),dlg=document.createElement('dialog');
  dlg.open=true;dlg.className='lor-dialog v36-dialog v363-dialog v370-modal v384-annual-dialog';
  const currentParticipant=row.coLeaderName||'';
  dlg.innerHTML=`<form data-v384-form data-id="${esc(row.source==='live'?row.id:'')}" data-seed-id="${esc(row.sourceSeedId||'')}"><div class="dialog-head"><div><span class="eyebrow">Årsplan ${activeYear}</span><h2>${row.week?`Uke ${row.week} · ${esc(row.theme||'LOR')}`:'Planlegg runde'}</h2></div><button type="button" data-v384-close>×</button></div><div class="v36-form"><label>Uke<input name="week" type="number" min="1" max="53" required value="${row.week||''}"></label><label>Planlagt dato<input name="plannedDate" type="date" value="${esc(row.plannedDate||'')}"></label><label>Ansvarlig<select name="leaderName" required><option value="">Velg</option>${people.map(x=>`<option ${x===row.leaderName?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Tema<input name="theme" required value="${esc(row.theme||'')}"></label><label>Avdeling<select name="department" required><option value="">Velg</option>${['Renhold','Ferdigmat','Rekvisita'].map(x=>`<option ${x===row.department?'selected':''}>${x}</option>`).join('')}</select></label><label>Inviter med / deltaker<input type="text" name="coLeaderName" list="v384ParticipantOptions" autocomplete="off" value="${esc(currentParticipant)}" placeholder="Skriv navn eller velg fra listen"><datalist id="v384ParticipantOptions">${people.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist><div class="v377-participant-memory">${participantMemory(currentParticipant)}</div></label></div><section class="v363-completion"><div><span class="eyebrow">Gjennomføring</span><h3>${completion?'Runden er registrert gjennomført':'Ikke registrert gjennomført'}</h3></div>${completion?`<p>${completion.time?new Date(completion.time).toLocaleDateString('nb-NO'):'Registrert gjennomført'} · ${completion.source==='historikk'?'importert historikk':'LOR'}</p>${completion.round?`<button type="button" class="secondary-action" data-v384-open-round="${esc(completion.round.id)}">Åpne gjennomført LOR →</button>`:''}`:`<label>Faktisk gjennomført dato<input type="date" name="completedDate" value="${new Date().toISOString().slice(0,10)}"></label><button type="button" class="secondary-action" data-v384-afterregister>Etterregistrer gjennomført</button><button type="button" class="primary-action" data-v384-start>Start denne LOR →</button>`}</section><div class="dialog-actions"><button type="button" class="secondary-action" data-v384-close>Avbryt</button><button class="primary-action" type="submit">Lagre endringer</button></div></form>`;
  document.body.appendChild(dlg);
}
function formValues(form){
  const fd=new FormData(form),plannedDate=String(fd.get('plannedDate')||''),rawWeek=Number(fd.get('week'));
  return {year:activeYear,week:plannedDate?(weekFromDate(plannedDate)||rawWeek):rawWeek,plannedDate,leaderName:String(fd.get('leaderName')||'').trim(),theme:String(fd.get('theme')||'').trim(),department:String(fd.get('department')||'').trim(),coLeaderName:String(fd.get('coLeaderName')||'').trim(),completedDate:String(fd.get('completedDate')||'').trim()};
}
function seedGroup(seedId){return seedId?livePlans.filter(p=>String(p.sourceSeedId||'')===String(seedId)):[];}
function seedIdentityFor(form,v){
  const seeds=seedRows(v.year),currentId=String(form.dataset.seedId||'').trim();
  const current=seeds.find(seed=>String(seed.id)===currentId);
  if(current&&Number(current.week)===Number(v.week))return current.id;
  const candidates=seeds.filter(seed=>
    Number(seed.week)===Number(v.week) &&
    (!seed.leaderName||!v.leaderName||first(seed.leaderName)===first(v.leaderName)) &&
    (!seed.theme||!v.theme||norm(seed.theme)===norm(v.theme)) &&
    (!seed.department||!v.department||norm(seed.department)===norm(v.department))
  );
  return candidates.length===1?candidates[0].id:'';
}
async function resolvePlan(form,v){
  const direct=String(form.dataset.id||'').trim(),seedId=seedIdentityFor(form,v);
  if(direct)return {id:direct,seedId};
  const group=seedGroup(seedId).sort((a,b)=>stamp(b)-stamp(a)||String(b.id).localeCompare(String(a.id)));
  if(group[0])return {id:group[0].id,seedId};
  return {id:db.ref('lor/plans').push().key,seedId};
}
function groupCompletion(seedId,id){
  const group=seedId?seedGroup(seedId):livePlans.filter(p=>String(p.id)===String(id));
  return group.filter(p=>String(p.status||'').toLowerCase()==='completed'||Number(p.completedAt)>0).sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)||stamp(b)-stamp(a))[0]||null;
}
async function rememberParticipant(name){
  name=String(name||'').trim().replace(/\s+/g,' ');
  if(!name||participants.some(p=>norm(p.name)===norm(name)))return;
  await db.ref('lor/participants').push().set({name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
}
async function savePlan(form){
  if(!form.reportValidity())throw new Error('Fyll ut obligatoriske felt først.');
  const v=formValues(form),resolved=await resolvePlan(form,v),existing=livePlans.find(p=>String(p.id)===String(resolved.id))||{},completed=groupCompletion(resolved.seedId,resolved.id);
  const data={...existing,year:v.year,week:v.week,plannedDate:v.plannedDate,leaderName:v.leaderName,ownerName:v.leaderName,theme:v.theme,themeName:v.theme,department:v.department,coLeaderName:v.coLeaderName,status:completed?'completed':(String(existing.status||'').toLowerCase()==='completed'?'completed':'planned'),updatedAt:serverTimestamp()};
  if(resolved.seedId)data.sourceSeedId=resolved.seedId;else delete data.sourceSeedId;
  if(completed){data.completedAt=Number(completed.completedAt||0);data.completedRoundId=completed.completedRoundId||existing.completedRoundId||'';}
  delete data.id;
  const updates={[`lor/plans/${resolved.id}`]:data};
  const linkedRoundId=existing.completedRoundId||completed?.completedRoundId||'';
  if(linkedRoundId){
    updates[`lor/rounds/${linkedRoundId}/planWeek`]=v.week;
    updates[`lor/rounds/${linkedRoundId}/planYear`]=v.year;
    updates[`lor/rounds/${linkedRoundId}/sourceSeedId`]=resolved.seedId||'';
    updates[`lor/rounds/${linkedRoundId}/updatedAt`]=serverTimestamp();
  }
  await db.ref().update(updates);
  if(v.coLeaderName)await rememberParticipant(v.coLeaderName).catch(()=>{});
  return {id:resolved.id,...data};
}
async function afterRegister(form){
  if(!form.reportValidity())throw new Error('Fyll ut obligatoriske felt først.');
  const v=formValues(form);if(!v.completedDate)throw new Error('Velg faktisk gjennomført dato.');
  const completedAt=new Date(`${v.completedDate}T12:00:00`).getTime();if(!Number.isFinite(completedAt))throw new Error('Ugyldig dato.');
  const resolved=await resolvePlan(form,v),roundId=db.ref('lor/rounds').push().key,user=window.firebase?.auth?.().currentUser,now=Date.now();
  const plan={year:v.year,week:v.week,plannedDate:v.plannedDate,leaderName:v.leaderName,ownerName:v.leaderName,theme:v.theme,themeName:v.theme,department:v.department,coLeaderName:v.coLeaderName,status:'completed',completedAt,completedRoundId:roundId,updatedAt:now};
  if(resolved.seedId)plan.sourceSeedId=resolved.seedId;
  const round={planId:resolved.id,sourceSeedId:resolved.seedId||'',planWeek:v.week,planYear:v.year,theme:v.theme,themeName:v.theme,department:v.department,leaderUid:user?.uid||'afterregistered',leaderName:v.leaderName,coLeaderName:v.coLeaderName,status:'Gjennomført',startedAt:completedAt,completedAt,updatedAt:now,registeredAfterwards:true,themeVersion:1,responses:{},employeeInterviews:{},summary:{note:'Etterregistrert fra årsplan',counts:{ok:0,improvement:0,deviation:0,followUp:0}}};
  const siblings=resolved.seedId?seedGroup(resolved.seedId):[];
  const ids=[...new Set([resolved.id,...siblings.map(p=>p.id)])];
  const updates={[`lor/plans/${resolved.id}`]:plan,[`lor/rounds/${roundId}`]:round};
  ids.filter(id=>id!==resolved.id).forEach(id=>{
    updates[`lor/plans/${id}/status`]='completed';
    updates[`lor/plans/${id}/completedAt`]=completedAt;
    updates[`lor/plans/${id}/completedRoundId`]=roundId;
    updates[`lor/plans/${id}/updatedAt`]=now;
  });
  await db.ref().update(updates);
  const [ps,rs]=await Promise.all([db.ref(`lor/plans/${resolved.id}`).once('value'),db.ref(`lor/rounds/${roundId}`).once('value')]);
  if(!ps.exists()||!rs.exists()||String(ps.val()?.status)!=='completed'||Number(rs.val()?.completedAt)!==completedAt)throw new Error('Firebase bekreftet ikke etterregistreringen.');
  const planLocal={id:resolved.id,...plan};
  const idx=livePlans.findIndex(p=>String(p.id)===String(resolved.id));if(idx>=0)livePlans[idx]=planLocal;else livePlans.push(planLocal);
  for(const id of ids.filter(id=>id!==resolved.id)){const i=livePlans.findIndex(p=>String(p.id)===String(id));if(i>=0)livePlans[i]={...livePlans[i],status:'completed',completedAt,completedRoundId:roundId,updatedAt:now};}
  liveRounds.push({id:roundId,...round});
  if(v.coLeaderName)await rememberParticipant(v.coLeaderName).catch(()=>{});
  return {planId:resolved.id,roundId,week:v.week};
}
function notify(msg,error=false){
  const t=document.querySelector('#toast');if(t){t.textContent=msg;t.classList.toggle('error',error);t.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('show'),5000);}
  if(error)alert(msg);
}
function refreshParticipantUi(){
  document.querySelectorAll('form[data-v384-form]').forEach(form=>{
    const input=form.querySelector('[name="coLeaderName"]'),list=form.querySelector('#v384ParticipantOptions'),memory=form.querySelector('.v377-participant-memory');
    if(list)list.innerHTML=allPeople().map(x=>`<option value="${esc(x)}"></option>`).join('');
    if(memory)memory.innerHTML=participantMemory(input?.value||'');
  });
}
function sync(){
  if(!ready){applyIdentity();return;}
  applyIdentity();ensureNav();
  if(annualMode)renderAnnual();else renderDashboardPlan();
  document.body.classList.remove('v363-view-loading');
}
function scheduleSync(){[0,40,120].forEach(ms=>setTimeout(sync,ms));}

document.addEventListener('click',async ev=>{
  const jump=ev.target.closest('[data-v384-status-jump]');if(jump){ev.preventDefault();ev.stopImmediatePropagation();resetFilters();filters.status=jump.dataset.v384StatusJump;annualMode=true;renderAnnual();return;}
  const annual=ev.target.closest('[data-v384-annual]');if(annual){ev.preventDefault();ev.stopImmediatePropagation();resetFilters();annualMode=true;renderAnnual();return;}
  const normal=ev.target.closest('.nav [data-view]');if(normal){annualMode=false;resetFilters();return;}
  const close=ev.target.closest('[data-v384-close]');if(close){close.closest('dialog')?.remove();return;}
  const edit=ev.target.closest('[data-v384-edit]');if(edit){ev.preventDefault();ev.stopPropagation();const row=mergedRows(activeYear).find(r=>String(r.id)===String(edit.dataset.v384Edit));if(row)dialog(row);return;}
  if(ev.target.closest('[data-v384-new-plan]')){dialog({});return;}
  if(ev.target.closest('[data-v384-new-year]')){const y=Number(prompt('Hvilket år vil du opprette årsplan for?',String(Math.max(...years())+1)));if(y>=2026&&y<=2100){activeYear=y;resetFilters();renderAnnual();}return;}
  if(ev.target.closest('[data-v384-reset-filter]')){resetFilters();renderAnnual();return;}
  const startId=ev.target.closest('[data-v384-start-id]');if(startId){const plan=mergedRows(new Date().getFullYear()).find(r=>String(r.id)===String(startId.dataset.v384StartId));if(plan){annualMode=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:plan}));}return;}
  const after=ev.target.closest('[data-v384-afterregister]');if(after){
    ev.preventDefault();ev.stopImmediatePropagation();if(afterBusy)return;afterBusy=true;
    const form=after.closest('form[data-v384-form]');
    try{after.disabled=true;after.textContent='Etterregistrerer…';const r=await afterRegister(form);form.closest('dialog')?.remove();renderAnnual();notify(`Uke ${r.week} er etterregistrert og bekreftet ✓`);}
    catch(err){console.error(`[LOR ${BUILD}]`,err);after.disabled=false;after.textContent='Etterregistrer gjennomført';notify(err.message||'Etterregistrering feilet.',true);}
    finally{afterBusy=false;}
    return;
  }
  const start=ev.target.closest('[data-v384-start]');if(start){try{const plan=await savePlan(start.closest('form'));start.closest('dialog')?.remove();annualMode=false;window.dispatchEvent(new CustomEvent('lor:start-plan',{detail:plan}));}catch(err){notify(err.message||'Kunne ikke starte runden.',true);}return;}
  const open=ev.target.closest('[data-v384-open-round]');if(open){open.closest('dialog')?.remove();annualMode=false;window.dispatchEvent(new CustomEvent('lor:open-round',{detail:{id:open.dataset.v384OpenRound}}));return;}
  const pick=ev.target.closest('[data-v384-pick-person]');if(pick){ev.preventDefault();const form=pick.closest('form[data-v384-form]'),input=form?.querySelector('[name="coLeaderName"]');if(input){input.value=pick.dataset.v384PickPerson||'';input.focus();refreshParticipantUi();}return;}
  const del=ev.target.closest('[data-v384-delete-person]');if(del){ev.preventDefault();ev.stopPropagation();const p=participants.find(x=>x.id===del.dataset.v384DeletePerson);if(!p)return;if(!confirm(`Fjerne ${p.name} fra listen over lagrede deltakere?`))return;try{await db.ref(`lor/participants/${p.id}`).remove();notify(`${p.name} er fjernet fra deltakerlisten.`);}catch{notify('Kunne ikke slette deltakeren.',true);}return;}
},true);

document.addEventListener('change',ev=>{
  if(ev.target.matches('[data-v384-year]')){activeYear=Number(ev.target.value);resetFilters();renderAnnual();return;}
  const f=ev.target.closest('[data-v384-filter]');if(f){filters[f.dataset.v384Filter]=f.value;updateFilteredRows();}
},true);

document.addEventListener('submit',async ev=>{
  if(!ev.target.matches('[data-v384-form]'))return;
  ev.preventDefault();
  try{await savePlan(ev.target);ev.target.closest('dialog')?.remove();if(annualMode)renderAnnual();else sync();notify('Endringene er lagret ✓');}
  catch(err){console.error(err);notify(err.message||'Kunne ikke lagre årsplan.',true);}
},true);

const app=document.querySelector('#app');
if(app)new MutationObserver(scheduleSync).observe(app,{childList:true,subtree:false});

Promise.all([
  fetch('./data/seed/plan-2026.json',{cache:'no-store'}).then(r=>r.json()),
  fetch('./data/seed/history-2026.json',{cache:'no-store'}).then(r=>r.json())
]).then(([p,h])=>{seedPlan=p;legacy2026=h.records||[];ready=true;sync();}).catch(()=>{ready=true;sync();});

db.ref('lor/plans').on('value',s=>{livePlans=[];s.forEach(c=>livePlans.push({id:c.key,...(c.val()||{})}));sync();});
db.ref('lor/rounds').on('value',s=>{liveRounds=[];s.forEach(c=>liveRounds.push({id:c.key,...(c.val()||{})}));sync();});
db.ref('lor/participants').on('value',s=>{participants=[];s.forEach(c=>{const v=c.val()||{},name=String(v.name||'').trim();if(name)participants.push({id:c.key,name});});participants.sort((a,b)=>a.name.localeCompare(b.name,'nb'));refreshParticipantUi();});

window.addEventListener('load',scheduleSync);
setTimeout(scheduleSync,250);
document.documentElement.dataset.planEngine=BUILD;
