// V3.7.2 dashboard gate/bridge: keep the consolidated dashboard stable after Firebase rerenders.
(() => {
  let scheduled = false;
  let lastPingDash = null;

  function syncPersonalProgress(dash) {
    const source = document.querySelector('.dashboard-kpis .kpi:first-child');
    if (!source) return;
    const rateText = source.querySelector('strong')?.textContent?.trim() || '0 %';
    const hint = source.querySelector('small')?.textContent?.trim() || '0 av 0 planlagte';
    const rate = Math.max(0, Math.min(100, Number(rateText.replace(/[^0-9.-]/g, '')) || 0));
    const match = hint.match(/(\d+)\s+av\s+(\d+)/i);
    const completed = Number(match?.[1] || 0);
    const total = Number(match?.[2] || 0);
    const remaining = Math.max(0, total - completed);

    const kpi = dash.querySelector('.v35-kpis .v35-kpi:first-child');
    if (kpi) {
      const strong = kpi.querySelector('div > strong');
      const hintEl = kpi.querySelector('div > span');
      const bar = kpi.querySelector('i > b');
      if (strong && strong.textContent.trim() !== rateText) strong.textContent = rateText;
      if (hintEl && hintEl.textContent.trim() !== hint) hintEl.textContent = hint;
      if (bar) bar.style.width = `${rate}%`;
    }

    const progress = dash.querySelector('.v35-topgrid > .v35-card:first-child .v35-progress');
    if (progress) {
      const big = progress.querySelector('.v35-donut .big');
      const circle = progress.querySelector('.v35-donut .value');
      const doneEl = progress.querySelector('div > p:nth-of-type(1) b');
      const remainEl = progress.querySelector('div > p:nth-of-type(2) b');
      const totalEl = progress.querySelector('div > strong');
      if (big) big.textContent = `${rate}%`;
      if (circle) {
        const circumference = 2 * Math.PI * 43;
        const dashLength = rate / 100 * circumference;
        circle.setAttribute('stroke-dasharray', `${dashLength} ${circumference - dashLength}`);
      }
      if (doneEl) doneEl.textContent = `${completed} (${rate}%)`;
      if (remainEl) remainEl.textContent = `${remaining} (${Math.max(0, 100 - rate)}%)`;
      if (totalEl) totalEl.textContent = String(total);
    }
  }

  function pingConsolidation(dash) {
    if (lastPingDash === dash) return;
    lastPingDash = dash;
    const app = document.querySelector('#app');
    if (!app) return;
    const marker = document.createElement('i');
    marker.hidden = true;
    marker.dataset.v372Ping = '1';
    app.appendChild(marker);
    marker.remove();
  }

  function releaseDashboardWhenReady() {
    scheduled = false;
    const dash = document.querySelector('#v35Dashboard');
    if (!dash) return;

    syncPersonalProgress(dash);

    const annualOverview = dash.querySelector('#v370PlanOverview');
    const nextCard = dash.querySelector('.v35-next');
    const consolidatedNext = nextCard?.dataset?.v370Plan;

    if (annualOverview && nextCard && consolidatedNext) {
      dash.classList.add('v371-ready');
      return;
    }

    dash.classList.remove('v371-ready');
    pingConsolidation(dash);
  }

  function scheduleCheck() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(releaseDashboardWhenReady);
  }

  const app = document.querySelector('#app');
  if (app) {
    new MutationObserver(scheduleCheck).observe(app, { childList: true, subtree: true });
  }

  [0, 50, 150, 350, 700, 1400].forEach(ms => setTimeout(releaseDashboardWhenReady, ms));
})();
