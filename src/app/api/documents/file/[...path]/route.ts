import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const CONTENT_TYPES: Record<string, string> = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;

  // Prevent path traversal
  if (path.some((seg) => seg.includes(".."))) {
    return NextResponse.json({ error: "Path non valido" }, { status: 400 });
  }

  const filename = path.join("/");

  // Only the owner of the document (or someone in the same company) may read the file.
  const u = session.user as { role?: string; company_id?: number | null; user_id?: string };
  if (u.role !== "super_admin") {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM documents
        WHERE file_url = $1 AND (user_id = $2 OR (company_id IS NOT NULL AND company_id = $3))`,
      [`/api/documents/file/${filename}`, u.user_id ? parseInt(u.user_id) : null, u.company_id ?? null]
    );
    if (!rowCount) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = join(process.cwd(), "public", "uploads", filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File non trovato" }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path[path.length - 1]}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
