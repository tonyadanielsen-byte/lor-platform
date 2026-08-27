import { db, serverTimestamp } from './firebase.js';

const BUILD = '3.8.0';
let participants = [];
let busy = false;
let queued = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');

function notify(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) {
    if (error) alert(message);
    return;
  }
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

function leaderNames() {
  return [...new Set([
    ...document.querySelectorAll('[data-v363-filter="leader"] option'),
    ...document.querySelectorAll('select[name="leaderName"] option')
  ].map(o => o.value || o.textContent).map(v => String(v || '').trim()).filter(v => v && v !== 'all' && v !== 'Velg'))];
}

function optionNames() {
  const map = new Map();
  leaderNames().forEach(name => map.set(norm(name), name));
  participants.forEach(p => map.set(norm(p.name), p.name));
  return [...map.values()].sort((a,b) => a.localeCompare(b, 'nb'));
}

function participantMemoryHtml(current = '') {
  if (!participants.length) return '<div class="v377-memory-empty">Ingen ekstra deltakere er lagret ennå.</div>';
  return participants
    .filter(p => norm(p.name) !== norm(current))
    .map(p => `<span class="v377-person-chip"><button type="button" data-v380-pick-person="${esc(p.name)}">${esc(p.name)}</button><button type="button" aria-label="Slett ${esc(p.name)}" data-v380-delete-person="${esc(p.id)}">×</button></span>`)
    .join('');
}

function enhanceParticipantField(form) {
  const field = form.querySelector('[name="coLeaderName"]');
  if (!field || field.dataset.v380 === '1') return;
  const value = String(field.value || '').trim();
  const label = field.closest('label');
  if (!label) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'coLeaderName';
  input.value = value;
  input.placeholder = 'Skriv navn eller velg fra listen';
  input.autocomplete = 'off';
  input.setAttribute('list', 'v380ParticipantOptions');
  input.dataset.v380 = '1';
  field.replaceWith(input);

  let datalist = form.querySelector('#v380ParticipantOptions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'v380ParticipantOptions';
    form.appendChild(datalist);
  }
  datalist.innerHTML = optionNames().map(name => `<option value="${esc(name)}"></option>`).join('');

  const titleNode = [...label.childNodes].find(n => n.nodeType === Node.TEXT_NODE && String(n.textContent).trim());
  if (titleNode) titleNode.textContent = 'Inviter med / deltaker';

  let memory = label.querySelector('.v377-participant-memory');
  if (!memory) {
    memory = document.createElement('div');
    memory.className = 'v377-participant-memory';
    label.appendChild(memory);
  }
  memory.innerHTML = `<small>Lagrede deltakere</small><div>${participantMemoryHtml(value)}</div>`;
}

function takeAfterRegisterOwnership(form) {
  form.querySelectorAll('[data-v363-afterregister],[data-v377-afterregister],[data-v378-afterregister],[data-v379-afterregister],[data-v380-afterregister]').forEach(button => {
    button.removeAttribute('data-v363-afterregister');
    button.removeAttribute('data-v377-afterregister');
    button.removeAttribute('data-v378-afterregister');
    button.removeAttribute('data-v379-afterregister');
    button.setAttribute('data-v380-afterregister', '1');
    if (!busy) button.textContent = 'Etterregistrer gjennomført';
  });
}

function enhanceDialog(dialog) {
  const form = dialog?.querySelector('form[data-v363-form]');
  if (!form) return;
  dialog.classList.add('v377-annual-dialog');
  enhanceParticipantField(form);
  takeAfterRegisterOwnership(form);
}

