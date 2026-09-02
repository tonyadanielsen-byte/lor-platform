let deferredInstallPrompt = window.__lorDeferredInstallPrompt || null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function removeInstallButton() {
  document.querySelector('#lorInstallApp')?.remove();
}

async function launchInstall() {
  deferredInstallPrompt = deferredInstallPrompt || window.__lorDeferredInstallPrompt || null;
  if (!deferredInstallPrompt) return;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  window.__lorDeferredInstallPrompt = null;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  removeInstallButton();
}

function renderInstallButton() {
  if (!deferredInstallPrompt || isStandalone() || document.querySelector('#lorInstallApp')) return;
  const button = document.createElement('button');
  button.id = 'lorInstallApp';
  button.type = 'button';
  button.textContent = 'Installer LOR';
  button.setAttribute('aria-label', 'Installer LOR som app på denne enheten');
  Object.assign(button.style, {
    position: 'fixed', right: '16px', bottom: '18px', zIndex: '9999', border: '0',
    borderRadius: '14px', padding: '13px 18px', font: 'inherit', fontWeight: '800',
    color: '#fff', background: '#073A39', boxShadow: '0 12px 30px rgba(7,58,57,.28)', cursor: 'pointer'
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

if (deferredInstallPrompt) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderInstallButton, { once: true });
  else renderInstallButton();
}
