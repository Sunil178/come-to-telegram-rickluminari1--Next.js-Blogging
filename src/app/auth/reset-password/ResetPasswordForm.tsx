"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AccountFormState } from "@/actions/account";
import FormStatus from "@/components/auth/FormStatus";
import PasswordFields from "@/app/auth/register/password";
import { Button } from "@/components/ui/button";

const initialState: AccountFormState = {};

export default function ResetPasswordForm({ token }: { token: string }) {
    const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <FormStatus state={state} />
            <input type="hidden" name="token" value={token} />
            <PasswordFields disabled={pending} errors={state.validationErrors?.password} />
            <Button type="submit" className="mt-2" disabled={pending}>
                {pending ? "Saving…" : "Set new password"}
            </Button>
        </form>
    );
}
