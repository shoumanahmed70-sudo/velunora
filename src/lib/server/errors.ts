import "server-only";

/** كل الأخطاء المتوقعة تُرمى بهذا الشكل وتُحوّل إلى استجابة JSON نظيفة. */
export class HttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "validation") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = "validation") {
  return new HttpError(message, 400, code);
}

export function unauthorized(message = "يجب تسجيل الدخول") {
  return new HttpError(message, 401, "unauthorized");
}

export function forbidden(message = "ليست لديك صلاحية لهذا الإجراء", code = "forbidden") {
  return new HttpError(message, 403, code);
}

export function notFound(message = "العنصر غير موجود") {
  return new HttpError(message, 404, "not_found");
}

export function tooMany(message = "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة") {
  return new HttpError(message, 429, "rate_limited");
}
