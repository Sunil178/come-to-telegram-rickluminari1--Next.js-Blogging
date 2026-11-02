// Profile fields a user fills in on the account page (and partly on the publish request form).
// Public ones show on /users/[username]; private ones only to the user and admins. All optional.

export const PUBLIC_PROFILE_FIELDS = ["headline", "bio", "country", "city", "website", "links", "expertise", "topics", "education"] as const;
export const PRIVATE_PROFILE_FIELDS = ["dateOfBirth", "gender", "phone", "address"] as const;
export type PublicProfileField = (typeof PUBLIC_PROFILE_FIELDS)[number];
export type PrivateProfileField = (typeof PRIVATE_PROFILE_FIELDS)[number];
export type ProfileField = PublicProfileField | PrivateProfileField;

export interface PublicProfile {
    headline?: string | null;
    bio?: string | null;
    country?: string | null;
    city?: string | null;
    website?: string | null;
    links?: string[];
    expertise?: string[];
    topics?: string[];
    education?: string | null;
}

export interface PrivateDetails {
    dateOfBirth?: Date | null;
    gender?: string | null;
    phone?: string | null;
    address?: string | null;
}

export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"] as const;
export const MIN_AGE = 13;

const TEXT_LIMITS: Partial<Record<ProfileField, number>> = {
    headline: 120,
    bio: 2000,
    country: 80,
    city: 80,
    education: 300,
    gender: 40,
    address: 300,
};
const LIST_LIMITS: Partial<Record<ProfileField, { items: number; length: number }>> = {
    links: { items: 5, length: 200 },
    expertise: { items: 10, length: 40 },
    topics: { items: 10, length: 40 },
};
const LABELS: Record<ProfileField, string> = {
    headline: "Headline",
    bio: "Bio",
    country: "Country",
    city: "City",
    website: "Website",
    links: "Links",
    expertise: "Expertise",
    topics: "Topics",
    education: "Education",
    dateOfBirth: "Date of birth",
    gender: "Gender",
    phone: "Phone",
    address: "Address",
};

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function asList(value: unknown): string[] {
    const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]/) : [];
    return [...new Set(items.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

type Parsed = { ok: true; set: Record<string, unknown> } | { ok: false; message: string };

/**
 * Validates the given fields of `input` into a MongoDB `$set` (profile.* and privateDetails.* paths).
 * Only keys present in `input` are touched; an empty value clears the field.
 */
export function parseProfileInput(input: unknown, fields: readonly ProfileField[]): Parsed {
    if (!input || typeof input !== "object") return { ok: false, message: "Invalid profile" };
    const body = input as Record<string, unknown>;
    const set: Record<string, unknown> = {};

    for (const field of fields) {
        if (!(field in body)) continue;
        const raw = body[field];
        const path = `${(PRIVATE_PROFILE_FIELDS as readonly string[]).includes(field) ? "privateDetails" : "profile"}.${field}`;
        const label = LABELS[field];

        if (LIST_LIMITS[field]) {
            const { items, length } = LIST_LIMITS[field]!;
            const list = asList(raw);
            if (list.length > items) return { ok: false, message: `${label}: at most ${items}` };
            if (list.some((item) => item.length > length)) return { ok: false, message: `${label}: each at most ${length} characters` };
            if (field === "links" && !list.every(isHttpUrl)) return { ok: false, message: "Links must be full web addresses (https://…)" };
            set[path] = list;
            continue;
        }

        const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : null;
        if (text === null) return { ok: false, message: `${label} is invalid` };
        if (!text) {
            set[path] = null;
            continue;
        }

        if (field === "website") {
            if (text.length > 200 || !isHttpUrl(text)) return { ok: false, message: "Website must be a full web address (https://…)" };
        } else if (field === "phone") {
            if (!/^\+?[\d\s()./-]{6,30}$/.test(text)) return { ok: false, message: "Phone can contain digits, spaces, +, -, ( and ) only" };
        } else if (field === "dateOfBirth") {
            const date = new Date(`${text}T00:00:00Z`);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime())) return { ok: false, message: "Date of birth is invalid" };
            const age = ageOn(date, new Date());
            if (age < MIN_AGE || age > 120) return { ok: false, message: `Date of birth must make you at least ${MIN_AGE}` };
            set[path] = date;
            continue;
        } else if (TEXT_LIMITS[field] && text.length > TEXT_LIMITS[field]!) {
            return { ok: false, message: `${label}: at most ${TEXT_LIMITS[field]} characters` };
        }
        set[path] = text;
    }
    return { ok: true, set };
}

/** The website and other links, without duplicates (the same address can be entered in both). */
export function profileLinks(profile: PublicProfile): string[] {
    return [...new Set([profile.website, ...(profile.links ?? [])].filter((link): link is string => Boolean(link)))];
}

export function ageOn(birth: Date, today: Date): number {
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const beforeBirthday = today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age;
}
