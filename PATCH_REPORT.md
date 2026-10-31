# TOPKILLER Pocket V0.2.1 — report della patch

Base verificata: `main`, commit `fec4cdcc6009aeb02e9bf1d57e7bd16a59520a7f`.
Ramo: `fix/topkiller-pocket-v0.2.1`. Nessun merge o deployment.

## Correzioni

- Avvio tramite import dinamico in HTML, indipendente dai moduli esterni: se il modulo principale o una dipendenza non si caricano, oppure l'inizializzazione fallisce, compare un avviso italiano con `role="alert"` e pulsante **Riprova**. Nessun timeout di avvio: i caricamenti lenti non producono un falso errore. L'eccezione originale viene rilanciata e rimane osservabile; il calcolo non viene sostituito con risultati fittizi.
- Il worker attivo controlla tutte le 11 risorse della propria cache prima della conferma offline. Prova a scaricare solo quelle mancanti, verificando prima che il worker sul server abbia la stessa versione. Se manca una risorsa o il recupero fallisce, nessuna conferma positiva: il messaggio invita a riconnettersi e ricaricare. Ricontrollo al ritorno online, in primo piano e al cambio del controller. Nessuna attivazione forzata degli aggiornamenti.
- Nomi accessibili degli slider: “Gol attesi squadra casa” e “Gol attesi squadra ospite”; etichette visive invariate.
- `package.json`, interfaccia e worker a 0.2.1; cache `topkiller-pocket-shell-v0.2.1`. Il manifest non contiene un campo versione e conserva identità, scope e icone.

Nessuna dipendenza aggiunta. `js/math.js`, `js/app.js`, `js/settings.js`, formule, probabilità, CSS e manifest invariati. Nomi, slider, reset e localStorage conservati.

## Test eseguiti

Ambiente Linux, Chromium headless, Playwright già disponibile nell'ambiente di sviluppo.

| Comando / controllo | Esito |
| --- | --- |
| `npm test` | PASS: intera suite matematica e settings, comprese 109.561 coppie di slider, confronto indipendente, code e input non validi |
| `CHROMIUM_PATH=/usr/bin/chromium node tests/browser.cjs` | PASS: viewport 320/390/430/1440, risultati, nomi come testo, slider, persistenza, reset, localStorage bloccato |
| `node tests/pwa.cjs` | PASS: installazione del service worker e shell completa, manifest e icone, chiusura/riapertura offline, persistenza, riconnessione, aggiornamento incompleto rifiutato e aggiornamento completo attivato alla chiusura; cache estranea preservata |
| `node tests/patch.cjs` | PASS: 8 scenari, elencati sotto |
| Confronto Git di `js/math.js` con la base `main` | PASS: identico byte per byte; blob `70427602445a7145577af4cf89cbfe2f247675f6` |
| `git diff --check` | PASS |

Valori di controllo per λ casa 1,45 e λ ospite 1,10: casa **45,13%**, pareggio **26,20%**, ospite **28,67%**, Over 2,5 **46,89%**, BTTS sì **51,06%**, primo risultato **1–1: 12,45%**. Verificati nella suite matematica; browser e PWA controllano inoltre i rispettivi valori già previsti dalle suite V0.2.

Gli 8 scenari della nuova suite sono:

1. HTTP 404 di `js/app.js` con cache vuota, avviso accessibile, Riprova e impostazioni conservate.
2. Caricamento lento senza falso errore e nomi accessibili distinti degli slider.
3. Errore matematico iniettato durante `simulate`: resta osservabile come errore del browser, senza risultati.
4. Cache senza `js/app.js`, online: ripristino automatico verificato nella cache.
5. Cache incompleta con versione diversa sul server: recupero rifiutato.
6. Cache incompleta online con HTTP 404: messaggio d'errore, successivo recupero e riapertura offline.
7. Cache incompleta offline: avviso di avvio, nessuna falsa conferma, recupero alla riconnessione e riapertura offline.
8. Versioni package/interfaccia/worker coerenti.

## Regressioni prima e dopo

La suite finale è stata eseguita anche su una copia immutabile della V0.2 ottenuta con `git archive` della base, usando `TEST_ROOT`.
Sulla V0.2 falliscono, come atteso, 7 scenari: 404 senza avviso, nomi slider, cache non riparata, mancato errore per cache incompleta/versione diversa, cache incompleta online e offline, versione package. Il controllo che gli errori matematici restino osservabili passa già sulla V0.2. Sulla patch passano tutti gli 8 scenari.

Riproduzione del confronto prima/dopo, dalla radice del repository:

```sh
mkdir -p work/baseline
git archive fec4cdcc6009aeb02e9bf1d57e7bd16a59520a7f | tar -x -C work/baseline
TEST_ROOT="$PWD/work/baseline" node tests/patch.cjs # fallimenti attesi sulla V0.2
node tests/patch.cjs # tutti PASS sulla patch
```

## Limiti

Nessun test finale fallito sulla patch. Non eseguiti WebKit/Safari, installazione tramite interfaccia del sistema operativo (Home iOS/Android o desktop), dispositivi fisici e sito pubblico. Le prove automatizzate verificano l'installazione e il ciclo di vita del service worker, non l'installazione reale dell'icona Home. Non è stato eseguito deployment per effettuare queste prove.

Se manca anche l'HTML dalla cache durante una visita offline, il browser non può mostrare un messaggio dell'app: occorre riconnettersi. Il recupero rifiuta risorse di una versione diversa e richiede il normale aggiornamento completo. Il controllo della cache non certifica che il browser non possa eliminarla successivamente.
