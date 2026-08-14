"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
            <p className="font-mono text-xs tracking-widest text-teal uppercase">Error</p>
            <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                We hit a snag loading this page. Try again, or head back home.
            </p>
            <div className="mt-6 flex gap-3">
                <Button onClick={reset}>Try again</Button>
                <Button asChild variant="outline">
                    <Link href="/">Go home</Link>
                </Button>
            </div>
        </div>
    );
}
