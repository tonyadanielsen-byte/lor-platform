import { db } from './firebase.js';

const BUILD = '3.7.9';
let busy = false;

function notify(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) return console[error ? 'error' : 'log'](`[LOR ${BUILD}]`, message);
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove('show'), 4500);
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - first) / 86400000) + 1) / 7);
}

function selectedYear(form) {
  const selected = Number(document.querySelector('[data-v363-year]')?.value);
  if (Number.isFinite(selected) && selected >= 2026) return selected;
  const heading = form.closest('dialog')?.querySelector('.eyebrow')?.textContent || '';
  const parsed = Number(heading.match(/20\d{2}/)?.[0]);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function takeOwnership(root = document) {
  root.querySelectorAll?.('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister],[data-v379-afterregister]').forEach(button => {
    button.removeAttribute('data-v363-afterregister');
    button.removeAttribute('data-v377-afterregister');
    button.removeAttribute('data-v378-afterregister');
    button.setAttribute('data-v379-afterregister', '1');
    button.textContent = 'Etterregistrer gjennomført';
  });
}

function getValues(form) {
  const fd = new FormData(form);
  const plannedDate = String(fd.get('plannedDate') || '').trim();
  const rawWeek = Number(fd.get('week'));
  const week = plannedDate ? (isoWeek(new Date(`${plannedDate}T12:00:00`)) || rawWeek) : rawWeek;
  return {
    year: selectedYear(form),
    week,
    plannedDate,
    leaderName: String(fd.get('leaderName') || '').trim(),
    theme: String(fd.get('theme') || '').trim(),
    department: String(fd.get('department') || '').trim(),
    coLeaderName: String(fd.get('coLeaderName') || '').trim(),
    completedDate: String(fd.get('completedDate') || '').trim()
  };
}

async function resolveLivePlanId(form, seedId) {
  const direct = String(form.dataset.id || '').trim();
  if (direct) return direct;
  if (!seedId) return db.ref('lor/plans').push().key;

  const snap = await db.ref('lor/plans').once('value');
  let match = null;
  snap.forEach(child => {
    const value = child.val() || {};
    if (String(value.sourceSeedId || '') !== seedId) return;
    const candidate = { id: child.key, updatedAt: Number(value.updatedAt || 0) };
    if (!match || candidate.updatedAt >= match.updatedAt) match = candidate;
  });
  return match?.id || db.ref('lor/plans').push().key;
}

async function afterRegister(form) {
  if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
  const v = getValues(form);
  if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
  if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
  if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');

  const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
  if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

  const seedId = String(form.dataset.seedId || '').trim();
  const livePlanId = await resolveLivePlanId(form, seedId);
  const canonicalPlanId = seedId || livePlanId;
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
    planId: canonicalPlanId,
    livePlanId,
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
  updates[`plans/${livePlanId}`] = plan;
  updates[`rounds/${roundId}`] = round;
  await db.ref('lor').update(updates);

  const [planSnap, roundSnap] = await Promise.all([
    db.ref(`lor/plans/${livePlanId}`).once('value'),
    db.ref(`lor/rounds/${roundId}`).once('value')
  ]);
  const savedPlan = planSnap.val() || {};
  const savedRound = roundSnap.val() || {};
  if (!planSnap.exists() || !roundSnap.exists()) throw new Error('Firebase bekreftet ikke lagringen.');
  if (savedPlan.status !== 'completed') throw new Error('Årsplanposten ble ikke markert gjennomført.');
  if (String(savedRound.planId || '') !== canonicalPlanId || Number(savedRound.completedAt) !== completedAt) {
    throw new Error('Gjennomført LOR ble ikke koblet korrekt til årsplanen.');
  }

  if (v.coLeaderName) {
    const participantSnap = await db.ref('lor/participants').once('value').catch(() => null);
    let exists = false;
    participantSnap?.forEach(child => {
      if (String(child.val()?.name || '').trim().toLocaleLowerCase('nb-NO') === v.coLeaderName.toLocaleLowerCase('nb-NO')) exists = true;
    });
    if (!exists) db.ref('lor/participants').push().set({ name:v.coLeaderName, createdAt:now, updatedAt:now }).catch(() => {});
  }

  return { livePlanId, canonicalPlanId, roundId };
}

async function forceAnnualRefresh() {
  await new Promise(resolve => setTimeout(resolve, 120));
  const annual = document.querySelector('[data-v363-annual]');
  if (annual) annual.click();
  await new Promise(resolve => setTimeout(resolve, 250));
  if (document.querySelector('.v363-annual-main') && annual) annual.click();
}

function apply() {
  takeOwnership(document);
  document.documentElement.dataset.lorBuild = BUILD;
}

document.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister],[data-v379-afterregister]');
  if (button) takeOwnership(button.closest('dialog') || document);
}, true);

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-v379-afterregister]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (busy) return;
  const form = button.closest('form[data-v363-form]');
  if (!form) return;

  busy = true;
  try {
    button.disabled = true;
    button.textContent = 'Etterregistrerer…';
    await afterRegister(form);
    form.closest('dialog')?.remove();
    await forceAnnualRefresh();
    notify('Runden er etterregistrert og koblet til årsplanen ✓');
  } catch (error) {
    console.error(`[LOR ${BUILD}] Etterregistrering feilet`, error);
    button.disabled = false;
    button.textContent = 'Etterregistrer gjennomført';
    notify(error?.message || 'Etterregistrering feilet.', true);
  } finally {
    busy = false;
  }
}, true);

new MutationObserver(() => requestAnimationFrame(apply)).observe(document.documentElement, { childList:true, subtree:true });
[0, 70, 180, 450].forEach(ms => setTimeout(apply, ms));
