import { randomInt } from "crypto";

// What a contact message is about; the grievance topics are the ones the IT Rules' timelines apply to.
export const CONTACT_TOPICS = {
    question: "A question or feedback",
    report: "Report a post, comment or image",
    copyright: "Copyright complaint",
    privacy: "My personal data",
    complaint: "Another complaint (grievance)",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

// Topics about a specific post, comment or image: the link says which one.
export const TOPICS_NEEDING_LINK: readonly ContactTopic[] = ["report", "copyright"];

export const CONTACT_LIMITS = { name: 100, email: 200, url: 500, message: { min: 20, max: 5000 } } as const;

export interface ContactInput {
    topic: ContactTopic;
    name: string;
    email: string;
    url: string | null;
    message: string;
}

type Parsed = { ok: true; value: ContactInput } | { ok: false; message: string };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function isContactTopic(value: unknown): value is ContactTopic {
    return typeof value === "string" && Object.hasOwn(CONTACT_TOPICS, value);
}

export function parseContactInput(body: unknown): Parsed {
    if (!body || typeof body !== "object") return { ok: false, message: "Invalid message" };
    const input = body as Record<string, unknown>;
    const topic = input.topic;
    const name = text(input.name);
    const email = text(input.email).toLowerCase();
    const url = text(input.url);
    const message = text(input.message);

    if (!isContactTopic(topic)) return { ok: false, message: "Choose what your message is about" };
    if (!name || name.length > CONTACT_LIMITS.name) return { ok: false, message: `Enter your name (up to ${CONTACT_LIMITS.name} characters)` };
    if (email.length > CONTACT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address so we can reply" };
    if (!url && TOPICS_NEEDING_LINK.includes(topic)) return { ok: false, message: "Add the link to the post, comment or image" };
    if (url) {
        let valid = url.length <= CONTACT_LIMITS.url;
        try {
            valid &&= ["http:", "https:"].includes(new URL(url).protocol);
        } catch {
            valid = false;
        }
        if (!valid) return { ok: false, message: "The link must be a full web address (https://…)" };
    }
    if (message.length < CONTACT_LIMITS.message.min || message.length > CONTACT_LIMITS.message.max) {
        return { ok: false, message: `Write your message in ${CONTACT_LIMITS.message.min} to ${CONTACT_LIMITS.message.max} characters` };
    }
    return { ok: true, value: { topic, name, email, url: url || null, message } };
}

// Unambiguous characters only (no 0/O, 1/I/L), so a reference read over the phone or retyped still matches.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newContactReference(): string {
    return `C-${Array.from({ length: 8 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join("")}`;
}
