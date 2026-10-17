import crypto from "node:crypto";
import sharp from "sharp";
import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, route } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { UPLOAD_ALLOWED_TYPES, UPLOAD_MAX_BYTES } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = ["product", "banner", "home", "logo", "favicon", "misc"];
const MAX_FILES = 10;

/**
 * رفع الصور (متعدد) إلى Firebase Storage أو المخزن المحلي.
 * كل صورة تُفحص (النوع/الحجم) وتُحوَّل إلى WebP مضغوط مع تصغير الأبعاد.
 */
export const POST = route(async (request: Request) => {
  const admin = await requireAdminApi();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("تعذّر قراءة بيانات الرفع", "validation");
  }

  const kindRaw = String(form.get("kind") ?? "misc");
  const kind = ALLOWED_KINDS.includes(kindRaw) ? kindRaw : "misc";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) throw badRequest("لم يتم اختيار أي صورة", "validation");
  if (files.length > MAX_FILES) throw badRequest(`الحد الأقصى ${MAX_FILES} صور في المرة`, "validation");

  const db = await getDriver();
  const urls: string[] = [];

  for (const file of files) {
    if (file.size > UPLOAD_MAX_BYTES) throw badRequest("حجم الملف كبير (الحد 8 ميجابايت)", "payload_too_large");
    if (file.type && !UPLOAD_ALLOWED_TYPES.includes(file.type)) {
      throw badRequest("نوع الملف غير مدعوم (JPG، PNG، WebP، AVIF، GIF)", "unsupported_type");
    }

    const original = Buffer.from(await file.arrayBuffer());

    // التحقق من أن الملف صورة فعلية + التحويل إلى WebP
    let processed: Buffer;
    try {
      processed = await sharp(original, { failOn: "none" })
        .rotate()
        .resize({
          width: kind === "favicon" || kind === "logo" ? 900 : 1600,
          height: kind === "favicon" || kind === "logo" ? 900 : 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw badRequest("الملف ليس صورة صالحة", "unsupported_type");
    }

    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
    const url = await db.saveUpload(processed, filename, kind);
    urls.push(url);
  }

  await logAdminAction(admin, "upload.create", kind, { count: urls.length });
  return json({ urls }, 201);
});

/** حذف صورة مرفوعة */
export const DELETE = route(async (request: Request) => {
  const admin = await requireAdminApi();
  const url = new URL(request.url).searchParams.get("url") || "";
  if (!url) throw badRequest("الرابط مطلوب", "validation");
  const db = await getDriver();
  await db.deleteUpload(url);
  await logAdminAction(admin, "upload.delete", url, "");
  return json({ ok: true });
});
