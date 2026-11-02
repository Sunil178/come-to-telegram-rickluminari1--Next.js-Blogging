import { signOut } from "next-auth/react";
import { unsubscribeFromPush } from "@/libs/push-subscription";
import { clearAllDrafts } from "@/libs/post-drafts";

/** Signs this browser out and drops what belongs to the account: its push subscription and unsaved drafts. */
export async function signOutOfBrowser(): Promise<void> {
    // Unsubscribe while the session is still valid: the server scopes the delete to session.user.id.
    await unsubscribeFromPush().catch(() => {});
    await signOut({ redirect: false });
    // Unsaved editor drafts belong to this account; the next person on this browser mustn't see them.
    clearAllDrafts();
}
