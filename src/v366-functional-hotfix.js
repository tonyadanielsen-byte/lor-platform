// Focused functional hotfix on top of the stable 3.6.6 shell.
// Fixes: annual select collapse, overdue reset path, next task source/button, overdue dashboard clutter.

(() => {
  // v363-runtime registers setInterval(sync, 1000) inside its window.load handler.
  // That rebuilds the entire annual-plan DOM every second and closes native selects.
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  let blockedAnnualSync = false;

  window.setInterval = function patchedSetInterval(fn, delay, ...args) {
    if (!blockedAnnualSync && Number(delay) === 1000 && typeof fn === 'function' && fn.name === 'sync') {
      blockedAnnualSync = true;
      return 0;
    }
    return nativeSetInterval(fn, delay, ...args);
  };

  window.addEventListener('load', () => {
    // v363-runtime registered its load handler before this module; by the time this callback runs,
    // its unwanted interval has been blocked. Restore the browser API immediately afterwards.
    setTimeout(() => { window.setInterval = nativeSetInterval; window.clearInterval = nativeClearInterval; }, 0);
  }, { once: true });

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let scheduled = false;

  function parseUpcoming(button) {
    if (!button) return null;
    const weekText = button.querySelector('b')?.textContent || '';
    const week = Number(weekText.match(/\d+/)?.[0] || 0);
    const theme = button.querySelector('strong')?.textContent?.trim() || '';
    const meta = button.querySelector('span')?.textContent?.trim() || '';
    const [department = '', leaderName = ''] = meta.split('·').map(x => x.trim());
    if (!week || !theme) return null;
    return {
      id: button.dataset.v363Edit || `annual-${week}-${theme}`,
      week,
      theme,
      themeName: theme,
      department,
      leaderName,
      source: 'annual-plan'
    };
  }

  function cleanOverdueCard() {
    const card = document.querySelector('#v363AnnualDash .v363-overdue');
    if (!card || card.dataset.v366Clean === '1') return;
    const count = Number((card.querySelector('strong')?.textContent || '').match(/\d+/)?.[0] || 0);
    card.dataset.v366Clean = '1';
    card.innerHTML = `<strong>⚠ ${count} ${count === 1 ? 'forfalt runde' : 'forfalte runder'}</strong><span>Gjennomgå, flytt eller etterregistrer rundene som ikke ble gjennomført i planlagt uke.</span><b>Se forfalte →</b>`;
  }

  function fixNextTask() {
    const dash = document.querySelector('#v35Dashboard');
    if (!dash) return;
    const upcomingButton = dash.querySelector('#v363AnnualDash .v363-upcoming > button');
    const plan = parseUpcoming(upcomingButton);
    const target = dash.querySelector('.v35-next');
    if (!target || !plan) return;

    const sig = `${plan.id}|${plan.week}|${plan.theme}|${plan.department}|${plan.leaderName}`;
    if (target.dataset.v366Plan === sig) return;
    target.dataset.v366Plan = sig;
    const payload = encodeURIComponent(JSON.stringify(plan));
    target.innerHTML = `<span class="eyebrow">Neste oppgave</span><h2>Uke ${plan.week} · ${esc(plan.theme)}</h2><p>${esc(plan.department)}${plan.leaderName ? ` · ${esc(plan.leaderName)}` : ''}</p><button class="primary-action full-action" data-v366-start-plan="${payload}">Start planlagt LOR →</button><div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`;
  }

  function addShowAllEscape() {
    const status = document.querySelector('[data-v363-filter="status"]');
    const count = document.querySelector('.v363-result-count');
    if (!status || !count) return;
    const filtered = status.value !== 'all' || [...document.querySelectorAll('[data-v363-filter]')].some(x => x.value !== 'all');
    let button = count.querySelector('[data-v366-show-all]');
    if (!filtered) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-action';
      button.dataset.v366ShowAll = '1';
      button.textContent = 'Vis alle runder →';
      button.style.marginLeft = '12px';
      count.appendChild(button);
    }
  }

  function enhance() {
    scheduled = false;
    cleanOverdueCard();
    fixNextTask();
    addShowAllEscape();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  document.addEventListener('click', ev => {
    const start = ev.target.closest('[data-v366-start-plan]');
    if (start) {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        const plan = JSON.parse(decodeURIComponent(start.dataset.v366StartPlan || ''));
        window.dispatchEvent(new CustomEvent('lor:start-plan', { detail: plan }));
      } catch (err) {
        console.error('Kunne ikke starte planlagt LOR fra årsplan', err);
      }
      return;
    }

    const showAll = ev.target.closest('[data-v366-show-all]');
    if (showAll) {
      ev.preventDefault();
      const reset = document.querySelector('[data-v363-reset-filter]');
      if (reset) reset.click();
      else {
        document.querySelectorAll('[data-v363-filter]').forEach(select => {
          select.value = 'all';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
  });

  const observer = new MutationObserver(scheduleEnhance);
  const app = document.querySelector('#app');
  if (app) observer.observe(app, { childList: true, subtree: true });

  [50, 200, 500, 1000, 2000].forEach(ms => setTimeout(scheduleEnhance, ms));
})();
