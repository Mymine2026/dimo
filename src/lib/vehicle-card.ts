import type { PoolClient } from "pg";
import type { LibrettoFields } from "@/lib/libretto";

export interface CardValues {
  plate: string | null; vin: string | null; make: string | null; model: string | null;
  type_approval: string | null; category: string | null; fuel: string | null;
  displacement_cc: number | null; power_kw: number | null; seats: number | null;
  mass_max_kg: number | null; mass_service_kg: number | null; euro_class: string | null;
  first_registration: string | null; last_inspection: string | null; next_inspection: string | null;
  next_inspection_estimated: boolean; owner_name: string | null; owner_address: string | null;
}

const str = (v: unknown, max = 200): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
const int = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.round(n) : null;
};
const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
const date = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
};

// Pulisce i campi arrivati dal browser (stringhe) nei tipi della tabella.
export function toCardValues(f: Partial<LibrettoFields> | undefined): CardValues {
  const x = (f ?? {}) as Record<string, unknown>;
  return {
    plate: str(x.plate, 20)?.toUpperCase().replace(/\s/g, "") ?? null,
    vin: str(x.vin, 20)?.toUpperCase().replace(/\s/g, "") ?? null,
    make: str(x.make, 80), model: str(x.model, 120), type_approval: str(x.type_approval, 80),
    category: str(x.category, 10)?.toUpperCase() ?? null, fuel: str(x.fuel, 40),
    displacement_cc: int(x.displacement_cc), power_kw: num(x.power_kw), seats: int(x.seats),
    mass_max_kg: int(x.mass_max_kg), mass_service_kg: int(x.mass_service_kg), euro_class: str(x.euro_class, 20),
    first_registration: date(x.first_registration), last_inspection: date(x.last_inspection),
    next_inspection: date(x.next_inspection),
    next_inspection_estimated: x.next_inspection_estimated === true,
    owner_name: str(x.owner_name, 200), owner_address: str(x.owner_address, 300),
  };
}

export async function upsertCard(client: PoolClient, vehicleId: number, c: CardValues) {
  await client.query(
    `INSERT INTO vehicle_cards
       (vehicle_id, plate, vin, make, model, type_approval, category, fuel, displacement_cc, power_kw, seats,
        mass_max_kg, mass_service_kg, euro_class, first_registration, last_inspection, next_inspection,
        next_inspection_estimated, owner_name, owner_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (vehicle_id) DO UPDATE SET
       plate=$2, vin=$3, make=$4, model=$5, type_approval=$6, category=$7, fuel=$8, displacement_cc=$9,
       power_kw=$10, seats=$11, mass_max_kg=$12, mass_service_kg=$13, euro_class=$14, first_registration=$15,
       last_inspection=$16, next_inspection=$17, next_inspection_estimated=$18, owner_name=$19,
       owner_address=$20, updated_at=NOW()`,
    [vehicleId, c.plate, c.vin, c.make, c.model, c.type_approval, c.category, c.fuel, c.displacement_cc,
     c.power_kw, c.seats, c.mass_max_kg, c.mass_service_kg, c.euro_class, c.first_registration,
     c.last_inspection, c.next_inspection, c.next_inspection_estimated, c.owner_name, c.owner_address]
  );
}

// Registra la copia del libretto tra i documenti del veicolo e la collega alla scheda.
export async function attachLibretto(
  client: PoolClient,
  opts: { fileId: number; vehicleId: number; token: number; companyId: number | null; userId: number | null; fileName: string }
) {
  await client.query("UPDATE libretto_files SET vehicle_id = $1 WHERE id = $2", [opts.vehicleId, opts.fileId]);
  const { rows } = await client.query(
    `INSERT INTO documents (vehicle_id, vehicle_dimo_token, user_id, company_id, name, type, file_url)
     VALUES ($6,$1,$2,$3,$4,'libretto',$5) RETURNING id`,
    [String(opts.token), opts.userId, opts.companyId, `Libretto ${opts.fileName}`.slice(0, 250), `/api/vehicles/libretto/file/${opts.fileId}`, opts.vehicleId]
  );
  await client.query("UPDATE vehicle_cards SET libretto_document_id = $1 WHERE vehicle_id = $2", [rows[0].id, opts.vehicleId]);
}
