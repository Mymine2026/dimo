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
