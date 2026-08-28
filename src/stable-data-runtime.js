(() => {
  const BUILD = '3.8.13';
  let busy = false;

  const db = () => window.firebase.database();
  const ts = () => window.firebase.database.ServerValue.TIMESTAMP;
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');

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
    return items
      .filter(p => String(p.status || '').toLowerCase() === 'completed' || Number(p.completedAt) > 0)
      .sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0))[0] || null;
  }

  async function savePlan(form) {
    if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
    const v = values(form);
    validate(v);
    const c = await context(form);
    const completed = completionFrom([c.existing, ...c.siblings]);
    const payload = {
      ...c.existing,
      year: v.year,
      week: v.week,
      plannedDate: v.plannedDate,
      leaderName: v.leaderName,
      ownerName: v.leaderName,
      theme: v.theme,
      themeName: v.theme,
      department: v.department,
      coLeaderName: v.coLeaderName,
      status: completed ? 'completed' : (String(c.existing.status || '').toLowerCase() === 'completed' ? 'completed' : 'planned'),
      stableWriterBuild: BUILD,
      updatedAt: ts()
    };
    if (c.seedId) payload.sourceSeedId = c.seedId;
    if (completed) {
      payload.completedAt = Number(completed.completedAt || 0);
      payload.completedRoundId = completed.completedRoundId || c.existing.completedRoundId || '';
    }
    delete payload.id;

    const updates = { [`lor/plans/${c.canonicalId}`]: payload };
    c.siblings.filter(p => p.id !== c.canonicalId).forEach(p => {
      updates[`lor/plans/${p.id}/year`] = v.year;
      updates[`lor/plans/${p.id}/week`] = v.week;
      updates[`lor/plans/${p.id}/plannedDate`] = v.plannedDate || null;
      updates[`lor/plans/${p.id}/leaderName`] = v.leaderName;
      updates[`lor/plans/${p.id}/ownerName`] = v.leaderName;
      updates[`lor/plans/${p.id}/theme`] = v.theme;
      updates[`lor/plans/${p.id}/themeName`] = v.theme;
      updates[`lor/plans/${p.id}/department`] = v.department;
      updates[`lor/plans/${p.id}/coLeaderName`] = v.coLeaderName;
      updates[`lor/plans/${p.id}/stableWriterBuild`] = BUILD;
      updates[`lor/plans/${p.id}/updatedAt`] = ts();
    });
    await db().ref().update(updates);

    const verify = await db().ref(`lor/plans/${c.canonicalId}`).once('value');
    const saved = verify.val();
    if (!verify.exists() || Number(saved?.week) !== v.week || clean(saved?.leaderName) !== v.leaderName || clean(saved?.theme) !== v.theme) {
      throw new Error('Firebase bekreftet ikke de lagrede endringene.');
    }
    return { id: c.canonicalId, week: v.week };
  }

  async function afterRegister(form) {
    if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
    const v = values(form);
    validate(v);
    if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
    const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
    if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

    const c = await context(form);
    const roundId = db().ref('lor/rounds').push().key;
    const user = window.firebase.auth().currentUser;
    const now = Date.now();
    const plan = {
      year: v.year,
      week: v.week,
      plannedDate: v.plannedDate,
      leaderName: v.leaderName,
      ownerName: v.leaderName,
      theme: v.theme,
      themeName: v.theme,
      department: v.department,
      coLeaderName: v.coLeaderName,
      status: 'completed',
      completedAt,
      completedRoundId: roundId,
      stableWriterBuild: BUILD,
      updatedAt: now
    };
    if (c.seedId) plan.sourceSeedId = c.seedId;

    const round = {
      planId: c.canonicalId,
      sourceSeedId: c.seedId || '',
      planWeek: v.week,
      planYear: v.year,
      theme: v.theme,
      themeName: v.theme,
      department: v.department,
      leaderUid: user?.uid || 'afterregistered',
      leaderName: v.leaderName,
      coLeaderName: v.coLeaderName,
      status: 'Gjennomført',
      startedAt: completedAt,
      completedAt,
      updatedAt: now,
      registeredAfterwards: true,
      stableWriterBuild: BUILD,
      themeVersion: 1,
      responses: {},
      employeeInterviews: {},
      summary: { note: 'Etterregistrert fra årsplan', counts: { ok: 0, improvement: 0, deviation: 0, followUp: 0 } }
    };

    const updates = {
      [`lor/plans/${c.canonicalId}`]: plan,
      [`lor/rounds/${roundId}`]: round
    };
    c.siblings.filter(p => p.id !== c.canonicalId).forEach(p => {
      updates[`lor/plans/${p.id}/year`] = v.year;
      updates[`lor/plans/${p.id}/week`] = v.week;
      updates[`lor/plans/${p.id}/status`] = 'completed';
      updates[`lor/plans/${p.id}/completedAt`] = completedAt;
      updates[`lor/plans/${p.id}/completedRoundId`] = roundId;
      updates[`lor/plans/${p.id}/stableWriterBuild`] = BUILD;
      updates[`lor/plans/${p.id}/updatedAt`] = now;
    });
    await db().ref().update(updates);

    const [ps, rs] = await Promise.all([
      db().ref(`lor/plans/${c.canonicalId}`).once('value'),
      db().ref(`lor/rounds/${roundId}`).once('value')
    ]);
    if (!ps.exists() || String(ps.val()?.status) !== 'completed' || Number(ps.val()?.week) !== v.week) throw new Error('Planstatus ble ikke bekreftet i Firebase.');
    if (!rs.exists() || String(rs.val()?.status) !== 'Gjennomført' || Number(rs.val()?.planWeek) !== v.week) throw new Error('Gjennomført runde ble ikke bekreftet i Firebase.');
    return { id: c.canonicalId, roundId, week: v.week };
  }

  document.addEventListener('click', async event => {
    const button = event.target?.closest?.('[data-v384-afterregister]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (busy) return;
    const form = button.closest('[data-v384-form]');
    if (!form) return toast('Fant ikke årsplan-skjemaet.', true);
    busy = true;
    const old = button.textContent;
    try {
      button.disabled = true;
      button.textContent = 'Lagrer…';
      const result = await afterRegister(form);
      toast(`Uke ${result.week} er lagret og Firebase-bekreftet ✓`);
      form.closest('dialog')?.remove();
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      button.disabled = false;
      button.textContent = old || 'Etterregistrer gjennomført';
      toast(error?.message || 'Lagring feilet.', true);
    } finally { busy = false; }
  }, true);

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form?.matches?.('[data-v384-form]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    const old = button?.textContent;
    try {
      if (button) { button.disabled = true; button.textContent = 'Lagrer…'; }
      const result = await savePlan(form);
      toast(`Uke ${result.week}: endringene er Firebase-bekreftet ✓`);
      form.closest('dialog')?.remove();
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = old || 'Lagre endringer'; }
      toast(error?.message || 'Kunne ikke lagre.', true);
    } finally { busy = false; }
  }, true);

  window.__lorStableWriter = { build: BUILD };
})();
