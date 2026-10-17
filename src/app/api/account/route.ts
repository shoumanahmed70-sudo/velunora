import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound } from "@/lib/server/errors";
import { isValidPhone } from "@/lib/server/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ملف العميل الشخصي (لا يُعاد لأي مستخدم آخر) */
export const GET = route(async () => {
  const { uid } = await requireUserApi();
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw notFound("الملف غير موجود");
  return json({ profile });
});

interface Body {
  name?: string;
  phone?: string;
  city?: string;
  address?: string;
}

export const PUT = route(async (request: Request) => {
  const { uid } = await requireUserApi();
  const body = await readJson<Body>(request);
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw notFound("الملف غير موجود");

  const name = (body.name ?? profile.name).trim().slice(0, 80);
  const phone = (body.phone ?? profile.phone).trim().slice(0, 25);
  const city = (body.city ?? profile.city).trim().slice(0, 60);
  const address = (body.address ?? profile.address).trim().slice(0, 300);

  if (name.length < 2) throw badRequest("الاسم مطلوب", "validation");
  if (phone && !isValidPhone(phone)) throw badRequest("رقم الجوال غير صحيح", "validation");

  const updated = await db.upsertCustomer({ ...profile, name, phone, city, address, updatedAt: Date.now() });
  return json({ profile: updated });
});
