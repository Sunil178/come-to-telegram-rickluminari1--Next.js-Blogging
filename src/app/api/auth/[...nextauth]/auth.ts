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
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    };
                }
                return null;
            },
        }),
    ],
    callbacks: {
        async session({ session, token, user }) {
            if (token && session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
        async jwt({ token, user, account, profile }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    pages: {
        signIn: '/auth/login',
    },
});
