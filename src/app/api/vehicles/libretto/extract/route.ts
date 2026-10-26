import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canManage } from "@/lib/access";
import { readLibretto } from "@/lib/brainy-vision";
import { foundFields, EMPTY_FIELDS } from "@/lib/libretto";

export const maxDuration = 120;

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024;

// Carica il libretto, lo fa leggere al modello visione di Brainy e restituisce i campi proposti.
// Non crea nulla: il veicolo si crea solo dopo la revisione dei dati (vedi ../create).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File richiesto" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Formato non supportato: usa PDF, JPG, PNG o WEBP" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File troppo grande (massimo 12 MB)" }, { status: 400 });

  // Un'azienda admin carica solo per sé; il super admin indica l'azienda.
  const requested = Number(form.get("company_id"));
  const companyId = user.role === "super_admin" ? (Number.isFinite(requested) && requested > 0 ? requested : null) : user.companyId;

  const buf = Buffer.from(await file.arrayBuffer());
  const { rows } = await pool.query(
    `INSERT INTO libretto_files (company_id, uploaded_by, name, mime, data) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [companyId, user.userId, file.name.slice(0, 200), file.type, buf]
  );
  const fileId: number = rows[0].id;

  try {
    const fields = await readLibretto(buf, file.type);
    return NextResponse.json({ file_id: fileId, file_name: file.name, fields, found: foundFields(fields) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Il file resta caricato: l'utente può compilare i campi a mano.
    return NextResponse.json({
      file_id: fileId, file_name: file.name, fields: EMPTY_FIELDS, found: [],
      warning: `Lettura automatica non riuscita (${msg.slice(0, 120)}): compila i campi a mano.`,
    });
  }
}
