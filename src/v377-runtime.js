import { db, serverTimestamp } from './firebase.js';

const BUILD = '3.7.7';
let participants = [];
let queued = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');

function notify(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) return console[error ? 'error' : 'log'](`[LOR ${BUILD}]`, message);
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove('show'), 3600);
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - first) / 86400000) + 1) / 7);
}

function yearForForm() {
  const selected = Number(document.querySelector('[data-v363-year]')?.value);
  if (Number.isFinite(selected) && selected >= 2026) return selected;
  const heading = document.querySelector('dialog.v363-dialog .eyebrow')?.textContent || '';
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
    .map(p => `<span class="v377-person-chip"><button type="button" data-v377-pick-person="${esc(p.name)}">${esc(p.name)}</button><button type="button" aria-label="Slett ${esc(p.name)}" data-v377-delete-person="${esc(p.id)}">×</button></span>`)
    .join('');
}

function enhanceParticipantField(form) {
  const field = form.querySelector('[name="coLeaderName"]');
  if (!field || field.dataset.v377 === '1') return;
  const value = String(field.value || '').trim();
  const label = field.closest('label');
  if (!label) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'coLeaderName';
  input.value = value;
  input.placeholder = 'Skriv navn eller velg fra listen';
  input.autocomplete = 'off';
  input.setAttribute('list', 'v377ParticipantOptions');
  input.dataset.v377 = '1';
  field.replaceWith(input);

  let datalist = form.querySelector('#v377ParticipantOptions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'v377ParticipantOptions';
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

function enhanceAfterRegister(form) {
  const button = form.querySelector('[data-v363-afterregister]');
  if (!button) return;
  button.removeAttribute('data-v363-afterregister');
  button.setAttribute('data-v377-afterregister', '1');
  button.textContent = 'Etterregistrer gjennomført';
}

function enhanceDialog(dialog) {
  const form = dialog?.querySelector('form[data-v363-form]');
  if (!form) return;
  dialog.classList.add('v377-annual-dialog');
  enhanceParticipantField(form);
  enhanceAfterRegister(form);
}

function refreshParticipantUi() {
  document.querySelectorAll('dialog.v363-dialog').forEach(dialog => {
    const form = dialog.querySelector('form[data-v363-form]');
    if (!form) return;
    const input = form.querySelector('input[name="coLeaderName"][data-v377]');
    const list = form.querySelector('#v377ParticipantOptions');
    if (list) list.innerHTML = optionNames().map(name => `<option value="${esc(name)}"></option>`).join('');
    const memory = form.querySelector('.v377-participant-memory');
    if (memory) memory.innerHTML = `<small>Lagrede deltakere</small><div>${participantMemoryHtml(input?.value || '')}</div>`;
  });
}

async function rememberParticipant(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (participants.some(p => norm(p.name) === norm(name))) return;
  const ref = db.ref('lor/participants').push();
  await ref.set({ name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

function formValues(form) {
  const fd = new FormData(form);
  const plannedDate = String(fd.get('plannedDate') || '');
  const weekInput = Number(fd.get('week'));
  const week = plannedDate ? (isoWeek(new Date(`${plannedDate}T12:00:00`)) || weekInput) : weekInput;
  return {
    year: yearForForm(),
    week,
    plannedDate,
    leaderName: String(fd.get('leaderName') || '').trim(),
    theme: String(fd.get('theme') || '').trim(),
    department: String(fd.get('department') || '').trim(),
    coLeaderName: String(fd.get('coLeaderName') || '').trim(),
    completedDate: String(fd.get('completedDate') || '')
  };
}

async function atomicAfterRegister(form) {
  if (!form.reportValidity()) throw new Error('Fyll ut obligatoriske felt først.');
  const v = formValues(form);
  if (!v.completedDate) throw new Error('Velg faktisk gjennomført dato.');
  if (!v.leaderName || !v.theme || !v.department || !Number.isFinite(v.week)) throw new Error('Runden mangler ansvarlig, tema, avdeling eller uke.');

  const completedAt = new Date(`${v.completedDate}T12:00:00`).getTime();
  if (!Number.isFinite(completedAt)) throw new Error('Ugyldig gjennomført dato.');

  const existingPlanId = String(form.dataset.id || '').trim();
  const planId = existingPlanId || db.ref('lor/plans').push().key;
  const roundId = db.ref('lor/rounds').push().key;
  const seedId = String(form.dataset.seedId || '').trim();
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
  if (!existingPlanId && seedId) plan.sourceSeedId = seedId;

  const round = {
    planId,
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
  await rememberParticipant(v.coLeaderName).catch(() => {});
  return { planId, roundId };
}

function polishDashboardLinks() {
  document.querySelectorAll('#v35Dashboard .v35-head > button[data-view]').forEach(button => {
    button.classList.add('v377-inline-link');
  });
}

function apply() {
  queued = false;
  document.querySelectorAll('dialog.v363-dialog').forEach(enhanceDialog);
  polishDashboardLinks();
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
  const after = event.target.closest('[data-v377-afterregister]');
  if (after) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = after.closest('form[data-v363-form]');
    if (!form) return;
    try {
      after.disabled = true;
      after.textContent = 'Etterregistrerer…';
      await atomicAfterRegister(form);
      form.closest('dialog')?.remove();
      notify('Runden er etterregistrert og årsplanen er oppdatert ✓');
    } catch (error) {
      console.error(`[LOR ${BUILD}] Etterregistrering feilet`, error);
      after.disabled = false;
      after.textContent = 'Etterregistrer gjennomført';
      notify(error?.message || 'Kunne ikke etterregistrere runden.', true);
    }
    return;
  }

  const pick = event.target.closest('[data-v377-pick-person]');
  if (pick) {
    event.preventDefault();
    const form = pick.closest('form[data-v363-form]');
    const input = form?.querySelector('input[name="coLeaderName"]');
    if (input) {
      input.value = pick.dataset.v377PickPerson || '';
      input.focus();
    }
    return;
  }

  const del = event.target.closest('[data-v377-delete-person]');
  if (del) {
    event.preventDefault();
    event.stopPropagation();
    const item = participants.find(p => p.id === del.dataset.v377DeletePerson);
    if (!item) return;
    if (!confirm(`Fjerne ${item.name} fra listen over lagrede deltakere?`)) return;
    try {
      await db.ref(`lor/participants/${item.id}`).remove();
      notify(`${item.name} er fjernet fra deltakerlisten.`);
    } catch (error) {
      console.error(error);
      notify('Kunne ikke slette deltakeren.', true);
    }
    return;
  }

  const saveOrStart = event.target.closest('form[data-v363-form] .primary-action');
  if (saveOrStart && !saveOrStart.matches('[data-v377-afterregister]')) {
    const form = saveOrStart.closest('form[data-v363-form]');
    const name = form?.querySelector('[name="coLeaderName"]')?.value || '';
    if (name) rememberParticipant(name).catch(() => {});
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
