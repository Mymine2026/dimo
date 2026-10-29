// Campi della scheda veicolo letti dal libretto di circolazione (carta di circolazione italiana).
// La lettura la fa il modello visione di Brainy (vedi brainy-vision.ts); qui ci sono i tipi, la
// normalizzazione di ciò che il modello risponde e la stima della revisione.

export interface LibrettoFields {
  plate: string;
  vin: string;
  make: string;
  model: string;
  type_approval: string;
  category: string;
  fuel: string;
  displacement_cc: string;
  power_kw: string;
  seats: string;
  mass_max_kg: string;
  mass_service_kg: string;
  euro_class: string;
  first_registration: string; // AAAA-MM-GG
  last_inspection: string;    // AAAA-MM-GG
  next_inspection: string;    // AAAA-MM-GG
  next_inspection_estimated: boolean;
  owner_name: string;
  owner_address: string;
}

export const EMPTY_FIELDS: LibrettoFields = {
  plate: "", vin: "", make: "", model: "", type_approval: "", category: "", fuel: "",
  displacement_cc: "", power_kw: "", seats: "", mass_max_kg: "", mass_service_kg: "",
  euro_class: "", first_registration: "", last_inspection: "", next_inspection: "",
  next_inspection_estimated: false, owner_name: "", owner_address: "",
};

