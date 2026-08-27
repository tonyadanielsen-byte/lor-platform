import { db } from './firebase.js';

const BUILD = '3.7.8';
let applying = false;

function toast(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) return console[error ? 'error' : 'log'](`[LOR ${BUILD}]`, message);
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4200);
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - first) / 86400000) + 1) / 7);
}

function selectedYear(form) {
  const y = Number(document.querySelector('[data-v363-year]')?.value);
  if (Number.isFinite(y) && y >= 2026) return y;
  const eyebrow = form.closest('dialog')?.querySelector('.eyebrow')?.textContent || '';
  const parsed = Number(eyebrow.match(/20\d{2}/)?.[0]);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function takeoverButton(root = document) {
  root.querySelectorAll?.('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister]').forEach(button => {
    button.removeAttribute('data-v363-afterregister');
    button.removeAttribute('data-v377-afterregister');
    button.setAttribute('data-v378-afterregister', '1');
    button.textContent = 'Etterregistrer gjennomført';
  });
}

function values(form) {
  const fd = new FormData(form);
  const plannedDate = String(fd.get('plannedDate') || '');
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

async function registerCompleted(form) {
  if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
  const v = values(form);
  if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
  if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
  if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');

  const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
  if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

  const existingPlanId = String(form.dataset.id || '').trim();
  const seedId = String(form.dataset.seedId || '').trim();
  const planId = existingPlanId || db.ref('lor/plans').push().key;
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
    sourceSeedId: seedId || '',
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
  updates[`plans/${planId}`] = plan;
  updates[`rounds/${roundId}`] = round;
  await db.ref('lor').update(updates);

  const [planSnap, roundSnap] = await Promise.all([
    db.ref(`lor/plans/${planId}`).once('value'),
    db.ref(`lor/rounds/${roundId}`).once('value')
  ]);
  if (!planSnap.exists() || !roundSnap.exists()) {
    throw new Error('Firebase bekreftet ikke lagringen. Ingenting er markert som gjennomført.');
  }
  const savedPlan = planSnap.val() || {};
  const savedRound = roundSnap.val() || {};
  if (savedPlan.status !== 'completed' || Number(savedRound.completedAt) !== completedAt) {
    throw new Error('Etterregistreringen ble ikke lagret korrekt.');
  }

  if (v.coLeaderName) {
    const pSnap = await db.ref('lor/participants').orderByChild('name').equalTo(v.coLeaderName).once('value').catch(() => null);
    if (!pSnap || !pSnap.exists()) {
      db.ref('lor/participants').push().set({ name:v.coLeaderName, createdAt:now, updatedAt:now }).catch(() => {});
    }
  }

  return { planId, roundId };
}

async function refreshAnnualView() {
  await new Promise(resolve => setTimeout(resolve, 180));
  const annual = document.querySelector('[data-v363-annual]');
  if (annual) {
    annual.click();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function apply() {
  if (applying) return;
  applying = true;
  takeoverButton(document);
  document.querySelectorAll('.v370-annual-plan .v36-row.overdue').forEach(row => row.classList.add('v378-overdue'));
  applying = false;
}

// Pointer/keyboard takeover happens before the older click handlers.
document.addEventListener('pointerdown', event => {
  const b = event.target.closest('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister]');
  if (b) takeoverButton(b.closest('dialog') || document);
}, true);
document.addEventListener('keydown', event => {
  if (!['Enter',' '].includes(event.key)) return;
  const b = event.target.closest('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister]');
  if (b) takeoverButton(b.closest('dialog') || document);
}, true);

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-v378-afterregister]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = button.closest('form[data-v363-form]');
  if (!form) return;
  try {
    button.disabled = true;
    button.textContent = 'Etterregistrerer…';
    await registerCompleted(form);
    form.closest('dialog')?.remove();
    await refreshAnnualView();
    toast('Runden er etterregistrert og bekreftet lagret ✓');
  } catch (error) {
    console.error(`[LOR ${BUILD}]`, error);
    button.disabled = false;
    button.textContent = 'Etterregistrer gjennomført';
    toast(error?.message || 'Etterregistrering feilet.', true);
  }
}, true);

new MutationObserver(() => requestAnimationFrame(apply)).observe(document.documentElement, { childList:true, subtree:true });
[0, 60, 180, 450].forEach(ms => setTimeout(apply, ms));
