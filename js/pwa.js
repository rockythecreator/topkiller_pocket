// Optional enhancement: the simulator also works without service workers.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    const status = document.getElementById('offline-status');
    const show = text => { if (status) status.textContent = text; };
    let checkNumber = 0;
    show('Preparazione della modalità offline…');
    try {
      const registration = await navigator.serviceWorker.register('/topkiller_pocket/sw.js', {
        scope: '/topkiller_pocket/', updateViaCache: 'none',
      });
      const installed = async () => {
        const number = ++checkNumber;
        const worker = registration.active;
        if (!worker || worker.state !== 'activated') return;
        show('Verifica della modalità offline…');
        const ready = await new Promise(resolve => {
          const channel = new MessageChannel();
          // A missing reply cannot establish readiness (e.g. a previous worker).
          const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, 15000);
          channel.port1.onmessage = event => {
            clearTimeout(timeout); channel.port1.close(); resolve(event.data?.ready === true);
          };
          worker.postMessage({ type: 'CHECK_OFFLINE' }, [channel.port2]);
        });
        if (number !== checkNumber) return;
        if (!ready) {
          show('Cache offline incompleta. Riconnettiti a Internet e riprova ricaricando la pagina.');
        } else if (registration.waiting) {
          show('Aggiornamento pronto. Chiudi tutte le finestre dell’app e riaprila per usarlo.');
        } else if (window.topkillerInitialized) {
          show('App pronta per l’uso offline su questo browser.');
        } else {
          show('Il simulatore non è stato caricato. Riprova ricaricando la pagina.');
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
      navigator.serviceWorker.addEventListener('controllerchange', installed);
      window.addEventListener('topkiller-ready', installed);
      window.addEventListener('online', installed);
      window.addEventListener('offline', installed);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          installed(); registration.update().catch(() => {});
        }
      });
    } catch (error) {
      show('Modalità offline non disponibile in questa visita. Riconnettiti a Internet e riprova.');
      console.warn('Modalità offline non disponibile in questa visita.', error);
    }
  });
}
