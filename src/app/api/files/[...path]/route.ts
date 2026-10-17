import fs from "node:fs/promises";
import path from "node:path";
import { route } from "@/lib/server/http";
import { STORAGE_DRIVER } from "@/lib/server/env";
import { LOCAL_UPLOAD_ROOT } from "@/lib/store/local-driver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

/**
 * تقديم الصور المرفوعة في المحرك المحلي.
 * (في وضع Firebase تُقدَّم الصور من Cloud Storage مباشرة.)
 */
export const GET = route(async (_request: Request, context: { params: Promise<{ path: string[] }> }) => {
  if (STORAGE_DRIVER !== "local") {
    return new Response("not available", { status: 404 });
  }
  const { path: segments } = await context.params;
  let relative: string;
  try {
    relative = segments.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    // مسار مُرمَّز بشكل خاطئ (مثل %ZZ) — بدل أن يرمي استثناء غير متوقّع
    return new Response("bad request", { status: 400 });
  }
  const root = path.resolve(LOCAL_UPLOAD_ROOT);
  const full = path.resolve(root, relative);

  // منع الخروج عن مجلد الرفع (Path Traversal)
  if (!full.startsWith(root + path.sep) && full !== root) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
});
