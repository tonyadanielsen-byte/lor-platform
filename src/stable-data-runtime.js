(() => {
  const BUILD = '3.8.14';
  const WEEK18_SEED = 'seed-2026-18-2';
  let busy = false, repairRunning = false;

  const db = () => window.firebase.database();
  const ts = () => window.firebase.database.ServerValue.TIMESTAMP;
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  const norm = value => clean(value).toLocaleLowerCase('nb-NO');
  const first = value => norm(value).split(/\s+/)[0] || '';

  function toast(message, error = false) {
    const el = document.querySelector('#toast');
    if (el) {
      el.textContent = message;
      el.classList.toggle('error', error);
      el.classList.add('show');
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => el.classList.remove('show'), 4500);
    }
    if (error) console.error(`[LOR ${BUILD}]`, message);
  }

  function values(form) {
    const fd = new FormData(form);
    return {
      year: Number(document.querySelector('[data-v384-year]')?.value || 2026),
      week: Number(fd.get('week')),
      plannedDate: clean(fd.get('plannedDate')),
      leaderName: clean(fd.get('leaderName')),
      theme: clean(fd.get('theme')),
      department: clean(fd.get('department')),
      coLeaderName: clean(fd.get('coLeaderName')),
      completedDate: clean(fd.get('completedDate'))
    };
  }

  function validate(v) {
    if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
    if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');
  }

  async function context(form) {
    const seedId = clean(form.dataset.seedId);
    const directId = clean(form.dataset.id);
    const snap = await db().ref('lor/plans').once('value');
    const plans = [];
    snap.forEach(c => plans.push({ id: c.key, ...(c.val() || {}) }));
    const siblings = seedId ? plans.filter(p => String(p.sourceSeedId || '') === seedId || String(p.id) === seedId) : [];
    const canonicalId = seedId || directId || db().ref('lor/plans').push().key;
    const existing = plans.find(p => String(p.id) === canonicalId) || siblings.sort((a,b)=>Number(b.updatedAt||b.completedAt||0)-Number(a.updatedAt||a.completedAt||0))[0] || {};
    return { seedId, directId, canonicalId, siblings, existing };
  }

  function completionFrom(items) {
    return items.filter(p => norm(p.status) === 'completed' || Number(p.completedAt) > 0)
      .sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0))[0] || null;
  }

  async function repairExistingWeek18() {
    if (repairRunning || !window.firebase?.auth?.().currentUser) return;
    repairRunning = true;
    try {
      const [ps, rs] = await Promise.all([
        db().ref('lor/plans').once('value'),
        db().ref('lor/rounds').once('value')
      ]);
      const plans = [], rounds = [];
      ps.forEach(c => plans.push({ id:c.key, ...(c.val()||{}) }));
      rs.forEach(c => rounds.push({ id:c.key, ...(c.val()||{}) }));

      const matchingRounds = rounds.filter(r => {
        const completed = Number(r.completedAt) > 0 || ['gjennomført','oppfølging pågår','lukket'].includes(norm(r.status));
        if (!completed) return false;
        if (String(r.sourceSeedId || '') === WEEK18_SEED) return true;
        return !!r.registeredAfterwards && first(r.leaderName) === 'kenneth' && norm(r.theme || r.themeName) === 'rutinebeskrivelser' && norm(r.department) === 'rekvisita';
      }).sort((a,b)=>Number(b.completedAt||b.startedAt||0)-Number(a.completedAt||a.startedAt||0));
      const round = matchingRounds[0];
      if (!round) return;

      const relatedPlans = plans.filter(p => String(p.sourceSeedId || '') === WEEK18_SEED || String(p.id) === WEEK18_SEED || (first(p.leaderName||p.ownerName)==='kenneth' && norm(p.theme||p.themeName)==='rutinebeskrivelser' && norm(p.department)==='rekvisita' && [17,18].includes(Number(p.week))));
      const base = relatedPlans.sort((a,b)=>Number(b.updatedAt||b.completedAt||0)-Number(a.updatedAt||a.completedAt||0))[0] || {};
      const completedAt = Number(round.completedAt || round.startedAt || Date.now());
      const canonicalPlan = {
        ...base,
        sourceSeedId: WEEK18_SEED,
        year: 2026,
        week: 18,
        leaderName: base.leaderName || base.ownerName || round.leaderName || 'Kenneth',
        ownerName: base.ownerName || base.leaderName || round.leaderName || 'Kenneth',
        theme: base.theme || base.themeName || round.theme || round.themeName || 'Rutinebeskrivelser',
        themeName: base.themeName || base.theme || round.themeName || round.theme || 'Rutinebeskrivelser',
        department: base.department || round.department || 'Rekvisita',
        coLeaderName: base.coLeaderName || round.coLeaderName || '',
        status: 'completed',
        completedAt,
        completedRoundId: round.id,
        stableWriterBuild: BUILD,
        repairedExistingWeek18: true,
        updatedAt: ts()
      };
      delete canonicalPlan.id;

      const updates = {
        [`lor/plans/${WEEK18_SEED}`]: canonicalPlan,
        [`lor/rounds/${round.id}/sourceSeedId`]: WEEK18_SEED,
        [`lor/rounds/${round.id}/planId`]: WEEK18_SEED,
        [`lor/rounds/${round.id}/planYear`]: 2026,
        [`lor/rounds/${round.id}/planWeek`]: 18,
        [`lor/rounds/${round.id}/stableWriterBuild`]: BUILD,
        [`lor/rounds/${round.id}/updatedAt`]: ts()
      };
      relatedPlans.filter(p=>p.id!==WEEK18_SEED).forEach(p=>{
        updates[`lor/plans/${p.id}/sourceSeedId`] = WEEK18_SEED;
        updates[`lor/plans/${p.id}/year`] = 2026;
        updates[`lor/plans/${p.id}/week`] = 18;
        updates[`lor/plans/${p.id}/status`] = 'completed';
        updates[`lor/plans/${p.id}/completedAt`] = completedAt;
        updates[`lor/plans/${p.id}/completedRoundId`] = round.id;
        updates[`lor/plans/${p.id}/stableWriterBuild`] = BUILD;
        updates[`lor/plans/${p.id}/updatedAt`] = ts();
      });
      await db().ref().update(updates);

      const verify = await db().ref(`lor/plans/${WEEK18_SEED}`).once('value');
      if (verify.exists() && Number(verify.val()?.week) === 18 && norm(verify.val()?.status) === 'completed') {
        console.info(`[LOR ${BUILD}] Existing week 18 completion repaired and verified.`);
      }
    } catch (error) {
      console.error(`[LOR ${BUILD}] Existing week 18 repair failed`, error);
    } finally { repairRunning = false; }
  }

  async function savePlan(form) {
    if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
    const v = values(form); validate(v);
    const c = await context(form);
    const completed = completionFrom([c.existing, ...c.siblings]);
    const payload = {
      ...c.existing, year:v.year, week:v.week, plannedDate:v.plannedDate,
      leaderName:v.leaderName, ownerName:v.leaderName, theme:v.theme, themeName:v.theme,
      department:v.department, coLeaderName:v.coLeaderName,
      status: completed ? 'completed' : (norm(c.existing.status)==='completed'?'completed':'planned'),
      stableWriterBuild:BUILD, updatedAt:ts()
    };
    if(c.seedId)payload.sourceSeedId=c.seedId;
    if(completed){payload.completedAt=Number(completed.completedAt||0);payload.completedRoundId=completed.completedRoundId||c.existing.completedRoundId||'';}
    delete payload.id;
    const updates = { [`lor/plans/${c.canonicalId}`]:payload };
    c.siblings.filter(p=>p.id!==c.canonicalId).forEach(p=>{
      updates[`lor/plans/${p.id}/year`]=v.year; updates[`lor/plans/${p.id}/week`]=v.week;
      updates[`lor/plans/${p.id}/plannedDate`]=v.plannedDate||null; updates[`lor/plans/${p.id}/leaderName`]=v.leaderName;
      updates[`lor/plans/${p.id}/ownerName`]=v.leaderName; updates[`lor/plans/${p.id}/theme`]=v.theme;
      updates[`lor/plans/${p.id}/themeName`]=v.theme; updates[`lor/plans/${p.id}/department`]=v.department;
      updates[`lor/plans/${p.id}/coLeaderName`]=v.coLeaderName; updates[`lor/plans/${p.id}/stableWriterBuild`]=BUILD; updates[`lor/plans/${p.id}/updatedAt`]=ts();
    });
    await db().ref().update(updates);
    const verify=await db().ref(`lor/plans/${c.canonicalId}`).once('value'),saved=verify.val();
    if(!verify.exists()||Number(saved?.week)!==v.week||clean(saved?.leaderName)!==v.leaderName||clean(saved?.theme)!==v.theme)throw new Error('Firebase bekreftet ikke de lagrede endringene.');
    return {id:c.canonicalId,week:v.week};
  }

  async function afterRegister(form) {
    if(!form.reportValidity())throw new Error('Fyll ut obligatoriske felt først.');
    const v=values(form);validate(v);if(!v.completedDate)throw new Error('Velg faktisk gjennomført dato.');
    const completedAt=new Date(`${v.completedDate}T12:00:00`).getTime();if(!Number.isFinite(completedAt))throw new Error('Ugyldig gjennomført dato.');
    const c=await context(form),roundId=db().ref('lor/rounds').push().key,user=window.firebase.auth().currentUser,now=Date.now();
    const plan={year:v.year,week:v.week,plannedDate:v.plannedDate,leaderName:v.leaderName,ownerName:v.leaderName,theme:v.theme,themeName:v.theme,department:v.department,coLeaderName:v.coLeaderName,status:'completed',completedAt,completedRoundId:roundId,stableWriterBuild:BUILD,updatedAt:now};
    if(c.seedId)plan.sourceSeedId=c.seedId;
    const round={planId:c.canonicalId,sourceSeedId:c.seedId||'',planWeek:v.week,planYear:v.year,theme:v.theme,themeName:v.theme,department:v.department,leaderUid:user?.uid||'afterregistered',leaderName:v.leaderName,coLeaderName:v.coLeaderName,status:'Gjennomført',startedAt:completedAt,completedAt,updatedAt:now,registeredAfterwards:true,stableWriterBuild:BUILD,themeVersion:1,responses:{},employeeInterviews:{},summary:{note:'Etterregistrert fra årsplan',counts:{ok:0,improvement:0,deviation:0,followUp:0}}};
    const updates={[`lor/plans/${c.canonicalId}`]:plan,[`lor/rounds/${roundId}`]:round};
    c.siblings.filter(p=>p.id!==c.canonicalId).forEach(p=>{updates[`lor/plans/${p.id}/year`]=v.year;updates[`lor/plans/${p.id}/week`]=v.week;updates[`lor/plans/${p.id}/status`]='completed';updates[`lor/plans/${p.id}/completedAt`]=completedAt;updates[`lor/plans/${p.id}/completedRoundId`]=roundId;updates[`lor/plans/${p.id}/stableWriterBuild`]=BUILD;updates[`lor/plans/${p.id}/updatedAt`]=now;});
    await db().ref().update(updates);
    const [ps,rs]=await Promise.all([db().ref(`lor/plans/${c.canonicalId}`).once('value'),db().ref(`lor/rounds/${roundId}`).once('value')]);
    if(!ps.exists()||norm(ps.val()?.status)!=='completed'||Number(ps.val()?.week)!==v.week)throw new Error('Planstatus ble ikke bekreftet i Firebase.');
    if(!rs.exists()||norm(rs.val()?.status)!=='gjennomført'||Number(rs.val()?.planWeek)!==v.week)throw new Error('Gjennomført runde ble ikke bekreftet i Firebase.');
    return {id:c.canonicalId,roundId,week:v.week};
  }

  document.addEventListener('click',async event=>{
    const button=event.target?.closest?.('[data-v384-afterregister]');if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(busy)return;
    const form=button.closest('[data-v384-form]');if(!form)return toast('Fant ikke årsplan-skjemaet.',true);
    busy=true;const old=button.textContent;
    try{button.disabled=true;button.textContent='Lagrer…';const result=await afterRegister(form);toast(`Uke ${result.week} er lagret og Firebase-bekreftet ✓`);form.closest('dialog')?.remove();setTimeout(()=>location.reload(),500);}
    catch(error){button.disabled=false;button.textContent=old||'Etterregistrer gjennomført';toast(error?.message||'Lagring feilet.',true);}finally{busy=false;}
  },true);

  document.addEventListener('submit',async event=>{
    const form=event.target;if(!form?.matches?.('[data-v384-form]'))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(busy)return;
    busy=true;const button=form.querySelector('button[type="submit"]'),old=button?.textContent;
    try{if(button){button.disabled=true;button.textContent='Lagrer…';}const result=await savePlan(form);toast(`Uke ${result.week}: endringene er Firebase-bekreftet ✓`);form.closest('dialog')?.remove();setTimeout(()=>location.reload(),350);}
    catch(error){if(button){button.disabled=false;button.textContent=old||'Lagre endringer';}toast(error?.message||'Kunne ikke lagre.',true);}finally{busy=false;}
  },true);

  if(window.firebase?.auth){window.firebase.auth().onAuthStateChanged(user=>{if(user)setTimeout(repairExistingWeek18,100);});}
  window.addEventListener('pageshow',()=>{if(window.firebase?.auth?.().currentUser)setTimeout(repairExistingWeek18,100);});
  window.__lorStableWriter={build:BUILD,repairWeek18:repairExistingWeek18};
})();
