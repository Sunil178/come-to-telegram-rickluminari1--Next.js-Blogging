// Emails are stored as typed, so lookups compare case-insensitively (strength 2 ignores case, not accents).
export const EMAIL_COLLATION = { locale: "en", strength: 2 } as const;
