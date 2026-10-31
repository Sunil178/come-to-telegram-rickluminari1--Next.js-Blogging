"use client";

import { useActionState } from "react";
import { verifyEmailAction, type AccountFormState } from "@/actions/account";
import FormStatus from "@/components/auth/FormStatus";
import { Button } from "@/components/ui/button";

const initialState: AccountFormState = {};

// A button rather than verifying on page load: mail scanners that open links would otherwise use up the token.
export default function VerifyEmailForm({ token }: { token: string }) {
    const [state, formAction, pending] = useActionState(verifyEmailAction, initialState);

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <FormStatus state={state} />
            <input type="hidden" name="token" value={token} />
            <Button type="submit" disabled={pending}>
                {pending ? "Confirming…" : "Confirm my email"}
            </Button>
        </form>
    );
}
