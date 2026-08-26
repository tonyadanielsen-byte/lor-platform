import { db, serverTimestamp } from './firebase.js';

const rowsFrom = snap => { const rows=[]; snap.forEach(c=>rows.push({id:c.key,...(c.val()||{})})); return rows; };
export function subscribePlannedRounds(uid,cb){const ref=db.ref('lor/plans'),h=s=>cb(rowsFrom(s).filter(x=>!uid||!x.leaderUid||x.leaderUid===uid).sort((a,b)=>Number(a.week||99)-Number(b.week||99)));ref.on('value',h);return()=>ref.off('value',h)}
export function subscribeRounds(cb){const ref=db.ref('lor/rounds'),h=s=>cb(rowsFrom(s).sort((a,b)=>Number(b.startedAt||b.completedAt||0)-Number(a.startedAt||a.completedAt||0)));ref.on('value',h);return()=>ref.off('value',h)}
export function subscribeThemes(cb){const ref=db.ref('lor/themes'),h=s=>cb(rowsFrom(s).sort((a,b)=>(a.name||'').localeCompare(b.name||'')));ref.on('value',h);return()=>ref.off('value',h)}
export async function createRound({planId=null,leader,department,theme,themeVersion=1,week=null,positiveStart=''}){const ref=db.ref('lor/rounds').push();await ref.set({planId,planWeek:week,source:planId?'plan':'manual',leaderUid:leader.uid,leaderName:leader.name,department,theme,themeVersion,positiveStart:String(positiveStart||'').trim(),status:'Pågår',startedAt:serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),responses:{},employeeInterviews:{},observations:{},actions:{}});return ref.key}
export async function saveResponse(id,qid,response){return db.ref().update({[`lor/rounds/${id}/responses/${qid}`]:{...response,updatedAt:serverTimestamp()},[`lor/rounds/${id}/updatedAt`]:serverTimestamp()})}
export async function addEmployeeInterview(id,data){return db.ref(`lor/rounds/${id}/employeeInterviews`).push().set({...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})}
export async function completeRound(id,summary){return db.ref(`lor/rounds/${id}`).update({status:summary.needsFollowUp?'Oppfølging pågår':'Gjennomført',summary,completedAt:serverTimestamp(),updatedAt:serverTimestamp()})}
export async function updateRound(id,patch,user){return db.ref(`lor/rounds/${id}`).update({...patch,updatedAt:serverTimestamp(),lastEditedBy:user?.name||'',lastEditedByUid:user?.uid||''})}
export async function saveTheme(theme){const id=theme.id||db.ref('lor/themes').push().key;const clean={...theme};delete clean.id;await db.ref(`lor/themes/${id}`).set({...clean,active:theme.active!==false,updatedAt:serverTimestamp()});return id}
export async function deleteTheme(id){return db.ref(`lor/themes/${id}`).update({active:false,updatedAt:serverTimestamp()})}
function isoDate(d=new Date()){return d.toISOString().slice(0,10)}
function defaultDueDate(){const d=new Date();d.setDate(d.getDate()+14);return isoDate(d)}
export async function createMasterAction({round,finding,user,title,description,owner='',dueDate='',priority='Middels'}){
  const ref=db.ref('tiltak').push();
  const payload={
    tittel:String(title||finding||'LOR-tiltak').trim(),
    beskrivelse:String(description||`Opprettet fra LOR: ${round.theme} – ${round.department}`).trim(),
    nestesteg:'Følg opp funnet fra LOR og dokumenter effekt/lukking.',
    eier:owner||user.name,
    kategori:'LOR',
    omrade:round.department||'Annet',
    prioritet:priority||'Middels',
    status:'Innmeldt',
    frist:dueDate||defaultDueDate(),
    miljo:'Produksjon',
    dato:isoDate(),
    livssyklus:'Aktiv',
    arkivert:false,
    papirkurv:false,
    forslagsstiller:user.name,
    opprettetAv:user.name,
    source:'LOR',
    sourceRoundId:round.id,
    sourceTheme:round.theme,
    sourceDepartment:round.department,
    sourceFinding:finding||'',
    sourceLeader:round.leaderName||'',
    createdByUid:user.uid,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };
  await ref.set(payload);
  await db.ref(`lor/rounds/${round.id}/actions/${ref.key}`).set({masterTaskId:ref.key,title:payload.tittel,status:'Opprettet',createdAt:serverTimestamp()});
  return ref.key;
}
export async function addComment(type,id,user,text){return db.ref(`lor/comments/${type}/${id}`).push().set({text:String(text||'').trim(),authorUid:user.uid,authorName:user.name,createdAt:serverTimestamp()})}