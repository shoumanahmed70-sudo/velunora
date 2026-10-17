"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useCart } from "@/lib/cart-provider";
import type { Category } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { L } from "@/components/shop/utils";
import {
  CartIcon,
  ChevronDownIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/shop/icons";

const NAV_CLASS =
  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold transition-colors hover:bg-primary/5 hover:text-primary";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const { lang, setLang } = useLang();
  const { settings, categories } = useStoreSafe();
  const { me, logout } = useMe();
  const { count } = useCart();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const accountRef = useRef<HTMLDivElement | null>(null);

  const storeName = settings?.storeName || "VELUNORA";
  const logoUrl = settings?.logoUrl || "/brand/logo.svg";
  const user = me?.user ?? null;
  const isAdmin = Boolean(me?.admin);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // إغلاق القوائم عند تغيير المسار
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // إغلاق قائمة الحساب عند النقر خارجها
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    setMobileOpen(false);
  }

  async function onLogout() {
    setAccountOpen(false);
    await logout();
    router.push("/");
  }

  const headerClass = scrolled
    ? "bg-bg/95 shadow-sm backdrop-blur"
    : "bg-transparent";

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ease-luxe ${headerClass}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t("menu")}
            aria-expanded={mobileOpen}
            className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-primary/5 lg:hidden"
          >
            {mobileOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>

          <Link href="/" className="flex items-center gap-2.5" aria-label={storeName}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={storeName}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-line"
              loading="eager"
              decoding="async"
              onError={(e) => {
                if (e.currentTarget.src.endsWith("/brand/logo.svg")) return;
                e.currentTarget.src = "/brand/logo.svg";
              }}
            />
            <span className="display text-lg font-semibold tracking-wide text-ink sm:text-xl">{storeName}</span>
          </Link>

          <nav className="ms-4 hidden items-center gap-1 lg:flex">
            {categories.map((c: Category) => (
              <Link key={c.id} href={`/products?category=${encodeURIComponent(c.slug)}`} className={NAV_CLASS}>
                {L(lang, c.name, c.nameEn)}
              </Link>
            ))}
            <Link href="/products?tag=new" className={NAV_CLASS}>
              {t("newArrivals")}
            </Link>
            <Link href="/products?tag=sale" className={NAV_CLASS}>
              {t("onSale")}
            </Link>
          </nav>

          <div className="flex-1" />

          <form onSubmit={submitSearch} className="me-1 hidden items-center md:flex" role="search">
            <div className="relative w-48 lg:w-64">
              <SearchIcon
                size={18}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="field"
                style={{ paddingInlineStart: "2.5rem" }}
              />
            </div>
          </form>

          <div className="flex items-center rounded-full border border-line bg-white/70 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLang("ar")}
              aria-pressed={lang === "ar"}
              className={`min-h-9 rounded-full px-2.5 transition-colors ${
                lang === "ar" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              AR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
              className={`min-h-9 rounded-full px-2.5 transition-colors ${
                lang === "en" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              EN
            </button>
          </div>

          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-label={t("account")}
              aria-expanded={accountOpen}
              className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-primary/5"
            >
              <UserIcon size={22} />
            </button>
            {accountOpen && (
              <div className="absolute end-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                {user ? (
                  <>
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/account" className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-cream">
                      {t("profile")}
                    </Link>
                    <Link
                      href="/account/orders"
                      className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-cream"
                    >
                      {t("myOrders")}
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-cream">
                        {t("adminPanel")}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={onLogout}
                      className="block w-full rounded-xl px-3 py-2.5 text-start text-sm text-ink hover:bg-cream"
                    >
                      {t("logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-cream">
                      {t("login")}
                    </Link>
                    <Link
                      href="/auth/register"
                      className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-cream"
                    >
                      {t("register")}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-primary/5"
          >
            <CartIcon size={22} />
            {count > 0 && (
              <span className="absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-primary">
                {count}
              </span>
            )}
          </Link>
        </div>

        <div className="pb-3 md:hidden">
          <form onSubmit={submitSearch} role="search" className="relative">
            <SearchIcon size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              className="field"
              style={{ paddingInlineStart: "2.5rem" }}
            />
          </form>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
            {categories.map((c: Category) => (
              <Link
                key={c.id}
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="border-b border-line/60 py-3 text-sm font-semibold text-ink last:border-b-0"
              >
                {L(lang, c.name, c.nameEn)}
              </Link>
            ))}
            <Link href="/products?tag=new" className="border-b border-line/60 py-3 text-sm font-semibold text-ink">
              {t("newArrivals")}
            </Link>
            <Link href="/products?tag=sale" className="py-3 text-sm font-semibold text-ink">
              {t("onSale")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
