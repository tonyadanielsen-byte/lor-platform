// V3.7.1 render gate: never expose the legacy dashboard before V3.7.0 has consolidated it.
(() => {
  let scheduled = false;

  function releaseDashboardWhenReady() {
    scheduled = false;
    const dash = document.querySelector('#v35Dashboard');
    if (!dash) return;

    const annualOverview = dash.querySelector('#v370PlanOverview');
    const nextCard = dash.querySelector('.v35-next');
    const consolidatedNext = nextCard?.dataset?.v370Plan;

    if (annualOverview && nextCard && consolidatedNext) {
      dash.classList.add('v371-ready');
      return;
    }

    dash.classList.remove('v371-ready');
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
