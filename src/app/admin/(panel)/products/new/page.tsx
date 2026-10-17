"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductForm from "@/components/admin/ProductForm";
import { AdminHeading } from "@/components/admin/ui";

export default function AdminNewProductPage() {
  return (
    <div>
      <AdminHeading
        title="منتج جديد"
        description="أضف منتجًا جديدًا إلى كتالوج المتجر."
        actions={
          <Link href="/admin/products" className="btn btn-ghost min-h-11 border border-line px-4 py-2 text-sm">
            <ArrowRight className="h-4 w-4" /> رجوع إلى المنتجات
          </Link>
        }
      />
      <ProductForm />
    </div>
  );
}
