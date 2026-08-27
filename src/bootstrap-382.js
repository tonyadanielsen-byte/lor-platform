(() => {
  const BUILD = '3.8.2';
  let busy = false;

  const db = () => window.firebase.database();
  const norm = v => String(v || '').trim().replace(/\s+/g, ' ');

  function forceCorrectLogo() {
    document.querySelectorAll('.brand-logo').forEach(img => {
      if (!img.getAttribute('src')?.includes('lor-shield-v379.svg')) {
        img.setAttribute('src', './lor-shield-v379.svg');
        img.setAttribute('alt', 'OpEx LOR');
      }
    });
  }

  function notify(message, isError = false) {
    const toast = document.querySelector('#toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.toggle('error', isError);
      toast.classList.add('show');
      clearTimeout(notify.timer);
      notify.timer = setTimeout(() => toast.classList.remove('show'), 6000);
    }
    if (isError) window.alert(message);
  }

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - first) / 86400000) + 1) / 7);
  }

  function selectedYear(form) {
    const selectYear = Number(document.querySelector('[data-v363-year]')?.value);
    if (Number.isFinite(selectYear) && selectYear >= 2026) return selectYear;
    const text = form.closest('dialog')?.querySelector('.eyebrow')?.textContent || '';
    const parsed = Number(text.match(/20\d{2}/)?.[0]);
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  }

  function readForm(form) {
    const fd = new FormData(form);
    const plannedDate = norm(fd.get('plannedDate'));
    const rawWeek = Number(fd.get('week'));
    const week = plannedDate ? (isoWeek(new Date(`${plannedDate}T12:00:00`)) || rawWeek) : rawWeek;
    return {
      year: selectedYear(form),
      week,
      plannedDate,
      leaderName: norm(fd.get('leaderName')),
      theme: norm(fd.get('theme')),
      department: norm(fd.get('department')),
      coLeaderName: norm(fd.get('coLeaderName')),
      completedDate: norm(fd.get('completedDate'))
    };
  }

  async function resolvePlan(form, seedId) {
    const directId = norm(form.dataset.id);
    if (directId) return { id: directId, duplicateIds: [] };

    if (!seedId) return { id: db().ref('lor/plans').push().key, duplicateIds: [] };

    const snap = await db().ref('lor/plans').once('value');
    const matches = [];
    snap.forEach(child => {
      const value = child.val() || {};
      if (String(value.sourceSeedId || '') !== seedId) return;
      matches.push({ id: child.key, updatedAt: Number(value.updatedAt || 0) });
    });
    matches.sort((a, b) => b.updatedAt - a.updatedAt || String(b.id).localeCompare(String(a.id)));
    return {
      id: matches[0]?.id || db().ref('lor/plans').push().key,
      duplicateIds: matches.slice(1).map(x => x.id)
    };
  }

  async function afterRegister(form) {
    if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
    const v = readForm(form);
    if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
    if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
    if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');

    const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
    if (!Number.isFinite(completedAt)) throw new Error('Ugyldig faktisk gjennomført dato.');

    const seedId = norm(form.dataset.seedId);
    const resolved = await resolvePlan(form, seedId);
    const planId = resolved.id;
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
      updatedAt: now
    };
    if (seedId) plan.sourceSeedId = seedId;

    const round = {
      planId,
      sourceSeedId: seedId,
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
      themeVersion: 1,
      responses: {},
      employeeInterviews: {},
      summary: {
        note: 'Etterregistrert fra årsplan',
        counts: { ok: 0, improvement: 0, deviation: 0, followUp: 0 }
      }
    };

    const updates = {
      [`lor/plans/${planId}`]: plan,
      [`lor/rounds/${roundId}`]: round
    };

    for (const duplicateId of resolved.duplicateIds) {
      updates[`lor/plans/${duplicateId}/status`] = 'completed';
      updates[`lor/plans/${duplicateId}/completedAt`] = completedAt;
      updates[`lor/plans/${duplicateId}/completedRoundId`] = roundId;
      updates[`lor/plans/${duplicateId}/updatedAt`] = now;
    }

    await db().ref().update(updates);

    const [planSnap, roundSnap] = await Promise.all([
      db().ref(`lor/plans/${planId}`).once('value'),
      db().ref(`lor/rounds/${roundId}`).once('value')
    ]);

    const savedPlan = planSnap.val() || {};
    const savedRound = roundSnap.val() || {};
    if (!planSnap.exists()) throw new Error('Firebase mangler årsplanposten etter lagring.');
    if (!roundSnap.exists()) throw new Error('Firebase mangler den gjennomførte runden etter lagring.');
    if (String(savedPlan.status) !== 'completed') throw new Error('Årsplanposten ble ikke markert som gjennomført.');
    if (Number(savedPlan.completedAt) !== completedAt) throw new Error('Årsplanposten fikk feil gjennomført dato.');
    if (String(savedRound.planId) !== String(planId)) throw new Error('Gjennomført runde ble koblet til feil plan.');
    if (Number(savedRound.completedAt) !== completedAt) throw new Error('Gjennomført runde fikk feil dato.');

    return { planId, roundId, week: v.week };
  }

  // Denne listeneren registreres synkront i <head>, før alle module-runtimes.
  // Dermed kan ingen eldre årsplan-handler ta etterregistreringsklikket først.
  document.addEventListener('click', async event => {
    const button = event.target?.closest?.('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister],[data-v379-afterregister],[data-v380-afterregister],[data-v381-afterregister]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (busy) return;

    const form = button.closest('form[data-v363-form]');
    if (!form) {
      notify('Etterregistrering feilet: fant ikke årsplan-skjemaet.', true);
      return;
    }

    busy = true;
    const oldText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = 'Etterregistrerer…';
      const result = await afterRegister(form);
      console.info(`[LOR ${BUILD}] Firebase-bekreftet etterregistrering`, result);
      notify(`Uke ${result.week} er etterregistrert og bekreftet i Firebase ✓`);
      form.closest('dialog')?.remove();

      // Full ny innlesing fjerner all gammel runtime-state før årsplanen beregnes på nytt.
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('app', '382');
        url.searchParams.set('refresh', String(Date.now()));
        window.location.replace(url.toString());
      }, 700);
    } catch (error) {
      console.error(`[LOR ${BUILD}] Etterregistrering feilet`, error);
      button.disabled = false;
      button.textContent = oldText || 'Etterregistrer gjennomført';
      notify(`Etterregistrering feilet: ${error?.message || 'ukjent feil'}`, true);
    } finally {
      busy = false;
    }
  }, true);

  const observer = new MutationObserver(forceCorrectLogo);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', forceCorrectLogo);
  setTimeout(forceCorrectLogo, 0);
  setTimeout(forceCorrectLogo, 250);
  setTimeout(forceCorrectLogo, 1000);

  document.documentElement.dataset.lorBootstrap = BUILD;
})();
