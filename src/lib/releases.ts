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
