import { db } from './firebase.js';

const BUILD = '3.8.1';
let busy = false;

function notify(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) {
    if (error) alert(message);
    else console.log(`[LOR ${BUILD}] ${message}`);
    return;
  }
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove('show'), 5000);
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - first) / 86400000) + 1) / 7);
}

function getYear(form) {
  const yearSelect = document.querySelector('[data-v363-year]');
  const selected = Number(yearSelect?.value);
  if (Number.isFinite(selected) && selected >= 2026) return selected;
  const label = form.closest('dialog')?.querySelector('.eyebrow')?.textContent || '';
  const parsed = Number(label.match(/20\d{2}/)?.[0]);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function readForm(form) {
  const fd = new FormData(form);
  const plannedDate = String(fd.get('plannedDate') || '').trim();
  const rawWeek = Number(fd.get('week'));
  const week = plannedDate ? (isoWeek(new Date(`${plannedDate}T12:00:00`)) || rawWeek) : rawWeek;
  return {
    year: getYear(form),
    week,
    plannedDate,
    leaderName: String(fd.get('leaderName') || '').trim(),
    theme: String(fd.get('theme') || '').trim(),
    department: String(fd.get('department') || '').trim(),
    coLeaderName: String(fd.get('coLeaderName') || '').trim(),
    completedDate: String(fd.get('completedDate') || '').trim()
  };
}

async function resolvePlan(form, seedId) {
  const directId = String(form.dataset.id || '').trim();
  if (directId) return { id: directId, duplicateIds: [] };

  if (!seedId) return { id: db.ref('lor/plans').push().key, duplicateIds: [] };

  const snap = await db.ref('lor/plans').once('value');
  const matches = [];
  snap.forEach(child => {
    const value = child.val() || {};
    if (String(value.sourceSeedId || '') !== seedId) return;
    matches.push({
      id: child.key,
      updatedAt: Number(value.updatedAt || 0),
      value
    });
  });

  matches.sort((a, b) => b.updatedAt - a.updatedAt || String(b.id).localeCompare(String(a.id)));
  return {
    id: matches[0]?.id || db.ref('lor/plans').push().key,
    duplicateIds: matches.slice(1).map(x => x.id)
  };
}

async function register(form) {
  if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
  const v = readForm(form);
  if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
  if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
  if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');

  const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
  if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

  const seedId = String(form.dataset.seedId || '').trim();
  const resolved = await resolvePlan(form, seedId);
  const planId = resolved.id;
  const roundId = db.ref('lor/rounds').push().key;
  const user = window.firebase?.auth?.().currentUser;
  const now = Date.now();

  const plan = {
    year: v.year,
    week: v.week,
    plannedDate: v.plannedDate,
    leaderName: v.leaderName,
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

  const updates = {};
  updates[`lor/plans/${planId}`] = plan;
  updates[`lor/rounds/${roundId}`] = round;

  // Eventuelle eldre dubletter fra samme Excel-rad får samme gjennomført-status.
  // Dette hindrer at mergedRows velger en gammel "planned"-dublett etter lagring.
  for (const duplicateId of resolved.duplicateIds) {
    updates[`lor/plans/${duplicateId}/status`] = 'completed';
    updates[`lor/plans/${duplicateId}/completedAt`] = completedAt;
    updates[`lor/plans/${duplicateId}/completedRoundId`] = roundId;
    updates[`lor/plans/${duplicateId}/updatedAt`] = now;
  }

  await db.ref().update(updates);

  const [planSnap, roundSnap] = await Promise.all([
    db.ref(`lor/plans/${planId}`).once('value'),
    db.ref(`lor/rounds/${roundId}`).once('value')
  ]);
  const savedPlan = planSnap.val() || {};
  const savedRound = roundSnap.val() || {};

  if (!planSnap.exists()) throw new Error('Årsplanposten finnes ikke etter lagring.');
  if (!roundSnap.exists()) throw new Error('Gjennomført LOR finnes ikke etter lagring.');
  if (savedPlan.status !== 'completed') throw new Error('Årsplanposten fikk ikke status gjennomført.');
  if (Number(savedPlan.completedAt) !== completedAt) throw new Error('Gjennomført dato ble ikke lagret på årsplanposten.');
  if (String(savedRound.planId || '') !== String(planId)) throw new Error('Gjennomført LOR ble koblet til feil plan-ID.');
  if (Number(savedRound.completedAt) !== completedAt) throw new Error('Gjennomført dato ble ikke lagret på LOR-runden.');

  return { planId, roundId, seedId, duplicateCount: resolved.duplicateIds.length };
}

async function forceAnnualRebuild() {
  // Gi Firebase-listenerne tid til å motta plan + round før årsplanen bygges på nytt.
  for (const delay of [120, 350, 800]) {
    await new Promise(resolve => setTimeout(resolve, delay));
    const annual = document.querySelector('[data-v363-annual]');
    if (annual) annual.click();
  }
}

// Viktig: denne listeneren lastes FØR v363-runtime.js og får derfor første rett
// på etterregistreringsklikket. Alle eldre handlere stoppes eksplisitt.
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister],[data-v379-afterregister],[data-v380-afterregister],[data-v381-afterregister]');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (busy) return;

  const form = button.closest('form[data-v363-form]');
  if (!form) {
    notify('Fant ikke årsplan-skjemaet for etterregistrering.', true);
    return;
  }

  busy = true;
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = 'Etterregistrerer…';
    const result = await register(form);
    console.info(`[LOR ${BUILD}] Etterregistrering bekreftet`, result);
    form.closest('dialog')?.remove();
    await forceAnnualRebuild();
    notify('Runden er etterregistrert og bekreftet i Firebase ✓');
  } catch (error) {
    console.error(`[LOR ${BUILD}] Etterregistrering feilet`, error);
    button.disabled = false;
    button.textContent = originalText || 'Etterregistrer gjennomført';
    notify(`Etterregistrering feilet: ${error?.message || 'ukjent feil'}`, true);
  } finally {
    busy = false;
  }
}, true);

document.documentElement.dataset.afterRegisterBuild = BUILD;
