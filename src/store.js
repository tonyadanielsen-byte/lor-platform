import { db, serverTimestamp } from './firebase.js';

export function subscribePlannedRounds(uid, callback) {
  const ref = db.ref('lor/plans');
  const handler = snap => {
    const rows = [];
    snap.forEach(child => {
      const value = child.val() || {};
      if (!uid || value.leaderUid === uid) rows.push({ id: child.key, ...value });
    });
    rows.sort((a,b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')));
    callback(rows);
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export function subscribeRounds(callback) {
  const ref = db.ref('lor/rounds');
  const handler = snap => {
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...(child.val() || {}) }));
    rows.sort((a,b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));
    callback(rows);
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function createRound({ planId = null, leader, department, theme, themeVersion = 1 }) {
  const ref = db.ref('lor/rounds').push();
  const payload = {
    planId,
    leaderUid: leader.uid,
    leaderName: leader.name,
    department,
    theme,
    themeVersion,
    status: 'Pågår',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    responses: {},
    employeeInterviews: {},
    observations: {},
    actions: {},
  };
  await ref.set(payload);
  return ref.key;
}

export async function saveResponse(roundId, questionId, response) {
  const updates = {};
  updates[`lor/rounds/${roundId}/responses/${questionId}`] = {
    ...response,
    updatedAt: serverTimestamp(),
  };
  updates[`lor/rounds/${roundId}/updatedAt`] = serverTimestamp();
  return db.ref().update(updates);
}

export async function addEmployeeInterview(roundId, interview) {
  const ref = db.ref(`lor/rounds/${roundId}/employeeInterviews`).push();
  return ref.set({ ...interview, createdAt: serverTimestamp() });
}

export async function completeRound(roundId, summary) {
  return db.ref(`lor/rounds/${roundId}`).update({
    status: summary.needsFollowUp ? 'Oppfølging pågår' : 'Gjennomført',
    summary,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addComment(objectType, objectId, user, text) {
  const ref = db.ref(`lor/comments/${objectType}/${objectId}`).push();
  return ref.set({
    text: String(text || '').trim(),
    authorUid: user.uid,
    authorName: user.name,
    createdAt: serverTimestamp(),
  });
}

export const defaultTheme = {
  id: 'hygiene-v1',
  name: 'Hygiene',
  version: 1,
  questions: [
    { id: 'q1', text: 'Blir riktig bekledning benyttet?' },
    { id: 'q2', text: 'Er håndhygiene og hygienerutiner fulgt?' },
    { id: 'q3', text: 'Er området ryddig og hygienisk tilfredsstillende?' },
    { id: 'q4', text: 'Er relevante rutiner kjent og etterlevd?' },
    { id: 'q5', text: 'Er det forhold som bør forbedres eller følges opp?' },
  ],
};
