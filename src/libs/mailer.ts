import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/libs/logger";

export interface MailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
    // Where a reply goes, e.g. the visitor who wrote through the contact form.
    replyTo?: string;
}

// Email features (verification, password reset) switch on with SMTP_HOST; without it they're off.
export function isMailConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (!transporter) {
        const port = Number(process.env.SMTP_PORT || 587);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
            // Our messages never embed files or URLs; refusing them closes nodemailer's file-read/SSRF paths.
            disableFileAccess: true,
            disableUrlAccess: true,
        });
    }
    return transporter;
}

// Never throws: callers run it from after(), once the response has gone out.
export async function sendMail(message: MailMessage): Promise<boolean> {
    if (!isMailConfigured()) {
        logger.warn("SMTP is not configured; email not sent", { subject: message.subject });
        return false;
    }
    try {
        await getTransporter().sendMail({ from: process.env.MAIL_FROM || "Vedev.Guru <no-reply@localhost>", ...message });
        return true;
    } catch (error) {
        logger.error("Failed to send email", { error, subject: message.subject });
        return false;
    }
}
