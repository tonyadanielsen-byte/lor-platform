import { db, serverTimestamp } from './firebase.js';

const BUILD = '3.8.9';
const SEED_PATH = './data/seed/plan-2026.json';
const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');
const first = value => norm(value).split(/\s+/)[0] || '';

function rowsFrom(snapshot) {
  const rows = [];
  snapshot.forEach(child => rows.push({ id: child.key, ...(child.val() || {}) }));
  return rows;
}

function isCompletedRound(round) {
  const status = norm(round?.status);
  return Number(round?.completedAt) > 0 || ['gjennomført', 'oppfølging pågår', 'lukket'].includes(status);
}

function roundYear(round, fallbackYear) {
  if (Number(round?.planYear)) return Number(round.planYear);
  const time = Number(round?.completedAt || round?.startedAt || 0);
  return time ? new Date(time).getFullYear() : Number(fallbackYear);
}

function matchRound(seed, seedId, rounds, plansById) {
  const exact = rounds
    .filter(isCompletedRound)
    .filter(round => {
      if (String(round.sourceSeedId || '') === seedId) return true;
      const linked = plansById.get(String(round.planId || ''));
      return String(linked?.sourceSeedId || '') === seedId;
    })
    .sort((a, b) => Number(b.completedAt || b.startedAt || 0) - Number(a.completedAt || a.startedAt || 0))[0];
  if (exact) return exact;

  const candidates = rounds.filter(round => {
    if (!isCompletedRound(round)) return false;
    if (roundYear(round, seed.year) !== Number(seed.year)) return false;
    if (Number(round.planWeek) !== Number(seed.week)) return false;

    const themeMatch = !!seed.themeName && norm(round.theme || round.themeName) === norm(seed.themeName);
    const departmentMatch = !!seed.department && norm(round.department) === norm(seed.department);
    const leaderMatch = !!seed.ownerName && first(round.leaderName) === first(seed.ownerName);

    if (themeMatch && (departmentMatch || leaderMatch)) return true;
    if (round.registeredAfterwards && departmentMatch && leaderMatch) return true;
    return false;
  });

  return candidates.sort((a, b) => Number(b.completedAt || b.startedAt || 0) - Number(a.completedAt || a.startedAt || 0))[0] || null;
}

async function reconcile() {
  const user = window.firebase?.auth?.().currentUser;
  if (!user) return;

  const seedResponse = await fetch(`${SEED_PATH}?guard=${BUILD}`, { cache: 'no-store' });
  if (!seedResponse.ok) throw new Error('Kunne ikke laste LOR-årsplan for lagringskontroll.');
  const seedPlan = await seedResponse.json();

  const [plansSnap, roundsSnap] = await Promise.all([
    db.ref('lor/plans').once('value'),
    db.ref('lor/rounds').once('value')
  ]);

  const plans = rowsFrom(plansSnap);
  const rounds = rowsFrom(roundsSnap);
  const plansById = new Map(plans.map(plan => [String(plan.id), plan]));
  const updates = {};

  (seedPlan.records || []).forEach((record, index) => {
    const week = Number(record.week);
    if (!Number.isFinite(week) || !record.themeName) return;

    const seed = { ...record, year: Number(seedPlan.year || 2026), week };
    const seedId = `seed-${seed.year}-${seed.week}-${index}`;
    const round = matchRound(seed, seedId, rounds, plansById);
    if (!round) return;

    const group = plans
      .filter(plan => String(plan.sourceSeedId || '') === seedId || String(plan.id || '') === seedId)
      .sort((a, b) => Number(b.updatedAt || b.completedAt || 0) - Number(a.updatedAt || a.completedAt || 0));
    const existing = group[0] || null;
    const targetId = existing?.id || `completion-${seedId}`;
    const completedAt = Number(round.completedAt || round.startedAt || Date.now());

    if (existing) {
      updates[`lor/plans/${targetId}/sourceSeedId`] = seedId;
      updates[`lor/plans/${targetId}/status`] = 'completed';
      updates[`lor/plans/${targetId}/completedAt`] = completedAt;
      updates[`lor/plans/${targetId}/completedRoundId`] = round.id;
      updates[`lor/plans/${targetId}/updatedAt`] = serverTimestamp();
      return;
    }

    updates[`lor/plans/${targetId}`] = {
      sourceSeedId: seedId,
      year: seed.year,
      week: seed.week,
      leaderName: seed.ownerName || round.leaderName || '',
      ownerName: seed.ownerName || round.leaderName || '',
      theme: seed.themeName || round.theme || '',
      themeName: seed.themeName || round.theme || '',
      department: seed.department || round.department || '',
      coLeaderName: round.coLeaderName || '',
      status: 'completed',
      completedAt,
      completedRoundId: round.id,
      recoveredFromRound: true,
      persistenceGuardBuild: BUILD,
      updatedAt: serverTimestamp()
    };
  });

  if (Object.keys(updates).length) await db.ref().update(updates);
}

let running = false;
async function runGuard() {
  if (running) return;
  running = true;
  try {
    await reconcile();
  } catch (error) {
    console.error('[LOR Persistence Guard]', error);
  } finally {
    running = false;
  }
}

window.firebase.auth().onAuthStateChanged(user => {
  if (user) runGuard();
});
window.addEventListener('pageshow', () => {
  if (window.firebase?.auth?.().currentUser) runGuard();
});
window.__lorPersistenceGuard = { run: runGuard, build: BUILD };
