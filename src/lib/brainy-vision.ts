import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { LIBRETTO_PROMPT, normalizeFields, type LibrettoFields } from "@/lib/libretto";

const run = promisify(execFile);

// Lettura del libretto con il modello visione di Brainyware (account di servizio, API compatibile OpenAI).
// Stesso schema già usato dal servizio fv-check. Variabili: BRAINY_BASE, BRAINY_ACCESS_KEY, BRAINY_SECRET_KEY,
// facoltativa BRAINY_VISION_MODEL.
const MODEL = () => process.env.BRAINY_VISION_MODEL || "Qwen/Qwen3.8-27B";
const MAX_SIDE = 1800;

let token: string | null = null;

async function brainyToken(force = false): Promise<string> {
  if (token && !force) return token;
  const { BRAINY_BASE, BRAINY_ACCESS_KEY, BRAINY_SECRET_KEY } = process.env;
  if (!BRAINY_BASE || !BRAINY_ACCESS_KEY || !BRAINY_SECRET_KEY) throw new Error("Brainy non configurato (BRAINY_BASE / chiavi mancanti)");
  const res = await fetch(`${BRAINY_BASE}/brainy/api/auth/service`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: BRAINY_ACCESS_KEY, secret_key: BRAINY_SECRET_KEY }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Autenticazione Brainy fallita (${res.status})`);
  token = (await res.json()).token ?? null;
  if (!token) throw new Error("Autenticazione Brainy: token assente");
  return token;
}

// Foto o pagina PDF → JPEG con lato massimo contenuto (leggibile ma non enorme per il modello).
async function toJpeg(buf: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buf).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 88 }).toBuffer();
}

async function pdfPages(buf: Buffer): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), "libretto-"));
  try {
    await writeFile(join(dir, "in.pdf"), buf);
    await run("pdftoppm", ["-r", "170", "-png", "-f", "1", "-l", "2", join(dir, "in.pdf"), join(dir, "page")], { timeout: 45_000 });
    const files = (await readdir(dir)).filter(f => f.startsWith("page") && f.endsWith(".png")).sort();
    return await Promise.all(files.map(f => readFile(join(dir, f))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function ask(images: Buffer[], retry = true): Promise<string> {
  const content: unknown[] = [{ type: "text", text: LIBRETTO_PROMPT }];
  for (const img of images) content.push({ type: "image_url", image_url: { url: "data:image/jpeg;base64," + img.toString("base64") } });
  const res = await fetch(`${process.env.BRAINY_BASE}/brainy/api/openai/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await brainyToken()}` },
    // thinking spento e max_tokens alto: altrimenti `content` resta vuoto (il modello ragiona) — vedi fv-check.
    body: JSON.stringify({
      model: MODEL(), temperature: 0, max_tokens: 1500, chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 401 && retry) { await brainyToken(true); return ask(images, false); }
  if (!res.ok) throw new Error(`Errore Brainy (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function readLibretto(buf: Buffer, mime: string): Promise<LibrettoFields> {
  const pages = mime === "application/pdf" ? await pdfPages(buf) : [buf];
  if (!pages.length) throw new Error("Nessuna pagina leggibile nel file");
  const images = await Promise.all(pages.map(toJpeg));

  const text = await ask(images);
  const i = text.indexOf("{"), j = text.lastIndexOf("}");
  if (i < 0 || j <= i) throw new Error("Risposta del modello senza dati");
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(text.slice(i, j + 1)); } catch { throw new Error("Risposta del modello non leggibile"); }
  return normalizeFields(raw);
}
