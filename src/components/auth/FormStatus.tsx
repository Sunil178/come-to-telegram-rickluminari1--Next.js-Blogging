import type { AccountFormState } from "@/actions/account";

// Error and confirmation banners shared by the account forms.
export default function FormStatus({ state }: { state: AccountFormState }) {
    if (state.error) {
        return (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
            </p>
        );
    }
    if (state.message) {
        return (
            <p role="status" className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
                {state.message}
            </p>
        );
    }
    return null;
}
