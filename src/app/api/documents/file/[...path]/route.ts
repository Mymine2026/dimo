import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
