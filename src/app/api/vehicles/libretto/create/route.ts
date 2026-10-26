import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canManage } from "@/lib/access";
import { toCardValues, upsertCard, attachLibretto } from "@/lib/vehicle-card";
import type { LibrettoFields } from "@/lib/libretto";

interface Item { file_id: number; fields: Partial<LibrettoFields>; imei?: string }
interface Result { file_id: number; ok: boolean; id?: number; token_id?: number; name?: string; error?: string }

// Crea i veicoli (con scheda e copia del libretto) dai dati già rivisti dall'utente.
// Il veicolo non ha token DIMO: riceve un token interno negativo; il sensore Ruptela si collega con l'IMEI.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const items: Item[] = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "Nessun veicolo da creare" }, { status: 400 });

  const requested = Number(body.company_id);
  const companyId = user.role === "super_admin" ? (Number.isFinite(requested) && requested > 0 ? requested : null) : user.companyId;
  if (!companyId) return NextResponse.json({ error: "Azienda obbligatoria" }, { status: 400 });

  const results: Result[] = [];
  for (const item of items) {
    const fileId = Number(item.file_id);
    const card = toCardValues(item.fields);
    if (!card.plate) { results.push({ file_id: fileId, ok: false, error: "Targa obbligatoria" }); continue; }

    const imeiRaw = (item.imei ?? "").toString().replace(/\s/g, "");
    if (imeiRaw && !/^\d{15}$/.test(imeiRaw)) { results.push({ file_id: fileId, ok: false, error: "L'IMEI deve avere 15 cifre" }); continue; }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const file = await client.query("SELECT id, name, company_id, vehicle_id FROM libretto_files WHERE id = $1", [fileId]);
      if (!file.rowCount || file.rows[0].company_id !== companyId || file.rows[0].vehicle_id) {
        throw new Error("Libretto non valido o già usato");
      }
      const dup = await client.query(
        "SELECT 1 FROM vehicles WHERE company_id = $1 AND UPPER(REPLACE(plate,' ','')) = $2", [companyId, card.plate]
      );
      if (dup.rowCount) throw new Error(`Targa ${card.plate} già presente in questa azienda`);
      if (imeiRaw) {
        const d = await client.query("SELECT 1 FROM devices WHERE imei = $1", [imeiRaw]);
        if (d.rowCount) throw new Error("IMEI già registrato su un altro veicolo");
      }

      const name = [card.make, card.model].filter(Boolean).join(" ") || card.plate;
      const v = await client.query(
        `INSERT INTO vehicles (token_id, name, plate, company_id)
         VALUES (-nextval('vehicle_local_token_seq'), $1, $2, $3) RETURNING id, token_id`,
        [name.slice(0, 250), card.plate, companyId]
      );
      const { id, token_id } = v.rows[0];
      await upsertCard(client, id, card);
      await attachLibretto(client, { fileId, vehicleId: id, token: token_id, companyId, userId: user.userId, fileName: file.rows[0].name });

      if (imeiRaw) {
        await client.query(
          `INSERT INTO devices (imei, vehicle_id, label, usage_start)
           VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Europe/Rome')::date)`,
          [imeiRaw, id, card.plate]
        );
      }
      await client.query("COMMIT");
      results.push({ file_id: fileId, ok: true, id, token_id, name });
    } catch (e) {
      await client.query("ROLLBACK");
      results.push({ file_id: fileId, ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ results });
}
