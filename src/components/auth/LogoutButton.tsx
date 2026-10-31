"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { unsubscribeFromPush } from "@/libs/push-subscription";
import { clearAllDrafts } from "@/libs/post-drafts";

interface LogoutButtonProps {
    className?: string;
    children?: React.ReactNode;
}

export default function LogoutButton({ className, children }: LogoutButtonProps) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    const handleLogout = async () => {
        setIsPending(true);
        try {
            // Unsubscribe while the session is still valid -- the server scopes the
            // delete to session.user.id, so this must run before signOut clears it.
            await unsubscribeFromPush().catch(() => {});

            // redirect: false allows us to handle the transition smoothly in React
            await signOut({ redirect: false });
            // Unsaved editor drafts belong to this account; the next person on this browser mustn't see them.
            clearAllDrafts();

            // router.refresh ensures the Server Components (like Navbar)
            // re-sync with the now-empty session
            router.refresh();

            // Send them back to login or home
            router.push("/auth/login");
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <button onClick={handleLogout} className={className} disabled={isPending} style={{ cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Signing out..." : children || "Logout"}
        </button>
    );
}
