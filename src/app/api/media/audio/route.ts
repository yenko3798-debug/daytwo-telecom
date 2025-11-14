import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp3",
  "audio/ogg",
  "audio/webm",
]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type ${file.type}` }, { status: 415 });
  }

  const originalName = file.name;
  const ext = path.extname(originalName || "").toLowerCase() || ".wav";
  const safeExt = ext.length <= 6 ? ext : ".wav";
  const hash = crypto.randomUUID().replace(/-/g, "");
  const fileName = `${hash}${safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "audio");
  await fs.mkdir(uploadsRoot, { recursive: true });
  const targetPath = path.join(uploadsRoot, fileName);
  await fs.writeFile(targetPath, buffer);

  const url = `/uploads/audio/${fileName}`;
  return NextResponse.json(
    {
      url,
      originalName,
      mimeType: file.type || null,
      size: buffer.length,
      checksum: sha256,
      uploadedAt: new Date().toISOString(),
    },
    { status: 201 }
  );
}
