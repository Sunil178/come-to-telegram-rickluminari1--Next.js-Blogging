import { createAuthToken } from "@/libs/auth-tokens";
import { sendMail } from "@/libs/mailer";
import { SITE_URL } from "@/libs/site-url";
import { escapeMarkup as escapeHtml } from "@/libs/escape";

interface Recipient {
    id: string;
    email: string;
    username: string;
}

function render(recipient: Recipient, intro: string, action: string, link: string, outro: string) {
    const name = escapeHtml(recipient.username);
    return {
        text: `Hi ${recipient.username},\n\n${intro}\n\n${action}: ${link}\n\n${outro}\n\n— Vedev.Guru`,
        html: `<p>Hi ${name},</p><p>${intro}</p><p><a href="${escapeHtml(link)}">${action}</a></p><p style="color:#666;font-size:13px">${outro}<br>If the link doesn't work, paste this link into your browser: ${escapeHtml(link)}</p><p>— Vedev.Guru</p>`,
    };
}

export async function sendVerificationEmail(recipient: Recipient): Promise<boolean> {
    const token = await createAuthToken(recipient.id, "verify-email");
    const link = `${SITE_URL}/auth/verify-email?token=${token}`;
    return sendMail({
        to: recipient.email,
        subject: "Confirm your email for Vedev.Guru",
        ...render(recipient, "Thanks for joining Vedev.Guru. Confirm your email address to finish setting up your account.", "Confirm email", link, "This link expires in 24 hours. If you didn't create an account, you can ignore this email."),
    });
}

export async function sendPasswordResetEmail(recipient: Recipient): Promise<boolean> {
    const token = await createAuthToken(recipient.id, "reset-password");
    const link = `${SITE_URL}/auth/reset-password?token=${token}`;
    return sendMail({
        to: recipient.email,
        subject: "Reset your Vedev.Guru password",
        ...render(recipient, "Someone (hopefully you) asked to reset the password for your Vedev.Guru account.", "Choose a new password", link, "This link expires in 1 hour and works once. If you didn't ask for this, ignore this email; your password stays the same."),
    });
}
