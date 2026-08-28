(() => {
  const BUILD = '3.8.13';
  const PROFILES = {
    'TJKI3zlDKSR7jvFXksVFgEgjS432': 'Tony Danielsen',
    'gibm3aDi1KWlNyl7P3jTktQoGsM2': 'Kenneth Nordbakk',
    'lJ7bn7HkbcZnhDoxfaBYQKEFL083': 'Erling Magnussen'
  };
  let seed = null, plans = [], rounds = [], scheduled = false, bound = false;
  const norm = v => String(v || '').trim().replace(/\s+/g,' ').toLocaleLowerCase('nb-NO');
  const first = v => norm(v).split(/\s+/)[0] || '';
  const stamp = p => Number(p?.updatedAt || p?.completedAt || p?.createdAt || 0);
  const completedRound = r => Number(r?.completedAt) > 0 || ['gjennomført','oppfølging pågår','lukket'].includes(norm(r?.status));

  function rows(snap){const out=[];snap.forEach(c=>out.push({id:c.key,...(c.val()||{})}));return out;}

  function seedRows(){
    const year = Number(seed?.year || 2026);
    return (seed?.records || []).map((r,i)=>({
      id:`seed-${year}-${r.week}-${i}`, sourceSeedId:`seed-${year}-${r.week}-${i}`, year, week:Number(r.week),
      leaderName:r.ownerName||'', ownerName:r.ownerName||'', theme:r.themeName||'', themeName:r.themeName||'',
      department:r.department||'', status:r.status||'planned', source:'seed'
    })).filter(p=>Number.isFinite(p.week)&&p.theme);
  }

  function canonicalPlans(){
    const seeds=seedRows(), seedIds=new Set(seeds.map(s=>s.id)), groups=new Map(), standalone=[];
    plans.forEach(p=>{
      if(p.sourceSeedId){if(!groups.has(p.sourceSeedId))groups.set(p.sourceSeedId,[]);groups.get(p.sourceSeedId).push(p);}
      else standalone.push({...p,source:'live',_aliases:[p.id]});
    });
    const merged=seeds.map(s=>{
      const group=groups.get(s.id)||[];
      if(!group.length)return {...s,_aliases:[s.id]};
      const latest=[...group].sort((a,b)=>stamp(b)-stamp(a))[0];
      const completed=[...group].filter(p=>norm(p.status)==='completed'||Number(p.completedAt)>0).sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0))[0];
      const row={...s,...latest,source:'live',_aliases:[s.id,...group.map(p=>p.id)]};
      if(completed){row.status='completed';row.completedAt=completed.completedAt;row.completedRoundId=completed.completedRoundId||row.completedRoundId;}
      return row;
    });
    for(const [sid,group] of groups.entries()){
      if(seedIds.has(sid))continue;
      const latest=[...group].sort((a,b)=>stamp(b)-stamp(a))[0];
      merged.push({...latest,source:'live',_aliases:group.map(p=>p.id)});
    }
    merged.push(...standalone);
    return merged.filter(p=>!p.archived&&p.theme&&Number.isFinite(Number(p.week)));
  }

  function planDone(plan){
    if(norm(plan.status)==='completed'||Number(plan.completedAt)>0)return true;
    const aliases=new Set([plan.id,plan.sourceSeedId,...(plan._aliases||[])].filter(Boolean).map(String));
    return rounds.some(r=>{
      if(!completedRound(r))return false;
      if(aliases.has(String(r.planId||''))||aliases.has(String(r.sourceSeedId||'')))return true;
      return Number(r.planWeek)===Number(plan.week) && norm(r.theme||r.themeName)===norm(plan.theme||plan.themeName) && (!plan.leaderName||first(r.leaderName)===first(plan.leaderName));
    });
  }

  function findings(){
    let improvement=0,deviation=0;
    rounds.forEach(r=>{
      Object.values(r.responses||{}).forEach(x=>{
        const s=norm(x.status||x.result||x.answer);
        if(s==='improvement'||s==='forbedringspunkt')improvement++;
        if(s==='deviation'||s==='avvik')deviation++;
      });
    });
    return {improvement,deviation};
  }

  function currentName(){
    const user=window.firebase?.auth?.().currentUser;
    return PROFILES[user?.uid] || document.querySelector('.dashboard-hero h1')?.textContent?.replace(/^God dag,\s*/i,'').trim() || user?.displayName || '';
  }

  function apply(){
    scheduled=false;
    const cards=[...document.querySelectorAll('.dashboard-kpis .kpi')];
    if(cards.length<5||!seed)return;
    const name=currentName(), personal=canonicalPlans().filter(p=>first(p.leaderName||p.ownerName)===first(name)&&norm(p.status)!=='needsreview');
    const done=personal.filter(planDone).length, total=personal.length, rate=total?Math.round(done/total*100):0;
    const digitalCompleted=rounds.filter(completedRound).length;
    const open=rounds.filter(r=>norm(r.status)==='oppfølging pågår').length;
    const f=findings();
    const values=[
      [`${rate} %`,`${done} av ${total} planlagte`],
      [String(digitalCompleted),'registrert i appen'],
      [String(open),'krever handling'],
      [String(f.improvement),'fra digitale runder'],
      [String(f.deviation),'fra digitale runder']
    ];
    cards.slice(0,5).forEach((card,i)=>{
      const strong=card.querySelector('strong'),small=card.querySelector('small');
      if(strong)strong.textContent=values[i][0];
      if(small)small.textContent=values[i][1];
      card.dataset.truthBuild=BUILD;
    });
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}

  async function bind(){
    if(bound||!window.firebase?.database)return;bound=true;
    seed=await fetch(`./data/seed/plan-2026.json?truth=${BUILD}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>({year:2026,records:[]}));
    const db=window.firebase.database();
    db.ref('lor/plans').on('value',s=>{plans=rows(s);schedule();});
    db.ref('lor/rounds').on('value',s=>{rounds=rows(s);schedule();});
    new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
    schedule();
  }
  window.addEventListener('load',bind,{once:true});
  setTimeout(bind,300);
  window.__lorDashboardTruth={build:BUILD};
})();
