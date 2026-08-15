export type RoleName = "reader" | "author" | "moderator" | "admin";

export const ROLES = {
    READER: "reader",
    AUTHOR: "author",
    MODERATOR: "moderator",
    ADMIN: "admin",
} as const satisfies Record<string, RoleName>;

export const ROLE_LABELS: Record<RoleName, string> = {
    [ROLES.READER]: "Reader",
    [ROLES.AUTHOR]: "Author",
    [ROLES.MODERATOR]: "Moderator",
    [ROLES.ADMIN]: "Admin",
};

export const ROLE_RANK: Record<RoleName, number> = {
    reader: 0,
    author: 1,
    moderator: 2,
    admin: 3,
};

export function hasRole(role: RoleName | undefined, minimum: RoleName): boolean {
    return ROLE_RANK[role ?? ROLES.READER] >= ROLE_RANK[minimum];
}
