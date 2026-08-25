import { createRound, saveResponse, addEmployeeInterview, completeRound } from './store.js';
import { availableThemes } from './seed-data.js';

const answerOptions = [
  ['OK', 'ok', '✓'],
  ['Forbedringspunkt', 'improvement', '△'],
  ['Avvik', 'deviation', '!'],
  ['Ikke relevant', 'na', '–'],
];

function esc(value='') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

export function createRoundController({ user, onDone, notify, themeBank, initialPlan = null }) {
  let roundId = null;
  let step = -1;
  let plan = initialPlan;
  let department = plan?.department || 'Renhold';
  let themes = availableThemes(themeBank, department);
  let theme = themes.find(t => t.name === (plan?.theme || plan?.themeName)) || themes[0];
  const responses = {};
  let employeeInterview = null;
  let positiveStart = '';
  let summaryText = '';

  function refreshThemes(preferredName = '') {
    themes = availableThemes(themeBank, department);
    theme = themes.find(t => t.name === preferredName) || themes.find(t => t.name === theme?.name) || themes[0];
  }

  async function ensureRound() {
    if (roundId) return roundId;
    if (!theme) throw new Error('Ingen gyldig temamal er valgt.');
    roundId = await createRound({
      planId: plan?.id || null,
      week: plan?.week || null,
      leader: user,
      department,
      theme: theme.name,
      themeVersion: theme.version || 1,
      positiveStart,
    });
    return roundId;
  }

  function statusCounts() {
    return Object.values(responses).reduce((acc, item) => {
      if (item.status) acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }

  function findings() {
    return (theme?.questions || []).map(q => ({ q, response: responses[q.id] })).filter(x => x.response && ['improvement','deviation'].includes(x.response.status));
  }

  function intro() {
    return `
      <section class="round-shell card round-intro-v2">
        <div class="round-head"><div><span class="eyebrow">Ny lederoppfølgingsrunde</span><h1>${plan ? `Uke ${esc(plan.week)} · ${esc(plan.theme || plan.themeName || 'LOR')}` : 'Start LOR'}</h1><p>${plan ? 'Planlagt runde er forhåndsutfylt. Kontroller og start.' : 'Velg avdeling og tema. Spørsmålene hentes fra fabrikkens LOR-bank.'}</p></div><span class="round-state">Klar</span></div>
        ${plan ? `<div class="plan-banner"><div><span>PLANLAGT RUNDE</span><strong>${esc(plan.department || department)} · ${esc(plan.theme || plan.themeName || theme?.name)}</strong></div><button type="button" class="text-action" data-round-action="manual">Velg annen runde</button></div>` : ''}
        <div class="form-grid">
          <label>Avdeling<select id="roundDepartment" ${plan ? 'disabled' : ''}>${['Renhold','Ferdigmat','Rekvisita'].map(d => `<option ${d===department?'selected':''}>${d}</option>`).join('')}</select></label>
          <label>Tema<select id="roundTheme" ${plan ? 'disabled' : ''}>${themes.map(t => `<option value="${esc(t.id)}" ${t.id===theme?.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
        </div>
        <div class="positive-start"><div class="positive-icon">★</div><div><strong>Start med det som fungerer</strong><p>Registrer én konkret positiv observasjon før du begynner kontrollpunktene.</p></div><textarea id="positiveStart" placeholder="Hva gjør medarbeiderne eller området bra akkurat nå?">${esc(positiveStart)}</textarea></div>
        <div class="round-meta-line"><span>${theme?.questions?.length || 0} kontrollpunkter</span><span>${esc(user.name)}</span>${plan?.week ? `<span>Uke ${esc(plan.week)}</span>` : ''}</div>
        <button class="primary-action full-action" data-round-action="start">Start runden</button>
      </section>`;
  }

  function question() {
    const q = theme.questions[step];
    const saved = responses[q.id] || {};
    const isFreeText = q.responseType === 'freeText';
    return `
      <section class="round-shell card question-shell-v2">
        <div class="round-progress"><div class="progress-copy"><span>Kontrollpunkt ${step + 1} av ${theme.questions.length}</span><strong>${Math.round(((step + 1)/theme.questions.length)*100)} %</strong></div><div><i style="width:${((step + 1)/theme.questions.length)*100}%"></i></div></div>
        <div class="question-context"><span>${esc(theme.name)}</span><span>${esc(department)}</span>${plan?.week ? `<span>Uke ${esc(plan.week)}</span>` : ''}</div>
        <div class="question-card"><h2>${esc(q.text)}</h2>
          ${isFreeText ? `<label class="stack free-text-answer">Svar<textarea id="freeTextResponse" placeholder="Registrer svaret her…">${esc(saved.comment || '')}</textarea></label>` : `
          <div class="answer-grid">${answerOptions.map(([label,value,icon]) => `<button type="button" class="answer answer-${value} ${saved.status===value?'selected':''}" data-answer="${value}"><b>${icon}</b><span>${label}</span></button>`).join('')}</div>
          <label class="stack">Kommentar<textarea id="questionComment" placeholder="Hva observerte du?">${esc(saved.comment || '')}</textarea></label>
          <label class="stack positive-field">Positiv observasjon <input id="questionPositive" value="${esc(saved.positive || '')}" placeholder="Valgfritt – hva gjorde medarbeider/område bra?" /></label>`}
        </div>
        <div class="round-actions"><button class="secondary-action" data-round-action="back" ${step===0?'disabled':''}>← Tilbake</button><button class="primary-action" data-round-action="next">${step===theme.questions.length-1?'Videre til medarbeiderdialog':'Neste →'}</button></div>
      </section>`;
  }

  function interview() {
    return `
      <section class="round-shell card interview-v2">
        <div class="round-head"><div><span class="eyebrow">Medarbeiderdialog</span><h1>Hva sier medarbeideren?</h1><p>Dialogen er en egen del av LOR-runden. Registrer bare det som er relevant og nyttig.</p></div><span class="round-step-chip">Frivillig</span></div>
        <div class="interview-note"><strong>Tips</strong><span>Still åpne spørsmål. Målet er å forstå arbeidshverdagen – ikke å få «riktige» svar.</span></div>
        <div class="identity-row"><label class="toggle-row"><input type="checkbox" id="interviewAnonymous" checked> <span><strong>Registrer anonymt</strong><small>Navn lagres ikke i runden</small></span></label><label class="stack compact" id="employeeNameWrap" hidden>Navn<input id="employeeName" placeholder="Navn på medarbeider" /></label></div>
        <div class="interview-grid">
          <label class="stack"><span>Hvordan oppleves arbeidshverdagen?</span><textarea id="employeeEnvironment" placeholder="Arbeidsmiljø, samarbeid, trygghet, flyt…"></textarea></label>
          <label class="stack positive-field"><span>Hva fungerer bra?</span><textarea id="employeePositive" placeholder="Hva bør vi ta vare på eller gjøre mer av?"></textarea></label>
          <label class="stack improvement-field full"><span>Hva bør vi forbedre?</span><textarea id="employeeImprove" placeholder="Hva skaper frustrasjon, risiko eller unødvendig arbeid?"></textarea></label>
        </div>
        <label class="followup-toggle"><input type="checkbox" id="employeeFollowUp"><span><strong>Dette innspillet krever oppfølging</strong><small>Innspillet vises som oppfølgingspunkt i oppsummeringen.</small></span></label>
        <div class="round-actions"><button class="secondary-action" data-round-action="skip-interview">Hopp over</button><button class="primary-action" data-round-action="save-interview">Lagre dialog →</button></div>
      </section>`;
  }

  function summary() {
    const counts = statusCounts();
    const followUps = (counts.improvement || 0) + (counts.deviation || 0) + (employeeInterview?.needsFollowUp ? 1 : 0);
    const issueRows = findings();
    return `
      <section class="round-shell card summary-v2">
        <div class="round-head"><div><span class="eyebrow">Oppsummering</span><h1>Runden er klar</h1><p>Se hva som fungerer, hva som bør følges opp og hva som eventuelt skal bli tiltak.</p></div><span class="round-state">Klar til lagring</span></div>
        <div class="summary-grid"><div class="summary-ok"><strong>${counts.ok || 0}</strong><span>OK</span></div><div class="summary-improvement"><strong>${counts.improvement || 0}</strong><span>Forbedring</span></div><div class="summary-deviation"><strong>${counts.deviation || 0}</strong><span>Avvik</span></div><div class="summary-follow"><strong>${followUps}</strong><span>Krever oppfølging</span></div></div>
        ${positiveStart ? `<div class="summary-section positive-summary"><span>★ POSITIV START</span><p>${esc(positiveStart)}</p></div>` : ''}
        <div class="summary-section"><div class="summary-title"><span>FUNN OG OPPFØLGING</span><strong>${issueRows.length + (employeeInterview?.needsFollowUp ? 1 : 0)}</strong></div>${issueRows.length ? `<div class="finding-list">${issueRows.map(({q,response}) => `<div class="finding-row ${response.status}"><div><strong>${response.status==='deviation'?'Avvik':'Forbedringspunkt'}</strong><p>${esc(q.text)}</p>${response.comment ? `<small>${esc(response.comment)}</small>` : ''}</div><button type="button" class="master-action" disabled title="Aktiveres når Master-integrasjonen kobles på">+ Tiltak i Master</button></div>`).join('')}</div>` : '<p class="muted">Ingen funn fra kontrollpunktene krever oppfølging.</p>'}${employeeInterview?.needsFollowUp ? `<div class="finding-row interview-finding"><div><strong>Medarbeiderinnspill</strong><p>${esc(employeeInterview.improvement || 'Innspillet er markert for oppfølging.')}</p></div><button type="button" class="master-action" disabled>+ Tiltak i Master</button></div>` : ''}</div>
        ${employeeInterview ? `<div class="summary-section employee-summary"><span>MEDARBEIDERDIALOG</span><div class="employee-summary-grid"><div><small>Arbeidshverdag</small><p>${esc(employeeInterview.environment || 'Ikke registrert')}</p></div><div><small>Det som fungerer</small><p>${esc(employeeInterview.positive || 'Ikke registrert')}</p></div></div></div>` : ''}
        <label class="stack">Oppsummering / neste steg<textarea id="roundSummary" placeholder="Hva er viktig å ta med videre fra denne runden?">${esc(summaryText)}</textarea></label>
        <div class="integration-note"><span>↗</span><div><strong>Master tiltaksliste</strong><p>Oppretting av tiltak fra funn er designet inn i flyten. Knappene aktiveres når den kontrollerte integrasjonen er koblet på.</p></div></div>
        <div class="round-actions"><button class="secondary-action" data-round-action="edit-last">← Tilbake</button><button class="primary-action" data-round-action="complete">Fullfør og lagre LOR</button></div>
      </section>`;
  }

  function render() {
    if (step === -1) return intro();
    if (!theme) return '<section class="round-shell card"><div class="empty-state">Ingen temamal er tilgjengelig.</div></section>';
    if (step < theme.questions.length) return question();
    if (step === theme.questions.length) return interview();
    return summary();
  }

  function handleChange(target) {
    if (step !== -1) return false;
    if (target.id === 'roundDepartment') {
      department = target.value;
      refreshThemes();
      return true;
    }
    if (target.id === 'roundTheme') {
      theme = themes.find(t => t.id === target.value) || theme;
      return true;
    }
    return false;
  }

  async function handle(target, root) {
    const action = target.closest('[data-round-action]')?.dataset.roundAction;
    if (target.matches('[data-answer]')) {
      root.querySelectorAll('[data-answer]').forEach(el => el.classList.remove('selected'));
      target.classList.add('selected');
      return { rerender: false };
    }
    if (!action) return { rerender: false };

    if (action === 'manual') {
      plan = null;
      return { rerender: true };
    }
    if (action === 'start') {
      department = root.querySelector('#roundDepartment')?.value || department;
      const selectedTheme = root.querySelector('#roundTheme')?.value;
      if (selectedTheme) theme = themes.find(t => t.id === selectedTheme) || theme;
      positiveStart = root.querySelector('#positiveStart')?.value.trim() || '';
      if (!positiveStart) { notify('Registrer én positiv observasjon før du starter.', true); return { rerender:false }; }
      await ensureRound();
      step = 0;
    } else if (action === 'next') {
      const q = theme.questions[step];
      let response;
      if (q.responseType === 'freeText') {
        const value = root.querySelector('#freeTextResponse')?.value.trim() || '';
        if (!value) { notify('Registrer et svar før du går videre.', true); return { rerender:false }; }
        response = { status: 'text', comment: value, positive: '' };
      } else {
        const selected = root.querySelector('[data-answer].selected');
        if (!selected) { notify('Velg status før du går videre.', true); return { rerender:false }; }
        response = { status: selected.dataset.answer, comment: root.querySelector('#questionComment')?.value.trim() || '', positive: root.querySelector('#questionPositive')?.value.trim() || '' };
      }
      responses[q.id] = response;
      await saveResponse(await ensureRound(), q.id, response);
      step += 1;
    } else if (action === 'back') {
      step = Math.max(0, step - 1);
    } else if (action === 'skip-interview') {
      employeeInterview = null;
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
      if (!employeeInterview.environment && !employeeInterview.positive && !employeeInterview.improvement) {
        notify('Registrer minst ett innspill, eller velg Hopp over.', true); return { rerender:false };
      }
      await addEmployeeInterview(await ensureRound(), employeeInterview);
      step += 1;
    } else if (action === 'edit-last') {
      summaryText = root.querySelector('#roundSummary')?.value.trim() || summaryText;
      step = theme.questions.length;
    } else if (action === 'complete') {
      summaryText = root.querySelector('#roundSummary')?.value.trim() || '';
      const counts = statusCounts();
      const needsFollowUp = Boolean((counts.improvement || 0) + (counts.deviation || 0) + (employeeInterview?.needsFollowUp ? 1 : 0));
      await completeRound(await ensureRound(), { text: summaryText, counts, needsFollowUp, followUpCount: (counts.improvement || 0) + (counts.deviation || 0) + (employeeInterview?.needsFollowUp ? 1 : 0) });
      notify('LOR er lagret ✓');
      onDone?.(roundId);
    }
    return { rerender: true };
  }

  return { render, handle, handleChange };
}
