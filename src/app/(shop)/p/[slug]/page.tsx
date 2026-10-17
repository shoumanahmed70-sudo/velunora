import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Lang } from "@/lib/i18n/dict";
import { getPage } from "@/lib/server/catalog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "الصفحة غير موجودة" };
  return { title: page.title };
}

export default async function ContentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("vn_lang")?.value;
  const lang: Lang = cookieLang === "en" ? "en" : "ar";

  const title = lang === "en" && page.titleEn ? page.titleEn : page.title;
  const content = lang === "en" && page.contentEn ? page.contentEn : page.content;

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mb-8 text-center">
        <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        <span className="mx-auto mt-4 block h-px w-20 bg-gold" />
      </header>

      <div className="card-lux p-6 sm:p-8">
        <div className="whitespace-pre-line text-sm leading-loose text-ink/90 sm:text-base">{content}</div>
      </div>
    </article>
  );
}
