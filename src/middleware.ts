import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "vn_session";

/**
 * حماية مبدئية لمسار لوحة الإدارة على الحافة:
 * - إعادة توجيه غير المسجّل إلى صفحة دخول الإدارة.
 * - الفحص الحقيقي للصلاحيات يبقى على الخادم في كل مسار API وفي تخطيط الإدارة (requireAdmin).
 * - منع فهرسة لوحة الإدارة وحماية ترويسات الاستجابة.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  // السماح للمدير المسجّل بالتوجه إلى /admin مباشرة من واجهة الدخول،
  // لكن لا نعيد توجيه من لديه جلسة عميل عادي (غير مدير) إلى /admin
  // لتفادي حلقة إعادة التوجيه. صفحة الدخول تتولى التحويل للمدير بعد التأكد.

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (pathname.startsWith("/admin") || pathname.startsWith("/account") || pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/api/:path*"],
};
