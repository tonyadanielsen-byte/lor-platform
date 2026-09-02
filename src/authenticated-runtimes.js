const auth = window.firebase?.auth?.();
let runtimesLoaded = false;
let reloadAfterLogout = false;

async function loadAuthenticatedRuntimes() {
  if (runtimesLoaded) return;
  runtimesLoaded = true;

  await import('./v35-runtime.js?v=3.8.17');
  await import('./v35-plan-consistency.js?v=3.8.17');
  await import('./v366-functional-hotfix.js?v=3.8.17');
  await import('./v384-plan-engine.js?v=3.8.17');
  await import('./v371-runtime.js?v=3.8.17');
  await import('./v363-guard.js?v=3.8.17');
  await import('./v374-hotfix.js?v=3.8.17');

  document.documentElement.dataset.authenticatedRuntimes = '3.8.17';
}

if (!auth) {
  console.error('[LOR 3.8.17] Firebase Auth er ikke tilgjengelig for runtime-loader.');
} else {
  auth.onAuthStateChanged(user => {
    if (user) {
      loadAuthenticatedRuntimes().catch(error => {
        runtimesLoaded = false;
        console.error('[LOR 3.8.17] Kunne ikke laste autentiserte runtimes', error);
      });
      return;
    }

    if (runtimesLoaded && !reloadAfterLogout) {
      reloadAfterLogout = true;
      setTimeout(() => location.reload(), 0);
    }
  });

  if (auth.currentUser) {
    loadAuthenticatedRuntimes().catch(error => {
      runtimesLoaded = false;
      console.error('[LOR 3.8.17] Kunne ikke laste autentiserte runtimes', error);
    });
  }
}
