# TOPKILLER Pocket · V0.2.1

Piccola web app didattica per esplorare probabilità calcistiche con parametri manuali. HTML, CSS e JavaScript nativi: nessun framework, backend, API esterna, font remoto o CDN. Nessun dato calcistico reale, quota o consiglio di scommessa.

L'etichetta «Simulatore didattico: parametri manuali, non previsioni reali» resta visibile durante lo scorrimento.

## Cosa puoi fare

- Modificare i nomi di casa e ospite (solo etichette, massimo 40 caratteri).
- Impostare due gol attesi λ da 0,20 a 3,50 con passo 0,01; valori iniziali 1,45 e 1,10.
- Leggere 1/X/2, Over/Under 1,5 e 2,5, BTTS Sì/No, cinque risultati esatti più probabili e matrice 0–5 per entrambe le squadre.
- Ripristinare i valori iniziali con un pulsante.
- Ritrovare lo scenario sullo stesso browser tramite localStorage. Se il browser impedisce il salvataggio, i calcoli continuano a funzionare e compare un messaggio. Non c'è sincronizzazione tra dispositivi.

Interfaccia in italiano, dark mode blu notte e verde, mobile-first, con controlli etichettati, focus visibile, tabella accessibile e nomi inseriti come testo, senza interpretare HTML.

## Provarla sul Mac

Dalla cartella del repository, con Python 3 installato:

```sh
cd ..
python3 -m http.server 8000 --bind 127.0.0.1
```

Apri `http://localhost:8000/topkiller_pocket/`. Questo presuppone che la cartella del repository si chiami `topkiller_pocket`. Interrompi il server con Ctrl+C. Usa un server HTTP: l'apertura diretta di `index.html` come file può bloccare i moduli JavaScript.

## Provarla sul telefono senza pubblicarla

1. Collega Mac e telefono alla stessa rete Wi-Fi privata.
2. Dal Mac, nella cartella che contiene `topkiller_pocket`, avvia `python3 -m http.server 8000 --bind 0.0.0.0`.
3. Trova l'indirizzo IP locale del Mac in Impostazioni di Sistema → Wi-Fi → Dettagli → TCP/IP.
4. Sul telefono apri `http://INDIRIZZO-IP-DEL-MAC:8000/topkiller_pocket/` in Safari o Chrome. Se richiesto, consenti al firewall del Mac l'accesso al server sulla rete locale.
5. Muovi gli slider, cambia i nomi, ricarica e prova il ripristino. Termina il server con Ctrl+C dopo la prova: durante l'esecuzione rende accessibile sulla rete la cartella servita.

## GitHub Pages: solo dopo la tua approvazione

La V0.1 è predisposta per il percorso `/topkiller_pocket/` usando collegamenti relativi. Non contiene workflow di pubblicazione e non modifica impostazioni di hosting.

Quando decidi di pubblicare:

1. Revisiona e integra la pull request in `main`.
2. Nel repository GitHub apri Settings → Pages.
3. Seleziona «Deploy from a branch», ramo `main`, cartella `/ (root)`, quindi Save.
4. Attendi che GitHub confermi la pubblicazione e apri `https://rockythecreator.github.io/topkiller_pocket/` dal telefono.

Questi passaggi di integrazione e pubblicazione **non sono stati eseguiti**.

## Matematica e accuratezza

Si assumono X ~ Poisson(λ casa) e Y ~ Poisson(λ ospite), indipendenti. La probabilità esatta è `P(X=h,Y=a) = P(X=h) × P(Y=a)`.

Il motore genera le probabilità mediante ricorrenza da `exp(-λ)`. Il supporto viene esteso finché un limite superiore geometrico della coda omessa è inferiore a `1e-17` per squadra. Dopo il termine k, il limite è `p(k+1)/(1-λ/(k+2))`, applicabile quando il rapporto è minore di 1. L'errore di troncamento congiunto è quindi inferiore a `2e-17`; questo limite riguarda il troncamento, non gli inevitabili arrotondamenti floating point. Le somme usano l'algoritmo di Kahan.

1/X/2 vengono sommati sul supporto esteso, senza divisione per la massa trattenuta. Le probabilità totali Over/Under sono calcolate dalla Poisson di parametro `λ casa + λ ospite`; BTTS Sì è `(1-exp(-λ casa)) × (1-exp(-λ ospite))`, con `expm1` per accuratezza numerica. I complementi sono ottenuti sottraendo da 1.

