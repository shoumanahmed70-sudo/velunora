import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="display text-7xl text-gold-gradient">404</span>
      <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
      <p className="text-muted max-w-md">
        ربما تم نقل الصفحة أو أن الرابط غير صحيح. يمكنك العودة إلى المتجر ومتابعة التسوق.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          العودة للرئيسية
        </Link>
        <Link href="/products" className="btn btn-outline">
          تصفح العطور
        </Link>
      </div>
    </div>
  );
}
