import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canAccessVehicle, canManage } from "@/lib/access";
import { computeKm, type ContractFields } from "@/lib/contracts";

const COLS = `lessor, contract_number, delivery_date::text AS delivery_date, months, km_annual, km_total,
  km_increase_requested, end_date::text AS end_date, extra_km_cost::float8 AS extra_km_cost, km_total_extended,
  end_date_extended::text AS end_date_extended, extension_note, odometer_start, odometer_start_source, updated_at`;

const str = (v: unknown, max = 200): string | null => { const s = typeof v === "string" ? v.trim().slice(0, max) : ""; return s || null; };
const int = (v: unknown): number | null => { const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return String(v ?? "").trim() !== "" && Number.isFinite(n) ? Math.round(n) : null; };
const dec = (v: unknown): number | null => { const n = Number(String(v ?? "").replace(",", ".")); return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null; };
const date = (v: unknown): string | null => { const s = typeof v === "string" ? v.trim() : ""; return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null; };

async function vehicleId(tokenId: number): Promise<number | null> {
  const { rows } = await pool.query("SELECT id FROM vehicles WHERE token_id = $1", [tokenId]);
  return rows[0]?.id ?? null;
}

// GET /api/vehicles/contract?tokenId=…  →  contratto di noleggio + avanzamento dei km (solo per chi gestisce)
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokenId = Number(new URL(req.url).searchParams.get("tokenId"));
  if (!canManage(user) || !(await canAccessVehicle(user, tokenId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = await vehicleId(tokenId);
  if (!id) return NextResponse.json({ error: "Veicolo non trovato" }, { status: 404 });

  const [c, now, prev] = await Promise.all([
    pool.query(`SELECT ${COLS} FROM vehicle_contracts WHERE vehicle_id = $1`, [id]),
    pool.query(`SELECT odometer_km::float8 AS km, recorded_at FROM telemetry WHERE vehicle_id = $1 AND odometer_km IS NOT NULL ORDER BY recorded_at DESC LIMIT 1`, [id]),
    pool.query(`SELECT odometer_km::float8 AS km, recorded_at FROM telemetry WHERE vehicle_id = $1 AND odometer_km IS NOT NULL AND recorded_at >= NOW() - INTERVAL '60 days' ORDER BY recorded_at ASC LIMIT 1`, [id]),
  ]);

  const contract = c.rows[0] ?? null;
  const odoNow = now.rows[0] ? Number(now.rows[0].km) : null;
  const odoPrev = prev.rows[0] ? { km: Number(prev.rows[0].km), date: new Date(prev.rows[0].recorded_at).toISOString().slice(0, 10) } : null;
  const status = contract
    ? computeKm(contract as ContractFields, odoNow, odoPrev, new Date().toISOString().slice(0, 10))
    : null;

  return NextResponse.json({
    contract,
    status,
    odometer: now.rows[0] ? { km: odoNow, at: new Date(now.rows[0].recorded_at).toISOString() } : null,
  });
}

// PUT { tokenId, fields }  →  crea/aggiorna il contratto del veicolo
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const tokenId = Number(body.tokenId);
  if (!(await canAccessVehicle(user, tokenId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = await vehicleId(tokenId);
  if (!id) return NextResponse.json({ error: "Veicolo non trovato" }, { status: 404 });

  const f = (body.fields ?? {}) as Record<string, unknown>;
  const v = {
    lessor: str(f.lessor, 80), contract_number: str(f.contract_number, 80), delivery_date: date(f.delivery_date),
    months: int(f.months), km_annual: int(f.km_annual), km_total: int(f.km_total), km_increase_requested: int(f.km_increase_requested),
    end_date: date(f.end_date), extra_km_cost: dec(f.extra_km_cost), km_total_extended: int(f.km_total_extended),
    end_date_extended: date(f.end_date_extended), extension_note: str(f.extension_note, 300),
    odometer_start: int(f.odometer_start),
  };
  if (v.months != null && (v.months < 1 || v.months > 120)) return NextResponse.json({ error: "Durata non valida (1-120 mesi)" }, { status: 400 });
  if (v.km_total != null && (v.km_total < 1000 || v.km_total > 1_000_000)) return NextResponse.json({ error: "Km totali non validi" }, { status: 400 });

  await pool.query(
    `INSERT INTO vehicle_contracts (vehicle_id, lessor, contract_number, delivery_date, months, km_annual, km_total, km_increase_requested,
        end_date, extra_km_cost, km_total_extended, end_date_extended, extension_note, odometer_start, odometer_start_source, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $14::int IS NULL THEN NULL ELSE 'manuale' END,'app',NOW())
     ON CONFLICT (vehicle_id) DO UPDATE SET
        lessor=$2, contract_number=$3, delivery_date=$4, months=$5, km_annual=$6, km_total=$7, km_increase_requested=$8,
        end_date=$9, extra_km_cost=$10, km_total_extended=$11, end_date_extended=$12, extension_note=$13, odometer_start=$14,
        odometer_start_source=CASE WHEN $14::int IS NULL THEN NULL ELSE COALESCE(NULLIF(vehicle_contracts.odometer_start_source, ''), 'manuale') END,
        updated_at=NOW()`,
    [id, v.lessor, v.contract_number, v.delivery_date, v.months, v.km_annual, v.km_total, v.km_increase_requested,
     v.end_date, v.extra_km_cost, v.km_total_extended, v.end_date_extended, v.extension_note, v.odometer_start]
  );
  return NextResponse.json({ ok: true });
}
