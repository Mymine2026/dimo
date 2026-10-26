// Ricezione diretta dai sensori Ruptela: converte un record del protocollo (IO in esadecimale)
// nelle colonne della tabella `telemetry`.
//
// La mappatura vale per il profilo "mercedes-lcv" (Plug5 con CAN OBD+LCV, gruppo Mercedes35) ed è
// stata verificata sui dati reali della GLE W167: i parametri CAN sono quelli che DIMO legge dagli
// stessi sensori (197 giri, 210 velocità, 114 odometro, 115 temperatura, 207 carburante).

export interface RuptelaPos {
  lat?: number; // gradi × 1e7
  lon?: number; // gradi × 1e7
  alt?: number;
  dir?: number;
  spd?: number; // km/h da GPS
  sat?: number; // 255 = nessun fix
  hdop?: number; // decimi
}

export interface RuptelaEvent {
  time?: string;
  data?: {
    trigger?: number;
    pos?: RuptelaPos;
    signals?: Record<string, string>;
  };
}

export interface TelemetryRow {
  recordedAt: Date;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  odometerKm: number | null;
  fuelLevel: number | null;
  engineRpm: number | null;
  coolantTemp: number | null;
  batteryVoltage: number | null;
  ignitionOn: boolean;
  raw: Record<string, unknown>;
}

// IO sempre conservati nel campo raw; gli altri segnali del sensore si salvano tutti, tranne quelli «non disponibili» (valore tutto FF)
const RAW_IO = ["29", "30", "36", "65", "92", "114", "115", "116", "197", "206", "207", "208", "210", "362", "409", "518", "522", "538"];

function hex(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 16);
  return Number.isFinite(n) ? n : null;
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Un'ora precedente al 2024 o troppo nel futuro indica un orologio non valido sul sensore.
function validTime(iso: string | undefined): Date | null {
  if (!iso) return null;
  const t = new Date(iso);
  const ms = t.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms < Date.UTC(2024, 0, 1)) return null;
  if (ms > Date.now() + 24 * 3_600_000) return null;
  return t;
}

export function mapRuptelaEvent(ev: RuptelaEvent, imei: number): TelemetryRow | null {
  const recordedAt = validTime(ev.time);
  if (!recordedAt) return null;

  const pos = ev.data?.pos ?? {};
  const sig = ev.data?.signals ?? {};

  const sat = pos.sat ?? 0;
  const hasFix =
    sat >= 4 && sat < 60 && typeof pos.lat === "number" && typeof pos.lon === "number" &&
    Math.abs(pos.lat) <= 900_000_000 && Math.abs(pos.lon) <= 1_800_000_000;

  const gpsSpeed = typeof pos.spd === "number" && pos.spd >= 0 && pos.spd < 400 ? pos.spd : null;

  const canRaw = hex(sig["210"]);
  const canKmh = canRaw != null && canRaw > 0 && canRaw !== 0xffff ? canRaw / 256 : null;
  const speed = canKmh != null ? round(canKmh, 1) : gpsSpeed;

  const rpmRaw = hex(sig["197"]);
  const coolRaw = hex(sig["115"]);
  // 0 giri è valido solo se il CAN risponde (temperatura presente); altrimenti il dato manca
  const engineRpm =
    rpmRaw != null && rpmRaw > 0 && rpmRaw < 0xfa00 ? round(rpmRaw * 0.125) : rpmRaw === 0 && coolRaw != null && coolRaw > 0 ? 0 : null;

  const odoRaw = hex(sig["114"]);
  const odometerKm = odoRaw != null && odoRaw > 0 && odoRaw < 0xfa000000 ? round((odoRaw * 5) / 1000, 1) : null;

  const fuelRaw = hex(sig["207"]);
  const fuelLevel = fuelRaw != null && fuelRaw > 0 && fuelRaw <= 250 ? round(fuelRaw * 0.4, 1) : null;

  const coolantTemp = coolRaw != null && coolRaw > 0 && coolRaw < 250 ? coolRaw - 40 : null;

  const supply = hex(sig["29"]);
  const batteryVoltage = supply != null && supply > 3000 ? round(supply / 1000, 2) : null;

  const ignitionOn = (engineRpm != null && engineRpm > 0) || sig["522"] === "01" || (speed != null && speed >= 3);

  const io: Record<string, string> = {};
  for (const [id, v] of Object.entries(sig)) if (RAW_IO.includes(id) || !/^F+$/i.test(v)) io[id] = v;

  return {
    recordedAt,
    latitude: hasFix ? pos.lat! / 1e7 : null,
    longitude: hasFix ? pos.lon! / 1e7 : null,
    speed,
    odometerKm,
    fuelLevel,
    engineRpm,
    coolantTemp,
    batteryVoltage,
    ignitionOn,
    // Stessa forma dei segnali DIMO (getLatestSignals): /api/latest restituisce `raw` così com'è,
    // quindi la pagina del veicolo legge velocità, giri, posizione ecc. dagli stessi nomi.
    raw: {
      timestamp: recordedAt.toISOString(),
      speed,
      powertrainFuelSystemRelativeLevel: fuelLevel,
      powertrainCombustionEngineSpeed: engineRpm,
      powertrainCombustionEngineECT: coolantTemp,
      powertrainTransmissionTravelledDistance: odometerKm,
      lowVoltageBatteryCurrentVoltage: batteryVoltage,
      isIgnitionOn: ignitionOn ? 1 : 0,
      currentLocationCoordinates: hasFix
        ? { timestamp: recordedAt.toISOString(), latitude: pos.lat! / 1e7, longitude: pos.lon! / 1e7 }
        : null,
      source: "ruptela",
      imei,
      sat: sat === 255 ? null : sat,
      hdop: pos.hdop ?? null,
      gpsSpeed,
      trigger: ev.data?.trigger ?? null,
      io,
    },
  };
}

// Da fermo (nessun movimento, quadro spento) basta un punto ogni 5 minuti: il sensore ne manda uno al minuto.
export const STATIONARY_MIN_GAP_MS = 5 * 60_000;

export function isStationary(row: TelemetryRow): boolean {
  return !row.ignitionOn && (row.speed == null || row.speed < 1);
}
