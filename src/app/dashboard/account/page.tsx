import Link from "next/link";
import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import DeleteAccountForm from "@/components/account/DeleteAccountForm";
import ProfileForm from "@/components/account/ProfileForm";
import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import AccountCard from "@/components/account/AccountCard";
import { toProfileFormValues } from "@/libs/profile-view";
import type { PrivateDetails, PublicProfile } from "@/libs/profile";

export const metadata = { title: "Account" };

export default async function AccountPage() {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const user = await User.findById(session.user.id)
        .select("username email avatar profile privateDetails")
        .lean<{ username: string; email: string; avatar?: string; profile?: PublicProfile; privateDetails?: PrivateDetails }>();
    if (!user) return null;

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
            <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Signed in as <span className="text-foreground">{user.username}</span> ({user.email}). See the{" "}
                    <Link href="/privacy" className="text-primary hover:underline">privacy policy</Link> for what we store and why.
                </p>
            </div>

            <ProfileForm initial={toProfileFormValues(user)} />

            <AccountCard title="Change password" description="Changing it signs you out everywhere, this browser included.">
                <ChangePasswordForm email={user.email} />
            </AccountCard>

            <AccountCard title="Download your data" description="A JSON file with your profile, posts, comments, votes, notifications and reading history.">
                {/* A plain link: the browser saves the attachment the route returns. */}
                <a href="/api/account/export" download className="w-fit rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                    Download my data
                </a>
            </AccountCard>

            <AccountCard
                title="Delete your account"
                tone="danger"
                description="Permanently removes your account, your posts and their comments, your votes, notifications and reading history."
            >
                <DeleteAccountForm />
            </AccountCard>
        </div>
    );
}
