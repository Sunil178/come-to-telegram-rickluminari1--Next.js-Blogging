import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import User from "@/models/User";
import authConfig from "@/auth.config";
import { compareSync } from "bcrypt";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const user = await User.findOne({ email: credentials.username });

                if (user && compareSync(credentials.password as string, user.password)) {
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
                    return {
                        id: user.id,
                        name: fullName || user.username,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                    };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/auth/login',
    },
});
