import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
            <p className="font-mono text-xs tracking-widest text-teal uppercase">404</p>
            <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">Page not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            </p>
            <div className="mt-6">
                <Button asChild>
                    <Link href="/">Go home</Link>
                </Button>
            </div>
        </div>
    );
}
