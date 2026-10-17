import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n/dict";
import { getSettings } from "@/lib/server/catalog";
import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { WhatsAppFloat } from "@/components/shop/WhatsappFloat";

/**
 * تخطيط واجهة المتجر: شريط إعلان + ترويسة + المحتوى + التذييل + زر واتساب.
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("vn_lang")?.value;
  const lang: Lang = cookieLang === "en" ? "en" : "ar";

  let announcement = "";
  try {
    const settings = await getSettings();
    announcement = lang === "en" ? settings.announcementEn : settings.announcement;
  } catch {
    announcement = "";
  }

  return (
    <>
      {/*
        تفعيل الواجهة الليلية للصفحات التسويقية (الرئيسية/المنتجات/تفاصيل المنتج)
        قبل الرسم الأول لتجنّب وميض الألوان. السلة/الدفع/الحساب تبقى فاتحة للوضوح.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var p=location.pathname;var n=p==='/'||p.indexOf('/products')===0||p.indexOf('/product/')===0;document.documentElement.classList.toggle('night',n);}catch(e){}})();",
        }}
      />

      {announcement ? (
        <div className="bg-primary px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
          {announcement}
        </div>
      ) : null}

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        {lang === "en" ? "Skip to content" : "تخطي إلى المحتوى"}
      </a>

      <Header />

      <main id="main-content" className="min-h-[60vh]">
        {children}
      </main>

      <Footer />
      <WhatsAppFloat />
    </>
  );
}