// Istruzioni per il modello: chiavi identiche ai campi sopra, niente invenzioni.
export const LIBRETTO_PROMPT = `Sei un lettore di documenti. Le immagini sono il libretto di circolazione italiano (carta di circolazione) di un veicolo: fronte ed eventualmente retro.
Leggi solo ciò che è scritto. Se un dato non c'è o non è leggibile scrivi "" (stringa vuota): NON inventare e NON indovinare.
Rispondi SOLO con un oggetto JSON, senza altro testo, con queste chiavi:
{
 "plate": "targa (campo A), es. AB123CD",
 "vin": "numero di telaio, 17 caratteri (campo E)",
 "make": "marca (D.1)",
 "model": "denominazione commerciale (D.3)",
 "type_approval": "tipo/variante/versione (D.2)",
 "category": "categoria del veicolo (J), es. M1, N1, N3",
 "fuel": "alimentazione (P.3): Benzina, Gasolio, Elettrica, Ibrida, GPL o Metano",
 "displacement_cc": "cilindrata in cm3 (P.1), solo numero",
 "power_kw": "potenza massima in kW (P.2), solo numero",
 "seats": "posti a sedere (S.1), solo numero",
 "mass_max_kg": "massa massima tecnicamente ammissibile in kg (F.1), solo numero",
 "mass_service_kg": "massa in servizio in kg (G), solo numero",
 "euro_class": "classe ambientale (V.9), es. Euro 6",
 "first_registration": "data di prima immatricolazione (B) nel formato AAAA-MM-GG",
 "last_inspection": "data dell'ultima revisione riportata nel retro nel formato AAAA-MM-GG",
 "owner_name": "cognome/denominazione e nome dell'intestatario (C.1.1 e C.1.2)",
 "owner_address": "residenza o sede dell'intestatario (C.1.3)"
}`;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  let y = 0, mo = 0, d = 0;
  let m = s.match(/^((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*((?:19|20)\d{2})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return "";
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function digits(v: unknown, min: number, max: number): string {
  // "10.837" è un migliaio all'italiana, non un decimale
  const s = String(v ?? "").replace(/(?<=\d)\.(?=\d{3}(?!\d))/g, "");
  const m = s.match(/\d+(?:[.,]\d+)?/);
  if (!m) return "";
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? String(n) : "";
}

const text = (v: unknown, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const FUELS: [RegExp, string][] = [
  [/ELETTRIC/i, "Elettrica"], [/IBRID/i, "Ibrida"], [/GASOLIO|DIESEL/i, "Gasolio"],
  [/BENZINA/i, "Benzina"], [/GPL/i, "GPL"], [/METANO/i, "Metano"],
];

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

// Revisione: la prima a 4 anni dall'immatricolazione, poi ogni 2 anni (autovetture e furgoni
// fino a 3,5 t); ogni anno per i mezzi pesanti. È una STIMA: la data certa è sul retro del libretto.
export function estimateNextInspection(
  f: Pick<LibrettoFields, "first_registration" | "last_inspection" | "category" | "mass_max_kg">,
  today = new Date()
): string {
  const heavy = /^(N2|N3|M2|M3)/.test(f.category.trim().toUpperCase()) || Number(f.mass_max_kg) > 3500;
  const interval = heavy ? 1 : 2;
  const todayIso = today.toISOString().slice(0, 10);
  if (f.last_inspection) {
    let next = addYears(f.last_inspection, interval);
    while (next < todayIso) next = addYears(next, interval);
    return next;
  }
  if (!f.first_registration) return "";
  let next = addYears(f.first_registration, heavy ? 1 : 4);
  while (next < todayIso) next = addYears(next, interval);
  return next;
}

// Porta la risposta del modello ai campi validi: ciò che non supera i controlli resta vuoto
// (la schermata lo evidenzia e l'utente lo compila).
export function normalizeFields(raw: Record<string, unknown>): LibrettoFields {
  const f: LibrettoFields = { ...EMPTY_FIELDS };
  f.plate = text(raw.plate, 12).toUpperCase().replace(/[\s.-]/g, "");
  const vin = text(raw.vin, 30).toUpperCase().replace(/[\s.-]/g, "");
  f.vin = VIN_RE.test(vin) ? vin : "";
  f.make = text(raw.make, 80).toUpperCase();
  f.model = text(raw.model, 120).toUpperCase();
  f.type_approval = text(raw.type_approval, 80).replace(/\s*\/\s*/g, "/");
  f.category = (text(raw.category, 20).toUpperCase().match(/\b[MNLOT]\d[A-Z]?\b/) ?? [""])[0];
  const fuelRaw = text(raw.fuel, 60);
  f.fuel = FUELS.find(([re]) => re.test(fuelRaw))?.[1] ?? fuelRaw;
  f.displacement_cc = digits(raw.displacement_cc, 50, 20000);
  f.power_kw = digits(raw.power_kw, 1, 2000);
  f.seats = digits(raw.seats, 1, 99);
  f.mass_max_kg = digits(raw.mass_max_kg, 100, 60000);
  f.mass_service_kg = digits(raw.mass_service_kg, 100, 60000);
  // «Euro 6», «6D», «EURO 6D-TEMP»; si ignora il riferimento a un regolamento (es. «REG UE 2018/1832»)
  const euroRaw = text(raw.euro_class, 30);
  const euro = euroRaw.match(/EURO\s*(\d+[A-Z]?)/i) ?? euroRaw.match(/^\s*(\d[A-Z]?)\s*$/);
  f.euro_class = euro ? `Euro ${euro[1].toUpperCase()}` : "";
  // massa in servizio superiore alla massa massima: lettura sbagliata, si lascia vuota
  if (f.mass_service_kg && f.mass_max_kg && Number(f.mass_service_kg) > Number(f.mass_max_kg)) f.mass_service_kg = "";
  f.first_registration = parseDate(raw.first_registration);
  f.last_inspection = parseDate(raw.last_inspection);
  f.owner_name = text(raw.owner_name, 200);
  f.owner_address = text(raw.owner_address, 300);

  const est = estimateNextInspection(f);
  if (est) { f.next_inspection = est; f.next_inspection_estimated = true; }
  return f;
}

// Campi che la lettura ha davvero trovato: la schermata evidenzia gli altri da controllare.
export function foundFields(f: LibrettoFields): string[] {
  return (Object.keys(f) as (keyof LibrettoFields)[])
    .filter((k) => k !== "next_inspection_estimated" && k !== "next_inspection" && f[k] !== "");
}
