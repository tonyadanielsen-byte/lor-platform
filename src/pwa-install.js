let deferredInstallPrompt = window.__lorDeferredInstallPrompt || null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function removeInstallButton() {
  document.querySelector('#lorInstallApp')?.remove();
  document.querySelector('#lorInstallHelp')?.remove();
}

function showInstallHelp() {
  document.querySelector('#lorInstallHelp')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'lorInstallHelp';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '10000', display: 'grid', placeItems: 'center',
    background: 'rgba(4,20,28,.56)', padding: '20px'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(460px, 92vw)', background: '#fff', color: '#0a2334', borderRadius: '22px',
    padding: '24px', boxShadow: '0 24px 70px rgba(0,0,0,.28)', font: 'inherit'
  });
  card.innerHTML = `
    <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#08745f;text-transform:uppercase">Installer LOR</div>
    <h2 style="margin:7px 0 10px;font-size:24px">Nettleseren har ikke frigitt installasjonsprompten ennå</h2>
    <p style="margin:0 0 18px;line-height:1.5;color:#60758a">LOR er klar som PWA. Trykk «Last inn på nytt» under; siden fanger installasjonssignalet helt fra oppstart og åpner installasjonen så snart nettleseren tilbyr den.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
      <button type="button" data-close style="border:1px solid #d7e0e8;background:#fff;border-radius:12px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer">Lukk</button>
      <button type="button" data-reload style="border:0;background:#073A39;color:#fff;border-radius:12px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer">Last inn på nytt</button>
    </div>`;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  card.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  card.querySelector('[data-reload]').addEventListener('click', () => location.reload());
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
}

async function launchInstall() {
  deferredInstallPrompt = deferredInstallPrompt || window.__lorDeferredInstallPrompt || null;
  if (!deferredInstallPrompt) {
    showInstallHelp();
    return;
  }
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  window.__lorDeferredInstallPrompt = null;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  if (isStandalone()) removeInstallButton();
}

function renderInstallButton() {
  if (isStandalone() || document.querySelector('#lorInstallApp')) return;

  const button = document.createElement('button');
  button.id = 'lorInstallApp';
  button.type = 'button';
  button.textContent = 'Installer LOR';
  button.setAttribute('aria-label', 'Installer LOR som app på denne enheten');
  Object.assign(button.style, {
    position: 'fixed', right: '16px', bottom: '18px', zIndex: '9999', border: '0',
    borderRadius: '14px', padding: '13px 18px', font: 'inherit', fontWeight: '800',
    color: '#fff', background: '#073A39', boxShadow: '0 12px 30px rgba(7,58,57,.28)',
    cursor: 'pointer'
  });
  button.addEventListener('click', launchInstall);
  document.body.appendChild(button);
}

window.addEventListener('lorinstallpromptready', () => {
  deferredInstallPrompt = window.__lorDeferredInstallPrompt || deferredInstallPrompt;
  renderInstallButton();
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  window.__lorDeferredInstallPrompt = event;
  renderInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  window.__lorDeferredInstallPrompt = null;
  removeInstallButton();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderInstallButton, { once: true });
} else {
  renderInstallButton();
}
