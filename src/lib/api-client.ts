"use client";

/** عميل API موحّد: يرمي ApiError برسالة إنسانية و code منضبط. */

export class ApiError extends Error {
  status: number;
  code: string | null;
  isNetwork: boolean;

  constructor(message: string, status = 0, code: string | null = null, isNetwork = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.isNetwork = isNetwork;
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(
  path: string,
  method: Method,
  body?: unknown,
  formData?: FormData
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers:
        formData || body instanceof FormData
          ? undefined
          : body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", 0, "network", true);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const d = data as { error?: string; code?: string } | null;
    const message =
      d?.error ||
      (res.status === 401
        ? "unauthorized"
        : res.status === 403
          ? "forbidden"
          : res.status === 404
            ? "not_found"
            : "server_error");
    throw new ApiError(message, res.status, d?.code ?? null);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, "GET"),
  post: <T>(path: string, body?: unknown) => request<T>(path, "POST", body),
  put: <T>(path: string, body?: unknown) => request<T>(path, "PUT", body),
  del: <T>(path: string) => request<T>(path, "DELETE"),
  upload: <T>(path: string, formData: FormData) => request<T>(path, "POST", undefined, formData),
};

/** يطابق العقد: const api = useApi(); await api.post<T>(...) */
export function useApi() {
  return api;
}

/** رسالة خطأ مفهومة بالعربية للمستخدم (لا تكشف تفاصيل داخلية) */
export function errorMessage(err: unknown, fallback = "حدث خطأ، حاول مرة أخرى"): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return "انقطع الاتصال بالشبكة، تحقّق من اتصالك";
    const known: Record<string, string> = {
      unauthorized: "يجب تسجيل الدخول أولًا",
      forbidden: "ليست لديك صلاحية لهذا الإجراء",
      not_found: "العنصر غير موجود",
      validation: "تحقق من البيانات المدخلة",
      stock: "الكمية المطلوبة غير متوفرة",
      duplicate: "تم إنشاء هذا الطلب مسبقًا",
      orders_paused: "الطلبات متوقفة حاليًا",
      email_exists: "هذا البريد مسجّل بالفعل",
      invalid_credentials: "بيانات الدخول غير صحيحة",
      weak_password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      invalid_token: "الرابط غير صالح أو منتهي",
      invalid_token_or_expired: "الرابط غير صالح أو منتهي",
      rate_limited: "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة",
      payload_too_large: "حجم الملف كبير (الحد 8 ميجابايت)",
      unsupported_type: "نوع الملف غير مدعوم",
      same_password: "كلمة المرور الجديدة مطابقة للحالية",
    };
    if (known[err.code ?? ""]) return known[err.code as string];
    return err.message || fallback;
  }
  return fallback;
}
