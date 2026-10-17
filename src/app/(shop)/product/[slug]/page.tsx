import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, listProducts, listReviews } from "@/lib/server/catalog";
import { ProductView } from "@/components/shop/ProductView";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "المنتج غير موجود" };
  return {
    title: product.name,
    description: product.description?.slice(0, 160),
    openGraph: product.images[0] ? { images: [{ url: product.images[0] }] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [reviews, relatedRes] = await Promise.all([
    listReviews(product.id),
    listProducts({ category: product.category, limit: 8 }),
  ]);

  const related = relatedRes.items.filter((p) => p.id !== product.id).slice(0, 4);

  return <ProductView product={product} reviews={reviews} related={related} />;
}
