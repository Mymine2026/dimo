// Elenco dei rilasci, dal più recente. Ad ogni rilascio: aggiungere una voce IN CIMA
// (versione successiva, data, titolo, note). La prima voce è la versione mostrata in pagina.

export interface Release {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

export const RELEASES: Release[] = [
  {
    version: "1.11.1",
    date: "29/10/2026",
    title: "Previsione dei km più stabile",
    notes: [
      "La previsione dei km alla scadenza usa la media dalla consegna (km usati ÷ tempo trascorso × durata), che assorbe i mesi anomali; il ritmo degli ultimi giorni resta come informazione e non cambia il livello di rischio",
      "Previsione e rischio compaiono dopo i primi 6 mesi di utilizzo, per non dare avvisi su dati ancora instabili; un veicolo già oltre i km inclusi viene segnalato subito",
      "Soglie: oltre il 110% dei km inclusi «oltre i km», tra il 95% e il 110% «vicino al limite»; nella scheda compaiono anche i km al mese consentiti dal contratto",
      "Lettura del libretto: la classe ambientale non viene più confusa con il riferimento a un regolamento e una massa in servizio incoerente viene lasciata vuota",
    ],
  },
  {
    version: "1.11.0",
    date: "28/10/2026",
    title: "Contratto di noleggio e km, nuova grafica",
    notes: [
      "Pagina Flotta per chi gestisce: indicatori (veicoli con dati, contratti a rischio km, scadenze entro 60 giorni, sensori senza dati), contratti in ordine di rischio con barra dei km, elenco «Richiede attenzione» e mappa compatta",
      "Pagina del veicolo: i grafici a tutta larghezza diventano riquadri piccoli e affiancati (valore attuale, minimo, media e massimo) che si ingrandiscono con un clic",
      "Nella pagina del veicolo, per chi gestisce, c'è la scheda «Contratto di noleggio e km»: km inclusi, consegna, durata, km alla consegna, costo extra km e proroghe",
      "Dal contachilometri del sensore l'app calcola i km usati dalla consegna, la quota di tempo trascorso, i km previsti alla scadenza, l'eventuale sforamento con il costo extra stimato e la data in cui si raggiungono i km inclusi",
      "Il rischio (in regola, vicino al limite, oltre i km inclusi) tiene conto del ritmo degli ultimi giorni; senza dati sufficienti mostra cosa manca",
    ],
  },
  {
    version: "1.10.4",
    date: "26/10/2026",
    title: "Lettura libretti più robusta",
    notes: [
      "Corretto l'errore \"Payload too large\" di Brainy: le immagini del libretto vengono ridotte a una dimensione accettata e, se rifiutate, si riprova automaticamente più piccole",
      "Se il server risponde con un errore, le schermate dei libretti mostrano un messaggio leggibile",
    ],
  },
  {
    version: "1.10.3",
    date: "26/10/2026",
    title: "Targa accanto al nome e sensore associabile",
    notes: [
      "Nell'elenco e nella pagina del veicolo la targa letta dal libretto compare accanto al nome; la ricerca trova anche per targa",
      "Un veicolo creato dal libretto esiste anche senza sensore (\"senza sensore\"): il sensore Ruptela si associa dopo, inserendo l'IMEI nella Scheda veicolo, e può essere sostituito o scollegato",
      "Del sensore si salvano ora tutti i segnali ricevuti (esclusi quelli non disponibili), per decidere con calma quali visualizzare",
    ],
  },
  {
    version: "1.10.2",
    date: "26/10/2026",
    title: "Documenti collegati ai veicoli della flotta",
    notes: [
      "Nella pagina Documenti il menu dei veicoli mostra i veicoli registrati in flotta (anche quelli senza token DIMO); spariscono le voci di prova della tabella vecchia",
      "I documenti sono visibili a chi ha accesso al veicolo, oltre a chi li ha caricati e all'azienda; il super admin vede tutto",
      "Un documento si può collegare solo a veicoli a cui si ha accesso",
    ],
  },
  {
    version: "1.10.1",
    date: "26/10/2026",
    title: "Aziende: elenco di veicoli e utenti",
    notes: [
      "Nella tab Aziende ogni riga si apre e mostra i veicoli (nome, targa, token) e gli utenti dell'azienda",
      "Corretto il conteggio dei veicoli per azienda, che leggeva una tabella vecchia e non mostrava i veicoli assegnati",
    ],
  },
  {
    version: "1.10.0",
    date: "26/10/2026",
    title: "Veicoli e scheda dal libretto",
    notes: [
      "Nuovi veicoli da libretto: in Amministrazione, dalla riga dell'azienda o dalla tab Veicoli, si caricano le foto o i PDF dei libretti; il modello di Brainy legge i dati, li si controlla e l'app crea il veicolo con la sua scheda",
      "Scheda veicolo nella pagina del veicolo: dati tecnici, scadenza della revisione (stimata se non letta dal libretto), intestatario visibile solo a chi gestisce l'azienda e copia del libretto",
      "Si può caricare un nuovo libretto anche su un veicolo esistente, e collegare subito il sensore Ruptela con l'IMEI",
      "Il token DIMO diventa facoltativo: i veicoli senza token ricevono i dati solo dal sensore diretto",
    ],
  },
  {
    version: "1.9.1",
    date: "26/10/2026",
    title: "Dati del sensore nella scheda veicolo",
    notes: [
      "I dati ricevuti direttamente dal sensore (velocità, giri, carburante, temperatura, odometro, posizione) compaiono ora anche nelle schede e nei grafici del veicolo, aggiornati in tempo reale",
      "Per i veicoli con sensore diretto gli ultimi valori sono quelli del sensore, non più quelli vecchi di DIMO",
    ],
  },
  {
    version: "1.9.0",
    date: "25/10/2026",
    title: "Ricezione diretta dai sensori",
    notes: [
      "Nuovo ingresso per i sensori Ruptela: i dati arrivano al server senza passare da DIMO e vengono salvati ogni 10 secondi in marcia",
      "Registro dei sensori (IMEI -> veicolo): i dati di sensori non registrati vengono rifiutati",
      "Mercedes: giri, velocità, odometro, carburante e temperatura letti dal bus del veicolo, quadro corretto",
      "Gestione > Sensori: consumo dati della SIM di ogni sensore, in % sulla soglia di 1 GB al mese (il mese parte dal primo giorno di utilizzo), con chiusura di fine giornata",
    ],
  },
  {
    version: "1.8.0",
    date: "09/10/2026",
    title: "Gestione: scadenze e autisti",
    notes: [
      "Nuova sezione Gestione con le scadenze di manutenzione per veicolo (a km e/o a data, con stato scaduta / in scadenza / in regola)",
      "Segna come eseguita: la scadenza si ricalcola e l'intervento resta nello storico manutenzioni",
      "Assegnazione dell'autista al veicolo nel tempo, con storico; l'autista vede solo il veicolo che ha in quel momento",
      "Utilizzo per autista: km, giorni di utilizzo, km fuori orario e velocità media in marcia",
    ],
  },
  {
    version: "1.7.0",
    date: "08/10/2026",
    title: "Sicurezza e accesso per azienda",
    notes: [
      "Dati veicolo (ultimi valori, telemetria, storico, manutenzioni) visibili solo a chi ha accesso a quel veicolo: super admin, admin dell'azienda, autista assegnato",
      "Rimossi gli endpoint di debug e di prova, compreso uno che restituiva il token sviluppatore DIMO",
      "Limite ai tentativi di login ripetuti e accesso ai documenti solo al proprietario o alla stessa azienda",
      "Tutte le pagine richiedono il login",
    ],
  },
  {
    version: "1.6.0",
    date: "08/10/2026",
    title: "Velocità corrette e riferimento versione",
    notes: [
      "IVECO: velocità stimata dall'odometro (DIMO la riporta ~0 anche in marcia)",
      "Trafic: motore acceso dedotto da giri/velocità, non più solo dal flag quadro",
      "Versione e data di build visibili in pagina (login e profilo)",
    ],
  },
  {
    version: "1.5.0",
    date: "25/09/2026",
    title: "Analytics dallo storico locale",
    notes: [
      "Grafici, km al giorno e punteggio di guida letti dal database locale (5 min)",
      "Solo il periodo precedente la raccolta viene ricavato da DIMO",
    ],
  },
  {
    version: "1.4.0",
    date: "25/09/2026",
    title: "Percorsi agganciati alle strade",
    notes: [
      "Tracciato GPS dallo storico locale a 5 min",
      "Servizio OSRM self-hosted: la linea segue le strade invece di tagliare dritto",
    ],
  },
  {
    version: "1.3.0",
    date: "25/09/2026",
    title: "Telemetria salvata nel database",
    notes: [
      "Un punto ogni 5 minuti per veicolo, salvato nella tabella telemetry",
      "/api/latest legge prima dal database, poi da DIMO",
      "Indicazione SCADUTO sul tagliando oltre i km previsti",
    ],
  },
  {
    version: "1.2.0",
    date: "prima del 25/09/2026",
    title: "Km nel periodo e menu in italiano",
    notes: ["Km percorsi nel periodo selezionato", "Menu tradotto in italiano"],
  },
];

export const CURRENT_RELEASE = RELEASES[0];
