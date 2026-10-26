import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canAccessVehicle, canManage } from "@/lib/access";
import { toCardValues, upsertCard, attachLibretto } from "@/lib/vehicle-card";

// GET /api/vehicles/card?tokenId=…  →  scheda del veicolo (dati del libretto).
// I dati dell'intestatario sono visibili solo a chi gestisce l'azienda.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokenId = Number(new URL(req.url).searchParams.get("tokenId"));
  if (!(await canAccessVehicle(user, tokenId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await pool.query(
    `SELECT v.id AS vehicle_id, v.token_id, v.name, v.company_id, c.*, d.file_url AS libretto_url,
            (SELECT imei::text FROM devices WHERE vehicle_id = v.id AND enabled ORDER BY created_at LIMIT 1) AS imei
       FROM vehicles v
       LEFT JOIN vehicle_cards c ON c.vehicle_id = v.id
       LEFT JOIN documents d ON d.id = c.libretto_document_id
      WHERE v.token_id = $1`,
    [tokenId]
  );
  if (!rows.length) return NextResponse.json({ error: "Veicolo non trovato" }, { status: 404 });
  const r = rows[0];
  const manage = canManage(user);
  const hasCard = r.created_at != null;
  if (!manage) { r.owner_name = null; r.owner_address = null; }
  return NextResponse.json({ has_card: hasCard, can_edit: manage, card: hasCard ? r : null, vehicle: { id: r.vehicle_id, token_id: r.token_id, name: r.name, company_id: r.company_id } });
}

// PUT { tokenId, fields, file_id? }  →  crea/aggiorna la scheda (anche da un nuovo libretto caricato).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const tokenId = Number(body.tokenId);
  if (!(await canAccessVehicle(user, tokenId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const card = toCardValues(body.fields);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const v = await client.query("SELECT id, company_id FROM vehicles WHERE token_id = $1", [tokenId]);
    if (!v.rowCount) throw new Error("Veicolo non trovato");
    const { id, company_id } = v.rows[0];
    await upsertCard(client, id, card);
    if (card.plate) await client.query("UPDATE vehicles SET plate = $1 WHERE id = $2", [card.plate, id]);

    const fileId = Number(body.file_id);
    if (Number.isFinite(fileId) && fileId > 0) {
      const f = await client.query("SELECT name, company_id, vehicle_id FROM libretto_files WHERE id = $1", [fileId]);
      if (!f.rowCount || f.rows[0].company_id !== company_id || (f.rows[0].vehicle_id && f.rows[0].vehicle_id !== id)) {
        throw new Error("Libretto non valido");
      }
      await attachLibretto(client, { fileId, vehicleId: id, token: tokenId, companyId: company_id, userId: user.userId, fileName: f.rows[0].name });
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  } finally {
    client.release();
  }
}