La matrice 6×6 mostra probabilità assolute: non deve sommare a 100%. Viene indicata separatamente la massa dei risultati con almeno una squadra a 6 o più gol. Anche i cinque risultati più probabili sono ricavati dal supporto esteso; a parità di probabilità si ordinano prima i gol casa e poi quelli ospite in ordine crescente.

Con i valori iniziali, i risultati arrotondati sono:

| Grandezza | Risultato |
| --- | ---: |
| Casa | 45,13% |
| Pareggio | 26,20% |
| Ospite | 28,67% |
| Over 2,5 | 46,89% |
| BTTS Sì | 51,06% |
| Risultato più probabile | 1–1 · 12,45% |

Il modello non considera forma, avversari reali, correlazioni o eventi della partita. I parametri sono scelti dall'utente. Le percentuali visualizzate sono arrotondate a due decimali.

## Test automatici

Con Node.js 20 o successivo, senza installare dipendenze:

```sh
npm test
```

**Eseguiti con successo** in questa consegna:

- Sei gruppi di test matematici e delle impostazioni, inclusi i valori di riferimento richiesti.
- Tutte le 109.561 coppie di slider: 1+X+2, complementi, intervallo [0,1], ordine Over 1,5 ≥ Over 2,5, simmetria per λ uguali e limite della coda.
- Confronto con un calcolo indipendente tramite log-fattoriale su supporto 0–80 per 28 coppie, comprese le estremità; simmetria allo scambio casa/ospite. Tolleranza assoluta `1e-13`.
- Matrice non rinormalizzata, limite superiore della coda, parametri non validi, storage assente o corrotto, limiti dei nomi.
- Chromium reale headless a larghezze 320, 390, 430 e 1440 pixel, servendo l'app da `/topkiller_pocket/`: 36 celle, top 5, valori iniziali, slider estremi, nomi trattati come testo, persistenza dopo ricaricamento, ripristino persistente, assenza di overflow orizzontale, etichetta visibile durante lo scorrimento, assenza di errori JavaScript e richieste esterne.
- Chromium con accesso a localStorage bloccato: app e ripristino funzionanti.
- `git diff --check`.

