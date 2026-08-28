import { db, serverTimestamp } from './firebase.js';

const BUILD = '3.8.12';
const SEED_PATH = './data/seed/plan-2026.json';
const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');
const first = value => norm(value).split(/\s+/)[0] || '';

function rowsFrom(snapshot) {
  const rows = [];
  snapshot.forEach(child => rows.push({ id: child.key, ...(child.val() || {}) }));
  return rows;
}

function isCompleted(value) {
  const status = norm(value?.status);
  return Number(value?.completedAt) > 0 || ['completed', 'gjennomført', 'oppfølging pågår', 'lukket'].includes(status);
}

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

function fingerprint(value, year = 2026) {
  return [
    Number(value?.year || value?.planYear || year),
    first(value?.leaderName || value?.ownerName),
    norm(value?.theme || value?.themeName),
    norm(value?.department)
  ].join('|');
}

let seedRows = [];
let seedById = new Map();
let seedsByFingerprint = new Map();
let seedLoaded = false;

async function loadSeeds() {
  if (seedLoaded) return;
  const response = await fetch(`${SEED_PATH}?canonical=${BUILD}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Kunne ikke laste årsplanen for datakontroll.');
  const plan = await response.json();
  const year = Number(plan.year || 2026);
  seedRows = (plan.records || []).map((row, index) => ({
    id: `seed-${year}-${row.week}-${index}`,
    year,
    week: Number(row.week),
    leaderName: row.ownerName || '',
    ownerName: row.ownerName || '',
    theme: row.themeName || '',
    themeName: row.themeName || '',
    department: row.department || ''
  })).filter(row => Number.isFinite(row.week));
  seedById = new Map(seedRows.map(row => [row.id, row]));
  seedsByFingerprint = new Map();
  seedRows.forEach(row => {
    const key = fingerprint(row, year);
    const list = seedsByFingerprint.get(key) || [];
    list.push(row);
    seedsByFingerprint.set(key, list);
  });
  seedLoaded = true;
}

function seedForPlan(plan) {
  const direct = seedById.get(String(plan?.sourceSeedId || '')) || seedById.get(String(plan?.id || ''));
  if (direct) return direct;
  if (!isCompleted(plan) && !plan?.completedRoundId) return null;
  const candidates = seedsByFingerprint.get(fingerprint(plan, plan?.year || 2026)) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function seedForRound(round, plansById) {
  const direct = seedById.get(String(round?.sourceSeedId || ''));
  if (direct) return direct;
  const linked = plansById.get(String(round?.planId || ''));
  const fromPlan = linked ? seedForPlan(linked) : null;
  if (fromPlan) return fromPlan;
  if (!isCompleted(round)) return null;
  const candidates = seedsByFingerprint.get(fingerprint(round, round?.planYear || 2026)) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function setIfDifferent(updates, path, current, desired) {
  const same = desired === null ? (current === null || current === undefined || current === '') : String(current ?? '') === String(desired ?? '');
  if (!same) updates[path] = desired;
}

async function reconcile() {
  if (!window.firebase?.auth?.().currentUser) return;
  await loadSeeds();

  const [plansSnap, roundsSnap] = await Promise.all([
    db.ref('lor/plans').once('value'),
    db.ref('lor/rounds').once('value')
  ]);

  const plans = rowsFrom(plansSnap);
  const rounds = rowsFrom(roundsSnap);
  const plansById = new Map(plans.map(plan => [String(plan.id), plan]));
  const updates = {};
  const seedCompletion = new Map();

  // First: identify completed rounds and their canonical seed row.
  rounds.filter(isCompleted).forEach(round => {
    const seed = seedForRound(round, plansById);
    if (!seed) return;
    const existing = seedCompletion.get(seed.id);
    if (!existing || Number(round.completedAt || round.startedAt || 0) > Number(existing.completedAt || existing.startedAt || 0)) {
      seedCompletion.set(seed.id, round);
    }

    setIfDifferent(updates, `lor/rounds/${round.id}/sourceSeedId`, round.sourceSeedId, seed.id);
    setIfDifferent(updates, `lor/rounds/${round.id}/planYear`, round.planYear, seed.year);
    setIfDifferent(updates, `lor/rounds/${round.id}/planWeek`, round.planWeek, seed.week);
  });

  // Second: canonicalize every completed plan. Plain future/planned rows remain editable.
  plans.forEach(plan => {
    const seed = seedForPlan(plan);
    if (!seed) return;
    const completedRound = seedCompletion.get(seed.id);
    const shouldLockToSeed = isCompleted(plan) || !!plan.completedRoundId || !!completedRound;
    if (!shouldLockToSeed) return;

    setIfDifferent(updates, `lor/plans/${plan.id}/sourceSeedId`, plan.sourceSeedId, seed.id);
    setIfDifferent(updates, `lor/plans/${plan.id}/year`, plan.year, seed.year);
    setIfDifferent(updates, `lor/plans/${plan.id}/week`, plan.week, seed.week);
    if (plan.plannedDate && isoWeekFromDate(plan.plannedDate) !== seed.week) {
      updates[`lor/plans/${plan.id}/plannedDate`] = null;
    }

    if (completedRound) {
      const completedAt = Number(completedRound.completedAt || completedRound.startedAt || plan.completedAt || Date.now());
      setIfDifferent(updates, `lor/plans/${plan.id}/status`, plan.status, 'completed');
      setIfDifferent(updates, `lor/plans/${plan.id}/completedAt`, plan.completedAt, completedAt);
      setIfDifferent(updates, `lor/plans/${plan.id}/completedRoundId`, plan.completedRoundId, completedRound.id);
    }
  });

  // Third: if a completed round exists, ensure ALL duplicates for that seed are completed.
  for (const [seedId, round] of seedCompletion.entries()) {
    const seed = seedById.get(seedId);
    if (!seed) continue;
    const completedAt = Number(round.completedAt || round.startedAt || Date.now());
    let group = plans.filter(plan => String(plan.sourceSeedId || '') === seedId || String(plan.id || '') === seedId);

    // Recover older completed rows that were written without sourceSeedId.
    if (!group.length) {
      group = plans.filter(plan => isCompleted(plan) && fingerprint(plan, plan.year || seed.year) === fingerprint(seed, seed.year));
    }

    if (!group.length) {
      const id = `completion-${seedId}`;
      updates[`lor/plans/${id}`] = {
        sourceSeedId: seedId,
        year: seed.year,
        week: seed.week,
        leaderName: seed.leaderName || round.leaderName || '',
        ownerName: seed.ownerName || round.leaderName || '',
        theme: seed.theme || round.theme || round.themeName || '',
        themeName: seed.themeName || round.theme || round.themeName || '',
        department: seed.department || round.department || '',
        coLeaderName: round.coLeaderName || '',
        status: 'completed',
        completedAt,
        completedRoundId: round.id,
        recoveredBy: BUILD,
        updatedAt: serverTimestamp()
      };
      continue;
    }

    group.forEach(plan => {
      setIfDifferent(updates, `lor/plans/${plan.id}/sourceSeedId`, plan.sourceSeedId, seedId);
      setIfDifferent(updates, `lor/plans/${plan.id}/year`, plan.year, seed.year);
      setIfDifferent(updates, `lor/plans/${plan.id}/week`, plan.week, seed.week);
      setIfDifferent(updates, `lor/plans/${plan.id}/status`, plan.status, 'completed');
      setIfDifferent(updates, `lor/plans/${plan.id}/completedAt`, plan.completedAt, completedAt);
      setIfDifferent(updates, `lor/plans/${plan.id}/completedRoundId`, plan.completedRoundId, round.id);
      if (plan.plannedDate && isoWeekFromDate(plan.plannedDate) !== seed.week) updates[`lor/plans/${plan.id}/plannedDate`] = null;
    });
  }

  if (Object.keys(updates).length) {
    updates['lor/meta/lastCanonicalRepairBuild'] = BUILD;
    updates['lor/meta/lastCanonicalRepairAt'] = serverTimestamp();
    await db.ref().update(updates);
  }
}

let running = false;
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  setTimeout(async () => {
    queued = false;
    if (running) return schedule();
    running = true;
    try {
      await reconcile();
    } catch (error) {
      console.error('[LOR Canonical Data Guard]', error);
    } finally {
      running = false;
    }
  }, 60);
}

let listenersAttached = false;
function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  db.ref('lor/plans').on('value', schedule);
  db.ref('lor/rounds').on('value', schedule);
  schedule();
}

window.firebase.auth().onAuthStateChanged(user => {
  if (user) attachListeners();
});
window.addEventListener('pageshow', () => {
  if (window.firebase?.auth?.().currentUser) schedule();
});

window.__lorCanonicalDataGuard = { build: BUILD, run: reconcile };
