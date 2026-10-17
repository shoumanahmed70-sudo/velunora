// يُحدّث بيانات الواجهة التجريبية: صور حقيقية للبطل + بانرين مصوّرين.
import fs from "node:fs";

const f = "var/db/settings.json";
const s = JSON.parse(fs.readFileSync(f, "utf8"));
const h = s.home;

// خلفية البطل: صورة عطر حقيقية (Pexels License)
h.heroImage = "/brand/photos/hero-night.webp";

const banners = h.banners || [];
if (banners[0]) {
  banners[0].image = "/brand/photos/banner-noir.webp";
}
if (!banners.some((b) => b.id === "bn-gift")) {
  banners.push({
    id: "bn-gift",
    image: "/brand/photos/rose-night.webp",
    title: "هدية تُشبه صاحبتها",
    titleEn: "A gift that feels like her",
    subtitle: "تغليف فاخر وبطاقة إهداء مع كل طلب.",
    subtitleEn: "Luxury wrapping and a gift card with every order.",
    buttonText: "تسوّق الهدايا",
    buttonTextEn: "Shop gifting",
    buttonHref: "/products?tag=new",
    active: true,
  });
}
h.banners = banners;

const secs = h.sections || [];
for (const sec of secs) {
  if (sec.id === "sec-banner") {
    sec.image = "/brand/photos/banner-noir.webp";
    sec.title = "مجموعة الفخامة الليلية";
    sec.titleEn = "The Midnight Luxury Collection";
  }
  if (sec.id === "sec-sale") sec.order = 6;
}
if (!secs.some((x) => x.id === "sec-banner-gift")) {
  secs.push({
    id: "sec-banner-gift",
    type: "banner",
    title: "هدية تُشبه صاحبتها",
    titleEn: "A gift that feels like her",
    limit: 0,
    productIds: [],
    image: "/brand/photos/rose-night.webp",
    active: true,
    order: 5,
  });
}
h.sections = secs;

fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
console.log("heroImage:", h.heroImage);
console.log("banners:", h.banners.map((b) => `${b.id}:${b.image}`).join(" | "));
console.log("sections:", h.sections.map((x) => `${x.order}:${x.type}:${x.image || "-"}`).join(" | "));