Per ripetere le prove browser occorre Playwright **solo come strumento di sviluppo**, mai usato dall'app:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser.cjs
```

Se Chromium è già installato, puoi indicarlo con `CHROMIUM_PATH=/percorso/chromium node tests/browser.cjs`.

**Non eseguiti:** prove su iPhone, Android e Mac fisici, Safari reale, WebKit e sito pubblicato su GitHub Pages. Il rendering mobile è stato verificato in Chromium con viewport ridotte, non su un telefono reale. Per aggiungere WebKit: `npx playwright install webkit`, quindi `TEST_WEBKIT=1 node tests/browser.cjs`. La suite segnala esplicitamente quando WebKit non viene eseguito.

## File principali

- `index.html`: struttura e contenuti.
- `styles.css`: interfaccia responsive.
- `js/math.js`: motore matematico puro.
- `js/settings.js`: validazione e salvataggio locale.
- `js/app.js`: collegamento tra controlli e risultati.
- `tests/math.test.js`: test numerici e delle impostazioni.
- `tests/browser.cjs`: prove browser con server HTTP locale temporaneo.

Non serve una compilazione. `work/` è ignorata da Git ed è riservata alle prove temporanee.


## V0.2 · Installazione e utilizzo offline

La V0.2 aggiunge una PWA senza dipendenze nell’app. Il motore matematico e i dati
salvati della V0.1 restano invariati. Richiede HTTPS (GitHub Pages) o localhost
per le prove di sviluppo. Non è necessario installarla per usarla offline nel browser.

### Primo caricamento

Con Internet attivo, apri il sito e attendi il messaggio **«App pronta per l’uso
offline su questo browser»** sotto i contenuti. Non basta vedere la prima pagina:
il browser deve aver scaricato tutte le risorse. Se questa preparazione fallisce,
l’app continua a funzionare online e puoi riprovare ricaricando con Internet attivo.
Una prima visita senza rete non può funzionare.

### iPhone e iPad

1. Apri il sito in Safari, con Internet attivo, e attendi il messaggio di disponibilità offline.
2. Tocca Condividi → **Aggiungi alla schermata Home** → Aggiungi.
3. Apri l’icona TOPKILLER dalla Home e attendi nuovamente la conferma offline.
   L’app installata e Safari possono avere archivi separati: verifica lo scenario nell’app installata.
4. Attiva la modalità aereo, chiudi e riapri l’app dalla Home. Verifica slider,
   nomi, risultati e ripristino. Riattiva la connessione al termine della prova.

### Android

1. Apri il sito in Chrome con Internet attivo e attendi la conferma offline.
2. Nel menu ⋮ scegli **Installa app** oppure **Aggiungi a schermata Home**
   (la voce dipende dal browser e dalla versione).
3. Apri l’icona, modifica uno scenario, poi attiva la modalità aereo.
4. Chiudi e riapri l’app e controlla risultati e scenario salvato. Riattiva la rete.

Su desktop Chrome/Edge compatibili, usa l’icona di installazione nella barra degli
indirizzi o il menu del browser. La proposta automatica di installazione non è
garantita su ogni browser; non viene aggiunto un pulsante di installazione artificiale.

### Aggiornamenti e conservazione dei dati

Riapri l’app con Internet attivo per scaricare eventuali aggiornamenti. Il controllo
avviene anche tornando all’app dopo averla lasciata in background. Quando compare
**«Aggiornamento pronto»**, chiudi tutte le finestre e le schede del sito, compresa
l’app installata, poi riapri. Un semplice ricaricamento con altre finestre aperte può
mantenere attiva la versione precedente. Nessun aggiornamento forza il ricaricamento
durante l’uso. Il nuovo worker entra in funzione solo dopo il download completo;
un aggiornamento incompleto lascia disponibile la versione precedente.

La cache contiene esclusivamente HTML, CSS, JavaScript, manifest e icone dell’app,
nel percorso `/topkiller_pocket/`. Le cache delle vecchie versioni dell’app vengono
eliminate all’attivazione della nuova. Il service worker non tocca localStorage,
cache di altre app, richieste esterne o altri percorsi dello stesso sito.
Il browser può comunque eliminare cache e dati per mancanza di spazio o per una
pulizia manuale: in quel caso serve una nuova visita online. La modalità privata
può limitare installazione, persistenza e service worker.

Per ogni futura modifica a una risorsa dell’app, incrementare `VERSION` in `sw.js`
nello stesso rilascio: questo garantisce un download completo della nuova versione.
Non aggiungere `skipWaiting()` senza gestire la coerenza fra le pagine già aperte
e i nuovi moduli. Non aggiungere dati utente o risorse esterne all’elenco `ASSETS`.

### Verifiche V0.2

Dalla cartella del repository, con Playwright disponibile come strumento di sviluppo:

```sh
npm test
mkdir -p work
CHROMIUM_PATH=/usr/bin/chromium node tests/browser.cjs
CHROMIUM_PATH=/usr/bin/chromium node tests/pwa.cjs
```

`CHROMIUM_PATH` può essere adattato al percorso del proprio Chromium. Per la suite
V0.1 si può anche ometterlo quando è installato il browser Playwright.
La suite PWA avvia un server locale temporaneo; non pubblica nulla e non modifica
file dell’app. Serve correttamente manifest e icone con i rispettivi MIME type.

Eseguiti in ambiente Linux con Chromium headless per questa versione:

- Tutta la suite matematica/settings V0.1, comprese 109.561 coppie di slider.
- Tutta la suite browser V0.1: viewport 320, 390, 430 e 1440 pixel,
  persistenza, ripristino, nomi come testo e localStorage bloccato.
- Manifest, dimensioni PNG 192/512/180, registrazione e scope corretti.
- Primo caricamento online, chiusura e riapertura offline, modifica degli slider
  offline, persistenza dopo ricaricamento e ripristino della connessione.
- Aggiornamento incompleto rifiutato, aggiornamento successivo attivato dopo la
  chiusura, eliminazione della vecchia cache e funzionamento offline della nuova.
- Scenario e cache estranee preservati; pagina fuori scope non controllata.
- Confronto Git: `js/math.js` e i test matematici V0.1 invariati rispetto a `main`.

Da provare manualmente: installazione reale dalla Home su iPhone/Safari e Android,
comportamento del sistema operativo alla chiusura, desktop installato, WebKit e
versione effettivamente distribuita su GitHub Pages. Le prove Chromium non
certificano il comportamento di dispositivi fisici o Safari. Questa consegna non
esegue merge né pubblicazione del sito.

## Patch V0.2.1

Correzioni di avvio, conferma offline, accessibilità e versione: vedere [report e test della patch](PATCH_REPORT.md).
La regressione dedicata si esegue con `node tests/patch.cjs`, con Playwright e Chromium disponibili come strumenti di sviluppo.
