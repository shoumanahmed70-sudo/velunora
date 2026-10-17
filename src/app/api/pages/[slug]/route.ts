import { getPage } from "@/lib/server/catalog";
import { json, route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const page = await getPage(slug);
  if (!page) throw notFound("الصفحة غير موجودة");
  return json({ page });
});
