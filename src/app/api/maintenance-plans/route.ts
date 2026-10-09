import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, listAccessibleVehicles, canManage } from "@/lib/access";
import { computeDue, type MaintenancePlan } from "@/lib/maintenance-plans";

const PLAN_COLS = `id, vehicle_id, name, interval_km, interval_months, last_done_km,
  to_char(last_done_date, 'YYYY-MM-DD') AS last_done_date, notes`;

type Body = Record<string, unknown>;

function toInt(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

function parseInput(b: Body) {
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 80) return { error: "Nome obbligatorio (max 80 caratteri)" } as const;

  const intervalKm = toInt(b.interval_km);
  const intervalMonths = toInt(b.interval_months);
  const lastKm = toInt(b.last_done_km);
  if (intervalKm === "invalid" || intervalMonths === "invalid" || lastKm === "invalid") {
    return { error: "Valori numerici non validi" } as const;
  }
  if (!intervalKm && !intervalMonths) return { error: "Indica un intervallo in km e/o in mesi" } as const;

  const lastDate = typeof b.last_done_date === "string" && b.last_done_date ? b.last_done_date : null;
  if (lastDate && !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return { error: "Data non valida" } as const;

  return {
    data: {
      name,
      intervalKm: intervalKm || null,
      intervalMonths: intervalMonths || null,
      lastKm,
      lastDate,
      notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
    },
  } as const;
}

async function currentOdometers(vehicleIds: number[]): Promise<Map<number, number>> {
  if (!vehicleIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (vehicle_id) vehicle_id, odometer_km
       FROM telemetry
      WHERE vehicle_id = ANY($1) AND odometer_km IS NOT NULL
      ORDER BY vehicle_id, recorded_at DESC`,
    [vehicleIds]
  );
  return new Map(rows.map((r) => [r.vehicle_id as number, Number(r.odometer_km)]));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);
  const odometers = await currentOdometers(ids);

  const { rows: plans } = ids.length
    ? await pool.query<MaintenancePlan>(
        `SELECT ${PLAN_COLS} FROM maintenance_plans WHERE vehicle_id = ANY($1) ORDER BY name`,
        [ids]
      )
    : { rows: [] as MaintenancePlan[] };

  return NextResponse.json({
    canEdit: canManage(user),
    vehicles: vehicles.map((v) => {
      const odometer = odometers.get(v.id) ?? null;
      return {
        ...v,
        odometer_km: odometer,
        plans: plans
          .filter((p) => p.vehicle_id === v.id)
          .map((p) => ({ ...p, due: computeDue(p, odometer) })),
      };
    }),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Body;
  const vehicleId = Number(body.vehicle_id);
  const vehicles = await listAccessibleVehicles(user);
  if (!vehicles.some((v) => v.id === vehicleId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO maintenance_plans (vehicle_id, name, interval_km, interval_months, last_done_km, last_done_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${PLAN_COLS}`,
    [vehicleId, d.name, d.intervalKm, d.intervalMonths, d.lastKm, d.lastDate, d.notes]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Body;
  const planId = Number(body.id);
  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);

  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  const { rows } = await pool.query(
    `UPDATE maintenance_plans
        SET name=$2, interval_km=$3, interval_months=$4, last_done_km=$5, last_done_date=$6, notes=$7
      WHERE id=$1 AND vehicle_id = ANY($8)
      RETURNING ${PLAN_COLS}`,
    [planId, d.name, d.intervalKm, d.intervalMonths, d.lastKm, d.lastDate, d.notes, ids]
  );
  if (!rows.length) return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const planId = Number(new URL(req.url).searchParams.get("id"));
  const ids = (await listAccessibleVehicles(user)).map((v) => v.id);
  const { rowCount } = await pool.query(
    "DELETE FROM maintenance_plans WHERE id = $1 AND vehicle_id = ANY($2)",
    [planId, ids]
  );
  if (!rowCount) return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
