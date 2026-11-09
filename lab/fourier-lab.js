// lab/fourier.html: a theme switch, and destroying and remounting the second panel. The theme starts
// from the suite's stored setting and isn't written back.
(function () {
  'use strict';
  const html = document.documentElement, buttons = document.querySelectorAll('#theme button');
  function setTheme(theme) {
    if (theme === 'auto') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', theme);
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
  }
  let stored = 'auto';
  try { stored = (JSON.parse(localStorage.getItem('signoff.v1.settings') || '{}').theme) || 'auto'; } catch (e) { /* no storage */ }
  setTheme(stored);
  for (const b of buttons) b.addEventListener('click', () => setTheme(b.dataset.theme));

  const host = document.getElementById('panelB'), toggle = document.getElementById('toggleB');
  toggle.addEventListener('click', () => {
    if (host.signoffFourier) {
      host.signoffFourier.destroy();
      toggle.textContent = 'Mount it again';
    } else {
      SignoffFourier.mountAll(host.parentElement);
      toggle.textContent = 'Destroy this panel';
    }
  });
})();
