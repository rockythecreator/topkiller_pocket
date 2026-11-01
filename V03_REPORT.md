# TOPKILLER Pocket V0.3.0 — report di implementazione

Stato tecnico: pronta per revisione indipendente; nessuna autorizzazione al merge
implicita. Nessun deployment o modifica di main. Ramo:
`feat/topkiller-pocket-v0.3-monte-carlo`.

## Base e integrità

Base verificata prima di scrivere: `7dfccfa1c2c4ea96a61e6473429c779a93a98cf5`
(main V0.2.1); working tree inizialmente pulito.
Il blob di `js/math.js` è ancora:

`70427602445a7145577af4cf89cbfe2f247675f6`

Verifiche: `git hash-object js/math.js`, confronto con la base e test automatico
dell’hash Git (header blob incluso). Anche `js/app.js`, `js/settings.js`,
`js/pwa.js`, manifest e icone restano invariati rispetto alla base.
Chiave e schema localStorage invariati: `topkiller-pocket:v0.1`.

## Cinque fasi completate

1. Motore isolato: RNG crypto con buffer, PCG32 deterministico, Knuth senza limite
   ai gol, conteggi di nove eventi e mappa dinamica di tutti i risultati esatti.
2. Statistica: Wilson con z=1,959964, differenze non arrotondate, riferimento tramite
   `simulate()` e probabilità dei risultati esatti in modulo separato.
3. Interfaccia: tre volumi, snapshot lambda, barre e testi, avanzamento, annullamento,
   worker con handshake e fallback a macrotask. Una sola esecuzione, runId,
   ripartenza da zero in fallback, invalidazione su lambda/reset, rinomina senza
   ricalcolo. Il background annulla esplicitamente, senza ripresa di risultati parziali.
4. PWA: versione 0.3.0 e cache completa di 16 risorse, compresi i cinque nuovi moduli.
   Gestione aggiornamenti e audit offline V0.2.1 conservati; documentato rollback
   con rilascio successivo, senza promessa di rollback immediato offline.
5. Audit: regressioni eseguite, test statistici, test worker/fallback, aggiornamento
   reale da V0.2.1, misure locali e controllo dei file protetti.

## File

Creati: `js/mc-rng.js`, `js/monte-carlo.js`, `js/mc-statistics.js`,
`js/mc-worker.js`, `js/mc-ui.js`, `tests/mc.test.js`, `tests/mc-browser.cjs`,
questo report.

Modificati: `index.html`, `styles.css` (regole aggiuntive per il pannello),
`sw.js` (versione e risorse), `package.json` (solo versione), `README.md`,
`tests/pwa.cjs`, `tests/patch.cjs`.
Nei test precedenti sono cambiate soltanto aspettative di versione/risorse e il
sostitutore della versione nel server di test; aggiunta la simulazione offline.
Nessuna asserzione di regressione rimossa. Nessuna dipendenza aggiunta.

## Piano statistico fissato prima dell’esecuzione

Sei scenari: (0,20;0,20), (3,50;3,50), (0,20;3,50), (3,50;0,20),
(1,45;1,10), (1,00;1,00). Ognuno eseguito con 1.000, 10.000 e 100.000 partite.
Seed fissati a `20261101 + indice scenario`, stream PCG32 54, senza ricerca di seed.

42 confronti per esecuzione, 756 totali:

- nove eventi di mercato;
- frequenze marginali dei gol 0–10 per ciascuna squadra (22);
- media e secondo momento centrato di ciascuna squadra (4);
- indicatore congiunto 0–0 e prodotto centrato per l’indipendenza (2);
- cinque risultati esatti prefissati: 0–0, 1–0, 0–1, 1–1, 6–0.

Budget complessivo di falso allarme 10^-4, Bonferroni: alpha=10^-4/756.
Ogni confronto applica il limite bilaterale di Bernstein:

`sqrt(2 Var(X) log(2/alpha)/N) + 2 B log(2/alpha)/(3N)`.

Per frequenze binomiali si usa Var=p(1-p), B=1. Per media e varianza si
analizzano i trasformati limitati min(gol,20) e il loro secondo momento centrato;
per l’indipendenza il prodotto dei trasformati centrati. Attese e varianze sono
calcolate indipendentemente tramite log-fattoriali sul supporto 0–80. La massa
oltre 80, per lambda <=3,5, è trascurabile rispetto alla precisione floating point
(e inferiore a 10^-77); non cambia le soglie numeriche. Il limite 20 riguarda
solo i trasformati diagnostici: il campionatore e i conteggi NON troncano i gol.
I limiti B sono conservativi (20 o 400). Le soglie sono quindi prudenti,
soprattutto per i momenti a N=1.000; non dimostrano perfezione del generatore.
Non si richiede che ogni intervallo Wilson al 95% contenga il valore teorico.

## Test effettivamente eseguiti

Ambiente: Linux, Node.js 24.19.0, Chromium 154.0.8037.57 headless.

