import { sendMail } from "@/libs/mailer";
import { siteOperator } from "@/libs/runtime-config";
import { SITE_URL } from "@/libs/site-url";
import { escapeMarkup as escapeHtml } from "@/libs/escape";
import { CONTACT_TOPICS, type ContactInput } from "@/libs/contact";

/** Sends the message to CONTACT_EMAIL, with replies going straight to the sender. Never throws. */
export async function sendContactToOperator(message: ContactInput & { reference: string; username: string | null }): Promise<boolean> {
    const to = siteOperator().email;
    if (!to) return false;
    const rows: [string, string][] = [
        ["Reference", message.reference],
        ["Topic", CONTACT_TOPICS[message.topic]],
        ["From", `${message.name} <${message.email}>`],
        ["Account", message.username ?? "not signed in"],
        ["Link", message.url ?? "none"],
    ];
    return sendMail({
        to,
        replyTo: message.email,
        subject: `[${message.reference}] ${CONTACT_TOPICS[message.topic]}`,
        text: `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${message.message}\n\nAll messages: ${SITE_URL}/dashboard/admin/messages`,
        html: `<table>${rows.map(([label, value]) => `<tr><td style="color:#666;padding-right:12px">${label}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</table><p style="white-space:pre-wrap">${escapeHtml(message.message)}</p><p><a href="${escapeHtml(`${SITE_URL}/dashboard/admin/messages`)}">All messages</a></p>`,
    });
}

// Anyone can type any address, so the acknowledgement repeats only the reference and topic, nothing the sender typed.
export async function sendContactAcknowledgement(message: Pick<ContactInput, "email" | "topic"> & { reference: string }): Promise<boolean> {
    const topic = CONTACT_TOPICS[message.topic];
    const intro = `We received your message about “${topic}”. Its reference is ${message.reference}; quote it if you write again.`;
    const timing = "We acknowledge complaints within 24 hours and resolve them within 15 days.";
    return sendMail({
        to: message.email,
        subject: `We received your message (${message.reference})`,
        text: `Hello,\n\n${intro}\n\n${timing}\n\nIf you didn't write to us, you can ignore this email.\n\n— Vedev.Guru`,
        html: `<p>Hello,</p><p>${escapeHtml(intro)}</p><p>${timing}</p><p style="color:#666;font-size:13px">If you didn't write to us, you can ignore this email.</p><p>— Vedev.Guru</p>`,
    });
}
