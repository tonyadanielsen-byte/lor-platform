import { db, serverTimestamp } from './firebase.js';

const DATA_MODEL_VERSION = 4;
const RESET_MARKER = 'historyResetV4_20260828';

const rowsFrom = snap => {
  const rows = [];
  snap.forEach(child => rows.push({ id: child.key, ...(child.val() || {}) }));
  return rows;
};

export function subscribePlansV4(cb) {
  const ref = db.ref('lor/plans');
  const handler = snap => cb(rowsFrom(snap).filter(row => Number(row.dataModelVersion || 0) === DATA_MODEL_VERSION));
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export function subscribeRoundsV4(cb) {
  const ref = db.ref('lor/rounds');
  const handler = snap => cb(rowsFrom(snap)
    .filter(row => Number(row.dataModelVersion || 0) === DATA_MODEL_VERSION)
    .sort((a, b) => Number(b.completedAt || b.startedAt || b.createdAt || 0) - Number(a.completedAt || a.startedAt || a.createdAt || 0)));
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export function subscribeThemesV4(cb) {
  const ref = db.ref('lor/themes');
  const handler = snap => cb(rowsFrom(snap).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nb')));
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

function isoMeta(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const local = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(local.getTime())) return null;
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { date: raw, timestamp: local.getTime(), year, week };
}

export async function ensureCleanHistoryReset() {
  const markerRef = db.ref(`lor/system/${RESET_MARKER}`);
  const marker = await markerRef.once('value');
  if (marker.exists()) return false;

  const updates = {
    'lor/rounds': null,
    'lor/plans': null,
    'lor/comments': null,
    'lor/history': null,
    'lor/importedHistory': null,
    [`lor/system/${RESET_MARKER}`]: {
      dataModelVersion: DATA_MODEL_VERSION,
      resetAt: serverTimestamp(),
      resetBy: window.firebase.auth().currentUser?.uid || '',
      reason: 'Clean LOR V4 reset - legacy history removed'
    },
    'lor/system/dataModelVersion': DATA_MODEL_VERSION
  };

  await db.ref().update(updates);
  return true;
}

export async function createRoundV4({
  planId = null,
  sourceSeedId = '',
  planWeek = null,
  planYear = null,
  roundDate = '',
  leader,
  department,
  theme,
  themeVersion = 1,
  positiveStart = ''
}) {
  const meta = isoMeta(roundDate);
  if (!meta) throw new Error('Velg en gyldig dato for LOR-runden.');

  const ref = db.ref('lor/rounds').push();
  const payload = {
    dataModelVersion: DATA_MODEL_VERSION,
    planId: planId || null,
    sourceSeedId: sourceSeedId || '',
    planWeek: Number(planWeek || meta.week),
    planYear: Number(planYear || meta.year),
    roundDate: meta.date,
    backdated: meta.timestamp < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime(),
    source: planId ? 'plan' : 'manual',
    leaderUid: leader.uid,
    leaderName: leader.name,
    department,
    theme,
    themeVersion,
    positiveStart: String(positiveStart || '').trim(),
    status: 'Pågår',
    startedAt: meta.timestamp,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    responses: {},
    employeeInterviews: {},
    observations: {},
    actions: {}
  };
  await ref.set(payload);
  return ref.key;
}

export async function saveResponseV4(id, qid, response) {
  return db.ref().update({
    [`lor/rounds/${id}/responses/${qid}`]: { ...response, updatedAt: serverTimestamp() },
    [`lor/rounds/${id}/updatedAt`]: serverTimestamp()
  });
}

export async function addEmployeeInterviewV4(id, data) {
  return db.ref(`lor/rounds/${id}/employeeInterviews`).push().set({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function completeRoundV4(id, summary, roundDate) {
  const meta = isoMeta(roundDate);
  if (!meta) throw new Error('Dato for LOR-runden mangler.');
  return db.ref(`lor/rounds/${id}`).update({
    dataModelVersion: DATA_MODEL_VERSION,
    status: summary.needsFollowUp ? 'Oppfølging pågår' : 'Gjennomført',
    summary,
    roundDate: meta.date,
    completedAt: meta.timestamp,
    updatedAt: serverTimestamp()
  });
}
