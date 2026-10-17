import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  await requireAdminApi("pages");
  const { slug } = await context.params;
  const db = await getDriver();
  const page = await db.getPage(slug);
  if (!page) throw notFound("الصفحة غير موجودة");
  return json({ page });
});

interface Body {
  title?: string;
  titleEn?: string;
  content?: string;
  contentEn?: string;
}

/** تحرير صفحات المحتوى (من نحن، الخصوصية، الشروط، الشحن، الاسترجاع). */
export const PUT = route(async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  const admin = await requireAdminApi("pages");
  const { slug } = await context.params;
  const body = await readJson<Body>(request, 256 * 1024);

  const title = String(body.title ?? "").trim().slice(0, 160);
  if (title.length < 2) throw badRequest("عنوان الصفحة مطلوب", "validation");

  const db = await getDriver();
  const saved = await db.savePage({
    slug: slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60),
    title,
    titleEn: String(body.titleEn ?? "").trim().slice(0, 160),
    content: String(body.content ?? "").slice(0, 20000),
    contentEn: String(body.contentEn ?? "").slice(0, 20000),
    updatedAt: Date.now(),
  });

  await logAdminAction(admin, "page.update", saved.slug, { title: saved.title });
  return json({ page: saved });
});
