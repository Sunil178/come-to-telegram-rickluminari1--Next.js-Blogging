import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            username?: string;
        } & DefaultSession["user"];
    }

    interface User extends DefaultUser {
        username?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username?: string;
    }
}

// `@auth/core/index.d.ts` (which `next-auth`'s own callback types are built on) imports
// `JWT` straight from `@auth/core/jwt` rather than through the `next-auth/jwt` re-export,
// so the augmentation above alone doesn't reach the `token` param in our `session` callback.
declare module "@auth/core/jwt" {
    interface JWT {
        username?: string;
    }
}
