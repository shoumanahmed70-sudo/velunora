import "server-only";

import { getDriver } from "@/lib/store";

/**
 * إرسال البريد عبر SMTP المُعدّ من لوحة الإدارة (إعدادات خاصة).
 * إن لم يكن مُعدًّا: تُعاد النتيجة sent=false ولا يُختلق أي إرسال.
 */

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailResult {
  sent: boolean;
  reason?: "disabled" | "failed";
  error?: string;
}

function wrapHtml(storeName: string, title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#f7f1e7;font-family:Tahoma,Arial,sans-serif;color:#241238">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="background:#2d1b4e;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px">
      <div style="font-size:20px;font-weight:bold;letter-spacing:2px">${storeName}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${bodyHtml}
      ${
        cta
          ? `<p style="margin:22px 0"><a href="${cta.url}" style="display:inline-block;background:#c6a15b;color:#241238;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${cta.label}</a></p>
             <p style="font-size:12px;color:#6f6484;word-break:break-all">إن لم يعمل الزر انسخ الرابط التالي:<br/>${cta.url}</p>`
          : ""
      }
      <hr style="border:none;border-top:1px solid #e8e0d2;margin:20px 0"/>
      <p style="font-size:12px;color:#6f6484">هذه رسالة آلية من متجر ${storeName}. إن لم تطلبها فتجاهلها.</p>
    </div>
  </div>
</body></html>`;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const db = await getDriver();
  const [priv, settings] = await Promise.all([db.getPrivateSettings(), db.getSettings()]);
  const smtp = priv.smtp;

  if (!smtp.enabled || !smtp.host || !smtp.from) {
    return { sent: false, reason: "disabled" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });

    await transporter.sendMail({
      from: smtp.from || `${settings.storeName} <no-reply@localhost>`,
      to: input.to,
      subject: input.subject,
      text: input.text || input.subject,
      html: input.html,
    });

    return { sent: true };
  } catch (error) {
    console.error("[velunora] mail error:", error instanceof Error ? error.message : error);
    return { sent: false, reason: "failed" };
  }
}

export function resetEmailTemplate(storeName: string, link: string, minutes: number) {
  return {
    subject: `إعادة تعيين كلمة المرور — ${storeName}`,
    html: wrapHtml(
      storeName,
      "إعادة تعيين كلمة المرور",
      `<p style="line-height:1.9;font-size:14px">طلبت إعادة تعيين كلمة المرور لحسابك. الرابط صالح لمدة ${minutes} دقيقة ويُستخدم مرة واحدة.</p>`,
      { label: "إعادة تعيين كلمة المرور", url: link }
    ),
  };
}

export function verifyEmailTemplate(storeName: string, link: string, minutes: number) {
  return {
    subject: `تأكيد البريد الإلكتروني — ${storeName}`,
    html: wrapHtml(
      storeName,
      "تأكيد البريد الإلكتروني",
      `<p style="line-height:1.9;font-size:14px">شكرًا لتسجيلك في ${storeName}. أكّد بريدك الإلكتروني لإكمال إعداد حسابك. الرابط صالح لمدة ${minutes} دقيقة.</p>`,
      { label: "تأكيد البريد", url: link }
    ),
  };
}
