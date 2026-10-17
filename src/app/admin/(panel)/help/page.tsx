import Link from "next/link";
import {
  ArrowLeft,
  BadgeDollarSign,
  BookOpen,
  FileText,
  Home,
  Mail,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import { AdminHeading, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}

const STEPS: Step[] = [
  {
    icon: MessageCircle,
    title: "١) اضبط رقم واتساب الطلبات (أهم خطوة)",
    href: "/admin/settings",
    hrefLabel: "افتح الإعدادات",
    body: (
      <>
        <p>
          من <strong>الإعدادات</strong> ← تبويب <strong>«واتساب والبريد»</strong> اكتب رقمك مع رمز الدولة
          <strong> بدون +</strong> (مثال: <span dir="ltr">9665xxxxxxxx</span>) ثم اضغط «حفظ الإعدادات الخاصة».
        </p>
        <p className="mt-2 text-xs text-amber-700">
          هذا الرقم خاص ولا يظهر في واجهة المتجر، وهو الرقم الذي تُبنى عليه روابط إرسال الطلبات. بدونه لن
          يعمل زر «افتح واتساب» في صفحة تأكيد الطلب.
        </p>
      </>
    ),
  },
  {
    icon: Package,
    title: "٢) أضف منتجًا",
    href: "/admin/products/new",
    hrefLabel: "أضف منتجًا الآن",
    body: (
      <>
        <ol className="list-inside list-decimal space-y-1">
          <li>افتح <strong>المنتجات</strong> ثم زر <strong>«منتج جديد»</strong>.</li>
          <li>اكتب الاسم، الوصف، واختر القسم.</li>
          <li>ارفع صورة واحدة على الأقل (تُحوَّل تلقائيًا إلى WebP).</li>
          <li>حدّد السعر والمخزون.</li>
          <li>للأحجام (٣٠/٥٠/١٠٠ مل): أضف «حجم» لكل مقاس بسعره ومخزونه.</li>
          <li>للتركيز (EDP/EDT): أضف «خيار» باسم «التركيز» وقيم مفصولة بفواصل.</li>
          <li>فعّل «مفعّل» ثم اضغط <strong>«إنشاء المنتج»</strong>.</li>
        </ol>
      </>
    ),
  },
  {
    icon: Tags,
    title: "٣) رتّب الأقسام",
    href: "/admin/categories",
    hrefLabel: "إدارة الأقسام",
    body: <p>من <strong>«الأقسام»</strong> أضف/عدّل الأقسام (رجالي، نسائي، يونيسكس…). ترتيب الأقسام يتحكم بظهورها في المتجر.</p>,
  },
  {
    icon: Home,
    title: "٤) جهّز الصفحة الرئيسية",
    href: "/admin/homepage",
    hrefLabel: "تعديل الصفحة الرئيسية",
    body: (
      <p>
        من <strong>«الصفحة الرئيسية»</strong> عدّل صورة البانر والعنوان، وأضِف أقسام العرض (مختارات، وصل حديثًا،
        عروض…) وفعّل ما تريد ظهوره.
      </p>
    ),
  },
  {
    icon: FileText,
    title: "٥) عدّل المحتوى والسياسات",
    href: "/admin/content",
    hrefLabel: "تعديل المحتوى",
    body: <p>من <strong>«المحتوى والسياسات»</strong> عدّل: من نحن، سياسة الخصوصية، الشروط، الشحن، والإرجاع.</p>,
  },
  {
    icon: ShoppingBag,
    title: "٥) تابع الطلبات وأصدر الفواتير",
    href: "/admin/orders",
    hrefLabel: "فتح الطلبات",
    body: (
      <p>
        من <strong>«الطلبات»</strong> ابحث وافتح أي طلب لتغيير حالته (جديد ← مؤكد ← قيد التجهيز…). من داخل الطلب
        يمكنك <strong>طباعة الفاتورة</strong>، أو <strong>إرسالها بالبريد</strong>، أو إرسالها{" "}
        <strong>واتساب للعميل</strong>. تصدير الطلبات إلى Excel/CSV متاح من قائمة الطلبات.
      </p>
    ),
  },
  {
    icon: Receipt,
    title: "٥-ب) الفاتورة للعميل",
    body: (
      <p>
        بعد إتمام الطلب يستطيع العميل من صفحة <strong>تأكيد الطلب</strong> أو <strong>«البحث عن طلب»</strong> أو
        <strong> «طلباتي»</strong> أن يطبع الفاتورة أو يحفظها PDF، ويطلب إرسالها إلى بريده. الإرسال بالبريد يعمل
        فقط بعد تفعيل SMTP في الإعدادات.
      </p>
    ),
  },
  {
    icon: Users,
    title: "٥-ج) إدارة العملاء",
    href: "/admin/customers",
    hrefLabel: "قائمة العملاء",
    body: <p>من <strong>«العملاء»</strong> اطّلع على العملاء وطلباتهم، ويمكنك تعطيل حساب عند الحاجة (لا يوجد حذف مباشر حفاظًا على بيانات الطلبات).</p>,
  },
  {
    icon: Mail,
    title: "٦) فعّل البريد (اختياري لكن مُستحسن)",
    href: "/admin/settings",
    hrefLabel: "إعدادات البريد",
    body: (
      <p>
        من <strong>الإعدادات ← «واتساب والبريد»</strong> فعّل SMTP وأدخل المضيف والمنفذ والبريد وكلمة المرور. بذلك
        تعمل رسائل تأكيد الحساب واستعادة كلمة المرور وإرسال الفواتير.
      </p>
    ),
  },
  {
    icon: BadgeDollarSign,
    title: "٧) اشتغل على التجارة بالطريقة الصحيحة",
    body: (
      <p>
        تأكد أن قاعدة <strong>«نظام الفوترة»</strong> تعمل دائمًا من جهة الخادم: الأسعار والخصومات والشحن تُحسب
        على الخادم لحظة الطلب، والضريبة/الشحن المجاني/الحد الأدنى كلها من الإعدادات. لا تعتمد على أي حساب في
        المتصفح.
      </p>
    ),
  },
];

const TIPS = [
  "لا يوجد رابط عام لتسجيل مدراء جدد — حساب المدير يُنشأ من سطر الأوامر (راجع README).",
  "رقم واتساب وبيانات SMTP أسرار لا تُعرض في واجهة المتجر إطلاقًا.",
  "إرسال واتساب يدوي: فتح الرابط لا يعني الإرسال — يجب الضغط على «إرسال» داخل التطبيق.",
  "كل تغيير مهم (منتجات/طلبات/إعدادات/موظفون) يُسجَّل في «سجل التدقيق».",
  "النسخ الاحتياطي: npm run db:backup — والاستعادة: npm run db:restore.",
];

export default function AdminHelpPage() {
  return (
    <div>
      <AdminHeading
        title="دليل الاستخدام السريع"
        description="من هنا تبدأ: اضبط الرقم، أضف منتجاتك، واستقبل الطلبات وأصدر الفواتير."
      />

      <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/10 p-5">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <BookOpen className="h-5 w-5 text-gold" />
          اتبع الخطوات بالترتيب. كل خطوة فيها زر ينقلك مباشرة للصفحة المطلوبة.
        </p>
      </div>

      <div className="space-y-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <Panel key={i} title={step.title}>
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 text-sm leading-7 text-ink">
                  {step.body}
                  {step.href ? (
                    <div className="mt-3">
                      <Link href={step.href} className="btn btn-outline min-h-10 px-4 py-2 text-xs">
                        {step.hrefLabel || "افتح الصفحة"}
                        <ArrowLeft className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-6">
        <Panel title="ملاحظات مهمة" description="اقرأها قبل التسليم النهائي.">
          <ul className="space-y-2 text-sm leading-7 text-ink">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/settings" className="btn btn-primary min-h-11 px-5 py-2.5 text-sm">
              <Settings className="h-4 w-4" /> اذهب للإعدادات
            </Link>
            <Link href="/admin/products/new" className="btn btn-outline min-h-11 px-5 py-2.5 text-sm">
              <Package className="h-4 w-4" /> أضف منتجًا
            </Link>
            <Link href="/admin/orders" className="btn btn-outline min-h-11 px-5 py-2.5 text-sm">
              <ShoppingBag className="h-4 w-4" /> الطلبات
            </Link>
            <Link href="/admin/content" className="btn btn-ghost min-h-11 px-5 py-2.5 text-sm">
              <FileText className="h-4 w-4" /> المحتوى
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