| Comando | Risultato |
| --- | --- |
| `npm test` | PASS: suite matematica/settings preesistente, nuove verifiche deterministiche/statistiche e blob protetto |
| `CHROMIUM_PATH=/usr/bin/chromium node tests/browser.cjs` | PASS: regressioni V0.1 a 320/390/430/1440 px e localStorage bloccato |
| `node tests/pwa.cjs` | PASS: manifest/icone/scope/cache, riapertura e simulazione offline, aggiornamento fallito/riuscito |
| `node tests/patch.cjs` | PASS: tutti gli otto casi V0.2.1, inclusi errori matematici osservabili e riparazione cache |
| `node tests/mc-browser.cjs` | PASS: worker reale = fallback = motore con seed; errori costruzione/caricamento/handshake; restart da zero; runId obsoleti; UI e upgrade |
| `git diff --check` e confronto file protetti | PASS |

I test numerici includono i vettori PCG32 di riferimento seed42/stream54
(a15c02b7, 7b47f409, ba1d3330, 83d2f293, bfa4784b, cbed606e), uniformi aperte,
validazioni, casi artificiali dei mercati, risultati oltre cinque gol, identità dei
conteggi, indipendenza dai blocchi, annullamento e Wilson a 0/N/intermedi.
La suite Poisson preesistente continua a controllare tutte le 109.561 coppie di slider.

UI verificata a 320, 390, 393, 430 e 1440 px: nessun overflow, pulsante Simula >=48px,
priorità teorica dei risultati esatti, etichette aggiornate senza cambiare conteggi,
annullamento, lambda/reset e background invalidanti, persistenza precedente.
Worker, fallback e mancanza di entropia verificati; nessuna percentuale simulata
presentata in caso di errore; Poisson rimane interattivo. Nessuna richiesta esterna
rilevata nel flusso UI verificato.

La prova di aggiornamento serve prima i veri file del commit V0.2.1, poi quelli
correnti sullo stesso origin: nuova cache attiva dopo chiusura, vecchia eliminata,
scenario conservato, riapertura e simulazione senza rete.

## Prestazioni osservate, non garanzie iPhone

Misura locale di una esecuzione per configurazione, senza throttling, con casualità
crypto. Dal click programmatico a risultati renderizzati, inclusa creazione worker;
non è un benchmark statistico ripetuto né una misura fisica mobile.

| Percorso | Lambda | 100.000 partite |
| --- | --- | ---: |
| Worker | 1,45 / 1,10 | 454,5 ms |
| Worker | 3,50 / 3,50 | 495,5 ms |
| Fallback | 1,45 / 1,10 | 1.667,0 ms |
| Fallback | 3,50 / 3,50 | 1.659,6 ms |

PerformanceObserver non ha registrato task principali >=50 ms nelle quattro
finestre di misura (calcolo, rendering finale e 100 ms successivi). Questo non
esclude blocchi in altri browser, su hardware lento o in interazioni non misurate.
Avanzamento visivo intermedio: circa 124,7–128,8 ms; ultimi intervalli più brevi
per il completamento. Gli annunci live sono volutamente meno frequenti.
Un annullamento UI worker misurato tramite Playwright ha richiesto circa 63,5 ms,
incluso il costo di interazione dell’automazione; il fallback è verificato
funzionalmente ma non ha una misura separata di latenza di annullamento.

Nessuna soglia iPhone è dichiarata superata. Obiettivi da misurare fisicamente:
nessun blocco >50 ms, annullamento entro 200 ms in primo piano, aggiornamenti
100–250 ms nei calcoli lunghi, 100.000 partite in circa 5 secondi su iPhone 16.
Le misure sono registrate senza asserzioni artificiali per nascondere risultati
sfavorevoli. Nessuna soglia o seed è stato cambiato dopo un fallimento.

## Limiti e verifiche manuali richieste

Non eseguiti: iPhone 16/iOS e Safari reali, VoiceOver reale, WebKit, Android e
installazione desktop. Non disponibili dispositivi fisici in questo ambiente.
Le verifiche DOM/accessibilità, reduced-motion CSS e viewport non sostituiscono
una prova assistiva reale. PWA installata su Safari può avere storage distinto
dalla scheda: seguire la procedura README e riprovare dalla Home.

Provare fisicamente installazione, modalità aereo per i tre volumi, aggiornamento,
ritorno dal background, annullamento, modalità risparmio energetico, testo
Ingrandito e VoiceOver. Se una soglia non è raggiunta, annotare condizioni,
misure e problema senza indebolire i test. Il browser può eliminare la cache;
nessuna garanzia di persistenza assoluta o rollback immediato offline.

## Consegna

Commit coerenti per motore, statistica, UI, PWA e audit sul solo ramo V0.3.
Una sola PR finale verso main se l’API lo consente. In caso di `Forbidden`, il
ramo remoto e il collegamento per aprire la PR costituiscono la consegna:
non si dichiara creata una PR senza conferma GitHub. Nessun merge o deployment.
