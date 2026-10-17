import { getCategories, getHome, listProducts } from "@/lib/server/catalog";
import type { HomeSection } from "@/lib/types";
import { Hero } from "@/components/shop/Hero";
import { HomeSections, type HomeSectionData } from "@/components/shop/HomeSections";

function productQuery(section: HomeSection, limit: number) {
  switch (section.type) {
    case "featured":
      return { featured: true, sort: "featured" as const, limit };
    case "new":
      return { tag: "new" as const, limit };
    case "sale":
      return { tag: "sale" as const, limit };
    case "bestsellers":
      return { sort: "featured" as const, limit };
    default:
      return { limit };
  }
}

function sectionHref(section: HomeSection): string {
  switch (section.type) {
    case "new":
      return "/products?tag=new";
    case "sale":
      return "/products?tag=sale";
    case "featured":
    case "bestsellers":
      return "/products?sort=featured";
    default:
      return "/products";
  }
}

export default async function HomePage() {
  const [home, categories] = await Promise.all([getHome(), getCategories()]);
  const activeCategories = [...categories].filter((c) => c.active).sort((a, b) => a.order - b.order);

  const sections = [...(home.sections || [])].filter((s) => s.active).sort((a, b) => a.order - b.order);
  // كل قسم "بانر" يأخذ بانرًا مختلفًا بالترتيب (لدعم أكثر من بانر في الصفحة)
  const activeBanners = (home.banners || []).filter((b) => b.active);
  let bannerCursor = 0;

  const built = await Promise.all(
    sections.map(async (section): Promise<HomeSectionData | null> => {
      const limit = section.limit && section.limit > 0 ? section.limit : 8;

      if (section.type === "categories") {
        const slice = section.limit && section.limit > 0 ? activeCategories.slice(0, section.limit) : activeCategories;
        return {
          id: section.id,
          type: "categories",
          titleAr: section.title || "الأقسام",
          titleEn: section.titleEn || "Categories",
          categories: slice,
        };
      }

      if (section.type === "banner") {
        const banner = activeBanners.length ? activeBanners[bannerCursor % activeBanners.length] : null;
        bannerCursor += 1;
        const image = section.image || banner?.image || "";
        if (!image) return null;
        return {
          id: section.id,
          type: "banner",
          titleAr: section.title || banner?.title || "",
          titleEn: section.titleEn || banner?.titleEn || "",
          image,
          href: banner?.buttonHref || "/products",
          buttonAr: banner?.buttonText || "تسوّق الآن",
          buttonEn: banner?.buttonTextEn || "Shop now",
        };
      }

      const { items } = await listProducts(productQuery(section, limit));
      return {
        id: section.id,
        type: "products",
        titleAr: section.title,
        titleEn: section.titleEn,
        href: sectionHref(section),
        products: items,
      };
    })
  );

  const list = built.filter((s): s is HomeSectionData => s !== null);

  return (
    <>
      <Hero home={home} />
      <HomeSections sections={list} />
    </>
  );
}
