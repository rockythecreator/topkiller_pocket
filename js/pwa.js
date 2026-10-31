// Optional enhancement: the simulator also works when service workers are unavailable.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    const status = document.getElementById('offline-status');
    const show = text => { if (status) status.textContent = text; };
    show('Preparazione della modalità offline…');
    try {
      const registration = await navigator.serviceWorker.register('/topkiller_pocket/sw.js', {
        scope: '/topkiller_pocket/', updateViaCache: 'none',
      });
      const installed = () => {
        if (registration.waiting) {
          show('Aggiornamento pronto. Chiudi tutte le finestre dell’app e riaprila per usarlo.');
        } else if (registration.active) {
          show('App pronta per l’uso offline su questo browser.');
        }
      };
      installed();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (worker) worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' || worker.state === 'activated') installed();
          if (worker.state === 'redundant' && !registration.active) show('Preparazione offline non riuscita. Riprova con una connessione attiva.');
        });
      });
      navigator.serviceWorker.ready.then(installed);
      // Check again when a long-lived installed app returns to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    } catch (error) {
      show('Modalità offline non disponibile in questa visita. Puoi usare il simulatore online.');
      console.warn('Modalità offline non disponibile in questa visita.', error);
    }
  });
}
