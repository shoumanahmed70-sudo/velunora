import type { Metadata, Viewport } from "next";
import { Cairo, Cormorant_Garamond } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/provider";
import { StoreProvider } from "@/lib/store-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { CartProvider } from "@/lib/cart-provider";
import { ToastProvider } from "@/lib/toast";
import { getSettings } from "@/lib/server/catalog";
import { publicBaseUrl } from "@/lib/server/url";
import type { Lang } from "@/lib/i18n/dict";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// المتجر يعتمد على بيانات قابلة للتغيير من لوحة الإدارة ⇒ عرض ديناميكي دائم
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2d1b4e",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const base = await publicBaseUrl();
  return {
    metadataBase: new URL(base),
    title: {
      default: settings.seoTitle || settings.storeName,
      template: `%s | ${settings.storeName}`,
    },
    description: settings.seoDescription,
    keywords: settings.seoKeywords ? settings.seoKeywords.split(",").map((k) => k.trim()) : undefined,
    applicationName: settings.storeName,
    icons: { icon: settings.faviconUrl || "/icon.svg", apple: settings.faviconUrl || "/icon.svg" },
    openGraph: {
      type: "website",
      title: settings.seoTitle || settings.storeName,
      description: settings.seoDescription,
      siteName: settings.storeName,
      locale: "ar_SA",
      images: settings.logoUrl ? [{ url: settings.logoUrl }] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("vn_lang")?.value;
  const lang: Lang = cookieLang === "en" ? "en" : "ar";

  let settings = null;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }

  const colors = settings?.colors;
  const themeVars: Record<string, string> = colors
    ? {
        "--vc-primary": colors.primary,
        "--vc-primary-soft": colors.primarySoft,
        "--vc-gold": colors.gold,
        "--vc-cream": colors.cream,
        "--vc-background": colors.background,
        "--vc-text": colors.text,
      }
    : {};

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} style={themeVars as React.CSSProperties}>
      <body className={`${cairo.variable} ${cormorant.variable} antialiased`}>
        {/* بدون JS: أظهر كل المحتوى الذي ينتظر كشفه عند التمرير */}
        <noscript>
          {/* eslint-disable-next-line react/no-danger */}
          <style
            dangerouslySetInnerHTML={{
              __html:
                ".rv{opacity:1 !important;transform:none !important}.rule-track>span{transform:scaleX(1) !important}",
            }}
          />
        </noscript>
        <LangProvider initial={lang}>
          <StoreProvider>
            <AuthProvider>
              <CartProvider>
                <ToastProvider>{children}</ToastProvider>
              </CartProvider>
            </AuthProvider>
          </StoreProvider>
        </LangProvider>
      </body>
    </html>
  );
}