function values(form) {
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

async function resolvePlanId(form, seedId) {
  const direct = String(form.dataset.id || '').trim();
  if (direct) return direct;

  if (seedId) {
    const snap = await db.ref('lor/plans').once('value');
    let best = null;
    snap.forEach(child => {
      const val = child.val() || {};
      if (String(val.sourceSeedId || '') !== seedId) return;
      const candidate = { id: child.key, updatedAt: Number(val.updatedAt || 0) };
      if (!best || candidate.updatedAt >= best.updatedAt) best = candidate;
    });
    if (best?.id) return best.id;
  }

  return db.ref('lor/plans').push().key;
}

async function rememberParticipant(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!name || participants.some(p => norm(p.name) === norm(name))) return;
  await db.ref('lor/participants').push().set({ name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

async function registerCompleted(form) {
  if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
  const v = values(form);
  if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
  if (!Number.isFinite(v.week) || v.week < 1 || v.week > 53) throw new Error('Ugyldig uke.');
  if (!v.leaderName || !v.theme || !v.department) throw new Error('Ansvarlig, tema og avdeling må være fylt ut.');

  const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
  if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

  const seedId = String(form.dataset.seedId || '').trim();
  const planId = await resolvePlanId(form, seedId);
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
  await db.ref().update(updates);

  const [planSnap, roundSnap] = await Promise.all([
    db.ref(`lor/plans/${planId}`).once('value'),
    db.ref(`lor/rounds/${roundId}`).once('value')
  ]);

  if (!planSnap.exists() || !roundSnap.exists()) throw new Error('Firebase bekreftet ikke etterregistreringen.');
  const savedPlan = planSnap.val() || {};
  const savedRound = roundSnap.val() || {};
  if (savedPlan.status !== 'completed' || Number(savedPlan.completedAt) !== completedAt) {
    throw new Error('Årsplanposten ble ikke lagret som gjennomført.');
  }
  if (String(savedRound.planId || '') !== planId || Number(savedRound.completedAt) !== completedAt) {
    throw new Error('Gjennomført LOR ble ikke koblet til riktig årsplanpost.');
  }

  if (v.coLeaderName) await rememberParticipant(v.coLeaderName).catch(() => {});
  return { planId, roundId };
}

async function refreshAnnual() {
  await new Promise(resolve => setTimeout(resolve, 250));
  const annual = document.querySelector('[data-v363-annual]');
  if (annual) {
    annual.click();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

function refreshParticipantUi() {
  document.querySelectorAll('dialog.v363-dialog').forEach(dialog => {
    const form = dialog.querySelector('form[data-v363-form]');
    if (!form) return;
    const input = form.querySelector('input[name="coLeaderName"][data-v380]');
    const list = form.querySelector('#v380ParticipantOptions');
    if (list) list.innerHTML = optionNames().map(name => `<option value="${esc(name)}"></option>`).join('');
    const memory = form.querySelector('.v377-participant-memory');
    if (memory) memory.innerHTML = `<small>Lagrede deltakere</small><div>${participantMemoryHtml(input?.value || '')}</div>`;
  });
}

function apply() {
  queued = false;
  document.querySelectorAll('dialog.v363-dialog').forEach(enhanceDialog);
  document.documentElement.dataset.lorBuild = BUILD;
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

document.addEventListener('pointerdown', event => {
  const dialog = event.target.closest('dialog.v363-dialog');
  if (dialog) enhanceDialog(dialog);
}, true);

document.addEventListener('click', async event => {
  const after = event.target.closest('[data-v380-afterregister]');
  if (after) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const form = after.closest('form[data-v363-form]');
    if (!form) return;
    busy = true;
    try {
      after.disabled = true;
      after.textContent = 'Etterregistrerer…';
      await registerCompleted(form);
      form.closest('dialog')?.remove();
      await refreshAnnual();
      notify('Etterregistrert ✓ Årsplan og gjennomført LOR er oppdatert.');
    } catch (error) {
      console.error(`[LOR ${BUILD}] Etterregistrering feilet`, error);
      after.disabled = false;
      after.textContent = 'Etterregistrer gjennomført';
      notify(error?.message || 'Etterregistrering feilet.', true);
    } finally {
      busy = false;
    }
    return;
  }

  const pick = event.target.closest('[data-v380-pick-person]');
  if (pick) {
    event.preventDefault();
    const form = pick.closest('form[data-v363-form]');
    const input = form?.querySelector('input[name="coLeaderName"]');
    if (input) {
      input.value = pick.dataset.v380PickPerson || '';
      input.focus();
    }
    return;
  }

  const del = event.target.closest('[data-v380-delete-person]');
  if (del) {
    event.preventDefault();
    event.stopPropagation();
    const item = participants.find(p => p.id === del.dataset.v380DeletePerson);
    if (!item) return;
    if (!confirm(`Fjerne ${item.name} fra listen over lagrede deltakere?`)) return;
    try {
      await db.ref(`lor/participants/${item.id}`).remove();
      notify(`${item.name} er fjernet fra deltakerlisten.`);
    } catch (error) {
      notify('Kunne ikke slette deltakeren.', true);
    }
  }
}, true);

document.addEventListener('submit', event => {
  if (!event.target.matches('form[data-v363-form]')) return;
  const name = event.target.querySelector('[name="coLeaderName"]')?.value || '';
  if (name) rememberParticipant(name).catch(() => {});
}, true);

db.ref('lor/participants').on('value', snap => {
  participants = [];
  snap.forEach(child => {
    const value = child.val() || {};
    const name = String(value.name || '').trim();
    if (name) participants.push({ id: child.key, name });
  });
  participants.sort((a,b) => a.name.localeCompare(b.name, 'nb'));
  refreshParticipantUi();
});

new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
[0, 60, 180, 500].forEach(ms => setTimeout(apply, ms));
