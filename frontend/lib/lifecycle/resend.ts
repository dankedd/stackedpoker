import { BRAND, FOUNDER_NAME } from "./strings";
import type { RenderedEmail } from "./templates";

/**
 * Sends one email through Resend's REST API (no SDK dependency).
 * https://resend.com/docs/api-reference/emails/send-email
 */

const SENDER = "coach@stackedpokerai.com";

export interface SendInput {
  to: string;
  email: RenderedEmail;
  /** One-click unsubscribe endpoint (RFC 8058), for the List-Unsubscribe header. */
  oneClickUrl: string;
  /** Same (user, template) → same key: Resend drops a duplicate send for 24h. */
  idempotencyKey: string;
}

export function senderFor(template: RenderedEmail["template"]): { from: string; replyTo?: string } {
  const address = process.env.EMAIL_FROM_ADDRESS || SENDER;
  if (template === "day7" || template === "promo_3m_50") {
    // The founder notes: personal sender name, replies go to the founder.
    return { from: `${FOUNDER_NAME} from ${BRAND} <${address}>`, replyTo: process.env.LIFECYCLE_REPLY_TO || undefined };
  }
  return { from: `${BRAND} Coach <${address}>` };
}

export async function sendWithResend(input: SendInput): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const { from, replyTo } = senderFor(input.email.template);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      headers: {
        "List-Unsubscribe": `<${input.oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "category", value: input.email.template === "promo_3m_50" ? "campaign" : "lifecycle" },
        { name: "template", value: input.email.template },
      ],
    }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok || !body?.id) throw new Error(`Resend ${res.status}: ${body?.message ?? "no message id"}`);
  return { id: body.id };
}
