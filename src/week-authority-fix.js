import { db, serverTimestamp } from './firebase.js';

const BUILD = '3.8.10';
const TARGET_SEED_ID = 'seed-2026-18-2';

function isoWeekFromDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function normalizeForm(form) {
  if (!form?.matches?.('[data-v384-form]')) return;
  const weekInput = form.querySelector('input[name="week"]');
  const dateInput = form.querySelector('input[name="plannedDate"]');
  if (!weekInput || !dateInput) return;
  const week = Number(weekInput.value);
  const dateWeek = isoWeekFromDate(dateInput.value);
  if (Number.isFinite(week) && dateInput.value && dateWeek && dateWeek !== week) {
    dateInput.value = '';
  }
}

// Uke-feltet er autoritativt. En gammel planlagt dato skal aldri kunne skrive uken tilbake.
document.addEventListener('input', event => {
  const weekInput = event.target.closest?.('input[name="week"]');
  if (!weekInput) return;
  normalizeForm(weekInput.closest('[data-v384-form]'));
}, true);

document.addEventListener('change', event => {
  const dateInput = event.target.closest?.('input[name="plannedDate"]');
  if (!dateInput) return;
  const form = dateInput.closest('[data-v384-form]');
  const weekInput = form?.querySelector('input[name="week"]');
  const dateWeek = isoWeekFromDate(dateInput.value);
  if (weekInput && dateWeek) weekInput.value = String(dateWeek);
}, true);

document.addEventListener('click', event => {
  const action = event.target.closest?.('[data-v384-afterregister],[data-v384-start]');
  if (!action) return;
  normalizeForm(action.closest('[data-v384-form]'));
}, true);

document.addEventListener('submit', event => {
  normalizeForm(event.target);
}, true);

const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');
const first = value => norm(value).split(/\s+/)[0] || '';

function looksLikeWeek18Plan(plan) {
  if (String(plan?.sourceSeedId || '') === TARGET_SEED_ID) return true;
  return Number(plan?.year || 2026) === 2026 &&
    Number(plan?.week) === 17 &&
    first(plan?.leaderName || plan?.ownerName) === 'kenneth' &&
    norm(plan?.theme || plan?.themeName) === 'rutinebeskrivelser' &&
    norm(plan?.department) === 'rekvisita';
}

function looksLikeWeek18Round(round, repairedPlanIds) {
  if (String(round?.sourceSeedId || '') === TARGET_SEED_ID) return true;
  if (repairedPlanIds.has(String(round?.planId || ''))) return true;
  return Number(round?.planYear || 2026) === 2026 &&
    Number(round?.planWeek) === 17 &&
    !!round?.registeredAfterwards &&
    first(round?.leaderName) === 'kenneth' &&
    norm(round?.theme || round?.themeName) === 'rutinebeskrivelser' &&
    norm(round?.department) === 'rekvisita';
}

async function repairWeek18() {
  const user = window.firebase?.auth?.().currentUser;
  if (!user) return;

  const [plansSnap, roundsSnap] = await Promise.all([
    db.ref('lor/plans').once('value'),
    db.ref('lor/rounds').once('value')
  ]);

  const updates = {};
  const repairedPlanIds = new Set();
  const plans = [];
  plansSnap.forEach(child => plans.push({ id: child.key, ...(child.val() || {}) }));
  const rounds = [];
  roundsSnap.forEach(child => rounds.push({ id: child.key, ...(child.val() || {}) }));

  plans.filter(looksLikeWeek18Plan).forEach(plan => {
    repairedPlanIds.add(String(plan.id));
    updates[`lor/plans/${plan.id}/year`] = 2026;
    updates[`lor/plans/${plan.id}/week`] = 18;
    updates[`lor/plans/${plan.id}/sourceSeedId`] = TARGET_SEED_ID;
    if (plan.plannedDate && isoWeekFromDate(plan.plannedDate) === 17) {
      updates[`lor/plans/${plan.id}/plannedDate`] = null;
    }
    updates[`lor/plans/${plan.id}/weekPersistenceFix`] = BUILD;
    updates[`lor/plans/${plan.id}/updatedAt`] = serverTimestamp();
  });

  const matchedRounds = rounds.filter(round => looksLikeWeek18Round(round, repairedPlanIds));
  matchedRounds.forEach(round => {
    updates[`lor/rounds/${round.id}/planYear`] = 2026;
    updates[`lor/rounds/${round.id}/planWeek`] = 18;
    updates[`lor/rounds/${round.id}/sourceSeedId`] = TARGET_SEED_ID;
    updates[`lor/rounds/${round.id}/weekPersistenceFix`] = BUILD;
    updates[`lor/rounds/${round.id}/updatedAt`] = serverTimestamp();
  });

  const completedRound = [...matchedRounds]
    .filter(round => Number(round.completedAt) > 0 || norm(round.status) === 'gjennomført')
    .sort((a, b) => Number(b.completedAt || b.startedAt || 0) - Number(a.completedAt || a.startedAt || 0))[0];

  if (completedRound) {
    let targetPlanId = [...repairedPlanIds][0];
    if (!targetPlanId) targetPlanId = `completion-${TARGET_SEED_ID}`;
    const existing = plans.find(plan => String(plan.id) === String(targetPlanId)) || {};
    updates[`lor/plans/${targetPlanId}`] = {
      ...existing,
      sourceSeedId: TARGET_SEED_ID,
      year: 2026,
      week: 18,
      leaderName: existing.leaderName || completedRound.leaderName || 'Kenneth',
      ownerName: existing.ownerName || completedRound.leaderName || 'Kenneth',
      theme: existing.theme || completedRound.theme || completedRound.themeName || 'Rutinebeskrivelser',
      themeName: existing.themeName || completedRound.theme || completedRound.themeName || 'Rutinebeskrivelser',
      department: existing.department || completedRound.department || 'Rekvisita',
      coLeaderName: existing.coLeaderName || completedRound.coLeaderName || '',
      status: 'completed',
      completedAt: Number(completedRound.completedAt || completedRound.startedAt || Date.now()),
      completedRoundId: completedRound.id,
      weekPersistenceFix: BUILD,
      updatedAt: serverTimestamp()
    };
  }

  if (Object.keys(updates).length) await db.ref().update(updates);
}

let repairRunning = false;
async function runRepair() {
  if (repairRunning) return;
  repairRunning = true;
  try {
    await repairWeek18();
  } catch (error) {
    console.error('[LOR Week Authority Fix]', error);
  } finally {
    repairRunning = false;
  }
}

window.firebase.auth().onAuthStateChanged(user => {
  if (user) runRepair();
});
window.addEventListener('pageshow', () => {
  if (window.firebase?.auth?.().currentUser) runRepair();
});

window.__lorWeekAuthorityFix = { build: BUILD, run: runRepair };
