import { createRound, saveResponse, addEmployeeInterview, completeRound, defaultTheme } from './store.js';

const answerOptions = [
  ['OK', 'ok'],
  ['Forbedringspunkt', 'improvement'],
  ['Avvik', 'deviation'],
  ['Ikke relevant', 'na'],
];

export function createRoundController({ user, onDone, notify }) {
  let roundId = null;
  let step = 0;
  let department = 'Renhold';
  let theme = defaultTheme;
  const responses = {};
  let employeeInterview = null;

  async function ensureRound() {
    if (roundId) return roundId;
    roundId = await createRound({ leader: user, department, theme: theme.name, themeVersion: theme.version });
    return roundId;
  }

  function statusCounts() {
    return Object.values(responses).reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }

  function intro() {
    return `
      <section class="round-shell card">
        <div class="round-head"><div><span class="eyebrow">Ny lederoppfølgingsrunde</span><h1>Start LOR</h1><p>Start med positiv feedback, deretter går du gjennom kontrollpunktene.</p></div><span class="round-state">Klar</span></div>
        <div class="form-grid">
          <label>Avdeling<select id="roundDepartment"><option>Renhold</option><option>Ferdigmat</option><option>Rekvisita</option></select></label>
          <label>Tema<select id="roundTheme"><option>Hygiene</option></select></label>
        </div>
        <div class="positive-start"><strong>⭐ Start positivt</strong><p>Hva fungerer godt i området akkurat nå?</p><textarea id="positiveStart" placeholder="Registrer en konkret positiv observasjon…"></textarea></div>
        <button class="primary-action full-action" data-round-action="start">Start runden</button>
      </section>`;
  }

  function question() {
    const q = theme.questions[step];
    const saved = responses[q.id] || {};
    return `
      <section class="round-shell card">
        <div class="round-progress"><span>Kontrollpunkt ${step + 1} av ${theme.questions.length}</span><div><i style="width:${((step + 1)/theme.questions.length)*100}%"></i></div></div>
        <div class="question-card"><span class="eyebrow">${theme.name} · ${department}</span><h2>${q.text}</h2>
          <div class="answer-grid">${answerOptions.map(([label,value]) => `<button type="button" class="answer ${saved.status===value?'selected':''}" data-answer="${value}">${label}</button>`).join('')}</div>
          <label class="stack">Kommentar<textarea id="questionComment" placeholder="Hva observerte du?">${saved.comment || ''}</textarea></label>
          <label class="stack">Positiv observasjon <input id="questionPositive" value="${saved.positive || ''}" placeholder="Valgfritt – hva gjorde medarbeider/område bra?" /></label>
        </div>
        <div class="round-actions"><button class="secondary-action" data-round-action="back" ${step===0?'disabled':''}>Tilbake</button><button class="primary-action" data-round-action="next">${step===theme.questions.length-1?'Videre':'Neste'}</button></div>
      </section>`;
  }

  function interview() {
    return `
      <section class="round-shell card">
        <div class="round-head"><div><span class="eyebrow">Medarbeiderdialog</span><h1>Ta medarbeideren med</h1><p>Registrer kort hva medarbeideren opplever og mener bør forbedres.</p></div></div>
        <label class="toggle-row"><input type="checkbox" id="interviewAnonymous" checked> Registrer anonymt</label>
        <label class="stack" id="employeeNameWrap" hidden>Navn<input id="employeeName" placeholder="Navn" /></label>
        <label class="stack">Hvordan oppleves arbeidsmiljøet?<textarea id="employeeEnvironment"></textarea></label>
        <label class="stack">Hva fungerer bra?<textarea id="employeePositive"></textarea></label>
        <label class="stack">Hva bør vi forbedre?<textarea id="employeeImprove"></textarea></label>
        <label class="toggle-row"><input type="checkbox" id="employeeFollowUp"> Innspillet krever oppfølging</label>
        <div class="round-actions"><button class="secondary-action" data-round-action="skip-interview">Hopp over</button><button class="primary-action" data-round-action="save-interview">Lagre og fortsett</button></div>
      </section>`;
  }

  function summary() {
    const counts = statusCounts();
    const followUps = (counts.improvement || 0) + (counts.deviation || 0) + (employeeInterview?.needsFollowUp ? 1 : 0);
    return `
      <section class="round-shell card">
        <div class="round-head"><div><span class="eyebrow">Oppsummering</span><h1>Runden er klar</h1><p>Kontroller resultatet før du avslutter.</p></div></div>
        <div class="summary-grid"><div><strong>${counts.ok || 0}</strong><span>OK</span></div><div><strong>${counts.improvement || 0}</strong><span>Forbedring</span></div><div><strong>${counts.deviation || 0}</strong><span>Avvik</span></div><div><strong>${followUps}</strong><span>Krever oppfølging</span></div></div>
        <label class="stack">Oppsummering / neste steg<textarea id="roundSummary" placeholder="Hva bør følges opp etter runden?"></textarea></label>
        <div class="round-actions"><button class="secondary-action" data-round-action="edit-last">Tilbake</button><button class="primary-action" data-round-action="complete">Fullfør LOR</button></div>
      </section>`;
  }

  function render() {
    if (step === -1) return intro();
    if (step < theme.questions.length) return question();
    if (step === theme.questions.length) return interview();
    return summary();
  }

  async function handle(target, root) {
    const action = target.closest('[data-round-action]')?.dataset.roundAction;
    if (target.matches('[data-answer]')) {
      root.querySelectorAll('[data-answer]').forEach(el => el.classList.remove('selected'));
      target.classList.add('selected');
      return { rerender: false };
    }
    if (!action) return { rerender: false };

    if (action === 'start') {
      department = root.querySelector('#roundDepartment').value;
      await ensureRound();
      const positive = root.querySelector('#positiveStart').value.trim();
      if (positive) responses.__positiveStart = { status: 'positive', positive };
      step = 0;
    } else if (action === 'next') {
      const q = theme.questions[step];
      const selected = root.querySelector('[data-answer].selected');
      if (!selected) { notify('Velg status før du går videre.', true); return { rerender:false }; }
      const response = { status: selected.dataset.answer, comment: root.querySelector('#questionComment').value.trim(), positive: root.querySelector('#questionPositive').value.trim() };
      responses[q.id] = response;
      await saveResponse(await ensureRound(), q.id, response);
      step += 1;
    } else if (action === 'back') {
      step = Math.max(0, step - 1);
    } else if (action === 'skip-interview') {
      step += 1;
    } else if (action === 'save-interview') {
      employeeInterview = {
        anonymous: root.querySelector('#interviewAnonymous').checked,
        employeeName: root.querySelector('#interviewAnonymous').checked ? '' : root.querySelector('#employeeName').value.trim(),
        environment: root.querySelector('#employeeEnvironment').value.trim(),
        positive: root.querySelector('#employeePositive').value.trim(),
        improvement: root.querySelector('#employeeImprove').value.trim(),
        needsFollowUp: root.querySelector('#employeeFollowUp').checked,
      };
      await addEmployeeInterview(await ensureRound(), employeeInterview);
      step += 1;
    } else if (action === 'edit-last') {
      step = theme.questions.length;
    } else if (action === 'complete') {
      const counts = statusCounts();
      const needsFollowUp = Boolean((counts.improvement || 0) + (counts.deviation || 0) + (employeeInterview?.needsFollowUp ? 1 : 0));
      await completeRound(await ensureRound(), { text: root.querySelector('#roundSummary').value.trim(), counts, needsFollowUp });
      notify('LOR er lagret ✓');
      onDone?.(roundId);
    }
    return { rerender: true };
  }

  step = -1;
  return { render, handle };
}
