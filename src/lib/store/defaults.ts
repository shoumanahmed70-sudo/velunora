import type { Category, HomeSettings, PageDoc, StoreSettings } from "@/lib/types";

/** الإعدادات الافتراضية للمتجر — تُستخدم عند أول تشغيل وتُعدّل من لوحة الإدارة. */
export function defaultSettings(): StoreSettings {
  return {
    storeName: "VELUNORA",
    storeNameEn: "VELUNORA",
    tagline: "عطور فاخرة تُروى بالتفاصيل",
    taglineEn: "Luxury fragrances told in detail",
    logoUrl: "/brand/logo.svg",
    faviconUrl: "/brand/logo.svg",
    colors: {
      primary: "#2d1b4e",
      primarySoft: "#4a2f7a",
      gold: "#c6a15b",
      cream: "#f7f1e7",
      background: "#fcfaf6",
      text: "#241238",
    },
    headingFont: "Cairo",
    bodyFont: "Cairo",
    currency: "SAR",
    currencySymbol: "ر.س",
    taxEnabled: false,
    taxRate: 15,
    shippingFee: 25,
    freeShippingOver: 300,
    minOrder: 0,
    ordersEnabled: true,
    reviewsEnabled: true,
    contact: {
      phone: "",
      email: "",
      address: "",
      addressEn: "",
      workingHours: "السبت – الخميس: 10 صباحًا – 10 مساءً",
    },
    social: { instagram: "", tiktok: "", snapchat: "", facebook: "", x: "" },
    announcement: "",
    announcementEn: "",
    seoTitle: "VELUNORA — متجر عطور فاخرة",
    seoDescription:
      "VELUNORA — متجر عطور فاخر: عطور رجالية ونسائية ويونيسكس بأجود التركيزات، مع توصيل سريع داخل المملكة.",
    seoKeywords: "عطور, متجر عطور, عطور فاخرة, VELUNORA, برفان, عطور رجالية, عطور نسائية",
  };
}

export function defaultPrivateSettings() {
  return {
    whatsappNumber: "",
    smtp: {
      enabled: false,
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      from: "",
    },
  };
}

export function defaultHome(): HomeSettings {
  return {
    heroTitle: "عطور تُشبه حضورك",
    heroTitleEn: "Fragrances as presence",
    heroSubtitle:
      "تركيزات عالية، مكوّنات مختارة، وتجربة فاخرة من أول رشّة حتى آخر أثر.",
    heroSubtitleEn:
      "High concentrations, carefully chosen ingredients, a luxurious experience from first spray to lasting trail.",
    heroButtonText: "تسوّق المجموعة",
    heroButtonTextEn: "Shop the collection",
    heroButtonHref: "/products",
    heroImage: "/brand/hero.svg",
    banners: [],
    sections: [
      {
        id: "sec-categories",
        type: "categories",
        title: "تصفح الأقسام",
        titleEn: "Browse categories",
        limit: 6,
        productIds: [],
        image: "",
        active: true,
        order: 1,
      },
      {
        id: "sec-featured",
        type: "featured",
        title: "مختارات الفخامة",
        titleEn: "Curated luxury",
        limit: 8,
        productIds: [],
        image: "",
        active: true,
        order: 2,
      },
      {
        id: "sec-new",
        type: "new",
        title: "وصل حديثًا",
        titleEn: "New arrivals",
        limit: 8,
        productIds: [],
        image: "",
        active: true,
        order: 3,
      },
      {
        id: "sec-sale",
        type: "sale",
        title: "عروض وخصومات",
        titleEn: "Offers & deals",
        limit: 8,
        productIds: [],
        image: "",
        active: true,
        order: 4,
      },
    ],
  };
}

export function defaultCategories(): Category[] {
  return [
    { id: "men", slug: "men", name: "عطور رجالية", nameEn: "Men", order: 1, active: true },
    { id: "women", slug: "women", name: "عطور نسائية", nameEn: "Women", order: 2, active: true },
    { id: "unisex", slug: "unisex", name: "يونيسكس", nameEn: "Unisex", order: 3, active: true },
  ];
}

export function defaultPages(): PageDoc[] {
  const now = Date.now();
  return [
    {
      slug: "about",
      title: "من نحن",
      titleEn: "About us",
      content:
        "نحن متجر عطور متخصص يختار تركيباته بعناية لتمنحك تجربة عطرية فاخرة تدوم. نعمل مع موردين موثوقين ونضمن أصالة كل زجاجة.",
      contentEn:
        "We are a specialised fragrance house curating compositions for a luxurious, lasting experience, sourced from trusted partners.",
      updatedAt: now,
    },
    {
      slug: "privacy",
      title: "سياسة الخصوصية",
      titleEn: "Privacy policy",
      content:
        "نحفظ بياناتك (الاسم، الجوال، العنوان) لأغراض تنفيذ الطلبات والتواصل فقط، ولا نشاركها مع أي طرف غير مكلف بالتوصيل. لا ننشر بيانات العملاء أو طلباتهم للعامة.",
      contentEn:
        "We store your data (name, phone, address) only to fulfil orders and communicate with you; we never share it beyond delivery partners.",
      updatedAt: now,
    },
    {
      slug: "terms",
      title: "الشروط والأحكام",
      titleEn: "Terms & conditions",
      content:
        "بإتمام الطلب فإنك توافق على صحة البيانات المدخلة، ويحق للمتجر تأكيد الطلب هاتفيًا قبل التجهيز. الأسعار المعروضة نهائية وتشمل ما هو موضح في ملخص الطلب.",
      contentEn:
        "By placing an order you confirm the accuracy of the submitted data; the store may confirm by phone before processing.",
      updatedAt: now,
    },
    {
      slug: "shipping",
      title: "سياسة الشحن",
      titleEn: "Shipping policy",
      content:
        "يتم تجهيز الطلبات خلال 24 ساعة من التأكيد، ويستغرق التوصيل داخل المدينة 1–2 يوم وفي باقي المناطق 2–4 أيام عمل.",
      contentEn:
        "Orders are prepared within 24 hours of confirmation; delivery takes 1–2 days locally and 2–4 business days nationwide.",
      updatedAt: now,
    },
    {
      slug: "returns",
      title: "سياسة الاسترجاع",
      titleEn: "Returns policy",
      content:
        "يمكن طلب الاستبدال أو الاسترجاع خلال 3 أيام من الاستلام بشرط أن يكون المنتج مغلقًا وبحالته الأصلية، مع إرفاق رقم الطلب.",
      contentEn:
        "Exchange or return can be requested within 3 days of delivery provided the product is sealed and in original condition.",
      updatedAt: now,
    },
  ];
}
