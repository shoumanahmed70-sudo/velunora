"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ProductForm from "@/components/admin/ProductForm";
import { AdminHeading } from "@/components/admin/ui";

export default function AdminEditProductPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <div>
      <AdminHeading
        title="تعديل المنتج"
        description="حدّث بيانات المنتج والأسعار والمخزون."
        actions={
          <Link href="/admin/products" className="btn btn-ghost min-h-11 border border-line px-4 py-2 text-sm">
            <ArrowRight className="h-4 w-4" /> رجوع إلى المنتجات
          </Link>
        }
      />
      {id ? <ProductForm productId={id} /> : null}
    </div>
  );
}
