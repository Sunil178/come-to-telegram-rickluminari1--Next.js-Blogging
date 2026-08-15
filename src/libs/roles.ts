export type RoleName = "reader" | "author" | "moderator" | "admin";

export const ROLE_RANK: Record<RoleName, number> = {
    reader: 0,
    author: 1,
    moderator: 2,
    admin: 3,
};

export function hasRole(role: RoleName | undefined, minimum: RoleName): boolean {
    return ROLE_RANK[role ?? "reader"] >= ROLE_RANK[minimum];
}
