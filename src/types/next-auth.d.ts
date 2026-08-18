import type { DefaultSession, DefaultUser } from "next-auth";
import type { RoleName } from "@/libs/roles";

declare module "next-auth" {
    interface Session {
        user: {
            username?: string;
            role?: RoleName;
        } & DefaultSession["user"];
    }

    interface User extends DefaultUser {
        username?: string;
        role?: RoleName;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username?: string;
        role?: RoleName;
        // epoch ms the role was last checked — bounds staleness without re-querying every request
        roleCheckedAt?: number;
    }
}

// `@auth/core/index.d.ts` (which `next-auth`'s own callback types are built on) imports
// `JWT` straight from `@auth/core/jwt` rather than through the `next-auth/jwt` re-export,
// so the augmentation above alone doesn't reach the `token` param in our `session` callback.
declare module "@auth/core/jwt" {
    interface JWT {
        username?: string;
        role?: RoleName;
        roleCheckedAt?: number;
    }
}
